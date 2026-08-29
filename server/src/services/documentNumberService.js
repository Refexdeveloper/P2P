import pool from '../config/db.js';

/**
 * Indian financial year label, e.g. 2025-26 (1 Apr – 31 Mar).
 */
export function getIndianFinancialYearLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan
  const startYear = month >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

export function sanitizeEntityCode(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return cleaned || 'ENT';
}

export async function resolveEntityForNumbering(entityId, connection = pool) {
  const id = Number(entityId);
  if (!id) throw new Error('Entity is required for document numbering');

  const [rows] = await connection.query(
    `SELECT id, name, code, cost_center, status FROM entity_masters WHERE id = ?`,
    [id]
  );
  if (!rows.length) throw new Error('Entity not found');
  const row = rows[0];
  if (row.status === 'inactive') throw new Error('Selected entity is inactive');

  const code = sanitizeEntityCode(row.code || row.cost_center || row.name);
  return {
    id: row.id,
    name: row.name,
    code,
    costCenter: row.cost_center || '',
  };
}

/** Normalize purchase type from PR/PO body or DB. */
export function normalizePurchaseType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (
    raw === 'work_order' ||
    raw === 'workorder' ||
    raw === 'wo'
  ) {
    return 'work_order';
  }
  return 'purchase_order';
}

/** Map purchase type → document number prefix / sequence key. */
export function purchaseTypeToDocType(purchaseType) {
  return normalizePurchaseType(purchaseType) === 'work_order' ? 'WO' : 'PO';
}

export function purchaseTypeLabel(purchaseType) {
  return normalizePurchaseType(purchaseType) === 'work_order' ? 'Work Order' : 'Purchase Order';
}

/** Temporary / draft PR numbers must not consume the official FY sequence. */
export function isDraftPlaceholderPrNumber(prNumber) {
  const n = String(prNumber || '').trim().toUpperCase();
  return n.startsWith('DRAFT-');
}

export function stableDraftPrNumber(prId) {
  return `DRAFT-${Number(prId)}`;
}

/** Unique value for INSERT before id is known (replaced with DRAFT-{id} after insert). */
export function tempDraftPrNumber(userId) {
  return `DRAFT-TMP-${Number(userId) || 0}-${Date.now()}`;
}

/**
 * Assign official PR-{ENTITY}-{FY}-{seq} when a draft is submitted.
 * No-op if the PR already has a real number (e.g. returned for rework).
 */
export async function assignOfficialPrNumberIfNeeded(prId, entityId, currentPrNumber, connection = pool) {
  if (!isDraftPlaceholderPrNumber(currentPrNumber)) {
    return String(currentPrNumber || '');
  }
  const prNumber = await nextDocumentNumber('PR', Number(entityId), connection);
  await connection.query(`UPDATE purchase_requests SET pr_number = ? WHERE id = ?`, [prNumber, prId]);
  return prNumber;
}

/**
 * Atomically increments and returns next number:
 * PR-RGML-2025-26-0001 / PO-RGML-2025-26-0001 / WO-RGML-2025-26-0001
 * PO and WO sequences increment separately per entity + FY.
 */
export async function nextDocumentNumber(docType, entityId, connection = pool) {
  const raw = String(docType || '').toUpperCase();
  const type = raw === 'PO' ? 'PO' : raw === 'WO' ? 'WO' : 'PR';
  const entity = await resolveEntityForNumbering(entityId, connection);
  const fyLabel = getIndianFinancialYearLabel();

  await connection.query(
    `INSERT INTO document_number_sequences (doc_type, entity_id, fy_label, last_seq)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [type, entity.id, fyLabel]
  );

  const [rows] = await connection.query(
    `SELECT last_seq FROM document_number_sequences
     WHERE doc_type = ? AND entity_id = ? AND fy_label = ?`,
    [type, entity.id, fyLabel]
  );

  const seq = String(Number(rows[0]?.last_seq || 1)).padStart(4, '0');
  return `${type}-${entity.code}-${fyLabel}-${seq}`;
}
