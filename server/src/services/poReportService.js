import pool from '../config/db.js';
import { resolveUserEntityScope, poEntityScopeSql } from '../utils/entityScope.js';

const EXCLUDED_DOC_SQL = ` AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass' AND po.po_number NOT LIKE 'CS-%'`;

/** Line category is often blank on imported POs — fall back to vendor / release category. */
const CATEGORY_EXPR = `COALESCE(
  NULLIF(TRIM(pli.category), ''),
  NULLIF(TRIM(v.category), ''),
  NULLIF(TRIM(po.po_release_category), ''),
  '—'
)`;

const STATUS_LABELS = {
  draft: 'Draft',
  imported: 'Imported',
  pending_value_approval: 'Pending Value Approval',
  pending_approval: 'Pending SCM Manager Sign',
  pending_buyer_verify: 'SCM Manager Signed — Buyer Verify',
  approved: 'Approved',
  rejected: 'Rejected',
  sent_to_vendor: 'Pending Vendor Acceptance',
  awaiting_grn: 'Awaiting GRN',
  grn_completed: 'GRN Completed',
  invoice_entry: 'Invoice Entry',
  pending_accounts_approval: 'Pending Accounts Approval',
  approved_for_payment: 'Approved for Payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function lineTax(total, taxPercentage) {
  return roundMoney(((Number(total) || 0) * (Number(taxPercentage) || 0)) / 100);
}

function statusLabel(status, purchaseType) {
  const s = String(status || '');
  if (s === 'approved' || s === 'rejected') {
    const isWo = String(purchaseType || '').toLowerCase() === 'work_order';
    return `${isWo ? 'WO' : 'PO'} ${STATUS_LABELS[s] || s}`;
  }
  return STATUS_LABELS[s] || s || 'Unknown';
}

function formatDate(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * Build shared FROM/WHERE for consolidated PO line report.
 * Grain is always po_line_items.id (no header fan-out in list rows).
 */
async function buildReportFilter(user, filters = {}) {
  const scope = await resolveUserEntityScope(user);
  const poScope = poEntityScopeSql(scope.entityId);

  const search = String(filters.search || '').trim();
  const status = String(filters.status || '').trim();
  const vendor = String(filters.vendor || '').trim();
  const category = String(filters.category || '').trim();
  const item = String(filters.item || '').trim();
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();
  const purchaseType = String(filters.purchaseType || '').trim();

  const joins = [
    'FROM po_line_items pli',
    'INNER JOIN purchase_orders po ON po.id = pli.po_id',
    'LEFT JOIN vendors v ON v.id = po.vendor_id',
  ];
  if (poScope.join) joins.push(poScope.join.trim());
  else joins.push('LEFT JOIN purchase_requests pr ON pr.id = po.pr_id');
  const joinSql = joins.join('\n');

  const where = ['WHERE 1=1', EXCLUDED_DOC_SQL, poScope.where || ''];
  const params = [...(poScope.params || [])];

  if (status && status !== 'all') {
    where.push(' AND po.status = ?');
    params.push(status);
  }
  if (vendor) {
    where.push(' AND COALESCE(NULLIF(TRIM(v.name), \'\'), NULLIF(TRIM(po.vendor_name), \'\'), \'\') = ?');
    params.push(vendor);
  }
  if (category) {
    where.push(` AND ${CATEGORY_EXPR} = ?`);
    params.push(category);
  }
  if (item) {
    where.push(' AND LOWER(TRIM(pli.item_name)) = LOWER(TRIM(?))');
    params.push(item);
  }
  if (purchaseType && purchaseType !== 'all') {
    where.push(' AND COALESCE(po.purchase_type, \'purchase_order\') = ?');
    params.push(purchaseType);
  }
  const poDateExpr = 'DATE(COALESCE(po.po_date, po.created_at))';
  if (dateFrom) {
    where.push(` AND ${poDateExpr} >= ?`);
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push(` AND ${poDateExpr} <= ?`);
    params.push(dateTo);
  }
  if (search) {
    const like = `%${search}%`;
    where.push(` AND (
      po.po_number LIKE ?
      OR COALESCE(po.vendor_name, '') LIKE ?
      OR COALESCE(v.name, '') LIKE ?
      OR COALESCE(pli.item_name, '') LIKE ?
      OR COALESCE(pli.category, '') LIKE ?
    )`);
    params.push(like, like, like, like, like);
  }

  return {
    scope,
    joinSql,
    whereSql: where.join(''),
    params,
    filters: { search, status, vendor, category, item, dateFrom, dateTo, purchaseType },
  };
}

function mapRow(r) {
  const lineExGst = roundMoney(r.line_ex_gst);
  const taxPct = Number(r.tax_percentage) || 0;
  const taxAmount = lineTax(lineExGst, taxPct);
  return {
    lineId: Number(r.line_id),
    poId: Number(r.po_id),
    poNumber: r.po_number || '',
    poDate: formatDate(r.po_date),
    status: r.status || '',
    statusLabel: statusLabel(r.status, r.purchase_type),
    purchaseType: r.purchase_type || 'purchase_order',
    vendorId: r.vendor_id != null ? Number(r.vendor_id) : null,
    vendorName: r.vendor_name || '—',
    category: r.category || '—',
    itemName: r.item_name || '—',
    description: r.description || '',
    quantity: Number(r.quantity) || 0,
    uom: r.uom || '—',
    unitRate: roundMoney(r.unit_price),
    taxPercentage: taxPct,
    taxAmount,
    lineExGst,
    lineTotal: roundMoney(lineExGst + taxAmount),
    poGrandTotal: roundMoney(r.po_grand_total),
  };
}

/**
 * Consolidated PO report — line-level rows + header-safe summary + filter options.
 * Does not alter PO create/approval workflows.
 */
export async function getConsolidatedPoReport(user, filters = {}) {
  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(filters.limit) || 50));
  const offset = (page - 1) * limit;

  const { joinSql, whereSql, params, filters: f } = await buildReportFilter(user, filters);

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS line_count
     ${joinSql}
     ${whereSql}`,
    params
  );

  const [[summary]] = await pool.query(
    `SELECT
       COUNT(DISTINCT po.id) AS po_count,
       COUNT(DISTINCT COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(po.vendor_name), ''), CONCAT('id:', po.id))) AS vendor_count,
       COALESCE(SUM(pli.quantity), 0) AS total_quantity,
       COALESCE(SUM(pli.total), 0) AS total_line_ex_gst,
       COALESCE(SUM(pli.total * COALESCE(pli.tax_percentage, 0) / 100), 0) AS total_line_tax
     ${joinSql}
     ${whereSql}`,
    params
  );

  // Header PO value for distinct POs that have ≥1 matching line (no line fan-out)
  const [[poValueRow]] = await pool.query(
    `SELECT COALESCE(SUM(x.grand_total), 0) AS total_po_value
     FROM (
       SELECT DISTINCT po.id, po.grand_total
       ${joinSql}
       ${whereSql}
     ) x`,
    params
  );

  const [rows] = await pool.query(
    `SELECT
       pli.id AS line_id,
       po.id AS po_id,
       po.po_number,
       COALESCE(po.po_date, po.created_at) AS po_date,
       po.status,
       po.purchase_type,
       po.vendor_id,
       COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(po.vendor_name), ''), '—') AS vendor_name,
       ${CATEGORY_EXPR} AS category,
       pli.item_name,
       pli.description,
       pli.quantity,
       pli.unit AS uom,
       pli.unit_price,
       pli.tax_percentage,
       pli.total AS line_ex_gst,
       po.grand_total AS po_grand_total
     ${joinSql}
     ${whereSql}
     ORDER BY COALESCE(po.po_date, po.created_at) DESC, po.id DESC, pli.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Filter option lists (scoped; not limited by current vendor/category/item so user can switch)
  const baseFilters = {
    ...f,
    vendor: '',
    category: '',
    item: '',
    search: '',
  };
  const base = await buildReportFilter(user, {
    ...baseFilters,
    status: f.status,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    purchaseType: f.purchaseType,
  });

  const [vendorOpts] = await pool.query(
    `SELECT DISTINCT COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(po.vendor_name), '')) AS name
     ${base.joinSql}
     ${base.whereSql}
       AND COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(po.vendor_name), ''), '') <> ''
     ORDER BY name ASC
     LIMIT 500`,
    base.params
  );
  const [categoryOpts] = await pool.query(
    `SELECT DISTINCT ${CATEGORY_EXPR} AS name
     ${base.joinSql}
     ${base.whereSql}
       AND ${CATEGORY_EXPR} <> '—'
     ORDER BY name ASC
     LIMIT 300`,
    base.params
  );
  const [itemOpts] = await pool.query(
    `SELECT DISTINCT pli.item_name AS name
     ${base.joinSql}
     ${base.whereSql}
       AND COALESCE(TRIM(pli.item_name), '') <> ''
     ORDER BY name ASC
     LIMIT 500`,
    base.params
  );
  const [statusOpts] = await pool.query(
    `SELECT DISTINCT po.status AS status
     ${base.joinSql}
     ${base.whereSql}
       AND COALESCE(po.status, '') <> ''
     ORDER BY status ASC`,
    base.params
  );

  // Vendor-wise compare for the same item (when item filter set, or derived from compareItem)
  const compareItem = String(filters.compareItem || f.item || '').trim();
  let comparison = [];
  if (compareItem) {
    const cmp = await buildReportFilter(user, { ...f, item: compareItem, vendor: '' });
    const [cmpRows] = await pool.query(
      `SELECT
         COALESCE(NULLIF(TRIM(v.name), ''), NULLIF(TRIM(po.vendor_name), ''), '—') AS vendor_name,
         pli.item_name,
         ${CATEGORY_EXPR} AS category,
         COUNT(DISTINCT po.id) AS po_count,
         COALESCE(SUM(pli.quantity), 0) AS total_quantity,
         MIN(pli.unit_price) AS min_rate,
         MAX(pli.unit_price) AS max_rate,
         AVG(pli.unit_price) AS avg_rate,
         COALESCE(SUM(pli.total), 0) AS total_ex_gst
       ${cmp.joinSql}
       ${cmp.whereSql}
       GROUP BY vendor_name, pli.item_name, category
       ORDER BY avg_rate ASC, vendor_name ASC
       LIMIT 100`,
      cmp.params
    );
    comparison = cmpRows.map((r) => ({
      vendorName: r.vendor_name || '—',
      itemName: r.item_name || compareItem,
      category: r.category || '—',
      poCount: Number(r.po_count) || 0,
      totalQuantity: Number(r.total_quantity) || 0,
      minRate: roundMoney(r.min_rate),
      maxRate: roundMoney(r.max_rate),
      avgRate: roundMoney(r.avg_rate),
      totalExGst: roundMoney(r.total_ex_gst),
    }));
  }

  const lineCount = Number(countRow?.line_count) || 0;
  const totalPages = Math.max(1, Math.ceil(lineCount / limit));

  return {
    summary: {
      totalPOs: Number(summary?.po_count) || 0,
      totalVendors: Number(summary?.vendor_count) || 0,
      totalQuantity: Number(summary?.total_quantity) || 0,
      totalPoValue: roundMoney(poValueRow?.total_po_value),
      totalLineExGst: roundMoney(summary?.total_line_ex_gst),
      totalLineTax: roundMoney(summary?.total_line_tax),
      totalLineValue: roundMoney(
        Number(summary?.total_line_ex_gst || 0) + Number(summary?.total_line_tax || 0)
      ),
      lineCount,
    },
    rows: rows.map(mapRow),
    comparison,
    compareItem: compareItem || null,
    filterOptions: {
      vendors: vendorOpts.map((r) => r.name).filter(Boolean),
      categories: categoryOpts.map((r) => r.name).filter(Boolean),
      items: itemOpts.map((r) => r.name).filter(Boolean),
      statuses: statusOpts.map((r) => ({
        value: r.status,
        label: statusLabel(r.status),
      })),
    },
    pagination: {
      page,
      limit,
      total: lineCount,
      totalPages,
    },
  };
}
