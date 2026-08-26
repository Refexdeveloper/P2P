import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import {
  getPreferredScmManagerEmail,
  getPreferredScmManagerName,
  resolveScmManagerUser,
} from '../utils/scmAssignee.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SIGNATURE_UPLOAD_DIR = path.join(__dirname, '../../uploads/signatures');
export const SIGNATURE_SEED_DIR = path.join(__dirname, '../../assets/signatures');
export const DEFAULT_SCM_MANAGER_SIGNATURE_FILE = 'rajeev_v_default.png';

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

export function signatureBufferToDataUrl(buffer, mime = 'image/png') {
  if (!buffer) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!buf.length) return null;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

export function signatureFileToDataUrl(fileName) {
  if (!fileName) return null;
  const candidates = [
    path.join(SIGNATURE_UPLOAD_DIR, fileName),
    path.join(SIGNATURE_SEED_DIR, fileName),
    path.join(__dirname, '../../assets/signatures', fileName),
  ];
  const fullPath = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 0);
  if (!fullPath) return null;
  const ext = path.extname(fileName).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  const buffer = fs.readFileSync(fullPath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** Ensure seed PNG exists under uploads/signatures (copy from assets if needed). */
export function ensureDefaultScmManagerSignatureFile() {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const dest = path.join(SIGNATURE_UPLOAD_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;

  const seedCandidates = [
    path.join(SIGNATURE_SEED_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE),
    path.join(__dirname, '../../assets/signatures', DEFAULT_SCM_MANAGER_SIGNATURE_FILE),
  ];
  for (const seed of seedCandidates) {
    if (fs.existsSync(seed) && fs.statSync(seed).size > 0) {
      fs.copyFileSync(seed, dest);
      return dest;
    }
  }
  return fs.existsSync(dest) ? dest : null;
}

export function getDefaultScmManagerSignatureDataUrl() {
  ensureDefaultScmManagerSignatureFile();
  return signatureFileToDataUrl(DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
}

export function getDefaultScmManagerSignatureInfo() {
  ensureDefaultScmManagerSignatureFile();
  const dataUrl = signatureFileToDataUrl(DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  const fullPath = path.join(SIGNATURE_UPLOAD_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  let updatedAt = null;
  try {
    if (fs.existsSync(fullPath)) updatedAt = fs.statSync(fullPath).mtime.toISOString();
  } catch {
    /* ignore */
  }
  return {
    fileName: DEFAULT_SCM_MANAGER_SIGNATURE_FILE,
    label: `${getPreferredScmManagerName()} Default Signature`,
    managerName: getPreferredScmManagerName(),
    managerEmail: getPreferredScmManagerEmail(),
    imageDataUrl: dataUrl,
    updatedAt,
  };
}

/**
 * Replace Rajeev default signature (seed + uploads) from admin upload.
 * Optionally re-stamp signed POs so PDF/document view uses the new image.
 */
export async function updateDefaultScmManagerSignature({
  image,
  applyToSignedPos = true,
} = {}) {
  const { ext, buffer, dataUrl } = parseDataUrlImage(image);
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'webp') {
    throw new Error('Use PNG or JPG for the default signature');
  }

  ensureDir(SIGNATURE_SEED_DIR);
  ensureDir(SIGNATURE_UPLOAD_DIR);

  // Always store as the canonical default filename (png preferred for transparency)
  const destName = DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
  const uploadPath = path.join(SIGNATURE_UPLOAD_DIR, destName);
  const seedPath = path.join(SIGNATURE_SEED_DIR, destName);

  // Convert jpg/webp to stored png bytes as-is under .png name is OK for browsers as data URL;
  // keep original bytes but force .png extension only when input is png; otherwise save matching ext
  // into the canonical png file name for consistency with existing code paths.
  fs.writeFileSync(uploadPath, buffer);
  fs.writeFileSync(seedPath, buffer);

  // Refresh gallery entry for SCM Manager
  const seeded = await ensureDefaultScmManagerSignature({ backfill: Boolean(applyToSignedPos) });

  return {
    ...getDefaultScmManagerSignatureInfo(),
    imageDataUrl: dataUrl || getDefaultScmManagerSignatureDataUrl(),
    galleryId: seeded.galleryId,
    backfilled: seeded.backfilled || 0,
  };
}

/**
 * Seed Rajeev's default signature into user_signatures.
 * When backfill=true (startup migrate), also stamp signed POs and clear old PDFs for regen.
 */
export async function ensureDefaultScmManagerSignature({ backfill = false } = {}) {
  const filePath = ensureDefaultScmManagerSignatureFile();
  if (!filePath) {
    return { ok: false, reason: 'default signature file missing' };
  }

  const manager = await resolveScmManagerUser();
  let galleryId = null;
  if (manager?.id) {
    const [existing] = await pool.query(
      `SELECT id FROM user_signatures
       WHERE user_id = ? AND image_path = ?
       LIMIT 1`,
      [manager.id, DEFAULT_SCM_MANAGER_SIGNATURE_FILE]
    );
    if (existing.length) {
      galleryId = existing[0].id;
    } else {
      const [result] = await pool.query(
        `INSERT INTO user_signatures (user_id, label, image_path) VALUES (?, ?, ?)`,
        [manager.id, `${getPreferredScmManagerName()} Default Signature`, DEFAULT_SCM_MANAGER_SIGNATURE_FILE]
      );
      galleryId = result.insertId;
    }
  }

  let backfilled = 0;
  if (backfill) {
    const [signedRows] = await pool.query(
      `SELECT id, signed_pdf_path, signature_image_path, signature_name, status, signer_id
       FROM purchase_orders
       WHERE (
         signed_at IS NOT NULL
         OR signed_pdf_path IS NOT NULL
         OR status IN (
           'pending_buyer_verify', 'approved', 'sent_to_vendor', 'accepted',
           'partially_received', 'completed', 'closed'
         )
       )`
    );

    for (const row of signedRows) {
      const alreadyDefault = row.signature_image_path === DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
      await pool.query(
        `UPDATE purchase_orders
         SET signature_image_path = ?,
             signature_name = COALESCE(NULLIF(signature_name, ''), ?),
             updated_at = NOW()
         WHERE id = ?`,
        [DEFAULT_SCM_MANAGER_SIGNATURE_FILE, getPreferredScmManagerName(), row.id]
      );

      if (row.signed_pdf_path) {
        const pdfFull = path.join(__dirname, '../../uploads/po', path.basename(String(row.signed_pdf_path)));
        try {
          if (fs.existsSync(pdfFull)) fs.unlinkSync(pdfFull);
        } catch {
          /* ignore */
        }
      }
      if (!alreadyDefault) backfilled += 1;
    }
  }

  return {
    ok: true,
    managerId: manager?.id || null,
    managerEmail: manager?.email || getPreferredScmManagerEmail(),
    galleryId,
    backfilled,
  };
}

export async function listUserSignatures(userId) {
  await ensureDefaultScmManagerSignature({ backfill: false }).catch(() => null);
  const [rows] = await pool.query(
    `SELECT id, label, image_path, created_at FROM user_signatures
     WHERE user_id = ? ORDER BY
       CASE WHEN image_path = ? THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 20`,
    [userId, DEFAULT_SCM_MANAGER_SIGNATURE_FILE]
  );
  return rows
    .map((r) => ({
      id: r.id,
      label: r.label || 'Signature',
      imagePath: r.image_path,
      imageDataUrl: signatureFileToDataUrl(r.image_path),
      createdAt: r.created_at,
      isDefault: r.image_path === DEFAULT_SCM_MANAGER_SIGNATURE_FILE,
    }))
    .filter((r) => r.imageDataUrl);
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
  if (rows[0].image_path === DEFAULT_SCM_MANAGER_SIGNATURE_FILE) {
    throw new Error('Cannot delete the default SCM Manager signature');
  }
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

/**
 * Build PDF/HTML signature options from a PO record (enrichPO shape or DB row).
 * Falls back to Rajeev's default signature for signed POs when the image is missing.
 */
export function buildSignatureRenderOptions(po = {}) {
  const name = po.signatureName || po.signature_name || '';
  let imagePath = po.signatureImagePath || po.signature_image_path || '';
  const blob = po.signatureImageData || po.signature_image_data;
  let imageDataUrl =
    (po.signatureImageDataUrl && String(po.signatureImageDataUrl).startsWith('data:image/')
      ? po.signatureImageDataUrl
      : null) ||
    signatureBufferToDataUrl(blob) ||
    (imagePath ? signatureFileToDataUrl(imagePath) : null);
  let dsc = po.signatureDsc || po.signature_dsc || null;
  if (!dsc && po.signature_dsc_json) {
    try {
      dsc =
        typeof po.signature_dsc_json === 'string'
          ? JSON.parse(po.signature_dsc_json)
          : po.signature_dsc_json;
    } catch {
      dsc = null;
    }
  }

  const looksSigned = Boolean(
    po.signedAt ||
      po.signed_at ||
      po.signedPdfPath ||
      po.signed_pdf_path ||
      po.signerId ||
      po.signer_id ||
      imagePath ||
      blob ||
      dsc
  );

  if (looksSigned && !imageDataUrl && !dsc) {
    ensureDefaultScmManagerSignatureFile();
    imagePath = DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
    imageDataUrl = signatureFileToDataUrl(DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  }

  if (!name && !imageDataUrl && !dsc) return undefined;
  return {
    name: name || dsc?.holderName || getPreferredScmManagerName() || 'SCM Manager',
    date: po.signedAt || po.signed_at || '',
    comments: po.signerComments || po.signer_comments || '',
    imageDataUrl: imageDataUrl || undefined,
    dsc: dsc || undefined,
  };
}
