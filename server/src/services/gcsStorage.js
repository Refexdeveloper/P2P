/**
 * GCS Storage helper — new uploads go to GCS only (no MySQL LONGBLOB).
 * Existing MySQL blob files are still served for legacy records.
 *
 * Required env var: GCS_BUCKET_NAME=p2p-app-storage-master-diorama-489103-u2
 * Optional:         GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account-json>
 *                   (not needed when running on GCP with a service account)
 *
 * GCS prefix layout
 *   vendor-kyc/         ← vendor KYC documents
 *   purchase-orders/    ← PO PDFs, vendor acceptance, cancellation docs
 *   invoices/           ← accounts invoice files
 *   rfq-attachments/    ← vendor quotation uploads
 *   signatures/         ← SCM manager signatures
 *   pr-attachments/     ← FSD / PR attachment files
 */

let _Storage = null;
let _bucket = null;

function getStorage() {
  if (_bucket) return _bucket;
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null; // GCS not configured — fall through to disk
  try {
    if (!_Storage) {
      // Lazy import so the server starts fine without the package installed
      const { Storage } = require('@google-cloud/storage');
      _Storage = Storage;
    }
    const storage = new _Storage();
    _bucket = storage.bucket(bucketName);
    return _bucket;
  } catch (err) {
    console.warn('[GCS] @google-cloud/storage not available or failed to init:', err.message);
    return null;
  }
}

/**
 * Upload a Buffer to GCS.
 * @param {string} gcsPath  e.g. "pr-attachments/12345_file.pdf"
 * @param {Buffer} buffer
 * @param {string} [contentType]
 * @returns {Promise<string|null>} the gcsPath on success, null if GCS is not configured
 */
export async function uploadToGcs(gcsPath, buffer, contentType = 'application/octet-stream') {
  const bucket = getStorage();
  if (!bucket) return null;
  const file = bucket.file(gcsPath);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
  });
  return gcsPath;
}

/**
 * Download a file from GCS into a Buffer.
 * @param {string} gcsPath
 * @returns {Promise<Buffer|null>}
 */
export async function downloadFromGcs(gcsPath) {
  const bucket = getStorage();
  if (!bucket) return null;
  try {
    const [data] = await bucket.file(gcsPath).download();
    return data;
  } catch (err) {
    console.warn('[GCS] download failed for', gcsPath, ':', err.message);
    return null;
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
 * Whether GCS is enabled (bucket name env var is present).
 */
export function gcsEnabled() {
  return Boolean(process.env.GCS_BUCKET_NAME);
}

/** New uploads go to GCS only (no MySQL LONGBLOB). */
export function useGcsForNewUploads() {
  return gcsEnabled();
}
