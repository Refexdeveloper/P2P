import pool from '../config/db.js';
import { SHORT_PO_LETTERHEAD_DEFAULTS } from './shortPoLetterheadDefaults.js';
import { LONG_PO_LETTERHEAD_DEFAULTS } from './longPoLetterheadDefaults.js';
import {
  SHORT_WO_LETTERHEAD_DEFAULTS,
  LONG_WO_LETTERHEAD_DEFAULTS,
} from './woLetterheadDefaults.js';

export const PO_TYPES = [
  'short_po',
  'long_po',
  'short_wo',
  'long_wo',
  'custom_short_po',
  'custom_long_po',
  'custom_short_wo',
  'custom_long_wo',
];

export const PO_TYPE_LABELS = {
  short_po: 'Short PO',
  long_po: 'Long PO',
  short_wo: 'Short WO',
  long_wo: 'Long WO',
  custom_short_po: 'Custom PO — Short',
  custom_long_po: 'Custom PO — Long',
  custom_short_wo: 'Custom WO — Short',
  custom_long_wo: 'Custom WO — Long',
};

export function isLongPoType(poType) {
  return String(poType || '')
    .trim()
    .toLowerCase()
    .includes('long');
}

export function isCustomPoType(poType) {
  return String(poType || '')
    .trim()
    .toLowerCase()
    .includes('custom');
}

export function normalizePoType(poType) {
  const normalized = String(poType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!PO_TYPES.includes(normalized)) {
    throw new Error(`Invalid PO type. Use one of: ${PO_TYPES.join(', ')}.`);
  }
  return normalized;
}

/** Align template family with document kind (PO ↔ WO). Preserves custom vs standard and long vs short. */
export function alignPoTypeWithPurchaseType(poType, purchaseType) {
  const raw = String(poType || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const isLong = isLongPoType(raw);
  const isCustom = isCustomPoType(raw);
  const isWo =
    String(purchaseType || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') === 'work_order';
  if (isCustom) {
    if (isWo) return isLong ? 'custom_long_wo' : 'custom_short_wo';
    return isLong ? 'custom_long_po' : 'custom_short_po';
  }
  if (isWo) return isLong ? 'long_wo' : 'short_wo';
  return isLong ? 'long_po' : 'short_po';
}

function mapClause(row) {
  let termsHeader = String(row.terms_header || '');
  const plain = termsHeader
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (/^(quote\s*no|rfq\s*no|quote\s*number|rfq\s*number)$/.test(plain) || /^(quote|rfq)\s*(no|number)\b/.test(plain)) {
    termsHeader = 'Quote No';
  } else {
    termsHeader = termsHeader.replace(/RFQ\s*No\.?/gi, 'Quote No').replace(/RFQ\s*Number/gi, 'Quote Number');
  }
  let termsDescription = String(row.terms_description || '');
  termsDescription = termsDescription
    .replace(/\$aos_quotes_rfq_no_c/gi, '$aos_quotes_quote_no_c')
    .replace(/RFQ\s*No\.?/gi, 'Quote No');
  return {
    id: row.id,
    termsHeader,
    termsDescription,
    sortOrder: row.sort_order,
  };
}

function isQuoteNoHeaderPlain(value) {
  const plain = String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\//g, ' ')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!plain) return false;
  if (
    /^(quote|quotation|rfq)\s*(no|number)(\s*(date|c))?$/.test(plain) ||
    /^ref\s*no(\s*date)?$/.test(plain)
  ) {
    return true;
  }
  return /^(quote|rfq|quotation)\s*(no|number)\b/.test(plain) && plain.length <= 48;
}

/** Quote No belongs on the document header only — never in Terms & Conditions. */
export function stripQuoteNoTermRows(terms = []) {
  return (Array.isArray(terms) ? terms : []).filter(
    (t) => !isQuoteNoHeaderPlain(t.termsHeader || t.terms_header)
  );
}

function stripHtmlPlain(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtmlPlain(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Free text typed in the Quote No terms row (ignores SugarCRM placeholders). */
export function extractQuoteNoFromTermsDescription(html) {
  const withoutPlaceholders = String(html || '')
    .replace(/\$aos_quotes_[a-z0-9_]+/gi, ' ')
    .replace(/\$[a-z0-9_]+/gi, ' ');
  const text = stripHtmlPlain(withoutPlaceholders)
    .replace(/^[—–\-]+|[—–\-]+$/g, '')
    .trim();
  return text || '';
}

/**
 * Keep Quote No on poTermsDetails (header line) and remove it from Terms & Conditions.
 */
export function mergeQuoteNoIntoPoContent(terms = [], poTermsDetails = {}) {
  const list = Array.isArray(terms) ? [...terms] : [];
  const details = { ...(poTermsDetails || {}) };
  let quoteNo = String(details.quoteNo || details.quote_no || details.quotationNo || details.rfqNo || '').trim();

  if (!quoteNo) {
    for (const term of list) {
      const header = term.termsHeader || term.terms_header || '';
      if (!isQuoteNoHeaderPlain(header)) continue;
      quoteNo = extractQuoteNoFromTermsDescription(
        term.termsDescription || term.terms_description || ''
      );
      if (quoteNo) break;
    }
  }

  return {
    terms: stripQuoteNoTermRows(list),
    poTermsDetails: { ...details, quoteNo },
    quoteNo,
  };
}

/**
 * Remove Quote No / RFQ No rows from letterhead masters — Quote No is header-only.
 */
async function deleteQuoteNoClausesFromDb(poType) {
  const master = await ensureMaster(poType);
  const [existing] = await pool.query(
    `SELECT id, terms_header
     FROM po_letterhead_clauses
     WHERE master_id = ? AND section_type = 'terms'`,
    [master.id]
  );
  const ids = existing.filter((r) => isQuoteNoHeaderPlain(r.terms_header)).map((r) => r.id);
  if (!ids.length) return;
  await pool.query(
    `DELETE FROM po_letterhead_clauses WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
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
  await deleteQuoteNoClausesFromDb(poType);
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
    terms: stripQuoteNoTermRows(terms),
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

    await insertClause('terms', stripQuoteNoTermRows(terms));
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

  // Custom PO/WO types — ensure empty master rows exist for admin configuration
  for (const customType of ['custom_short_po', 'custom_long_po', 'custom_short_wo', 'custom_long_wo']) {
    await ensureMaster(customType);
  }
}
