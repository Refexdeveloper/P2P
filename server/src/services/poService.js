import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from '../config/db.js';
import { getPurchaseRequestById } from './prService.js';
import { generatePoPdf, PO_UPLOAD_DIR, resolvePoDocumentPath } from './poPdfService.js';
import { sendPoVendorNotification, queuePoWorkflowNotification } from './emailService.js';
import { formatDate, formatDateTime, PR_STATUS } from '../utils/constants.js';
import { getLetterheadByType } from './poLetterheadService.js';
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
import { resolveScmBuyerUser, getScmBuyerNotifyEmails } from '../utils/scmAssignee.js';
import { getWhatsAppPublicBaseUrl } from './whatsappService.js';

function poPortalUrl(path) {
  const base = getWhatsAppPublicBaseUrl().replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function resolveRoleEmails(role) {
  if (role === 'SCM Buyer') {
    const emails = await getScmBuyerNotifyEmails();
    return emails.map((email) => ({ email, name: 'SCM Buyer' }));
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

function lineItemTotal(quantity, unitPrice) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return Math.round(gross * 100) / 100;
}

function lineItemTax(total, taxPercentage) {
  return Math.round(((Number(total) || 0) * (Number(taxPercentage) || 0)) / 100 * 100) / 100;
}

async function getLineItems(poId) {
  const [rows] = await pool.query(`SELECT * FROM po_line_items WHERE po_id = ? ORDER BY id`, [poId]);
  return rows.map((r) => ({
    id: r.id,
    category: r.category || '',
    itemName: r.item_name || '',
    description: r.description,
    quantity: r.quantity,
    unitPrice: Number(r.unit_price),
    discount: Number(r.discount) || 0,
    taxPercentage: Number(r.tax_percentage) || 0,
    total: Number(r.total),
  }));
}

async function enrichPO(row) {
  const pr = row.pr_id ? await getPurchaseRequestById(row.pr_id) : null;
  const lineItems = await getLineItems(row.id);

  const [vendorRows] = await pool.query(
    `SELECT name, email, address, gst_number, pan_number, phone
     FROM vendors
     WHERE email = ? OR name = ?
     LIMIT 1`,
    [row.vendor_email, row.vendor_name]
  );
  const vendor = vendorRows[0] || {};
  const [creatorRows] = await pool.query(`SELECT name, role FROM users WHERE id = ?`, [row.created_by]);
  const creator = creatorRows[0] || {};
  const approvalHistory = await getFullPoApprovalHistory(row);

  return {
    id: row.id,
    poNumber: row.po_number,
    referencePoNumber: row.reference_po_number || '',
    prId: row.pr_id,
    prNumber: pr?.prNumber || '',
    prTitle: pr?.title || '',
    department: pr?.department || '',
    requester: pr?.requester || '',
    vendorName: row.vendor_name,
    vendorEmail: row.vendor_email,
    vendorAddress: vendor.address || '',
    vendorGst: vendor.gst_number || '',
    vendorPan: vendor.pan_number || '',
    vendorPhone: vendor.phone || '',
    deliveryAddress: row.delivery_address,
    expectedDeliveryDate: formatDate(row.expected_delivery_date),
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
    termsClauses: parseClauseJson(row.terms_clauses),
    annexureClauses: parseClauseJson(row.annexure_clauses),
    poTermsDetails: normalizePoTermsDetails(row.po_terms_details),
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
    vendorAcceptanceToken: row.vendor_acceptance_token || null,
    pdfPath: row.pdf_path,
    signedPdfPath: row.signed_pdf_path,
    signatureName: row.signature_name,
    signatureImagePath: row.signature_image_path || null,
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
      lineItems: pr.lineItems,
    },
    vendor: {
      name: vendor.vendor_name,
      email: vendor.vendor_email,
      paymentTerms: quote.payment_terms || 'Net 30 Days',
      deliveryTerms: quote.delivery_terms || 'DDP',
      quotedPrice: Number(quote.quoted_price) || pr.totalAmount,
    },
  };
}

async function lookupVendorMaster(vendorEmail, vendorName) {
  const [vendorRows] = await pool.query(
    `SELECT name, email, address, gst_number, pan_number, phone
     FROM vendors
     WHERE email = ? OR name = ?
     LIMIT 1`,
    [vendorEmail, vendorName]
  );
  return vendorRows[0] || {};
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
    poNumber,
    poTermsDetails: bodyPoTermsDetails,
  } = body || {};

  const resolvedPoTermsDetails = normalizePoTermsDetails(bodyPoTermsDetails);
  // Prefer free-text payment terms from Terms tab when provided
  const resolvedPaymentTerms =
    String(resolvedPoTermsDetails.paymentTermsText || '').trim() || paymentTerms;

  const normalizedPoType = poType === 'long_po' ? 'long_po' : 'short_po';
  let resolvedLetterhead = letterheadHeader ?? '';
  let resolvedLetterheadId = body?.letterheadId ? Number(body.letterheadId) : null;
  let resolvedEntity = body?.entity ?? '';
  let resolvedHeaderLogo = body?.headerLogo ?? '';
  let resolvedFooterLogo = body?.footerLogo ?? '';
  let resolvedTerms = terms;
  let resolvedAnnexure = annexure;

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

  if (!resolvedTerms.length || !resolvedAnnexure.length || !resolvedLetterhead) {
    try {
      const master = await getLetterheadByType(normalizedPoType);
      resolvedLetterhead = resolvedLetterhead || master.letterheadHeader || '';
      if (!resolvedTerms.length) resolvedTerms = master.terms || [];
      if (!resolvedAnnexure.length) resolvedAnnexure = master.annexure || [];
    } catch {
      /* master optional when client already sent full content */
    }
  }

  const mappedLineItems = lineItems.map((item) => {
    const taxPercentage = Math.min(100, Math.max(0, Number(item.taxPercentage ?? item.tax_percentage ?? gstPercentage) || 0));
    const total = lineItemTotal(item.quantity, item.unitPrice);
    return {
      itemName: item.itemName || item.name || '',
      description: item.description,
      category: item.category || '',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: 0,
      taxPercentage,
      total,
      taxAmount: lineItemTax(total, taxPercentage),
    };
  });

  const subtotal = mappedLineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = mappedLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const effectiveGst =
    subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : Number(gstPercentage) || 0;
  const grandTotal = subtotal + taxAmount;
  const resolvedCurrency = normalizeCurrency(body?.currency || pr.currency);
  const resolvedPurchaseType = normalizePurchaseType(body?.purchaseType || pr.purchaseType);

  return {
    poNumber: poNumber || `DRAFT-${pr.prNumber}`,
    createdAt: new Date(),
    prNumber: pr.prNumber,
    prTitle: pr.title,
    department: pr.department,
    requester: pr.requester,
    vendorName: vendor.vendor_name,
    vendorEmail: vendor.vendor_email,
    vendorAddress: vendorMaster.address || '',
    vendorGst: vendorMaster.gst_number || '',
    vendorPan: vendorMaster.pan_number || '',
    vendorPhone: vendorMaster.phone || '',
    deliveryAddress,
    expectedDeliveryDate,
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

export async function buildPoPreviewDocument(user, prId, body) {
  if (user.role !== 'SCM Buyer' && user.role !== 'SCM Manager') {
    throw new Error('Unauthorized to preview purchase orders');
  }
  if (!body?.lineItems?.length) throw new Error('At least one line item is required for preview');
  return resolvePoDraftContent(prId, body);
}

export async function buildPoPreviewForPo(user, poId, body) {
  if (user.role !== 'SCM Manager' && user.role !== 'SCM Buyer') {
    throw new Error('Unauthorized to preview PO edits');
  }
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  const editable =
    (user.role === 'SCM Manager' && rows[0].status === 'pending_approval') ||
    (user.role === 'SCM Buyer' && rows[0].status === 'pending_buyer_verify');
  if (!editable) throw new Error('Only pending / buyer-verify POs can be edited');
  if (!body?.lineItems?.length) throw new Error('At least one line item is required for preview');
  return resolvePoDraftContent(rows[0].pr_id, {
    ...body,
    poNumber: rows[0].po_number,
    terms: body.terms ?? body.termsClauses,
    annexure: body.annexure ?? body.annexureClauses,
  });
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
  const requestedPoNumber = String(body?.poNumber || body?.existingPoNumber || '').trim() || null;
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

    let poNumber = requestedPoNumber;
    if (poNumber) {
      const [dup] = await conn.query(
        `SELECT id FROM purchase_orders WHERE LOWER(po_number) = LOWER(?) LIMIT 1`,
        [poNumber]
      );
      if (dup.length) throw new Error(`${docLabel} number ${poNumber} already exists`);
    } else {
      poNumber = await generatePoNumber(entityIdForNumber, purchaseType, conn);
    }

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
        delivery_address, expected_delivery_date, payment_terms, incoterms, special_instructions,
        po_type, purchase_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
        po_terms_details, gst_percentage, currency, subtotal, tax_amount, grand_total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit_price, discount, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, '', itemName || null, description, item.quantity, item.unitPrice, 0, taxPercentage, total]
      );
    }

    if (!skipApproval) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
         VALUES (?, 'PO_APPROVAL', 'SCM Manager', 'pending', ?)`,
        [prId, dueDate.toISOString().split('T')[0]]
      );
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
  } else if (user.role === 'SCM Buyer') {
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
  return { status: s || 'unknown', statusLabel: statusRaw || 'Unknown' };
}

/**
 * Paginated Track PO feed: Ready-for-PO PRs + purchase orders.
 * Query: page, limit, search, status (all|ready|pending|approved|rejected|sent|imported|draft)
 * Uses indexed filters; stats use separate COUNT queries (no triple UNION scan).
 */
export async function listTrackPurchaseOrders(
  user,
  { page = 1, limit = 10, search = '', status = 'all', purchaseType = 'all' } = {}
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

  const buyerPoFilter = user.role === 'SCM Buyer' ? ' AND po.created_by = ?' : '';
  const readyParams = [PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED];
  const poParams = user.role === 'SCM Buyer' ? [user.id] : [];

  const includeReady =
    statusFilter === 'all' || statusFilter === 'ready';
  const includePo =
    statusFilter !== 'ready' &&
    (statusFilter === 'all' ||
      ['pending', 'approved', 'rejected', 'sent', 'imported', 'draft'].includes(statusFilter));

  const readyTypeFilter = typeSqlValue
    ? ` AND COALESCE(pr.purchase_type, 'purchase_order') = ?`
    : '';
  const poTypeFilter = typeSqlValue
    ? ` AND COALESCE(po.purchase_type, pr.purchase_type, 'purchase_order') = ?`
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
      pr.required_date AS required_date,
      COALESCE(pr.submitted_at, pr.created_at) AS sort_at
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
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
  `;

  const poSql = `
    SELECT
      CONCAT('po-', po.id) COLLATE utf8mb4_unicode_ci AS row_key,
      'po' COLLATE utf8mb4_unicode_ci AS kind,
      po.pr_id AS pr_id,
      po.id AS po_id,
      COALESCE(pr.pr_number, '') COLLATE utf8mb4_unicode_ci AS pr_number,
      po.po_number COLLATE utf8mb4_unicode_ci AS po_number,
      COALESCE(pr.title, '') COLLATE utf8mb4_unicode_ci AS title,
      COALESCE(d.name, '') COLLATE utf8mb4_unicode_ci AS department,
      COALESCE(u.name, '') COLLATE utf8mb4_unicode_ci AS requester,
      COALESCE(po.vendor_name, '') COLLATE utf8mb4_unicode_ci AS vendor_name,
      po.grand_total AS amount,
      CAST(po.status AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS status_raw,
      CAST(COALESCE(po.purchase_type, pr.purchase_type, 'purchase_order') AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS purchase_type,
      po.expected_delivery_date AS required_date,
      po.created_at AS sort_at
    FROM purchase_orders po
    LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
    LEFT JOIN departments d ON d.id = pr.department_id
    LEFT JOIN users u ON u.id = pr.requester_id
    WHERE 1=1
    ${buyerPoFilter}
    ${poTypeFilter}
  `;

  const unionParts = [];
  const baseParams = [];
  if (includeReady) {
    unionParts.push(`(${readySql})`);
    baseParams.push(...readyParams);
    if (typeSqlValue) baseParams.push(typeSqlValue);
  }
  if (includePo) {
    unionParts.push(`(${poSql})`);
    baseParams.push(...poParams);
    if (typeSqlValue) baseParams.push(typeSqlValue);
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
  }

  if (q) {
    whereExtra += ` AND (
      LOWER(COALESCE(t.pr_number,'')) LIKE ?
      OR LOWER(COALESCE(t.po_number,'')) LIKE ?
      OR LOWER(COALESCE(t.title,'')) LIKE ?
      OR LOWER(COALESCE(t.vendor_name,'')) LIKE ?
      OR LOWER(COALESCE(t.department,'')) LIKE ?
      OR LOWER(COALESCE(t.requester,'')) LIKE ?
    )`;
    const like = `%${q}%`;
    filterParams.push(like, like, like, like, like, like);
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
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
    FROM purchase_orders
    WHERE 1=1
  `;
  const poParams = [];
  if (user.role === 'SCM Buyer') {
    poSql += ' AND created_by = ?';
    poParams.push(user.id);
  }

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

export function resolvePoPdfPath(po) {
  return resolvePoDocumentPath(po);
}

async function collectParticipantEmails(prId) {
  const pr = await getPurchaseRequestById(prId);
  const emails = new Set();

  const [requester] = await pool.query(`SELECT email FROM users WHERE id = ?`, [pr.requesterId]);
  if (requester[0]?.email) emails.add(requester[0].email);

  const [hod] = await pool.query(
    `SELECT email FROM users WHERE role = 'HOD Approver' AND department_id = ? AND is_active = 1`,
    [pr.departmentId]
  );
  hod.forEach((r) => emails.add(r.email));

  for (const role of ['PR Manager', 'CFO', 'SCM Buyer', 'SCM Manager']) {
    const [rows] = await pool.query(`SELECT email FROM users WHERE role = ? AND is_active = 1`, [role]);
    rows.forEach((r) => emails.add(r.email));
  }

  const notify = (process.env.PR_NOTIFY_EMAIL || 'sathishkumar.r@refex.co.in')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  notify.forEach((e) => emails.add(e));

  return [...emails];
}

export async function signPurchaseOrder(user, poId, {
  remarks,
  signatureName,
  signatureImage,
  signatureId,
  saveToGallery,
}) {
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can sign purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_approval') throw new Error('PO is not pending approval');

  const signName = signatureName?.trim() || user.name;
  if (!remarks?.trim()) throw new Error('Comments are required for signing');

  const {
    parseDataUrlImage,
    saveSignatureFile,
    getUserSignatureImage,
    saveUserSignature,
  } = await import('./signatureService.js');

  let imageDataUrl = null;
  let signatureImagePath = null;

  if (signatureId) {
    const gallery = await getUserSignatureImage(user.id, Number(signatureId));
    imageDataUrl = gallery.dataUrl;
    const { ext, buffer } = parseDataUrlImage(gallery.dataUrl);
    signatureImagePath = saveSignatureFile(buffer, ext, `po_${poId}_${Date.now()}`);
  } else if (signatureImage) {
    const { ext, buffer, dataUrl } = parseDataUrlImage(signatureImage);
    imageDataUrl = dataUrl;
    signatureImagePath = saveSignatureFile(buffer, ext, `po_${poId}_${Date.now()}`);
    if (saveToGallery) {
      await saveUserSignature(user.id, { image: dataUrl, label: `${signName} Signature` });
    }
  } else {
    throw new Error('Please provide a signature (draw, upload, or select from gallery)');
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
    },
  });

  await pool.query(
    `UPDATE purchase_orders SET status = 'pending_buyer_verify', signed_pdf_path = ?, signer_id = ?,
     signature_name = ?, signature_image_path = ?, signer_comments = ?, signed_at = NOW(),
     updated_at = NOW()
     WHERE id = ?`,
    [fileName, user.id, signName, signatureImagePath, remarks.trim(), poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND assigned_role = 'SCM Manager' AND status = 'pending'`,
    [po.prId]
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const scmBuyer = await resolveScmBuyerUser();
  await pool.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PO_BUYER_VERIFY', 'SCM Buyer', ?, 'pending', ?)`,
    [po.prId, null, dueDate.toISOString().split('T')[0]]
  );

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, 'PO_SIGNED', ?, 'approve', ?)`,
    [po.prId, user.id, remarks.trim() || 'Signed — sent to SCM Buyer for final verify']
  );

  const updated = await getPurchaseOrderById(poId);
  const buyerEmails = await getScmBuyerNotifyEmails();
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
    remarks?.trim() || 'Final verified by SCM Buyer — ready for vendor acceptance';
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

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
     VALUES (?, 'PO_BUYER_VERIFIED', ?, 'verified', ?)`,
    [rows[0].pr_id, user.id, verifyRemarks]
  );

  // Email / manual acceptance is done next on Vendor PO Acceptance page
  return getPurchaseOrderById(poId);
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

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
     VALUES (?, 'PO_BUYER_REJECTED', ?, 'reject', ?)`,
    [rows[0].pr_id, user.id, remarks.trim()]
  );

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

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  await pool.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
     VALUES (?, 'PO_APPROVAL', 'SCM Manager', 'pending', ?)`,
    [rows[0].pr_id, dueDate.toISOString().split('T')[0]]
  );

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
     VALUES (?, 'PO_BUYER_SENT_BACK', ?, 'return', ?)`,
    [rows[0].pr_id, user.id, remarks.trim()]
  );

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

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
     VALUES (?, 'PO_REJECTED', ?, 'reject', ?)`,
    [rows[0].pr_id, user.id, remarks.trim()]
  );

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
  if (!canManagerEdit && !canBuyerEdit) {
    throw new Error('You are not allowed to edit this purchase order');
  }

  const draft = await resolvePoDraftContent(existing.pr_id, {
    ...body,
    poNumber: existing.po_number,
    currency: body.currency ?? existing.currency,
    terms: body.terms ?? body.termsClauses,
    annexure: body.annexure ?? body.annexureClauses,
  });

  const {
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
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
    (canBuyerEdit
      ? 'PO updated by SCM Buyer during final verify'
      : 'PO updated by SCM Manager before approval');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const referencePoNumber =
      body.referencePoNumber !== undefined
        ? body.referencePoNumber?.trim() || null
        : existing.reference_po_number;

    await conn.query(
      `UPDATE purchase_orders SET
        reference_po_number = ?,
        delivery_address = ?, expected_delivery_date = ?, payment_terms = ?, incoterms = ?,
        special_instructions = ?, po_type = ?, letterhead_header = ?, letterhead_id = ?, entity = ?,
        header_logo = ?, footer_logo = ?, terms_clauses = ?,
        annexure_clauses = ?, po_terms_details = ?, gst_percentage = ?, currency = ?, subtotal = ?, tax_amount = ?, grand_total = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        referencePoNumber,
        deliveryAddress,
        expectedDeliveryDate,
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
        `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit_price, discount, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, '', itemName || null, description, item.quantity, item.unitPrice, 0, taxPercentage, total]
      );
    }

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_UPDATED', ?, 'updated', ?)`,
      [existing.pr_id, user.id, changeSummary]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const updatedPo = await getPurchaseOrderById(poId);

  // Buyer edits after Manager sign: refresh draft + re-embed existing signature into signed PDF
  if (canBuyerEdit && existing.signature_image_path) {
    const { signatureFileToDataUrl } = await import('./signatureService.js');
    const imageDataUrl = signatureFileToDataUrl(existing.signature_image_path);
    const signedFileName = `${updatedPo.poNumber}_signed.pdf`;
    const { fileName } = await generatePoPdf(updatedPo, {
      fileName: signedFileName,
      signed: true,
      signature: {
        name: existing.signature_name || updatedPo.signatureName || 'SCM Manager',
        date: updatedPo.signedAt || formatDateTime(new Date()),
        comments: existing.signer_comments || '',
        imageDataUrl,
      },
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
  if (user.role === 'SCM Buyer') {
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
  const ccEmails = await collectParticipantEmails(updatedPo.prId);
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
    ccEmails,
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
