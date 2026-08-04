import pool from '../config/db.js';

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

    const insertClause = async (sectionType, items) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const header = (item.termsHeader || '').trim();
        const description = item.termsDescription || '';
        if (!header && !description.trim()) continue;

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
  const defaults = {
    short_po: {
      title: 'Short PO',
      letterheadHeader: '<p><strong>REFEX</strong><br/>Purchase Order — Short Format</p>',
      terms: [
        {
          termsHeader: 'Payment Terms',
          termsDescription: '<p>Payment shall be made within agreed credit days from receipt of valid tax invoice.</p>',
        },
        {
          termsHeader: 'Delivery',
          termsDescription: '<p>Delivery must be completed on or before the expected delivery date mentioned in this PO.</p>',
        },
      ],
      annexure: [
        {
          termsHeader: 'Annexure A — Scope',
          termsDescription: '<p>Scope of supply is limited to line items listed in this purchase order.</p>',
        },
      ],
    },
    long_po: {
      title: 'Long PO',
      letterheadHeader: '<p><strong>REFEX</strong><br/>Purchase Order — Long Format</p>',
      terms: [
        {
          termsHeader: 'General Terms',
          termsDescription: '<p>This purchase order is subject to company procurement policy and applicable laws.</p>',
        },
        {
          termsHeader: 'Quality & Warranty',
          termsDescription: '<p>Vendor shall supply goods/services conforming to agreed specifications with applicable warranty.</p>',
        },
        {
          termsHeader: 'Payment Terms',
          termsDescription: '<p>Invoice must reference PO number. Payment will be processed as per agreed payment terms.</p>',
        },
      ],
      annexure: [
        {
          termsHeader: 'Annexure I — Technical Specifications',
          termsDescription: '<p>Technical requirements and compliance details as agreed during RFQ evaluation.</p>',
        },
        {
          termsHeader: 'Annexure II — Penalty Clause',
          termsDescription: '<p>Delay penalties may apply as per agreed commercial terms.</p>',
        },
      ],
    },
  };

  for (const poType of PO_TYPES) {
    const [existing] = await pool.query(
      `SELECT c.id
       FROM po_letterhead_clauses c
       JOIN po_letterhead_masters m ON m.id = c.master_id
       WHERE m.po_type = ?
       LIMIT 1`,
      [poType]
    );
    if (existing.length) continue;
    await saveLetterhead(poType, defaults[poType]);
  }
}
