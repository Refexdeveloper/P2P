import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { getPurchaseRequestById } from './prService.js';
import { generatePoPdf, PO_UPLOAD_DIR, resolvePoDocumentPath } from './poPdfService.js';
import { sendPoVendorNotification } from './emailService.js';
import { formatDate, formatDateTime } from '../utils/constants.js';
import { getLetterheadByType } from './poLetterheadService.js';
import {
  getActiveLetterheadBranding,
  getLetterheadMasterById,
} from './letterheadBrandingService.js';
import { nextDocumentNumber } from './documentNumberService.js';

function parseClauseJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

async function generatePoNumber(entityId, connection = pool) {
  return nextDocumentNumber('PO', entityId, connection);
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

async function getLineItems(poId) {
  const [rows] = await pool.query(`SELECT * FROM po_line_items WHERE po_id = ? ORDER BY id`, [poId]);
  return rows.map((r) => ({
    id: r.id,
    category: r.category || '',
    description: r.description,
    quantity: r.quantity,
    unitPrice: Number(r.unit_price),
    total: Number(r.total),
  }));
}

async function enrichPO(row) {
  const pr = await getPurchaseRequestById(row.pr_id);
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
    letterheadHeader: row.letterhead_header || '',
    letterheadId: row.letterhead_id || null,
    entityId: row.entity_id || null,
    entity: row.entity || '',
    headerLogo: row.header_logo || '',
    footerLogo: row.footer_logo || '',
    termsClauses: parseClauseJson(row.terms_clauses),
    annexureClauses: parseClauseJson(row.annexure_clauses),
    gstPercentage: Number(row.gst_percentage),
    subtotal: Number(row.subtotal),
    taxAmount: Number(row.tax_amount),
    grandTotal: Number(row.grand_total),
    status: mapPoStatusUI(row.status),
    statusRaw: row.status,
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

function mapPoStatusUI(status) {
  const map = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'PO Approved',
    rejected: 'PO Rejected',
    sent_to_vendor: 'PO Approved',
  };
  return map[status] || status;
}

function formatApprovalStage(stage) {
  const labels = {
    PO_CREATED: 'PO Created',
    PO_UPDATED: 'PO Updated',
    PO_SIGNED: 'SCM Manager Sign',
    PO_REJECTED: 'SCM Manager Approval',
    HOD_REVIEW: 'HOD Approval',
    RFQ_MANAGER_REVIEW: 'HOD Vendor Final Approval',
    RFQ_L2_REVIEW: 'L2 Manager Approval',
    RFQ_CFO_REVIEW: 'CFO Approval',
    BUSINESS_REVIEW: 'SCM Manager Vendor Approval',
    PR_MANAGER_REVIEW: 'L2 Manager Approval',
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
  if (normalized === 'returned') return 'Returned';
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

  const vendor = await getRecommendedVendor(prId);
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
  } = body || {};

  const normalizedPoType = poType === 'long_po' ? 'long_po' : 'short_po';
  let resolvedLetterhead = letterheadHeader ?? '';
  let resolvedLetterheadId = body?.letterheadId ? Number(body.letterheadId) : null;
  let resolvedEntity = body?.entity ?? '';
  let resolvedHeaderLogo = body?.headerLogo ?? '';
  let resolvedFooterLogo = body?.footerLogo ?? '';
  let resolvedTerms = terms;
  let resolvedAnnexure = annexure;

  // Branding from selected Letterhead Master (entity + logos) for PO PDF
  try {
    if (resolvedLetterheadId) {
      const selected = await getLetterheadMasterById(resolvedLetterheadId);
      resolvedEntity = resolvedEntity || selected.entity || '';
      resolvedHeaderLogo = resolvedHeaderLogo || selected.headerLogo || '';
      resolvedFooterLogo = resolvedFooterLogo || selected.footerLogo || '';
    } else {
      const branding = await getActiveLetterheadBranding();
      if (branding.id) resolvedLetterheadId = branding.id;
      resolvedEntity = resolvedEntity || branding.entity || '';
      resolvedHeaderLogo = resolvedHeaderLogo || branding.headerLogo || '';
      resolvedFooterLogo = resolvedFooterLogo || branding.footerLogo || '';
    }
  } catch (err) {
    if (resolvedLetterheadId) throw err;
  }

  if (!resolvedTerms.length && !resolvedAnnexure.length) {
    const master = await getLetterheadByType(normalizedPoType);
    resolvedLetterhead = resolvedLetterhead || master.letterheadHeader || '';
    resolvedTerms = master.terms || [];
    resolvedAnnexure = master.annexure || [];
  } else if (!resolvedLetterhead) {
    try {
      const master = await getLetterheadByType(normalizedPoType);
      resolvedLetterhead = master.letterheadHeader || '';
    } catch {
      /* ignore */
    }
  }

  const mappedLineItems = lineItems.map((item) => ({
    description: item.description,
    category: item.category || '',
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    total: Number(item.quantity) * Number(item.unitPrice),
  }));

  const subtotal = mappedLineItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal * Number(gstPercentage)) / 100;
  const grandTotal = subtotal + taxAmount;

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
    paymentTerms,
    incoterms,
    specialInstructions,
    poType: normalizedPoType,
    letterheadHeader: resolvedLetterhead,
    letterheadId: resolvedLetterheadId,
    entity: resolvedEntity,
    headerLogo: resolvedHeaderLogo,
    footerLogo: resolvedFooterLogo,
    termsClauses: resolvedTerms,
    annexureClauses: resolvedAnnexure,
    gstPercentage: Number(gstPercentage),
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
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can preview PO edits');
  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  if (rows[0].status !== 'pending_approval') throw new Error('Only pending POs can be edited');
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
    `SELECT id FROM purchase_orders WHERE pr_id = ? AND status IN ('pending_approval', 'approved', 'sent_to_vendor')`,
    [prId]
  );
  if (existing.length) throw new Error('A purchase order already exists for this PR');

  const vendor = await getRecommendedVendor(prId);
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

  const referencePoNumber = body.referencePoNumber?.trim() || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const poNumber = await generatePoNumber(entityIdForNumber, conn);

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
        delivery_address, expected_delivery_date, payment_terms, incoterms, special_instructions,
        po_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo, terms_clauses, annexure_clauses,
        gst_percentage, subtotal, tax_amount, grand_total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval')`,
      [
        poNumber,
        referencePoNumber,
        prId,
        vendor.vendor_name,
        vendor.vendor_email,
        vendor.id,
        user.id,
        deliveryAddress,
        expectedDeliveryDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        normalizedPoType,
        resolvedLetterhead,
        resolvedLetterheadId || null,
        entityIdForNumber,
        resolvedEntity || '',
        resolvedHeaderLogo || '',
        resolvedFooterLogo || '',
        JSON.stringify(resolvedTerms),
        JSON.stringify(resolvedAnnexure),
        gstPercentage,
        subtotal,
        taxAmount,
        grandTotal,
      ]
    );

    const poId = result.insertId;
    for (const item of lineItems) {
      const total = Number(item.quantity) * Number(item.unitPrice);
      await conn.query(
        `INSERT INTO po_line_items (po_id, category, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [poId, item.category || '', item.description, item.quantity, item.unitPrice, total]
      );
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    await conn.query(
      `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
       VALUES (?, 'PO_APPROVAL', 'SCM Manager', 'pending', ?)`,
      [prId, dueDate.toISOString().split('T')[0]]
    );

    await conn.commit();

    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'PO_CREATED', ?, 'created', ?)`,
      [prId, user.id, `PO ${poNumber} created and sent for SCM Manager approval`]
    );

    const [poRows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
    const po = await enrichPO(poRows[0]);
    const { fileName } = await generatePoPdf(po, { fileName: `${poNumber}_draft.pdf` });
    await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, poId]);
    po.pdfPath = fileName;

    return po;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPurchaseOrders(user, { pendingOnly = false } = {}) {
  let sql = `SELECT po.* FROM purchase_orders po WHERE 1=1`;
  const params = [];

  if (user.role === 'SCM Manager' && pendingOnly) {
    sql += ` AND po.status = 'pending_approval'`;
  } else if (user.role === 'SCM Buyer') {
    sql += ` AND po.created_by = ?`;
    params.push(user.id);
  }

  sql += ` ORDER BY po.created_at DESC`;
  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPO));
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
    `UPDATE purchase_orders SET status = 'sent_to_vendor', signed_pdf_path = ?, signer_id = ?,
     signature_name = ?, signature_image_path = ?, signer_comments = ?, signed_at = NOW(),
     vendor_notified_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [fileName, user.id, signName, signatureImagePath, remarks.trim(), poId]
  );

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND assigned_role = 'SCM Manager' AND status = 'pending'`,
    [po.prId]
  );

  await pool.query(
    `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, 'PO_SIGNED', ?, 'approve', ?)`,
    [po.prId, user.id, remarks.trim()]
  );

  const updatedPo = await getPurchaseOrderById(poId);
  const ccEmails = await collectParticipantEmails(po.prId);
  const pdfPath = path.join(PO_UPLOAD_DIR, fileName);

  await sendPoVendorNotification(updatedPo, {
    signerName: signName,
    signerComments: remarks.trim(),
    ccEmails,
    pdfPath,
  });

  return updatedPo;
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

  return getPurchaseOrderById(poId);
}

export async function updatePurchaseOrder(user, poId, body) {
  if (user.role !== 'SCM Manager') throw new Error('Only SCM Manager can update purchase orders');

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows.length) throw new Error('PO not found');
  const existing = rows[0];
  if (existing.status !== 'pending_approval') throw new Error('Only pending POs can be edited');

  const draft = await resolvePoDraftContent(existing.pr_id, {
    ...body,
    poNumber: existing.po_number,
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
    subtotal,
    taxAmount,
    grandTotal,
  } = draft;

  if (!lineItems.length) throw new Error('At least one line item is required');
  if (!deliveryAddress?.trim()) throw new Error('Delivery address is required');
  if (!expectedDeliveryDate) throw new Error('Expected delivery date is required');

  const changeSummary = body.changeSummary?.trim() || 'PO updated by SCM Manager before approval';

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
        annexure_clauses = ?, gst_percentage = ?, subtotal = ?, tax_amount = ?, grand_total = ?,
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
        gstPercentage,
        subtotal,
        taxAmount,
        grandTotal,
        poId,
      ]
    );

    await conn.query(`DELETE FROM po_line_items WHERE po_id = ?`, [poId]);
    for (const item of lineItems) {
      const total = Number(item.quantity) * Number(item.unitPrice);
      await conn.query(
        `INSERT INTO po_line_items (po_id, category, description, quantity, unit_price, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [poId, item.category || '', item.description, item.quantity, item.unitPrice, total]
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
  const { fileName } = await generatePoPdf(updatedPo, { fileName: `${updatedPo.poNumber}_draft.pdf` });
  await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, poId]);
  updatedPo.pdfPath = fileName;

  return updatedPo;
}
