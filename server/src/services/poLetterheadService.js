import pool from '../config/db.js';
import { SHORT_PO_LETTERHEAD_DEFAULTS } from './shortPoLetterheadDefaults.js';
import { LONG_PO_LETTERHEAD_DEFAULTS } from './longPoLetterheadDefaults.js';
import {
  SHORT_WO_LETTERHEAD_DEFAULTS,
  LONG_WO_LETTERHEAD_DEFAULTS,
} from './woLetterheadDefaults.js';

export const PO_TYPES = ['short_po', 'long_po', 'short_wo', 'long_wo'];

export const PO_TYPE_LABELS = {
  short_po: 'Short PO',
  long_po: 'Long PO',
  short_wo: 'Short WO',
  long_wo: 'Long WO',
};

export function normalizePoType(poType) {
  const normalized = String(poType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!PO_TYPES.includes(normalized)) {
    throw new Error('Invalid PO type. Use short_po, long_po, short_wo, or long_wo.');
  }
  return normalized;
}

/** Align template family with document kind (PO ↔ WO). */
export function alignPoTypeWithPurchaseType(poType, purchaseType) {
  const raw = String(poType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isLong = raw === 'long_po' || raw === 'long_wo' || raw === 'long';
  const isWo =
    String(purchaseType || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') === 'work_order';
  if (isWo) return isLong ? 'long_wo' : 'short_wo';
  return isLong ? 'long_po' : 'short_po';
}

function mapClause(row) {
  return {
    id: row.id,
    termsHeader: row.terms_header,
    termsDescription: row.terms_description,
    sortOrder: row.sort_order,
  };
}

async function ensureMaster(poType) {
  await pool.query(
    `INSERT INTO po_letterhead_masters (po_type, title)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE po_type = po_type`,
    [poType, PO_TYPE_LABELS[poType]]
  );
  const [rows] = await pool.query(`SELECT * FROM po_letterhead_masters WHERE po_type = ?`, [poType]);
  return rows[0];
}

export async function getLetterheadByType(poTypeInput) {
  const poType = normalizePoType(poTypeInput);
  const master = await ensureMaster(poType);

  const [clauses] = await pool.query(
    `SELECT * FROM po_letterhead_clauses
     WHERE master_id = ?
     ORDER BY section_type ASC, sort_order ASC, id ASC`,
    [master.id]
  );

  const terms = [];
  const annexure = [];
  for (const row of clauses) {
    const item = mapClause(row);
    if (row.section_type === 'annexure') annexure.push(item);
    else terms.push(item);
  }

  return {
    poType,
    poTypeLabel: PO_TYPE_LABELS[poType],
    title: master.title,
    letterheadHeader: master.letterhead_header || '',
    terms,
    annexure,
    updatedAt: master.updated_at,
  };
}

export async function listLetterheads() {
  const results = [];
  for (const poType of PO_TYPES) {
    results.push(await getLetterheadByType(poType));
  }
  return results;
}

export async function saveLetterhead(poTypeInput, payload) {
  const poType = normalizePoType(poTypeInput);
  const {
    title,
    letterheadHeader,
    terms = [],
    annexure = [],
  } = payload || {};

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const master = await ensureMaster(poType);

    await conn.query(
      `UPDATE po_letterhead_masters
       SET title = ?, letterhead_header = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title || PO_TYPE_LABELS[poType],
        letterheadHeader || '',
        master.id,
      ]
    );

    await conn.query(`DELETE FROM po_letterhead_clauses WHERE master_id = ?`, [master.id]);

    const plainText = (value) =>
      String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const insertClause = async (sectionType, items) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const header = (item.termsHeader || '').trim();
        const description = item.termsDescription || '';
        if (!plainText(header) && !plainText(description)) continue;

        await conn.query(
          `INSERT INTO po_letterhead_clauses (master_id, section_type, sort_order, terms_header, terms_description)
           VALUES (?, ?, ?, ?, ?)`,
          [master.id, sectionType, i + 1, header || 'Untitled', description]
        );
      }
    };

    await insertClause('terms', terms);
    await insertClause('annexure', annexure);

    await conn.commit();
    return getLetterheadByType(poType);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function clauseHeadersForType(poType) {
  const [rows] = await pool.query(
    `SELECT c.terms_header, c.terms_description, c.section_type
     FROM po_letterhead_clauses c
     JOIN po_letterhead_masters m ON m.id = c.master_id
     WHERE m.po_type = ?`,
    [poType]
  );
  return rows;
}

const headerPlain = (value) =>
  String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export async function seedLetterheadDefaults() {
  // Short PO: apply Refex commercial template when missing, or when still on old stub defaults
  const shortClauses = await clauseHeadersForType('short_po');
  const hasShortParties = shortClauses.some(
    (c) => c.section_type === 'annexure' && headerPlain(c.terms_header) === 'parties'
  );
  if (!shortClauses.length || !hasShortParties) {
    await saveLetterhead('short_po', SHORT_PO_LETTERHEAD_DEFAULTS);
  }

  // Long PO: apply Refex long commercial template (live terms + 25 annexure clauses)
  const longClauses = await clauseHeadersForType('long_po');
  const hasLongPacking = longClauses.some(
    (c) => c.section_type === 'annexure' && headerPlain(c.terms_header) === 'packing'
  );
  const hasLiveInco = longClauses.some(
    (c) =>
      c.section_type === 'terms' &&
      String(c.terms_description || '').includes('$aos_quotes_inco_terms_c')
  );
  const longAnnexureCount = longClauses.filter((c) => c.section_type === 'annexure').length;
  if (!longClauses.length || !hasLongPacking || !hasLiveInco || longAnnexureCount !== 25) {
    await saveLetterhead('long_po', LONG_PO_LETTERHEAD_DEFAULTS);
  }

  // Short WO / Long WO — seed once when empty
  const shortWoClauses = await clauseHeadersForType('short_wo');
  if (!shortWoClauses.length) {
    await saveLetterhead('short_wo', SHORT_WO_LETTERHEAD_DEFAULTS);
  }

  const longWoClauses = await clauseHeadersForType('long_wo');
  if (!longWoClauses.length) {
    await saveLetterhead('long_wo', LONG_WO_LETTERHEAD_DEFAULTS);
  }
}
