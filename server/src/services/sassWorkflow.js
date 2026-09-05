/**
 * SASS purchase-type workflow helpers.
 * Chain: Requester → selected user approvals (L1) → Mugesh (approve) → Srivaths (L2) → Mugesh (invoice upload) → Accounts.
 * SCM is never involved.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { ensureApproverUser } from './refexOneService.js';
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

export async function createSassInvoiceUploadTask(conn, prId, departmentId = null) {
  const assignee = await resolveSassMugeshAssignment(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'INVOICE_UPLOAD', 'CFO', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );
  return assignee;
}

/**
 * After Srivaths (L2) approval: create internal shell + invoice stub and assign Mugesh invoice-upload task.
 * Cloud Subscription does NOT consume PO/WO document numbers and has no PO document.
 */
export async function openSassInvoiceStage(conn, pr, actorUser, options = {}) {
  const createMugeshInvoiceTask = options.createMugeshInvoiceTask !== false;
  const prId = Number(pr.id);
  const [existingPo] = await conn.query(
    `SELECT id, po_number FROM purchase_orders WHERE pr_id = ? ORDER BY id DESC LIMIT 1`,
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
  // Placeholder only — must not call nextDocumentNumber('PO') / consume PO sequence
  const cloudRef = `CS-${prId}`;

  if (!poId) {
    const [poResult] = await conn.query(
      `INSERT INTO purchase_orders
       (po_number, pr_id, vendor_name, vendor_email, created_by,
        delivery_address, payment_terms, po_type, purchase_type,
        entity_id, currency, subtotal, tax_amount, grand_total, status, gst_percentage)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'short_po', 'sass', ?, ?, ?, ?, ?, 'invoice_entry', 0)`,
      [
        cloudRef,
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
    // If an older SASS row already took a real PO-#### number, rewrite to CS-{prId}
    const existingNum = String(existingPo[0]?.po_number || '');
    if (/^PO-/i.test(existingNum) || !existingNum.startsWith('CS-')) {
      try {
        await conn.query(`UPDATE purchase_orders SET po_number = ?, updated_at = NOW() WHERE id = ?`, [
          cloudRef,
          poId,
        ]);
      } catch {
        /* keep existing if unique conflict */
      }
    }
    await conn.query(
      `UPDATE purchase_orders SET status = 'invoice_entry', purchase_type = 'sass', updated_at = NOW() WHERE id = ?`,
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
        notes: 'Awaiting Mugesh invoice upload — SCM skipped',
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

  let mugeshAssignee = null;
  if (createMugeshInvoiceTask) {
    mugeshAssignee = await createSassInvoiceUploadTask(conn, prId, pr.department_id);
  }
  return { poId, invoiceId, mugeshAssignee };
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

/** Save invoice file + mark invoice pending_verification (Mugesh invoice-upload task). */
export async function applySassMugeshInvoiceUpload(conn, invoiceId, user, body = {}) {
  if (!body.fileName || !body.fileData) throw new Error('Invoice file is required');
  const invoiceNumber = String(body.invoiceNumber || '').trim() || null;

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
 * To: Requester
 * Cc: L1 (user approver), L2 (Srivaths), Accounts (accounts_rgml_refexev), itdev
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
  if (!pr) return { pr: null, to: null, cc: [], recipients: [] };

  const seen = new Set();
  const make = (email, name) => {
    const e = String(email || '')
      .trim()
      .toLowerCase();
    if (!e || seen.has(e)) return null;
    seen.add(e);
    return { email: e, name: name || e.split('@')[0] };
  };

  // To: Requester only
  const to = pr.requester_email ? make(pr.requester_email, pr.requester_name) : null;

  const cc = [];
  const pushCc = (email, name) => {
    const row = make(email, name);
    if (row) cc.push(row);
  };

  // Cc: L1 / User Approver — prefer first HOD approve on this PR
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
    pushCc(l1Hist[0].email, l1Hist[0].name);
  } else if (pr.approval_user_email) {
    pushCc(pr.approval_user_email, pr.approval_user_name);
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
      if (uRows[0]?.email) pushCc(uRows[0].email, uRows[0].name);
    }
  }

  // Cc: L2 Srivaths, Accounts mailbox, IT Dev
  pushCc(SASS_L2_EMAIL, SASS_L2_NAME);
  pushCc(SASS_ACCOUNTS_NOTIFY_EMAIL, 'Accounts');
  pushCc(SASS_ITDEV_NOTIFY_EMAIL, 'IT Dev');

  const recipients = to ? [to, ...cc] : [...cc];

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
      requesterEmail: pr.requester_email || '',
    },
    to,
    cc,
    recipients,
  };
}

/**
 * One-time / idempotent: rewrite Cloud Subscription rows that already consumed real
 * PO-Entity-FY-#### numbers → CS-{prId}, then realign PO sequences to max remaining.
 */
export async function rewriteConsumedCloudSubscriptionPoNumbers(connection = pool) {
  const [rows] = await connection.query(
    `SELECT po.id, po.pr_id, po.po_number, po.entity_id, po.purchase_type,
            pr.purchase_type AS pr_purchase_type
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     WHERE (
         po.po_number LIKE 'PO-%'
         OR (po.po_number NOT LIKE 'CS-%' AND po.po_number NOT LIKE 'DRAFT-%')
       )
       AND (
         COALESCE(po.purchase_type, '') = 'sass'
         OR COALESCE(pr.purchase_type, '') = 'sass'
       )`
  );

  let rewritten = 0;

  for (const row of rows) {
    const prId = Number(row.pr_id) || 0;
    const cloudRef = prId > 0 ? `CS-${prId}` : `CS-PO-${row.id}`;
    const oldNumber = String(row.po_number || '');
    if (oldNumber === cloudRef || oldNumber.startsWith('CS-')) continue;
    try {
      await connection.query(
        `UPDATE purchase_orders
         SET po_number = ?, purchase_type = 'sass', updated_at = NOW()
         WHERE id = ?`,
        [cloudRef, row.id]
      );
      rewritten += 1;
      console.log(`Cloud Subscription PO rewrite: ${oldNumber} → ${cloudRef} (id=${row.id})`);
    } catch (err) {
      try {
        const alt = `${cloudRef}-${row.id}`;
        await connection.query(
          `UPDATE purchase_orders
           SET po_number = ?, purchase_type = 'sass', updated_at = NOW()
           WHERE id = ?`,
          [alt, row.id]
        );
        rewritten += 1;
        console.log(`Cloud Subscription PO rewrite: ${oldNumber} → ${alt} (id=${row.id})`);
      } catch (err2) {
        console.warn(
          `Cloud Subscription PO rewrite skipped id=${row.id} (${oldNumber}):`,
          err2.message || err.message
        );
      }
    }
  }

  // Always realign PO sequences so freed numbers are available again
  const [seqRows] = await connection.query(
    `SELECT dns.id, dns.entity_id, dns.fy_label, dns.last_seq, e.code, e.cost_center, e.name
     FROM document_number_sequences dns
     JOIN entity_masters e ON e.id = dns.entity_id
     WHERE dns.doc_type = 'PO'`
  );

  let sequencesFixed = 0;
  for (const seq of seqRows) {
    const code =
      String(seq.code || seq.cost_center || seq.name || 'ENT')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10) || 'ENT';
    const prefix = `PO-${code}-${seq.fy_label}-`;
    const [maxRows] = await connection.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(po_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM purchase_orders
       WHERE po_number LIKE ?
         AND po_number NOT LIKE 'CS-%'
         AND COALESCE(purchase_type, 'purchase_order') <> 'sass'`,
      [`${prefix}%`]
    );
    const maxSeq = Number(maxRows[0]?.max_seq) || 0;
    const current = Number(seq.last_seq) || 0;
    if (maxSeq !== current) {
      await connection.query(`UPDATE document_number_sequences SET last_seq = ? WHERE id = ?`, [
        maxSeq,
        seq.id,
      ]);
      sequencesFixed += 1;
      console.log(
        `PO sequence realigned ${prefix}: last_seq ${current} → ${maxSeq}`
      );
    }
  }

  return { scanned: rows.length, rewritten, sequencesFixed };
}
