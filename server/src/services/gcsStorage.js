/**
 * GCS Storage helper — new uploads go to GCS (disk is a local fallback).
 *
 * Bucket and service-account key are set in this file so local + Cloud Run work
 * without GCS_BUCKET_NAME / GOOGLE_APPLICATION_CREDENTIALS.
 *
 * GCS prefix layout
 *   vendor-kyc/         ← vendor KYC documents
 *   purchase-orders/    ← PO PDFs, vendor acceptance, cancellation docs
 *   invoices/           ← accounts invoice files
 *   grn-attachments/    ← GRN line-item receipt / inspection files
 *   rfq-attachments/    ← vendor quotation uploads
 *   signatures/         ← SCM manager signatures
 *   pr-attachments/     ← FSD / PR attachment files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_GCS_BUCKET_NAME = 'p2p-app-storage-master-diorama-489103-u2';
const DEFAULT_GCS_PROJECT_ID = 'master-diorama-489103-u2';

/** Service-account key — used when ADC / env key file is not available. */
const GCS_SERVICE_ACCOUNT = {
  type: 'service_account',
  project_id: 'master-diorama-489103-u2',
  private_key_id: '4578ba92e8e4f622ce5eead8fcb80089de06b023',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC5nMjWRhlIaULu\nK98YTdQKxo9EJTNsBHj2SWUZkWU2t6Ikkq6tZiJh99s1pgbHrNJqC+dvDIUGzwb8\nH+JhoA/bDUuKYmVoKzexIlgHI8r7DNILr1YYWw1yX+jSv4/I5pfnoKWuCpp31r8b\nCmxRGYsnCYaZlg3FXYkqqEX8bCVmZxjHv3EQrtglODWjAH7lDkZXfOSabhT95Jpp\n2nQXT6+9xjNTD650WAIMJFc2CoEliaIZ17BkOm9ntfxR0TGbrMNqvjOOrRqily5I\nf+a8t5lcwBl1sGNKjny0yrkmP38hd0pXT0yqRVCW4lRJb4hnkgSFx5IkubOJRuZu\nb44x3et5AgMBAAECggEAGhx7xmUDHoQsVbwXPOCKAWAQfHotQzdX2vHVRqUFE47+\nwN1ftGYHVTfcfy4VixZ9XUzCaIVe22fZaDOGEczGHj8/Dr8r290kjwcxUgPPhMS3\nccxfNLruZ9YlNyyaqh0CZqPbWuID+/LaXI/5T+ljgYDeDhIlasvvRXB5s/p0wnRl\nzaZlIkebE+lFnySV5iz+X27yXsooeXaI2T/236ljyqJNHfSyUrX82MrnVt8C1Zoh\nZ0fL/rJRciXGS/0QX1J+TfBc0i0yUs1cC/QilFazD2VaLHJkORJkds2D20dqlby5\noC+obAXASMYYMJe8pmeCOq20FqGuoU1DmpNDOp9R1wKBgQDw1rtgMDlF517qJvKa\njV6Esr2iIJqC33TPh1LrKZDUnc5Mm3CGMwTRX8yLapAlsm9J1R88amQ1crFPjigw\n/hWtpzB0XoyjAOsX0PotYVW5WWwlPIUpre4Hj+CRCkVp8KDSjx13GFYxjc6tFwfi\n2PB/8u83LxcPC46GaePPcLnN3wKBgQDFTAuVPQPB4DU+wXPkyx4vc3qqinjcnXGa\nRTu2iGpjq2mvNBRh/F7LlC2ygVDad7olIza7Eviq7dWVSy6YLBv2KqmlS0FCqmLT\n/1AeVU60X8gIcYVIiaiXp0hMC7m43EcmsLWn/DHIJq4U4tqRjAQy6zroXmTBiTuQ\nYPyYuv1BpwKBgQDnV81ry0bowCSrVbhK/6sgWrXQC/N/7Xg+dSYQYMAPjHqDmfiP\n4GgrWxOXhEhs/abrTD6SATy7Hq311n8C+L8ILQZdcgkz9wjcus/mUY5P2fcJGcZs\nT/fK6cj0aeJdrlg9il3qbcU2GprCJ9JadLsonMpuvtwuhpJkyUiclhLVDwKBgEJS\n2QX3N98hzuRkxd/gxCnxaQgReqW3K6xPn84xt4n/4owqNrvlybwn+OCsBhEa9HFt\nkAV9UCitwQHp/yTalx++ob7WOH7/pi9cAYPg649JL4ZfGw4ScKFic7RUsL9LFYQV\nHUv2RInjLtwIkq8g4Xx4hRn+OWKyDlrvr5psKZy7AoGAQV0/HOioTr5Jhv6jGNmR\nNJd55IuXyqI4g8/P3wgVhgjU0D7qvFoo28ftsLcY+OsiAxieEx5G/NnknAp77R1O\niDDHgi2EUHY/gLz9VbyPPI99tbZl0GEkD5Umx+25DvnwS7ODjw535CD/VcnGmNCd\ncGa6j7OUbIYh0EDzbkvswbA=\n-----END PRIVATE KEY-----\n',
  client_email: 'p2p-app-sa@master-diorama-489103-u2.iam.gserviceaccount.com',
  client_id: '105072988660378389770',
  universe_domain: 'googleapis.com',
};

let _bucket = null;
let _initError = '';

function getBucketName() {
  return String(process.env.GCS_BUCKET_NAME || DEFAULT_GCS_BUCKET_NAME).trim();
}

function getProjectId() {
  return String(
    process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      DEFAULT_GCS_PROJECT_ID
  ).trim();
}

function loadServiceAccount() {
  const candidates = [
    String(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
    path.resolve(__dirname, '../../p2p-app-sa-key.json'),
    path.resolve(__dirname, '../p2p-app-sa-key.json'),
  ].filter(Boolean);
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed?.client_email && parsed?.private_key) return parsed;
      }
    } catch {
      /* try next */
    }
  }
  return GCS_SERVICE_ACCOUNT;
}

function getStorage() {
  if (_bucket) return _bucket;
  const bucketName = getBucketName();
  if (!bucketName) return null;
  try {
    const credentials = loadServiceAccount();
    const storage = new Storage({
      projectId: credentials.project_id || getProjectId(),
      credentials,
    });
    _bucket = storage.bucket(bucketName);
    _initError = '';
    return _bucket;
  } catch (err) {
    _initError = err.message;
    console.warn('[GCS] client init failed:', err.message);
    return null;
  }
}

/**
 * Upload a Buffer to GCS.
 * @param {string} gcsPath  e.g. "pr-attachments/12345_file.pdf"
 * @param {Buffer} buffer
 * @param {string} [contentType]
 * @param {{ skipIfExists?: boolean }} [opts]
 * @returns {Promise<string|null>} the gcsPath on success, null if GCS is not configured
 */
export async function uploadToGcs(gcsPath, buffer, contentType = 'application/octet-stream', opts = {}) {
  if (!gcsPath || !buffer) return null;
  const bucket = getStorage();
  if (!bucket) {
    console.warn('[GCS] upload skipped (client not initialized):', gcsPath, _initError || '');
    return null;
  }
  try {
    if (opts.skipIfExists) {
      const [exists] = await bucket.file(gcsPath).exists();
      if (exists) {
        console.log('[GCS] already exists, skip upload', gcsPath);
        return gcsPath;
      }
    }
    await bucket.file(gcsPath).save(buffer, {
      metadata: { contentType },
      resumable: false,
    });
    console.log('[GCS] uploaded', gcsPath);
    invalidateVendorKycIndex();
    return gcsPath;
  } catch (err) {
    console.warn('[GCS] upload failed for', gcsPath, ':', err.message);
    throw err;
  }
}

/** @param {string} gcsPath */
export async function gcsObjectExists(gcsPath) {
  const bucket = getStorage();
  if (!bucket || !gcsPath) return false;
  try {
    const [exists] = await bucket.file(gcsPath).exists();
    return Boolean(exists);
  } catch {
    return false;
  }
}

let _vendorKycIndex = null;
let _vendorKycIndexAt = 0;
const VENDOR_KYC_INDEX_TTL_MS = 5 * 60 * 1000;

export function invalidateVendorKycIndex() {
  _vendorKycIndex = null;
  _vendorKycIndexAt = 0;
}

async function loadVendorKycIndex() {
  const now = Date.now();
  if (_vendorKycIndex && now - _vendorKycIndexAt < VENDOR_KYC_INDEX_TTL_MS) {
    return _vendorKycIndex;
  }
  const keys = await listGcsKeys('vendor-kyc/', 20000);
  const byBase = new Map();
  const bySuffix = [];
  for (const key of keys) {
    const base = gcsBasename(key);
    byBase.set(base.toLowerCase(), key);
    bySuffix.push({ key, baseLower: base.toLowerCase() });
  }
  _vendorKycIndex = { byBase, bySuffix };
  _vendorKycIndexAt = now;
  return _vendorKycIndex;
}

/**
 * Reuse a vendor-kyc object already in the bucket (no re-upload).
 * @returns {Promise<string|null>} full key e.g. vendor-kyc/416_pan_x.pdf
 */
export async function findExistingVendorKycObject({ vendorId, docType, fileName }) {
  const originalName = String(fileName || '').trim();
  if (!originalName) return null;
  const safeOriginal = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const type = String(docType || 'other').trim() || 'other';
  const exactBase = `${vendorId}_${type}_${safeOriginal}`;
  const exactKey = `vendor-kyc/${exactBase}`;

  if (await gcsObjectExists(exactKey)) return exactKey;

  try {
    const index = await loadVendorKycIndex();
    const hit = index.byBase.get(exactBase.toLowerCase());
    if (hit) return hit;

    const suffixA = `_${type}_${safeOriginal}`.toLowerCase();
    const suffixB = `_${safeOriginal}`.toLowerCase();
    const match =
      index.bySuffix.find((x) => x.baseLower.endsWith(suffixA)) ||
      index.bySuffix.find((x) => x.baseLower === safeOriginal.toLowerCase()) ||
      index.bySuffix.find((x) => x.baseLower.endsWith(suffixB));
    return match?.key || null;
  } catch (err) {
    console.warn('[GCS] vendor-kyc reuse lookup failed:', err.message);
    return null;
  }
}

/**
 * Download a file from GCS into a Buffer.
 * @param {string} gcsPath
 * @returns {Promise<Buffer|null>}
 */
export async function downloadFromGcs(gcsPath) {
  const bucket = getStorage();
  if (!bucket || !gcsPath) return null;
  try {
    const [data] = await bucket.file(gcsPath).download();
    return data;
  } catch (err) {
    const code = err?.code || err?.message || '';
    if (!/404|No such object|not found/i.test(String(code))) {
      console.warn('[GCS] download failed for', gcsPath, ':', err.message);
    }
    return null;
  }
}

function gcsBasename(stored) {
  const s = String(stored || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const i = s.lastIndexOf('/');
  return i >= 0 ? s.slice(i + 1) : s;
}

/**
 * Resolve a stored upload from GCS using common folder prefixes.
 * @param {string} storedPath  DB file_path (basename or folder/name)
 * @param {string[]} folders   e.g. ['pr-attachments']
 */
export async function downloadStoredUpload(storedPath, folders = []) {
  const stored = String(storedPath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!stored) return null;
  const base = gcsBasename(stored);
  const keys = [];
  if (stored.includes('/')) keys.push(stored);
  for (const folder of folders) {
    if (!folder) continue;
    keys.push(`${folder}/${base}`);
    if (stored !== base) keys.push(`${folder}/${stored}`);
  }
  keys.push(base);
  for (const key of [...new Set(keys.filter(Boolean))]) {
    const buf = await downloadFromGcs(key);
    if (buf?.length) return buf;
  }
  return null;
}

/**
 * List object keys under a prefix (used to recover files stored under a renamed path).
 * @param {string} prefix
 * @param {number} [maxResults]
 * @returns {Promise<string[]>}
 */
export async function listGcsKeys(prefix, maxResults = 50) {
  const bucket = getStorage();
  if (!bucket || !prefix) return [];
  try {
    const [files] = await bucket.getFiles({ prefix, maxResults });
    return (files || []).map((f) => f.name).filter(Boolean);
  } catch (err) {
    console.warn('[GCS] list failed for', prefix, ':', err.message);
    return [];
  }
}

/**
 * Generate a short-lived signed URL (15 min) for direct browser download.
 * @param {string} gcsPath
 * @param {string} [fileName]  content-disposition filename
 * @returns {Promise<string|null>}
 */
export async function signedDownloadUrl(gcsPath, fileName) {
  const bucket = getStorage();
  if (!bucket) return null;
  try {
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    };
    if (fileName) {
      options.responseDisposition = `attachment; filename="${fileName.replace(/"/g, '')}"`;
    }
    const [url] = await bucket.file(gcsPath).getSignedUrl(options);
    return url;
  } catch (err) {
    console.warn('[GCS] signed URL failed for', gcsPath, ':', err.message);
    return null;
  }
}

/**
 * Whether GCS is enabled (hardcoded bucket, or GCS_BUCKET_NAME override).
 */
export function gcsEnabled() {
  return Boolean(getBucketName());
}

/** New uploads go to GCS only (no MySQL LONGBLOB). */
export function useGcsForNewUploads() {
  return gcsEnabled();
}

/** Startup check: confirm object upload/download works (SA may lack buckets.get). */
export async function pingGcs() {
  const bucketName = getBucketName();
  const bucket = getStorage();
  if (!bucket) {
    console.warn(`[GCS] not initialized for bucket ${bucketName}${_initError ? `: ${_initError}` : ''}`);
    return false;
  }
  try {
    const probe = `_health/p2p-gcs-ping.txt`;
    const uploaded = await uploadToGcs(probe, Buffer.from('ok'), 'text/plain');
    if (!uploaded) {
      console.warn(`[GCS] upload probe failed for gs://${bucketName}`);
      return false;
    }
    console.log(`[GCS] connected to gs://${bucketName} as ${loadServiceAccount().client_email}`);
    return true;
  } catch (err) {
    console.warn(`[GCS] ping failed for gs://${bucketName}:`, err.message);
    return false;
  }
}
