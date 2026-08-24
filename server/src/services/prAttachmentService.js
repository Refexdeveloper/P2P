import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PR_UPLOAD_DIR = path.join(__dirname, '../../uploads/pr-attachments');

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);

function ensureUploadDir() {
  if (!fs.existsSync(PR_UPLOAD_DIR)) {
    fs.mkdirSync(PR_UPLOAD_DIR, { recursive: true });
  }
}

function decodeBase64(base64Data) {
  const raw = String(base64Data || '').includes(',')
    ? String(base64Data).split(',').pop()
    : String(base64Data || '');
  return Buffer.from(String(raw).replace(/\s/g, ''), 'base64');
}

function normalizeIncomingFile(file) {
  const fileName = path.basename(String(file?.fileName || file?.name || '')).trim();
  if (!fileName) throw new Error('Attachment file name is required');

  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`File type not allowed for ${fileName}. Use PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG`);
  }

  const buffer = decodeBase64(file.data || file.base64 || file.file);
  if (!buffer.length) throw new Error(`Attachment ${fileName} is empty or invalid`);
  if (buffer.length > MAX_BYTES) throw new Error(`Attachment ${fileName} must be under 10MB`);

  const mimeType = String(file.mimeType || file.type || '').slice(0, 120) || null;
  return { fileName, buffer, mimeType, size: buffer.length };
}

export function mapAttachmentRow(row) {
  return {
    id: row.id,
    prId: row.pr_id,
    fileName: row.file_name,
    size: Number(row.file_size || 0),
    mimeType: row.mime_type || '',
    uploadedAt: row.uploaded_at,
  };
}

export async function listPrAttachments(prId, db = pool) {
  const [rows] = await db.query(
    `SELECT id, pr_id, file_name, file_size, mime_type, uploaded_at
     FROM pr_attachments
     WHERE pr_id = ?
     ORDER BY id ASC`,
    [prId]
  );
  return rows.map(mapAttachmentRow);
}

export async function savePrAttachments(prId, userId, files, db = pool) {
  if (!Array.isArray(files) || !files.length) return [];

  const saved = [];
  for (const file of files) {
    if (!file?.data && !file?.base64 && !file?.file) continue;
    const { fileName, buffer, mimeType, size } = normalizeIncomingFile(file);
    const storedName = `${prId}_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    try {
      ensureUploadDir();
      fs.writeFileSync(path.join(PR_UPLOAD_DIR, storedName), buffer);
    } catch (err) {
      console.warn('PR attachment disk write skipped (will keep DB copy):', err.message);
    }

    const [result] = await db.query(
      `INSERT INTO pr_attachments
       (pr_id, file_name, file_path, file_size, mime_type, file_data, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prId, fileName, storedName, size, mimeType, buffer, userId || null]
    );

    saved.push({
      id: result.insertId,
      prId,
      fileName,
      size,
      mimeType: mimeType || '',
    });
  }
  return saved;
}

export async function addPrAttachment(prId, userId, file) {
  const [prRows] = await pool.query('SELECT id FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');
  const saved = await savePrAttachments(prId, userId, [file]);
  if (!saved.length) throw new Error('No file data received');
  return saved[0];
}

export async function getPrAttachmentFile(prId, attachmentId) {
  const [rows] = await pool.query(
    `SELECT * FROM pr_attachments WHERE id = ? AND pr_id = ?`,
    [attachmentId, prId]
  );
  if (!rows.length) throw new Error('Attachment not found');

  const row = rows[0];
  if (row.file_data && (Buffer.isBuffer(row.file_data) ? row.file_data.length : row.file_data.length)) {
    return {
      fileName: row.file_name,
      mimeType: row.mime_type || 'application/octet-stream',
      buffer: Buffer.isBuffer(row.file_data) ? row.file_data : Buffer.from(row.file_data),
    };
  }

  const fullPath = path.join(PR_UPLOAD_DIR, row.file_path || '');
  if (!fs.existsSync(fullPath)) throw new Error('File not found on server');
  return {
    fileName: row.file_name,
    mimeType: row.mime_type || 'application/octet-stream',
    buffer: fs.readFileSync(fullPath),
  };
}

export async function deletePrAttachment(prId, attachmentId) {
  const [rows] = await pool.query(
    `SELECT * FROM pr_attachments WHERE id = ? AND pr_id = ?`,
    [attachmentId, prId]
  );
  if (!rows.length) throw new Error('Attachment not found');

  await pool.query('DELETE FROM pr_attachments WHERE id = ? AND pr_id = ?', [attachmentId, prId]);
  const fullPath = path.join(PR_UPLOAD_DIR, rows[0].file_path || '');
  try {
    if (rows[0].file_path && fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch {
    /* ignore disk cleanup */
  }
  return { id: attachmentId };
}
