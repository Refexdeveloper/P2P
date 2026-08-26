import pool from '../config/db.js';

let tableReady = false;

export async function ensureEmailLogsTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      email_type VARCHAR(64) NOT NULL,
      status ENUM('queued', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'queued',
      pr_id INT NULL,
      po_id INT NULL,
      related_id INT NULL,
      pr_number VARCHAR(40) NULL,
      po_number VARCHAR(40) NULL,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT NULL,
      bcc_addresses TEXT NULL,
      subject VARCHAR(500) NOT NULL,
      message_id VARCHAR(255) NULL,
      error_message TEXT NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      INDEX idx_email_logs_created (created_at),
      INDEX idx_email_logs_status (status),
      INDEX idx_email_logs_pr (pr_id),
      INDEX idx_email_logs_type (email_type)
    )
  `);
  tableReady = true;
}

function joinEmails(list) {
  if (!list) return '';
  if (typeof list === 'string') return list;
  return [...list].filter(Boolean).join(', ');
}

export async function createEmailLog({
  emailType,
  status = 'queued',
  prId = null,
  poId = null,
  relatedId = null,
  prNumber = null,
  poNumber = null,
  toAddresses = '',
  ccAddresses = '',
  bccAddresses = '',
  subject = '',
  messageId = null,
  errorMessage = null,
  meta = null,
}) {
  try {
    await ensureEmailLogsTable();
    const [result] = await pool.query(
      `INSERT INTO email_logs
       (email_type, status, pr_id, po_id, related_id, pr_number, po_number,
        to_addresses, cc_addresses, bcc_addresses, subject, message_id, error_message, meta_json, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(emailType || 'generic').slice(0, 64),
        status,
        prId || null,
        poId || null,
        relatedId || null,
        prNumber || null,
        poNumber || null,
        joinEmails(toAddresses) || '(none)',
        joinEmails(ccAddresses) || null,
        joinEmails(bccAddresses) || null,
        String(subject || '').slice(0, 500),
        messageId || null,
        errorMessage || null,
        meta ? JSON.stringify(meta) : null,
        status === 'sent' ? new Date() : null,
      ]
    );
    return result.insertId;
  } catch (err) {
    console.error('email_logs insert failed:', err.message);
    return null;
  }
}

export async function updateEmailLog(id, { status, messageId, errorMessage, toAddresses, ccAddresses, meta } = {}) {
  if (!id) return;
  try {
    await ensureEmailLogsTable();
    await pool.query(
      `UPDATE email_logs
       SET status = COALESCE(?, status),
           message_id = COALESCE(?, message_id),
           error_message = ?,
           to_addresses = COALESCE(?, to_addresses),
           cc_addresses = COALESCE(?, cc_addresses),
           meta_json = COALESCE(?, meta_json),
           sent_at = CASE WHEN ? = 'sent' THEN NOW() ELSE sent_at END
       WHERE id = ?`,
      [
        status || null,
        messageId || null,
        errorMessage === undefined ? null : errorMessage,
        toAddresses ? joinEmails(toAddresses) : null,
        ccAddresses ? joinEmails(ccAddresses) : null,
        meta ? JSON.stringify(meta) : null,
        status || null,
        id,
      ]
    );
  } catch (err) {
    console.error('email_logs update failed:', err.message);
  }
}

export async function getEmailLogById(id) {
  await ensureEmailLogsTable();
  const [rows] = await pool.query(`SELECT * FROM email_logs WHERE id = ? LIMIT 1`, [Number(id)]);
  if (!rows.length) return null;
  return mapLogRow(rows[0]);
}

function mapLogRow(row) {
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
    emailType: row.email_type,
    status: row.status,
    prId: row.pr_id,
    poId: row.po_id,
    relatedId: row.related_id,
    prNumber: row.pr_number || '',
    poNumber: row.po_number || '',
    toAddresses: row.to_addresses || '',
    ccAddresses: row.cc_addresses || '',
    bccAddresses: row.bcc_addresses || '',
    subject: row.subject || '',
    messageId: row.message_id || '',
    errorMessage: row.error_message || '',
    meta,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

export async function listEmailLogs({
  status,
  emailType,
  prId,
  search,
  page = 1,
  limit = 50,
} = {}) {
  await ensureEmailLogsTable();
  const where = [];
  const params = [];

  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (emailType) {
    where.push('email_type = ?');
    params.push(emailType);
  }
  if (prId) {
    where.push('pr_id = ?');
    params.push(Number(prId));
  }
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    where.push(
      '(subject LIKE ? OR to_addresses LIKE ? OR IFNULL(pr_number,"") LIKE ? OR IFNULL(po_number,"") LIKE ? OR IFNULL(error_message,"") LIKE ?)'
    );
    params.push(q, q, q, q, q);
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (pageNum - 1) * pageSize;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM email_logs ${whereSql}`,
    params
  );
  const [rows] = await pool.query(
    `SELECT * FROM email_logs ${whereSql}
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

export const EMAIL_TYPE_LABELS = {
  pr_raised: 'PR Raised (Ops notify)',
  pr_approval_pending: 'Approval Pending (L1/L2/CFO/SCM)',
  pr_step_progress: 'Requester Step Moved / Approved',
  pr_post_rfq_action: 'PR Reject / Return',
  rfq_vendor: 'RFQ Vendor Invite',
  rfq_send_back: 'RFQ Send Back',
  rfq_submitted: 'RFQ Quote Submitted',
  po_vendor: 'PO Vendor Acceptance',
  po_workflow: 'PO Assign / Send Back / Reject',
  vendor_invoice_request: 'Vendor Invoice Request',
  smtp_test: 'SMTP Test',
  generic: 'Other',
};
