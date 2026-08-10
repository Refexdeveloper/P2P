import pool from '../config/db.js';
import { parseCsv, rowsToCsv, normalizeHeaderKey } from '../utils/csv.js';

function mapCategory(row) {
  return {
    id: row.id,
    name: row.name,
    requestType: row.request_type,
    description: row.description || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row) {
  return {
    id: row.id,
    itemCode: row.item_code,
    name: row.name,
    description: row.description || '',
    categoryId: row.category_id,
    categoryName: row.category_name || '',
    unit: row.unit || 'Nos',
    hsnCode: row.hsn_code || '',
    gstPercentage: Number(row.gst_percentage ?? 18),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCategories({ search, requestType, status } = {}) {
  let sql = `SELECT * FROM categories WHERE 1=1`;
  const params = [];
  if (search) {
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (requestType && requestType !== 'all') {
    sql += ` AND (request_type = ? OR request_type = 'All')`;
    params.push(requestType);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows.map(mapCategory);
}

export async function createCategory(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Category name is required');
  const requestType = ['Capex', 'Opex', 'Service', 'All'].includes(body.requestType)
    ? body.requestType
    : 'All';
  const description = String(body.description || '').trim();
  const status = body.status === 'inactive' ? 'inactive' : 'active';

  try {
    const [result] = await pool.query(
      `INSERT INTO categories (name, request_type, description, status) VALUES (?, ?, ?, ?)`,
      [name, requestType, description || null, status]
    );
    const [rows] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [result.insertId]);
    return mapCategory(rows[0]);
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Category name already exists');
    }
    throw err;
  }
}

export async function updateCategory(id, body) {
  const [existing] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [id]);
  if (!existing.length) throw new Error('Category not found');

  const name = body.name !== undefined ? String(body.name || '').trim() : existing[0].name;
  if (!name) throw new Error('Category name is required');
  const requestType = body.requestType !== undefined
    ? (['Capex', 'Opex', 'Service', 'All'].includes(body.requestType) ? body.requestType : existing[0].request_type)
    : existing[0].request_type;
  const description =
    body.description !== undefined ? String(body.description || '').trim() : existing[0].description;
  const status =
    body.status !== undefined
      ? (body.status === 'inactive' ? 'inactive' : 'active')
      : existing[0].status;

  try {
    await pool.query(
      `UPDATE categories SET name = ?, request_type = ?, description = ?, status = ?, updated_at = NOW() WHERE id = ?`,
      [name, requestType, description || null, status, id]
    );
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Category name already exists');
    }
    throw err;
  }
  const [rows] = await pool.query(`SELECT * FROM categories WHERE id = ?`, [id]);
  return mapCategory(rows[0]);
}

export async function listItems({ search, categoryId, status } = {}) {
  let sql = `
    SELECT i.*, c.name AS category_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE 1=1
  `;
  const params = [];
  if (search) {
    sql += ` AND (i.item_code LIKE ? OR i.name LIKE ? OR i.description LIKE ? OR i.hsn_code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    sql += ` AND i.category_id = ?`;
    params.push(Number(categoryId));
  }
  if (status) {
    sql += ` AND i.status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY i.name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows.map(mapItem);
}

async function generateItemCode() {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM items WHERE YEAR(created_at) = ?`,
    [year]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(4, '0');
  return `ITM-${year}-${seq}`;
}

export async function createItem(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Item name is required');
  const description = String(body.description || '').trim();
  const unit = String(body.unit || 'Nos').trim() || 'Nos';
  const hsnCode = String(body.hsnCode || '').trim();
  const gstPercentage = Math.min(100, Math.max(0, Number(body.gstPercentage ?? 18)));
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const categoryId = body.categoryId ? Number(body.categoryId) : null;

  if (categoryId) {
    const [cats] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [categoryId]);
    if (!cats.length) throw new Error('Invalid category');
  }

  const itemCode = body.itemCode?.trim() || (await generateItemCode());

  try {
    const [result] = await pool.query(
      `INSERT INTO items (item_code, name, description, category_id, unit, hsn_code, gst_percentage, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [itemCode, name, description || null, categoryId, unit, hsnCode || null, gstPercentage, status]
    );
    const [rows] = await pool.query(
      `SELECT i.*, c.name AS category_name FROM items i
       LEFT JOIN categories c ON c.id = i.category_id WHERE i.id = ?`,
      [result.insertId]
    );
    return mapItem(rows[0]);
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Item code already exists');
    }
    throw err;
  }
}

export async function updateItem(id, body) {
  const [existing] = await pool.query(`SELECT * FROM items WHERE id = ?`, [id]);
  if (!existing.length) throw new Error('Item not found');

  const name = body.name !== undefined ? String(body.name || '').trim() : existing[0].name;
  if (!name) throw new Error('Item name is required');
  const description =
    body.description !== undefined ? String(body.description || '').trim() : existing[0].description;
  const unit = body.unit !== undefined ? String(body.unit || 'Nos').trim() || 'Nos' : existing[0].unit;
  const hsnCode =
    body.hsnCode !== undefined ? String(body.hsnCode || '').trim() : existing[0].hsn_code || '';
  const gstPercentage =
    body.gstPercentage !== undefined
      ? Math.min(100, Math.max(0, Number(body.gstPercentage ?? 18)))
      : Number(existing[0].gst_percentage ?? 18);
  const status =
    body.status !== undefined
      ? (body.status === 'inactive' ? 'inactive' : 'active')
      : existing[0].status;
  let categoryId = existing[0].category_id;
  if (body.categoryId !== undefined) {
    categoryId = body.categoryId ? Number(body.categoryId) : null;
    if (categoryId) {
      const [cats] = await pool.query(`SELECT id FROM categories WHERE id = ?`, [categoryId]);
      if (!cats.length) throw new Error('Invalid category');
    }
  }

  await pool.query(
    `UPDATE items
     SET name = ?, description = ?, category_id = ?, unit = ?, hsn_code = ?, gst_percentage = ?,
         status = ?, updated_at = NOW()
     WHERE id = ?`,
    [name, description || null, categoryId, unit, hsnCode || null, gstPercentage, status, id]
  );

  const [rows] = await pool.query(
    `SELECT i.*, c.name AS category_name FROM items i
     LEFT JOIN categories c ON c.id = i.category_id WHERE i.id = ?`,
    [id]
  );
  return mapItem(rows[0]);
}

const DEFAULT_CATEGORIES = [
  { name: 'IT Equipment', requestType: 'Capex' },
  { name: 'Furniture', requestType: 'Capex' },
  { name: 'Machinery', requestType: 'Capex' },
  { name: 'Vehicles', requestType: 'Capex' },
  { name: 'Building Infrastructure', requestType: 'Capex' },
  { name: 'Office Supplies', requestType: 'Opex' },
  { name: 'Software Licenses', requestType: 'Opex' },
  { name: 'Utilities', requestType: 'Opex' },
  { name: 'Marketing Materials', requestType: 'Opex' },
  { name: 'Travel & Entertainment', requestType: 'Opex' },
  { name: 'Consulting', requestType: 'Service' },
  { name: 'Maintenance', requestType: 'Service' },
  { name: 'Training', requestType: 'Service' },
  { name: 'Professional Services', requestType: 'Service' },
  { name: 'Outsourcing', requestType: 'Service' },
];

export async function seedDefaultCategories() {
  const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM categories`);
  if (Number(rows[0].cnt) > 0) return;
  for (const cat of DEFAULT_CATEGORIES) {
    await pool.query(
      `INSERT INTO categories (name, request_type, description, status) VALUES (?, ?, ?, 'active')`,
      [cat.name, cat.requestType, null]
    );
  }
}

const CATEGORY_HEADERS = ['name', 'requestType', 'description', 'status'];
const ITEM_HEADERS = [
  'itemCode',
  'name',
  'description',
  'categoryName',
  'unit',
  'hsnCode',
  'gstPercentage',
  'status',
];

export async function exportCategoriesCsv() {
  const rows = await listCategories();
  return rowsToCsv(
    CATEGORY_HEADERS,
    rows.map((r) => ({
      name: r.name,
      requestType: r.requestType,
      description: r.description,
      status: r.status,
    }))
  );
}

export function getCategoryImportTemplateCsv() {
  return rowsToCsv(CATEGORY_HEADERS, [
    {
      name: 'Sample Category',
      requestType: 'Opex',
      description: 'Sample description',
      status: 'active',
    },
  ]);
}

export async function importCategoriesFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error('CSV has no data rows');

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < parsed.length; i++) {
    const rowNum = i + 2;
    const mapped = normalizeHeaderKey(parsed[i], {
      name: ['name', 'category', 'categoryname'],
      requestType: ['requesttype', 'request_type', 'type'],
      description: ['description', 'desc'],
      status: ['status'],
    });
    try {
      if (!mapped.name) throw new Error('name is required');
      const [existing] = await pool.query(`SELECT id FROM categories WHERE name = ?`, [mapped.name]);
      const payload = {
        name: mapped.name,
        requestType: mapped.requestType || 'All',
        description: mapped.description || '',
        status: mapped.status === 'inactive' ? 'inactive' : 'active',
      };
      if (existing.length) {
        await updateCategory(existing[0].id, payload);
        updated += 1;
      } else {
        await createCategory(payload);
        created += 1;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created, updated, failed: errors.length, errors };
}

export async function exportItemsCsv() {
  const rows = await listItems();
  return rowsToCsv(
    ITEM_HEADERS,
    rows.map((r) => ({
      itemCode: r.itemCode,
      name: r.name,
      description: r.description,
      categoryName: r.categoryName,
      unit: r.unit,
      hsnCode: r.hsnCode,
      gstPercentage: r.gstPercentage,
      status: r.status,
    }))
  );
}

export function getItemImportTemplateCsv() {
  return rowsToCsv(ITEM_HEADERS, [
    {
      itemCode: '',
      name: 'Sample Laptop',
      description: '14 inch business laptop',
      categoryName: 'IT Equipment',
      unit: 'Nos',
      hsnCode: '8471',
      gstPercentage: 18,
      status: 'active',
    },
  ]);
}

export async function importItemsFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error('CSV has no data rows');

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < parsed.length; i++) {
    const rowNum = i + 2;
    const mapped = normalizeHeaderKey(parsed[i], {
      itemCode: ['itemcode', 'item_code', 'code'],
      name: ['name', 'itemname', 'item'],
      description: ['description', 'desc', 'itemdescription'],
      categoryName: ['categoryname', 'category'],
      unit: ['unit', 'uom'],
      hsnCode: ['hsncode', 'hsn', 'hsn_code'],
      gstPercentage: ['gstpercentage', 'gst', 'gst_percentage', 'gst%'],
      status: ['status'],
    });
    try {
      if (!mapped.name) throw new Error('name is required');

      let categoryId = null;
      if (mapped.categoryName) {
        const [cats] = await pool.query(`SELECT id FROM categories WHERE name = ? LIMIT 1`, [
          mapped.categoryName,
        ]);
        if (!cats.length) {
          const createdCat = await createCategory({
            name: mapped.categoryName,
            requestType: 'All',
            status: 'active',
          });
          categoryId = createdCat.id;
        } else {
          categoryId = cats[0].id;
        }
      }

      const payload = {
        name: mapped.name,
        description: mapped.description || '',
        categoryId,
        unit: mapped.unit || 'Nos',
        hsnCode: mapped.hsnCode || '',
        gstPercentage: mapped.gstPercentage !== undefined ? Number(mapped.gstPercentage) : 18,
        status: mapped.status === 'inactive' ? 'inactive' : 'active',
        itemCode: mapped.itemCode || undefined,
      };

      let existing = [];
      if (mapped.itemCode) {
        [existing] = await pool.query(`SELECT id FROM items WHERE item_code = ?`, [mapped.itemCode]);
      }
      if (!existing.length) {
        [existing] = await pool.query(`SELECT id FROM items WHERE name = ?`, [mapped.name]);
      }

      if (existing.length) {
        await updateItem(existing[0].id, payload);
        updated += 1;
      } else {
        await createItem(payload);
        created += 1;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created, updated, failed: errors.length, errors };
}

function mapEntityLocation(row) {
  return {
    id: row.id,
    location: row.location || '',
    gstNo: row.gst_no || '',
    footerLogo: row.footer_logo || '',
    sortOrder: Number(row.sort_order) || 0,
  };
}

function mapEntity(row, locations = []) {
  return {
    id: row.id,
    name: row.name,
    code: row.code || '',
    costCenter: row.cost_center || '',
    description: row.description || '',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    locations: locations.map(mapEntityLocation),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getEntityLocations(entityId) {
  const [rows] = await pool.query(
    `SELECT * FROM entity_locations WHERE entity_id = ? ORDER BY sort_order ASC, id ASC`,
    [entityId]
  );
  return rows;
}

function normalizeEntityLocations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => ({
      location: String(item?.location || '').trim(),
      gstNo: String(item?.gstNo || item?.gst_no || '').trim(),
      footerLogo: String(item?.footerLogo || item?.footer_logo || '').trim(),
      sortOrder: idx,
    }))
    .filter((item) => item.location);
}

async function replaceEntityLocations(entityId, locations) {
  await pool.query(`DELETE FROM entity_locations WHERE entity_id = ?`, [entityId]);
  for (const loc of locations) {
    await pool.query(
      `INSERT INTO entity_locations (entity_id, location, gst_no, footer_logo, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [entityId, loc.location, loc.gstNo || null, loc.footerLogo || null, loc.sortOrder]
    );
  }
}

function mapDepartment(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code || '',
    description: row.description || '',
    status: row.status === 'inactive' ? 'inactive' : 'active',
    budgetAllocated: Number(row.budget_allocated || 0),
    budgetUtilized: Number(row.budget_utilized || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}

export async function listEntities({ search, status } = {}) {
  let sql = `SELECT * FROM entity_masters WHERE 1=1`;
  const params = [];
  if (search) {
    sql += ` AND (name LIKE ? OR IFNULL(code, '') LIKE ? OR cost_center LIKE ? OR description LIKE ?
      OR EXISTS (
        SELECT 1 FROM entity_locations el
        WHERE el.entity_id = entity_masters.id
          AND (el.location LIKE ? OR IFNULL(el.gst_no, '') LIKE ?)
      ))`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY name ASC`;
  const [rows] = await pool.query(sql, params);
  const result = [];
  for (const row of rows) {
    const locations = await getEntityLocations(row.id);
    result.push(mapEntity(row, locations));
  }
  return result;
}

export async function createEntity(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Entity name is required');
  const costCenter = String(body.costCenter || '').trim();
  if (!costCenter) throw new Error('Cost center is required');
  let code = String(body.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) {
    code = String(costCenter || name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }
  if (!code) throw new Error('Entity code is required');
  const description = String(body.description || '').trim();
  const status = body.status === 'inactive' ? 'inactive' : 'active';
  const locations = normalizeEntityLocations(body.locations);

  try {
    const [result] = await pool.query(
      `INSERT INTO entity_masters (name, code, cost_center, description, status) VALUES (?, ?, ?, ?, ?)`,
      [name, code, costCenter, description || null, status]
    );
    const entityId = result.insertId;
    await replaceEntityLocations(entityId, locations);
    const [rows] = await pool.query(`SELECT * FROM entity_masters WHERE id = ?`, [entityId]);
    const savedLocations = await getEntityLocations(entityId);
    return mapEntity(rows[0], savedLocations);
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Entity name or code already exists');
    }
    throw err;
  }
}

export async function updateEntity(id, body) {
  const [existing] = await pool.query(`SELECT * FROM entity_masters WHERE id = ?`, [id]);
  if (!existing.length) throw new Error('Entity not found');

  const name = body.name !== undefined ? String(body.name || '').trim() : existing[0].name;
  if (!name) throw new Error('Entity name is required');
  const costCenter =
    body.costCenter !== undefined ? String(body.costCenter || '').trim() : existing[0].cost_center;
  if (!costCenter) throw new Error('Cost center is required');
  let code =
    body.code !== undefined
      ? String(body.code || '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
      : existing[0].code || '';
  if (!code) {
    code = String(costCenter || name)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
  }
  const description =
    body.description !== undefined ? String(body.description || '').trim() : existing[0].description;
  const status =
    body.status !== undefined
      ? body.status === 'inactive'
        ? 'inactive'
        : 'active'
      : existing[0].status;

  try {
    await pool.query(
      `UPDATE entity_masters
       SET name = ?, code = ?, cost_center = ?, description = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, code, costCenter, description || null, status, id]
    );
    if (body.locations !== undefined) {
      await replaceEntityLocations(id, normalizeEntityLocations(body.locations));
    }
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Entity name or code already exists');
    }
    throw err;
  }
  const [rows] = await pool.query(`SELECT * FROM entity_masters WHERE id = ?`, [id]);
  const locations = await getEntityLocations(id);
  return mapEntity(rows[0], locations);
}

const ENTITY_HEADERS = ['name', 'code', 'costCenter', 'description', 'status'];

export async function exportEntitiesCsv() {
  const rows = await listEntities();
  return rowsToCsv(
    ENTITY_HEADERS,
    rows.map((r) => ({
      name: r.name,
      code: r.code,
      costCenter: r.costCenter,
      description: r.description,
      status: r.status,
    }))
  );
}

export function getEntityImportTemplateCsv() {
  return rowsToCsv(ENTITY_HEADERS, [
    {
      name: 'Refex Green Mobility',
      code: 'RGML',
      costCenter: 'CC-1001',
      description: 'Sample entity for PR/PO numbering',
      status: 'active',
    },
  ]);
}

export async function importEntitiesFromCsv(csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error('CSV has no data rows');

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < parsed.length; i++) {
    const rowNum = i + 2;
    const mapped = normalizeHeaderKey(parsed[i], {
      name: ['name', 'entity', 'entityname', 'entity_name'],
      code: ['code', 'entitycode', 'entity_code'],
      costCenter: ['costcenter', 'cost_center', 'costcentre', 'cc'],
      description: ['description', 'desc'],
      status: ['status'],
    });
    try {
      if (!mapped.name) throw new Error('name is required');
      if (!mapped.costCenter) throw new Error('costCenter is required');
      const code = String(mapped.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      let existingId = null;
      if (code) {
        const [byCode] = await pool.query(`SELECT id FROM entity_masters WHERE code = ?`, [code]);
        if (byCode.length) existingId = byCode[0].id;
      }
      if (!existingId) {
        const [byName] = await pool.query(`SELECT id FROM entity_masters WHERE name = ?`, [mapped.name]);
        if (byName.length) existingId = byName[0].id;
      }

      const payload = {
        name: mapped.name,
        code: code || undefined,
        costCenter: mapped.costCenter,
        description: mapped.description || '',
        status: mapped.status === 'inactive' ? 'inactive' : 'active',
      };

      if (existingId) {
        await updateEntity(existingId, payload);
        updated += 1;
      } else {
        await createEntity(payload);
        created += 1;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created, updated, failed: errors.length, errors };
}

export async function listDepartments({ search, status } = {}) {
  let sql = `SELECT * FROM departments WHERE 1=1`;
  const params = [];
  if (search) {
    sql += ` AND (name LIKE ? OR IFNULL(code, '') LIKE ? OR IFNULL(description, '') LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows.map(mapDepartment);
}

export async function createDepartment(body) {
  const name = String(body.name || '').trim();
  if (!name) throw new Error('Department name is required');
  const code = String(body.code || '').trim();
  const description = String(body.description || '').trim();
  const status = body.status === 'inactive' ? 'inactive' : 'active';

  try {
    const [result] = await pool.query(
      `INSERT INTO departments (name, code, description, status, budget_allocated, budget_utilized)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [name, code || null, description || null, status]
    );
    const [rows] = await pool.query(`SELECT * FROM departments WHERE id = ?`, [result.insertId]);
    return mapDepartment(rows[0]);
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Department name already exists');
    }
    throw err;
  }
}

export async function updateDepartment(id, body) {
  const [existing] = await pool.query(`SELECT * FROM departments WHERE id = ?`, [id]);
  if (!existing.length) throw new Error('Department not found');

  const name = body.name !== undefined ? String(body.name || '').trim() : existing[0].name;
  if (!name) throw new Error('Department name is required');
  const code = body.code !== undefined ? String(body.code || '').trim() : existing[0].code;
  const description =
    body.description !== undefined ? String(body.description || '').trim() : existing[0].description;
  const status =
    body.status !== undefined
      ? body.status === 'inactive'
        ? 'inactive'
        : 'active'
      : existing[0].status || 'active';

  try {
    await pool.query(
      `UPDATE departments
       SET name = ?, code = ?, description = ?, status = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, code || null, description || null, status, id]
    );
  } catch (err) {
    if (String(err.message || '').includes('Duplicate')) {
      throw new Error('Department name already exists');
    }
    throw err;
  }
  const [rows] = await pool.query(`SELECT * FROM departments WHERE id = ?`, [id]);
  return mapDepartment(rows[0]);
}
