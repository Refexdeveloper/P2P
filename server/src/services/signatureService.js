import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SIGNATURE_UPLOAD_DIR = path.join(__dirname, '../../uploads/signatures');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') throw new Error('Signature image is required');
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
  if (!match) throw new Error('Invalid signature image format (use PNG or JPG)');
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new Error('Signature image is empty');
  if (buffer.length > 1.5 * 1024 * 1024) throw new Error('Signature image must be under 1.5MB');
  return { ext, buffer, dataUrl: `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${match[2]}` };
}

export function saveSignatureFile(buffer, ext, fileBaseName) {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const fileName = `${fileBaseName}.${ext}`;
  const fullPath = path.join(SIGNATURE_UPLOAD_DIR, fileName);
  fs.writeFileSync(fullPath, buffer);
  return fileName;
}

export function signatureFileToDataUrl(fileName) {
  if (!fileName) return null;
  const fullPath = path.join(SIGNATURE_UPLOAD_DIR, fileName);
  if (!fs.existsSync(fullPath)) return null;
  const ext = path.extname(fileName).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const buffer = fs.readFileSync(fullPath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function listUserSignatures(userId) {
  const [rows] = await pool.query(
    `SELECT id, label, image_path, created_at FROM user_signatures
     WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    label: r.label || 'Signature',
    imagePath: r.image_path,
    imageDataUrl: signatureFileToDataUrl(r.image_path),
    createdAt: r.created_at,
  })).filter((r) => r.imageDataUrl);
}

export async function saveUserSignature(userId, { image, label }) {
  const { ext, buffer } = parseDataUrlImage(image);
  const fileName = saveSignatureFile(buffer, ext, `user_${userId}_${Date.now()}`);
  const [result] = await pool.query(
    `INSERT INTO user_signatures (user_id, label, image_path) VALUES (?, ?, ?)`,
    [userId, (label || 'My Signature').slice(0, 100), fileName]
  );
  return {
    id: result.insertId,
    label: (label || 'My Signature').slice(0, 100),
    imagePath: fileName,
    imageDataUrl: signatureFileToDataUrl(fileName),
  };
}

export async function deleteUserSignature(userId, signatureId) {
  const [rows] = await pool.query(
    `SELECT id, image_path FROM user_signatures WHERE id = ? AND user_id = ?`,
    [signatureId, userId]
  );
  if (!rows.length) throw new Error('Signature not found');
  await pool.query(`DELETE FROM user_signatures WHERE id = ? AND user_id = ?`, [signatureId, userId]);
  const fullPath = path.join(SIGNATURE_UPLOAD_DIR, rows[0].image_path);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  return { success: true };
}

export async function getUserSignatureImage(userId, signatureId) {
  const [rows] = await pool.query(
    `SELECT image_path FROM user_signatures WHERE id = ? AND user_id = ?`,
    [signatureId, userId]
  );
  if (!rows.length) throw new Error('Signature not found in gallery');
  const dataUrl = signatureFileToDataUrl(rows[0].image_path);
  if (!dataUrl) throw new Error('Signature file missing');
  return { dataUrl, imagePath: rows[0].image_path };
}
