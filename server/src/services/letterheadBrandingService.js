import pool from '../config/db.js';

function mapRow(row) {
  return {
    id: row.id,
    name: row.name || '',
    entity: row.entity || '',
    headerLogo: row.header_logo || '',
    footerLogo: row.footer_logo || '',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
}

export async function ensureLetterheadMastersTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS letterhead_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      entity VARCHAR(255) NULL,
      header_logo LONGTEXT NULL,
      footer_logo LONGTEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_letterhead_status (status),
      INDEX idx_letterhead_name (name)
    )`
  );

  // One-time migrate legacy singleton branding row
  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM letterhead_masters`);
    if (Number(countRows[0]?.cnt || 0) === 0) {
      const [legacy] = await pool.query(
        `SELECT entity, header_logo, footer_logo FROM letterhead_branding WHERE id = 1 LIMIT 1`
      );
      if (legacy.length) {
        const row = legacy[0];
        await pool.query(
          `INSERT INTO letterhead_masters (name, entity, header_logo, footer_logo, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [
            row.entity || 'Default Letterhead',
            row.entity || '',
            row.header_logo || '',
            row.footer_logo || '',
          ]
        );
      }
    }
  } catch {
    /* legacy table may not exist */
  }
}

export async function listLetterheadMasters({ search = '', status } = {}) {
  await ensureLetterheadMastersTable();
  const where = [];
  const params = [];

  if (search?.trim()) {
    where.push('(name LIKE ? OR entity LIKE ?)');
    const q = `%${search.trim()}%`;
    params.push(q, q);
  }
  if (status === 'active' || status === 'inactive') {
    where.push('status = ?');
    params.push(status);
  }

  const sql = `
    SELECT * FROM letterhead_masters
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, id DESC
  `;
  const [rows] = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function getLetterheadMasterById(id) {
  await ensureLetterheadMastersTable();
  const [rows] = await pool.query(`SELECT * FROM letterhead_masters WHERE id = ?`, [id]);
  if (!rows.length) throw new Error('Letterhead not found');
  return mapRow(rows[0]);
}

/** Active letterhead used when creating PO documents (latest active). */
export async function getActiveLetterheadBranding() {
  await ensureLetterheadMastersTable();
  const [rows] = await pool.query(
    `SELECT * FROM letterhead_masters
     WHERE status = 'active'
     ORDER BY updated_at DESC, id DESC
     LIMIT 1`
  );
  if (!rows.length) {
    return { entity: '', headerLogo: '', footerLogo: '', updatedAt: null };
  }
  const mapped = mapRow(rows[0]);
  return {
    id: mapped.id,
    name: mapped.name,
    entity: mapped.entity,
    headerLogo: mapped.headerLogo,
    footerLogo: mapped.footerLogo,
    updatedAt: mapped.updatedAt,
  };
}

/** @deprecated alias — prefer getActiveLetterheadBranding */
export async function getLetterheadBranding() {
  return getActiveLetterheadBranding();
}

export async function createLetterheadMaster(payload = {}) {
  await ensureLetterheadMastersTable();
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Letterhead name is required');

  const entity = String(payload.entity || '').trim();
  const headerLogo = payload.headerLogo || '';
  const footerLogo = payload.footerLogo || '';
  const status = payload.status === 'inactive' ? 'inactive' : 'active';

  const [result] = await pool.query(
    `INSERT INTO letterhead_masters (name, entity, header_logo, footer_logo, status)
     VALUES (?, ?, ?, ?, ?)`,
    [name, entity, headerLogo, footerLogo, status]
  );

  return getLetterheadMasterById(result.insertId);
}

export async function updateLetterheadMaster(id, payload = {}) {
  await ensureLetterheadMastersTable();
  await getLetterheadMasterById(id);

  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Letterhead name is required');

  const entity = String(payload.entity || '').trim();
  const headerLogo = payload.headerLogo ?? '';
  const footerLogo = payload.footerLogo ?? '';
  const status = payload.status === 'inactive' ? 'inactive' : 'active';

  await pool.query(
    `UPDATE letterhead_masters
     SET name = ?, entity = ?, header_logo = ?, footer_logo = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, entity, headerLogo, footerLogo, status, id]
  );

  return getLetterheadMasterById(id);
}

/** Keep old save endpoint working as upsert of default/active branding. */
export async function saveLetterheadBranding(payload = {}) {
  await ensureLetterheadMastersTable();
  const active = await getActiveLetterheadBranding();
  if (active.id) {
    return updateLetterheadMaster(active.id, {
      name: payload.name || active.name || payload.entity || 'Default Letterhead',
      entity: payload.entity ?? active.entity,
      headerLogo: payload.headerLogo ?? active.headerLogo,
      footerLogo: payload.footerLogo ?? active.footerLogo,
      status: 'active',
    });
  }
  return createLetterheadMaster({
    name: payload.name || payload.entity || 'Default Letterhead',
    entity: payload.entity || '',
    headerLogo: payload.headerLogo || '',
    footerLogo: payload.footerLogo || '',
    status: 'active',
  });
}
