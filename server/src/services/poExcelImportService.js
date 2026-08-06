/**
 * Excel / CSV Purchase Order import — direct DB create only.
 * No approval workflow, no approval history, no emails, no workflow tasks.
 */
import pool from '../config/db.js';

export const PO_EXCEL_IMPORT_HEADERS = [
  'poNumber',
  'prNumber',
  'vendorName',
  'vendorEmail',
  'deliveryAddress',
  'expectedDeliveryDate',
  'paymentTerms',
  'incoterms',
  'gstPercentage',
  'specialInstructions',
  'poType',
  'entity',
  'itemName',
  'description',
  'quantity',
  'unitPrice',
  'discount',
  'category',
  'unit',
];

const SAMPLE_ROWS = [
  {
    poNumber: 'PO-IMP-2024-0001',
    prNumber: '',
    vendorName: 'Global Supplies Inc',
    vendorEmail: 'vendor@example.com',
    deliveryAddress: 'Plot No. 42, Industrial Area Phase II, Chandigarh - 160002',
    expectedDeliveryDate: '2024-06-15',
    paymentTerms: 'Net 30 Days',
    incoterms: 'DDP',
    gstPercentage: '18',
    specialInstructions: 'Historical import',
    poType: 'short_po',
    entity: 'Refex Industries',
    itemName: 'Laptop Dell Latitude 5540',
    description: 'Business laptop with 16GB RAM',
    quantity: '2',
    unitPrice: '55000',
    discount: '0',
    category: 'IT',
    unit: 'Nos',
  },
  {
    poNumber: 'PO-IMP-2024-0001',
    prNumber: '',
    vendorName: '',
    vendorEmail: '',
    deliveryAddress: '',
    expectedDeliveryDate: '',
    paymentTerms: '',
    incoterms: '',
    gstPercentage: '',
    specialInstructions: '',
    poType: '',
    entity: '',
    itemName: 'Wireless Mouse',
    description: 'USB optical mouse',
    quantity: '2',
    unitPrice: '800',
    discount: '80',
    category: 'IT',
    unit: 'Nos',
  },
];

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function getPoExcelImportDefaultStatus() {
  const raw = String(process.env.PO_IMPORT_DEFAULT_STATUS || 'imported').trim().toLowerCase();
  return raw === 'draft' ? 'draft' : 'imported';
}

export function getPoExcelImportTemplateCsv() {
  const lines = [PO_EXCEL_IMPORT_HEADERS.join(',')];
  for (const row of SAMPLE_ROWS) {
    lines.push(PO_EXCEL_IMPORT_HEADERS.map((h) => escapeCsv(row[h] ?? '')).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-#]+/g, '');
}

const HEADER_ALIASES = {
  ponumber: 'poNumber',
  po: 'poNumber',
  pono: 'poNumber',
  oldponumber: 'poNumber',
  prnumber: 'prNumber',
  pr: 'prNumber',
  prno: 'prNumber',
  vendorname: 'vendorName',
  vendor: 'vendorName',
  vendoremail: 'vendorEmail',
  deliveryaddress: 'deliveryAddress',
  address: 'deliveryAddress',
  expecteddeliverydate: 'expectedDeliveryDate',
  deliverydate: 'expectedDeliveryDate',
  paymentterms: 'paymentTerms',
  payment: 'paymentTerms',
  incoterms: 'incoterms',
  gstpercentage: 'gstPercentage',
  gst: 'gstPercentage',
  specialinstructions: 'specialInstructions',
  instructions: 'specialInstructions',
  potype: 'poType',
  entity: 'entity',
  entityname: 'entity',
  itemname: 'itemName',
  name: 'itemName',
  item: 'itemName',
  description: 'description',
  itemdescription: 'description',
  quantity: 'quantity',
  qty: 'quantity',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  rate: 'unitPrice',
  discount: 'discount',
  disc: 'discount',
  discountpercent: 'discount',
  discpct: 'discount',
  category: 'category',
  unit: 'unit',
  uom: 'unit',
};

function clip(value, max) {
  const str = value == null ? '' : String(value).trim();
  if (!max || str.length <= max) return str;
  return str.slice(0, max);
}

function firstNonEmpty(rows, key) {
  for (const r of rows) {
    const v = String(r[key] || '').trim();
    if (v) return v;
  }
  return '';
}

function parseDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  // Excel serial date (days since 1899-12-30)
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      epoch.setUTCDate(epoch.getUTCDate() + Math.floor(serial));
      return epoch.toISOString().slice(0, 10);
    }
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function normalizePoType(raw) {
  const v = String(raw || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  if (v === 'long' || v === 'long_po' || v === 'longpo') return 'long_po';
  return 'short_po';
}

/** Normalize raw sheet rows (array of objects with any headers) into canonical keys. */
export function normalizePoExcelRows(rawRows) {
  if (!Array.isArray(rawRows) || !rawRows.length) return [];
  return rawRows
    .map((row) => {
      const out = {};
      for (const [k, v] of Object.entries(row || {})) {
        const key = HEADER_ALIASES[normalizeHeader(k)];
        if (!key) continue;
        out[key] = v == null ? '' : String(v).trim();
      }
      return out;
    })
    .filter((r) => Object.values(r).some((v) => String(v || '').trim()));
}

function groupByPoNumber(rows) {
  const map = new Map();
  let orphanIdx = 0;
  for (const row of rows) {
    const po = String(row.poNumber || '').trim();
    const key = po || `__missing_${orphanIdx++}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()].map(([key, groupRows]) => ({ key, rows: groupRows }));
}

async function resolveUniquePoNumber(conn, preferred, fallbackIndex) {
  let base =
    String(preferred || '').trim() ||
    `PO-IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(fallbackIndex).padStart(4, '0')}`;
  base = base.slice(0, 36);
  let candidate = base;
  let n = 2;
  for (;;) {
    const [dup] = await conn.query(
      `SELECT id FROM purchase_orders WHERE LOWER(po_number) = LOWER(?) LIMIT 1`,
      [candidate]
    );
    if (!dup.length) return candidate;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    n += 1;
    if (n > 9999) {
      candidate = `PO-IMP-${Date.now()}-${fallbackIndex}`;
      return candidate.slice(0, 40);
    }
  }
}

/**
 * Build PO groups from Excel rows — no field validation.
 * Missing values get safe defaults so rows can still be saved.
 */
export async function buildPoExcelImportGroups(rawRows, conn = pool) {
  const rows = normalizePoExcelRows(rawRows);
  if (!rows.length) {
    return {
      groups: [],
      poCount: 0,
      lineItemCount: 0,
      defaultStatus: getPoExcelImportDefaultStatus(),
    };
  }

  const groups = groupByPoNumber(rows);
  const built = [];
  let autoIdx = 1;

  for (const { key, rows: groupRows } of groups) {
    const excelRowHint = rows.indexOf(groupRows[0]) + 2;
    let poNumber = firstNonEmpty(groupRows, 'poNumber');
    if (!poNumber || key.startsWith('__missing_')) {
      poNumber = '';
    }
    const vendorName = clip(firstNonEmpty(groupRows, 'vendorName') || 'Imported Vendor', 150);
    let vendorEmail = firstNonEmpty(groupRows, 'vendorEmail');
    if (!vendorEmail) {
      vendorEmail = `${vendorName.replace(/\s+/g, '.').toLowerCase().replace(/[^a-z0-9.]/g, '') || 'vendor'}@imported.local`;
    }
    vendorEmail = clip(vendorEmail, 150);
    const deliveryAddress = firstNonEmpty(groupRows, 'deliveryAddress') || '';
    const expectedDeliveryDateRaw = firstNonEmpty(groupRows, 'expectedDeliveryDate');
    const expectedDeliveryDate = parseDate(expectedDeliveryDateRaw);
    const paymentTerms = clip(firstNonEmpty(groupRows, 'paymentTerms') || 'Net 30 Days', 100);
    let specialInstructions = firstNonEmpty(groupRows, 'specialInstructions');
    let incotermsRaw = firstNonEmpty(groupRows, 'incoterms') || 'DDP';
    // Column is VARCHAR(255); move oversized cells into special instructions
    if (incotermsRaw.length > 255) {
      specialInstructions = [specialInstructions, `Incoterms note: ${incotermsRaw}`].filter(Boolean).join('\n');
      const codeMatch = incotermsRaw.match(/^(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i);
      incotermsRaw = codeMatch ? codeMatch[1].toUpperCase() : 'DDP';
    }
    const incoterms = clip(incotermsRaw, 255);
    const gstRaw = firstNonEmpty(groupRows, 'gstPercentage');
    const gstParsed = gstRaw ? Number(gstRaw) : 18;
    const gstPercentage = Number.isFinite(gstParsed) && gstParsed >= 0 ? gstParsed : 18;
    const poType = normalizePoType(firstNonEmpty(groupRows, 'poType'));
    const entity = clip(firstNonEmpty(groupRows, 'entity'), 255);
    const prNumber = firstNonEmpty(groupRows, 'prNumber');

    const lineItems = [];
    for (const r of groupRows) {
      const itemName = String(r.itemName || '').trim();
      const description = String(r.description || '').trim();
      const quantityRaw = Number(r.quantity);
      const unitPriceRaw = Number(r.unitPrice);
      const hasLineSignal =
        itemName ||
        description ||
        String(r.quantity || '').trim() ||
        String(r.unitPrice || '').trim() ||
        String(r.category || '').trim();
      if (!hasLineSignal) continue;
      const quantity = Number.isFinite(quantityRaw) ? quantityRaw : 0;
      const unitPrice = Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0;
      const discountRaw = Number(r.discount);
      const gross = quantity * unitPrice;
      const discount = Number.isFinite(discountRaw)
        ? Math.min(gross, Math.max(0, discountRaw))
        : 0;
      lineItems.push({
        itemName: clip(itemName || description || '(no name)', 255),
        description: description || itemName || '(no description)',
        quantity,
        unitPrice,
        discount,
        total: Math.round((gross - discount) * 100) / 100,
        category: clip(String(r.category || '').trim(), 100),
        unit: clip(String(r.unit || '').trim(), 50),
      });
    }

    if (!lineItems.length) {
      lineItems.push({
        itemName: '(no line items)',
        description: '(no line items)',
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        total: 0,
        category: '',
        unit: '',
      });
    }

    let prId = null;
    if (prNumber) {
      const [prRows] = await conn.query(
        `SELECT id FROM purchase_requests WHERE LOWER(pr_number) = LOWER(?) LIMIT 1`,
        [prNumber]
      );
      if (prRows.length) prId = prRows[0].id;
    }

    let entityId = null;
    if (entity) {
      const [ent] = await conn.query(
        `SELECT id FROM entity_masters WHERE LOWER(name) = LOWER(?) OR LOWER(COALESCE(code,'')) = LOWER(?) LIMIT 1`,
        [entity, entity]
      );
      if (ent.length) entityId = ent[0].id;
    }

    const resolvedPoNumber = await resolveUniquePoNumber(conn, poNumber, autoIdx++);
    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const taxAmount = (subtotal * gstPercentage) / 100;

    built.push({
      poNumber: resolvedPoNumber,
      sourcePoNumber: poNumber || null,
      prNumber: prNumber || null,
      prId,
      vendorName,
      vendorEmail,
      deliveryAddress,
      expectedDeliveryDate,
      paymentTerms,
      incoterms,
      gstPercentage,
      specialInstructions,
      poType,
      entity,
      entityId,
      lineItems,
      subtotal,
      taxAmount,
      grandTotal: subtotal + taxAmount,
      excelRow: excelRowHint,
    });
  }

  return {
    groups: built,
    poCount: built.length,
    lineItemCount: built.reduce((s, g) => s + g.lineItems.length, 0),
    defaultStatus: getPoExcelImportDefaultStatus(),
  };
}

/** Preview only — no validation errors. */
export async function validatePoExcelImport(rawRows) {
  const built = await buildPoExcelImportGroups(rawRows);
  return {
    valid: built.groups.length > 0,
    errors: [],
    groups: built.groups,
    poCount: built.poCount,
    lineItemCount: built.lineItemCount,
    defaultStatus: built.defaultStatus,
  };
}

/**
 * Import POs with no field validation.
 * Does NOT create workflow tasks, approval history, or send emails.
 */
export async function importPoExcelRows(user, rawRows, { status } = {}) {
  if (user.role !== 'SCM Buyer' && user.role !== 'Super Admin') {
    throw new Error('Only SCM Buyer can import purchase orders');
  }

  const rows = normalizePoExcelRows(rawRows);
  if (!rows.length) {
    throw new Error('No data rows found in the file');
  }

  const targetStatus =
    status === 'draft' || status === 'imported' ? status : getPoExcelImportDefaultStatus();

  const created = [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const built = await buildPoExcelImportGroups(rawRows, conn);

    for (const group of built.groups) {
      const [result] = await conn.query(
        `INSERT INTO purchase_orders
         (po_number, reference_po_number, pr_id, vendor_name, vendor_email, rfq_invitation_id, created_by,
          delivery_address, expected_delivery_date, payment_terms, incoterms, special_instructions,
          po_type, letterhead_header, letterhead_id, entity_id, entity, header_logo, footer_logo,
          terms_clauses, annexure_clauses, gst_percentage, subtotal, tax_amount, grand_total, status)
         VALUES (?, NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, '', '', NULL, NULL, ?, ?, ?, ?, ?)`,
        [
          group.poNumber,
          group.prId,
          group.vendorName,
          group.vendorEmail,
          user.id,
          group.deliveryAddress || null,
          group.expectedDeliveryDate,
          group.paymentTerms,
          group.incoterms,
          group.specialInstructions || null,
          group.poType,
          group.entityId,
          group.entity || '',
          group.gstPercentage,
          group.subtotal,
          group.taxAmount,
          group.grandTotal,
          targetStatus,
        ]
      );

      const poId = result.insertId;
      for (const item of group.lineItems) {
        const discount = Math.min(100, Math.max(0, Number(item.discount) || 0));
        await conn.query(
          `INSERT INTO po_line_items (po_id, category, item_name, description, quantity, unit_price, discount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            poId,
            item.category || '',
            item.itemName || null,
            item.description,
            item.quantity,
            item.unitPrice,
            discount,
            item.total,
          ]
        );
      }

      created.push({ poId, poNumber: group.poNumber, status: targetStatus, lineItems: group.lineItems.length });
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return {
    success: true,
    imported: created.length,
    failed: 0,
    errors: [],
    created,
    defaultStatus: targetStatus,
    message: `Imported ${created.length} purchase order(s) as ${targetStatus}`,
  };
}
