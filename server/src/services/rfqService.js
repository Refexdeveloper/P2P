import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { getPurchaseRequestById, completeRequesterTask } from './prService.js';
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

export const DEFAULT_FIELD_DEFINITIONS = [
  { id: 'quotedPrice', label: 'Quoted Price (₹)', type: 'number', filledBy: 'vendor', required: true, core: true },
  { id: 'leadTime', label: 'Lead Time (days)', type: 'number', filledBy: 'vendor', core: true },
  { id: 'paymentTerms', label: 'Payment Terms', type: 'text', filledBy: 'vendor', core: true },
  { id: 'warranty', label: 'Warranty', type: 'text', filledBy: 'vendor', core: true },
  { id: 'deliveryTerms', label: 'Delivery Terms', type: 'text', filledBy: 'vendor', core: true },
  { id: 'compliance', label: 'Compliance', type: 'boolean', filledBy: 'vendor', core: true },
  { id: 'technicalScore', label: 'Technical Score', type: 'number', filledBy: 'requester' },
  { id: 'commercialScore', label: 'Commercial Score', type: 'number', filledBy: 'requester' },
  { id: 'overallScore', label: 'Overall Score', type: 'number', filledBy: 'requester' },
];

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

function parseJsonFieldDefinitions(value) {
  if (Array.isArray(value) && value.length) return value;
  if (typeof value === 'string') {
    try {
      const obj = JSON.parse(value);
      return Array.isArray(obj) && obj.length ? obj : DEFAULT_FIELD_DEFINITIONS;
    } catch {
      return DEFAULT_FIELD_DEFINITIONS;
    }
  }
  return DEFAULT_FIELD_DEFINITIONS;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/quotations');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function saveQuotationFile(invitationId, round, fileName, base64Data) {
  if (!base64Data || !fileName) return { fileName: null, filePath: null };
  ensureUploadDir();
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `${invitationId}_r${round}_${Date.now()}_${safeName}`;
  const fullPath = path.join(UPLOAD_DIR, storedName);
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    throw new Error('Quotation file must be under 5MB');
  }
  fs.writeFileSync(fullPath, buffer);
  return { fileName: safeName, filePath: storedName };
}

function mapSubmissionRow(s) {
  const customFields = parseJsonObject(s.custom_fields);
  const requesterFields = parseJsonObject(s.requester_fields);
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
      maxRounds: rows[0].max_rounds,
      requesterSubmittedAt: rows[0].requester_submitted_at || null,
      finalizedAt: rows[0].finalized_at,
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
    maxRounds: null,
    requesterSubmittedAt: null,
    finalizedAt: null,
  };
}

function extractCoreVendorValues(body, fieldDefinitions, customFields = {}) {
  const defs = fieldDefinitions.filter((f) => f.filledBy === 'vendor');
  const core = {
    quotedPrice: body.quotedPrice,
    leadTime: body.leadTime,
    paymentTerms: body.paymentTerms,
    warranty: body.warranty,
    deliveryTerms: body.deliveryTerms,
    compliance: body.compliance,
    vendorNotes: body.vendorNotes,
  };
  const extra = { ...customFields, ...(body.customFields || {}) };
  for (const field of defs) {
    if (field.core) continue;
    const val = body[field.id] ?? body.customFields?.[field.id];
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
    ...(submission?.customFields || {}),
    ...(submission?.requesterFields || {}),
  };
}

/** Latest vendor quote that counts for RFQ finalize (current round, status submitted). */
function findActiveSubmission(inv) {
  if (!inv?.submissions?.length) return null;

  const currentRound = inv.submissions.find(
    (s) => s.round === inv.round && s.status === 'submitted' && Number(s.quotedPrice) > 0
  );
  if (currentRound) return currentRound;

  if (inv.status === 'submitted') {
    return (
      [...inv.submissions].reverse().find((s) => s.status === 'submitted' && Number(s.quotedPrice) > 0) || null
    );
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
      [JSON.stringify(fieldDefinitions), prId]
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

export async function getRfqByPrId(user, prId) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (user.role === 'Requester' && pr.requesterId !== user.id) {
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

export async function submitVendorQuotation(token, body) {
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
  if (!quotedPrice || Number(quotedPrice) <= 0) throw new Error('Quoted price is required');

  const [rows] = await pool.query(`SELECT * FROM rfq_invitations WHERE access_token = ?`, [token]);
  if (!rows.length) throw new Error('Invalid RFQ link');

  const inv = rows[0];
  if (inv.status !== 'invited' && inv.status !== 'sent_back') {
    throw new Error('Quotation already submitted. Wait for buyer feedback if revision is needed.');
  }

  const config = await getOrCreateRfqConfig(inv.pr_id);
  const { core, customFields } = extractCoreVendorValues(body, config.fieldDefinitions);

  const fileInfo = saveQuotationFile(
    inv.id,
    inv.round,
    quotationFileName,
    quotationFileData
  );

  await pool.query(
    `INSERT INTO vendor_quotation_submissions
     (rfq_invitation_id, round, quoted_price, lead_time_days, payment_terms, compliance, vendor_notes, warranty, delivery_terms, quotation_file_name, quotation_file_path, custom_fields, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
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
      JSON.stringify(customFields),
    ]
  );

  await pool.query(
    `UPDATE rfq_invitations SET status = 'submitted', send_back_reason = NULL, send_back_fields = NULL, updated_at = NOW() WHERE id = ?`,
    [inv.id]
  );

  const pr = await getPurchaseRequestById(inv.pr_id);
  const [requesterRows] = await pool.query(
    `SELECT u.email, u.name FROM users u WHERE u.id = ?`,
    [pr.requesterId]
  );
  const requester = requesterRows[0];
  const reviewUrl = appUrl(`/requester/rfq-entry/${inv.pr_id}`);

  if (requester?.email) {
    queueRfqSubmittedNotifyRequester(pr, inv.vendor_name, requester.email, requester.name, {
      quotedPrice: Number(core.quotedPrice),
      leadTime: Number(core.leadTime) || 0,
      paymentTerms: core.paymentTerms || 'Net 30',
      warranty: core.warranty || '',
      deliveryTerms: core.deliveryTerms || '',
      compliance: core.compliance !== false,
      vendorNotes: core.vendorNotes || '',
    }, reviewUrl);
  }

  return { message: 'Quotation submitted successfully', round: inv.round };
}

export async function submitManualVendorQuotation(user, invitationId, body) {
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
  if (inv.invite_mode === 'email') {
    throw new Error('This vendor was invited by email. Wait for vendor submission or use Resend Mail.');
  }

  const config = await getOrCreateRfqConfig(inv.pr_id);
  const { core, customFields } = extractCoreVendorValues(body, config.fieldDefinitions);
  if (!core.quotedPrice || Number(core.quotedPrice) <= 0) {
    throw new Error('Quoted price is required');
  }

  const fileInfo = saveQuotationFile(
    inv.id,
    inv.round,
    body.quotationFileName,
    body.quotationFileData
  );

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
     (rfq_invitation_id, round, quoted_price, lead_time_days, payment_terms, compliance, vendor_notes, warranty, delivery_terms, quotation_file_name, quotation_file_path, custom_fields, requester_fields, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
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
      JSON.stringify(customFields),
      JSON.stringify(requesterFields),
    ]
  );

  await pool.query(
    `UPDATE rfq_invitations SET status = 'submitted', send_back_reason = NULL, send_back_fields = NULL, updated_at = NOW() WHERE id = ?`,
    [inv.id]
  );

  const pr = await getPurchaseRequestById(inv.pr_id);
  const [requesterRows] = await pool.query(`SELECT u.email, u.name FROM users u WHERE u.id = ?`, [pr.requesterId]);
  const requester = requesterRows[0];
  const reviewUrl = appUrl(`/requester/rfq-entry/${inv.pr_id}`);

  if (requester?.email) {
    queueRfqSubmittedNotifyRequester(
      pr,
      inv.vendor_name,
      requester.email,
      requester.name,
      {
        quotedPrice: Number(core.quotedPrice),
        leadTime: Number(core.leadTime) || 0,
        paymentTerms: core.paymentTerms || 'Net 30',
        warranty: core.warranty || '',
        deliveryTerms: core.deliveryTerms || '',
        compliance: core.compliance !== false,
        vendorNotes: manualNote,
      },
      reviewUrl
    );
  }

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
  if (config.maxRounds != null && inv.round >= config.maxRounds) {
    throw new Error(`Maximum ${config.maxRounds} quotation rounds reached`);
  }

  const newRound = inv.round + 1;
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
  const submitUrl = appUrl(`/vendor/submit-quote/${inv.access_token}`);
  queueRfqSendBackEmail(pr, inv.vendor_name, inv.vendor_email, submitUrl, newRound, reasonText, fields);

  return getInvitationsWithSubmissions(inv.pr_id);
}

export async function saveRfqConfig(user, prId, { fieldDefinitions, maxRounds, recommendedInvitationId }) {
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
    defs = fieldDefinitions.map((f) => ({
      ...f,
      id: f.id || slugifyFieldId(f.label),
      filledBy: f.filledBy === 'requester' ? 'requester' : 'vendor',
    }));
  }

  await pool.query(
    `UPDATE rfq_configs
     SET field_definitions = ?, max_rounds = ?, recommended_invitation_id = ?, updated_at = NOW()
     WHERE pr_id = ?`,
    [
      JSON.stringify(defs),
      maxRounds ?? config.maxRounds,
      recommendedInvitationId ?? config.recommendedInvitationId,
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

export async function finalizeRfq(user, prId, { recommendedInvitationId, taskId }) {
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
      throw new Error('PR must complete HOD / L2 / CFO vendor approvals before SCM final RFQ');
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

  const requesterFieldDefs = config.fieldDefinitions.filter((f) => f.filledBy === 'requester' && f.required);
  for (const field of requesterFieldDefs) {
    const val = latestQuote.requesterFields?.[field.id];
    if (val === undefined || val === null || val === '') {
      throw new Error(`Fill required field: ${field.label}`);
    }
  }

  // Own vendor + Requester → HOD vendor final → L2 → CFO
  if (isOwnVendor && isRequester) {
    await pool.query(
      `UPDATE rfq_configs
       SET recommended_invitation_id = ?, requester_submitted_at = NOW(), updated_at = NOW()
       WHERE pr_id = ?`,
      [recommendedInvitationId, prId]
    );
    if (taskId) {
      await completeRequesterTask(user, taskId);
    }
    await startOwnVendorPostRfqWorkflow(prId);
    return {
      success: true,
      recommendedVendor: recommended.vendorName,
      message: 'RFQ submitted for HOD vendor final approval',
    };
  }

  await pool.query(
    `UPDATE rfq_configs SET recommended_invitation_id = ?, finalized_at = NOW(), updated_at = NOW() WHERE pr_id = ?`,
    [recommendedInvitationId, prId]
  );

  if (taskId) {
    await completeRequesterTask(user, taskId);
  }

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
  const sql = `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_POST_APPROVAL', ?, ?, 'pending', ?)`;
  const params = [prId, assignee.workflowRole, assignee.userId, dueDate.toISOString().split('T')[0]];

  if (conn) {
    await conn.query(sql, params);
  } else {
    await pool.query(sql, params);
  }

  return assignee;
}

async function buildRfqSummary(prId) {
  const config = await getOrCreateRfqConfig(prId);
  if (!config.recommendedInvitationId) return null;
  const invitations = await getInvitationsWithSubmissions(prId);
  const recommended = invitations.find((i) => i.id === config.recommendedInvitationId);
  const latest = recommended?.submissions?.find((s) => s.status === 'submitted' && s.quotedPrice > 0);
  return {
    recommendedVendor: recommended?.vendorName || '',
    vendorCount: invitations.length,
    quotedPrice: latest?.quotedPrice || 0,
  };
}

/** Own path after requester RFQ: HOD vendor final */
async function startOwnVendorPostRfqWorkflow(prId) {
  await pool.query(
    `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
    [PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL, STAGE.RFQ_MANAGER_REVIEW, prId]
  );

  const assignee = await createPostRfqApprovalTask(null, prId, 'hod');
  const pr = await getPurchaseRequestById(prId);
  const rfqSummary = await buildRfqSummary(prId);

  queuePrApprovalPendingNotification(
    pr,
    'HOD Approver',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      postRfq: true,
      stageLabel: 'HOD Vendor Final Approval',
      rfqSummary,
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

  queuePrApprovalPendingNotification(
    pr,
    'SCM Manager',
    { name: pr.requester, email: '' },
    pr.departmentId,
    {
      postRfq: true,
      stageLabel: 'SCM Manager Vendor Approval',
      rfqSummary,
      approverEmails: assignee.email ? [assignee.email] : undefined,
      approverName: assignee.name || undefined,
    }
  );
}

/** Own path after SCM final RFQ: go straight to Create PO */
async function moveToScmCreatePo(prId) {
  await pool.query(
    `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
    [PR_STATUS.PENDING_SCM_PO, STAGE.SCM_PO_CREATE, prId]
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  await pool.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
     VALUES (?, 'RFQ_POST_APPROVAL', 'SCM Buyer', 'pending', ?)`,
    [prId, dueDate.toISOString().split('T')[0]]
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
    if (cfg && cfg.status === prStatus) return { roleConfig: cfg, workflowRole: pendingTask.assigned_role, pendingTask };
  }

  const roleConfig = getPostRfqRoleConfig(user.role);
  if (roleConfig && roleConfig.status === prStatus) {
    if (pendingTask?.assigned_user_id && pendingTask.assigned_user_id !== user.id) {
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
    pendingTask?.assigned_user_id === user.id ||
    postRfqStatuses.includes(pr.status);
  if (!canView) throw new Error('Unauthorized');

  const config = await getOrCreateRfqConfig(prId);
  const invitations = await getInvitationsWithSubmissions(prId);
  const showFullNegotiation = roleConfig?.showFullNegotiation ?? true;

  const vendors = invitations.map((inv) => {
    const activeSubmission = findActiveSubmission(inv);

    const allRounds = inv.submissions
      .filter((s) => s.status === 'submitted')
      .map((s) => ({
        round: s.round,
        values: submissionToFieldValues(s),
        submittedAt: s.submittedAt,
        quotationFileName: s.quotationFileName,
        submissionId: s.id,
        sendBackReason: inv.sendBackReason,
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
      rounds: showFullNegotiation
        ? allRounds
        : activeSubmission?.quotationFileName
          ? allRounds.filter((r) => r.submissionId === activeSubmission.id)
          : [],
    };
  });

  const parameters = config.fieldDefinitions.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    icon: paramIcon(f.id),
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

  return {
    pr: {
      id: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      department: pr.department,
      requestType: pr.requestType,
      totalAmount: pr.totalAmount,
      estimatedBudget: pr.totalAmount,
      status: pr.status,
      statusUI: pr.statusUI,
      justification: pr.justification,
      approvalHistory: pr.approvalHistory,
    },
    vendorCount: vendors.length,
    recommendedVendorId: config.recommendedInvitationId,
    recommendedVendorName: recommendedVendor?.name || '',
    showFullNegotiation,
    stageLabel: roleConfig?.label || null,
    canApprove: Boolean(
      assignedRoleConfig
        ? pr.status === assignedRoleConfig.status
        : userRoleConfig &&
            pr.status === userRoleConfig.status &&
            (!pendingTask?.assigned_user_id || pendingTask.assigned_user_id === user.id)
    ),
    vendors,
    parameters,
    matrix,
    finalizedAt: config.finalizedAt,
  };
}

export async function listScmRfqEntryPrs(user) {
  if (user.role !== 'SCM Buyer') throw new Error('Unauthorized');

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
  const [rows] = await pool.query(
    `SELECT DISTINCT pr.id
     FROM purchase_requests pr
     JOIN workflow_tasks wt ON wt.pr_id = pr.id
     WHERE wt.task_type = 'RFQ_POST_APPROVAL'
       AND wt.status = 'pending'
       AND wt.assigned_user_id = ?
     ORDER BY pr.updated_at DESC`,
    [user.id]
  );

  const results = [];
  for (const row of rows) {
    const pr = await getPurchaseRequestById(row.id);
    const roleConfig = getPostRfqRoleConfig(
      (await getPendingPostRfqTask(row.id))?.assigned_role || user.role
    );
    if (!roleConfig || pr.status !== roleConfig.status) continue;

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
    results.push({
      prId: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      department: pr.department,
      requester: pr.requester,
      totalAmount: pr.totalAmount,
      requestType: pr.requestType,
      priority: pr.priority,
      status: pr.statusUI,
      submittedDate: pr.submittedDate,
      vendorCount: vendorCount[0].cnt,
      recommendedVendor,
      stageLabel: roleConfig.label,
    });
  }
  return results;
}

export async function processPostRfqApproval(user, prId, action, remarks) {
  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  const { roleConfig, workflowRole } = await resolvePostRfqRoleConfigForUser(user, prId, pr.status);
  if (!remarks?.trim()) throw new Error('Remarks are required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let newStatus;
    let newStage;
    let nextRole = null;

    if (action === 'approve') {
      newStatus = roleConfig.nextStatus;
      newStage = roleConfig.nextStage;
      nextRole = roleConfig.nextRole;
    } else if (action === 'reject') {
      newStatus = PR_STATUS.REJECTED;
      newStage = null;
    } else if (action === 'return' || action === 'rework') {
      // Send back to RFQ: Own → Requester re-entry; SCM → SCM RFQ queue
      newStatus = PR_STATUS.APPROVED;
      newStage = null;
      await conn.query(
        `UPDATE rfq_configs
         SET finalized_at = NULL, requester_submitted_at = NULL, updated_at = NOW()
         WHERE pr_id = ?`,
        [prId]
      );
      if (pr.vendor_selection === 'own') {
        const rfqDue = new Date();
        rfqDue.setDate(rfqDue.getDate() + 5);
        await conn.query(
          `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
           VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
          [prId, pr.requester_id, rfqDue.toISOString().split('T')[0]]
        );
      }
    } else {
      throw new Error('Invalid action');
    }

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [prId, roleConfig.stage, user.id, action, remarks]
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
        await conn.query(
          `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
           VALUES (?, 'RFQ_POST_APPROVAL', ?, 'pending', ?)`,
          [prId, nextRole, dueDate.toISOString().split('T')[0]]
        );
      }
    }

    await conn.commit();

    const updatedPr = await getPurchaseRequestById(prId);
    const requester = { name: updatedPr.requester, email: '' };

    if (nextRole && action === 'approve') {
      const nextCfg = POST_RFQ_ROLE_MAP[nextRole];
      queuePrApprovalPendingNotification(updatedPr, nextRole, requester, updatedPr.departmentId, {
        postRfq: true,
        stageLabel: nextCfg?.label,
        approverEmails: nextAssignee?.email ? [nextAssignee.email] : undefined,
        approverName: nextAssignee?.name || undefined,
      });
    } else if (
      action === 'approve' &&
      !nextRole &&
      newStatus === PR_STATUS.APPROVED &&
      pr.vendor_selection === 'own'
    ) {
      // Own path: CFO done → ready for SCM final RFQ (no task; appears in SCM RFQ queue)
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
      canSendBack: inv.status === 'submitted' && (maxRounds == null || inv.round < maxRounds),
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

export async function getSubmissionFile(user, submissionId) {
  const [rows] = await pool.query(
    `SELECT vqs.*, ri.pr_id, pr.requester_id
     FROM vendor_quotation_submissions vqs
     JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
     JOIN purchase_requests pr ON pr.id = ri.pr_id
     WHERE vqs.id = ?`,
    [submissionId]
  );
  if (!rows.length) throw new Error('Quotation file not found');

  const row = rows[0];
  const postRfqRoles = ['HOD Approver', 'PR Manager', 'SCM Manager', 'CFO', 'SCM Buyer'];
  if (user.role === 'Requester' && row.requester_id !== user.id) {
    throw new Error('Unauthorized');
  }
  if (!['Requester', 'SCM Buyer', ...postRfqRoles].includes(user.role)) {
    throw new Error('Unauthorized');
  }
  if (!row.quotation_file_path) throw new Error('No quotation file attached');

  const fullPath = path.join(UPLOAD_DIR, row.quotation_file_path);
  if (!fs.existsSync(fullPath)) throw new Error('Quotation file not found on server');

  return {
    fullPath,
    fileName: row.quotation_file_name || 'quotation.pdf',
  };
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
