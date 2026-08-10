import pool from '../config/db.js';
import { SHORT_PO_LETTERHEAD_DEFAULTS } from './shortPoLetterheadDefaults.js';
import { LONG_PO_LETTERHEAD_DEFAULTS } from './longPoLetterheadDefaults.js';

export const PO_TYPES = ['short_po', 'long_po'];

export const PO_TYPE_LABELS = {
  short_po: 'Short PO',
  long_po: 'Long PO',
};

function normalizePoType(poType) {
  const normalized = String(poType || '').trim().toLowerCase();
  if (!PO_TYPES.includes(normalized)) {
    throw new Error('Invalid PO type. Use short_po or long_po.');
  }
  return normalized;
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

export async function seedLetterheadDefaults() {
  // Short PO: apply Refex commercial template when missing, or when still on old stub defaults
  const [shortClauses] = await pool.query(
    `SELECT c.terms_header, c.section_type
     FROM po_letterhead_clauses c
     JOIN po_letterhead_masters m ON m.id = c.master_id
     WHERE m.po_type = 'short_po'`
  );
  const headerPlain = (value) =>
    String(value || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const hasShortParties = shortClauses.some(
    (c) => c.section_type === 'annexure' && headerPlain(c.terms_header) === 'parties'
  );
  if (!shortClauses.length || !hasShortParties) {
    await saveLetterhead('short_po', SHORT_PO_LETTERHEAD_DEFAULTS);
  }

  // Long PO: apply Refex long commercial template when missing or still on stub defaults
  const [longClauses] = await pool.query(
    `SELECT c.terms_header, c.section_type
     FROM po_letterhead_clauses c
     JOIN po_letterhead_masters m ON m.id = c.master_id
     WHERE m.po_type = 'long_po'`
  );
  const hasLongPacking = longClauses.some(
    (c) => c.section_type === 'annexure' && headerPlain(c.terms_header) === 'packing'
  );
  if (!longClauses.length || !hasLongPacking) {
    await saveLetterhead('long_po', LONG_PO_LETTERHEAD_DEFAULTS);
  }
}
