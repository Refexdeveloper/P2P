/**
 * SASS purchase-type workflow helpers.
 * Chain: Requester → L1 (selected) → L2 (Srivaths) → Mugesh → Requester invoice → Accounts.
 * SCM is never involved.
 */
import pool from '../config/db.js';
import { ensureApproverUser } from './refexOneService.js';
import { nextDocumentNumber } from './documentNumberService.js';
import { formatDateTime } from '../utils/constants.js';

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
 * After Mugesh approval: create a shell PO + invoice stub (awaiting_upload) so
 * the requester can upload via existing invoice UI and Accounts can verify —
 * without any SCM RFQ / Create PO step.
 */
export async function openSassInvoiceStage(conn, pr, actorUser) {
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
        action: 'Cloud Subscription invoice base created after Mugesh approval',
        performedBy: actorUser?.name || 'System',
        role: actorUser?.role || 'System',
        date: formatDateTime(new Date()),
        notes: 'Awaiting requester invoice upload — SCM skipped',
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

  await createSassInvoiceUploadTask(conn, prId, pr.requester_id);
  return { poId, invoiceId };
}

export async function completeSassInvoiceUploadTask(connOrPool, prId) {
  const db = connOrPool || pool;
  await db.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND task_type = 'INVOICE_UPLOAD' AND status = 'pending'`,
    [prId]
  );
}

/** L1 + Srivaths + Mugesh — notify that Cloud Subscription invoice was uploaded. */
export async function resolveSassInvoiceUploadedRecipients(prId) {
  const [prRows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.approval_user_id, pr.approval_user_ids,
            pr.total_amount, pr.currency, pr.entity_id,
            e.name AS entity_name, e.code AS entity_code,
            au.email AS approval_user_email, au.name AS approval_user_name
     FROM purchase_requests pr
     LEFT JOIN users au ON au.id = pr.approval_user_id
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

  // L1 — prefer first HOD approve on this PR, else approval_user_id / approval_user_ids
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

  // Fixed Cloud Subscription approvers
  push(SASS_L2_EMAIL, SASS_L2_NAME);
  push(SASS_MUGESH_EMAIL, SASS_MUGESH_NAME);

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
    },
    recipients,
  };
}
