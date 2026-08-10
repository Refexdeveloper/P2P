import pool from '../config/db.js';

let tableReady = false;

export async function ensureWhatsAppLogsTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      notify_type VARCHAR(64) NOT NULL DEFAULT 'workflow',
      status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
      pr_id INT NULL,
      po_id INT NULL,
      related_id INT NULL,
      pr_number VARCHAR(40) NULL,
      po_number VARCHAR(40) NULL,
      to_phone VARCHAR(32) NOT NULL,
      template_name VARCHAR(120) NULL,
      stage VARCHAR(120) NULL,
      wamid VARCHAR(255) NULL,
      error_message TEXT NULL,
      parameters_json JSON NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      INDEX idx_wa_logs_created (created_at),
      INDEX idx_wa_logs_status (status),
      INDEX idx_wa_logs_pr (pr_id),
      INDEX idx_wa_logs_type (notify_type),
      INDEX idx_wa_logs_phone (to_phone)
    )
  `);
  tableReady = true;
}

export async function createWhatsAppLog({
  notifyType = 'workflow',
  status = 'queued',
  prId = null,
  poId = null,
  relatedId = null,
  prNumber = null,
  poNumber = null,
  toPhone = '',
  templateName = null,
  stage = null,
  wamid = null,
  errorMessage = null,
  parameters = null,
  meta = null,
}) {
  try {
    await ensureWhatsAppLogsTable();
    const [result] = await pool.query(
      `INSERT INTO whatsapp_logs
       (notify_type, status, pr_id, po_id, related_id, pr_number, po_number,
        to_phone, template_name, stage, wamid, error_message, parameters_json, meta_json, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(notifyType || 'workflow').slice(0, 64),
        status,
        prId || null,
        poId || null,
        relatedId || null,
        prNumber || null,
        poNumber || null,
        String(toPhone || '(none)').slice(0, 32),
        templateName ? String(templateName).slice(0, 120) : null,
        stage ? String(stage).slice(0, 120) : null,
        wamid || null,
        errorMessage || null,
        parameters ? JSON.stringify(parameters) : null,
        meta ? JSON.stringify(meta) : null,
        status === 'sent' ? new Date() : null,
      ]
    );
    return result.insertId;
  } catch (err) {
    console.error('whatsapp_logs insert failed:', err.message);
    return null;
  }
}

export async function updateWhatsAppLog(id, { status, wamid, errorMessage } = {}) {
  if (!id) return;
  try {
    await ensureWhatsAppLogsTable();
    await pool.query(
      `UPDATE whatsapp_logs
       SET status = COALESCE(?, status),
           wamid = COALESCE(?, wamid),
           error_message = COALESCE(?, error_message),
           sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
       WHERE id = ?`,
      [status || null, wamid || null, errorMessage || null, status || null, id]
    );
  } catch (err) {
    console.error('whatsapp_logs update failed:', err.message);
  }
}

function mapLogRow(row) {
  let parameters = null;
  let meta = null;
  if (row.parameters_json) {
    try {
      parameters =
        typeof row.parameters_json === 'string'
          ? JSON.parse(row.parameters_json)
          : row.parameters_json;
    } catch {
      parameters = null;
    }
  }
  if (row.meta_json) {
    try {
      meta = typeof row.meta_json === 'string' ? JSON.parse(row.meta_json) : row.meta_json;
    } catch {
      meta = null;
    }
  }
  return {
    id: row.id,
    notifyType: row.notify_type,
    status: row.status,
    prId: row.pr_id,
    poId: row.po_id,
    relatedId: row.related_id,
    prNumber: row.pr_number || '',
    poNumber: row.po_number || '',
    toPhone: row.to_phone || '',
    templateName: row.template_name || '',
    stage: row.stage || '',
    wamid: row.wamid || '',
    errorMessage: row.error_message || '',
    parameters,
    meta,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

export async function listWhatsAppLogs({
  status,
  notifyType,
  prId,
  search,
  page = 1,
  limit = 50,
} = {}) {
  await ensureWhatsAppLogsTable();
  const where = [];
  const params = [];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (notifyType) {
    where.push('notify_type = ?');
    params.push(notifyType);
  }
  if (prId) {
    where.push('pr_id = ?');
    params.push(Number(prId));
  }
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    where.push(
      '(to_phone LIKE ? OR IFNULL(pr_number,"") LIKE ? OR IFNULL(po_number,"") LIKE ? OR IFNULL(stage,"") LIKE ? OR IFNULL(error_message,"") LIKE ? OR IFNULL(wamid,"") LIKE ?)'
    );
    params.push(q, q, q, q, q, q);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * pageSize;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM whatsapp_logs ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT * FROM whatsapp_logs ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    items: rows.map(mapLogRow),
    total: Number(countRows[0]?.total || 0),
    page: pageNum,
    limit: pageSize,
  };
}
