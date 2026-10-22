import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { downloadStoredUpload, useGcsForNewUploads, awaitGcsUpload, gcsEnabled } from './gcsStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/po-documents');
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']);

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function assertAllowedFileName(fileName) {
  const safe = path.basename(String(fileName || '')).trim();
  if (!safe) throw new Error('Document file name is required');
  const ext = path.extname(safe).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`File type not allowed for ${safe}. Use PDF, DOC, DOCX, XLS, XLSX, JPG, or PNG`);
  }
  return safe;
}

function mapRow(row) {
  return {
    id: row.id,
    poId: row.po_id,
    fileName: row.file_name,
    size: Number(row.file_size || 0),
    mimeType: row.mime_type || '',
    notes: row.notes || '',
    uploadedByName: row.uploaded_by_name || '',
    uploadedAt: row.uploaded_at,
  };
}

export async function listPoDocuments(poId) {
  const [rows] = await pool.query(
    `SELECT d.id, d.po_id, d.file_name, d.file_size, d.mime_type, d.notes, d.uploaded_at,
            u.name AS uploaded_by_name
     FROM po_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.po_id = ?
     ORDER BY d.id ASC`,
    [poId]
  );
  return rows.map(mapRow);
}

export async function addPoDocument(poId, userId, { fileName, buffer, mimeType, notes }) {
  const [poRows] = await pool.query('SELECT id FROM purchase_orders WHERE id = ? LIMIT 1', [poId]);
  if (!poRows.length) throw new Error('PO not found');

  const safeName = assertAllowedFileName(fileName);
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (!body.length) throw new Error('Document file is empty');
  if (body.length > MAX_BYTES) throw new Error('Document must be under 25MB');

  const note = String(notes || '').trim().slice(0, 255);
  const storedName = `${poId}_${Date.now()}_${safeName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const type = String(mimeType || '').slice(0, 120) || null;

  let gcsOk = false;
  if (useGcsForNewUploads()) {
    await awaitGcsUpload(`po-documents/${storedName}`, body, type || 'application/octet-stream');
    gcsOk = true;
  }
  try {
    ensureUploadDir();
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), body);
  } catch (err) {
    console.warn('PO document disk write skipped:', err.message);
  }

  const [result] = await pool.query(
    `INSERT INTO po_documents
       (po_id, file_name, file_path, file_size, mime_type, notes, file_data, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [poId, safeName, storedName, body.length, type, note || null, gcsOk ? null : body, userId || null]
  );

  const [saved] = await pool.query(
    `SELECT d.id, d.po_id, d.file_name, d.file_size, d.mime_type, d.notes, d.uploaded_at,
            u.name AS uploaded_by_name
     FROM po_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by
     WHERE d.id = ?`,
    [result.insertId]
  );
  return mapRow(saved[0]);
}

export async function getPoDocumentFile(poId, documentId) {
  const [rows] = await pool.query(
    `SELECT * FROM po_documents WHERE id = ? AND po_id = ? LIMIT 1`,
    [documentId, poId]
  );
  if (!rows.length) throw new Error('Document not found');
  const row = rows[0];
  const mimeType = row.mime_type || 'application/octet-stream';
  const fileName = row.file_name;

  if (row.file_data && (Buffer.isBuffer(row.file_data) ? row.file_data.length : row.file_data.length)) {
    return {
      fileName,
      mimeType,
      buffer: Buffer.isBuffer(row.file_data) ? row.file_data : Buffer.from(row.file_data),
    };
  }

  if (gcsEnabled() && row.file_path) {
    const buf = await downloadStoredUpload(row.file_path, ['po-documents']);
    if (buf?.length) return { fileName, mimeType, buffer: buf };
  }

  const fullPath = path.join(UPLOAD_DIR, row.file_path || '');
  if (fs.existsSync(fullPath)) {
    return { fileName, mimeType, buffer: fs.readFileSync(fullPath) };
  }
  throw new Error('Document file not found');
}
