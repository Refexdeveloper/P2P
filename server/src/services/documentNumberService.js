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
  if (raw === 'work_order' || raw === 'workorder' || raw === 'wo') {
    return 'work_order';
  }
  if (raw === 'sass' || raw === 'saas' || raw === 'cloud_subscription') {
    return 'sass';
  }
  return 'purchase_order';
}

/** Map purchase type → document number prefix / sequence key. */
export function purchaseTypeToDocType(purchaseType) {
  return normalizePurchaseType(purchaseType) === 'work_order' ? 'WO' : 'PO';
}

export function purchaseTypeLabel(purchaseType) {
  const t = normalizePurchaseType(purchaseType);
  if (t === 'work_order') return 'Work Order';
  if (t === 'sass') return 'Cloud Subscription';
  return 'Purchase Order';
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
 * Highest #### already used for this doc type + entity code + FY
 * (keeps sequences in sync when drafts previously consumed official numbers).
 */
async function maxExistingDocumentSeq(docType, entityCode, fyLabel, connection = pool) {
  const type = String(docType || '').toUpperCase();
  const prefix = `${type}-${entityCode}-${fyLabel}-`;
  if (type === 'PR') {
    const [rows] = await connection.query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(pr_number, '-', -1) AS UNSIGNED)) AS max_seq
       FROM purchase_requests
       WHERE pr_number LIKE ?
         AND pr_number NOT LIKE 'DRAFT-%'`,
      [`${prefix}%`]
    );
    return Number(rows[0]?.max_seq) || 0;
  }
  const [rows] = await connection.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(po_number, '-', -1) AS UNSIGNED)) AS max_seq
     FROM purchase_orders
     WHERE po_number LIKE ?`,
    [`${prefix}%`]
  );
  return Number(rows[0]?.max_seq) || 0;
}

/**
 * Assign official PR-{ENTITY}-{FY}-{seq} when a draft is submitted.
 * No-op if the PR already has a real number (e.g. returned for rework).
 */
export async function assignOfficialPrNumberIfNeeded(prId, entityId, currentPrNumber, connection = pool) {
  if (!isDraftPlaceholderPrNumber(currentPrNumber)) {
    return String(currentPrNumber || '');
  }

  let lastErr;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const prNumber = await nextDocumentNumber('PR', Number(entityId), connection);
    try {
      await connection.query(`UPDATE purchase_requests SET pr_number = ? WHERE id = ?`, [prNumber, prId]);
      return prNumber;
    } catch (err) {
      lastErr = err;
      // Another PR already holds this number — advance sequence and retry
      if (err?.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(String(err?.message || ''))) {
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('Could not assign a unique PR number. Please try again.');
}

/**
 * Atomically increments and returns next number:
 * PR-RGML-2025-26-0001 / PO-RGML-2025-26-0001 / WO-RGML-2025-26-0001
 * PO and WO sequences increment separately per entity + FY.
 * Sequence is floored to max(existing documents) so submit never reuses a number.
 */
export async function nextDocumentNumber(docType, entityId, connection = pool) {
  const raw = String(docType || '').toUpperCase();
  const type = raw === 'PO' ? 'PO' : raw === 'WO' ? 'WO' : 'PR';
  const entity = await resolveEntityForNumbering(entityId, connection);
  const fyLabel = getIndianFinancialYearLabel();
  const maxExisting = await maxExistingDocumentSeq(type, entity.code, fyLabel, connection);

  // First insert: start at maxExisting+1. Concurrent updates: GREATEST(last_seq, maxExisting)+1.
  await connection.query(
    `INSERT INTO document_number_sequences (doc_type, entity_id, fy_label, last_seq)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, ?) + 1`,
    [type, entity.id, fyLabel, maxExisting + 1, maxExisting]
  );

  const [rows] = await connection.query(
    `SELECT last_seq FROM document_number_sequences
     WHERE doc_type = ? AND entity_id = ? AND fy_label = ?`,
    [type, entity.id, fyLabel]
  );

  const seq = String(Number(rows[0]?.last_seq || maxExisting + 1)).padStart(4, '0');
  return `${type}-${entity.code}-${fyLabel}-${seq}`;
}

/**
 * Preview next number without consuming the sequence (UI only).
 * Actual assignment still happens on save via nextDocumentNumber.
 */
export async function peekNextDocumentNumber(docType, entityId, connection = pool) {
  const raw = String(docType || '').toUpperCase();
  const type = raw === 'PO' ? 'PO' : raw === 'WO' ? 'WO' : 'PR';
  const entity = await resolveEntityForNumbering(entityId, connection);
  const fyLabel = getIndianFinancialYearLabel();
  const maxExisting = await maxExistingDocumentSeq(type, entity.code, fyLabel, connection);

  const [rows] = await connection.query(
    `SELECT last_seq FROM document_number_sequences
     WHERE doc_type = ? AND entity_id = ? AND fy_label = ?`,
    [type, entity.id, fyLabel]
  );
  const lastSeq = Number(rows[0]?.last_seq) || 0;
  const nextSeq = Math.max(lastSeq, maxExisting) + 1;
  return `${type}-${entity.code}-${fyLabel}-${String(nextSeq).padStart(4, '0')}`;
}
