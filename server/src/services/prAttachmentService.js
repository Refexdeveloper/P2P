import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { uploadToGcs, downloadFromGcs, gcsEnabled, useGcsForNewUploads } from './gcsStorage.js';

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

    if (useGcsForNewUploads()) {
      await uploadToGcs(`pr-attachments/${storedName}`, buffer, mimeType || 'application/octet-stream');
    } else {
      try {
        ensureUploadDir();
        fs.writeFileSync(path.join(PR_UPLOAD_DIR, storedName), buffer);
      } catch (err) {
        console.warn('PR attachment disk write skipped (will keep DB copy):', err.message);
      }
    }

    const [result] = await db.query(
      `INSERT INTO pr_attachments
       (pr_id, file_name, file_path, file_size, mime_type, file_data, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prId, fileName, storedName, size, mimeType, useGcsForNewUploads() ? null : buffer, userId || null]
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
  const mimeType = row.mime_type || 'application/octet-stream';
  const fileName = row.file_name;

  // Legacy MySQL blob
  if (row.file_data && (Buffer.isBuffer(row.file_data) ? row.file_data.length : row.file_data.length)) {
    return {
      fileName,
      mimeType,
      buffer: Buffer.isBuffer(row.file_data) ? row.file_data : Buffer.from(row.file_data),
    };
  }

  // New uploads in GCS
  if (gcsEnabled() && row.file_path) {
    const buf = await downloadFromGcs(`pr-attachments/${path.basename(row.file_path)}`);
    if (buf) return { fileName, mimeType, buffer: buf };
  }

  const fullPath = path.join(PR_UPLOAD_DIR, row.file_path || '');
  if (fs.existsSync(fullPath)) {
    return { fileName, mimeType, buffer: fs.readFileSync(fullPath) };
  }
  throw new Error('File not found on server');
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

function blobToBuffer(value) {
  if (value == null || value === '') return null;
  if (Buffer.isBuffer(value)) return value.length ? value : null;
  if (value instanceof Uint8Array) return value.byteLength ? Buffer.from(value) : null;
  if (Array.isArray(value) && value.length) return Buffer.from(value);
  if (typeof value === 'object' && Array.isArray(value.data) && value.data.length) {
    return Buffer.from(value.data);
  }
  return null;
}

/** Nodemailer attachments for step/approval mails (FSD + PR uploads). */
export async function loadPrAttachmentsForMail(prId) {
  if (!prId) return [];
  const [rows] = await pool.query(
    `SELECT id, file_name, file_path, mime_type, file_data
     FROM pr_attachments
     WHERE pr_id = ?
     ORDER BY id ASC`,
    [prId]
  );

  const attachments = [];
  const seen = new Set();
  for (const row of rows) {
    const safeFile = String(row.file_name || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');
    let content = blobToBuffer(row.file_data);
    if (!content?.length && row.file_path) {
      try {
        if (gcsEnabled()) {
          const buf = await downloadFromGcs(`pr-attachments/${path.basename(String(row.file_path))}`);
          if (buf?.length) content = buf;
        }
        if (!content?.length) {
          const fullPath = path.isAbsolute(String(row.file_path))
            ? String(row.file_path)
            : path.join(PR_UPLOAD_DIR, String(row.file_path));
          if (fs.existsSync(fullPath)) {
            const buf = fs.readFileSync(fullPath);
            if (buf.length) content = buf;
          }
        }
      } catch {
        /* skip missing file */
      }
    }
    if (!content?.length) {
      console.warn(`PR attachment ${row.id} for PR ${prId} missing blob/disk (${safeFile})`);
      continue;
    }

    let filename = `PR_${safeFile}`;
    let n = 2;
    while (seen.has(filename.toLowerCase())) {
      const ext = path.extname(safeFile);
      const base = path.basename(safeFile, ext);
      filename = `PR_${base}_${n}${ext}`;
      n += 1;
    }
    seen.add(filename.toLowerCase());
    attachments.push({
      filename,
      content,
      contentType: row.mime_type || undefined,
    });
  }
  return attachments;
}
