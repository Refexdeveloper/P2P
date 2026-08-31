import pool from '../config/db.js';

let tableReady = false;

export async function ensureUserActivityLogsTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_activity_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      user_email VARCHAR(255) NULL,
      user_name VARCHAR(200) NULL,
      user_role VARCHAR(80) NULL,
      action VARCHAR(64) NOT NULL,
      resource VARCHAR(255) NULL,
      description VARCHAR(500) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(500) NULL,
      entity_type VARCHAR(64) NULL,
      entity_id INT NULL,
      entity_label VARCHAR(120) NULL,
      status_code SMALLINT NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_activity_created (created_at),
      INDEX idx_user_activity_user (user_id),
      INDEX idx_user_activity_action (action),
      INDEX idx_user_activity_email (user_email)
    )
  `);
  tableReady = true;
}

export async function createUserActivityLog({
  userId = null,
  userEmail = null,
  userName = null,
  userRole = null,
  action = 'update',
  resource = null,
  description = null,
  ipAddress = null,
  userAgent = null,
  entityType = null,
  entityId = null,
  entityLabel = null,
  statusCode = null,
  meta = null,
} = {}) {
  try {
    await ensureUserActivityLogsTable();
    const [result] = await pool.query(
      `INSERT INTO user_activity_logs
       (user_id, user_email, user_name, user_role, action, resource, description,
        ip_address, user_agent, entity_type, entity_id, entity_label, status_code, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        userEmail ? String(userEmail).slice(0, 255) : null,
        userName ? String(userName).slice(0, 200) : null,
        userRole ? String(userRole).slice(0, 80) : null,
        String(action || 'update').slice(0, 64),
        resource ? String(resource).slice(0, 255) : null,
        description ? String(description).slice(0, 500) : null,
        ipAddress ? String(ipAddress).slice(0, 64) : null,
        userAgent ? String(userAgent).slice(0, 500) : null,
        entityType ? String(entityType).slice(0, 64) : null,
        entityId || null,
        entityLabel ? String(entityLabel).slice(0, 120) : null,
        statusCode != null ? Number(statusCode) : null,
        meta ? JSON.stringify(meta) : null,
      ]
    );
    return result.insertId;
  } catch (err) {
    console.error('user_activity_logs insert failed:', err.message);
    return null;
  }
}

function mapRow(row) {
  let meta = null;
  if (row.meta_json) {
    try {
      meta = typeof row.meta_json === 'string' ? JSON.parse(row.meta_json) : row.meta_json;
    } catch {
      meta = null;
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email || '',
    userName: row.user_name || '',
    userRole: row.user_role || '',
    action: row.action,
    resource: row.resource || '',
    description: row.description || '',
    ipAddress: row.ip_address || '',
    userAgent: row.user_agent || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id,
    entityLabel: row.entity_label || '',
    statusCode: row.status_code,
    meta,
    createdAt: row.created_at,
  };
}

export async function listUserActivityLogs({
  action,
  userId,
  search,
  page = 1,
  limit = 50,
} = {}) {
  await ensureUserActivityLogsTable();
  const where = [];
  const params = [];

  if (action) {
    where.push('action = ?');
    params.push(action);
  }
  if (userId) {
    where.push('user_id = ?');
    params.push(Number(userId));
  }
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    where.push(
      '(user_email LIKE ? OR user_name LIKE ? OR description LIKE ? OR resource LIKE ? OR IFNULL(entity_label,"") LIKE ?)'
    );
    params.push(q, q, q, q, q);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * pageSize;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM user_activity_logs ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT * FROM user_activity_logs ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    items: rows.map(mapRow),
    total: Number(countRows[0]?.total || 0),
    page: pageNum,
    limit: pageSize,
  };
}
