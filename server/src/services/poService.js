import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from '../config/db.js';
import { getPurchaseRequestById } from './prService.js';
import { generatePoPdf, PO_UPLOAD_DIR, resolvePoDocumentPath, ensurePoPdf } from './poPdfService.js';
import { sendPoVendorNotification, queuePoWorkflowNotification } from './emailService.js';
import { formatDate, formatDateTime, PR_STATUS, REQUESTER_PO_DOCUMENT_STATUSES } from '../utils/constants.js';
import { getL1ManagerForEmail } from './refexOneService.js';
import { getLetterheadByType, alignPoTypeWithPurchaseType, mergeQuoteNoIntoPoContent } from './poLetterheadService.js';
import {
  getActiveLetterheadBranding,
  getLetterheadMasterById,
} from './letterheadBrandingService.js';
import {
  nextDocumentNumber,
  normalizePurchaseType,
  purchaseTypeLabel,
  purchaseTypeToDocType,
} from './documentNumberService.js';
import {
  resolveScmBuyerUser,
  getScmBuyerNotifyEmails,
  resolveScmManagerUser,
  getScmManagerNotifyEmails,
  getPreferredScmManagerName,
  insertScmManagerPoApprovalTask,
  canEditAnyScmPurchaseOrder,
} from '../utils/scmAssignee.js';
import { getWhatsAppPublicBaseUrl } from './whatsappService.js';
import { parseAnnexureIi, serializeAnnexureIi } from '../utils/annexureIi.js';
import { wrapPortalUrlWithSso } from './refexOneSamlService.js';
import { buildSignatureRenderOptions } from './signatureService.js';

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function resolvePoDate(value, fallback) {
  const s = String(value || fallback || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return todayYmd();
}

async function resolveEntityIdFromPoBody(body = {}, existing = null) {
  const direct = Number(body.entityId || existing?.entity_id || 0);
  if (direct) return direct;

  const letterheadId = Number(body.letterheadId || existing?.letterhead_id || 0);
  let entityName = String(body.entity || existing?.entity || '').trim();
  let letterheadName = '';
  if (letterheadId) {
    try {
      const selected = await getLetterheadMasterById(letterheadId);
      entityName = String(selected.entity || entityName).trim();
      letterheadName = String(selected.name || '').trim();
    } catch {
      /* optional */
    }
  }
  if (!entityName && !letterheadName) return 0;

  const [rows] = await pool.query(
    `SELECT id FROM entity_masters
     WHERE status = 'active'
       AND (
         LOWER(name) = LOWER(?)
         OR LOWER(IFNULL(code, '')) = LOWER(?)
         OR LOWER(name) = LOWER(?)
         OR LOWER(IFNULL(code, '')) = LOWER(?)
       )
     LIMIT 1`,
    [entityName, entityName, letterheadName, letterheadName]
  );
  return Number(rows[0]?.id || 0);
}

function poPortalUrl(path) {
  const base = getWhatsAppPublicBaseUrl().replace(/\/$/, '');
  return wrapPortalUrlWithSso(`${base}${path.startsWith('/') ? path : `/${path}`}`);
}

async function resolveRoleEmails(role) {
  if (role === 'SCM Buyer') {
    const emails = await getScmBuyerNotifyEmails();
    return emails.map((email) => ({ email, name: 'SCM Buyer' }));
  }
  if (role === 'SCM Manager') {
    const emails = await getScmManagerNotifyEmails();
    const manager = await resolveScmManagerUser();
    return emails.map((email) => ({ email, name: manager?.name || 'SCM Manager' }));
  }
  const [rows] = await pool.query(
    `SELECT email, name FROM users WHERE role = ? AND is_active = 1`,
    [role]
  );
  return rows.map((r) => ({ email: r.email, name: r.name }));
}

async function resolvePoNotifyParties(po) {
  const emails = new Set();
  const names = [];

  if (po.createdBy || po.created_by) {
    const [creator] = await pool.query(
      `SELECT email, name FROM users WHERE id = ? AND is_active = 1`,
      [po.createdBy || po.created_by]
    );
    if (creator[0]?.email) {
      emails.add(creator[0].email);
      names.push(creator[0].name);
    }
  }

  if (po.prId || po.pr_id) {
    const [reqRows] = await pool.query(
      `SELECT u.email, u.name
       FROM purchase_requests pr
       JOIN users u ON u.id = pr.requester_id
       WHERE pr.id = ? AND u.is_active = 1`,
      [po.prId || po.pr_id]
    );
    if (reqRows[0]?.email) {
      emails.add(reqRows[0].email);
      names.push(reqRows[0].name);
    }
  }

  if (po.signerId || po.signer_id) {
    const [signer] = await pool.query(
      `SELECT email, name FROM users WHERE id = ? AND is_active = 1`,
      [po.signerId || po.signer_id]
    );
    if (signer[0]?.email) {
      emails.add(signer[0].email);
      names.push(signer[0].name);
    }
  }

  return {
    emails: [...emails],
    name: names[0] || po.requester || 'User',
  };
}

function addInternalNotifyEmail(emails, names, email, name, exclude) {
  const e = String(email || '').trim();
  if (!e || !e.includes('@')) return;
  const lower = e.toLowerCase();
  if (exclude.has(lower)) return;
  if (lower.endsWith('@imported.local')) return;
  if (emails.has(e) || [...emails].some((x) => x.toLowerCase() === lower)) return;
  emails.add(e);
  if (name) names.push(name);
}

/** Requester + L1 + this PR's approvers only — never the vendor. */
async function collectRequesterAndApproverEmails(po, { excludeEmails = [] } = {}) {
  const emails = new Set();
  const names = [];
  const exclude = new Set(
    [...excludeEmails, po.vendorEmail || po.vendor_email]
      .map((e) => String(e || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const prId = po.prId || po.pr_id;
  if (prId) {
    const pr = await getPurchaseRequestById(prId);
    if (pr?.requesterId) {
      const [reqRows] = await pool.query(
        `SELECT email, name, supervisor_email, supervisor_name
         FROM users WHERE id = ? AND is_active = 1`,
        [pr.requesterId]
      );
      const requester = reqRows[0];
      if (requester) {
        addInternalNotifyEmail(emails, names, requester.email, requester.name, exclude);
        addInternalNotifyEmail(
          emails,
          names,
          requester.supervisor_email,
          requester.supervisor_name,
          exclude
        );
        try {
          const l1 = await getL1ManagerForEmail(requester.email);
          if (l1?.email) addInternalNotifyEmail(emails, names, l1.email, l1.name, exclude);
        } catch {
          /* L1 lookup optional */
        }
      }

      const chainIds = [...new Set(
        [...(pr.approvalUserIds || []), pr.approvalUserId].map((id) => Number(id)).filter(Boolean)
      )];
      if (chainIds.length) {
        const [chainUsers] = await pool.query(
          `SELECT email, name FROM users WHERE id IN (${chainIds.map(() => '?').join(',')}) AND is_active = 1`,
          chainIds
        );
        chainUsers.forEach((u) => addInternalNotifyEmail(emails, names, u.email, u.name, exclude));
      }

      const [acted] = await pool.query(
        `SELECT DISTINCT u.email, u.name
         FROM pr_approvals pa
         JOIN users u ON u.id = pa.approver_id
         WHERE pa.pr_id = ? AND pa.approver_id IS NOT NULL AND u.is_active = 1`,
        [prId]
      );
      acted.forEach((u) => addInternalNotifyEmail(emails, names, u.email, u.name, exclude));
    }
  }

  if (po.signerId || po.signer_id) {
    const [signer] = await pool.query(
      `SELECT email, name FROM users WHERE id = ? AND is_active = 1`,
      [po.signerId || po.signer_id]
    );
    if (signer[0]) addInternalNotifyEmail(emails, names, signer[0].email, signer[0].name, exclude);
  }

  return {
    emails: [...emails],
    name: names[0] || po.requester || 'User',
  };
}

function normalizeCurrency(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'INR') return code;
  return 'INR';
}

function ensurePoUploadDir() {
  if (!fs.existsSync(PO_UPLOAD_DIR)) {
    fs.mkdirSync(PO_UPLOAD_DIR, { recursive: true });
  }
}

function saveVendorAcceptanceFile(poId, fileName, base64Data) {
  if (!base64Data || !fileName) return { fileName: null, filePath: null };
  ensurePoUploadDir();
  const safeName = path.basename(String(fileName)).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `po-${poId}-vendor-acceptance-${Date.now()}-${safeName}`;
  const fullPath = path.join(PO_UPLOAD_DIR, storedName);
  const raw = String(base64Data).includes(',') ? String(base64Data).split(',').pop() : String(base64Data);
  fs.writeFileSync(fullPath, Buffer.from(raw, 'base64'));
  return { fileName: safeName, filePath: storedName };
}

function savePoAttachment(poId, prefix, fileName, base64Data) {
  if (!base64Data || !fileName) return { fileName: null, filePath: null };
  ensurePoUploadDir();
  const safeName = path.basename(String(fileName)).replace(/[^a-zA-Z0-9._-]/g, '_');
  const storedName = `po-${poId}-${prefix}-${Date.now()}-${safeName}`;
  const fullPath = path.join(PO_UPLOAD_DIR, storedName);
  const raw = String(base64Data).includes(',') ? String(base64Data).split(',').pop() : String(base64Data);
  fs.writeFileSync(fullPath, Buffer.from(raw, 'base64'));
  return { fileName: safeName, filePath: storedName };
}

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function newVendorAcceptanceToken() {
  return crypto.randomBytes(24).toString('hex');
}

function parseClauseJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/** True when the client sent this array key (including empty = user cleared it). */
function pickProvidedArray(body, ...keys) {
  if (!body || typeof body !== 'object') return { provided: false, value: [] };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key) && Array.isArray(body[key])) {
      return { provided: true, value: body[key] };
    }
  }
  return { provided: false, value: [] };
}

function pickAnnexureIiSource(body, fallback = '') {
  if (!body || typeof body !== 'object') return fallback;
  if (Array.isArray(body.annexureIiRows)) return body.annexureIiRows;
  if (Object.prototype.hasOwnProperty.call(body, 'annexureIiHtml')) return body.annexureIiHtml || '';
  if (Object.prototype.hasOwnProperty.call(body, 'annexure_ii_html')) return body.annexure_ii_html || '';
  return fallback;
}

function parseSignatureDsc(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Keep the stored SCM Manager signature on live preview so Buyer Final Verify shows the signed block. */
function attachStoredPoSignature(preview, row) {
  if (!preview || !row) return preview;
  return {
    ...preview,
    signedAt: row.signed_at ? formatDateTime(row.signed_at) : null,
    signedPdfPath: row.signed_pdf_path || null,
    signatureName: row.signature_name || null,
    signatureImagePath: row.signature_image_path || null,
    signatureImageData: row.signature_image_data || null,
    signatureDsc: parseSignatureDsc(row.signature_dsc_json),
    signerComments: row.signer_comments || null,
    signerId: row.signer_id || null,
  };
}

export const EMPTY_PO_TERMS_DETAILS = {
  paymentTermsText: '',
  siteAddress: '',
  siteContactPerson: '',
  siteContactPhone: '',
  siteContactEmail: '',
  projectManagerHo: '',
  projectManagerContact: '',
  projectManagerEmail: '',
  invoicingAddress: '',
  mailingAddress: '',
  reasonForCancellation: '',
  subject: '',
  quoteNo: '',
  quoteDate: '',
  locationName: '',
  buyerGstNo: '',
  letterheadLocationId: '',
};

export function normalizePoTermsDetails(raw) {
  let src = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch {
      src = {};
    }
  }
  if (!src || typeof src !== 'object') src = {};
  const out = { ...EMPTY_PO_TERMS_DETAILS };
  for (const key of Object.keys(EMPTY_PO_TERMS_DETAILS)) {
    if (src[key] != null) out[key] = String(src[key]);
  }
  return out;
}

async function generatePoNumber(entityId, purchaseType = 'purchase_order', connection = pool) {
  const docType = purchaseTypeToDocType(purchaseType);
  return nextDocumentNumber(docType, entityId, connection);
}

const PO_NUMBER_MAX_LEN = 40;

function normalizeRequestedPoNumber(value) {
  const n = String(value || '').trim().slice(0, PO_NUMBER_MAX_LEN);
  return n || null;
}

async function assertPoNumberAvailable(poNumber, excludeId, connection = pool, docLabel = 'Purchase Order') {
  const sql = excludeId
    ? `SELECT id FROM purchase_orders WHERE LOWER(po_number) = LOWER(?) AND id <> ? LIMIT 1`
    : `SELECT id FROM purchase_orders WHERE LOWER(po_number) = LOWER(?) LIMIT 1`;
  const params = excludeId ? [poNumber, excludeId] : [poNumber];
  const [dup] = await connection.query(sql, params);
  if (dup.length) throw new Error(`${docLabel} number ${poNumber} already exists`);
}

/** Use the buyer-typed number when unique; otherwise keep the existing / generated number. */
async function resolvePersistedPoNumber({
  requested,
  existingNumber,
  entityId,
  purchaseType,
  excludeId,
  connection,
  docLabel,
}) {
  const custom = normalizeRequestedPoNumber(requested);
  const current = String(existingNumber || '').trim() || null;
  if (custom) {
    if (!current || custom.toLowerCase() !== current.toLowerCase()) {
      await assertPoNumberAvailable(custom, excludeId, connection, docLabel);
    }
    return custom;
  }
  if (current) return current;
  return generatePoNumber(entityId, purchaseType, connection);
}

async function getRecommendedVendor(prId) {
  const [configRows] = await pool.query(`SELECT recommended_invitation_id FROM rfq_configs WHERE pr_id = ?`, [prId]);
  if (!configRows.length || !configRows[0].recommended_invitation_id) {
    throw new Error('No recommended vendor found for this PR');
  }
  const [inv] = await pool.query(`SELECT * FROM rfq_invitations WHERE id = ?`, [
    configRows[0].recommended_invitation_id,
  ]);
  if (!inv.length) throw new Error('Recommended vendor invitation not found');
  return inv[0];
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeUnit(value) {
  const unit = String(value || '').trim().slice(0, 50);
  return unit || 'Nos';
}

function lineItemTotal(quantity, unitPrice) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return roundMoney(gross);
}

function lineItemTax(total, taxPercentage) {
  return roundMoney(((Number(total) || 0) * (Number(taxPercentage) || 0)) / 100);
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function lookupUnitsFromItemMaster(lineItems) {
  if (!lineItems?.length) return lineItems;
  try {
    const [rows] = await pool.query(`SELECT name, description, unit FROM items`);
    const byName = new Map();
    const byDesc = new Map();
    for (const row of rows) {
      const unit = normalizeUnit(row.unit);
      const name = String(row.name || '').trim().toLowerCase();
      const desc = String(row.description || '').trim().toLowerCase();
      if (name) byName.set(name, unit);
      if (desc) byDesc.set(desc, unit);
    }
    return lineItems.map((item) => {
      const current = String(item.unit || item.uom || '').trim();
      if (current && current.toLowerCase() !== 'nos' && current.toLowerCase() !== "no's") {
        return { ...item, unit: current };
      }
      const name = plainText(item.itemName || item.name || '');
      const desc = plainText(item.description || item.item || '');
      const found = (name && byName.get(name)) || (desc && byName.get(desc)) || (desc && byDesc.get(desc));
      return { ...item, unit: found || current || 'Nos' };
    });
  } catch {
    return lineItems.map((item) => ({ ...item, unit: normalizeUnit(item.unit || item.uom) }));
  }
}

async function getLineItems(poId) {
  const [rows] = await pool.query(`SELECT * FROM po_line_items WHERE po_id = ? ORDER BY id`, [poId]);
  return rows.map((r) => ({
    id: r.id,
    category: r.category || '',
    itemName: r.item_name || '',
    description: r.description,
    quantity: r.quantity,
    unit: normalizeUnit(r.unit),
    uom: normalizeUnit(r.unit),
    unitPrice: Number(r.unit_price),
    discount: Number(r.discount) || 0,
    taxPercentage: Number(r.tax_percentage) || 0,
    total: Number(r.total),
  }));
}

async function enrichPO(row) {
  let pr = null;
  if (row.pr_id) {
    try {
      pr = await getPurchaseRequestById(row.pr_id);
    } catch {
      pr = null;
    }
  }
  const lineItems = await getLineItems(row.id);

  const vendor = await lookupVendorMaster(row.vendor_email, row.vendor_name);
  const [creatorRows] = await pool.query(`SELECT name, role FROM users WHERE id = ?`, [row.created_by]);
  const creator = creatorRows[0] || {};
  const [cancelledByRows] = row.cancelled_by
    ? await pool.query(`SELECT name FROM users WHERE id = ?`, [row.cancelled_by])
    : [[]];
  const cancelledBy = cancelledByRows[0] || {};
  const approvalHistory = await getFullPoApprovalHistory(row);
  const quoteMerged = mergeQuoteNoIntoPoContent(
    parseClauseJson(row.terms_clauses),
    normalizePoTermsDetails(row.po_terms_details)
  );

  return {
    id: row.id,
    poNumber: row.po_number,
    referencePoNumber: row.reference_po_number || '',
    prId: row.pr_id,
    prNumber: pr?.prNumber || '',
    prTitle: pr?.title || '',
    department: pr?.department || '',
    requester: pr?.requester || '',
    vendorName: vendor.name || row.vendor_name,
    vendorEmail: vendor.email || row.vendor_email,
    vendorAddress: vendor.address || '',
    vendorGst: vendor.gst_number || '',
    vendorPan: vendor.pan_number || '',
    vendorPhone: vendor.phone || '',
    deliveryAddress: row.delivery_address,
    expectedDeliveryDate: formatDate(row.expected_delivery_date),
    poDate: formatDate(row.po_date) || formatDate(row.created_at),
    paymentTerms: row.payment_terms,
    incoterms: row.incoterms,
    specialInstructions: row.special_instructions || '',
    poType: row.po_type || 'short_po',
    purchaseType: row.purchase_type || pr?.purchaseType || 'purchase_order',
    purchaseTypeLabel: purchaseTypeLabel(row.purchase_type || pr?.purchaseType),
    letterheadHeader: row.letterhead_header || '',
    letterheadId: row.letterhead_id || null,
    entityId: row.entity_id || null,
    entity: row.entity || '',
    headerLogo: row.header_logo || '',
    footerLogo: row.footer_logo || '',
    termsClauses: quoteMerged.terms,
    annexureClauses: parseClauseJson(row.annexure_clauses),
    annexureIiHtml: row.annexure_ii_html || '',
    annexureIiRows: parseAnnexureIi(row.annexure_ii_html || ''),
    poTermsDetails: quoteMerged.poTermsDetails,
    gstPercentage: Number(row.gst_percentage),
    currency: normalizeCurrency(row.currency),
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    grandTotal: Number(row.grand_total),
    status: mapPoStatusUI(row.status, row.vendor_acceptance_status),
    statusRaw: row.status,
    vendorAcceptanceStatus: row.vendor_acceptance_status || null,
    vendorAcceptanceMode: row.vendor_acceptance_mode || null,
    vendorAcceptanceRemarks: row.vendor_acceptance_remarks || '',
    vendorAcceptanceFileName: row.vendor_acceptance_file_name || '',
    vendorAcceptanceFilePath: row.vendor_acceptance_file_path || '',
    vendorDeliveryConfirmedDate: row.vendor_delivery_confirmed_date
      ? formatDate(row.vendor_delivery_confirmed_date)
      : '',
    vendorAcceptedAt: row.vendor_accepted_at ? formatDateTime(row.vendor_accepted_at) : null,
    cancellationReason: row.cancellation_reason || '',
    cancellationAttachments: parseJsonArray(row.cancellation_attachments_json),
    cancelledAt: row.cancelled_at ? formatDateTime(row.cancelled_at) : null,
    cancelledBy: row.cancelled_by || null,
    cancelledByName: cancelledBy.name || '',
    vendorAcceptanceToken: row.vendor_acceptance_token || null,
    pdfPath: row.pdf_path,
    signedPdfPath: row.signed_pdf_path,
    signatureName: row.signature_name,
    signatureImagePath: row.signature_image_path || null,
    signatureImageDataUrl:
      row.signed_at || row.signature_image_path || row.signed_pdf_path || row.signature_image_data
        ? buildSignatureRenderOptions({
            signatureName: row.signature_name,
            signatureImagePath: row.signature_image_path,
            signatureImageData: row.signature_image_data,
            signatureDsc: parseSignatureDsc(row.signature_dsc_json),
            signedAt: row.signed_at,
            signedPdfPath: row.signed_pdf_path,
            signerComments: row.signer_comments,
          })?.imageDataUrl || null
        : null,
    signatureDsc: parseSignatureDsc(row.signature_dsc_json),
    signerComments: row.signer_comments,
    signedAt: row.signed_at ? formatDateTime(row.signed_at) : null,
    createdAt: formatDate(row.created_at),
    createdBy: creator.name || 'SCM Buyer',
    createdByRole: creator.role || 'SCM Buyer',
    approvalHistory,
    lineItems,
    priority: pr?.priorityLower || 'medium',
  };
}

function mapPoStatusUI(status, acceptanceStatus) {
  if (status === 'sent_to_vendor') {
    if (acceptanceStatus === 'accepted') return 'Vendor Accepted';
    if (acceptanceStatus === 'rejected') return 'Vendor Rejected';
    if (acceptanceStatus === 'partial') return 'Partially Accepted';
    return 'Pending Vendor Acceptance';
  }
  const map = {
    draft: 'Draft',
    imported: 'Imported',
    pending_approval: 'Pending Approval',
    pending_buyer_verify: 'Pending Buyer Verify',
    approved: 'PO Approved',
    rejected: 'PO Rejected',
    sent_to_vendor: 'Pending Vendor Acceptance',
    awaiting_grn: 'Awaiting GRN',
    grn_completed: 'GRN Completed',
    invoice_entry: 'Invoice Entry',
    pending_accounts_approval: 'Pending Accounts Approval',
    approved_for_payment: 'Approved for Payment',
    paid: 'Paid',
    cancelled: 'Cancelled',
  };
  return map[status] || status;
}

function formatApprovalStage(stage) {
  const labels = {
    PO_CREATED: 'PO Created',
    PO_UPDATED: 'PO Updated',
    PO_SIGNED: 'SCM Manager Sign',
    PO_BUYER_VERIFIED: 'SCM Buyer Final Verify',
    PO_BUYER_REJECTED: 'SCM Buyer Final Verify',
    PO_BUYER_SENT_BACK: 'SCM Buyer Final Verify',
    PO_REJECTED: 'SCM Manager Approval',
    PO_SENT_BACK: 'SCM Manager Approval',
    PO_CANCELLED: 'PO Cancellation',
    HOD_REVIEW: 'HOD / Manager Approval',
    PR_MANAGER_REVIEW: 'L2 Manager Approval',
    CFO_REVIEW: 'CFO Approval',
    RFQ_REQUESTER_SUBMIT: 'RFQ Submitted — Vendor Final',
    RFQ_MANAGER_REVIEW: 'Vendor Final Approval (Manager)',
    RFQ_L2_REVIEW: 'Vendor Final — L2 Manager',
    RFQ_CFO_REVIEW: 'Vendor Final — CFO Approval',
    RFQ_SCM_BUYER_SELECTION: 'SCM Buyer Vendor Selection',
    BUSINESS_REVIEW: 'SCM Manager Vendor Approval',
    SCM_PO_CREATE: 'SCM Buyer Create PO',
    SUBMITTED: 'PR Submitted',
  };
  return labels[stage] || String(stage || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapApprovalAction(action) {
  const normalized = String(action || '').toLowerCase();
  if (normalized === 'submitted') return 'Submitted';
  if (normalized === 'approve' || normalized === 'approved') return 'Approved';
  if (normalized === 'reject' || normalized === 'rejected') return 'Rejected';
  if (normalized === 'created') return 'Created';
  if (normalized === 'updated') return 'Updated';
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'return' || normalized === 'returned') return 'Returned';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Updated';
}

async function getFullPoApprovalHistory(row) {
  if (!row.pr_id) {
    const [creator] = await pool.query(`SELECT name, role FROM users WHERE id = ?`, [row.created_by]);
    return [
      {
        stage: 'PO Created',
        approver: creator[0]?.name || 'SCM Buyer',
        role: creator[0]?.role || 'SCM Buyer',
        action: 'Created',
        date: formatDateTime(row.created_at),
        remarks: `Manual PO ${row.po_number} created (no PR reference)`,
      },
    ];
  }

  const [approvalRows] = await pool.query(
    `SELECT pa.*, u.name AS approver_name, u.role AS approver_role
     FROM pr_approvals pa
     LEFT JOIN users u ON u.id = pa.approver_id
     WHERE pa.pr_id = ?
     ORDER BY pa.created_at ASC`,
    [row.pr_id]
  );

  const history = approvalRows.map((r) => ({
    stage: formatApprovalStage(r.stage),
    approver: r.approver_name || 'System',
    role: r.approver_role || formatApprovalStage(r.stage),
    action: mapApprovalAction(r.action),
    date: formatDateTime(r.created_at),
    remarks: r.remarks || '',
    sortAt: new Date(r.created_at).getTime(),
  }));

  const stages = new Set(approvalRows.map((r) => r.stage));

  // Backfill vendor-final submit + SCM buyer selection when RFQ exists but history rows are missing
  if (row.pr_id) {
    const [cfgRows] = await pool.query(
      `SELECT rc.requester_submitted_at, rc.finalized_at, ri.vendor_name
       FROM rfq_configs rc
       LEFT JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
       WHERE rc.pr_id = ?
       LIMIT 1`,
      [row.pr_id]
    );
    const cfg = cfgRows[0];
    if (cfg?.requester_submitted_at && !stages.has('RFQ_REQUESTER_SUBMIT')) {
      history.push({
        stage: formatApprovalStage('RFQ_REQUESTER_SUBMIT'),
        approver: 'Requester',
        role: 'Requester',
        action: 'Submitted',
        date: formatDateTime(cfg.requester_submitted_at),
        remarks: `RFQ submitted for Vendor Final Approval${cfg.vendor_name ? `. Recommended vendor: ${cfg.vendor_name}` : ''}`,
        sortAt: new Date(cfg.requester_submitted_at).getTime(),
      });
    }
    if (cfg?.finalized_at && !stages.has('RFQ_SCM_BUYER_SELECTION')) {
      history.push({
        stage: formatApprovalStage('RFQ_SCM_BUYER_SELECTION'),
        approver: 'SCM Buyer',
        role: 'SCM Buyer',
        action: 'Approved',
        date: formatDateTime(cfg.finalized_at),
        remarks: `SCM Buyer Vendor Selection${cfg.vendor_name ? ` — recommended vendor: ${cfg.vendor_name}` : ''}`,
        sortAt: new Date(cfg.finalized_at).getTime(),
      });
    }
  }

  if (!stages.has('PO_CREATED')) {
    const [creator] = await pool.query(`SELECT name, role FROM users WHERE id = ?`, [row.created_by]);
    history.push({
      stage: 'PO Created',
      approver: creator[0]?.name || 'SCM Buyer',
      role: creator[0]?.role || 'SCM Buyer',
      action: 'Created',
      date: formatDateTime(row.created_at),
      remarks: `PO ${row.po_number} created and sent for SCM Manager approval`,
      sortAt: new Date(row.created_at).getTime(),
    });
  }

  if (row.status === 'rejected' && !stages.has('PO_REJECTED')) {
    history.push({
      stage: 'SCM Manager Approval',
      approver: row.signature_name || 'SCM Manager',
      role: 'SCM Manager',
      action: 'Rejected',
      date: formatDateTime(row.updated_at),
      remarks: row.signer_comments || 'PO rejected by SCM Manager',
      sortAt: new Date(row.updated_at).getTime(),
    });
  }

  if (row.signed_at && !stages.has('PO_SIGNED')) {
    history.push({
      stage: 'SCM Manager Sign',
      approver: row.signature_name || 'SCM Manager',
      role: 'SCM Manager',
      action: 'Approved',
      date: formatDateTime(row.signed_at),
      remarks: row.signer_comments || 'PO signed and sent to vendor',
      sortAt: new Date(row.signed_at).getTime(),
    });
  }

  history.sort((a, b) => a.sortAt - b.sortAt);
  return history.map(({ sortAt: _sortAt, ...entry }) => entry);
}

export async function getPoCreateContext(user, prId) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');
  if (user.role !== 'SCM Buyer' && user.role !== 'Requester') {
    throw new Error('Unauthorized');
  }

  const vendor = await getRecommendedVendor(prId);
  const [subRows] = await pool.query(
    `SELECT payment_terms, delivery_terms, quoted_price FROM vendor_quotation_submissions
     WHERE rfq_invitation_id = ? AND status = 'submitted' ORDER BY round DESC LIMIT 1`,
    [vendor.id]
  );
  const quote = subRows[0] || {};

  const lineItems = await lookupUnitsFromItemMaster(pr.lineItems || []);

  let draftSql = `SELECT id FROM purchase_orders WHERE pr_id = ? AND status = 'draft'`;
  const draftParams = [prId];
  if (!canEditAnyScmPurchaseOrder(user)) {
    draftSql += ` AND created_by = ?`;
    draftParams.push(user.id);
  }
  draftSql += ` ORDER BY updated_at DESC, id DESC LIMIT 1`;
  const [draftRows] = await pool.query(draftSql, draftParams);

  return {
    pr: {
      id: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      department: pr.department,
      entityId: pr.entityId || null,
      entityName: pr.entityName || '',
      entityCode: pr.entityCode || '',
      requester: pr.requester,
      totalAmount: pr.totalAmount,
      currency: pr.currency,
      purchaseType: pr.purchaseType,
      purchaseTypeLabel: pr.purchaseTypeLabel,
      placeOfDelivery: pr.placeOfDelivery || '',
      deliveryPoc: pr.deliveryPoc || '',
      expectedDeliveryTimeline: pr.expectedDeliveryTimeline || '',
      billingLocation: pr.billingLocation || '',
      billingGstNo: pr.billingGstNo || '',
      paymentTerms: pr.paymentTerms || '',
      lineItems,
    },
    vendor: {
      name: vendor.vendor_name,
      email: vendor.vendor_email,
      paymentTerms: quote.payment_terms || pr.paymentTerms || 'Net 30 Days',
      deliveryTerms: quote.delivery_terms || 'DDP',
      quotedPrice: Number(quote.quoted_price) || pr.totalAmount,
    },
    draftPoId: Number(draftRows[0]?.id || 0) || null,
  };
}

async function lookupVendorMaster(vendorEmail, vendorName, extras = {}) {
  const email = String(vendorEmail || '').trim();
  const name = String(vendorName || '').trim();
  const gst = String(extras.gst || extras.gstNumber || extras.gst_number || '').trim();
  const select = `SELECT name, email, address, gst_number, pan_number, phone FROM vendors`;

  const nameKey = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\b(private|limited|pvt|ltd|llp|inc|corp|company)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  // Name first — email on the PO is often stale after Vendor Master updates.
  if (name) {
    const [byName] = await pool.query(
      `${select} WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1`,
      [name]
    );
    if (byName[0]) return byName[0];

    const token = nameKey(name).split(' ').find((t) => t.length >= 4) || '';
    if (token) {
      const [fuzzy] = await pool.query(
        `${select} WHERE LOWER(name) LIKE ? LIMIT 25`,
        [`%${token}%`]
      );
      const key = nameKey(name);
      const hit =
        fuzzy.find((row) => nameKey(row.name) === key) ||
        fuzzy.find((row) => {
          const k = nameKey(row.name);
          return k && key && (k.includes(key) || key.includes(k));
        });
      if (hit) return hit;
    }
  }
  if (gst) {
    const [byGst] = await pool.query(
      `${select} WHERE REPLACE(UPPER(IFNULL(gst_number, '')), ' ', '') = REPLACE(UPPER(?), ' ', '') LIMIT 1`,
      [gst]
    );
    if (byGst[0]) return byGst[0];
  }
  if (email) {
    const [byEmail] = await pool.query(
      `${select} WHERE LOWER(TRIM(email)) = LOWER(?) LIMIT 1`,
      [email]
    );
    if (byEmail[0]) return byEmail[0];
  }
  return {};
}

async function overlayVendorMasterOnPo(po) {
  if (!po) return po;
  const master = await lookupVendorMaster(po.vendorEmail, po.vendorName, {
    gst: po.vendorGst,
  });
  if (!master?.email && !master?.name && !master?.address) return po;
  return {
    ...po,
    vendorName: master.name || po.vendorName,
    vendorEmail: master.email || po.vendorEmail,
    vendorAddress: master.address || po.vendorAddress || '',
    vendorGst: master.gst_number || po.vendorGst || '',
    vendorPan: master.pan_number || po.vendorPan || '',
    vendorPhone: master.phone || po.vendorPhone || '',
  };
}

async function resolvePoDraftContent(prId, body) {
  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');

  let vendor;
  try {
    vendor = await getRecommendedVendor(prId);
  } catch (err) {
    const name = String(body?.vendorName || '').trim();
    const email = String(body?.vendorEmail || '').trim();
    if (!name) throw err;
    vendor = {
      vendor_name: name,
      vendor_email: email || `${name.replace(/\s+/g, '.').toLowerCase()}@imported.local`,
    };
  }
  if (body?.vendorName) {
    vendor = {
      ...vendor,
      vendor_name: String(body.vendorName).trim() || vendor.vendor_name,
      vendor_email: String(body.vendorEmail || '').trim() || vendor.vendor_email,
    };
  }
  const vendorMaster = await lookupVendorMaster(vendor.vendor_email, vendor.vendor_name);

  const {
    lineItems = [],
    deliveryAddress = '',
    expectedDeliveryDate = '',
    paymentTerms = 'Net 30 Days',
    incoterms = 'DDP',
    specialInstructions = '',
    gstPercentage = 18,
    poType = 'short_po',
    letterheadHeader,
    terms = [],
    annexure = [],
    annexureIiHtml = '',
    poNumber,
    poTermsDetails: bodyPoTermsDetails,
  } = body || {};
  const poDate = resolvePoDate(body?.poDate || body?.po_date);

  const resolvedPoTermsDetails = normalizePoTermsDetails(bodyPoTermsDetails);
  if (!resolvedPoTermsDetails.quoteNo) {
    resolvedPoTermsDetails.quoteNo = String(body?.quoteNo || body?.quote_no || '').trim();
  }
  if (!resolvedPoTermsDetails.quoteDate) {
    resolvedPoTermsDetails.quoteDate = String(body?.quoteDate || body?.quote_date || '').trim();
  }
  // Prefer free-text payment terms from Terms tab when provided
  const resolvedPaymentTerms =
    String(resolvedPoTermsDetails.paymentTermsText || '').trim() || paymentTerms;

  const resolvedPurchaseTypeEarly = normalizePurchaseType(body?.purchaseType || pr.purchaseType);
  const normalizedPoType = alignPoTypeWithPurchaseType(poType, resolvedPurchaseTypeEarly);
  let resolvedLetterhead = letterheadHeader ?? '';
  let resolvedLetterheadId = body?.letterheadId ? Number(body.letterheadId) : null;
  let resolvedEntity = body?.entity ?? '';
  let resolvedHeaderLogo = body?.headerLogo ?? '';
  let resolvedFooterLogo = body?.footerLogo ?? '';
  const termsPick = pickProvidedArray(body, 'terms', 'termsClauses');
  const annexurePick = pickProvidedArray(body, 'annexure', 'annexureClauses');
  let resolvedTerms = termsPick.provided ? termsPick.value : Array.isArray(terms) ? terms : [];
  let resolvedAnnexure = annexurePick.provided
    ? annexurePick.value
    : Array.isArray(annexure)
      ? annexure
      : [];
  const resolvedAnnexureIiHtml = serializeAnnexureIi(pickAnnexureIiSource(body, annexureIiHtml || ''));

  // Branding from selected Letterhead Master (entity + logos) for PO PDF.
  // Header and footer are common on the letterhead; location only affects GST/invoicing.
  try {
    if (resolvedLetterheadId) {
      const selected = await getLetterheadMasterById(resolvedLetterheadId);
      resolvedEntity = selected.entity || resolvedEntity || '';
      resolvedHeaderLogo = selected.headerLogo || '';
      resolvedFooterLogo =
        body?.footerLogo || selected.footerLogo || resolvedFooterLogo || '';
    } else {
      const branding = await getActiveLetterheadBranding();
      if (branding.id) resolvedLetterheadId = branding.id;
      resolvedEntity = branding.entity || resolvedEntity || '';
      resolvedHeaderLogo = branding.headerLogo || resolvedHeaderLogo || '';
      resolvedFooterLogo = body?.footerLogo || branding.footerLogo || resolvedFooterLogo || '';
    }
  } catch (err) {
    if (resolvedLetterheadId) throw err;
  }

  const skipMaster = Boolean(body?.skipLetterheadMaster);
  if (
    !skipMaster &&
    (!resolvedTerms.length || !resolvedAnnexure.length || !resolvedLetterhead)
  ) {
    try {
      const master = await getLetterheadByType(normalizedPoType);
      resolvedLetterhead = resolvedLetterhead || master.letterheadHeader || '';
      if (!termsPick.provided && !resolvedTerms.length) resolvedTerms = master.terms || [];
      if (!annexurePick.provided && !resolvedAnnexure.length) resolvedAnnexure = master.annexure || [];
    } catch {
      /* master optional when client already sent full content */
    }
  }

  const quoteMerged = mergeQuoteNoIntoPoContent(resolvedTerms, resolvedPoTermsDetails);
  resolvedTerms = quoteMerged.terms;
  Object.assign(resolvedPoTermsDetails, quoteMerged.poTermsDetails);

  const mappedLineItems = lineItems.map((item) => {
    const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage ?? item.tax_percentage ?? gstPercentage) || 0));
    const total = lineItemTotal(item.quantity, item.unitPrice);
    const unit = normalizeUnit(item.unit || item.uom);
    return {
      itemName: item.itemName || item.name || '',
      description: item.description,
      category: item.category || '',
      quantity: Number(item.quantity),
      unit,
      uom: unit,
      unitPrice: Number(item.unitPrice),
      discount: 0,
      taxPercentage,
      total,
      taxAmount: lineItemTax(total, taxPercentage),
    };
  });

  const subtotal = roundMoney(mappedLineItems.reduce((sum, item) => sum + item.total, 0));
  const taxAmount = roundMoney(mappedLineItems.reduce((sum, item) => sum + item.taxAmount, 0));
  const effectiveGst =
    subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : Number(gstPercentage) || 0;
  const grandTotal = roundMoney(subtotal + taxAmount);
  const resolvedCurrency = normalizeCurrency(body?.currency || pr.currency);
  const resolvedPurchaseType = normalizePurchaseType(body?.purchaseType || pr.purchaseType);

  return {
    poNumber: poNumber || `DRAFT-${pr.prNumber}`,
    createdAt: new Date(),
    prNumber: pr.prNumber,
    quoteNo: resolvedPoTermsDetails.quoteNo || '',
    quoteDate: resolvedPoTermsDetails.quoteDate || '',
    prTitle: pr.title,
    department: pr.department,
    requester: pr.requester,
    vendorName: vendorMaster.name || vendor.vendor_name,
    vendorEmail: vendorMaster.email || vendor.vendor_email,
    vendorAddress: vendorMaster.address || '',
    vendorGst: vendorMaster.gst_number || '',
    vendorPan: vendorMaster.pan_number || '',
    vendorPhone: vendorMaster.phone || '',
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms: resolvedPaymentTerms,
    incoterms,
    specialInstructions,
    poType: normalizedPoType,
    purchaseType: resolvedPurchaseType,
    purchaseTypeLabel: purchaseTypeLabel(resolvedPurchaseType),
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    annexureIiRows: parseAnnexureIi(resolvedAnnexureIiHtml),
    poTermsDetails: {
      ...resolvedPoTermsDetails,
      paymentTermsText:
        resolvedPoTermsDetails.paymentTermsText || resolvedPaymentTerms || '',
    },
    gstPercentage: effectiveGst,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
    lineItems: mappedLineItems,
  };
}

/** Build PO draft payload without a Purchase Request (manual create). */
export async function resolveManualPoDraftContent(body = {}, options = {}) {
  const forPreview = Boolean(options.forPreview);
  let vendorName = String(body.vendorName || '').trim();
  let vendorEmail = String(body.vendorEmail || '').trim();
  if (!vendorName) {
    if (forPreview) vendorName = 'Vendor Name';
    else throw new Error('Vendor name is required');
  }
  if (!vendorEmail) {
    if (forPreview) vendorEmail = 'vendor@example.com';
    else throw new Error('Vendor email is required');
  }

  const vendorMaster = await lookupVendorMaster(vendorEmail, vendorName);
  if (vendorMaster.email) vendorEmail = vendorMaster.email;
  if (vendorMaster.name) vendorName = vendorMaster.name;
  const {
    lineItems = [],
    deliveryAddress = '',
    expectedDeliveryDate = '',
    paymentTerms = 'Net 30 Days',
    incoterms = 'DDP',
    specialInstructions = '',
    gstPercentage = 18,
    poType = 'short_po',
    letterheadHeader,
    terms = [],
    annexure = [],
    annexureIiHtml = '',
    poNumber,
    poTermsDetails: bodyPoTermsDetails,
    title = '',
    department = '',
    requester = '',
  } = body;
  const poDate = resolvePoDate(body?.poDate || body?.po_date);

  const resolvedPoTermsDetails = normalizePoTermsDetails(bodyPoTermsDetails);
  if (!resolvedPoTermsDetails.quoteNo) {
    resolvedPoTermsDetails.quoteNo = String(body?.quoteNo || body?.quote_no || '').trim();
  }
  if (!resolvedPoTermsDetails.quoteDate) {
    resolvedPoTermsDetails.quoteDate = String(body?.quoteDate || body?.quote_date || '').trim();
  }
  const resolvedPaymentTerms =
    String(resolvedPoTermsDetails.paymentTermsText || '').trim() || paymentTerms;
  const resolvedPurchaseTypeEarly = normalizePurchaseType(body?.purchaseType);
  const normalizedPoType = alignPoTypeWithPurchaseType(poType, resolvedPurchaseTypeEarly);

  let resolvedLetterhead = letterheadHeader ?? '';
  let resolvedLetterheadId = body?.letterheadId ? Number(body.letterheadId) : null;
  let resolvedEntity = body?.entity ?? '';
  let resolvedHeaderLogo = body?.headerLogo ?? '';
  let resolvedFooterLogo = body?.footerLogo ?? '';
  const termsPick = pickProvidedArray(body, 'terms', 'termsClauses');
  const annexurePick = pickProvidedArray(body, 'annexure', 'annexureClauses');
  let resolvedTerms = termsPick.provided ? termsPick.value : Array.isArray(terms) ? terms : [];
  let resolvedAnnexure = annexurePick.provided
    ? annexurePick.value
    : Array.isArray(annexure)
      ? annexure
      : [];
  const resolvedAnnexureIiHtml = serializeAnnexureIi(pickAnnexureIiSource(body, annexureIiHtml || ''));

  try {
    if (resolvedLetterheadId) {
      const selected = await getLetterheadMasterById(resolvedLetterheadId);
      resolvedEntity = selected.entity || resolvedEntity || '';
      resolvedHeaderLogo = selected.headerLogo || '';
      resolvedFooterLogo = body?.footerLogo || selected.footerLogo || resolvedFooterLogo || '';
    } else {
      const branding = await getActiveLetterheadBranding();
      if (branding.id) resolvedLetterheadId = branding.id;
      resolvedEntity = branding.entity || resolvedEntity || '';
      resolvedHeaderLogo = branding.headerLogo || resolvedHeaderLogo || '';
      resolvedFooterLogo = body?.footerLogo || branding.footerLogo || resolvedFooterLogo || '';
    }
  } catch (err) {
    if (resolvedLetterheadId) throw err;
  }

  const skipMaster = Boolean(body?.skipLetterheadMaster);
  if (
    !skipMaster &&
    (!resolvedTerms.length || !resolvedAnnexure.length || !resolvedLetterhead)
  ) {
    try {
      const master = await getLetterheadByType(normalizedPoType);
      resolvedLetterhead = resolvedLetterhead || master.letterheadHeader || '';
      if (!termsPick.provided && !resolvedTerms.length) resolvedTerms = master.terms || [];
      if (!annexurePick.provided && !resolvedAnnexure.length) resolvedAnnexure = master.annexure || [];
    } catch {
      /* optional */
    }
  }

  const quoteMerged = mergeQuoteNoIntoPoContent(resolvedTerms, resolvedPoTermsDetails);
  resolvedTerms = quoteMerged.terms;
  Object.assign(resolvedPoTermsDetails, quoteMerged.poTermsDetails);

  const mappedLineItems = lineItems.map((item) => {
    const taxPercentage = Math.min(
      100,
      Math.max(0, Number(item.taxPercentage ?? item.tax_percentage ?? gstPercentage) || 0)
    );
    const total = lineItemTotal(item.quantity, item.unitPrice);
    const unit = normalizeUnit(item.unit || item.uom);
    return {
      itemName: item.itemName || item.name || '',
      description: item.description,
      category: item.category || '',
      quantity: Number(item.quantity),
      unit,
      uom: unit,
      unitPrice: Number(item.unitPrice),
      discount: 0,
      taxPercentage,
      total,
      taxAmount: lineItemTax(total, taxPercentage),
    };
  });

  const subtotal = roundMoney(mappedLineItems.reduce((sum, item) => sum + item.total, 0));
  const taxAmount = roundMoney(mappedLineItems.reduce((sum, item) => sum + item.taxAmount, 0));
  const effectiveGst =
    subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : Number(gstPercentage) || 0;
  const grandTotal = roundMoney(subtotal + taxAmount);
  const resolvedCurrency = normalizeCurrency(body?.currency);
  const resolvedPurchaseType = normalizePurchaseType(body?.purchaseType);
  const subject = String(resolvedPoTermsDetails.subject || title || '').trim();

  return {
    poNumber: poNumber || 'DRAFT-MANUAL',
    createdAt: new Date(),
    prNumber: String(body.prNumber || body.pr_number || '').trim(),
    quoteNo: resolvedPoTermsDetails.quoteNo || '',
    quoteDate: resolvedPoTermsDetails.quoteDate || '',
    prTitle: subject || 'Manual Purchase Order',
    department: String(department || '').trim(),
    requester: String(requester || '').trim() || 'SCM Buyer',
    vendorName,
    vendorEmail,
    vendorAddress: vendorMaster.address || '',
    vendorGst: vendorMaster.gst_number || '',
    vendorPan: vendorMaster.pan_number || '',
    vendorPhone: vendorMaster.phone || '',
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms: resolvedPaymentTerms,
    incoterms,
    specialInstructions,
    poType: normalizedPoType,
    purchaseType: resolvedPurchaseType,
    purchaseTypeLabel: purchaseTypeLabel(resolvedPurchaseType),
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    annexureIiRows: parseAnnexureIi(resolvedAnnexureIiHtml),
    poTermsDetails: {
      ...resolvedPoTermsDetails,
      subject: subject || resolvedPoTermsDetails.subject || '',
      paymentTermsText:
        resolvedPoTermsDetails.paymentTermsText || resolvedPaymentTerms || '',
    },
    gstPercentage: effectiveGst,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
    lineItems: mappedLineItems,
  };
}

export async function buildPoPreviewDocument(user, prId, body) {
  if (user.role !== 'SCM Buyer' && user.role !== 'SCM Manager') {
    throw new Error('Unauthorized to preview purchase orders');
  }
  if (!body?.lineItems?.length) throw new Error('At least one line item is required for preview');
  return overlayVendorMasterOnPo(await resolvePoDraftContent(prId, body));
}

export async function buildPoPreviewForPo(user, poId, body) {
  if (user.role !== 'SCM Manager' && user.role !== 'SCM Buyer') {
    throw new Error('Unauthorized to preview PO edits');
  }
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (!body?.lineItems?.length) throw new Error('At least one line item is required for preview');
  if (!rows[0].pr_id) {
    return attachStoredPoSignature(
      await overlayVendorMasterOnPo(
        await resolveManualPoDraftContent({
          ...body,
          poNumber: normalizeRequestedPoNumber(body.poNumber) || rows[0].po_number,
          vendorName: body.vendorName || rows[0].vendor_name,
          vendorEmail: body.vendorEmail || rows[0].vendor_email,
          poDate: body.poDate || body.po_date || formatDate(rows[0].po_date) || formatDate(rows[0].created_at),
          terms: body.terms ?? body.termsClauses,
          annexure: body.annexure ?? body.annexureClauses,
          annexureIiHtml: body.annexureIiHtml ?? rows[0].annexure_ii_html ?? '',
          annexureIiRows: body.annexureIiRows ?? parseAnnexureIi(body.annexureIiHtml ?? rows[0].annexure_ii_html),
        })
      ),
      rows[0]
    );
  }
  return attachStoredPoSignature(
    await overlayVendorMasterOnPo(
      await resolvePoDraftContent(rows[0].pr_id, {
        ...body,
        poNumber: normalizeRequestedPoNumber(body.poNumber) || rows[0].po_number,
        poDate: body.poDate || body.po_date || formatDate(rows[0].po_date) || formatDate(rows[0].created_at),
        terms: body.terms ?? body.termsClauses,
        annexure: body.annexure ?? body.annexureClauses,
        annexureIiHtml: body.annexureIiHtml ?? rows[0].annexure_ii_html ?? '',
        annexureIiRows: body.annexureIiRows ?? parseAnnexureIi(body.annexureIiHtml ?? rows[0].annexure_ii_html),
      })
    ),
    rows[0]
  );
}

export async function createPurchaseOrder(user, prId, body) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can create purchase orders');

  const pr = await getPurchaseRequestById(prId);
  if (!pr) throw new Error('PR not found');

  const [existing] = await pool.query(
    `SELECT id FROM purchase_orders WHERE pr_id = ? AND status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')`,
    [prId]
  );
  if (existing.length) throw new Error('A purchase order already exists for this PR');

  // Old / historical PO import: create only — no manager approval workflow
  const skipApproval = Boolean(body?.skipApproval || body?.legacyImport || body?.oldPoImport);
  const requestedPoNumber = normalizeRequestedPoNumber(body?.poNumber || body?.existingPoNumber);
  const bodyVendorName = String(body?.vendorName || '').trim();
  const bodyVendorEmail = String(body?.vendorEmail || '').trim();

  let vendor;
  try {
    vendor = await getRecommendedVendor(prId);
  } catch (err) {
    if (!skipApproval || !bodyVendorName) throw err;
    vendor = {
      id: null,
      vendor_name: bodyVendorName,
      vendor_email: bodyVendorEmail || `${bodyVendorName.replace(/\s+/g, '.').toLowerCase()}@imported.local`,
    };
  }
  if (skipApproval && bodyVendorName) {
    vendor = {
      ...vendor,
      vendor_name: bodyVendorName,
      vendor_email: bodyVendorEmail || vendor.vendor_email,
    };
  }

  const draft = await resolvePoDraftContent(prId, body);
  const {
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType: normalizedPoType,
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    poTermsDetails: resolvedPoTermsDetails,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
  } = draft;

  if (!lineItems.length) throw new Error('At least one line item is required');
  if (!deliveryAddress?.trim()) throw new Error('Delivery address is required');
  if (!expectedDeliveryDate) throw new Error('Expected delivery date is required');

  const entityIdForNumber = Number(pr.entityId || body.entityId || 0);
  if (!entityIdForNumber) {
    throw new Error('PR has no entity. Set entity on the PR before creating a PO.');
  }

  const purchaseType = normalizePurchaseType(body.purchaseType || pr.purchaseType);
  const docLabel = purchaseTypeLabel(purchaseType);

  const referencePoNumber = body.referencePoNumber?.trim() || null;
  const initialStatus = skipApproval ? 'approved' : 'pending_approval';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const poNumber = await resolvePersistedPoNumber({
      requested: requestedPoNumber,
      existingNumber: null,
      entityId: entityIdForNumber,
      purchaseType,
      excludeId: null,
      connection: conn,
      docLabel,
    });

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
        delivery_address, expected_delivery_date, po_date, payment_terms, incoterms, special_instructions,
        po_type, purchase_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
        annexure_ii_html, po_terms_details, gst_percentage, currency, subtotal, tax_amount, grand_total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        referencePoNumber,
        prId,
        vendor.vendor_name,
        vendor.vendor_email,
        vendor.id || null,
        user.id,
        deliveryAddress,
        expectedDeliveryDate,
        poDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        normalizedPoType,
        purchaseType,
        resolvedLetterhead,
        resolvedLetterheadId || null,
        entityIdForNumber,
        resolvedEntity || '',
        resolvedHeaderLogo || '',
        resolvedFooterLogo || '',
        JSON.stringify(resolvedTerms),
        JSON.stringify(resolvedAnnexure),
        resolvedAnnexureIiHtml || '',
        JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
        gstPercentage,
        resolvedCurrency || 'INR',
        subtotal,
        taxAmount,
        grandTotal,
        initialStatus,
      ]
    );

    const poId = result.insertId;
    for (const item of lineItems) {
      const total = lineItemTotal(item.quantity, item.unitPrice);
      const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage) || 0));
      const itemName = String(item.itemName || item.name || '').trim();
      const description = String(item.description || itemName || '').trim() || '(no description)';
      await conn.query(
        `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit, unit_price, discount, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, '', itemName || null, description, item.quantity, normalizeUnit(item.unit || item.uom), item.unitPrice, 0, taxPercentage, total]
      );
    }

    if (!skipApproval) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      await insertScmManagerPoApprovalTask(conn, prId, dueDate.toISOString().split('T')[0]);
    }

    // Complete SCM Create PO step and mark PR as PO created
    await conn.query(
      `UPDATE purchase_requests
       SET status = 'APPROVED', current_stage = 'PO_CREATED', updated_at = NOW()
       WHERE id = ?`,
      [prId]
    );
    await conn.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ? AND task_type = 'RFQ_POST_APPROVAL'
         AND assigned_role = 'SCM Buyer' AND status = 'pending'`,
      [prId]
    );

    await conn.commit();

    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_CREATED', ?, 'created', ?)`,
      [
        prId,
        user.id,
        skipApproval
          ? `Legacy/old PO ${poNumber} imported — created only (no approval workflow)`
          : `PO ${poNumber} created and sent for SCM Manager approval`,
      ]
    );

    const [poRows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
    const po = await enrichPO(poRows[0]);
    const { fileName } = await generatePoPdf(po, { fileName: `${poNumber}_draft.pdf` });
    await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, poId]);
    po.pdfPath = fileName;

    if (!skipApproval) {
      const managers = await resolveRoleEmails('SCM Manager');
      queuePoWorkflowNotification(po, {
        action: 'assign',
        stageLabel: 'SCM Manager PO Approval',
        recipientEmails: managers.map((m) => m.email),
        recipientName: managers[0]?.name || 'SCM Manager',
        actorName: user.name,
        actorRole: user.role,
        remarks: `PO ${poNumber} created and sent for approval`,
        portalUrl: poPortalUrl('/scm/po-approval'),
        ctaLabel: 'Open PO Approval',
      });
    }

    return po;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Create PO / WO with no Purchase Request reference. */
export async function createManualPurchaseOrder(user, body = {}) {
  if (user.role !== 'SCM Buyer' && user.role !== 'Super Admin') {
    throw new Error('Only SCM Buyer can create purchase orders');
  }

  const skipApproval = Boolean(body?.skipApproval || body?.legacyImport || body?.oldPoImport);
  const draft = await resolveManualPoDraftContent(body);
  const {
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType: normalizedPoType,
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    poTermsDetails: resolvedPoTermsDetails,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
    vendorName,
    vendorEmail,
  } = draft;

  if (!lineItems.length) throw new Error('At least one line item is required');
  if (!deliveryAddress?.trim()) throw new Error('Delivery address is required');
  if (!expectedDeliveryDate) throw new Error('Expected delivery date is required');

  const entityIdForNumber = await resolveEntityIdFromPoBody(body);
  if (!entityIdForNumber) {
    throw new Error('Select a letterhead entity to generate the PO / WO number');
  }

  const purchaseType = normalizePurchaseType(body.purchaseType || 'purchase_order');
  const docLabel = purchaseTypeLabel(purchaseType);
  const referencePoNumber = body.referencePoNumber?.trim() || null;
  const requestedPoNumber = normalizeRequestedPoNumber(body?.poNumber || body?.existingPoNumber);
  const initialStatus = skipApproval ? 'approved' : 'pending_approval';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const poNumber = await resolvePersistedPoNumber({
      requested: requestedPoNumber,
      existingNumber: null,
      entityId: entityIdForNumber,
      purchaseType,
      excludeId: null,
      connection: conn,
      docLabel,
    });

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
        delivery_address, expected_delivery_date, po_date, payment_terms, incoterms, special_instructions,
        po_type, purchase_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
        annexure_ii_html, po_terms_details, gst_percentage, currency, subtotal, tax_amount, grand_total, status)
       VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poNumber,
        referencePoNumber,
        vendorName,
        vendorEmail,
        user.id,
        deliveryAddress,
        expectedDeliveryDate,
        poDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        normalizedPoType,
        purchaseType,
        resolvedLetterhead,
        resolvedLetterheadId || null,
        entityIdForNumber,
        resolvedEntity || '',
        resolvedHeaderLogo || '',
        resolvedFooterLogo || '',
        JSON.stringify(resolvedTerms),
        JSON.stringify(resolvedAnnexure),
        resolvedAnnexureIiHtml || '',
        JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
        gstPercentage,
        resolvedCurrency || 'INR',
        subtotal,
        taxAmount,
        grandTotal,
        initialStatus,
      ]
    );

    const poId = result.insertId;
    for (const item of lineItems) {
      const total = lineItemTotal(item.quantity, item.unitPrice);
      const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage) || 0));
      const itemName = String(item.itemName || item.name || '').trim();
      const description = String(item.description || itemName || '').trim() || '(no description)';
      await conn.query(
        `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit, unit_price, discount, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          poId,
          '',
          itemName || null,
          description,
          item.quantity,
          normalizeUnit(item.unit || item.uom),
          item.unitPrice,
          0,
          taxPercentage,
          total,
        ]
      );
    }

    await conn.commit();

    const [poRows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
    const po = await enrichPO(poRows[0]);
    const { fileName } = await generatePoPdf(po, { fileName: `${poNumber}_draft.pdf` });
    await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, poId]);
    po.pdfPath = fileName;

    if (!skipApproval) {
      const managers = await resolveRoleEmails('SCM Manager');
      queuePoWorkflowNotification(po, {
        action: 'assign',
        stageLabel: 'SCM Manager PO Approval',
        recipientEmails: managers.map((m) => m.email),
        recipientName: managers[0]?.name || 'SCM Manager',
        actorName: user.name,
        actorRole: user.role,
        remarks: `Manual ${docLabel} ${poNumber} created (no PR) and sent for approval`,
        portalUrl: poPortalUrl('/scm/po-approval'),
        ctaLabel: 'Open PO Approval',
      });
    }

    return po;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function buildManualPoPreviewDocument(user, body) {
  if (user.role !== 'SCM Buyer' && user.role !== 'SCM Manager' && user.role !== 'Super Admin') {
    throw new Error('Unauthorized to preview purchase orders');
  }
  const payload = { ...(body || {}) };
  // Preview should render even while the form is incomplete
  if (!Array.isArray(payload.lineItems) || !payload.lineItems.length) {
    payload.lineItems = [
      {
        itemName: 'Sample item',
        description: 'Add line items on the PO Details tab',
        quantity: 1,
        unitPrice: 0,
        taxPercentage: 18,
        unit: 'Nos',
      },
    ];
  }
  if (!String(payload.deliveryAddress || '').trim()) {
    payload.deliveryAddress = 'Site / delivery address';
  }
  if (!payload.expectedDeliveryDate) {
    payload.expectedDeliveryDate = new Date().toISOString().slice(0, 10);
  }
  return overlayVendorMasterOnPo(await resolveManualPoDraftContent(payload, { forPreview: true }));
}

function normalizeDraftSaveBody(body = {}) {
  const payload = { ...body };
  if (!Array.isArray(payload.lineItems) || !payload.lineItems.length) {
    payload.lineItems = [
      {
        itemName: 'Draft item',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercentage: payload.gstPercentage ?? 18,
        unit: 'Nos',
      },
    ];
  }
  const site = String(payload.poTermsDetails?.siteAddress || payload.deliveryAddress || '').trim();
  if (!site) payload.deliveryAddress = 'TBD';
  if (!payload.expectedDeliveryDate) {
    payload.expectedDeliveryDate = new Date().toISOString().slice(0, 10);
  }
  if (!payload.poDate && !payload.po_date) {
    payload.poDate = todayYmd();
  }
  return payload;
}

async function resolveDraftSaveContent({ prId, existing, body }) {
  const payload = normalizeDraftSaveBody({ ...body, skipLetterheadMaster: true });
  const effectivePrId = existing?.pr_id || prId;
  let draft;
  if (effectivePrId) {
    let vendor;
    try {
      vendor = await getRecommendedVendor(effectivePrId);
    } catch {
      vendor = {
        vendor_name: String(payload.vendorName || existing?.vendor_name || 'Vendor Name').trim(),
        vendor_email: String(payload.vendorEmail || existing?.vendor_email || 'vendor@example.com').trim(),
        id: null,
      };
    }
    if (payload.vendorName) {
      vendor = {
        ...vendor,
        vendor_name: String(payload.vendorName).trim() || vendor.vendor_name,
        vendor_email: String(payload.vendorEmail || '').trim() || vendor.vendor_email,
      };
    }
    draft = await resolvePoDraftContent(effectivePrId, {
      ...payload,
      skipLetterheadMaster: true,
      poNumber: normalizeRequestedPoNumber(payload.poNumber) || existing?.po_number || null,
      vendorName: vendor.vendor_name,
      vendorEmail: vendor.vendor_email,
      poDate: payload.poDate || payload.po_date || formatDate(existing?.po_date) || formatDate(existing?.created_at),
    });
    draft = {
      ...draft,
      vendorName: vendor.vendor_name,
      vendorEmail: vendor.vendor_email,
      rfqInvitationId: vendor.id || null,
    };
  } else {
    const needsPreviewVendor =
      !String(payload.vendorName || existing?.vendor_name || '').trim() ||
      !String(payload.vendorEmail || existing?.vendor_email || '').trim();
    draft = await resolveManualPoDraftContent(
      {
        ...payload,
        skipLetterheadMaster: true,
        poNumber: normalizeRequestedPoNumber(payload.poNumber) || existing?.po_number || null,
        vendorName: payload.vendorName || existing?.vendor_name,
        vendorEmail: payload.vendorEmail || existing?.vendor_email,
        poDate: payload.poDate || payload.po_date || formatDate(existing?.po_date) || formatDate(existing?.created_at),
      },
      { forPreview: needsPreviewVendor }
    );
  }

  // Persist exactly what the user sent — never rehydrate Type Master clauses on draft save
  const termsPick = pickProvidedArray(payload, 'terms', 'termsClauses');
  const annexurePick = pickProvidedArray(payload, 'annexure', 'annexureClauses');
  if (termsPick.provided) {
    const quoteMerged = mergeQuoteNoIntoPoContent(termsPick.value, draft.poTermsDetails || {});
    draft.termsClauses = quoteMerged.terms;
    draft.poTermsDetails = { ...draft.poTermsDetails, ...quoteMerged.poTermsDetails };
  }
  if (annexurePick.provided) {
    draft.annexureClauses = annexurePick.value;
  }
  if (Array.isArray(payload.lineItems)) {
    draft.lineItems = payload.lineItems.map((item) => {
      const taxPercentage = Math.min(
        100,
        Math.max(0, Number(item.taxPercentage ?? item.tax_percentage ?? payload.gstPercentage) || 0)
      );
      const total = lineItemTotal(item.quantity, item.unitPrice);
      const unit = normalizeUnit(item.unit || item.uom);
      return {
        itemName: item.itemName || item.name || '',
        description: item.description,
        category: item.category || '',
        quantity: Number(item.quantity),
        unit,
        uom: unit,
        unitPrice: Number(item.unitPrice),
        discount: 0,
        taxPercentage,
        total,
        taxAmount: lineItemTax(total, taxPercentage),
      };
    });
    const subtotal = roundMoney(draft.lineItems.reduce((sum, item) => sum + item.total, 0));
    const taxAmount = roundMoney(draft.lineItems.reduce((sum, item) => sum + item.taxAmount, 0));
    draft.subtotal = subtotal;
    draft.taxAmount = taxAmount;
    draft.grandTotal = roundMoney(subtotal + taxAmount);
  }
  if (
    Array.isArray(payload.annexureIiRows) ||
    Object.prototype.hasOwnProperty.call(payload, 'annexureIiHtml') ||
    Object.prototype.hasOwnProperty.call(payload, 'annexure_ii_html')
  ) {
    const html = serializeAnnexureIi(pickAnnexureIiSource(payload, ''));
    draft.annexureIiHtml = html;
    draft.annexureIiRows = parseAnnexureIi(html);
  }
  return draft;
}

async function persistDraftLineItems(conn, poId, lineItems) {
  await conn.query(`DELETE FROM po_line_items WHERE po_id = ?`, [poId]);
  for (const item of lineItems) {
    const total = lineItemTotal(item.quantity, item.unitPrice);
    const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage) || 0));
    const itemName = String(item.itemName || item.name || '').trim();
    const description = String(item.description || itemName || '').trim() || '(draft)';
    await conn.query(
      `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit, unit_price, discount, tax_percentage, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        poId,
        '',
        itemName || null,
        description,
        item.quantity,
        normalizeUnit(item.unit || item.uom),
        item.unitPrice,
        0,
        taxPercentage,
        total,
      ]
    );
  }
}

/** Save or update a draft PO / WO (PR-linked or manual). */
export async function savePurchaseOrderDraft(user, body = {}) {
  if (user.role !== 'SCM Buyer' && user.role !== 'Super Admin') {
    throw new Error('Only SCM Buyer can save PO drafts');
  }

  const poId = Number(body.poId || body.id || 0) || null;
  const prId = Number(body.prId || 0) || null;

  let existing = null;
  if (poId) {
    const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
    existing = rows[0] || null;
    if (!existing) throw new Error('PO not found');
    if (existing.status !== 'draft') throw new Error('Only draft POs can be saved with Save Draft');
    if (user.role === 'SCM Buyer' && existing.created_by !== user.id && !canEditAnyScmPurchaseOrder(user)) {
      throw new Error('You can only edit your own draft POs');
    }
  } else if (prId) {
    const [active] = await pool.query(
      `SELECT id FROM purchase_orders WHERE pr_id = ? AND status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor') LIMIT 1`,
      [prId]
    );
    if (active.length) throw new Error('A purchase order already exists for this PR');

    if (canEditAnyScmPurchaseOrder(user)) {
      const [draftRows] = await pool.query(
        `SELECT * FROM purchase_orders WHERE pr_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1`,
        [prId]
      );
      existing = draftRows[0] || null;
    } else {
      const [draftRows] = await pool.query(
        `SELECT * FROM purchase_orders WHERE pr_id = ? AND status = 'draft' AND created_by = ? ORDER BY id DESC LIMIT 1`,
        [prId, user.id]
      );
      existing = draftRows[0] || null;
    }
  }

  const isManual = !existing?.pr_id && !prId;
  const entityIdForNumber = await resolveEntityIdFromPoBody(body, existing);
  if (isManual && !entityIdForNumber) {
    throw new Error('Select a letterhead entity before saving a manual PO draft');
  }

  const resolved = await resolveDraftSaveContent({ prId, existing, body });
  const {
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType: normalizedPoType,
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    poTermsDetails: resolvedPoTermsDetails,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
    vendorName,
    vendorEmail,
    rfqInvitationId,
  } = resolved;

  const purchaseType = normalizePurchaseType(
    body.purchaseType || existing?.purchase_type || 'purchase_order'
  );
  const referencePoNumber =
    body.referencePoNumber !== undefined
      ? body.referencePoNumber?.trim() || null
      : existing?.reference_po_number || null;

  const conn = await pool.getConnection();
  let savedPoId = existing?.id || null;
  try {
    await conn.beginTransaction();

    const docLabel = purchaseTypeLabel(purchaseType);
    let poNumber = existing?.po_number || null;

    if (existing) {
      poNumber = await resolvePersistedPoNumber({
        requested: body.poNumber || body.existingPoNumber,
        existingNumber: existing.po_number,
        entityId: entityIdForNumber || existing.entity_id,
        purchaseType,
        excludeId: existing.id,
        connection: conn,
        docLabel,
      });
      await conn.query(
        `UPDATE purchase_orders SET
          po_number = ?,
          reference_po_number = ?,
          vendor_name = ?, vendor_email = ?,
          delivery_address = ?, expected_delivery_date = ?, po_date = ?, payment_terms = ?, incoterms = ?,
          special_instructions = ?, po_type = ?, purchase_type = ?, letterhead_header = ?, letterhead_id = ?, entity_id = ?, entity = ?,
          header_logo = ?, footer_logo = ?, terms_clauses = ?, annexure_clauses = ?, annexure_ii_html = ?,
          po_terms_details = ?, gst_percentage = ?, currency = ?, subtotal = ?, tax_amount = ?, grand_total = ?,
          status = 'draft', updated_at = NOW()
         WHERE id = ?`,
        [
          poNumber,
          referencePoNumber,
          vendorName,
          vendorEmail,
          deliveryAddress,
          expectedDeliveryDate,
          poDate,
          paymentTerms,
          incoterms,
          specialInstructions,
          normalizedPoType,
          purchaseType,
          resolvedLetterhead,
          resolvedLetterheadId || null,
          entityIdForNumber || existing.entity_id,
          resolvedEntity || '',
          resolvedHeaderLogo || '',
          resolvedFooterLogo || '',
          JSON.stringify(resolvedTerms),
          JSON.stringify(resolvedAnnexure),
          resolvedAnnexureIiHtml || '',
          JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
          gstPercentage,
          resolvedCurrency || 'INR',
          subtotal,
          taxAmount,
          grandTotal,
          savedPoId,
        ]
      );
      await persistDraftLineItems(conn, savedPoId, lineItems);
    } else if (prId) {
      const pr = await getPurchaseRequestById(prId);
      if (!pr) throw new Error('PR not found');
      const prEntityId = Number(pr.entityId || body.entityId || 0);
      if (!prEntityId) throw new Error('PR has no entity. Set entity on the PR before saving a draft.');

      poNumber = await resolvePersistedPoNumber({
        requested: body.poNumber || body.existingPoNumber,
        existingNumber: null,
        entityId: prEntityId,
        purchaseType,
        excludeId: null,
        connection: conn,
        docLabel,
      });
      const [result] = await conn.query(
        `INSERT INTO purchase_orders
         (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
          delivery_address, expected_delivery_date, po_date, payment_terms, incoterms, special_instructions,
          po_type, purchase_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
          annexure_ii_html, po_terms_details, gst_percentage, currency, subtotal, tax_amount, grand_total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [
          poNumber,
          referencePoNumber,
          prId,
          vendorName,
          vendorEmail,
          rfqInvitationId || null,
          user.id,
          deliveryAddress,
          expectedDeliveryDate,
          poDate,
          paymentTerms,
          incoterms,
          specialInstructions,
          normalizedPoType,
          purchaseType,
          resolvedLetterhead,
          resolvedLetterheadId || null,
          prEntityId,
          resolvedEntity || '',
          resolvedHeaderLogo || '',
          resolvedFooterLogo || '',
          JSON.stringify(resolvedTerms),
          JSON.stringify(resolvedAnnexure),
          resolvedAnnexureIiHtml || '',
          JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
          gstPercentage,
          resolvedCurrency || 'INR',
          subtotal,
          taxAmount,
          grandTotal,
        ]
      );
      savedPoId = result.insertId;
      await persistDraftLineItems(conn, savedPoId, lineItems);
    } else {
      poNumber = await resolvePersistedPoNumber({
        requested: body.poNumber || body.existingPoNumber,
        existingNumber: null,
        entityId: entityIdForNumber,
        purchaseType,
        excludeId: null,
        connection: conn,
        docLabel,
      });
      const [result] = await conn.query(
        `INSERT INTO purchase_orders
         (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
          delivery_address, expected_delivery_date, po_date, payment_terms, incoterms, special_instructions,
          po_type, purchase_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
          annexure_ii_html, po_terms_details, gst_percentage, currency, subtotal, tax_amount, grand_total, status)
         VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
        [
          poNumber,
          referencePoNumber,
          vendorName,
          vendorEmail,
          user.id,
          deliveryAddress,
          expectedDeliveryDate,
          poDate,
          paymentTerms,
          incoterms,
          specialInstructions,
          normalizedPoType,
          purchaseType,
          resolvedLetterhead,
          resolvedLetterheadId || null,
          entityIdForNumber,
          resolvedEntity || '',
          resolvedHeaderLogo || '',
          resolvedFooterLogo || '',
          JSON.stringify(resolvedTerms),
          JSON.stringify(resolvedAnnexure),
          resolvedAnnexureIiHtml || '',
          JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
          gstPercentage,
          resolvedCurrency || 'INR',
          subtotal,
          taxAmount,
          grandTotal,
        ]
      );
      savedPoId = result.insertId;
      await persistDraftLineItems(conn, savedPoId, lineItems);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const po = await getPurchaseOrderById(savedPoId);
  try {
    const { fileName } = await generatePoPdf(po, { fileName: `${po.poNumber}_draft.pdf` });
    await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, savedPoId]);
    po.pdfPath = fileName;
  } catch {
    /* draft PDF optional while form is incomplete */
  }
  return po;
}

export async function listPurchaseOrders(
  user,
  { pendingOnly = false, buyerVerifyOnly = false, approvalQueue = false } = {}
) {
  let sql = `SELECT po.* FROM purchase_orders po WHERE 1=1`;
  const params = [];

  if (buyerVerifyOnly) {
    sql += ` AND po.status = 'pending_buyer_verify'`;
  } else if (approvalQueue || (user.role === 'SCM Manager' && pendingOnly)) {
    // Manager PO Sign & Approve: workflow POs only (exclude imported/draft noise)
    if (pendingOnly) {
      sql += ` AND po.status = 'pending_approval'`;
    } else {
      sql += ` AND po.status IN (
        'pending_approval',
        'pending_buyer_verify',
        'approved',
        'rejected',
        'sent_to_vendor'
      )`;
    }
  } else if (user.role === 'SCM Buyer' && !canEditAnyScmPurchaseOrder(user)) {
    sql += ` AND po.created_by = ?`;
    params.push(user.id);
  }

  sql += ` ORDER BY
    CASE po.status
      WHEN 'pending_approval' THEN 0
      WHEN 'pending_buyer_verify' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
      WHEN 'sent_to_vendor' THEN 4
      ELSE 5
    END,
    po.created_at DESC`;
  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPO));
}

function mapTrackPoStatus(statusRaw) {
  const s = String(statusRaw || '').toLowerCase();
  if (s === 'pending_approval') return { status: 'pending', statusLabel: 'Pending Approval' };
  if (s === 'pending_buyer_verify') return { status: 'pending', statusLabel: 'Pending Buyer Verify' };
  if (s === 'invoice_entry') return { status: 'invoice', statusLabel: 'Invoice Entry' };
  if (s === 'pending_accounts_approval') return { status: 'invoice', statusLabel: 'Pending Accounts Approval' };
  if (s === 'approved_for_payment') return { status: 'payment', statusLabel: 'Approved for Payment' };
  if (s === 'paid') return { status: 'paid', statusLabel: 'Paid' };
  if (s === 'awaiting_grn' || s === 'grn_completed') return { status: 'grn', statusLabel: s === 'paid' ? 'Paid' : 'GRN' };
  if (s === 'rejected') return { status: 'rejected', statusLabel: 'Rejected' };
  if (s === 'sent_to_vendor') return { status: 'sent', statusLabel: 'Pending Vendor Acceptance' };
  if (s === 'approved') return { status: 'approved', statusLabel: 'PO Approved' };
  if (s === 'imported') return { status: 'imported', statusLabel: 'Imported' };
  if (s === 'draft') return { status: 'draft', statusLabel: 'Draft' };
  if (s === 'cancelled') return { status: 'cancelled', statusLabel: 'Cancelled' };
  return { status: s || 'unknown', statusLabel: statusRaw || 'Unknown' };
}

/**
 * Paginated Track PO feed: Ready-for-PO PRs + purchase orders.
 * Query: page, limit, search, status (all|ready|pending|approved|rejected|sent|imported|draft|cancelled)
 * Uses indexed filters; stats use separate COUNT queries (no triple UNION scan).
 */
export async function listTrackPurchaseOrders(
  user,
  {
    page = 1,
    limit = 10,
    search = '',
    status = 'all',
    purchaseType = 'all',
    entityId,
    department,
    category,
    dateFrom,
    dateTo,
  } = {}
) {
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));
  const pageNum = Math.max(1, Number(page) || 1);
  const q = String(search || '').trim().toLowerCase();
  const statusFilter = String(status || 'all').toLowerCase();
  const typeFilter = String(purchaseType || 'all').toLowerCase().replace(/[\s-]+/g, '_');
  const typeSqlValue =
    typeFilter === 'work_order' || typeFilter === 'wo'
      ? 'work_order'
      : typeFilter === 'purchase_order' || typeFilter === 'po'
        ? 'purchase_order'
        : null;
  const entityFilter = Number(entityId) || 0;
  const deptFilter = String(department || '').trim();
  const categoryFilter = String(category || '').trim();
  const fromDate = String(dateFrom || '').trim();
  const toDate = String(dateTo || '').trim();

  const readyParams = [PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED];
  const poParams = [];

  const includeReady =
    statusFilter === 'all' || statusFilter === 'ready';
  const includePo =
    statusFilter !== 'ready' &&
    (statusFilter === 'all' ||
      ['pending', 'approved', 'rejected', 'sent', 'imported', 'draft', 'cancelled'].includes(statusFilter));

  const readyTypeFilter = typeSqlValue
    ? ` AND COALESCE(pr.purchase_type, 'purchase_order') = ?`
    : '';
  const poTypeFilter = typeSqlValue
    ? ` AND COALESCE(po.purchase_type, pr.purchase_type, 'purchase_order') = ?`
    : '';
  const readyEntityFilter = entityFilter ? ` AND pr.entity_id = ?` : '';
  const poEntityFilter = entityFilter ? ` AND COALESCE(po.entity_id, pr.entity_id) = ?` : '';
  const readyDeptFilter = deptFilter ? ` AND d.name = ?` : '';
  const poDeptFilter = deptFilter ? ` AND d.name = ?` : '';
  const readyCatFilter = categoryFilter
    ? ` AND EXISTS (SELECT 1 FROM pr_line_items pli WHERE pli.pr_id = pr.id AND pli.category = ?)`
    : '';
  const poCatFilter = categoryFilter
    ? ` AND (
          EXISTS (SELECT 1 FROM po_line_items pli WHERE pli.po_id = po.id AND pli.category = ?)
          OR EXISTS (SELECT 1 FROM pr_line_items pli2 WHERE pli2.pr_id = po.pr_id AND pli2.category = ?)
        )`
    : '';

  const readySql = `
    SELECT
      CONCAT('ready-', pr.id) COLLATE utf8mb4_unicode_ci AS row_key,
      'ready' COLLATE utf8mb4_unicode_ci AS kind,
      pr.id AS pr_id,
      CAST(NULL AS SIGNED) AS po_id,
      pr.pr_number COLLATE utf8mb4_unicode_ci AS pr_number,
      CAST('' AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS po_number,
      pr.title COLLATE utf8mb4_unicode_ci AS title,
      d.name COLLATE utf8mb4_unicode_ci AS department,
      u.name COLLATE utf8mb4_unicode_ci AS requester,
      COALESCE((
        SELECT ri.vendor_name
        FROM rfq_configs rc
        JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
        WHERE rc.pr_id = pr.id
        LIMIT 1
      ), '') COLLATE utf8mb4_unicode_ci AS vendor_name,
      pr.total_amount AS amount,
      'ready' COLLATE utf8mb4_unicode_ci AS status_raw,
      CAST(COALESCE(pr.purchase_type, 'purchase_order') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS purchase_type,
      pr.entity_id AS entity_id,
      COALESCE(e.name, '') COLLATE utf8mb4_unicode_ci AS entity_name,
      pr.required_date AS required_date,
      COALESCE(pr.submitted_at, pr.created_at) AS sort_at
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    WHERE (
      pr.status = ?
      OR (
        pr.status = ?
        AND EXISTS (
          SELECT 1 FROM rfq_configs rc
          WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po2
          WHERE po2.pr_id = pr.id
            AND po2.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
        )
      )
    )
    AND NOT EXISTS (SELECT 1 FROM purchase_orders po3 WHERE po3.pr_id = pr.id)
    ${readyTypeFilter}
    ${readyEntityFilter}
    ${readyDeptFilter}
    ${readyCatFilter}
  `;

  const poSql = `
    SELECT
      CONCAT('po-', po.id) COLLATE utf8mb4_unicode_ci AS row_key,
      'po' COLLATE utf8mb4_unicode_ci AS kind,
      po.pr_id AS pr_id,
      po.id AS po_id,
      COALESCE(pr.pr_number, '') COLLATE utf8mb4_unicode_ci AS pr_number,
      po.po_number COLLATE utf8mb4_unicode_ci AS po_number,
      COALESCE(NULLIF(pr.title, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(po.po_terms_details, '$.subject')), ''), CASE WHEN po.pr_id IS NULL THEN 'Manual PO' ELSE '' END) COLLATE utf8mb4_unicode_ci AS title,
      COALESCE(d.name, '') COLLATE utf8mb4_unicode_ci AS department,
      COALESCE(u.name, '') COLLATE utf8mb4_unicode_ci AS requester,
      COALESCE(po.vendor_name, '') COLLATE utf8mb4_unicode_ci AS vendor_name,
      po.grand_total AS amount,
      CAST(po.status AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status_raw,
      CAST(COALESCE(po.purchase_type, pr.purchase_type, 'purchase_order') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS purchase_type,
      COALESCE(po.entity_id, pr.entity_id) AS entity_id,
      COALESCE(po.entity, e.name, '') COLLATE utf8mb4_unicode_ci AS entity_name,
      po.expected_delivery_date AS required_date,
      po.created_at AS sort_at
    FROM purchase_orders po
    LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
    LEFT JOIN departments d ON d.id = pr.department_id
    LEFT JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = COALESCE(po.entity_id, pr.entity_id)
    WHERE 1=1
    ${poTypeFilter}
    ${poEntityFilter}
    ${poDeptFilter}
    ${poCatFilter}
  `;

  const unionParts = [];
  const baseParams = [];
  if (includeReady) {
    unionParts.push(`(${readySql})`);
    baseParams.push(...readyParams);
    if (typeSqlValue) baseParams.push(typeSqlValue);
    if (entityFilter) baseParams.push(entityFilter);
    if (deptFilter) baseParams.push(deptFilter);
    if (categoryFilter) baseParams.push(categoryFilter);
  }
  if (includePo) {
    unionParts.push(`(${poSql})`);
    baseParams.push(...poParams);
    if (typeSqlValue) baseParams.push(typeSqlValue);
    if (entityFilter) baseParams.push(entityFilter);
    if (deptFilter) baseParams.push(deptFilter);
    if (categoryFilter) baseParams.push(categoryFilter, categoryFilter);
  }

  if (!unionParts.length) {
    return {
      data: [],
      pagination: { page: 1, limit: pageSize, total: 0, totalPages: 1 },
      stats: await getTrackListStats(user),
    };
  }

  const unionSql = unionParts.join(' UNION ALL ');

  let whereExtra = ' WHERE 1=1';
  const filterParams = [];

  if (statusFilter === 'pending') {
    whereExtra += ` AND t.status_raw IN ('pending_approval', 'pending_buyer_verify')`;
  } else if (statusFilter === 'approved') {
    whereExtra += ` AND t.status_raw IN ('approved', 'sent_to_vendor')`;
  } else if (statusFilter === 'rejected') {
    whereExtra += ` AND t.status_raw = 'rejected'`;
  } else if (statusFilter === 'sent') {
    whereExtra += ` AND t.status_raw = 'sent_to_vendor'`;
  } else if (statusFilter === 'imported') {
    whereExtra += ` AND t.status_raw = 'imported'`;
  } else if (statusFilter === 'draft') {
    whereExtra += ` AND t.status_raw = 'draft'`;
  } else if (statusFilter === 'cancelled') {
    whereExtra += ` AND t.status_raw = 'cancelled'`;
  }

  if (q) {
    whereExtra += ` AND (
      LOWER(COALESCE(t.pr_number,'')) LIKE ?
      OR LOWER(COALESCE(t.po_number,'')) LIKE ?
      OR LOWER(COALESCE(t.title,'')) LIKE ?
      OR LOWER(COALESCE(t.vendor_name,'')) LIKE ?
      OR LOWER(COALESCE(t.department,'')) LIKE ?
      OR LOWER(COALESCE(t.requester,'')) LIKE ?
      OR LOWER(COALESCE(t.entity_name,'')) LIKE ?
    )`;
    const like = `%${q}%`;
    filterParams.push(like, like, like, like, like, like, like);
  }

  if (fromDate) {
    whereExtra += ` AND DATE(t.sort_at) >= ?`;
    filterParams.push(fromDate);
  }
  if (toDate) {
    whereExtra += ` AND DATE(t.sort_at) <= ?`;
    filterParams.push(toDate);
  }

  const listParams = [...baseParams, ...filterParams];

  const [[countRows], stats] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS cnt FROM (${unionSql}) t ${whereExtra}`, listParams),
    getTrackListStats(user),
  ]);

  const total = Number(countRows[0]?.cnt || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(pageNum, totalPages);
  const offset = (safePage - 1) * pageSize;

  const [dataRows] = await pool.query(
    `SELECT * FROM (${unionSql}) t
     ${whereExtra}
     ORDER BY CASE WHEN t.kind = 'ready' THEN 0 ELSE 1 END,
              t.sort_at DESC,
              COALESCE(t.po_id, t.pr_id) DESC
     LIMIT ? OFFSET ?`,
    [...listParams, pageSize, offset]
  );

  const data = dataRows.map((r) => {
    const mapped =
      r.kind === 'ready'
        ? { status: 'ready', statusLabel: 'Ready for PO' }
        : mapTrackPoStatus(r.status_raw);
    return {
      key: r.row_key,
      prId: r.pr_id != null ? Number(r.pr_id) : 0,
      poId: r.po_id != null ? Number(r.po_id) : null,
      prNumber: r.pr_number || '',
      poNumber: r.po_number || null,
      title: r.title || '',
      department: r.department || '',
      requester: r.requester || '',
      vendorName: r.vendor_name || '',
      amount: Number(r.amount) || 0,
      status: mapped.status,
      statusLabel: mapped.statusLabel,
      statusRaw: r.status_raw,
      purchaseType: r.purchase_type || 'purchase_order',
      purchaseTypeLabel: purchaseTypeLabel(r.purchase_type),
      entityId: r.entity_id != null ? Number(r.entity_id) : null,
      entityName: r.entity_name || '',
      requiredDate: formatDate(r.required_date),
      createdAt: formatDate(r.sort_at),
      kind: r.kind,
    };
  });

  return {
    data,
    pagination: {
      page: safePage,
      limit: pageSize,
      total,
      totalPages,
    },
    stats,
  };
}

/** Fast KPI counts using indexed status / created_by columns (no UNION). */
async function getTrackListStats(user) {
  const readySql = `
    SELECT COUNT(*) AS cnt
    FROM purchase_requests pr
    WHERE (
      pr.status = ?
      OR (
        pr.status = ?
        AND EXISTS (
          SELECT 1 FROM rfq_configs rc
          WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po2
          WHERE po2.pr_id = pr.id
            AND po2.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
        )
      )
    )
    AND NOT EXISTS (SELECT 1 FROM purchase_orders po3 WHERE po3.pr_id = pr.id)
  `;

  let poSql = `
    SELECT
      COUNT(*) AS po_total,
      SUM(CASE WHEN status IN ('pending_approval', 'pending_buyer_verify') THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status IN ('approved', 'sent_to_vendor') THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_count,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
    FROM purchase_orders
    WHERE 1=1
  `;
  const poParams = [];

  const [[readyRows], [poRows]] = await Promise.all([
    pool.query(readySql, [PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED]),
    pool.query(poSql, poParams),
  ]);

  const ready = Number(readyRows[0]?.cnt || 0);
  const poTotal = Number(poRows[0]?.po_total || 0);
  return {
    total: ready + poTotal,
    ready,
    pending: Number(poRows[0]?.pending || 0),
    approved: Number(poRows[0]?.approved || 0),
    rejected: Number(poRows[0]?.rejected || 0),
    draft: Number(poRows[0]?.draft_count || 0),
    cancelled: Number(poRows[0]?.cancelled_count || 0),
  };
}

export async function getPurchaseOrderById(poId) {
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) return null;
  return enrichPO(rows[0]);
}

export async function getPurchaseOrderByNumber(poNumber) {
  const normalized = String(poNumber || '').trim();
  if (!normalized) return null;
  const [rows] = await pool.query(
    `SELECT * FROM purchase_orders WHERE LOWER(po_number) = LOWER(?) LIMIT 1`,
    [normalized]
  );
  if (!rows.length) return null;
  return enrichPO(rows[0]);
}

/** Requester may view signed PO PDF only for their own PR after SCM Manager sign / release. */
export async function assertRequesterPoDocumentAccess(user, poId) {
  const po = await getPurchaseOrderById(Number(poId));
  if (!po) throw new Error('PO not found');
  if (user.role !== 'Requester') return po;
  if (!po.prId) throw new Error('Unauthorized');

  const [prRows] = await pool.query(`SELECT requester_id FROM purchase_requests WHERE id = ? LIMIT 1`, [
    po.prId,
  ]);
  if (!prRows.length || Number(prRows[0].requester_id) !== Number(user.id)) {
    throw new Error('Unauthorized');
  }

  const signed = Boolean(po.signedAt || po.signedPdfPath || po.signatureImagePath || po.signatureImageData);
  const released =
    signed ||
    REQUESTER_PO_DOCUMENT_STATUSES.has(String(po.status || '')) ||
    String(po.status || '') === 'pending_buyer_verify';
  if (!released) {
    throw new Error('PO document is not available until SCM Manager signs the PO');
  }
  return po;
}

export function resolvePoPdfPath(po) {
  return resolvePoDocumentPath(po);
}

async function signedPoPdfMailAttachment(po) {
  if (!po) return [];
  try {
    const signature = buildSignatureRenderOptions(po);
    const preferred =
      po.signedPdfPath || po.signed_pdf_path || `${po.poNumber || 'PO'}_signed.pdf`;
    const { fullPath, fileName } = await ensurePoPdf(po, {
      fileName: String(preferred).replace(/\.html$/i, '.pdf'),
      signed: true,
      signature,
      forceRegenerate: true,
    });
    if (po.id && fileName && fileName !== po.signedPdfPath) {
      await pool.query(`UPDATE purchase_orders SET signed_pdf_path = ? WHERE id = ?`, [fileName, po.id]);
    }
    return [
      {
        filename: `${po.poNumber || 'PO'}_signed.pdf`,
        path: fullPath,
        contentType: 'application/pdf',
      },
    ];
  } catch (err) {
    console.warn('Signed PO PDF attachment skipped:', err.message);
    return [];
  }
}

export async function signPurchaseOrder(user, poId, {
  remarks,
  signatureName,
  signatureImage,
  signatureId,
  saveToGallery,
  dsc,
}) {
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can sign purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_approval') throw new Error('PO is not pending approval');

  const dscDetails =
    dsc && typeof dsc === 'object'
      ? {
          holderName: String(dsc.holderName || '').trim(),
          serial: String(dsc.serial || '').trim(),
          issuer: String(dsc.issuer || '').trim(),
          validTill: String(dsc.validTill || '').trim(),
        }
      : null;
  if (dscDetails && (!dscDetails.holderName || !dscDetails.serial)) {
    throw new Error('DSC holder name and serial number are required');
  }
  if (dscDetails && !dscDetails.validTill) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    dscDetails.validTill = d.toISOString().slice(0, 10);
  }

  const signName = dscDetails?.holderName || signatureName?.trim() || user.name;
  if (!remarks?.trim()) throw new Error('Comments are required for signing');

  const {
    parseDataUrlImage,
    saveSignatureFile,
    getUserSignatureImage,
    saveUserSignature,
  } = await import('./signatureService.js');

  let imageDataUrl = null;
  let signatureImagePath = null;
  let signatureImageData = null;

  if (signatureId) {
    const gallery = await getUserSignatureImage(user.id, Number(signatureId));
    imageDataUrl = gallery.dataUrl;
    const { ext, buffer } = parseDataUrlImage(gallery.dataUrl);
    signatureImageData = buffer;
    signatureImagePath = saveSignatureFile(buffer, ext, `po_${poId}_${Date.now()}`);
  } else if (signatureImage) {
    const { ext, buffer, dataUrl } = parseDataUrlImage(signatureImage);
    imageDataUrl = dataUrl;
    signatureImageData = buffer;
    signatureImagePath = saveSignatureFile(buffer, ext, `po_${poId}_${Date.now()}`);
    if (saveToGallery) {
      await saveUserSignature(user.id, { image: dataUrl, label: `${signName} Signature` });
    }
  } else if (dscDetails) {
    // DSC stamp is generated on the client and sent as signatureImage; allow text-only if missing
  } else {
    // Fall back to Rajeev default handwritten signature
    const { getDefaultScmManagerSignatureDataUrl, DEFAULT_SCM_MANAGER_SIGNATURE_FILE } =
      await import('./signatureService.js');
    const defaultUrl = getDefaultScmManagerSignatureDataUrl();
    if (!defaultUrl) {
      throw new Error('Please provide a signature (draw, upload, gallery, or Digital Signature / DSC)');
    }
    imageDataUrl = defaultUrl;
    const { ext, buffer } = parseDataUrlImage(defaultUrl);
    signatureImageData = buffer;
    signatureImagePath = saveSignatureFile(buffer, ext, `po_${poId}_${Date.now()}`);
    if (!signatureImagePath) signatureImagePath = DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
  }

  const po = await enrichPO(rows[0]);
  const signedFileName = `${po.poNumber}_signed.pdf`;
  const { fileName } = await generatePoPdf(po, {
    fileName: signedFileName,
    signed: true,
    signature: {
      name: signName,
      date: formatDateTime(new Date()),
      comments: remarks.trim(),
      imageDataUrl,
      dsc: dscDetails || undefined,
    },
  });

  await pool.query(
    `UPDATE purchase_orders SET status = 'pending_buyer_verify', signed_pdf_path = ?, signer_id = ?,
     signature_name = ?, signature_image_path = ?, signature_image_data = ?, signer_comments = ?, signed_at = NOW(),
     signature_dsc_json = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      fileName,
      user.id,
      signName,
      signatureImagePath,
      signatureImageData,
      remarks.trim(),
      dscDetails ? JSON.stringify({ ...dscDetails, signedAt: new Date().toISOString() }) : null,
      poId,
    ]
  );

  if (po.prId) {
    await pool.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND assigned_role = 'SCM Manager' AND status = 'pending'`,
      [po.prId]
    );

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    await pool.query(
      `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
       VALUES (?, 'PO_BUYER_VERIFY', 'SCM Buyer', ?, 'pending', ?)`,
      [po.prId, null, dueDate.toISOString().split('T')[0]]
    );

    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, 'PO_SIGNED', ?, 'approve', ?)`,
      [po.prId, user.id, remarks.trim() || 'Signed — sent to SCM Buyer for final verify']
    );
  }

  const scmBuyer = await resolveScmBuyerUser();
  const updated = await getPurchaseOrderById(poId);
  const buyerEmails = await getScmBuyerNotifyEmails();
  const attachments = await signedPoPdfMailAttachment(updated);
  if (buyerEmails.length) {
    queuePoWorkflowNotification(updated, {
      action: 'assign',
      stageLabel: 'SCM Buyer Final Verify',
      recipientEmails: buyerEmails,
      recipientName: scmBuyer?.name || 'SCM Buyer',
      actorName: signName || user.name,
      actorRole: user.role,
      remarks: remarks.trim(),
      portalUrl: poPortalUrl('/scm/buyer-final-verify'),
      ctaLabel: 'Open Buyer Final Verify',
      bccOps: false,
      notifyWhatsApp: false,
      attachments,
    });
  }

  return updated;
}

export async function finalVerifyPurchaseOrder(user, poId, remarks) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can final-verify purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_buyer_verify') {
    throw new Error('PO is not pending buyer final verification');
  }

  const verifyRemarks =
    remarks?.trim() || 'Final verified by SCM Buyer';
  const token = rows[0].vendor_acceptance_token || newVendorAcceptanceToken();

  await pool.query(
    `UPDATE purchase_orders SET
       status = 'sent_to_vendor',
       vendor_acceptance_status = 'pending',
       vendor_acceptance_token = ?,
       vendor_acceptance_mode = NULL,
       vendor_notified_at = NULL,
       updated_at = NOW()
     WHERE id = ?`,
    [token, poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_BUYER_VERIFY' AND assigned_role = 'SCM Buyer' AND status = 'pending'`,
    [rows[0].pr_id]
  );

  if (rows[0].pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_BUYER_VERIFIED', ?, 'verified', ?)`,
      [rows[0].pr_id, user.id, verifyRemarks]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  let parties = { emails: [], name: updated.requester || 'User' };
  try {
    parties = await collectRequesterAndApproverEmails(updated, {
      excludeEmails: [updated.vendorEmail],
    });
  } catch (err) {
    console.warn('Final-verify notify lookup failed:', err.message);
  }

  try {
    const scmBuyers = await getScmBuyerNotifyEmails();
    const scmManagers = await getScmManagerNotifyEmails();
    const exclude = new Set(
      [updated.vendorEmail, updated.vendor_email]
        .map((e) => String(e || '').trim().toLowerCase())
        .filter(Boolean)
    );
    parties.emails = [...new Set([...parties.emails, ...scmBuyers, ...scmManagers])]
      .map((e) => String(e || '').trim())
      .filter(
        (e) =>
          e &&
          e.includes('@') &&
          !exclude.has(e.toLowerCase()) &&
          !e.toLowerCase().endsWith('@imported.local')
      );
  } catch (err) {
    console.warn('Final-verify SCM team lookup failed:', err.message);
  }

  const attachments = await signedPoPdfMailAttachment(updated);
  const signerName =
    String(updated.signatureName || rows[0].signature_name || '').trim() ||
    getPreferredScmManagerName() ||
    'SCM Manager';

  if (parties.emails.length) {
    queuePoWorkflowNotification(updated, {
      action: 'verified',
      stageLabel: 'PO approved and signed',
      recipientEmails: parties.emails,
      recipientName: parties.name,
      actorName: signerName,
      actorRole: 'SCM Manager',
      remarks: verifyRemarks,
      portalUrl: '',
      ctaLabel: false,
      bccOps: false,
      notifyWhatsApp: false,
      attachments,
    });
  } else {
    console.warn(`No requester/approver/SCM emails for final-verify ${updated.poNumber}`);
  }

  // Vendor mail is a separate optional step — never sent from final verify
  return updated;
}

export async function rejectBuyerFinalVerify(user, poId, remarks) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can reject at final verify');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_buyer_verify') {
    throw new Error('PO is not pending buyer final verification');
  }
  if (!remarks?.trim()) throw new Error('Rejection remarks are required');

  await pool.query(
    `UPDATE purchase_orders SET status = 'rejected', updated_at = NOW() WHERE id = ?`,
    [poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_BUYER_VERIFY' AND assigned_role = 'SCM Buyer' AND status = 'pending'`,
    [rows[0].pr_id]
  );

  if (rows[0].pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_BUYER_REJECTED', ?, 'reject', ?)`,
      [rows[0].pr_id, user.id, remarks.trim()]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  const parties = await resolvePoNotifyParties(rows[0]);
  const managers = await resolveRoleEmails('SCM Manager');
  const recipientEmails = [...new Set([...parties.emails, ...managers.map((m) => m.email)])];
  queuePoWorkflowNotification(updated, {
    action: 'reject',
    stageLabel: 'SCM Buyer Final Verify — Rejected',
    recipientEmails,
    recipientName: parties.name || managers[0]?.name || 'Team',
    actorName: user.name,
    actorRole: user.role,
    remarks: remarks.trim(),
    portalUrl: poPortalUrl('/scm/track-po'),
    ctaLabel: 'Track PO',
  });

  return updated;
}

/** Buyer sends PO back to SCM Manager for re-sign (clears signature). */
export async function sendBackBuyerFinalVerify(user, poId, remarks) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can send back at final verify');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_buyer_verify') {
    throw new Error('PO is not pending buyer final verification');
  }
  if (!remarks?.trim()) throw new Error('Send-back remarks are required');

  await pool.query(
    `UPDATE purchase_orders SET
       status = 'pending_approval',
       signed_pdf_path = NULL,
       signer_id = NULL,
       signature_name = NULL,
       signature_image_path = NULL,
       signer_comments = NULL,
       signed_at = NULL,
       updated_at = NOW()
     WHERE id = ?`,
    [poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_BUYER_VERIFY' AND assigned_role = 'SCM Buyer' AND status = 'pending'`,
    [rows[0].pr_id]
  );

  if (rows[0].pr_id) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    await insertScmManagerPoApprovalTask(pool, rows[0].pr_id, dueDate.toISOString().split('T')[0]);

    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_BUYER_SENT_BACK', ?, 'return', ?)`,
      [rows[0].pr_id, user.id, remarks.trim()]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  const managers = await resolveRoleEmails('SCM Manager');
  queuePoWorkflowNotification(updated, {
    action: 'sendback',
    stageLabel: 'SCM Manager PO Approval — Sent Back',
    recipientEmails: managers.map((m) => m.email),
    recipientName: managers[0]?.name || 'SCM Manager',
    actorName: user.name,
    actorRole: user.role,
    remarks: remarks.trim(),
    portalUrl: poPortalUrl('/scm/po-approval'),
    ctaLabel: 'Review & Re-sign PO',
  });

  return updated;
}

/** Manager sends unsigned PO back to SCM Buyer for revision. */
export async function sendBackPurchaseOrder(user, poId, remarks) {
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can send back purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_approval') throw new Error('PO is not pending approval');
  if (!remarks?.trim()) throw new Error('Send-back remarks are required');

  await pool.query(
    `UPDATE purchase_orders SET
       status = 'draft',
       signed_pdf_path = NULL,
       signer_id = NULL,
       signature_name = NULL,
       signature_image_path = NULL,
       signer_comments = NULL,
       signed_at = NULL,
       updated_at = NOW()
     WHERE id = ?`,
    [poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND assigned_role = 'SCM Manager' AND status = 'pending'`,
    [rows[0].pr_id]
  );

  if (rows[0].pr_id) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    await pool.query(
      `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
       VALUES (?, 'PO_REVISION', 'SCM Buyer', 'pending', ?)`,
      [rows[0].pr_id, dueDate.toISOString().split('T')[0]]
    );

    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_SENT_BACK', ?, 'return', ?)`,
      [rows[0].pr_id, user.id, remarks.trim()]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  const buyerEmails = await getScmBuyerNotifyEmails();
  const buyer = await resolveScmBuyerUser();
  if (buyerEmails.length) {
    queuePoWorkflowNotification(updated, {
      action: 'sendback',
      stageLabel: 'SCM Manager PO Sign — Sent Back',
      recipientEmails: buyerEmails,
      recipientName: buyer?.name || 'SCM Buyer',
      actorName: user.name,
      actorRole: user.role,
      remarks: remarks.trim(),
      portalUrl: poPortalUrl(rows[0].pr_id ? `/scm/create-po?poId=${poId}` : '/scm/purchase-requests'),
      ctaLabel: 'Revise PO',
    });
  }

  return updated;
}

export async function cancelPurchaseOrder(user, poId, body = {}) {
  if (!['SCM Buyer', 'SCM Manager', 'Super Admin'].includes(user.role)) {
    throw new Error('You are not allowed to cancel purchase orders');
  }
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  const row = rows[0];
  if (row.status === 'cancelled') throw new Error('PO is already cancelled');
  if (row.status === 'paid') throw new Error('Paid PO cannot be cancelled');

  const reason = String(body.reason || body.remarks || '').trim();
  if (!reason) throw new Error('Cancellation reason is required');

  const incomingFiles = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments = incomingFiles
    .map((item) => {
      const entry = item && typeof item === 'object' ? item : {};
      const saved = savePoAttachment(
        poId,
        'cancel',
        String(entry.fileName || entry.name || '').trim(),
        String(entry.fileData || entry.base64 || '').trim()
      );
      if (!saved.filePath) return null;
      return {
        fileName: saved.fileName,
        filePath: saved.filePath,
        uploadedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  await pool.query(
    `UPDATE purchase_orders
     SET status = 'cancelled',
         cancellation_reason = ?,
         cancellation_attachments_json = ?,
         cancelled_by = ?,
         cancelled_at = NOW(),
         updated_at = NOW()
     WHERE id = ?`,
    [reason, JSON.stringify(attachments), user.id, poId]
  );

  if (row.pr_id) {
    await pool.query(
      `UPDATE workflow_tasks
       SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ?
         AND status = 'pending'
         AND task_type IN ('PO_APPROVAL', 'PO_BUYER_VERIFY', 'PO_REVISION', 'RFQ_POST_APPROVAL')`,
      [row.pr_id]
    );
    await pool.query(
      `UPDATE purchase_requests
       SET current_stage = 'PO_CANCELLED', updated_at = NOW()
       WHERE id = ?`,
      [row.pr_id]
    );
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_CANCELLED', ?, 'cancelled', ?)`,
      [row.pr_id, user.id, reason]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  const parties = await resolvePoNotifyParties(row);
  queuePoWorkflowNotification(updated, {
    action: 'reject',
    stageLabel: 'PO Cancelled',
    recipientEmails: parties.emails,
    recipientName: parties.name || 'Team',
    actorName: user.name,
    actorRole: user.role,
    remarks: reason,
    portalUrl: poPortalUrl('/scm/track-po'),
    ctaLabel: 'Track PO',
  });
  return updated;
}

export async function rejectPurchaseOrder(user, poId, remarks) {
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can reject purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_approval') throw new Error('PO is not pending approval');
  if (!remarks?.trim()) throw new Error('Rejection remarks are required');

  await pool.query(
    `UPDATE purchase_orders SET status = 'rejected', signer_comments = ?, updated_at = NOW() WHERE id = ?`,
    [remarks.trim(), poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND assigned_role = 'SCM Manager' AND status = 'pending'`,
    [rows[0].pr_id]
  );

  if (rows[0].pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_REJECTED', ?, 'reject', ?)`,
      [rows[0].pr_id, user.id, remarks.trim()]
    );
  }

  const updated = await getPurchaseOrderById(poId);
  const parties = await resolvePoNotifyParties(rows[0]);
  const buyer = await resolveScmBuyerUser();
  const recipientEmails = [
    ...new Set([...parties.emails, ...(buyer?.email ? [buyer.email] : [])]),
  ];
  queuePoWorkflowNotification(updated, {
    action: 'reject',
    stageLabel: 'SCM Manager PO Approval — Rejected',
    recipientEmails,
    recipientName: parties.name || buyer?.name || 'Team',
    actorName: user.name,
    actorRole: user.role,
    remarks: remarks.trim(),
    portalUrl: poPortalUrl('/scm/track-po'),
    ctaLabel: 'Track PO',
  });

  return updated;
}

export async function updatePurchaseOrder(user, poId, body) {
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  const existing = rows[0];

  const canManagerEdit = user.role === 'SCM Manager' && existing.status === 'pending_approval';
  const canBuyerEdit = user.role === 'SCM Buyer' && existing.status === 'pending_buyer_verify';
  const canBuyerRevise = user.role === 'SCM Buyer' && existing.status === 'draft';
  if (!canManagerEdit && !canBuyerEdit && !canBuyerRevise) {
    throw new Error('You are not allowed to edit this purchase order');
  }

  const draft = existing.pr_id
    ? await resolvePoDraftContent(existing.pr_id, {
        ...body,
        poNumber: normalizeRequestedPoNumber(body.poNumber) || existing.po_number,
        poDate: body.poDate || body.po_date || formatDate(existing.po_date) || formatDate(existing.created_at),
        currency: body.currency ?? existing.currency,
        terms: body.terms ?? body.termsClauses,
        annexure: body.annexure ?? body.annexureClauses,
        annexureIiHtml: body.annexureIiHtml ?? existing.annexure_ii_html ?? '',
        annexureIiRows: body.annexureIiRows ?? parseAnnexureIi(body.annexureIiHtml ?? existing.annexure_ii_html),
      })
    : await resolveManualPoDraftContent({
        ...body,
        poNumber: normalizeRequestedPoNumber(body.poNumber) || existing.po_number,
        poDate: body.poDate || body.po_date || formatDate(existing.po_date) || formatDate(existing.created_at),
        vendorName: body.vendorName || existing.vendor_name,
        vendorEmail: body.vendorEmail || existing.vendor_email,
        currency: body.currency ?? existing.currency,
        terms: body.terms ?? body.termsClauses,
        annexure: body.annexure ?? body.annexureClauses,
        annexureIiHtml: body.annexureIiHtml ?? existing.annexure_ii_html ?? '',
        annexureIiRows: body.annexureIiRows ?? parseAnnexureIi(body.annexureIiHtml ?? existing.annexure_ii_html),
      });

  const {
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType: normalizedPoType,
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    annexureIiHtml: resolvedAnnexureIiHtml,
    poTermsDetails: resolvedPoTermsDetails,
    currency: resolvedCurrency,
    subtotal,
    taxAmount,
    grandTotal,
  } = draft;

  if (!lineItems.length) throw new Error('At least one line item is required');
  if (!deliveryAddress?.trim()) throw new Error('Delivery address is required');
  if (!expectedDeliveryDate) throw new Error('Expected delivery date is required');

  const changeSummary =
    body.changeSummary?.trim() ||
    (canBuyerRevise
      ? 'PO revised by SCM Buyer after manager send-back — resubmitted for sign'
      : canBuyerEdit
        ? 'PO updated by SCM Buyer during final verify'
        : 'PO updated by SCM Manager before approval');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const referencePoNumber =
      body.referencePoNumber !== undefined
        ? body.referencePoNumber?.trim() || null
        : existing.reference_po_number;

    const nextPoNumber = await resolvePersistedPoNumber({
      requested: body.poNumber || body.existingPoNumber,
      existingNumber: existing.po_number,
      entityId: existing.entity_id,
      purchaseType: normalizePurchaseType(body.purchaseType || existing.purchase_type),
      excludeId: poId,
      connection: conn,
      docLabel: purchaseTypeLabel(normalizePurchaseType(body.purchaseType || existing.purchase_type)),
    });

    await conn.query(
      `UPDATE purchase_orders SET
        po_number = ?,
        reference_po_number = ?,
        delivery_address = ?, expected_delivery_date = ?, po_date = ?, payment_terms = ?, incoterms = ?,
        special_instructions = ?, po_type = ?, letterhead_header = ?, letterhead_id = ?, entity = ?,
        header_logo = ?, footer_logo = ?, terms_clauses = ?,
        annexure_clauses = ?, annexure_ii_html = ?, po_terms_details = ?, gst_percentage = ?, currency = ?, subtotal = ?, tax_amount = ?, grand_total = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        nextPoNumber,
        referencePoNumber,
        deliveryAddress,
        expectedDeliveryDate,
        poDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        normalizedPoType,
        resolvedLetterhead,
        resolvedLetterheadId || null,
        resolvedEntity || '',
        resolvedHeaderLogo || '',
        resolvedFooterLogo || '',
        JSON.stringify(resolvedTerms),
        JSON.stringify(resolvedAnnexure),
        resolvedAnnexureIiHtml || '',
        JSON.stringify(resolvedPoTermsDetails || EMPTY_PO_TERMS_DETAILS),
        gstPercentage,
        resolvedCurrency || normalizeCurrency(existing.currency),
        subtotal,
        taxAmount,
        grandTotal,
        poId,
      ]
    );

    await conn.query(`DELETE FROM po_line_items WHERE po_id = ?`, [poId]);
    for (const item of lineItems) {
      const total = lineItemTotal(item.quantity, item.unitPrice);
      const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage) || 0));
      const itemName = String(item.itemName || item.name || '').trim();
      const description = String(item.description || itemName || '').trim() || '(no description)';
      await conn.query(
        `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit, unit_price, discount, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, '', itemName || null, description, item.quantity, normalizeUnit(item.unit || item.uom), item.unitPrice, 0, taxPercentage, total]
      );
    }

    if (existing.pr_id) {
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, 'PO_UPDATED', ?, 'updated', ?)`,
        [existing.pr_id, user.id, changeSummary]
      );
    }

    if (canBuyerRevise) {
      await conn.query(
        `UPDATE purchase_orders SET status = 'pending_approval', updated_at = NOW() WHERE id = ?`,
        [poId]
      );
      if (existing.pr_id) {
        await conn.query(
          `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
           WHERE pr_id = ? AND task_type = 'PO_REVISION' AND assigned_role = 'SCM Buyer' AND status = 'pending'`,
          [existing.pr_id]
        );
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 2);
        await insertScmManagerPoApprovalTask(conn, existing.pr_id, dueDate.toISOString().split('T')[0]);
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const updatedPo = await getPurchaseOrderById(poId);

  // Buyer edits after Manager sign: refresh draft + re-embed existing signature into signed PDF
  if (canBuyerEdit && (existing.signed_at || existing.signature_image_path || existing.signature_image_data)) {
    const signedFileName = `${updatedPo.poNumber}_signed.pdf`;
    const { fileName } = await generatePoPdf(updatedPo, {
      fileName: signedFileName,
      signed: true,
      signature: buildSignatureRenderOptions({
        ...updatedPo,
        signatureName: existing.signature_name || updatedPo.signatureName,
        signatureImagePath: existing.signature_image_path,
        signatureImageData: existing.signature_image_data,
        signatureDsc: updatedPo.signatureDsc || parseSignatureDsc(existing.signature_dsc_json),
        signerComments: existing.signer_comments,
        signedAt: updatedPo.signedAt || existing.signed_at,
        signedPdfPath: existing.signed_pdf_path,
      }),
    });
    await pool.query(
      `UPDATE purchase_orders SET pdf_path = ?, signed_pdf_path = ?, updated_at = NOW() WHERE id = ?`,
      [fileName, fileName, poId]
    );
    updatedPo.pdfPath = fileName;
    updatedPo.signedPdfPath = fileName;
  } else {
    const { fileName } = await generatePoPdf(updatedPo, { fileName: `${updatedPo.poNumber}_draft.pdf` });
    await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, poId]);
    updatedPo.pdfPath = fileName;
  }

  if (canBuyerRevise) {
    const managers = await resolveRoleEmails('SCM Manager');
    if (managers.length) {
      queuePoWorkflowNotification(updatedPo, {
        action: 'assign',
        stageLabel: 'SCM Manager PO Approval',
        recipientEmails: managers.map((m) => m.email),
        recipientName: managers[0]?.name || 'SCM Manager',
        actorName: user.name,
        actorRole: user.role,
        remarks: 'PO revised by SCM Buyer and resubmitted for sign',
        portalUrl: poPortalUrl('/scm/po-approval'),
        ctaLabel: 'Open PO Approval',
      });
    }
  }

  return updatedPo;
}

export async function listVendorAcceptancePOs(user) {
  if (user.role !== 'SCM Buyer' && user.role !== 'SCM Manager' && user.role !== 'Super Admin') {
    throw new Error('Unauthorized');
  }

  let sql = `
    SELECT po.* FROM purchase_orders po
    WHERE po.status = 'sent_to_vendor'
  `;
  const params = [];
  if (user.role === 'SCM Buyer' && !canEditAnyScmPurchaseOrder(user)) {
    sql += ` AND po.created_by = ?`;
    params.push(user.id);
  }
  sql += ` ORDER BY
    CASE COALESCE(po.vendor_acceptance_status, 'pending')
      WHEN 'pending' THEN 0
      WHEN 'partial' THEN 1
      WHEN 'accepted' THEN 2
      WHEN 'rejected' THEN 3
      ELSE 4
    END,
    po.updated_at DESC`;

  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPO));
}

async function assertVendorAcceptancePending(poId) {
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  const row = rows[0];
  if (row.status !== 'sent_to_vendor') {
    throw new Error('PO is not in vendor acceptance stage');
  }
  if (row.vendor_acceptance_status && row.vendor_acceptance_status !== 'pending') {
    throw new Error('Vendor acceptance already recorded for this PO');
  }
  return row;
}

export async function sendVendorAcceptanceMail(user, poId) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can send vendor acceptance mail');

  const row = await assertVendorAcceptancePending(poId);
  const token = row.vendor_acceptance_token || newVendorAcceptanceToken();

  await pool.query(
    `UPDATE purchase_orders SET
       vendor_acceptance_token = ?,
       vendor_acceptance_mode = 'email',
       vendor_acceptance_status = 'pending',
       vendor_notified_at = NOW(),
       updated_at = NOW()
     WHERE id = ?`,
    [token, poId]
  );

  const updatedPo = await getPurchaseOrderById(poId);
  const pdfFile = updatedPo.signedPdfPath || updatedPo.pdfPath;
  const pdfPath = pdfFile ? path.join(PO_UPLOAD_DIR, pdfFile) : null;
  const base = (process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
  const acceptUrl = `${base}/vendor/po-accept/${token}`;

  await sendPoVendorNotification(updatedPo, {
    signerName: updatedPo.signatureName || 'SCM Manager',
    signerComments: updatedPo.signerComments || '',
    ccEmails: [],
    pdfPath,
    portalUrl: acceptUrl,
  });

  if (updatedPo.prId) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_VENDOR_MAIL', ?, 'notified', ?)`,
      [
        updatedPo.prId,
        user.id,
        `Vendor acceptance mail sent to ${updatedPo.vendorEmail}`,
      ]
    );
  }

  return updatedPo;
}

export async function submitManualVendorAcceptance(user, poId, body = {}) {
  if (user.role !== 'SCM Buyer') throw new Error('Only SCM Buyer can submit manual vendor acceptance');

  const row = await assertVendorAcceptancePending(poId);
  const action = String(body.action || 'accept').toLowerCase();
  const statusMap = {
    accept: 'accepted',
    accepted: 'accepted',
    reject: 'rejected',
    rejected: 'rejected',
    partial: 'partial',
  };
  const acceptanceStatus = statusMap[action];
  if (!acceptanceStatus) throw new Error('Invalid action. Use accept, reject, or partial');

  const remarks = String(body.remarks || '').trim();
  if (!remarks) throw new Error('Remarks are required');

  const fileInfo = saveVendorAcceptanceFile(poId, body.fileName, body.fileData);
  if (acceptanceStatus === 'accepted' && !fileInfo.filePath) {
    throw new Error('Please upload the vendor acceptance / signed document');
  }

  const deliveryDate = body.deliveryDate || body.deliveryConfirmedDate || null;

  await pool.query(
    `UPDATE purchase_orders SET
       vendor_acceptance_mode = 'manual',
       vendor_acceptance_status = ?,
       vendor_acceptance_remarks = ?,
       vendor_acceptance_file_name = COALESCE(?, vendor_acceptance_file_name),
       vendor_acceptance_file_path = COALESCE(?, vendor_acceptance_file_path),
       vendor_delivery_confirmed_date = ?,
       vendor_accepted_at = NOW(),
       status = CASE
         WHEN ? IN ('accepted', 'partial') THEN 'awaiting_grn'
         ELSE status
       END,
       updated_at = NOW()
     WHERE id = ?`,
    [
      acceptanceStatus,
      remarks,
      fileInfo.fileName,
      fileInfo.filePath,
      deliveryDate || null,
      acceptanceStatus,
      poId,
    ]
  );

  if (row.pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_VENDOR_ACCEPTANCE', ?, ?, ?)`,
      [
        row.pr_id,
        user.id,
        acceptanceStatus,
        `Manual vendor acceptance (${acceptanceStatus}) by ${user.name || 'SCM Buyer'}: ${remarks}`,
      ]
    );
  }

  return getPurchaseOrderById(poId);
}

export async function getVendorAcceptanceByToken(token) {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('Invalid acceptance link');

  const [rows] = await pool.query(
    `SELECT * FROM purchase_orders WHERE vendor_acceptance_token = ? LIMIT 1`,
    [clean]
  );
  if (!rows.length) throw new Error('Acceptance link is invalid or expired');

  const po = await enrichPO(rows[0]);
  return {
    poNumber: po.poNumber,
    prNumber: po.prNumber,
    prTitle: po.prTitle,
    vendorName: po.vendorName,
    vendorEmail: po.vendorEmail,
    grandTotal: po.grandTotal,
    expectedDeliveryDate: po.expectedDeliveryDate,
    paymentTerms: po.paymentTerms,
    status: po.status,
    vendorAcceptanceStatus: po.vendorAcceptanceStatus || 'pending',
    canRespond: !po.vendorAcceptanceStatus || po.vendorAcceptanceStatus === 'pending',
    lineItems: po.lineItems,
    hasSignedPdf: Boolean(po.signedPdfPath || po.pdfPath),
  };
}

export async function submitVendorAcceptanceByToken(token, body = {}) {
  const clean = String(token || '').trim();
  const [rows] = await pool.query(
    `SELECT * FROM purchase_orders WHERE vendor_acceptance_token = ? LIMIT 1`,
    [clean]
  );
  if (!rows.length) throw new Error('Acceptance link is invalid or expired');

  const row = rows[0];
  if (row.status !== 'sent_to_vendor') throw new Error('PO is not awaiting vendor acceptance');
  if (row.vendor_acceptance_status && row.vendor_acceptance_status !== 'pending') {
    throw new Error('You have already responded to this purchase order');
  }

  const action = String(body.action || 'accept').toLowerCase();
  const statusMap = {
    accept: 'accepted',
    accepted: 'accepted',
    reject: 'rejected',
    rejected: 'rejected',
    partial: 'partial',
  };
  const acceptanceStatus = statusMap[action];
  if (!acceptanceStatus) throw new Error('Invalid action');

  const remarks = String(body.remarks || '').trim();
  if (!remarks) throw new Error('Remarks are required');

  const fileInfo = saveVendorAcceptanceFile(row.id, body.fileName, body.fileData);
  if (acceptanceStatus !== 'rejected' && !fileInfo.filePath) {
    throw new Error('Please upload the signed / acceptance document');
  }

  const deliveryDate = body.deliveryDate || body.deliveryConfirmedDate || null;

  await pool.query(
    `UPDATE purchase_orders SET
       vendor_acceptance_mode = 'email',
       vendor_acceptance_status = ?,
       vendor_acceptance_remarks = ?,
       vendor_acceptance_file_name = COALESCE(?, vendor_acceptance_file_name),
       vendor_acceptance_file_path = COALESCE(?, vendor_acceptance_file_path),
       vendor_delivery_confirmed_date = ?,
       vendor_accepted_at = NOW(),
       status = CASE
         WHEN ? IN ('accepted', 'partial') THEN 'awaiting_grn'
         ELSE status
       END,
       updated_at = NOW()
     WHERE id = ?`,
    [
      acceptanceStatus,
      remarks,
      fileInfo.fileName,
      fileInfo.filePath,
      deliveryDate || null,
      acceptanceStatus,
      row.id,
    ]
  );

  if (row.pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_VENDOR_ACCEPTANCE', NULL, ?, ?)`,
      [row.pr_id, acceptanceStatus, `Vendor response via email link: ${remarks}`]
    );
  }

  return getVendorAcceptanceByToken(clean);
}

export function resolveVendorAcceptanceFile(poRowOrPath) {
  const filePath =
    typeof poRowOrPath === 'string'
      ? poRowOrPath
      : poRowOrPath?.vendor_acceptance_file_path || poRowOrPath?.vendorAcceptanceFilePath;
  if (!filePath) throw new Error('Acceptance file not found');
  const fullPath = path.join(PO_UPLOAD_DIR, path.basename(filePath));
  if (!fs.existsSync(fullPath)) throw new Error('Acceptance file missing on server');
  return fullPath;
}

export function resolveCancellationAttachment(po, index) {
  const files = Array.isArray(po?.cancellationAttachments) ? po.cancellationAttachments : [];
  const file = files[Number(index)];
  const stored = String(file?.filePath || '').trim();
  if (!stored) throw new Error('Cancellation attachment not found');
  const fullPath = path.join(PO_UPLOAD_DIR, path.basename(stored));
  if (!fs.existsSync(fullPath)) throw new Error('Cancellation file missing on server');
  return {
    fullPath,
    fileName: String(file.fileName || path.basename(fullPath)),
  };
}

const CFO_PO_ENTITY_COLORS = [
  '#14B8A6',
  '#F59E0B',
  '#10B981',
  '#6366F1',
  '#3B82F6',
  '#EC4899',
  '#8B5CF6',
  '#F97316',
];

const CFO_PO_EXCLUDED_STATUSES = ['draft', 'cancelled', 'rejected'];
const CFO_PO_PENDING_STATUSES = ['pending_approval', 'pending_buyer_verify'];
const CFO_PO_APPROVED_STATUSES = [
  'approved',
  'sent_to_vendor',
  'awaiting_grn',
  'grn_completed',
  'invoice_entry',
  'pending_accounts_approval',
  'approved_for_payment',
  'paid',
  'imported',
];

function sqlInList(values) {
  return values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
}

function cfoPoStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (CFO_PO_PENDING_STATUSES.includes(s)) return 'Pending Approval';
  if (s === 'rejected') return 'Rejected';
  if (CFO_PO_APPROVED_STATUSES.includes(s) || s === 'paid') return 'Approved';
  return status || 'Unknown';
}

/**
 * Live CFO Financial Insights: PO KPIs, entity rollups, monthly trend, recent POs, top vendors.
 */
export async function getCfoPoInsights() {
  const excludedSql = sqlInList(CFO_PO_EXCLUDED_STATUSES);
  const pendingSql = sqlInList(CFO_PO_PENDING_STATUSES);
  const approvedSql = sqlInList(CFO_PO_APPROVED_STATUSES);

  const [[kpi]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status NOT IN (${excludedSql}) THEN grand_total ELSE 0 END), 0) AS total_po_amount,
       COALESCE(SUM(CASE WHEN status IN (${approvedSql}) THEN grand_total ELSE 0 END), 0) AS approved_po_amount,
       COALESCE(SUM(CASE WHEN status IN (${pendingSql}) THEN grand_total ELSE 0 END), 0) AS pending_po_amount,
       COUNT(CASE WHEN status NOT IN (${excludedSql}) THEN 1 END) AS total_po_count
     FROM purchase_orders`
  );

  const [[payments]] = await pool.query(
    `SELECT COALESCE(SUM(invoice_grand_total), 0) AS paid_value
     FROM invoices
     WHERE status = 'paid'`
  );

  const [entityRows] = await pool.query(
    `SELECT
       COALESCE(e.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), 'Unassigned') AS entity_name,
       COALESCE(NULLIF(TRIM(e.code), ''), 'N/A') AS entity_code,
       COUNT(*) AS total_po_count,
       COALESCE(SUM(po.grand_total), 0) AS total_po_amount,
       COALESCE(SUM(CASE WHEN po.status IN (${approvedSql}) THEN po.grand_total ELSE 0 END), 0) AS approved_amount,
       COALESCE(SUM(CASE WHEN po.status IN (${pendingSql}) THEN po.grand_total ELSE 0 END), 0) AS pending_amount
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN (${excludedSql})
     GROUP BY COALESCE(e.id, 0),
              COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), 'Unassigned'),
              COALESCE(NULLIF(TRIM(e.code), ''), 'N/A')
     ORDER BY total_po_amount DESC`
  );

  const entityWisePOSummary = entityRows.map((row, idx) => ({
    entityId: Number(row.entity_id) || null,
    entityName: row.entity_name,
    code: row.entity_code,
    totalPOCount: Number(row.total_po_count || 0),
    totalPOAmount: Number(row.total_po_amount || 0),
    approvedAmount: Number(row.approved_amount || 0),
    pendingAmount: Number(row.pending_amount || 0),
    color: CFO_PO_ENTITY_COLORS[idx % CFO_PO_ENTITY_COLORS.length],
  }));

  const topEntities = entityWisePOSummary.slice(0, 4);
  const seriesKeys = topEntities.map((e, i) => ({
    key: `e${i}`,
    label: e.code !== 'N/A' ? e.code : e.entityName.slice(0, 12),
    entityName: e.entityName,
    color: e.color,
    matchNames: [e.entityName, e.code].filter(Boolean),
  }));

  const [monthRows] = await pool.query(
    `SELECT
       DATE_FORMAT(COALESCE(po.po_date, po.created_at), '%Y-%m') AS ym,
       DATE_FORMAT(COALESCE(po.po_date, po.created_at), '%b') AS month_label,
       COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), 'Unassigned') AS entity_name,
       COALESCE(SUM(po.grand_total), 0) AS amount
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN (${excludedSql})
       AND COALESCE(po.po_date, po.created_at) >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
     GROUP BY ym, month_label, entity_name
     ORDER BY ym ASC`
  );

  const monthMap = new Map();
  for (const row of monthRows) {
    if (!monthMap.has(row.ym)) {
      const point = { month: row.month_label, ym: row.ym, total: 0 };
      for (const s of seriesKeys) point[s.key] = 0;
      monthMap.set(row.ym, point);
    }
    const point = monthMap.get(row.ym);
    const amount = Number(row.amount || 0);
    point.total += amount;
    const series = seriesKeys.find((s) => s.matchNames.includes(row.entity_name));
    if (series) point[series.key] += amount;
  }

  // Ensure last 6 calendar months exist even if empty
  const monthlyPOTrend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short' });
    if (monthMap.has(ym)) {
      monthlyPOTrend.push(monthMap.get(ym));
    } else {
      const empty = { month: label, ym, total: 0 };
      for (const s of seriesKeys) empty[s.key] = 0;
      monthlyPOTrend.push(empty);
    }
  }

  const [recentRows] = await pool.query(
    `SELECT
       po.po_number,
       po.vendor_name,
       po.grand_total,
       po.status,
       COALESCE(po.po_date, po.created_at) AS po_date,
       COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), '—') AS entity_name
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN ('draft', 'cancelled')
     ORDER BY COALESCE(po.po_date, po.created_at) DESC, po.id DESC
     LIMIT 12`
  );

  const recentPurchaseOrders = recentRows.map((row) => ({
    poNumber: row.po_number,
    entity: row.entity_name,
    vendorName: row.vendor_name || '—',
    poAmount: Number(row.grand_total || 0),
    poDate: formatDate(row.po_date),
    status: cfoPoStatusLabel(row.status),
  }));

  const [vendorRows] = await pool.query(
    `SELECT
       COALESCE(NULLIF(TRIM(po.vendor_name), ''), 'Unknown Vendor') AS vendor_name,
       COALESCE(NULLIF(TRIM(e.name), ''), NULLIF(TRIM(po.entity), ''), '—') AS entity_name,
       COUNT(*) AS po_count,
       COALESCE(SUM(po.grand_total), 0) AS total_po_amount
     FROM purchase_orders po
     LEFT JOIN entity_masters e ON e.id = po.entity_id
     WHERE po.status NOT IN (${excludedSql})
     GROUP BY vendor_name, entity_name
     ORDER BY total_po_amount DESC
     LIMIT 10`
  );

  const topVendorsByPOAmount = vendorRows.map((row) => ({
    vendorName: row.vendor_name,
    entity: row.entity_name,
    totalPOAmount: Number(row.total_po_amount || 0),
    poCount: Number(row.po_count || 0),
  }));

  const totalPoAmount = Number(kpi?.total_po_amount || 0);
  const approvedPoAmount = Number(kpi?.approved_po_amount || 0);
  const pendingPoAmount = Number(kpi?.pending_po_amount || 0);
  const vendorPayments = Number(payments?.paid_value || 0);
  const budgetUtilization =
    totalPoAmount > 0 ? Math.round((approvedPoAmount / totalPoAmount) * 1000) / 10 : 0;

  return {
    kpis: {
      totalPOAmount: totalPoAmount,
      entityWiseSpend: totalPoAmount,
      approvedPOAmount: approvedPoAmount,
      pendingPOAmount: pendingPoAmount,
      totalVendorPayments: vendorPayments,
      budgetUtilization,
      totalPOCount: Number(kpi?.total_po_count || 0),
      entityCount: entityWisePOSummary.length,
    },
    entityWisePOSummary,
    monthlyPOTrend,
    monthlySeries: seriesKeys.map(({ key, label, color }) => ({ key, label, color })),
    recentPurchaseOrders,
    topVendorsByPOAmount,
  };
}
