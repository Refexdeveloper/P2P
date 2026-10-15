import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { uploadToGcs, downloadFromGcs, gcsEnabled, awaitGcsUpload } from './gcsStorage.js';
import {
  getPreferredScmManagerEmail,
  getPreferredScmManagerName,
  getPreferredPoApproverEmail,
  getPreferredPoApproverName,
  resolveScmManagerUser,
  resolvePoApproverUser,
  isPreferredPoApproverUser,
  DEFAULT_PO_APPROVER_SIGNATURE_FILE,
} from '../utils/scmAssignee.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SIGNATURE_UPLOAD_DIR = path.join(__dirname, '../../uploads/signatures');
export const SIGNATURE_SEED_DIR = path.join(__dirname, '../../assets/signatures');
/** Mounesh (SCM Manager) — kept for create/send identity; not used for Tarkeshwar PO sign. */
export const DEFAULT_SCM_MANAGER_SIGNATURE_FILE = 'mounesh_rathakar_default.jpg';
/** Tarkeshwar — default handwritten image stamped on PO Sign & Approval. */
export const DEFAULT_PO_APPROVER_SIGNATURE_FILE_NAME = DEFAULT_PO_APPROVER_SIGNATURE_FILE;
const LEGACY_SCM_MANAGER_SIGNATURE_FILES = ['rajeev_v_default.png'];

function defaultSignatureMime(fileName = DEFAULT_SCM_MANAGER_SIGNATURE_FILE) {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  return 'image/png';
}

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

export async function saveSignatureFile(buffer, ext, fileBaseName) {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const fileName = `${fileBaseName}.${ext}`;
  const fullPath = path.join(SIGNATURE_UPLOAD_DIR, fileName);
  fs.writeFileSync(fullPath, buffer);
  await awaitGcsUpload(
    `signatures/${fileName}`,
    buffer,
    `image/${ext === 'jpg' ? 'jpeg' : ext}`
  );
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

/** GCS fallback version — async, used when disk is missing (e.g. Cloud Run). */
export async function signatureFileToDataUrlAsync(fileName) {
  if (!fileName) return null;
  const sync = signatureFileToDataUrl(fileName);
  if (sync) return sync;
  if (!gcsEnabled()) return null;
  const buf = await downloadFromGcs(`signatures/${path.basename(fileName)}`);
  if (!buf?.length) return null;
  const ext = path.extname(fileName).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/** Ensure seed PNG exists under uploads/signatures (copy from assets if needed). */
export async function ensureDefaultScmManagerSignatureFile() {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const dest = path.join(SIGNATURE_UPLOAD_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  if (!(fs.existsSync(dest) && fs.statSync(dest).size > 0)) {
    const seedCandidates = [
      path.join(SIGNATURE_SEED_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE),
      path.join(__dirname, '../../assets/signatures', DEFAULT_SCM_MANAGER_SIGNATURE_FILE),
    ];
    for (const seed of seedCandidates) {
      if (fs.existsSync(seed) && fs.statSync(seed).size > 0) {
        fs.copyFileSync(seed, dest);
        break;
      }
    }
  }
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0 && gcsEnabled()) {
    try {
      await awaitGcsUpload(
        `signatures/${DEFAULT_SCM_MANAGER_SIGNATURE_FILE}`,
        fs.readFileSync(dest),
        defaultSignatureMime(DEFAULT_SCM_MANAGER_SIGNATURE_FILE),
        { skipIfExists: true }
      );
    } catch (err) {
      console.warn('[GCS] default signature upload skipped:', err.message);
    }
  }
  return fs.existsSync(dest) ? dest : null;
}

function ensureSignatureFileOnDisk(fileName) {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const dest = path.join(SIGNATURE_UPLOAD_DIR, fileName);
  if (!(fs.existsSync(dest) && fs.statSync(dest).size > 0)) {
    const seedCandidates = [
      path.join(SIGNATURE_SEED_DIR, fileName),
      path.join(__dirname, '../../assets/signatures', fileName),
    ];
    for (const seed of seedCandidates) {
      if (fs.existsSync(seed) && fs.statSync(seed).size > 0) {
        fs.copyFileSync(seed, dest);
        break;
      }
    }
  }
  return fs.existsSync(dest) && fs.statSync(dest).size > 0 ? dest : null;
}

export function getDefaultScmManagerSignatureDataUrl() {
  // Sync path for PDF render; file should already be on disk from seed/assets
  ensureSignatureFileOnDisk(DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  return signatureFileToDataUrl(DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
}

export async function ensureDefaultPoApproverSignatureFile() {
  const dest = ensureSignatureFileOnDisk(DEFAULT_PO_APPROVER_SIGNATURE_FILE);
  if (dest && gcsEnabled()) {
    try {
      await awaitGcsUpload(
        `signatures/${DEFAULT_PO_APPROVER_SIGNATURE_FILE}`,
        fs.readFileSync(dest),
        defaultSignatureMime(DEFAULT_PO_APPROVER_SIGNATURE_FILE),
        { skipIfExists: true }
      );
    } catch (err) {
      console.warn('[GCS] PO approver signature upload skipped:', err.message);
    }
  }
  return dest;
}

export function getDefaultPoApproverSignatureDataUrl() {
  ensureSignatureFileOnDisk(DEFAULT_PO_APPROVER_SIGNATURE_FILE);
  return signatureFileToDataUrl(DEFAULT_PO_APPROVER_SIGNATURE_FILE);
}

/** Signature used when the current user signs a PO (Tarkeshwar → his image; else Mounesh). */
export function getSignerDefaultSignatureDataUrl(user) {
  if (isPreferredPoApproverUser(user)) {
    return getDefaultPoApproverSignatureDataUrl() || getDefaultScmManagerSignatureDataUrl();
  }
  return getDefaultScmManagerSignatureDataUrl();
}

export function getSignerDefaultSignatureFileName(user) {
  if (isPreferredPoApproverUser(user)) return DEFAULT_PO_APPROVER_SIGNATURE_FILE;
  return DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
}

export function getDefaultScmManagerSignatureInfo() {
  ensureDir(SIGNATURE_UPLOAD_DIR);
  const dest = path.join(SIGNATURE_UPLOAD_DIR, DEFAULT_SCM_MANAGER_SIGNATURE_FILE);
  if (!(fs.existsSync(dest) && fs.statSync(dest).size > 0)) {
    getDefaultScmManagerSignatureDataUrl();
  }
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
 * Replace SCM Manager default signature (seed + uploads) from admin upload.
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
  await awaitGcsUpload(`signatures/${destName}`, buffer, defaultSignatureMime(destName));

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
 * Seed the SCM Manager default signature into user_signatures.
 * When backfill=true (startup migrate), also stamp signed POs and clear old PDFs for regen.
 */
async function upsertUserSignatureGallery(userId, fileName, label) {
  if (!userId || !fileName) return null;
  const [existing] = await pool.query(
    `SELECT id FROM user_signatures
     WHERE user_id = ? AND image_path = ?
     LIMIT 1`,
    [userId, fileName]
  );
  if (existing.length) return existing[0].id;
  const [result] = await pool.query(
    `INSERT INTO user_signatures (user_id, label, image_path) VALUES (?, ?, ?)`,
    [userId, label, fileName]
  );
  return result.insertId;
}

export async function ensureDefaultScmManagerSignature({ backfill = false } = {}) {
  const filePath = await ensureDefaultScmManagerSignatureFile();
  if (!filePath) {
    return { ok: false, reason: 'default signature file missing' };
  }

  const manager = await resolveScmManagerUser();
  let galleryId = null;
  if (manager?.id) {
    const legacyPlaceholders = LEGACY_SCM_MANAGER_SIGNATURE_FILES.map(() => '?').join(', ');
    const [legacy] = legacyPlaceholders
      ? await pool.query(
          `SELECT id FROM user_signatures
           WHERE user_id = ? AND image_path IN (${legacyPlaceholders})
           LIMIT 1`,
          [manager.id, ...LEGACY_SCM_MANAGER_SIGNATURE_FILES]
        )
      : [[]];
    if (legacy[0]) {
      await pool.query(
        `UPDATE user_signatures SET label = ?, image_path = ? WHERE id = ?`,
        [`${getPreferredScmManagerName()} Default Signature`, DEFAULT_SCM_MANAGER_SIGNATURE_FILE, legacy[0].id]
      );
      galleryId = legacy[0].id;
    } else {
      galleryId = await upsertUserSignatureGallery(
        manager.id,
        DEFAULT_SCM_MANAGER_SIGNATURE_FILE,
        `${getPreferredScmManagerName()} Default Signature`
      );
    }
  }

  // Keep Mounesh image in gallery; do not rewrite already-signed POs to Tarkeshwar.
  let backfilled = 0;
  if (backfill) {
    const [signedRows] = await pool.query(
      `SELECT id, signed_pdf_path, signature_image_path
       FROM purchase_orders
       WHERE signed_at IS NOT NULL
          OR signer_id IS NOT NULL
          OR (signed_pdf_path IS NOT NULL AND signature_image_path IS NOT NULL)`
    );
    for (const row of signedRows) {
      if (row.signature_image_path) continue;
      await pool.query(
        `UPDATE purchase_orders
         SET signature_image_path = ?,
             signature_name = COALESCE(NULLIF(signature_name, ''), ?),
             updated_at = NOW()
         WHERE id = ?`,
        [DEFAULT_SCM_MANAGER_SIGNATURE_FILE, getPreferredScmManagerName(), row.id]
      );
      backfilled += 1;
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

/** Seed Tarkeshwar's signature into his gallery for PO Sign & Approval. */
export async function ensureDefaultPoApproverSignature() {
  const filePath = await ensureDefaultPoApproverSignatureFile();
  if (!filePath) {
    return { ok: false, reason: 'PO approver signature file missing' };
  }
  const approver = await resolvePoApproverUser();
  const galleryId = approver?.id
    ? await upsertUserSignatureGallery(
        approver.id,
        DEFAULT_PO_APPROVER_SIGNATURE_FILE,
        `${getPreferredPoApproverName()} Default Signature`
      )
    : null;
  return {
    ok: true,
    approverId: approver?.id || null,
    approverEmail: approver?.email || getPreferredPoApproverEmail(),
    galleryId,
    fileName: DEFAULT_PO_APPROVER_SIGNATURE_FILE,
  };
}

export async function listUserSignatures(userId) {
  await ensureDefaultScmManagerSignature({ backfill: false }).catch(() => null);
  await ensureDefaultPoApproverSignature().catch(() => null);
  const [userRows] = await pool.query(`SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1`, [
    userId,
  ]);
  const preferPoApprover = isPreferredPoApproverUser(userRows[0] || {});
  const preferredFile = preferPoApprover
    ? DEFAULT_PO_APPROVER_SIGNATURE_FILE
    : DEFAULT_SCM_MANAGER_SIGNATURE_FILE;
  const [rows] = await pool.query(
    `SELECT id, label, image_path, created_at FROM user_signatures
     WHERE user_id = ? ORDER BY
       CASE WHEN image_path = ? THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 20`,
    [userId, preferredFile]
  );
  const out = [];
  for (const r of rows) {
    const imageDataUrl = await signatureFileToDataUrlAsync(r.image_path);
    if (!imageDataUrl) continue;
    out.push({
      id: r.id,
      label: r.label || 'Signature',
      imagePath: r.image_path,
      imageDataUrl,
      createdAt: r.created_at,
      isDefault: r.image_path === preferredFile,
    });
  }
  return out;
}

export async function saveUserSignature(userId, { image, label }) {
  const { ext, buffer } = parseDataUrlImage(image);
  const fileName = await saveSignatureFile(buffer, ext, `user_${userId}_${Date.now()}`);
  const [result] = await pool.query(
    `INSERT INTO user_signatures (user_id, label, image_path) VALUES (?, ?, ?)`,
    [userId, (label || 'My Signature').slice(0, 100), fileName]
  );
  return {
    id: result.insertId,
    label: (label || 'My Signature').slice(0, 100),
    imagePath: fileName,
    imageDataUrl: (await signatureFileToDataUrlAsync(fileName)) || signatureFileToDataUrl(fileName),
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
  const dataUrl = await signatureFileToDataUrlAsync(rows[0].image_path);
  if (!dataUrl) throw new Error('Signature file missing');
  return { dataUrl, imagePath: rows[0].image_path };
}

/**
 * Build PDF/HTML signature options from a PO record (enrichPO shape or DB row).
 * Falls back to the SCM Manager default signature for signed POs when the image is missing.
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
    getDefaultScmManagerSignatureDataUrl();
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

/** Async variant — loads signature from GCS when disk is empty (Cloud Run). */
export async function buildSignatureRenderOptionsAsync(po = {}) {
  const sync = buildSignatureRenderOptions(po);
  if (sync?.imageDataUrl || sync?.dsc) return sync;
  const imagePath = po.signatureImagePath || po.signature_image_path || '';
  if (!imagePath) return sync;
  const fromGcs = await signatureFileToDataUrlAsync(imagePath);
  if (!fromGcs) return sync;
  return {
    ...(sync || {
      name: po.signatureName || po.signature_name || getPreferredScmManagerName() || 'SCM Manager',
      date: po.signedAt || po.signed_at || '',
      comments: po.signerComments || po.signer_comments || '',
    }),
    imageDataUrl: fromGcs,
  };
}
