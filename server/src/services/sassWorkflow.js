/**
 * SASS purchase-type workflow helpers.
 * Chain: Requester → L1 (selected) → L2 (Srivaths) → Mugesh (approve + invoice) → Accounts.
 * SCM is never involved. Invoice is uploaded by Mugesh on the same approval step.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { ensureApproverUser } from './refexOneService.js';
import { nextDocumentNumber } from './documentNumberService.js';
import { formatDateTime } from '../utils/constants.js';
import { uploadToGcs, gcsEnabled } from './gcsStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVOICE_DIR = path.resolve(__dirname, '../../uploads/invoices');
if (!fs.existsSync(INVOICE_DIR)) fs.mkdirSync(INVOICE_DIR, { recursive: true });

export const SASS_L2_EMAIL = 'srivaths.varadharajan@refex.co.in';
export const SASS_L2_NAME = 'Srivaths Varadharajan';
export const SASS_MUGESH_EMAIL = 'mugesh.m@refex.co.in';
export const SASS_MUGESH_NAME = 'Mugesh';

export function isSassPurchaseType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return raw === 'sass' || raw === 'saas' || raw === 'cloud_subscription';
}

export function isSassPr(pr = {}) {
  return isSassPurchaseType(pr.purchase_type || pr.purchaseType);
}

/** Resolve vendor from Create PR payload (SASS — from recommended RFQ vendor). */
export async function resolveSassVendorFromBody(body = {}) {
  const vendors = Array.isArray(body.rfqVendors || body.rfq_vendors)
    ? body.rfqVendors || body.rfq_vendors
    : [];
  const recEmail = String(
    body.rfqRecommendedVendorEmail || body.recommendedVendorEmail || ''
  )
    .trim()
    .toLowerCase();
  const recName = String(
    body.rfqRecommendedVendorName || body.recommendedVendorName || ''
  ).trim();

  let picked = null;
  if (recEmail || recName) {
    picked = vendors.find(
      (v) =>
        (recEmail && String(v.email || '').trim().toLowerCase() === recEmail) ||
        (recName && String(v.name || '').trim().toLowerCase() === recName.toLowerCase())
    );
  }
  if (!picked && vendors.length === 1) picked = vendors[0];

  const vendorId = Number(
    picked?.vendorId || picked?.id || body.vendorId || body.sassVendorId || body.preferred_vendor_id || 0
  );
  if (vendorId > 0) {
    const [rows] = await pool.query(
      `SELECT id, name, email FROM vendors WHERE id = ? AND status = 'active' LIMIT 1`,
      [vendorId]
    );
    if (!rows.length) throw new Error('Selected vendor not found or inactive');
    return {
      vendorId: rows[0].id,
      vendorName: rows[0].name,
      vendorEmail: rows[0].email || '',
    };
  }

  const vendorName = String(
    picked?.name || body.vendorName || body.sassVendorName || recName || ''
  ).trim();
  const vendorEmail = String(
    picked?.email || body.vendorEmail || body.sassVendorEmail || recEmail || ''
  ).trim();
  if (vendorName) {
    return { vendorId: null, vendorName, vendorEmail };
  }
  return null;
}

export async function resolveSassL2Assignment(departmentId = null) {
  const userId = await ensureApproverUser(
    { email: SASS_L2_EMAIL, name: SASS_L2_NAME },
    'PR Manager',
    departmentId
  );
  return { userId, email: SASS_L2_EMAIL, name: SASS_L2_NAME };
}

export async function resolveSassMugeshAssignment(departmentId = null) {
  const userId = await ensureApproverUser(
    { email: SASS_MUGESH_EMAIL, name: SASS_MUGESH_NAME },
    'CFO',
    departmentId
  );
  return { userId, email: SASS_MUGESH_EMAIL, name: SASS_MUGESH_NAME };
}

export async function createSassL2ApprovalTask(conn, prId, departmentId = null) {
  const assignee = await resolveSassL2Assignment(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'PR Manager', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );
  return assignee;
}

export async function createSassMugeshApprovalTask(conn, prId, departmentId = null) {
  const assignee = await resolveSassMugeshAssignment(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'CFO', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );
  return assignee;
}

export async function createSassInvoiceUploadTask(conn, prId, requesterId) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'INVOICE_UPLOAD', 'Requester', ?, 'pending', ?)`,
    [prId, requesterId, dueDate.toISOString().split('T')[0]]
  );
}

/**
 * After Mugesh approval: create a shell PO + invoice stub.
 * Invoice is uploaded by Mugesh on the same approval step (no requester task).
 */
export async function openSassInvoiceStage(conn, pr, actorUser, options = {}) {
  const createRequesterTask = options.createRequesterTask === true;
  const prId = Number(pr.id);
  const [existingPo] = await conn.query(
    `SELECT id FROM purchase_orders WHERE pr_id = ? ORDER BY id DESC LIMIT 1`,
    [prId]
  );
  let poId = existingPo[0]?.id || null;

  const [prLines] = await conn.query(
    `SELECT item_name, description, quantity, unit, unit_cost, gst_percentage
     FROM pr_line_items WHERE pr_id = ? ORDER BY id ASC`,
    [prId]
  );

  const subtotal = Number(pr.total_amount) || 0;
  const taxAmount = 0;
  const grandTotal = subtotal;

  if (!poId) {
    const poNumber = await nextDocumentNumber('PO', pr.entity_id || null, conn);
    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, pr_id, vendor_name, vendor_email, created_by,
        delivery_address, payment_terms, po_type, purchase_type,
        entity_id, currency, subtotal, tax_amount, grand_total, status, gst_percentage)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'short_po', 'sass', ?, ?, ?, ?, ?, 'invoice_entry', 0)`,
      [
        poNumber,
        prId,
        String(pr.vendor_name || 'Cloud Subscription Vendor').slice(0, 255) || 'Cloud Subscription Vendor',
        'sass-invoice@placeholder.local',
        actorUser?.id || pr.requester_id,
        pr.place_of_delivery || pr.billing_address || null,
        pr.payment_terms || 'Net 30 Days',
        pr.entity_id || null,
        pr.currency || 'INR',
        subtotal,
        taxAmount,
        grandTotal,
      ]
    );
    poId = poResult.insertId;

    for (const li of prLines) {
      const qty = Number(li.quantity) || 1;
      const unitPrice = Number(li.unit_cost) || 0;
      const lineTotal = Math.round(qty * unitPrice * 100) / 100;
      await conn.query(
        `INSERT INTO po_line_items
         (po_id, item_name, description, quantity, unit, unit_price, tax_percentage, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          poId,
          li.item_name || li.description || 'Item',
          li.description || li.item_name || 'Item',
          qty,
          li.unit || 'Nos',
          unitPrice,
          Number(li.gst_percentage) || 0,
          lineTotal,
        ]
      );
    }
  } else {
    await conn.query(
      `UPDATE purchase_orders SET status = 'invoice_entry', updated_at = NOW() WHERE id = ?`,
      [poId]
    );
  }

  const [existingInv] = await conn.query(
    `SELECT id FROM invoices WHERE po_id = ? ORDER BY id DESC LIMIT 1`,
    [poId]
  );
  let invoiceId = existingInv[0]?.id || null;
  if (!invoiceId) {
    const history = [
      {
        action: 'Cloud Subscription invoice base created for Mugesh upload',
        performedBy: actorUser?.name || 'System',
        role: actorUser?.role || 'System',
        date: formatDateTime(new Date()),
        notes: 'Mugesh uploads invoice on approval — SCM skipped',
      },
    ];
    const [invResult] = await conn.query(
      `INSERT INTO invoices
       (invoice_number, po_id, grn_id, pr_id, status, vendor_name,
        invoice_subtotal, invoice_tax, invoice_grand_total, po_grand_total, grn_received_value,
        approval_history, created_by)
       VALUES (?, ?, NULL, ?, 'awaiting_upload', ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        null,
        poId,
        prId,
        String(pr.vendor_name || 'Cloud Subscription Vendor').slice(0, 255) || 'Cloud Subscription Vendor',
        subtotal,
        taxAmount,
        grandTotal,
        grandTotal,
        JSON.stringify(history),
        actorUser?.id || pr.requester_id,
      ]
    );
    invoiceId = invResult.insertId;
  }

  if (createRequesterTask) {
    await createSassInvoiceUploadTask(conn, prId, pr.requester_id);
  }
  return { poId, invoiceId };
}

async function saveSassInvoiceAttachment(invoiceId, fileName, fileData) {
  if (!fileData || !fileName) throw new Error('Invoice file is required');
  const raw = String(fileData).includes(',') ? String(fileData).split(',')[1] : String(fileData);
  const buffer = Buffer.from(raw, 'base64');
  const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const stored = `inv_${invoiceId}_${Date.now()}_${safe}`;
  if (gcsEnabled()) {
    await uploadToGcs(`invoices/${stored}`, buffer);
  } else {
    fs.writeFileSync(path.join(INVOICE_DIR, stored), buffer);
  }
  return { fileName: safe, filePath: stored, buffer };
}

/** Save invoice file + mark invoice pending_verification (Mugesh same-step upload). */
export async function applySassMugeshInvoiceUpload(conn, invoiceId, user, body = {}) {
  const invoiceNumber = String(body.invoiceNumber || '').trim();
  if (!invoiceNumber) throw new Error('Invoice number is required');
  if (!body.fileName || !body.fileData) throw new Error('Invoice file is required');

  const [rows] = await conn.query(`SELECT * FROM invoices WHERE id = ? FOR UPDATE`, [invoiceId]);
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];

  const { fileName, filePath, buffer } = await saveSassInvoiceAttachment(
    invoiceId,
    body.fileName,
    body.fileData
  );

  let history = [];
  try {
    history = inv.approval_history
      ? typeof inv.approval_history === 'string'
        ? JSON.parse(inv.approval_history)
        : inv.approval_history
      : [];
  } catch {
    history = [];
  }
  if (!Array.isArray(history)) history = [];
  history.push({
    action: 'Invoice uploaded by Mugesh',
    performedBy: user?.name || 'Mugesh',
    role: user?.role || 'CFO',
    date: formatDateTime(new Date()),
    notes: body.remarks || `Uploaded ${fileName}`,
  });

  const subtotal = Number(body.invoiceSubtotal ?? inv.invoice_subtotal) || Number(inv.po_grand_total) || 0;
  const tax = Number(body.invoiceTax ?? inv.invoice_tax) || 0;
  const grand = Number(body.invoiceGrandTotal ?? inv.invoice_grand_total) || subtotal + tax;

  await conn.query(
    `UPDATE invoices SET
       invoice_number = ?,
       invoice_date = ?,
       due_date = ?,
       invoice_subtotal = ?,
       invoice_tax = ?,
       invoice_grand_total = ?,
       invoice_file_name = ?,
       invoice_file_path = ?,
       vendor_invoice_mode = 'manual',
       status = 'pending_verification',
       submitted_at = NOW(),
       approval_history = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [
      invoiceNumber,
      body.invoiceDate || new Date().toISOString().slice(0, 10),
      body.dueDate || null,
      subtotal,
      tax,
      grand,
      fileName,
      filePath,
      JSON.stringify(history),
      invoiceId,
    ]
  );

  await conn.query(
    `UPDATE purchase_orders SET status = 'invoice_entry', updated_at = NOW() WHERE id = ?`,
    [inv.po_id]
  );

  return {
    invoiceId,
    invoiceNumber,
    fileName,
    filePath,
    buffer,
    grandTotal: grand,
  };
}

export async function completeSassInvoiceUploadTask(connOrPool, prId) {
  const db = connOrPool || pool;
  await db.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'INVOICE_UPLOAD' AND status = 'pending'`,
    [prId]
  );
}

export const SASS_ITDEV_NOTIFY_EMAIL = 'itdev@refex.co.in';
export const SASS_ACCOUNTS_NOTIFY_EMAIL = 'accounts_rgml_refexev@refex.co.in';

/**
 * After Mugesh uploads invoice — notify:
 * Requester, L1 (user approver), L2 (Srivaths), Accounts (accounts_rgml_refexev), itdev.
 */
export async function resolveSassInvoiceUploadedRecipients(prId) {
  const [prRows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.approval_user_id, pr.approval_user_ids,
            pr.total_amount, pr.currency, pr.entity_id, pr.requester_id,
            pr.vendor_name, pr.justification,
            e.name AS entity_name, e.code AS entity_code,
            au.email AS approval_user_email, au.name AS approval_user_name,
            ru.email AS requester_email, ru.name AS requester_name
     FROM purchase_requests pr
     LEFT JOIN users au ON au.id = pr.approval_user_id
     LEFT JOIN users ru ON ru.id = pr.requester_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     WHERE pr.id = ?
     LIMIT 1`,
    [prId]
  );
  const pr = prRows[0];
  if (!pr) return { pr: null, recipients: [] };

  const recipients = [];
  const seen = new Set();
  const push = (email, name) => {
    const e = String(email || '')
      .trim()
      .toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    recipients.push({ email: e, name: name || e.split('@')[0] });
  };

  // Requester
  if (pr.requester_email) push(pr.requester_email, pr.requester_name);

  // L1 / User Approver — prefer first HOD approve on this PR
  const [l1Hist] = await pool.query(
    `SELECT u.email, u.name
     FROM pr_approvals pa
     JOIN users u ON u.id = pa.approver_id
     WHERE pa.pr_id = ?
       AND pa.action = 'approve'
       AND (pa.stage = 'HOD_REVIEW' OR pa.stage LIKE '%HOD%')
     ORDER BY pa.id ASC
     LIMIT 1`,
    [prId]
  );
  if (l1Hist[0]?.email) {
    push(l1Hist[0].email, l1Hist[0].name);
  } else if (pr.approval_user_email) {
    push(pr.approval_user_email, pr.approval_user_name);
  } else {
    let chain = [];
    try {
      const raw = pr.approval_user_ids;
      chain = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : [];
    } catch {
      chain = [];
    }
    const firstId = Number(chain[0]) || 0;
    if (firstId > 0) {
      const [uRows] = await pool.query(
        `SELECT email, name FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
        [firstId]
      );
      if (uRows[0]?.email) push(uRows[0].email, uRows[0].name);
    }
  }

  // L2 Srivaths
  push(SASS_L2_EMAIL, SASS_L2_NAME);

  // Accounts team mailbox + IT Dev
  push(SASS_ACCOUNTS_NOTIFY_EMAIL, 'Accounts');
  push(SASS_ITDEV_NOTIFY_EMAIL, 'IT Dev');

  return {
    pr: {
      id: pr.id,
      prNumber: pr.pr_number,
      title: pr.title,
      totalAmount: Number(pr.total_amount) || 0,
      currency: pr.currency || 'INR',
      entityName: pr.entity_name,
      entityCode: pr.entity_code,
      entity_name: pr.entity_name,
      entity_code: pr.entity_code,
      vendorName: pr.vendor_name || '',
      vendor_name: pr.vendor_name || '',
      justification: pr.justification || '',
      requesterName: pr.requester_name || '',
      requester_name: pr.requester_name || '',
    },
    recipients,
  };
}
