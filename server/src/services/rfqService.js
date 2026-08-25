import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import {
  getPurchaseRequestById,
  completeRequesterTask,
  getRecommendedQuotedAmounts,
} from './prService.js';
import { queueRfqVendorEmail, queueRfqSendBackEmail, queueRfqSubmittedNotifyRequester, sendRfqVendorEmail, queuePrApprovalPendingNotification, queuePostRfqActionNotification } from './emailService.js';
import {
  formatDateTime,
  formatDate,
  PR_STATUS,
  STAGE,
  getPostRfqRoleConfig,
  POST_RFQ_ROLE_MAP,
} from '../utils/constants.js';
import {
  getL1ManagerForEmail,
  getL2ManagerForEmail,
  ensureApproverUser,
} from './refexOneService.js';
import { resolveScmBuyerUser, getScmBuyerNotifyEmails, resolveScmManagerUser } from '../utils/scmAssignee.js';
import { applySendBackToTarget, queueSendBackNotifications } from './sendBackService.js';

/** Default RFQ fields: vendor sees only Quoted Price (+ file upload). Other vendor fields appear after requester adds them. */
export const DEFAULT_FIELD_DEFINITIONS = [
  { id: 'quotedPrice', label: 'Quoted Price (₹)', type: 'number', filledBy: 'vendor', required: true, core: true, showIn: 'commercial' },
  { id: 'technicalScore', label: 'Technical Score', type: 'number', filledBy: 'requester', showIn: 'technical' },
  { id: 'commercialScore', label: 'Commercial Score', type: 'number', filledBy: 'requester', showIn: 'technical' },
  { id: 'overallScore', label: 'Overall Score', type: 'number', filledBy: 'requester', showIn: 'technical' },
];

/** Known vendor column fields — stored in dedicated DB columns when present in fieldDefinitions */
const VENDOR_COLUMN_FIELD_IDS = new Set([
  'quotedPrice',
  'leadTime',
  'paymentTerms',
  'warranty',
  'deliveryTerms',
  'compliance',
  'vendorNotes',
]);

function slugifyFieldId(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40) || `field_${Date.now()}`;
}

function parseJsonArray(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value) {
  if (value == null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

const REQUESTER_SCORE_FIELD_IDS = new Set(['technicalScore', 'commercialScore', 'overallScore']);
const COMMERCIAL_DEFAULT_FIELD_IDS = new Set(['make', 'brand', 'hdg', 'hdg3', 'freight', 'freightCharges']);

function defaultShowIn(id, label = '') {
  if (id === 'quotedPrice') return 'commercial';
  if (REQUESTER_SCORE_FIELD_IDS.has(id)) return 'technical';
  if (COMMERCIAL_DEFAULT_FIELD_IDS.has(id)) return 'commercial';
  if (/make|brand|hdg|freight/i.test(String(id)) || /make|brand|^hdg\b|freight/i.test(String(label))) {
    return 'commercial';
  }
  return 'technical';
}

function normalizeFieldDefinitions(defs) {
  if (!Array.isArray(defs) || !defs.length) return [...DEFAULT_FIELD_DEFINITIONS];
  const normalized = defs.map((f) => {
    if (!f || typeof f !== 'object') return null;
    const id = String(f.id || '').trim();
    if (!id) return null;
    const filledBy =
      f.filledBy === 'requester' || f.filledBy === 'vendor'
        ? f.filledBy
        : REQUESTER_SCORE_FIELD_IDS.has(id)
          ? 'requester'
          : 'vendor';
    const label = f.label || id;
    const showIn =
      f.showIn === 'commercial' || f.showIn === 'technical'
        ? f.showIn
        : defaultShowIn(id, label);
    return {
      ...f,
      id,
      label,
      type: f.type || 'text',
      filledBy,
      showIn,
      required: Boolean(f.required),
      core: Boolean(f.core) || id === 'quotedPrice',
    };
  }).filter(Boolean);

  // Always keep Quoted Price as a vendor field
  if (!normalized.some((f) => f.id === 'quotedPrice')) {
    normalized.unshift({ ...DEFAULT_FIELD_DEFINITIONS[0], showIn: 'commercial' });
  }
  return normalized.length ? normalized : [...DEFAULT_FIELD_DEFINITIONS];
}

function parseJsonFieldDefinitions(value) {
  if (Array.isArray(value) && value.length) return normalizeFieldDefinitions(value);
  if (typeof value === 'string') {
    try {
      const obj = JSON.parse(value);
      return Array.isArray(obj) && obj.length
        ? normalizeFieldDefinitions(obj)
        : [...DEFAULT_FIELD_DEFINITIONS];
    } catch {
      return [...DEFAULT_FIELD_DEFINITIONS];
    }
  }
  return [...DEFAULT_FIELD_DEFINITIONS];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/quotations');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Save quotation file to disk (best-effort) and return DB-ready buffer.
 * Cloud Run disks are ephemeral — quotation_file_data in MySQL is the source of truth.
 */
function saveQuotationFile(invitationId, round, fileName, base64Data) {
  if (!base64Data || !fileName) return { fileName: null, filePath: null, buffer: null };
  // Accept raw base64 or data-URL (data:application/pdf;base64,...)
  const raw = String(base64Data).includes(',')
    ? String(base64Data).split(',').pop()
    : String(base64Data);
  const safeName =
    path.basename(String(fileName)).replace(/[^a-zA-Z0-9._-]/g, '_') || 'quotation.pdf';
  const storedName = `${invitationId}_r${round}_${Date.now()}_${safeName}`;
  const buffer = Buffer.from(raw.replace(/\s/g, ''), 'base64');
  if (!buffer.length) {
    throw new Error('Quotation file data is empty or invalid');
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Quotation file must be under 5MB');
  }
  try {
    ensureUploadDir();
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
  } catch (err) {
    console.warn('Quotation disk write skipped (will keep DB copy):', err.message);
  }
  return { fileName: safeName, filePath: storedName, buffer };
}

function normalizeQuoteLineItems(rawLines, prLineItems = []) {
  const prLines = Array.isArray(prLineItems) ? prLineItems : [];
  const byId = new Map(prLines.map((li) => [String(li.id), li]));
  const incoming = Array.isArray(rawLines) ? rawLines : [];

  // Prefer explicit payload; otherwise build empty shells from PR lines
  const source =
    incoming.length > 0
      ? incoming
      : prLines.map((li) => ({
          lineItemId: li.id,
          description: li.description,
          quantity: li.quantity,
          quotedUnitPrice: 0,
        }));

  const lines = [];
  for (const raw of source) {
    const id = String(raw.lineItemId ?? raw.id ?? '');
    const prLine = byId.get(id) || null;
    const qty = Number(raw.quantity ?? prLine?.quantity) || 0;
    const unitPrice = Number(raw.quotedUnitPrice ?? raw.unitPrice ?? 0);
    if (Number.isNaN(qty) || qty <= 0) {
      throw new Error('Each line item quantity must be greater than 0');
    }
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new Error('Quoted unit price must be a non-negative number');
    }
    const gstPercent = Math.max(0, Number(raw.gstPercent ?? raw.gst ?? 0) || 0);
    const computed = unitPrice * qty * (1 + gstPercent / 100);
    const lineTotal =
      unitPrice === 0
        ? 0
        : Number(raw.quotedTotal ?? raw.lineTotal) > 0
          ? Number(raw.quotedTotal ?? raw.lineTotal)
          : computed;
    lines.push({
      lineItemId: prLine?.id ?? (id || null),
      description: String(prLine?.description || raw.description || '').trim(),
      category: prLine?.category || raw.category || '',
      quantity: qty,
      orderedQuantity: Number(prLine?.quantity) || qty,
      estimatedUnitCost: Number(
        raw.estimatedUnitCost ?? raw.unitCost ?? prLine?.unitCost ?? prLine?.unitPrice ?? 0
      ) || 0,
      quotedUnitPrice: unitPrice,
      gstPercent,
      quotedTotal: Math.round(lineTotal * 100) / 100,
      extra: Boolean(raw.extra) || !prLine,
    });
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0);
  return { lines, total };
}

/** Merge line-item quotes into body; sets quotedPrice = sum of line totals. */
function applyQuoteLineItemsToSubmissionBody(body, pr) {
  const hasLines =
    Array.isArray(body?.quoteLineItems) && body.quoteLineItems.length > 0;
  if (!hasLines) return { lines: [], total: Number(body?.quotedPrice) || 0 };

  const prLines = pr?.lineItems || [];
  const { lines, total } = normalizeQuoteLineItems(body.quoteLineItems, prLines);

  if (prLines.length && lines.length < prLines.length) {
    throw new Error('Enter quoted amount for every line item');
  }
  if (lines.some((l) => !l.quantity || l.quantity <= 0)) {
    throw new Error('Each line item must have quantity greater than 0');
  }
  if (lines.some((l) => Number(l.quotedUnitPrice) < 0 || Number.isNaN(Number(l.quotedUnitPrice)))) {
    throw new Error('Each line item must have a quoted unit price of 0 or more');
  }
  if (Number(total) < 0) {
    throw new Error('Total quoted amount cannot be negative');
  }

  body.quotedPrice = total;
  body.customFields = {
    ...(body.customFields || {}),
    quoteLineItems: lines,
  };
  return { lines, total };
}

function mapSubmissionRow(s) {
  const customFields = parseJsonObject(s.custom_fields);
  const requesterFields = parseJsonObject(s.requester_fields);
  const quoteLineItems = Array.isArray(customFields.quoteLineItems)
    ? customFields.quoteLineItems
    : [];
  return {
    id: s.id,
    round: s.round,
    quotedPrice: Number(s.quoted_price),
    leadTime: s.lead_time_days,
    paymentTerms: s.payment_terms,
    compliance: Boolean(s.compliance),
    vendorNotes: s.vendor_notes,
    warranty: s.warranty || '',
    deliveryTerms: s.delivery_terms || '',
    quotationFileName: s.quotation_file_name || '',
    quotationFilePath: s.quotation_file_path || '',
    hasQuotationFile: Boolean(
      s.quotation_file_name ||
        s.quotation_file_path ||
        (s.quotation_file_data &&
          (Buffer.isBuffer(s.quotation_file_data)
            ? s.quotation_file_data.length > 0
            : Boolean(s.quotation_file_data.length)))
    ),
    quoteLineItems,
    customFields,
    requesterFields,
    status: s.status,
    submittedAt: formatDateTime(s.submitted_at),
  };
}

async function getOrCreateRfqConfig(prId) {
  const [rows] = await pool.query(`SELECT * FROM rfq_configs WHERE pr_id = ?`, [prId]);
  if (rows.length) {
    return {
      prId,
      fieldDefinitions: parseJsonFieldDefinitions(rows[0].field_definitions),
      recommendedInvitationId: rows[0].recommended_invitation_id,
      recommendationJustification: rows[0].recommendation_justification || '',
      sendBackRemarks: rows[0].send_back_remarks || '',
      maxRounds: rows[0].max_rounds,
      requesterSubmittedAt: rows[0].requester_submitted_at || null,
      finalizedAt: rows[0].finalized_at,
      requireCfoApproval:
        rows[0].require_cfo_approval === null || rows[0].require_cfo_approval === undefined
          ? null
          : Boolean(rows[0].require_cfo_approval),
    };
  }
  await pool.query(
    `INSERT INTO rfq_configs (pr_id, field_definitions) VALUES (?, ?)`,
    [prId, JSON.stringify(DEFAULT_FIELD_DEFINITIONS)]
  );
  return {
    prId,
    fieldDefinitions: [...DEFAULT_FIELD_DEFINITIONS],
    recommendedInvitationId: null,
    recommendationJustification: '',
    sendBackRemarks: '',
    maxRounds: null,
    requesterSubmittedAt: null,
    finalizedAt: null,
    requireCfoApproval: null,
  };
}

/**
 * Create PR Functional Own: persist vendors + quotation rounds/files, then mark requester RFQ submitted.
 */
export async function seedFunctionalOwnRfq(user, prId, rfqVendors = [], options = {}) {
  const markSubmitted = options.markSubmitted !== false;
  const maxRounds = Math.min(20, Math.max(1, Number(options.maxRounds) || 1));
  const vendors = Array.isArray(rfqVendors) ? rfqVendors : [];
  if (!vendors.length) {
    throw new Error('Add at least one vendor with a round-1 quotation and file');
  }

  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (pr.requesterId !== user.id && user.role !== 'Super Admin' && user.role !== 'SCM Manager') {
    throw new Error('Unauthorized');
  }

  await getOrCreateRfqConfig(prId);
  await pool.query(
    `UPDATE rfq_configs SET max_rounds = ?, updated_at = NOW() WHERE pr_id = ?`,
    [maxRounds, prId]
  );

  const [existing] = await pool.query(
    `SELECT id FROM rfq_invitations WHERE pr_id = ?`,
    [prId]
  );
  if (existing.length) {
    const ids = existing.map((r) => r.id);
    const ph = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM vendor_quotation_submissions WHERE rfq_invitation_id IN (${ph})`, ids);
    await pool.query(`DELETE FROM rfq_invitations WHERE pr_id = ?`, [prId]);
  }

  for (const vendor of vendors) {
    let name = String(vendor.name || vendor.vendorName || '').trim();
    let email = String(vendor.email || vendor.vendorEmail || '').trim().toLowerCase();
    const vendorId = Number(vendor.vendorId || vendor.id) || null;
    if (vendorId) {
      const [vRows] = await pool.query(
        `SELECT name, email FROM vendors WHERE id = ? LIMIT 1`,
        [vendorId]
      );
      if (vRows[0]) {
        name = name || vRows[0].name;
        email = email || String(vRows[0].email || '').toLowerCase();
      }
    }
    if (!name || !email) {
      throw new Error('Each Functional Own vendor needs a name and email');
    }

    const quotes = (Array.isArray(vendor.quotes) ? vendor.quotes : [])
      .map((q) => ({
        round: Math.max(1, Number(q.round) || 1),
        quotedPrice: Number(q.quotedPrice),
        leadTime: Number(q.leadTime) || 0,
        paymentTerms: String(q.paymentTerms || 'Net 30').trim() || 'Net 30',
        quotationFileName: q.quotationFileName,
        quotationFileData: q.quotationFileData,
      }))
      .filter((q) => q.round <= maxRounds)
      .sort((a, b) => a.round - b.round);

    const round1 = quotes.find((q) => q.round === 1);
    if (!round1 || !(round1.quotedPrice > 0)) {
      throw new Error(`Enter a round-1 quoted price for ${name}`);
    }
    if (!round1.quotationFileName || !round1.quotationFileData) {
      throw new Error(`Attach a round-1 quotation file for ${name}`);
    }

    const token = generateToken();
    const latestRound = quotes[quotes.length - 1]?.round || 1;
    const [invResult] = await pool.query(
      `INSERT INTO rfq_invitations (pr_id, vendor_name, vendor_email, access_token, round, status, created_by, invite_mode)
       VALUES (?, ?, ?, ?, ?, 'submitted', ?, 'manual')`,
      [prId, name, email, token, latestRound, user.id]
    );
    const invitationId = invResult.insertId;

    for (const quote of quotes) {
      if (!(quote.quotedPrice > 0) || !quote.quotationFileName || !quote.quotationFileData) {
        continue;
      }
      const fileInfo = saveQuotationFile(
        invitationId,
        quote.round,
        quote.quotationFileName,
        quote.quotationFileData
      );
      if (!fileInfo.filePath) {
        throw new Error(`Failed to save quotation file for ${name} round ${quote.round}`);
      }
      await pool.query(
        `INSERT INTO vendor_quotation_submissions
         (rfq_invitation_id, round, quoted_price, lead_time_days, payment_terms, compliance, vendor_notes,
          warranty, delivery_terms, quotation_file_name, quotation_file_path, quotation_file_data, custom_fields, requester_fields, status)
         VALUES (?, ?, ?, ?, ?, 1, ?, '', '', ?, ?, ?, ?, ?, 'submitted')`,
        [
          invitationId,
          quote.round,
          quote.quotedPrice,
          quote.leadTime,
          quote.paymentTerms,
          `Entered on Create PR by ${user.name || user.email}`,
          fileInfo.fileName,
          fileInfo.filePath,
          fileInfo.buffer,
          JSON.stringify({}),
          JSON.stringify({ enteredBy: user.name, entryMode: 'create-pr' }),
        ]
      );
    }
  }

  if (markSubmitted) {
    await pool.query(
      `UPDATE rfq_configs SET requester_submitted_at = NOW(), updated_at = NOW() WHERE pr_id = ?`,
      [prId]
    );
  }
}

function extractCoreVendorValues(body, fieldDefinitions, customFields = {}) {
  const defs = fieldDefinitions.filter((f) => f.filledBy !== 'requester');
  const enabledIds = new Set(defs.map((f) => f.id));
  const merged = { ...customFields, ...(body.customFields || {}), ...body };

  const core = {
    quotedPrice: merged.quotedPrice ?? body.quotedPrice,
    leadTime: enabledIds.has('leadTime') ? merged.leadTime ?? body.leadTime : body.leadTime ?? 0,
    paymentTerms: enabledIds.has('paymentTerms')
      ? merged.paymentTerms ?? body.paymentTerms
      : body.paymentTerms || 'Net 30',
    warranty: enabledIds.has('warranty') ? merged.warranty ?? body.warranty ?? '' : body.warranty || '',
    deliveryTerms: enabledIds.has('deliveryTerms')
      ? merged.deliveryTerms ?? body.deliveryTerms ?? ''
      : body.deliveryTerms || '',
    compliance: enabledIds.has('compliance')
      ? Boolean(merged.compliance ?? body.compliance)
      : body.compliance !== undefined
        ? Boolean(body.compliance)
        : true,
    vendorNotes: enabledIds.has('vendorNotes')
      ? merged.vendorNotes ?? body.vendorNotes ?? ''
      : body.vendorNotes || '',
  };

  const extra = { ...customFields, ...(body.customFields || {}) };
  for (const field of defs) {
    if (VENDOR_COLUMN_FIELD_IDS.has(field.id)) continue;
    const val = merged[field.id];
    if (val !== undefined && val !== '') extra[field.id] = val;
  }
  return { core, customFields: extra };
}

function submissionToFieldValues(submission) {
  return {
    quotedPrice: submission?.quotedPrice,
    leadTime: submission?.leadTime,
    paymentTerms: submission?.paymentTerms,
    warranty: submission?.warranty,
    deliveryTerms: submission?.deliveryTerms,
    compliance: submission?.compliance,
    vendorNotes: submission?.vendorNotes,
    quoteLineItems: submission?.quoteLineItems || submission?.customFields?.quoteLineItems || [],
    ...(submission?.customFields || {}),
    ...(submission?.requesterFields || {}),
  };
}

/** Latest vendor quote that counts for RFQ finalize (current round, status submitted). */
function findActiveSubmission(inv) {
  if (!inv?.submissions?.length) return null;

  const currentRound = inv.submissions.find(
    (s) => s.round === inv.round && s.status === 'submitted'
  );
  if (currentRound) return currentRound;

  if (inv.status === 'submitted') {
    return [...inv.submissions].reverse().find((s) => s.status === 'submitted') || null;
  }

  return null;
}

function activeQuoteErrorMessage(inv) {
  if (!inv) return 'Recommended vendor not found';
  if (inv.status === 'invited') {
    return `${inv.vendorName} has not submitted a quotation yet. Wait for the vendor to submit via the RFQ email link.`;
  }
  if (inv.status === 'sent_back') {
    return `${inv.vendorName} must re-submit quotation for Round ${inv.round} before you can finalize RFQ.`;
  }
  return `${inv.vendorName} does not have a valid submitted quotation. Select a vendor with a completed quote.`;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function appUrl(path) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path}`;
}

/** Notify the RFQ-entry assignee when a vendor quote is submitted. */
async function notifyQuoteSubmittedAssignees(pr, inv, submission) {
  const isOwn = (pr.vendorSelection || pr.vendor_selection) === 'own';
  const recipients = [];

  if (isOwn) {
    const [requesterRows] = await pool.query(
      `SELECT u.email, u.name FROM users u WHERE u.id = ?`,
      [pr.requesterId || pr.requester_id]
    );
    if (requesterRows[0]?.email) {
      recipients.push({
        email: requesterRows[0].email,
        name: requesterRows[0].name,
        reviewUrl: appUrl(`/requester/rfq-entry/${inv.pr_id}`),
      });
    }
  } else {
    const buyer = await resolveScmBuyerUser();
    if (buyer?.email) {
      recipients.push({
        email: buyer.email,
        name: buyer.name,
        reviewUrl: appUrl(`/scm/rfq-entry/${inv.pr_id}`),
      });
    }
  }

  for (const r of recipients) {
    queueRfqSubmittedNotifyRequester(
      pr,
      inv.vendor_name,
      r.email,
      r.name,
      submission,
      r.reviewUrl
    );
  }
}

async function getInvitationsWithSubmissions(prId) {
  const [invitations] = await pool.query(
    `SELECT * FROM rfq_invitations WHERE pr_id = ? ORDER BY id ASC`,
    [prId]
  );

  const result = [];
  for (const inv of invitations) {
    const [submissions] = await pool.query(
      `SELECT * FROM vendor_quotation_submissions WHERE rfq_invitation_id = ? ORDER BY round ASC, submitted_at ASC`,
      [inv.id]
    );
    result.push({
      id: inv.id,
      prId: inv.pr_id,
      vendorName: inv.vendor_name,
      vendorEmail: inv.vendor_email,
      accessToken: inv.access_token,
      round: inv.round,
      status: inv.status,
      inviteMode: inv.invite_mode || 'email',
      sendBackReason: inv.send_back_reason,
      sendBackFields: parseJsonArray(inv.send_back_fields),
      submissions: submissions.map(mapSubmissionRow),
    });
  }
  return result;
}

export async function inviteVendors(user, prId, vendors, fieldDefinitions = null, { sendEmail = true } = {}) {
  if (!vendors?.length) throw new Error('At least one vendor is required');

  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (pr.requesterId !== user.id && user.role !== 'SCM Buyer' && user.role !== 'Requester') {
    throw new Error('Unauthorized');
  }

  const config = await getOrCreateRfqConfig(prId);
  if (config.finalizedAt) throw new Error('RFQ already finalized');
  if (user.role === 'Requester' && config.requesterSubmittedAt) {
    throw new Error('RFQ already submitted to SCM');
  }

  if (fieldDefinitions?.length) {
    await pool.query(
      `UPDATE rfq_configs SET field_definitions = ?, updated_at = NOW() WHERE pr_id = ?`,
      [JSON.stringify(normalizeFieldDefinitions(fieldDefinitions)), prId]
    );
  }

  const [existingRows] = await pool.query(
    `SELECT vendor_email, vendor_name FROM rfq_invitations WHERE pr_id = ?`,
    [prId]
  );
  const existingNames = new Set(
    existingRows.map((r) => r.vendor_name.trim().toLowerCase())
  );

  const created = [];
  const skipped = [];
  for (const vendor of vendors) {
    const email = vendor.email?.trim().toLowerCase();
    const name = vendor.name?.trim();
    if (!email || !name) throw new Error('Vendor name and email are required');
    if (existingNames.has(name.toLowerCase())) {
      skipped.push(name);
      continue;
    }

    const token = generateToken();
    const inviteMode = sendEmail ? 'email' : 'manual';
    const [result] = await pool.query(
      `INSERT INTO rfq_invitations (pr_id, vendor_name, vendor_email, access_token, round, status, created_by, invite_mode)
       VALUES (?, ?, ?, ?, 1, 'invited', ?, ?)`,
      [prId, name, email, token, user.id, inviteMode]
    );

    if (sendEmail) {
      const submitUrl = appUrl(`/vendor/submit-quote/${token}`);
      queueRfqVendorEmail(pr, name, email, submitUrl, 1);
    }
    created.push({ id: result.insertId, vendorName: name, vendorEmail: email, inviteMode });
    existingNames.add(name.toLowerCase());
  }

  if (!created.length && skipped.length) {
    throw new Error(
      skipped.length === 1
        ? `"${skipped[0]}" was already invited for this PR. Select a different vendor.`
        : `These vendors were already invited: ${skipped.join(', ')}`
    );
  }
  if (!created.length) {
    throw new Error('No new vendors to invite');
  }

  const rfq = await getInvitationsWithSubmissions(prId);
  const updatedConfig = await getOrCreateRfqConfig(prId);
  return {
    invitations: created,
    skipped,
    rfq,
    config: updatedConfig,
    sendEmail,
    message: sendEmail
      ? `RFQ emails sent to ${created.length} vendor(s)`
      : `${created.length} vendor(s) added for manual entry (no email sent)`,
  };
}

/** Remove a vendor invitation (and their quote submissions) before RFQ finalize. */
export async function removeRfqInvitation(user, invitationId) {
  if (!['Requester', 'SCM Buyer'].includes(user.role)) {
    throw new Error('Unauthorized');
  }

  const [rows] = await pool.query(
    `SELECT ri.*, pr.requester_id
     FROM rfq_invitations ri
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE ri.id = ?`,
    [invitationId]
  );
  if (!rows.length) throw new Error('Vendor invitation not found');

  const inv = rows[0];
  if (user.role === 'Requester' && inv.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }

  const config = await getOrCreateRfqConfig(inv.pr_id);
  if (config.finalizedAt) throw new Error('Cannot remove vendor after RFQ is finalized');
  if (user.role === 'Requester' && config.requesterSubmittedAt) {
    throw new Error('Cannot remove vendor after RFQ is submitted to SCM');
  }

  if (config.recommendedInvitationId === inv.id) {
    await pool.query(
      `UPDATE rfq_configs
       SET recommended_invitation_id = NULL,
           recommendation_justification = NULL,
           updated_at = NOW()
       WHERE pr_id = ?`,
      [inv.pr_id]
    );
  }

  await pool.query(`DELETE FROM rfq_invitations WHERE id = ?`, [invitationId]);

  const rfq = await getInvitationsWithSubmissions(inv.pr_id);
  const updatedConfig = await getOrCreateRfqConfig(inv.pr_id);
  return {
    prId: inv.pr_id,
    removedVendorName: inv.vendor_name,
    rfq,
    config: updatedConfig,
    tableRows: mapInvitationsToTableRows(rfq, updatedConfig),
    quotations: mapInvitationsToQuotations(rfq),
    message: `"${inv.vendor_name}" removed from RFQ`,
  };
}

async function userCanViewPrQuotes(user, pr) {
  if (!user || !pr) return false;
  const privileged = ['Super Admin', 'SCM Buyer', 'SCM Manager', 'HOD Approver', 'PR Manager', 'CFO'];
  if (privileged.includes(user.role)) return true;
  if (Number(pr.requesterId) === Number(user.id)) return true;
  const chain = Array.isArray(pr.approvalUserIds) ? pr.approvalUserIds : [];
  if (chain.some((id) => Number(id) === Number(user.id))) return true;
  if (pr.approvalUserId && Number(pr.approvalUserId) === Number(user.id)) return true;
  const [tasks] = await pool.query(
    `SELECT id FROM workflow_tasks
     WHERE pr_id = ? AND assigned_user_id = ? AND status IN ('pending', 'in_progress')
     LIMIT 1`,
    [pr.id, user.id]
  );
  return Boolean(tasks.length);
}

export async function getRfqByPrId(user, prId) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (!(await userCanViewPrQuotes(user, pr))) {
    throw new Error('Unauthorized');
  }
  const config = await getOrCreateRfqConfig(prId);
  const invitations = await getInvitationsWithSubmissions(prId);
  return { pr, invitations, config };
}

export async function getRfqByToken(token) {
  const [rows] = await pool.query(
    `SELECT ri.*, pr.id AS pr_id FROM rfq_invitations ri
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE ri.access_token = ?`,
    [token]
  );
  if (!rows.length) throw new Error('Invalid or expired RFQ link');

  const inv = rows[0];
  const pr = await getPurchaseRequestById(inv.pr_id);
  const config = await getOrCreateRfqConfig(inv.pr_id);

  const [submissions] = await pool.query(
    `SELECT * FROM vendor_quotation_submissions WHERE rfq_invitation_id = ? ORDER BY round DESC LIMIT 1`,
    [inv.id]
  );
  const latestSubmission = submissions[0] || null;

  return {
    invitation: {
      id: inv.id,
      vendorName: inv.vendor_name,
      vendorEmail: inv.vendor_email,
      round: inv.round,
      status: inv.status,
      sendBackReason: inv.send_back_reason,
      sendBackFields: parseJsonArray(inv.send_back_fields),
    },
    pr,
    latestSubmission: latestSubmission
      ? {
          round: latestSubmission.round,
          quotedPrice: Number(latestSubmission.quoted_price),
          leadTime: latestSubmission.lead_time_days,
          paymentTerms: latestSubmission.payment_terms,
          warranty: latestSubmission.warranty || '',
          deliveryTerms: latestSubmission.delivery_terms || '',
          compliance: Boolean(latestSubmission.compliance),
          vendorNotes: latestSubmission.vendor_notes,
          quotationFileName: latestSubmission.quotation_file_name || '',
          status: latestSubmission.status,
        }
      : null,
    canSubmit: inv.status === 'invited' || inv.status === 'sent_back',
    fieldDefinitions: config.fieldDefinitions.filter((f) => f.filledBy === 'vendor'),
  };
}

export async function submitVendorQuotation(token, body = {}) {
  const [rows] = await pool.query(`SELECT * FROM rfq_invitations WHERE access_token = ?`, [token]);
  if (!rows.length) throw new Error('Invalid RFQ link');

  const inv = rows[0];
  if (inv.status !== 'invited' && inv.status !== 'sent_back') {
    throw new Error('Quotation already submitted. Wait for buyer feedback if revision is needed.');
  }

  const pr = await getPurchaseRequestById(inv.pr_id);
  applyQuoteLineItemsToSubmissionBody(body, pr);

  const {
    quotedPrice,
    leadTime,
    paymentTerms,
    compliance,
    vendorNotes,
    warranty,
    deliveryTerms,
    quotationFileName,
    quotationFileData,
  } = body;
  if (quotedPrice == null || Number.isNaN(Number(quotedPrice)) || Number(quotedPrice) < 0) {
    throw new Error('Quoted price is required');
  }

  const config = await getOrCreateRfqConfig(inv.pr_id);
  const { core, customFields } = extractCoreVendorValues(body, config.fieldDefinitions);

  if (!quotationFileName || !quotationFileData) {
    throw new Error('Quotation file is required (PDF or image)');
  }
  const fileInfo = saveQuotationFile(
    inv.id,
    inv.round,
    quotationFileName,
    quotationFileData
  );
  if (!fileInfo.filePath) {
    throw new Error('Failed to save quotation file');
  }

  await pool.query(
    `INSERT INTO vendor_quotation_submissions
     (rfq_invitation_id, round, quoted_price, lead_time_days, payment_terms, compliance, vendor_notes, warranty, delivery_terms, quotation_file_name, quotation_file_path, quotation_file_data, custom_fields, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
    [
      inv.id,
      inv.round,
      Number(core.quotedPrice),
      Number(core.leadTime) || 0,
      core.paymentTerms || 'Net 30',
      core.compliance !== false ? 1 : 0,
      core.vendorNotes || '',
      core.warranty || '',
      core.deliveryTerms || '',
      fileInfo.fileName,
      fileInfo.filePath,
      fileInfo.buffer,
      JSON.stringify(customFields),
    ]
  );

  await pool.query(
    `UPDATE rfq_invitations SET status = 'submitted', send_back_reason = NULL, send_back_fields = NULL, updated_at = NOW() WHERE id = ?`,
    [inv.id]
  );

  await notifyQuoteSubmittedAssignees(pr, inv, {
    quotedPrice: Number(core.quotedPrice),
    leadTime: Number(core.leadTime) || 0,
    paymentTerms: core.paymentTerms || 'Net 30',
    warranty: core.warranty || '',
    deliveryTerms: core.deliveryTerms || '',
    compliance: core.compliance !== false,
    vendorNotes: core.vendorNotes || '',
  });

  return { message: 'Quotation submitted successfully', round: inv.round };
}

export async function submitManualVendorQuotation(user, invitationId, body = {}) {
  if (!['Requester', 'SCM Buyer'].includes(user.role)) {
    throw new Error('Unauthorized');
  }

  const [rows] = await pool.query(
    `SELECT ri.*, pr.requester_id FROM rfq_invitations ri
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE ri.id = ?`,
    [invitationId]
  );
  if (!rows.length) throw new Error('RFQ invitation not found');

  const inv = rows[0];
  if (user.role === 'Requester' && inv.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  if (inv.status !== 'invited' && inv.status !== 'sent_back') {
    throw new Error('Quotation already submitted. Use Send Back if vendor must revise.');
  }

  const pr = await getPurchaseRequestById(inv.pr_id);
  applyQuoteLineItemsToSubmissionBody(body, pr);

  const config = await getOrCreateRfqConfig(inv.pr_id);
  const { core, customFields } = extractCoreVendorValues(body, config.fieldDefinitions);
  if (core.quotedPrice == null || Number.isNaN(Number(core.quotedPrice)) || Number(core.quotedPrice) < 0) {
    throw new Error('Quoted price is required');
  }

  let fileInfo = { fileName: '', filePath: null, buffer: null };
  if (body.quotationFileName && body.quotationFileData) {
    fileInfo = saveQuotationFile(
      inv.id,
      inv.round,
      body.quotationFileName,
      body.quotationFileData
    );
    if (!fileInfo.filePath && !fileInfo.buffer) {
      throw new Error('Failed to save quotation file — try a smaller PDF/image under 5MB');
    }
  } else {
    const [prevFiles] = await pool.query(
      `SELECT quotation_file_name, quotation_file_path, quotation_file_data
       FROM vendor_quotation_submissions
       WHERE rfq_invitation_id = ? AND quotation_file_name IS NOT NULL AND quotation_file_name <> ''
       ORDER BY round DESC, id DESC
       LIMIT 1`,
      [inv.id]
    );
    if (!prevFiles.length) {
      throw new Error('Quotation file is required. Upload a PDF or photo first.');
    }
    fileInfo = {
      fileName: prevFiles[0].quotation_file_name,
      filePath: prevFiles[0].quotation_file_path,
      buffer: prevFiles[0].quotation_file_data,
    };
  }

  const requesterFieldDefs = config.fieldDefinitions.filter((f) => f.filledBy === 'requester');
  const requesterFields = {
    ...(body.requesterFields || {}),
    technicalScore: Number(body.requesterFields?.technicalScore ?? body.technicalScore) || 0,
    commercialScore: Number(body.requesterFields?.commercialScore ?? body.commercialScore) || 0,
    overallScore: Number(body.requesterFields?.overallScore ?? body.overallScore) || 0,
    enteredBy: user.name,
    entryMode: 'manual',
  };
  for (const field of requesterFieldDefs) {
    if (body.requesterFields?.[field.id] !== undefined) {
      requesterFields[field.id] = body.requesterFields[field.id];
    }
  }

  const manualNote = body.vendorNotes?.trim()
    ? body.vendorNotes.trim()
    : `Manually entered by ${user.name}`;

  await pool.query(
    `INSERT INTO vendor_quotation_submissions
     (rfq_invitation_id, round, quoted_price, lead_time_days, payment_terms, compliance, vendor_notes, warranty, delivery_terms, quotation_file_name, quotation_file_path, quotation_file_data, custom_fields, requester_fields, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
    [
      inv.id,
      inv.round,
      Number(core.quotedPrice),
      Number(core.leadTime) || 0,
      core.paymentTerms || 'Net 30',
      core.compliance !== false ? 1 : 0,
      manualNote,
      core.warranty || '',
      core.deliveryTerms || '',
      fileInfo.fileName,
      fileInfo.filePath,
      fileInfo.buffer,
      JSON.stringify(customFields),
      JSON.stringify(requesterFields),
    ]
  );

  await pool.query(
    `UPDATE rfq_invitations SET status = 'submitted', send_back_reason = NULL, send_back_fields = NULL, updated_at = NOW() WHERE id = ?`,
    [inv.id]
  );

  await notifyQuoteSubmittedAssignees(pr, inv, {
    quotedPrice: Number(core.quotedPrice),
    leadTime: Number(core.leadTime) || 0,
    paymentTerms: core.paymentTerms || 'Net 30',
    warranty: core.warranty || '',
    deliveryTerms: core.deliveryTerms || '',
    compliance: core.compliance !== false,
    vendorNotes: manualNote,
  });

  const rfq = await getInvitationsWithSubmissions(inv.pr_id);
  const full = await getRfqByPrId(user, inv.pr_id);
  return {
    message: `Quotation saved for ${inv.vendor_name}. Requester notified by email.`,
    quotations: mapInvitationsToQuotations(rfq),
    tableRows: mapInvitationsToTableRows(rfq, full.config),
    config: full.config,
  };
}

export async function resendRfqInvitationEmail(user, invitationId) {
  if (!['Requester', 'SCM Buyer'].includes(user.role)) {
    throw new Error('Unauthorized');
  }

  const [rows] = await pool.query(
    `SELECT ri.*, pr.requester_id FROM rfq_invitations ri
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE ri.id = ?`,
    [invitationId]
  );
  if (!rows.length) throw new Error('RFQ invitation not found');

  const inv = rows[0];
  if (user.role === 'Requester' && inv.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  if (inv.invite_mode !== 'email') {
    throw new Error('Manual-entry vendors do not receive RFQ email. Edit the row directly in the table.');
  }

  const pr = await getPurchaseRequestById(inv.pr_id);
  const submitUrl = appUrl(`/vendor/submit-quote/${inv.access_token}`);
  await sendRfqVendorEmail(pr, inv.vendor_name, inv.vendor_email, submitUrl, inv.round);

  return { message: `RFQ email sent to ${inv.vendor_email}` };
}

export async function sendBackVendorQuote(user, invitationId, reason, fields = []) {
  const [rows] = await pool.query(
    `SELECT ri.*, pr.requester_id FROM rfq_invitations ri
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE ri.id = ?`,
    [invitationId]
  );
  if (!rows.length) throw new Error('RFQ invitation not found');

  const inv = rows[0];
  if (user.role === 'Requester' && inv.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  if (inv.status !== 'submitted') {
    throw new Error('Can only send back submitted quotations');
  }

  const config = await getOrCreateRfqConfig(inv.pr_id);
  const newRound = inv.round + 1;
  if (config.maxRounds != null && newRound > config.maxRounds) {
    await pool.query(`UPDATE rfq_configs SET max_rounds = ?, updated_at = NOW() WHERE pr_id = ?`, [
      newRound,
      inv.pr_id,
    ]);
  }

  const reasonText = [reason, ...(fields || [])].filter(Boolean).join('\n');

  await pool.query(
    `UPDATE vendor_quotation_submissions SET status = 'sent_back'
     WHERE rfq_invitation_id = ? AND round = ?`,
    [inv.id, inv.round]
  );

  await pool.query(
    `UPDATE rfq_invitations
     SET status = 'sent_back', round = ?, send_back_reason = ?, send_back_fields = ?, updated_at = NOW()
     WHERE id = ?`,
    [newRound, reason || '', JSON.stringify(fields || []), inv.id]
  );

  const pr = await getPurchaseRequestById(inv.pr_id);
  if (inv.invite_mode !== 'manual') {
    const submitUrl = appUrl(`/vendor/submit-quote/${inv.access_token}`);
    queueRfqSendBackEmail(pr, inv.vendor_name, inv.vendor_email, submitUrl, newRound, reasonText, fields);
  }

  return getInvitationsWithSubmissions(inv.pr_id);
}

export async function saveRfqConfig(
  user,
  prId,
  { fieldDefinitions, maxRounds, recommendedInvitationId, recommendationJustification }
) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (user.role === 'Requester' && pr.requesterId !== user.id) throw new Error('Unauthorized');

  const config = await getOrCreateRfqConfig(prId);
  if (config.finalizedAt) throw new Error('RFQ already finalized');
  if (user.role === 'Requester' && config.requesterSubmittedAt) {
    throw new Error('RFQ already submitted to SCM');
  }

  let defs = config.fieldDefinitions;
  if (fieldDefinitions?.length) {
    defs = normalizeFieldDefinitions(
      fieldDefinitions.map((f) => ({
        ...f,
        id: f.id || slugifyFieldId(f.label),
        filledBy: f.filledBy === 'requester' ? 'requester' : 'vendor',
      }))
    );
  }

  const nextJustification =
    recommendationJustification !== undefined
      ? String(recommendationJustification || '').trim()
      : config.recommendationJustification || '';

  await pool.query(
    `UPDATE rfq_configs
     SET field_definitions = ?, max_rounds = ?, recommended_invitation_id = ?,
         recommendation_justification = ?, updated_at = NOW()
     WHERE pr_id = ?`,
    [
      JSON.stringify(defs),
      maxRounds ?? config.maxRounds,
      recommendedInvitationId ?? config.recommendedInvitationId,
      nextJustification || null,
      prId,
    ]
  );
  return getOrCreateRfqConfig(prId);
}

export async function updateSubmissionReviewFields(user, submissionId, requesterFields) {
  const [rows] = await pool.query(
    `SELECT vqs.*, ri.pr_id, pr.requester_id
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE vqs.id = ?`,
    [submissionId]
  );
  if (!rows.length) throw new Error('Submission not found');
  const row = rows[0];
  if (user.role === 'Requester' && row.requester_id !== user.id) throw new Error('Unauthorized');

  const existing = parseJsonObject(row.requester_fields);
  const merged = { ...existing, ...(requesterFields || {}) };

  await pool.query(`UPDATE vendor_quotation_submissions SET requester_fields = ? WHERE id = ?`, [
    JSON.stringify(merged),
    submissionId,
  ]);
  return { success: true };
}

export async function finalizeRfq(user, prId, { recommendedInvitationId, taskId, recommendationJustification }) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (user.role === 'Requester' && pr.requesterId !== user.id) throw new Error('Unauthorized');

  const isOwnVendor = pr.vendorSelection === 'own';
  const isRequester = user.role === 'Requester';
  const isScmBuyer = user.role === 'SCM Buyer';

  if (isRequester && !isOwnVendor) {
    throw new Error('RFQ entry for this PR is handled by SCM');
  }
  if (!isRequester && !isScmBuyer) {
    throw new Error('Unauthorized');
  }

  const config = await getOrCreateRfqConfig(prId);
  if (config.finalizedAt) throw new Error('RFQ already finalized');
  if (isRequester && config.requesterSubmittedAt) {
    throw new Error('RFQ already submitted for vendor approval');
  }
  // Own SCM final only after HOD → L2 → CFO post-RFQ (status back to APPROVED)
  if (isOwnVendor && isScmBuyer) {
    if (!config.requesterSubmittedAt) {
      throw new Error('Requester must submit RFQ before SCM finalization');
    }
    if (pr.status !== PR_STATUS.APPROVED) {
      throw new Error(
        pr.prFlow === 'functional'
          ? 'Selected user must approve this PR before SCM final RFQ'
          : 'PR must complete HOD / L2 / CFO vendor approvals before SCM final RFQ'
      );
    }
  }
  if (!isOwnVendor && isScmBuyer && pr.status !== PR_STATUS.APPROVED) {
    throw new Error('PR is not ready for SCM RFQ entry');
  }

  const invitations = await getInvitationsWithSubmissions(prId);
  if (!invitations.length) throw new Error('Invite at least one vendor before submitting RFQ');

  if (!recommendedInvitationId) {
    throw new Error('Select a recommended vendor before submitting RFQ');
  }

  const recommended = invitations.find((i) => i.id === Number(recommendedInvitationId));
  if (!recommended) throw new Error('Recommended vendor not found');

  const latestQuote = findActiveSubmission(recommended);
  if (!latestQuote) {
    throw new Error(activeQuoteErrorMessage(recommended));
  }

  const justification = String(
    recommendationJustification ?? config.recommendationJustification ?? ''
  ).trim();
  if (!justification) {
    throw new Error('Provide justification for the recommended vendor');
  }

  const requesterFieldDefs = config.fieldDefinitions.filter((f) => f.filledBy === 'requester' && f.required);
  for (const field of requesterFieldDefs) {
    const val = latestQuote.requesterFields?.[field.id];
    if (val === undefined || val === null || val === '') {
      throw new Error(`Fill required field: ${field.label}`);
    }
  }

  const quotePrice = Number(latestQuote.quotedPrice) || 0;
  const quotePriceLabel = `₹${quotePrice.toLocaleString('en-IN')}`;
  const justificationNote = ` Justification: ${justification}`;

  // Own vendor + Requester → HOD vendor final → L2 → CFO
  if (isOwnVendor && isRequester) {
    await pool.query(
      `UPDATE rfq_configs
       SET recommended_invitation_id = ?, recommendation_justification = ?,
           requester_submitted_at = NOW(), updated_at = NOW()
       WHERE pr_id = ?`,
      [recommendedInvitationId, justification, prId]
    );
    if (taskId) {
      await completeRequesterTask(user, taskId);
    }
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, ?, ?, 'submitted', ?)`,
      [
        prId,
        STAGE.RFQ_REQUESTER_SUBMIT,
        user.id,
        `RFQ submitted for Vendor Final Approval. Recommended vendor: ${recommended.vendorName} (${quotePriceLabel}).${justificationNote}`,
      ]
    );
    await startOwnVendorPostRfqWorkflow(prId);
    return {
      success: true,
      recommendedVendor: recommended.vendorName,
      message: 'RFQ submitted for HOD vendor final approval',
    };
  }

  await pool.query(
    `UPDATE rfq_configs
     SET recommended_invitation_id = ?, recommendation_justification = ?, finalized_at = NOW(), updated_at = NOW()
     WHERE pr_id = ?`,
    [recommendedInvitationId, justification, prId]
  );

  if (taskId) {
    await completeRequesterTask(user, taskId);
  }

  // SCM Buyer vendor selection / final RFQ — always record in approval history
  const selectionRemarks = isOwnVendor
    ? `SCM Buyer Final RFQ — vendor selected: ${recommended.vendorName} (${quotePriceLabel}). Sent to Create PO.${justificationNote}`
    : `SCM Buyer Vendor Selection — recommended vendor: ${recommended.vendorName} (${quotePriceLabel}). Sent to SCM Manager Vendor Approval.${justificationNote}`;

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
     VALUES (?, ?, ?, 'approved', ?)`,
    [prId, STAGE.RFQ_SCM_BUYER_SELECTION, user.id, selectionRemarks]
  );

  if (isOwnVendor && isScmBuyer) {
    // Own: after CFO → SCM final RFQ → Create PO (no SCM Manager vendor step)
    await moveToScmCreatePo(prId);
  } else {
    // SCM vendor: SCM RFQ → SCM Manager vendor approval → Create PO
    await startScmVendorPostRfqWorkflow(prId);
  }

  return { success: true, recommendedVendor: recommended.vendorName };
}

async function getRequesterEmailForPr(prId) {
  const [rows] = await pool.query(
    `SELECT u.email, pr.department_id
     FROM purchase_requests pr
     JOIN users u ON u.id = pr.requester_id
     WHERE pr.id = ?`,
    [prId]
  );
  if (!rows.length) throw new Error('Requester not found');
  return { email: rows[0].email, departmentId: rows[0].department_id };
}

async function resolvePostRfqManager(requesterEmail, departmentId, level) {
  let workflowRole = 'PR Manager';
  let manager = null;

  if (level === 'hod') {
    workflowRole = 'HOD Approver';
    manager = await getL1ManagerForEmail(requesterEmail);
  } else if (level === 'l2') {
    workflowRole = 'PR Manager';
    manager = await getL2ManagerForEmail(requesterEmail);
  } else if (level === 'scm_manager') {
    workflowRole = 'SCM Manager';
    const mgr = await resolveScmManagerUser();
    if (mgr) {
      return {
        userId: mgr.id,
        email: mgr.email,
        name: mgr.name,
        workflowRole,
      };
    }
    return { userId: null, email: null, name: null, workflowRole };
  }

  if (!manager?.email) {
    return { userId: null, email: null, name: null, workflowRole };
  }

  const userId = await ensureApproverUser(manager, workflowRole, departmentId);
  return {
    userId,
    email: manager.email,
    name: manager.name,
    workflowRole,
  };
}

async function createPostRfqApprovalTask(conn, prId, level) {
  const requester = await getRequesterEmailForPr(prId);
  const assignee = await resolvePostRfqManager(requester.email, requester.departmentId, level);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  // SCM Buyer is role-queued (any active buyer can act). SCM Manager is assigned to Rajeev.
  const roleQueued = assignee.workflowRole === 'SCM Buyer';
  const assignedUserId = roleQueued ? null : assignee.userId;
  const sql = `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_POST_APPROVAL', ?, ?, 'pending', ?)`;
  const params = [prId, assignee.workflowRole, assignedUserId, dueDate.toISOString().split('T')[0]];

  if (conn) {
    await conn.query(sql, params);
  } else {
    await pool.query(sql, params);
  }

  return assignee;
}

async function buildRfqSummary(prId) {
  const config = await getOrCreateRfqConfig(prId);
  const invitations = await getInvitationsWithSubmissions(prId);
  if (!invitations.length) return null;

  const recommended = invitations.find((i) => i.id === config.recommendedInvitationId);
  const latest = findActiveSubmission(recommended) ||
    recommended?.submissions?.find((s) => s.status === 'submitted');

  const vendors = invitations.map((inv) => {
    // Include sent_back rounds — they are prior negotiation history (status flips on Send Back)
    const rounds = (inv.submissions || [])
      .filter((s) => s.status === 'submitted' || s.status === 'sent_back')
      .sort((a, b) => Number(a.round) - Number(b.round))
      .map((s) => ({
        round: s.round,
        quotedPrice: s.quotedPrice,
        leadTime: s.leadTime,
        paymentTerms: s.paymentTerms || '',
        warranty: s.warranty || '',
        quotationFileName: s.quotationFileName || '',
        quotationFilePath: s.quotationFilePath || '',
        submissionId: s.id,
        submittedAt: s.submittedAt,
        values: submissionToFieldValues(s),
      }));

    const active = findActiveSubmission(inv);
    return {
      id: inv.id,
      name: inv.vendorName,
      isRecommended: config.recommendedInvitationId === inv.id,
      rounds,
      latest: submissionToFieldValues(active),
      quotationFileName: active?.quotationFileName || '',
    };
  });

  const totalRounds = Math.max(
    1,
    ...vendors.map((v) => Math.max(0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    ...vendors.map((v) => (v.rounds || []).length)
  );

  const fieldDefs = normalizeFieldDefinitions(config.fieldDefinitions);
  const comparisonRows = fieldDefs.map((f) => {
    const cells = {};
    let bestVendorId = null;
    let bestVal = null;
    for (const vendor of vendors) {
      const raw = vendor.latest?.[f.id];
      cells[vendor.id] = formatMatrixValue(f.id, raw, f.type);
      if (typeof raw === 'number' && !Number.isNaN(raw)) {
        const lower = isLowerBetter(f.id);
        if (bestVal === null || (lower ? raw < bestVal : raw > bestVal)) {
          bestVal = raw;
          bestVendorId = vendor.id;
        }
      }
    }
    return { id: f.id, label: f.label, cells, bestVendorId };
  });

  return {
    recommendedVendor: recommended?.vendorName || '',
    recommendationJustification: config.recommendationJustification || '',
    vendorCount: invitations.length,
    quotedPrice: latest?.quotedPrice || 0,
    maxRounds: config.maxRounds || 3,
    totalRounds,
    vendors,
    comparisonRows,
  };
}

function nodemailerAttachment(filename, row) {
  const diskPath = row.quotation_file_path && path.join(UPLOAD_DIR, row.quotation_file_path);
  if (diskPath && fs.existsSync(diskPath)) {
    return { filename, path: diskPath };
  }
  if (row.quotation_file_data && row.quotation_file_data.length) {
    const content = Buffer.isBuffer(row.quotation_file_data)
      ? row.quotation_file_data
      : Buffer.from(row.quotation_file_data);
    return { filename, content };
  }
  return null;
}

async function loadQuotationMailAttachments(prId) {
  const [rows] = await pool.query(
    `SELECT vqs.round, vqs.quotation_file_name, vqs.quotation_file_path, vqs.quotation_file_data,
            ri.vendor_name
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     WHERE ri.pr_id = ?
       AND vqs.quotation_file_name IS NOT NULL AND vqs.quotation_file_name <> ''
     ORDER BY ri.id ASC, vqs.round ASC`,
    [prId]
  );
  const attachments = [];
  for (const row of rows) {
    const safeVendor = String(row.vendor_name || 'vendor').replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeFile = String(row.quotation_file_name || 'quotation.pdf').replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
    const attachment = nodemailerAttachment(`${safeVendor}_R${row.round}_${safeFile}`, row);
    if (attachment) attachments.push(attachment);
  }
  return attachments;
}

/** Collect quotation files (disk or DB) for RFQ approval emails */
export async function collectQuotationAttachments(prId) {
  return loadQuotationMailAttachments(prId);
}

export async function getRfqEmailPack(prId) {
  const rfqSummary = await buildRfqSummary(prId);
  return {
    rfqSummary,
    attachments: await loadQuotationMailAttachments(prId),
  };
}

/** Own path after requester RFQ: HOD vendor final */
async function startOwnVendorPostRfqWorkflow(prId) {
  await pool.query(
    `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
    [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL, STAGE.RFQ_MANAGER_REVIEW, prId]
  );

  // Clear any stale pending post-RFQ tasks before creating the L1 vendor-final task
  await pool.query(
    `UPDATE workflow_tasks
     SET status = 'cancelled', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'RFQ_POST_APPROVAL' AND status = 'pending'`,
    [prId]
  );

  const assignee = await createPostRfqApprovalTask(null, prId, 'hod');
  const pr = await getPurchaseRequestById(prId);
  const rfqSummary = await buildRfqSummary(prId);
  const attachments = await collectQuotationAttachments(prId);

  queuePrApprovalPendingNotification(
    pr,
    'HOD Approver',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      postRfq: true,
      stageLabel: 'L1 Manager Vendor Final Approval',
      rfqSummary,
      attachments,
      approverEmails: assignee.email ? [assignee.email] : undefined,
      approverName: assignee.name || undefined,
    }
  );
}

/** SCM path after SCM RFQ: SCM Manager vendor selection approval */
async function startScmVendorPostRfqWorkflow(prId) {
  await pool.query(
    `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
    [PR_STATUS.PENDING_BUSINESS_APPROVAL, STAGE.BUSINESS_REVIEW, prId]
  );

  const assignee = await createPostRfqApprovalTask(null, prId, 'scm_manager');
  const pr = await getPurchaseRequestById(prId);
  const rfqSummary = await buildRfqSummary(prId);
  const attachments = await collectQuotationAttachments(prId);

  queuePrApprovalPendingNotification(
    pr,
    'SCM Manager',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      postRfq: true,
      stageLabel: 'SCM Manager Vendor Approval',
      rfqSummary,
      attachments,
      approverEmails: assignee.email ? [assignee.email] : undefined,
      approverName: assignee.name || undefined,
    }
  );
}

/** Own path after CFO post-RFQ: notify SCM Buyer to run final RFQ (/scm/rfq-entry) */
async function notifyScmBuyerForFinalRfq(prId) {
  const buyerEmails = await getScmBuyerNotifyEmails();
  const pr = await getPurchaseRequestById(prId);
  const rfqSummary = await buildRfqSummary(prId);
  const attachments = await collectQuotationAttachments(prId);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);
  await pool.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_ENTRY', 'SCM Buyer', ?, 'pending', ?)`,
    [prId, null, dueDate.toISOString().split('T')[0]]
  );

  queuePrApprovalPendingNotification(
    pr,
    'SCM Buyer',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      rfqEntry: true,
      stageLabel: 'SCM Final RFQ',
      rfqSummary,
      attachments,
      approverEmails: buyerEmails,
      approverName: 'SCM Buyer',
    }
  );
}

/** Own path after SCM final RFQ: go straight to Create PO */
async function moveToScmCreatePo(prId) {
  await pool.query(
    `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
    [PR_STATUS.PENDING_SCM_PO, STAGE.SCM_PO_CREATE, prId]
  );

  const buyerEmails = await getScmBuyerNotifyEmails();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  await pool.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_POST_APPROVAL', 'SCM Buyer', ?, 'pending', ?)`,
    [prId, null, dueDate.toISOString().split('T')[0]]
  );

  const pr = await getPurchaseRequestById(prId);
  const rfqSummary = await buildRfqSummary(prId);
  const attachments = await collectQuotationAttachments(prId);
  queuePrApprovalPendingNotification(
    pr,
    'SCM Buyer',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      postRfq: true,
      createPo: true,
      stageLabel: 'SCM PO Create',
      rfqSummary,
      attachments,
      approverEmails: buyerEmails,
      approverName: 'SCM Buyer',
    }
  );
}

async function getPendingPostRfqTask(prId) {
  const [rows] = await pool.query(
    `SELECT id, assigned_role, assigned_user_id
     FROM workflow_tasks
     WHERE pr_id = ? AND task_type = 'RFQ_POST_APPROVAL' AND status = 'pending'
     ORDER BY id DESC LIMIT 1`,
    [prId]
  );
  return rows[0] || null;
}

async function resolvePostRfqRoleConfigForUser(user, prId, prStatus) {
  const pendingTask = await getPendingPostRfqTask(prId);
  if (pendingTask?.assigned_user_id === user.id) {
    const cfg = getPostRfqRoleConfig(pendingTask.assigned_role);
    if (cfg && cfg.status === prStatus) {
      return { roleConfig: cfg, workflowRole: pendingTask.assigned_role, pendingTask };
    }
  }

  const roleConfig = getPostRfqRoleConfig(user.role);
  if (roleConfig && roleConfig.status === prStatus) {
    // Role-queued: SCM Manager / SCM Buyer — any user of that role may act
    const roleQueued = user.role === 'SCM Manager' || user.role === 'SCM Buyer';
    if (
      pendingTask?.assigned_user_id &&
      pendingTask.assigned_user_id !== user.id &&
      !roleQueued
    ) {
      throw new Error('This RFQ approval is assigned to another manager');
    }
    // If pending task is for a different role, block
    if (
      pendingTask?.assigned_role &&
      pendingTask.assigned_role !== user.role &&
      pendingTask.assigned_user_id &&
      pendingTask.assigned_user_id !== user.id
    ) {
      throw new Error('This RFQ approval is assigned to another manager');
    }
    return { roleConfig, workflowRole: user.role, pendingTask };
  }

  throw new Error('You are not authorized for this RFQ approval step');
}

async function startPostRfqWorkflow(prId) {
  // Kept for compatibility — SCM vendor path uses SCM Manager vendor approval
  return startScmVendorPostRfqWorkflow(prId);
}

const PARAM_ICONS = {
  quotedPrice: 'ri-money-rupee-circle-line',
  leadTime: 'ri-time-line',
  paymentTerms: 'ri-bank-card-line',
  warranty: 'ri-shield-check-line',
  deliveryTerms: 'ri-truck-line',
  compliance: 'ri-shield-star-line',
  technicalScore: 'ri-cpu-line',
  commercialScore: 'ri-bar-chart-box-line',
  overallScore: 'ri-star-line',
};

function paramIcon(fieldId) {
  return PARAM_ICONS[fieldId] || 'ri-list-check';
}

function isLowerBetter(paramId) {
  return paramId === 'quotedPrice' || paramId === 'leadTime';
}

function formatMatrixValue(fieldId, value, fieldType) {
  if (value === undefined || value === null || value === '') return '—';
  if (fieldType === 'boolean') return value ? 'Compliant' : 'Non-Compliant';
  if (fieldId === 'quotedPrice') return `₹${Number(value).toLocaleString('en-IN')}`;
  if (fieldId === 'leadTime') return `${value} days`;
  if (['technicalScore', 'commercialScore', 'overallScore'].includes(fieldId)) {
    return `${value}/100`;
  }
  return String(value);
}

export async function getVendorComparisonMatrix(user, prId) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');

  const pendingTask = await getPendingPostRfqTask(prId);
  const assignedRoleConfig =
    pendingTask?.assigned_user_id === user.id
      ? getPostRfqRoleConfig(pendingTask.assigned_role)
      : null;
  const userRoleConfig = getPostRfqRoleConfig(user.role);
  // Prefer assignment-based config so HOD L1 assignees get Manager Approval permissions
  const roleConfig = assignedRoleConfig || userRoleConfig;
  const postRfqStatuses = Object.values(POST_RFQ_ROLE_MAP).map((c) => c.status);
  const canView =
    roleConfig ||
    user.role === 'Requester' ||
    user.role === 'CFO' ||
    user.role === 'SCM Manager' ||
    user.role === 'SCM Buyer' ||
    user.role === 'HOD Approver' ||
    user.role === 'Super Admin' ||
    pendingTask?.assigned_user_id === user.id ||
    postRfqStatuses.includes(pr.status);
  if (!canView) throw new Error('Unauthorized');

  const config = await getOrCreateRfqConfig(prId);
  const invitations = await getInvitationsWithSubmissions(prId);
  const showFullNegotiation = roleConfig?.showFullNegotiation ?? true;

  const vendors = invitations.map((inv) => {
    const activeSubmission = findActiveSubmission(inv);

    // Include sent_back — Round 1 stays visible after Send Back creates Round 2
    const allRounds = inv.submissions
      .filter((s) => s.status === 'submitted' || s.status === 'sent_back')
      .map((s) => ({
        round: s.round,
        values: submissionToFieldValues(s),
        submittedAt: s.submittedAt,
        quotationFileName: s.quotationFileName,
        hasQuotationFile: Boolean(s.hasQuotationFile || s.quotationFileName),
        submissionId: s.id,
        sendBackReason: inv.sendBackReason,
        status: s.status,
      }));

    return {
      id: inv.id,
      name: inv.vendorName,
      email: inv.vendorEmail,
      isRecommended: config.recommendedInvitationId === inv.id,
      round: inv.round,
      status: inv.status,
      latest: submissionToFieldValues(activeSubmission),
      latestSubmissionId: activeSubmission?.id || null,
      quotationFileName: activeSubmission?.quotationFileName || '',
      hasQuotationFile: Boolean(activeSubmission?.hasQuotationFile || activeSubmission?.quotationFileName),
      // Always pass full round history for comparison sheet columns (Round 1 + Round 2…)
      // Compact/manager views still use latest for matrix "best" cells via vendor.latest
      rounds: allRounds,
    };
  });

  const parameters = config.fieldDefinitions.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    icon: paramIcon(f.id),
    showIn: f.showIn === 'commercial' ? 'commercial' : 'technical',
  }));

  const matrix = {};
  for (const param of parameters) {
    const values = {};
    let bestVendorId = null;
    let bestVal = null;

    for (const vendor of vendors) {
      const raw = vendor.latest?.[param.id];
      const display = formatMatrixValue(param.id, raw, param.type);
      values[vendor.id] = { raw, display };

      if (typeof raw === 'number' && !Number.isNaN(raw)) {
        const lower = isLowerBetter(param.id);
        if (bestVal === null || (lower ? raw < bestVal : raw > bestVal)) {
          bestVal = raw;
          bestVendorId = vendor.id;
        }
      }
    }

    matrix[param.id] = { values, bestVendorId };
  }

  const recommendedVendor = vendors.find((v) => v.isRecommended);
  const totalRounds = Math.max(
    1,
    ...vendors.map((v) => Math.max(Number(v.round) || 0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    ...vendors.map((v) => (v.rounds || []).length)
  );
  const configuredMaxRounds = config.maxRounds != null ? Number(config.maxRounds) : null;

  return {
    pr: {
      id: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      department: pr.department,
      entityId: pr.entityId || null,
      entityName: pr.entityName || '',
      entityCode: pr.entityCode || '',
      requestType: pr.requestType,
      totalAmount: pr.totalAmount,
      estimatedBudget: pr.totalAmount,
      status: pr.status,
      statusUI: pr.statusUI,
      vendorSelection: pr.vendorSelection === 'own' ? 'own' : 'scm',
      prFlow: pr.prFlow === 'functional' ? 'functional' : 'standard',
      justification: pr.justification,
      approvalHistory: pr.approvalHistory,
      lineItems: (pr.lineItems || []).map((li) => ({
        id: li.id,
        description: li.description || li.item || '',
        category: li.category || '',
        quantity: Number(li.quantity) || 0,
        uom: li.uom || li.unit || 'Nos',
        unitCost: Number(li.unitCost ?? li.unitPrice) || 0,
        total: Number(li.total) || 0,
      })),
    },
    vendorCount: vendors.length,
    totalRounds,
    maxRounds: configuredMaxRounds,
    recommendedVendorId: config.recommendedInvitationId,
    recommendedVendorName: recommendedVendor?.name || '',
    recommendationJustification: config.recommendationJustification || '',
    showFullNegotiation,
    stageLabel: roleConfig?.label || null,
    /** Own-vendor HOD final: UI must ask Yes=CFO path / No=SCM vendor selection */
    askBusinessApproval: Boolean(
      pr.vendorSelection === 'own' &&
        pr.status === PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL &&
        (user.role === 'HOD Approver' ||
          pendingTask?.assigned_role === 'HOD Approver' ||
          assignedRoleConfig?.status === PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL)
    ),
    canApprove: Boolean(
      assignedRoleConfig
        ? pr.status === assignedRoleConfig.status
        : userRoleConfig &&
            (pr.status === userRoleConfig.status ||
              // Buyer Create-PO orphans incorrectly left as APPROVED with no PO
              (user.role === 'SCM Buyer' &&
                userRoleConfig.status === PR_STATUS.PENDING_SCM_PO &&
                pr.status === PR_STATUS.APPROVED)) &&
            (!pendingTask?.assigned_user_id ||
              pendingTask.assigned_user_id === user.id ||
              // Role-queued: any SCM Manager / SCM Buyer of matching role may act
              ((user.role === 'SCM Manager' || user.role === 'SCM Buyer') &&
                pendingTask.assigned_role === user.role))
    ),
    vendors,
    parameters,
    matrix,
    finalizedAt: config.finalizedAt,
  };
}

export async function listScmRfqEntryPrs(user) {
  if (!['SCM Buyer', 'SCM Manager', 'Super Admin'].includes(user.role)) {
    throw new Error('Unauthorized');
  }

  // SCM vendor: after CFO pre-RFQ. Own vendor: after HOD→L2→CFO post-RFQ (APPROVED again).
  const [rows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.total_amount, pr.request_type, pr.priority,
            pr.required_date, pr.status, pr.updated_at, pr.vendor_selection,
            d.name AS department_name, u.name AS requester_name,
            rc.finalized_at, rc.requester_submitted_at,
            (SELECT COUNT(*) FROM rfq_invitations ri WHERE ri.pr_id = pr.id) AS vendor_count
     FROM purchase_requests pr
     JOIN departments d ON d.id = pr.department_id
     JOIN users u ON u.id = pr.requester_id
     LEFT JOIN rfq_configs rc ON rc.pr_id = pr.id
     WHERE pr.status = ?
       AND (rc.finalized_at IS NULL)
       AND (
         COALESCE(pr.vendor_selection, 'scm') = 'scm'
         OR (pr.vendor_selection = 'own' AND rc.requester_submitted_at IS NOT NULL)
       )
     ORDER BY pr.updated_at DESC`,
    [PR_STATUS.APPROVED]
  );

  return rows.map((row) => ({
    prId: row.id,
    prNumber: row.pr_number,
    title: row.title,
    department: row.department_name,
    requester: row.requester_name,
    totalAmount: Number(row.total_amount),
    requestType: row.request_type,
    priority: row.priority,
    requiredDate: formatDate(row.required_date),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    vendorCount: Number(row.vendor_count),
    status: row.vendor_selection === 'own' ? 'Ready for SCM Final RFQ' : 'RFQ Entry',
  }));
}

export async function listPostRfqPending(user) {
  // SCM Manager / SCM Buyer tasks are role-queued (assigned_user_id NULL).
  // HOD / L2 tasks are assigned to a specific user. Match either pattern.
  const [assignedRows] = await pool.query(
    `SELECT pr.id
     FROM purchase_requests pr
     JOIN workflow_tasks wt ON wt.pr_id = pr.id
     WHERE wt.task_type = 'RFQ_POST_APPROVAL'
       AND wt.status = 'pending'
       AND (
         wt.assigned_user_id = ?
         OR (wt.assigned_user_id IS NULL AND wt.assigned_role = ?)
       )
     GROUP BY pr.id
     ORDER BY MAX(COALESCE(pr.submitted_at, pr.created_at, pr.updated_at)) DESC, pr.id DESC`,
    [user.id, user.role]
  );

  // Also include PRs in this role's post-RFQ status for role-queued roles
  // (SCM Manager / SCM Buyer tasks use assigned_user_id NULL).
  // Do NOT do this for HOD / L2 / CFO — those are person-assigned via RefexOne.
  const ROLE_QUEUED_POST_RFQ = new Set(['SCM Manager', 'SCM Buyer']);
  const userRoleConfig = getPostRfqRoleConfig(user.role);
  const idSet = new Set(assignedRows.map((r) => r.id));
  if (ROLE_QUEUED_POST_RFQ.has(user.role) && userRoleConfig?.status) {
    const [statusRows] = await pool.query(
      `SELECT id FROM purchase_requests WHERE status = ?
       ORDER BY COALESCE(submitted_at, created_at, updated_at) DESC, id DESC`,
      [userRoleConfig.status]
    );
    for (const row of statusRows) idSet.add(row.id);
  }

  // Recover orphans: Buyer RFQ "approve" used to mark APPROVED before PO create.
  // Exclude PRs that already have any PO (including cancelled/rejected) so cancelled
  // POs do not reappear in RFQ Approvals as "Approved".
  if (user.role === 'SCM Buyer') {
    const [orphanRows] = await pool.query(
      `SELECT pr.id
       FROM purchase_requests pr
       JOIN rfq_configs rc ON rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
       WHERE pr.status = ?
         AND NOT EXISTS (
           SELECT 1 FROM purchase_orders po WHERE po.pr_id = pr.id
         )
       ORDER BY COALESCE(pr.submitted_at, pr.created_at, pr.updated_at) DESC, pr.id DESC`,
      [PR_STATUS.APPROVED]
    );
    for (const row of orphanRows) idSet.add(row.id);

    // Also show RFQs still waiting on SCM Manager vendor approval
    const [pendingMgrRows] = await pool.query(
      `SELECT id FROM purchase_requests WHERE status = ?
       ORDER BY COALESCE(submitted_at, created_at, updated_at) DESC, id DESC`,
      [PR_STATUS.PENDING_BUSINESS_APPROVAL]
    );
    for (const row of pendingMgrRows) idSet.add(row.id);
  }

  const rows = [...idSet].map((id) => ({ id }));

  const candidateIds = rows.map((r) => r.id);
  const quoteAmountByPr = await getRecommendedQuotedAmounts(candidateIds);

  const results = [];
  for (const row of rows) {
    const pr = await getPurchaseRequestById(row.id);
    if (!pr) continue;

    // Cancelled / closed POs must not stay in RFQ Approvals or Create-PO queues
    const [poStatusRows] = await pool.query(
      `SELECT status FROM purchase_orders WHERE pr_id = ?`,
      [row.id]
    );
    const hasCancelledPo = poStatusRows.some((p) => String(p.status) === 'cancelled');
    const hasOpenPo = poStatusRows.some(
      (p) => !['cancelled', 'rejected'].includes(String(p.status || '').toLowerCase())
    );
    if (hasCancelledPo && !hasOpenPo) continue;

    const pendingTask = await getPendingPostRfqTask(row.id);
    const roleConfig = getPostRfqRoleConfig(pendingTask?.assigned_role || user.role);
    if (!roleConfig) continue;

    // Normal match: PR status equals this role's queue status
    const statusMatches = pr.status === roleConfig.status;
    // Orphan Buyer Create-PO items incorrectly left as APPROVED with no PO
    const buyerOrphan =
      user.role === 'SCM Buyer' &&
      pr.status === PR_STATUS.APPROVED &&
      !poStatusRows.length &&
      (roleConfig.status === PR_STATUS.PENDING_SCM_PO || !pendingTask);
    // Buyer also tracks RFQs still pending SCM Manager vendor approval
    const buyerPendingManager =
      user.role === 'SCM Buyer' && pr.status === PR_STATUS.PENDING_BUSINESS_APPROVAL;
    if (!statusMatches && !buyerOrphan && !buyerPendingManager) continue;

    const approvalState =
      pr.status === PR_STATUS.PENDING_BUSINESS_APPROVAL ? 'pending' : 'approved';
    const stageLabel = buyerPendingManager
      ? 'Pending SCM Manager Approval'
      : buyerOrphan
        ? 'Approved — Create PO'
        : roleConfig.label;

    const config = await getOrCreateRfqConfig(row.id);
    const [vendorCount] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM rfq_invitations WHERE pr_id = ?`,
      [row.id]
    );
    let recommendedVendor = '';
    if (config.recommendedInvitationId) {
      const [inv] = await pool.query(`SELECT vendor_name FROM rfq_invitations WHERE id = ?`, [
        config.recommendedInvitationId,
      ]);
      recommendedVendor = inv[0]?.vendor_name || '';
    }
    const recommendedQuote = quoteAmountByPr.get(Number(pr.id));
    results.push({
      prId: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      department: pr.department,
      entityId: pr.entityId || null,
      entityName: pr.entityName || '',
      entityCode: pr.entityCode || '',
      requester: pr.requester,
      totalAmount:
        recommendedQuote != null && recommendedQuote > 0
          ? recommendedQuote
          : Number(pr.totalAmount) || 0,
      requestType: pr.requestType,
      priority: pr.priority,
      status: pr.statusUI,
      submittedDate: pr.submittedDate,
      vendorCount: vendorCount[0].cnt,
      recommendedVendor,
      stageLabel,
      approvalState,
    });
  }
  return results;
}

export async function processPostRfqApproval(user, prId, action, remarks, options = {}) {
  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  const { roleConfig, workflowRole } = await resolvePostRfqRoleConfigForUser(user, prId, pr.status);
  if (!remarks?.trim()) throw new Error('Remarks are required');

  const isOwnHodVendorFinal =
    action === 'approve' &&
    workflowRole === 'HOD Approver' &&
    pr.vendor_selection === 'own' &&
    pr.status === PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL;

  // Own vendor HOD final: must choose Business/CFO path or skip to SCM vendor selection
  let goToBusinessApproval = null;
  if (isOwnHodVendorFinal) {
    if (typeof options.goToBusinessApproval === 'boolean') {
      goToBusinessApproval = options.goToBusinessApproval;
    } else if (options.goToBusinessApproval === 'yes' || options.goToBusinessApproval === 'true') {
      goToBusinessApproval = true;
    } else if (options.goToBusinessApproval === 'no' || options.goToBusinessApproval === 'false') {
      goToBusinessApproval = false;
    }
    if (goToBusinessApproval === null) {
      throw new Error('Select whether to go to Business / CFO Approval (Yes or No)');
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let newStatus;
    let newStage;
    let nextRole = null;

    if (action === 'approve') {
      // SCM Buyer "approve" at Create PO stage must not mark the PR APPROVED —
      // that hides it from Purchase Requests / Create PO before a PO exists.
      // Buyer should open Create PO instead; PO create completes this step.
      if (workflowRole === 'SCM Buyer' && pr.status === PR_STATUS.PENDING_SCM_PO) {
        throw new Error('Open Create PO to complete this step — do not approve from RFQ Approval');
      }
      newStatus = roleConfig.nextStatus;
      newStage = roleConfig.nextStage;
      nextRole = roleConfig.nextRole;

      // Own HOD vendor final branch (both paths go to L2 first):
      // Yes → L2 → CFO → SCM Final RFQ
      // No  → L2 → SCM Final RFQ (skip CFO)
      if (isOwnHodVendorFinal) {
        newStatus = PR_STATUS.PENDING_RFQ_L2_APPROVAL;
        newStage = STAGE.RFQ_L2_REVIEW;
        nextRole = 'PR Manager';
        await conn.query(
          `UPDATE rfq_configs SET require_cfo_approval = ?, updated_at = NOW() WHERE pr_id = ?`,
          [goToBusinessApproval ? 1 : 0, prId]
        );
      }

      // Own L2 approve: honor HOD choice (CFO vs SCM Final)
      if (
        workflowRole === 'PR Manager' &&
        pr.vendor_selection === 'own' &&
        pr.status === PR_STATUS.PENDING_RFQ_L2_APPROVAL
      ) {
        const config = await getOrCreateRfqConfig(prId);
        if (config.requireCfoApproval === false) {
          newStatus = PR_STATUS.APPROVED;
          newStage = null;
          nextRole = null;
        }
        // requireCfoApproval true/null → keep default L2 map (CFO)
      }
    } else if (action === 'reject') {
      newStatus = PR_STATUS.REJECTED;
      newStage = null;
    } else if (action === 'return' || action === 'rework') {
      const defaultReturnTo =
        pr.pr_flow === 'functional' ? 'HOD_PRE' : pr.vendor_selection === 'own' ? 'REQUESTER_RFQ' : 'SCM_RFQ';
      const returnTo = options.returnTo || defaultReturnTo;
      const applyResult = await applySendBackToTarget(conn, pr, returnTo, remarks, user);
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
        [prId, roleConfig.stage, user.id, action, applyResult.remarksLine]
      );
      await conn.commit();
      const updatedPr = await getPurchaseRequestById(prId);
      queueSendBackNotifications(updatedPr, { ...applyResult, actorRole: workflowRole });
      return updatedPr;
    } else {
      throw new Error('Invalid action');
    }

    let approvalRemarks = remarks.trim();
    if (isOwnHodVendorFinal) {
      approvalRemarks = `${approvalRemarks}\n[Go to Business/CFO Approval: ${
        goToBusinessApproval ? 'Yes — L2 → CFO → SCM Final' : 'No — L2 → SCM Final (skip CFO)'
      }]`;
    }

    // Append recommended vendor on vendor-final / SCM Manager vendor approval steps
    if (action === 'approve') {
      try {
        const cfg = await getOrCreateRfqConfig(prId);
        if (cfg.recommendedInvitationId) {
          const [vendRows] = await conn.query(
            `SELECT vendor_name FROM rfq_invitations WHERE id = ? LIMIT 1`,
            [cfg.recommendedInvitationId]
          );
          const vName = vendRows[0]?.vendor_name;
          if (vName) {
            approvalRemarks = `${approvalRemarks}\nRecommended vendor: ${vName}`;
          }
        }
      } catch {
        /* non-blocking */
      }
    }

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [prId, roleConfig.stage, user.id, action, approvalRemarks]
    );

    await conn.query(
      `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, newStage, prId]
    );

    await conn.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ? AND assigned_role = ? AND task_type = 'RFQ_POST_APPROVAL' AND status = 'pending'`,
      [prId, workflowRole]
    );

    let nextAssignee = null;
    if (nextRole && action === 'approve') {
      if (nextRole === 'PR Manager') {
        nextAssignee = await createPostRfqApprovalTask(conn, prId, 'l2');
      } else if (nextRole === 'HOD Approver') {
        nextAssignee = await createPostRfqApprovalTask(conn, prId, 'hod');
      } else if (nextRole === 'SCM Manager') {
        nextAssignee = await createPostRfqApprovalTask(conn, prId, 'scm_manager');
      } else {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        let roleUser = null;
        if (nextRole === 'SCM Buyer') {
          roleUser = null; // role-queue: Gopi + Satish both act / get mail
        } else {
          const [roleUsers] = await conn.query(
            `SELECT id, email, name FROM users WHERE role = ? AND is_active = 1 ORDER BY id ASC LIMIT 1`,
            [nextRole]
          );
          roleUser = roleUsers[0] || null;
        }
        await conn.query(
          `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
           VALUES (?, 'RFQ_POST_APPROVAL', ?, ?, 'pending', ?)`,
          [prId, nextRole, roleUser?.id || null, dueDate.toISOString().split('T')[0]]
        );
        if (roleUser?.email) {
          nextAssignee = { email: roleUser.email, name: roleUser.name, userId: roleUser.id };
        }
      }
    }

    await conn.commit();

    const updatedPr = await getPurchaseRequestById(prId);
    const requester = { name: updatedPr.requester, email: '' };

    if (nextRole && action === 'approve') {
      const nextCfg = POST_RFQ_ROLE_MAP[nextRole];
      // L2 / next RFQ approver gets full negotiation rounds + quotation file attachments
      const rfqSummary = await buildRfqSummary(prId);
      const attachments = await collectQuotationAttachments(prId);
      queuePrApprovalPendingNotification(updatedPr, nextRole, requester, updatedPr.departmentId, {
        postRfq: true,
        createPo: nextRole === 'SCM Buyer',
        stageLabel: nextCfg?.label || (nextRole === 'SCM Buyer' ? 'SCM PO Create' : undefined),
        rfqSummary,
        attachments,
        approverEmails: nextAssignee?.email ? [nextAssignee.email] : undefined,
        approverName: nextAssignee?.name || undefined,
      });
    } else if (
      action === 'approve' &&
      !nextRole &&
      newStatus === PR_STATUS.APPROVED &&
      pr.vendor_selection === 'own'
    ) {
      // Own path: CFO done → SCM Buyer final RFQ (queue + mail)
      await notifyScmBuyerForFinalRfq(prId);
    } else if (action === 'reject' || action === 'return' || action === 'rework') {
      queuePostRfqActionNotification(updatedPr, workflowRole, action, remarks, requester);
    }

    return updatedPr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export function mapInvitationsToTableRows(invitations, config = null) {
  const fieldDefinitions = config?.fieldDefinitions || DEFAULT_FIELD_DEFINITIONS;
  const maxRounds = config?.maxRounds ?? null;
  const recommendedId = config?.recommendedInvitationId ?? null;

  return invitations.map((inv) => {
    const activeSubmission = findActiveSubmission(inv);
    const display = activeSubmission;

    return {
      id: String(inv.id),
      invitationId: inv.id,
      vendorName: inv.vendorName,
      vendorEmail: inv.vendorEmail,
      inviteMode: inv.inviteMode || 'email',
      status: inv.status,
      round: inv.round,
      maxRounds,
      quotedPrice: display?.quotedPrice || 0,
      leadTime: display?.leadTime || 0,
      paymentTerms: display?.paymentTerms || 'Net 30',
      warranty: display?.warranty || '',
      deliveryTerms: display?.deliveryTerms || '',
      compliance: display?.compliance ?? true,
      vendorNotes: display?.vendorNotes || '',
      submittedAt: display?.submittedAt || '',
      quotationFileName: display?.quotationFileName || '',
      submissionId: display?.id || null,
      hasActiveQuote: Boolean(activeSubmission),
      fieldValues: submissionToFieldValues(display),
      isRecommended: recommendedId === inv.id,
      sendBackReason: inv.sendBackReason,
      sendBackFields: inv.sendBackFields || [],
      canSendBack: inv.status === 'submitted',
      showHistory: inv.submissions.filter((s) => s.quotedPrice > 0).length > 1,
      quotes: inv.submissions.map((s) => ({
        submissionId: s.id,
        round: s.round,
        quotedPrice: s.quotedPrice,
        leadTime: s.leadTime,
        paymentTerms: s.paymentTerms,
        warranty: s.warranty,
        deliveryTerms: s.deliveryTerms,
        compliance: s.compliance,
        vendorNotes: s.vendorNotes,
        quotationFileName: s.quotationFileName,
        customFields: s.customFields,
        requesterFields: s.requesterFields,
        fieldValues: submissionToFieldValues(s),
        status: s.status,
        submittedAt: s.submittedAt,
        isCurrentRound: s.round === inv.round,
      })),
    };
  });
}

/**
 * Admin / SCM: update amounts + commercial fields on an existing submitted quotation.
 * Optional quotation file replace in the same call.
 */
export async function adminUpdateVendorQuotationSubmission(user, submissionId, body = {}) {
  const allowedRoles = ['Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'];
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Unauthorized');
  }

  const [rows] = await pool.query(
    `SELECT vqs.*, ri.id AS invitation_id, ri.pr_id, ri.round AS inv_round, ri.vendor_name,
            pr.requester_id
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE vqs.id = ?`,
    [submissionId]
  );
  if (!rows.length) throw new Error('Submission not found');
  const row = rows[0];

  if (user.role === 'Requester' && row.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  if (user.role === 'Requester') {
    const config = await getOrCreateRfqConfig(row.pr_id);
    if (config.finalizedAt) {
      throw new Error('RFQ already finalized — quotation amounts cannot be changed');
    }
  }

  const pr = await getPurchaseRequestById(row.pr_id);
  applyQuoteLineItemsToSubmissionBody(body, pr);

  const config = await getOrCreateRfqConfig(row.pr_id);
  const existingCustom = parseJsonObject(row.custom_fields);
  const { core, customFields } = extractCoreVendorValues(body, config.fieldDefinitions, existingCustom);

  if (core.quotedPrice == null || Number.isNaN(Number(core.quotedPrice)) || Number(core.quotedPrice) < 0) {
    throw new Error('Quoted price is required');
  }

  let fileName = row.quotation_file_name;
  let filePath = row.quotation_file_path;
  let fileBuffer = null;
  let replaceFile = false;
  if (body.quotationFileName && body.quotationFileData) {
    const fileInfo = saveQuotationFile(
      row.invitation_id,
      row.round || row.inv_round || 1,
      body.quotationFileName,
      body.quotationFileData
    );
    if (!fileInfo.filePath && !fileInfo.buffer) {
      throw new Error('Failed to save quotation file');
    }
    fileName = fileInfo.fileName;
    filePath = fileInfo.filePath;
    fileBuffer = fileInfo.buffer;
    replaceFile = true;
  }

  const existingRequester = parseJsonObject(row.requester_fields);
  const requesterFields = {
    ...existingRequester,
    ...(body.requesterFields || {}),
    technicalScore:
      Number(body.requesterFields?.technicalScore ?? body.technicalScore ?? existingRequester.technicalScore) ||
      0,
    commercialScore:
      Number(
        body.requesterFields?.commercialScore ?? body.commercialScore ?? existingRequester.commercialScore
      ) || 0,
    overallScore:
      Number(body.requesterFields?.overallScore ?? body.overallScore ?? existingRequester.overallScore) || 0,
    lastEditedBy: user.name,
    lastEditedRole: user.role,
    entryMode: existingRequester.entryMode || 'manual',
  };

  const noteSuffix = `Updated by ${user.name} (${user.role})`;
  const vendorNotes = body.vendorNotes?.trim()
    ? String(body.vendorNotes).trim()
    : row.vendor_notes
      ? `${row.vendor_notes}`
      : noteSuffix;

  if (replaceFile) {
    await pool.query(
      `UPDATE vendor_quotation_submissions
       SET quoted_price = ?, lead_time_days = ?, payment_terms = ?, compliance = ?,
           vendor_notes = ?, warranty = ?, delivery_terms = ?,
           quotation_file_name = ?, quotation_file_path = ?, quotation_file_data = ?,
           custom_fields = ?, requester_fields = ?
       WHERE id = ?`,
      [
        Number(core.quotedPrice),
        Number(core.leadTime) || 0,
        core.paymentTerms || row.payment_terms || 'Net 30',
        core.compliance !== false ? 1 : 0,
        vendorNotes,
        core.warranty ?? row.warranty ?? '',
        core.deliveryTerms ?? row.delivery_terms ?? '',
        fileName,
        filePath,
        fileBuffer,
        JSON.stringify(customFields),
        JSON.stringify(requesterFields),
        submissionId,
      ]
    );
  } else {
    await pool.query(
      `UPDATE vendor_quotation_submissions
       SET quoted_price = ?, lead_time_days = ?, payment_terms = ?, compliance = ?,
           vendor_notes = ?, warranty = ?, delivery_terms = ?,
           custom_fields = ?, requester_fields = ?
       WHERE id = ?`,
      [
        Number(core.quotedPrice),
        Number(core.leadTime) || 0,
        core.paymentTerms || row.payment_terms || 'Net 30',
        core.compliance !== false ? 1 : 0,
        vendorNotes,
        core.warranty ?? row.warranty ?? '',
        core.deliveryTerms ?? row.delivery_terms ?? '',
        JSON.stringify(customFields),
        JSON.stringify(requesterFields),
        submissionId,
      ]
    );
  }

  const full = await getRfqByPrId(user, row.pr_id);
  const rfq = await getInvitationsWithSubmissions(row.pr_id);
  return {
    message: `Quotation updated for ${row.vendor_name}`,
    submissionId,
    quotations: mapInvitationsToQuotations(rfq),
    tableRows: mapInvitationsToTableRows(rfq, full.config),
    config: full.config,
  };
}

/** Attach / replace quotation file on an existing quote (admin can update existing files). */
export async function attachQuotationFileToSubmission(user, submissionId, body) {
  const allowedRoles = ['Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'];
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Unauthorized');
  }
  const [rows] = await pool.query(
    `SELECT vqs.*, ri.id AS invitation_id, ri.pr_id, ri.round AS inv_round, pr.requester_id, pr.status AS pr_status
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE vqs.id = ?`,
    [submissionId]
  );
  if (!rows.length) throw new Error('Submission not found');
  const row = rows[0];
  if (user.role === 'Requester' && row.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  // Super Admin / SCM Manager may repair files anytime; others only on submitted quotes
  if (
    !['Super Admin', 'SCM Manager'].includes(user.role) &&
    row.status !== 'submitted'
  ) {
    throw new Error('Can only attach files to submitted quotations');
  }
  if (!body?.quotationFileName || !body?.quotationFileData) {
    throw new Error('Quotation file is required');
  }

  const fileInfo = saveQuotationFile(
    row.invitation_id,
    row.round || row.inv_round || 1,
    body.quotationFileName,
    body.quotationFileData
  );
  if (!fileInfo.filePath && !fileInfo.buffer) {
    throw new Error('Failed to save quotation file');
  }

  const hadFile = Boolean(row.quotation_file_name || row.quotation_file_path || row.quotation_file_data);
  await pool.query(
    `UPDATE vendor_quotation_submissions
     SET quotation_file_name = ?, quotation_file_path = ?, quotation_file_data = ?
     WHERE id = ?`,
    [fileInfo.fileName, fileInfo.filePath, fileInfo.buffer, submissionId]
  );

  return {
    submissionId,
    quotationFileName: fileInfo.fileName,
    replaced: hadFile,
    message: hadFile
      ? 'Quotation file updated successfully'
      : 'Quotation file attached successfully',
  };
}

export async function getSubmissionFile(user, submissionId) {
  const [rows] = await pool.query(
    `SELECT vqs.id, vqs.quotation_file_name, vqs.quotation_file_path, vqs.quotation_file_data,
            ri.pr_id, pr.requester_id, pr.approval_user_id, pr.approval_user_ids
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE vqs.id = ?`,
    [submissionId]
  );
  if (!rows.length) throw new Error('Quotation file not found');

  const row = rows[0];
  let chain = [];
  try {
    const raw = row.approval_user_ids;
    if (Array.isArray(raw)) chain = raw.map(Number).filter((id) => id > 0);
    else if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) chain = parsed.map(Number).filter((id) => id > 0);
    }
  } catch {
    chain = [];
  }
  const pr = {
    id: row.pr_id,
    requesterId: row.requester_id,
    approvalUserId: row.approval_user_id,
    approvalUserIds: chain.length ? chain : row.approval_user_id ? [row.approval_user_id] : [],
  };
  if (!(await userCanViewPrQuotes(user, pr))) {
    throw new Error('Unauthorized');
  }

  const fileName = row.quotation_file_name || 'quotation.pdf';
  const diskPath =
    row.quotation_file_path && path.join(UPLOAD_DIR, row.quotation_file_path);

  if (diskPath && fs.existsSync(diskPath)) {
    return { fullPath: diskPath, fileName, buffer: null };
  }

  // Deployed Cloud Run: file lives in DB (disk is ephemeral)
  if (row.quotation_file_data && row.quotation_file_data.length) {
    const buffer = Buffer.isBuffer(row.quotation_file_data)
      ? row.quotation_file_data
      : Buffer.from(row.quotation_file_data);
    return { fullPath: null, fileName, buffer };
  }

  if (!row.quotation_file_path && !row.quotation_file_name) {
    throw new Error('No quotation file attached');
  }
  throw new Error(
    'Quotation file missing after deploy. Re-upload via Attach file on the RFQ Entry card.'
  );
}

export function mapInvitationsToQuotations(invitations) {
  return invitations.map((inv) => {
    const quotes = inv.submissions.length
      ? inv.submissions.map((s) => ({
          round: s.round,
          quotedPrice: s.quotedPrice,
          leadTime: s.leadTime,
          paymentTerms: s.paymentTerms || 'Standard',
          compliance: s.compliance,
          technicalScore: Number(s.requesterFields?.technicalScore) || 0,
          commercialScore: Number(s.requesterFields?.commercialScore) || 0,
          overallScore: Number(s.requesterFields?.overallScore) || 0,
          quotationFile: s.quotationFilePath ? `/api/rfq/submissions/${s.id}/file` : null,
          quotationFileName: s.quotationFileName || '',
          status: s.status === 'sent_back' ? 'sent-back' : 'active',
          sentBackReason: inv.sendBackReason || undefined,
          sentBackFields: inv.sendBackFields?.length ? inv.sendBackFields : undefined,
          vendorSubmitted: true,
          vendorSubmittedDate: s.submittedAt?.split(',')[0] || s.submittedAt,
          vendorNotes: s.vendorNotes,
          warranty: s.warranty,
          deliveryTerms: s.deliveryTerms,
        }))
      : [];

    if ((inv.status === 'invited' || inv.status === 'sent_back') && !quotes.some((q) => q.round === inv.round)) {
      quotes.push({
        round: inv.round,
        quotedPrice: 0,
        leadTime: 0,
        paymentTerms: 'Standard',
        compliance: true,
        technicalScore: 0,
        commercialScore: 0,
        overallScore: 0,
        quotationFile: null,
        quotationFileName: '',
        status: 'active',
        sentBackReason: inv.sendBackReason || undefined,
        sentBackFields: inv.sendBackFields?.length ? inv.sendBackFields : undefined,
      });
    }

    if (!quotes.length) {
      quotes.push({
        round: inv.round,
        quotedPrice: 0,
        leadTime: 0,
        paymentTerms: 'Standard',
        compliance: true,
        technicalScore: 0,
        commercialScore: 0,
        overallScore: 0,
        quotationFile: null,
        quotationFileName: '',
        status: 'active',
      });
    }

    return {
      id: String(inv.id),
      invitationId: inv.id,
      vendorName: inv.vendorName,
      vendorEmail: inv.vendorEmail,
      quotes,
      showHistory: quotes.filter((q) => q.quotedPrice > 0).length > 1,
      source: inv.inviteMode === 'manual'
        ? 'manual'
        : inv.submissions.some((s) => s.requesterFields?.entryMode === 'manual')
          ? 'manual'
          : inv.status === 'submitted'
            ? 'vendor-portal'
            : 'manual',
      rfqStatus: inv.status,
      inviteMode: inv.inviteMode || 'email',
    };
  });
}
