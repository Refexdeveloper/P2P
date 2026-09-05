import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { uploadToGcs, downloadFromGcs, gcsEnabled } from './gcsStorage.js';
import { formatDate, formatDateTime } from '../utils/constants.js';
import { sendVendorInvoiceRequestNotification } from './emailService.js';
import { getWhatsAppPublicBaseUrl } from './whatsappService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
const INVOICE_DIR = path.join(UPLOAD_ROOT, 'invoices');
const PAYMENT_DIR = path.join(UPLOAD_ROOT, 'payments');

for (const dir of [INVOICE_DIR, PAYMENT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const INVOICE_STATUS_UI = {
  awaiting_upload: 'Pending Verification',
  pending_verification: 'Pending Verification',
  pending_manager_approval: 'Pending Manager Approval',
  approved_for_payment: 'Approved for Payment',
  on_hold: 'On Hold',
  discrepancy: 'Discrepancy',
  paid: 'Paid',
  rejected: 'Discrepancy',
};

const GRN_STATUS_UI = {
  draft: 'Pending Receipt',
  submitted: 'Fully Received',
  fully_received: 'Fully Received',
  partially_received: 'Partially Received',
  rejected: 'Quality Rejected',
};

function parseHistory(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function saveBase64File(dir, prefix, fileName, fileData, gcsFolder) {
  if (!fileData || !fileName) return { fileName: null, filePath: null };
  const raw = String(fileData).includes(',') ? String(fileData).split(',')[1] : String(fileData);
  const buffer = Buffer.from(raw, 'base64');
  const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const stored = `${prefix}_${Date.now()}_${safe}`;
  if (gcsFolder && gcsEnabled()) {
    await uploadToGcs(`${gcsFolder}/${stored}`, buffer);
  } else {
    fs.writeFileSync(path.join(dir, stored), buffer);
  }
  return { fileName: safe, filePath: stored };
}

async function nextDocNumber(prefix, table, column) {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const [rows] = await pool.query(
    `SELECT ${column} AS num FROM ${table} WHERE ${column} LIKE ? ORDER BY id DESC LIMIT 1`,
    [like]
  );
  let seq = 1;
  if (rows[0]?.num) {
    const parts = String(rows[0].num).split('-');
    const last = Number(parts[parts.length - 1]) || 0;
    seq = last + 1;
  }
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`;
}

async function loadPoBundle(poId) {
  const [poRows] = await pool.query(
    `SELECT po.*,
            pr.pr_number, pr.title AS pr_title, pr.requester_id,
            d.name AS department_name,
            u.name AS requester_name
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN departments d ON d.id = pr.department_id
     LEFT JOIN users u ON u.id = pr.requester_id
     WHERE po.id = ?`,
    [poId]
  );
  if (!poRows.length) throw new Error('PO not found');
  const [lineItems] = await pool.query(
    `SELECT id, item_name, description, quantity, unit_price, total, tax_percentage
     FROM po_line_items WHERE po_id = ? ORDER BY id ASC`,
    [poId]
  );
  return { po: poRows[0], lineItems };
}

function mapInvoiceRow(row, lineItems = [], payment = null) {
  const history = parseHistory(row.approval_history);
  const poMatch = Number(row.invoice_grand_total) > 0
    ? Math.abs(Number(row.invoice_grand_total) - Number(row.po_grand_total)) < 1
    : true;
  const grnMatch = Number(row.grn_received_value) > 0
    ? Number(row.grn_received_value) <= Number(row.po_grand_total) + 1
    : true;

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || `DRAFT-${row.id}`,
    invoiceDate: row.invoice_date ? formatDate(row.invoice_date) : '',
    submittedDate: row.submitted_at ? formatDateTime(row.submitted_at) : formatDateTime(row.created_at),
    dueDate: row.due_date ? formatDate(row.due_date) : '',
    vendor: row.vendor_name || '',
    vendorEmail: row.vendor_email || '',
    vendorGSTIN: '',
    vendorAddress: '',
    poId: row.po_id,
    poNumber: row.po_number,
    grnId: row.grn_id,
    grnNumber: row.grn_number || '',
    prId: row.pr_number || '',
    prTitle: row.pr_title || '',
    department: row.department_name || '',
    requester: row.requester_name || '',
    paymentTerms: row.payment_terms || '',
    vendorInvoiceMode: row.vendor_invoice_mode || null,
    vendorNotifiedAt: row.vendor_notified_at ? formatDateTime(row.vendor_notified_at) : null,
    hasVendorToken: Boolean(row.vendor_invoice_token),
    canSendMail: ['awaiting_upload', 'on_hold', 'discrepancy'].includes(row.status),
    canManualEntry: ['awaiting_upload', 'pending_verification', 'on_hold', 'discrepancy'].includes(
      row.status
    ),
    lineItems,
    invoiceSubtotal: Number(row.invoice_subtotal) || 0,
    invoiceGST: Number(row.invoice_tax) || 0,
    invoiceGrandTotal: Number(row.invoice_grand_total) || Number(row.po_grand_total) || 0,
    poGrandTotal: Number(row.po_grand_total) || 0,
    grnReceivedValue: Number(row.grn_received_value) || 0,
    matchStatus: {
      poMatch,
      grnMatch,
      priceMatch: poMatch,
      overallMatch: poMatch && grnMatch,
    },
    discrepancies: poMatch ? [] : ['Invoice amount differs from PO total'],
    status: INVOICE_STATUS_UI[row.status] || row.status,
    statusRaw: row.status,
    priority: 'medium',
    accountsRemarks: row.accounts_remarks || '',
    approvalHistory: history,
    invoiceFileName: row.invoice_file_name || null,
    hasInvoiceFile: Boolean(row.invoice_file_path),
    paymentStatus:
      row.status === 'paid'
        ? 'Paid'
        : row.status === 'approved_for_payment'
          ? 'Pending Payment'
          : undefined,
    paymentDetails: payment
      ? {
          paymentDate: payment.payment_date ? formatDate(payment.payment_date) : '',
          paymentMode: payment.payment_mode,
          bankAccount: payment.bank_account || '',
          utrReference: payment.utr_reference || '',
          amountPaid: Number(payment.amount_paid) || 0,
          remarks: payment.remarks || '',
          receiptFileName: payment.receipt_file_name || '',
          uploadedBy: payment.uploaded_by_name || '',
          uploadedDate: payment.created_at ? formatDateTime(payment.created_at) : '',
        }
      : undefined,
    poStatus: row.po_status,
  };
}

export async function listPendingGrnPos(user = null) {
  const params = [];
  let sql = `
    SELECT po.id, po.po_number, po.pr_id, po.vendor_name, po.vendor_acceptance_status,
            po.vendor_accepted_at, po.vendor_acceptance_remarks, po.expected_delivery_date,
            po.delivery_address, po.payment_terms, po.gst_percentage, po.subtotal,
            po.tax_amount, po.grand_total, po.created_at, po.status, po.purchase_type,
            pr.pr_number, pr.title AS pr_title, pr.requester_id,
            d.name AS department_name, u.name AS requester_name
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN departments d ON d.id = pr.department_id
     LEFT JOIN users u ON u.id = pr.requester_id
     LEFT JOIN grn_headers g ON g.po_id = po.id
     WHERE po.purchase_type = 'purchase_order'
       AND po.status = 'awaiting_grn'
       AND g.id IS NULL`;

  if (user?.role === 'Requester') {
    sql += ` AND pr.requester_id = ?`;
    params.push(user.id);
  }

  sql += ` ORDER BY po.updated_at DESC, po.id DESC`;

  const [rows] = await pool.query(sql, params);

  const result = [];
  for (const row of rows) {
    const [lineItems] = await pool.query(
      `SELECT id, item_name, description, quantity, unit_price, total
       FROM po_line_items WHERE po_id = ? ORDER BY id ASC`,
      [row.id]
    );
    result.push({
      poId: row.id,
      poNumber: row.po_number,
      prId: row.pr_number || '',
      prTitle: row.pr_title || '',
      vendor: row.vendor_name || '',
      department: row.department_name || '',
      requester: row.requester_name || '',
      poDate: row.created_at ? formatDate(row.created_at) : '',
      expectedDeliveryDate: row.expected_delivery_date ? formatDate(row.expected_delivery_date) : '',
      deliveryAddress: row.delivery_address || '',
      paymentTerms: row.payment_terms || '',
      gstPercentage: Number(row.gst_percentage) || 18,
      subtotal: Number(row.subtotal) || 0,
      taxAmount: Number(row.tax_amount) || 0,
      grandTotal: Number(row.grand_total) || 0,
      vendorAcceptanceStatus: row.vendor_acceptance_status,
      vendorAcceptedAt: row.vendor_accepted_at ? formatDateTime(row.vendor_accepted_at) : null,
      remarks: row.vendor_acceptance_remarks || '',
      status: 'Pending Receipt',
      awaitingEntry: true,
      lineItems: lineItems.map((li, idx) => {
        const qty = Number(li.quantity) || 0;
        const unitPrice = Number(li.unit_price) || 0;
        return {
          id: String(li.id || idx + 1),
          poLineItemId: li.id,
          description: String(li.item_name || li.description || `Item ${idx + 1}`),
          orderedQty: qty,
          receivedQty: 0,
          pendingQty: qty,
          unitPrice,
          total: Number(li.total) || qty * unitPrice,
          condition: 'Pending Inspection',
        };
      }),
    });
  }
  return result;
}

/** Active users for GRN "Received By" dropdown */
export async function listGrnReceiverUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, d.name AS department
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.is_active = 1
       AND u.role <> 'Super Admin'
     ORDER BY u.name ASC, u.email ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    department: r.department || '',
  }));
}

export async function listGrns(user = null) {
  const params = [];
  let sql = `
    SELECT g.*, po.po_number, po.vendor_name, po.grand_total, po.payment_terms,
            po.gst_percentage, po.subtotal, po.tax_amount, po.delivery_address,
            po.expected_delivery_date, pr.pr_number, pr.title AS pr_title,
            d.name AS department_name, u.name AS requester_name
     FROM grn_headers g
     JOIN purchase_orders po ON po.id = g.po_id
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN departments d ON d.id = pr.department_id
     LEFT JOIN users u ON u.id = pr.requester_id
     WHERE 1=1`;

  if (user?.role === 'Requester') {
    sql += ` AND pr.requester_id = ?`;
    params.push(user.id);
  }

  sql += ` ORDER BY g.id DESC`;

  const [rows] = await pool.query(sql, params);

  const result = [];
  for (const row of rows) {
    const [lines] = await pool.query(
      `SELECT * FROM grn_line_items WHERE grn_id = ? ORDER BY id ASC`,
      [row.id]
    );
    result.push({
      id: row.id,
      grnNumber: row.grn_number,
      poId: row.po_id,
      poNumber: row.po_number,
      prId: row.pr_number || '',
      prTitle: row.pr_title || '',
      vendor: row.vendor_name || '',
      department: row.department_name || '',
      requester: row.requester_name || '',
      expectedDeliveryDate: row.expected_delivery_date ? formatDate(row.expected_delivery_date) : '',
      receivedDate: row.receipt_date ? formatDate(row.receipt_date) : null,
      deliveryAddress: row.delivery_address || '',
      paymentTerms: row.payment_terms || '',
      subtotal: Number(row.subtotal) || 0,
      gstPercentage: Number(row.gst_percentage) || 18,
      taxAmount: Number(row.tax_amount) || 0,
      grandTotal: Number(row.grand_total) || 0,
      receivedValue: Number(row.received_value) || 0,
      status: GRN_STATUS_UI[row.status] || row.status,
      statusRaw: row.status,
      receivedBy: row.received_by,
      inspectedBy: row.inspected_by,
      remarks: row.remarks || '',
      awaitingEntry: false,
      lineItems: lines.map((li) => ({
        id: String(li.id),
        description: li.description,
        orderedQty: Number(li.ordered_qty) || 0,
        receivedQty: Number(li.received_qty) || 0,
        pendingQty: Math.max(0, Number(li.ordered_qty) - Number(li.received_qty)),
        unitPrice: Number(li.unit_price) || 0,
        total: Number(li.line_total) || 0,
        condition: li.condition_label || 'Good',
      })),
      receiptHistory: [
        {
          action: 'GRN Submitted',
          performedBy: row.received_by || 'Store',
          role: 'SCM / Store',
          date: formatDateTime(row.created_at),
          notes: row.remarks || 'Goods received — invoice base entry created',
        },
      ],
    });
  }
  return result;
}

/**
 * Submit GRN → create invoice base entry → update PO status to invoice_entry
 */
export async function submitGrn(user, body) {
  const poId = Number(body.poId);
  if (!poId) throw new Error('poId is required');

  const { po, lineItems } = await loadPoBundle(poId);
  if (po.purchase_type === 'work_order') {
    throw new Error('GRN applies to Purchase Orders only — Work Orders skip GRN');
  }
  if (po.status !== 'awaiting_grn') {
    throw new Error('PO is not awaiting GRN');
  }

  const [existing] = await pool.query(`SELECT id FROM grn_headers WHERE po_id = ? LIMIT 1`, [poId]);
  if (existing.length) throw new Error('GRN already exists for this PO');

  const items = Array.isArray(body.lineItems) ? body.lineItems : [];
  if (!items.length) throw new Error('At least one line item is required');

  let receivedValue = 0;
  let totalOrdered = 0;
  let totalReceived = 0;
  for (const item of items) {
    const ordered = Number(item.orderedQty) || 0;
    const received = Number(item.receivedQty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    totalOrdered += ordered;
    totalReceived += received;
    receivedValue += received * unitPrice;
  }
  receivedValue = Math.round(receivedValue * 100) / 100;

  const grnStatus =
    totalReceived <= 0
      ? 'draft'
      : totalReceived >= totalOrdered
        ? 'fully_received'
        : 'partially_received';

  const grnNumber = body.grnNumber?.trim() || (await nextDocNumber('GRN', 'grn_headers', 'grn_number'));
  const receiptDate = body.receivedDate || new Date().toISOString().slice(0, 10);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [grnResult] = await conn.query(
      `INSERT INTO grn_headers
       (grn_number, po_id, pr_id, status, receipt_date, received_by, inspected_by,
        location, challan_number, remarks, received_value, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        grnNumber,
        poId,
        po.pr_id || null,
        grnStatus === 'draft' ? 'submitted' : grnStatus,
        receiptDate,
        body.receivedBy || user.name,
        body.inspectedBy || null,
        body.location || null,
        body.challanNumber || null,
        body.remarks || null,
        receivedValue,
        user.id,
      ]
    );
    const grnId = grnResult.insertId;

    for (const item of items) {
      const ordered = Number(item.orderedQty) || 0;
      const received = Number(item.receivedQty) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      await conn.query(
        `INSERT INTO grn_line_items
         (grn_id, po_line_item_id, description, ordered_qty, received_qty, unit_price, line_total, condition_label)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          grnId,
          item.poLineItemId || item.id || null,
          String(item.description || '').trim() || 'Item',
          ordered,
          received,
          unitPrice,
          Math.round(received * unitPrice * 100) / 100,
          item.condition || 'Good',
        ]
      );
    }

    const history = [
      {
        action: 'Invoice base created from GRN',
        performedBy: user.name,
        role: user.role,
        date: formatDateTime(new Date()),
        notes: `GRN ${grnNumber} submitted — awaiting invoice upload`,
      },
    ];

    const [invResult] = await conn.query(
      `INSERT INTO invoices
       (invoice_number, po_id, grn_id, pr_id, status, vendor_name,
        invoice_subtotal, invoice_tax, invoice_grand_total, po_grand_total, grn_received_value,
        approval_history, created_by)
       VALUES (?, ?, ?, ?, 'awaiting_upload', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null,
        poId,
        grnId,
        po.pr_id || null,
        po.vendor_name,
        Number(po.subtotal) || 0,
        Number(po.tax_amount) || 0,
        Number(po.grand_total) || 0,
        Number(po.grand_total) || 0,
        receivedValue,
        JSON.stringify(history),
        user.id,
      ]
    );

    await conn.query(
      `UPDATE purchase_orders SET status = 'invoice_entry', updated_at = NOW() WHERE id = ?`,
      [poId]
    );

    if (po.pr_id) {
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, 'GRN_SUBMITTED', ?, 'verified', ?)`,
        [po.pr_id, user.id, `GRN ${grnNumber} submitted — invoice base #${invResult.insertId} created`]
      );
    }

    await conn.commit();

    return {
      grnId,
      grnNumber,
      invoiceId: invResult.insertId,
      poId,
      poNumber: po.po_number,
      poStatus: 'invoice_entry',
      message: 'GRN submitted — invoice base entry created for Accounts',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listInvoices(user, { forPayment = false } = {}) {
  let statusFilter = '';
  const params = [];
  if (forPayment) {
    statusFilter = `AND i.status IN ('approved_for_payment', 'paid')`;
  } else if (user.role === 'Accounts Manager') {
    statusFilter = `AND i.status IN ('awaiting_upload', 'pending_verification', 'pending_manager_approval', 'approved_for_payment', 'on_hold', 'discrepancy', 'paid')`;
  }

  let requesterFilter = '';
  if (user.role === 'Requester') {
    requesterFilter = ` AND pr.requester_id = ?`;
    params.push(user.id);
  }

  const [rows] = await pool.query(
    `SELECT i.*, po.po_number, po.vendor_email, po.payment_terms, po.status AS po_status,
            g.grn_number, pr.pr_number, pr.title AS pr_title,
            d.name AS department_name, u.name AS requester_name
     FROM invoices i
     JOIN purchase_orders po ON po.id = i.po_id
     LEFT JOIN grn_headers g ON g.id = i.grn_id
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN departments d ON d.id = pr.department_id
     LEFT JOIN users u ON u.id = pr.requester_id
     WHERE 1=1 ${statusFilter}${requesterFilter}
     ORDER BY i.id DESC`,
    params
  );

  const result = [];
  for (const row of rows) {
    const [poLines] = await pool.query(
      `SELECT id, item_name, description, quantity, unit_price, total
       FROM po_line_items WHERE po_id = ? ORDER BY id ASC`,
      [row.po_id]
    );
    const [grnLines] = row.grn_id
      ? await pool.query(
          `SELECT description, ordered_qty, received_qty, unit_price, line_total
           FROM grn_line_items WHERE grn_id = ? ORDER BY id ASC`,
          [row.grn_id]
        )
      : [[]];

    const lineItems = poLines.map((li, idx) => {
      const grn = grnLines[idx] || {};
      const poQty = Number(li.quantity) || 0;
      const poUnit = Number(li.unit_price) || 0;
      const poTotal = Number(li.total) || poQty * poUnit;
      const grnQty = Number(grn.received_qty) || 0;
      return {
        id: String(li.id),
        description: String(li.item_name || li.description || `Item ${idx + 1}`),
        invoicedQty: poQty,
        invoicedUnitPrice: poUnit,
        invoicedTotal: poTotal,
        poQty,
        poUnitPrice: poUnit,
        poTotal,
        grnQty,
        qtyMatch: grnQty >= poQty || grnQty > 0,
        priceMatch: true,
        grnMatch: grnQty > 0,
      };
    });

    let payment = null;
    if (row.status === 'paid' || row.status === 'approved_for_payment') {
      const [payRows] = await pool.query(
        `SELECT p.*, u.name AS uploaded_by_name
         FROM payments p
         LEFT JOIN users u ON u.id = p.uploaded_by
         WHERE p.invoice_id = ?
         ORDER BY p.id DESC LIMIT 1`,
        [row.id]
      );
      payment = payRows[0] || null;
    }

    result.push(mapInvoiceRow(row, lineItems, payment));
  }
  return result;
}

export async function uploadInvoiceDocument(user, invoiceId, body) {
  const [rows] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];
  await assertInvoiceEntryAccess(user, inv.po_id);
  if (!['awaiting_upload', 'pending_verification', 'on_hold', 'discrepancy'].includes(inv.status)) {
    throw new Error('Invoice cannot be updated in current status');
  }

  const invoiceNumber = String(body.invoiceNumber || '').trim();
  if (!invoiceNumber) throw new Error('Invoice number is required');
  if (!body.fileName || !body.fileData) throw new Error('Invoice file is required');

  const mode = body.mode === 'email' ? 'email' : 'manual';
  const { fileName, filePath } = await saveBase64File(INVOICE_DIR, `inv_${invoiceId}`, body.fileName, body.fileData, 'invoices');
  const history = [
    ...parseHistory(inv.approval_history),
    {
      action: mode === 'manual' ? 'Manual invoice entry' : 'Invoice uploaded',
      performedBy: user?.name || 'Vendor',
      role: user?.role || 'Vendor',
      date: formatDateTime(new Date()),
      notes: body.remarks || `Uploaded ${fileName}`,
    },
  ];

  const subtotal = Number(body.invoiceSubtotal ?? inv.invoice_subtotal) || Number(inv.po_grand_total) || 0;
  const tax = Number(body.invoiceTax ?? inv.invoice_tax) || 0;
  const grand = Number(body.invoiceGrandTotal ?? inv.invoice_grand_total) || subtotal + tax;

  await pool.query(
    `UPDATE invoices SET
       invoice_number = ?,
       invoice_date = ?,
       due_date = ?,
       invoice_subtotal = ?,
       invoice_tax = ?,
       invoice_grand_total = ?,
       invoice_file_name = ?,
       invoice_file_path = ?,
       vendor_invoice_mode = ?,
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
      mode,
      JSON.stringify(history),
      invoiceId,
    ]
  );

  await pool.query(
    `UPDATE purchase_orders SET status = 'invoice_entry', updated_at = NOW() WHERE id = ?`,
    [inv.po_id]
  );

  try {
    const { isSassPurchaseType } = await import('./sassWorkflow.js');
    const [poTypeRows] = await pool.query(`SELECT purchase_type FROM purchase_orders WHERE id = ?`, [
      inv.po_id,
    ]);
    const skipVendorAcceptance = isSassPurchaseType(poTypeRows[0]?.purchase_type);
    if (!skipVendorAcceptance) {
      const { openVendorAcceptanceStageForPo } = await import('./poService.js');
      await openVendorAcceptanceStageForPo(inv.po_id);
    }
  } catch (err) {
    console.warn('Open vendor acceptance after invoice upload failed:', err.message);
  }

  try {
    const {
      isSassPurchaseType,
      completeSassInvoiceUploadTask,
      resolveSassInvoiceUploadedRecipients,
    } = await import('./sassWorkflow.js');
    const [poRows] = await pool.query(`SELECT purchase_type, pr_id FROM purchase_orders WHERE id = ?`, [
      inv.po_id,
    ]);
    const poRow = poRows[0];
    if (poRow && isSassPurchaseType(poRow.purchase_type) && poRow.pr_id) {
      await completeSassInvoiceUploadTask(pool, poRow.pr_id);
      await pool.query(
        `UPDATE purchase_requests
         SET status = ?, current_stage = NULL, updated_at = NOW()
         WHERE id = ? AND status = ?`,
        ['APPROVED', poRow.pr_id, 'AWAITING_INVOICE']
      );
      await pool.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, 'SASS_INVOICE_UPLOAD', ?, 'submitted', ?)`,
        [poRow.pr_id, user?.id || null, 'Invoice uploaded — routed to Accounts (SCM skipped)']
      );

      // Notify L1 Manager + Srivaths + Mugesh that invoice file was uploaded
      try {
        const { queueSassInvoiceUploadedNotification } = await import('./emailService.js');
        const { pr: notifyPr, recipients, to, cc } = await resolveSassInvoiceUploadedRecipients(poRow.pr_id);
        const attachments = [];
        try {
          let buffer = null;
          if (gcsEnabled()) {
            buffer = await downloadFromGcs(`invoices/${filePath}`);
          } else {
            const full = path.join(INVOICE_DIR, filePath);
            if (fs.existsSync(full)) buffer = fs.readFileSync(full);
          }
          if (buffer?.length) {
            attachments.push({
              filename: fileName || 'invoice.pdf',
              content: buffer,
            });
          }
        } catch (attErr) {
          console.warn('Cloud Subscription invoice attachment skipped:', attErr.message);
        }
        if (notifyPr && (to?.email || recipients.length)) {
          queueSassInvoiceUploadedNotification({
            pr: notifyPr,
            invoice: {
              invoiceNumber,
              invoiceFileName: fileName,
              invoiceGrandTotal: grand,
            },
            to,
            cc,
            recipients,
            uploaderName: user?.name || 'Mugesh',
            requesterName: notifyPr.requesterName || notifyPr.requester_name,
            attachments,
          });
        }
      } catch (mailErr) {
        console.warn('Cloud Subscription invoice-uploaded mail failed:', mailErr.message);
      }
    }
  } catch (err) {
    console.warn('Cloud Subscription invoice upload follow-up failed:', err.message);
  }

  return getInvoiceById(invoiceId);
}

export async function verifyInvoice(user, invoiceId, { action, remarks }) {
  const allowed = ['approve', 'hold', 'reject'];
  if (!allowed.includes(action)) throw new Error('Invalid action');

  const [rows] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];
  if (!['awaiting_upload', 'pending_verification', 'on_hold'].includes(inv.status)) {
    throw new Error('Invoice is not pending verification');
  }
  if (inv.status === 'awaiting_upload' && !inv.invoice_file_path) {
    throw new Error('Upload invoice document before verification');
  }

  let nextStatus = 'pending_manager_approval';
  let poStatus = 'pending_accounts_approval';
  let actionLabel = 'Sent to Manager';
  if (action === 'hold') {
    nextStatus = 'on_hold';
    poStatus = 'invoice_entry';
    actionLabel = 'Put On Hold';
  } else if (action === 'reject') {
    nextStatus = 'discrepancy';
    poStatus = 'invoice_entry';
    actionLabel = 'Discrepancy Raised';
  }

  const history = [
    ...parseHistory(inv.approval_history),
    {
      action: actionLabel,
      performedBy: user.name,
      role: user.role,
      date: formatDateTime(new Date()),
      notes: remarks || '',
    },
  ];

  await pool.query(
    `UPDATE invoices SET
       status = ?,
       accounts_remarks = ?,
       verified_by = ?,
       verified_at = NOW(),
       approval_history = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [nextStatus, remarks || null, user.id, JSON.stringify(history), invoiceId]
  );
  await pool.query(`UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?`, [
    poStatus,
    inv.po_id,
  ]);

  return getInvoiceById(invoiceId);
}

export async function managerApproveInvoice(user, invoiceId, { action = 'approve', remarks }) {
  if (!['Accounts Manager', 'Super Admin', 'SCM Manager'].includes(user.role)) {
    throw new Error('Only Accounts Manager can approve for payment');
  }

  const [rows] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];
  if (inv.status !== 'pending_manager_approval') {
    throw new Error('Invoice is not pending manager approval');
  }

  const approve = action !== 'reject';
  const nextStatus = approve ? 'approved_for_payment' : 'discrepancy';
  const poStatus = approve ? 'approved_for_payment' : 'invoice_entry';
  const history = [
    ...parseHistory(inv.approval_history),
    {
      action: approve ? 'Manager Approved' : 'Manager Rejected',
      performedBy: user.name,
      role: user.role,
      date: formatDateTime(new Date()),
      notes: remarks || '',
    },
  ];

  await pool.query(
    `UPDATE invoices SET
       status = ?,
       accounts_remarks = ?,
       manager_approved_by = ?,
       manager_approved_at = NOW(),
       approval_history = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [nextStatus, remarks || null, user.id, JSON.stringify(history), invoiceId]
  );
  await pool.query(`UPDATE purchase_orders SET status = ?, updated_at = NOW() WHERE id = ?`, [
    poStatus,
    inv.po_id,
  ]);

  return getInvoiceById(invoiceId);
}

export async function uploadPayment(user, invoiceId, body) {
  const [rows] = await pool.query(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];
  if (inv.status !== 'approved_for_payment' && inv.status !== 'paid') {
    throw new Error('Invoice must be approved for payment first');
  }

  const amount = Number(body.amountPaid);
  if (!amount || amount <= 0) throw new Error('Payment amount is required');
  if (!body.utrReference?.trim()) throw new Error('UTR / reference is required');

  const { fileName, filePath } = body.fileName && body.fileData
    ? await saveBase64File(PAYMENT_DIR, `pay_${invoiceId}`, body.fileName, body.fileData, 'invoices')
    : { fileName: null, filePath: null };

  const history = [
    ...parseHistory(inv.approval_history),
    {
      action: 'Payment uploaded',
      performedBy: user.name,
      role: user.role,
      date: formatDateTime(new Date()),
      notes: body.remarks || `UTR ${body.utrReference}`,
    },
  ];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO payments
       (invoice_id, po_id, payment_date, payment_mode, bank_account, utr_reference,
        amount_paid, remarks, receipt_file_name, receipt_file_path, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        inv.po_id,
        body.paymentDate || new Date().toISOString().slice(0, 10),
        body.paymentMode || 'NEFT',
        body.bankAccount || null,
        body.utrReference.trim(),
        amount,
        body.remarks || null,
        fileName,
        filePath,
        user.id,
      ]
    );
    await conn.query(
      `UPDATE invoices SET status = 'paid', approval_history = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(history), invoiceId]
    );
    await conn.query(`UPDATE purchase_orders SET status = 'paid', updated_at = NOW() WHERE id = ?`, [
      inv.po_id,
    ]);
    if (inv.pr_id) {
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, 'PAYMENT_COMPLETED', ?, 'approve', ?)`,
        [inv.pr_id, user.id, `Payment ${body.utrReference.trim()} recorded`]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return getInvoiceById(invoiceId);
}

export async function getInvoiceById(invoiceId) {
  const list = await listInvoices({ role: 'Accounts Manager' }, { forPayment: false });
  const found = list.find((i) => Number(i.id) === Number(invoiceId));
  if (!found) {
    const payList = await listInvoices({ role: 'Accounts Manager' }, { forPayment: true });
    const again = payList.find((i) => Number(i.id) === Number(invoiceId));
    if (!again) throw new Error('Invoice not found');
    return again;
  }
  return found;
}

export async function getAccountsDashboard() {
  const [[poCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status IN ('sent_to_vendor', 'awaiting_grn') AND vendor_acceptance_status IN ('accepted','partial') THEN 1 ELSE 0 END) AS awaitingGrn,
       SUM(CASE WHEN status = 'invoice_entry' THEN 1 ELSE 0 END) AS invoiceEntry,
       SUM(CASE WHEN status = 'pending_accounts_approval' THEN 1 ELSE 0 END) AS pendingManager,
       SUM(CASE WHEN status = 'approved_for_payment' THEN 1 ELSE 0 END) AS approvedForPayment,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid
     FROM purchase_orders`
  );
  const [[invCounts]] = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'awaiting_upload' THEN 1 ELSE 0 END) AS awaitingUpload,
       SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) AS pendingVerification,
       SUM(CASE WHEN status = 'pending_manager_approval' THEN 1 ELSE 0 END) AS pendingManagerApproval,
       SUM(CASE WHEN status = 'approved_for_payment' THEN 1 ELSE 0 END) AS readyForPayment,
       SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidInvoices,
       COALESCE(SUM(CASE WHEN status = 'approved_for_payment' THEN invoice_grand_total ELSE 0 END), 0) AS pendingPaymentValue,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN invoice_grand_total ELSE 0 END), 0) AS paidValue
     FROM invoices`
  );

  const [recent] = await pool.query(
    `SELECT i.id, i.invoice_number, i.status, i.invoice_grand_total, i.updated_at,
            po.po_number, po.vendor_name, po.status AS po_status, g.grn_number
     FROM invoices i
     JOIN purchase_orders po ON po.id = i.po_id
     LEFT JOIN grn_headers g ON g.id = i.grn_id
     ORDER BY i.updated_at DESC
     LIMIT 12`
  );

  return {
    po: {
      awaitingGrn: Number(poCounts?.awaitingGrn) || 0,
      invoiceEntry: Number(poCounts?.invoiceEntry) || 0,
      pendingManager: Number(poCounts?.pendingManager) || 0,
      approvedForPayment: Number(poCounts?.approvedForPayment) || 0,
      paid: Number(poCounts?.paid) || 0,
    },
    invoices: {
      awaitingUpload: Number(invCounts?.awaitingUpload) || 0,
      pendingVerification: Number(invCounts?.pendingVerification) || 0,
      pendingManagerApproval: Number(invCounts?.pendingManagerApproval) || 0,
      readyForPayment: Number(invCounts?.readyForPayment) || 0,
      paidInvoices: Number(invCounts?.paidInvoices) || 0,
      pendingPaymentValue: Number(invCounts?.pendingPaymentValue) || 0,
      paidValue: Number(invCounts?.paidValue) || 0,
    },
    recent: recent.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoice_number || `DRAFT-${r.id}`,
      status: INVOICE_STATUS_UI[r.status] || r.status,
      statusRaw: r.status,
      amount: Number(r.invoice_grand_total) || 0,
      poNumber: r.po_number,
      grnNumber: r.grn_number || '',
      vendor: r.vendor_name || '',
      poStatus: r.po_status,
      updatedAt: formatDateTime(r.updated_at),
    })),
  };
}

function newVendorInvoiceToken() {
  return crypto.randomBytes(24).toString('hex');
}

const INVOICE_ENTRY_PRIVILEGED_ROLES = [
  'SCM Buyer',
  'Super Admin',
  'Accounts Payable',
  'Accounts Manager',
];

async function assertInvoiceEntryAccess(user, poId) {
  if (!user?.id) throw new Error('Unauthorized');
  if (INVOICE_ENTRY_PRIVILEGED_ROLES.includes(user.role)) return;
  if (user.role === 'Requester') {
    const [own] = await pool.query(
      `SELECT pr.requester_id FROM purchase_orders po
       JOIN purchase_requests pr ON pr.id = po.pr_id
       WHERE po.id = ? LIMIT 1`,
      [poId]
    );
    if (Number(own[0]?.requester_id) !== Number(user.id)) {
      throw new Error('This invoice is assigned to another requester');
    }
    return;
  }
  throw new Error('Not allowed');
}

/** Email vendor a public invoice-submit link (Requester for own POs, or SCM/Accounts). */
export async function sendVendorInvoiceMail(user, invoiceId) {
  const [rows] = await pool.query(
    `SELECT i.*, po.po_number, po.vendor_name, po.vendor_email, po.payment_terms,
            po.grand_total, po.pr_id, po.entity, g.grn_number,
            pr.pr_number, pr.title AS pr_title
     FROM invoices i
     JOIN purchase_orders po ON po.id = i.po_id
     LEFT JOIN grn_headers g ON g.id = i.grn_id
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     WHERE i.id = ?`,
    [invoiceId]
  );
  if (!rows.length) throw new Error('Invoice not found');
  const inv = rows[0];
  await assertInvoiceEntryAccess(user, inv.po_id);
  if (!['awaiting_upload', 'on_hold', 'discrepancy'].includes(inv.status)) {
    throw new Error('Invoice mail can only be sent while awaiting vendor upload');
  }
  if (!inv.vendor_email) throw new Error('Vendor email is missing on this PO');

  const token = inv.vendor_invoice_token || newVendorInvoiceToken();
  const history = [
    ...parseHistory(inv.approval_history),
    {
      action: 'Vendor invoice mail sent',
      performedBy: user.name,
      role: user.role,
      date: formatDateTime(new Date()),
      notes: `Mail to ${inv.vendor_email}`,
    },
  ];

  await pool.query(
    `UPDATE invoices SET
       vendor_invoice_token = ?,
       vendor_invoice_mode = 'email',
       vendor_notified_at = NOW(),
       approval_history = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [token, JSON.stringify(history), invoiceId]
  );

  const base = getWhatsAppPublicBaseUrl().replace(/\/$/, '');
  const portalUrl = `${base}/vendor/invoice-submit/${token}`;
  const po = {
    id: inv.po_id,
    poNumber: inv.po_number,
    vendorName: inv.vendor_name,
    vendorEmail: inv.vendor_email,
    paymentTerms: inv.payment_terms,
    grandTotal: inv.grand_total,
    prId: inv.pr_id,
    prNumber: inv.pr_number,
    prTitle: inv.pr_title,
    entity: inv.entity,
  };

  const mailResult = await sendVendorInvoiceRequestNotification(
    po,
    {
      id: inv.id,
      grnNumber: inv.grn_number,
      po_grand_total: inv.po_grand_total,
      vendor_name: inv.vendor_name,
    },
    { portalUrl }
  );

  if (inv.pr_id) {
    await pool.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
       VALUES (?, 'VENDOR_INVOICE_MAIL', ?, 'notified', ?)`,
      [inv.pr_id, user.id, `Vendor invoice mail sent to ${inv.vendor_email}`]
    );
  }

  return {
    invoiceId,
    vendorEmail: inv.vendor_email,
    portalUrl,
    mailSkipped: Boolean(mailResult?.skipped),
    message: mailResult?.skipped
      ? `Invoice link ready (email send is disabled). Vendor: ${inv.vendor_email}`
      : `Invoice request mailed to ${inv.vendor_email}`,
  };
}

/** Public: load invoice shell by token */
export async function getInvoiceByToken(token) {
  const clean = String(token || '').trim();
  if (!clean) throw new Error('Invalid link');
  const [rows] = await pool.query(
    `SELECT i.*, po.po_number, po.vendor_name, po.vendor_email, po.payment_terms,
            po.grand_total, po.entity, g.grn_number, pr.pr_number, pr.title AS pr_title
     FROM invoices i
     JOIN purchase_orders po ON po.id = i.po_id
     LEFT JOIN grn_headers g ON g.id = i.grn_id
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     WHERE i.vendor_invoice_token = ?
     LIMIT 1`,
    [clean]
  );
  if (!rows.length) throw new Error('Invalid or expired invoice link');
  const inv = rows[0];
  const canSubmit = ['awaiting_upload', 'on_hold', 'discrepancy'].includes(inv.status);
  return {
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number || '',
    poNumber: inv.po_number,
    grnNumber: inv.grn_number || '',
    prNumber: inv.pr_number || '',
    prTitle: inv.pr_title || '',
    vendorName: inv.vendor_name || '',
    vendorEmail: inv.vendor_email || '',
    paymentTerms: inv.payment_terms || '',
    amount: Number(inv.po_grand_total) || Number(inv.grand_total) || 0,
    status: INVOICE_STATUS_UI[inv.status] || inv.status,
    statusRaw: inv.status,
    canSubmit,
    alreadySubmitted: Boolean(inv.invoice_file_path) && inv.status !== 'awaiting_upload',
  };
}

/** Public: vendor submits invoice via emailed link */
export async function submitInvoiceByToken(token, body = {}) {
  const clean = String(token || '').trim();
  const [rows] = await pool.query(
    `SELECT * FROM invoices WHERE vendor_invoice_token = ? LIMIT 1`,
    [clean]
  );
  if (!rows.length) throw new Error('Invalid or expired invoice link');
  const inv = rows[0];
  if (!['awaiting_upload', 'on_hold', 'discrepancy'].includes(inv.status)) {
    throw new Error('Invoice already submitted or locked');
  }

  return uploadInvoiceDocument(
    { id: null, name: inv.vendor_name || 'Vendor', role: 'Vendor' },
    inv.id,
    { ...body, mode: 'email' }
  );
}

export async function resolveInvoiceFile(invoiceId) {
  const [rows] = await pool.query(
    `SELECT invoice_file_name, invoice_file_path FROM invoices WHERE id = ?`,
    [invoiceId]
  );
  if (!rows.length || !rows[0].invoice_file_path) return null;
  const fileName = rows[0].invoice_file_name || 'invoice.pdf';
  if (gcsEnabled()) {
    const buf = await downloadFromGcs(`invoices/${path.basename(rows[0].invoice_file_path)}`);
    if (buf?.length) return { fullPath: null, fileName, buffer: buf };
  }
  const fullPath = path.join(INVOICE_DIR, rows[0].invoice_file_path);
  if (fs.existsSync(fullPath)) return { fullPath, fileName };
  return null;
}

/** Compact GRN + invoice snapshot for Track PO expand (finished-flow tabs). */
export async function getPoFulfillmentSummary(poId) {
  const id = Number(poId);
  if (!id) return { grn: null, invoice: null };

  const [grnRows] = await pool.query(
    `SELECT g.*, po.po_number, po.vendor_name
     FROM grn_headers g
     JOIN purchase_orders po ON po.id = g.po_id
     WHERE g.po_id = ?
     ORDER BY g.id DESC
     LIMIT 1`,
    [id]
  );

  let grn = null;
  if (grnRows.length) {
    const row = grnRows[0];
    const [lines] = await pool.query(
      `SELECT * FROM grn_line_items WHERE grn_id = ? ORDER BY id ASC`,
      [row.id]
    );
    const statusRaw = String(row.status || '');
    const finished = ['submitted', 'fully_received', 'partially_received'].includes(statusRaw);
    if (finished) {
      grn = {
        id: row.id,
        grnNumber: row.grn_number,
        poId: row.po_id,
        poNumber: row.po_number,
        vendor: row.vendor_name || '',
        status: GRN_STATUS_UI[statusRaw] || statusRaw,
        statusRaw,
        receivedDate: row.receipt_date ? formatDate(row.receipt_date) : null,
        receivedBy: row.received_by || '',
        inspectedBy: row.inspected_by || '',
        remarks: row.remarks || '',
        receivedValue: Number(row.received_value) || 0,
        lineItems: lines.map((li) => ({
          id: String(li.id),
          description: li.description,
          orderedQty: Number(li.ordered_qty) || 0,
          receivedQty: Number(li.received_qty) || 0,
          unitPrice: Number(li.unit_price) || 0,
          total: Number(li.line_total) || 0,
          condition: li.condition_label || 'Good',
        })),
      };
    }
  }

  const [invRows] = await pool.query(
    `SELECT i.*, po.po_number, po.vendor_name, po.vendor_email, g.grn_number
     FROM invoices i
     JOIN purchase_orders po ON po.id = i.po_id
     LEFT JOIN grn_headers g ON g.id = i.grn_id
     WHERE i.po_id = ?
     ORDER BY i.id DESC
     LIMIT 1`,
    [id]
  );

  let invoice = null;
  if (invRows.length) {
    const row = invRows[0];
    const statusRaw = String(row.status || '');
    const hasFile = Boolean(row.invoice_file_path);
    const finished =
      hasFile ||
      [
        'pending_verification',
        'pending_manager_approval',
        'approved_for_payment',
        'on_hold',
        'discrepancy',
        'paid',
        'rejected',
      ].includes(statusRaw);
    if (finished) {
      invoice = {
        id: row.id,
        invoiceNumber: row.invoice_number || `DRAFT-${row.id}`,
        invoiceDate: row.invoice_date ? formatDate(row.invoice_date) : '',
        submittedDate: row.submitted_at ? formatDateTime(row.submitted_at) : formatDateTime(row.created_at),
        vendor: row.vendor_name || '',
        vendorEmail: row.vendor_email || '',
        poId: row.po_id,
        poNumber: row.po_number,
        grnNumber: row.grn_number || '',
        status: INVOICE_STATUS_UI[statusRaw] || statusRaw,
        statusRaw,
        invoiceSubtotal: Number(row.invoice_subtotal) || 0,
        invoiceGST: Number(row.invoice_tax) || 0,
        invoiceGrandTotal: Number(row.invoice_grand_total) || Number(row.po_grand_total) || 0,
        invoiceFileName: row.invoice_file_name || null,
        hasInvoiceFile: hasFile,
        vendorInvoiceMode: row.vendor_invoice_mode || null,
        accountsRemarks: row.accounts_remarks || '',
      };
    }
  }

  return { grn, invoice };
}
