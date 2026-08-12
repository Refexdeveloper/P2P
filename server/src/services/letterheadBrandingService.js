import pool from '../config/db.js';

function mapLocation(row) {
  return {
    id: row.id,
    location: row.location || '',
    gstNo: row.gst_no || '',
    sortOrder: Number(row.sort_order || 0),
  };
}

function mapRow(row, locations = []) {
  const locs = locations.map(mapLocation);
  const primary = locs[0];
  // Footer is stored on letterhead_masters (common). Legacy per-location footers are
  // used only when the master column is empty.
  const legacyLocFooter = locations.find((l) => l.footer_logo)?.footer_logo || '';
  return {
    id: row.id,
    name: row.name || '',
    entity: row.entity || '',
    location: primary?.location || row.location || '',
    gstNo: primary?.gstNo || row.gst_no || '',
    headerLogo: row.header_logo || '',
    footerLogo: row.footer_logo || legacyLocFooter || '',
    locations: locs,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
  };
}

function normalizeLocations(payload = {}) {
  if (Array.isArray(payload.locations)) {
    return payload.locations
      .map((l, idx) => ({
        location: String(l?.location || '').trim(),
        gstNo: String(l?.gstNo || l?.gst_no || '')
          .trim()
          .toUpperCase(),
        sortOrder: idx,
      }))
      .filter((l) => l.location);
  }

  const location = String(payload.location || '').trim();
  const gstNo = String(payload.gstNo || payload.gst_no || '')
    .trim()
    .toUpperCase();
  if (!location && !gstNo) return [];
  if (!location) return [];
  return [{ location, gstNo, sortOrder: 0 }];
}

export async function ensureLetterheadMastersTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS letterhead_masters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      entity VARCHAR(255) NULL,
      location VARCHAR(255) NULL,
      gst_no VARCHAR(50) NULL,
      header_logo LONGTEXT NULL,
      footer_logo LONGTEXT NULL,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_letterhead_status (status),
      INDEX idx_letterhead_name (name)
    )`
  );

  for (const sql of [
    `ALTER TABLE letterhead_masters ADD COLUMN location VARCHAR(255) NULL`,
    `ALTER TABLE letterhead_masters ADD COLUMN gst_no VARCHAR(50) NULL`,
  ]) {
    try {
      await pool.query(sql);
    } catch {
      /* column may already exist */
    }
  }

  await pool.query(
    `CREATE TABLE IF NOT EXISTS letterhead_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      letterhead_id INT NOT NULL,
      location VARCHAR(255) NOT NULL,
      gst_no VARCHAR(50) NULL,
      footer_logo LONGTEXT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lh_loc_letterhead (letterhead_id),
      CONSTRAINT fk_letterhead_locations_master
        FOREIGN KEY (letterhead_id) REFERENCES letterhead_masters(id) ON DELETE CASCADE
    )`
  );

  // Backfill locations from legacy single columns when child rows missing
  try {
    await pool.query(
      `INSERT INTO letterhead_locations (letterhead_id, location, gst_no, footer_logo, sort_order)
       SELECT m.id, m.location, m.gst_no, m.footer_logo, 0
       FROM letterhead_masters m
       WHERE IFNULL(TRIM(m.location), '') <> ''
         AND NOT EXISTS (
           SELECT 1 FROM letterhead_locations ll WHERE ll.letterhead_id = m.id
         )`
    );
  } catch {
    /* ignore backfill errors */
  }

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

async function getLetterheadLocations(letterheadId) {
  const [rows] = await pool.query(
    `SELECT * FROM letterhead_locations
     WHERE letterhead_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [letterheadId]
  );
  return rows;
}

async function replaceLetterheadLocations(letterheadId, locations) {
  await pool.query(`DELETE FROM letterhead_locations WHERE letterhead_id = ?`, [letterheadId]);
  for (const loc of locations) {
    await pool.query(
      `INSERT INTO letterhead_locations (letterhead_id, location, gst_no, footer_logo, sort_order)
       VALUES (?, ?, ?, NULL, ?)`,
      [letterheadId, loc.location, loc.gstNo || null, loc.sortOrder ?? 0]
    );
  }

  const primary = locations[0];
  await pool.query(
    `UPDATE letterhead_masters
     SET location = ?, gst_no = ?, updated_at = NOW()
     WHERE id = ?`,
    [primary?.location || null, primary?.gstNo || null, letterheadId]
  );
}

async function hydrateLetterhead(row) {
  const locs = await getLetterheadLocations(row.id);
  return mapRow(row, locs);
}

export async function listLetterheadMasters({ search = '', status } = {}) {
  await ensureLetterheadMastersTable();
  const where = [];
  const params = [];

  if (search?.trim()) {
    where.push(`(
      name LIKE ?
      OR entity LIKE ?
      OR IFNULL(location, "") LIKE ?
      OR IFNULL(gst_no, "") LIKE ?
      OR EXISTS (
        SELECT 1 FROM letterhead_locations ll
        WHERE ll.letterhead_id = letterhead_masters.id
          AND (ll.location LIKE ? OR IFNULL(ll.gst_no, "") LIKE ?)
      )
    )`);
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q, q, q);
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
  const result = [];
  for (const row of rows) {
    result.push(await hydrateLetterhead(row));
  }
  return result;
}

export async function getLetterheadMasterById(id) {
  await ensureLetterheadMastersTable();
  const [rows] = await pool.query(`SELECT * FROM letterhead_masters WHERE id = ?`, [id]);
  if (!rows.length) throw new Error('Letterhead not found');
  return hydrateLetterhead(rows[0]);
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
    return {
      entity: '',
      location: '',
      gstNo: '',
      headerLogo: '',
      footerLogo: '',
      locations: [],
      updatedAt: null,
    };
  }
  const mapped = await hydrateLetterhead(rows[0]);
  return {
    id: mapped.id,
    name: mapped.name,
    entity: mapped.entity,
    location: mapped.location,
    gstNo: mapped.gstNo,
    headerLogo: mapped.headerLogo,
    footerLogo: mapped.footerLogo,
    locations: mapped.locations,
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
  const locations = normalizeLocations(payload);
  const headerLogo = payload.headerLogo || '';
  const footerLogo = payload.footerLogo ?? '';
  const status = payload.status === 'inactive' ? 'inactive' : 'active';
  const primary = locations[0];

  const [result] = await pool.query(
    `INSERT INTO letterhead_masters (name, entity, location, gst_no, header_logo, footer_logo, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      entity,
      primary?.location || null,
      primary?.gstNo || null,
      headerLogo,
      footerLogo,
      status,
    ]
  );

  await replaceLetterheadLocations(result.insertId, locations);
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
  const locations = normalizeLocations(payload);
  const primary = locations[0];

  await pool.query(
    `UPDATE letterhead_masters
     SET name = ?, entity = ?, location = ?, gst_no = ?, header_logo = ?, footer_logo = ?, status = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      name,
      entity,
      primary?.location || null,
      primary?.gstNo || null,
      headerLogo,
      footerLogo,
      status,
      id,
    ]
  );

  // Replace child rows only when client sends locations[] (full multi-location save)
  if (Array.isArray(payload.locations)) {
    await replaceLetterheadLocations(id, locations);
  }

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
      location: payload.location ?? active.location,
      gstNo: payload.gstNo ?? active.gstNo,
      headerLogo: payload.headerLogo ?? active.headerLogo,
      footerLogo: payload.footerLogo ?? active.footerLogo,
      locations: payload.locations ?? active.locations,
      status: 'active',
    });
  }
  return createLetterheadMaster({
    name: payload.name || payload.entity || 'Default Letterhead',
    entity: payload.entity || '',
    location: payload.location || '',
    gstNo: payload.gstNo || '',
    headerLogo: payload.headerLogo || '',
    footerLogo: payload.footerLogo || '',
    locations: payload.locations || [],
    status: 'active',
  });
}
