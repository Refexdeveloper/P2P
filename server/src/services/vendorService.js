import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { uploadToGcs, downloadFromGcs, gcsEnabled, useGcsForNewUploads, findExistingVendorKycObject, awaitGcsUpload } from './gcsStorage.js';
import { formatDate } from '../utils/constants.js';
import { parseCsv, rowsToCsv, normalizeHeaderKey } from '../utils/csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENDOR_UPLOAD_DIR = path.join(__dirname, '../../uploads/vendors');

function ensureVendorDir() {
  if (!fs.existsSync(VENDOR_UPLOAD_DIR)) {
    fs.mkdirSync(VENDOR_UPLOAD_DIR, { recursive: true });
  }
}

const TYPED_DOC_TYPES = ['gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration'];
const DOC_TYPES = TYPED_DOC_TYPES;

function isAllowedDocType(docType) {
  const t = String(docType || '').trim();
  if (!t) return false;
  if (TYPED_DOC_TYPES.includes(t)) return true;
  return /^other__[a-zA-Z0-9._-]{1,100}$/.test(t);
}

/** Infer KYC slot from filename; unknown files become other__{safeName}. */
export function inferVendorDocType(fileName) {
  const original = path.basename(String(fileName || '')).trim();
  const n = original.toLowerCase();
  if (!original) return 'other__document';
  if (/\bpan\b|pan\s*card|pan_card/.test(n)) return 'pan';
  if (/\bgst\b|gstin|gst\s*cert/.test(n)) return 'gst';
  if (/cheque|check|cancelled|cancel\s*chq|boi\s*cancel/.test(n)) return 'cheque';
  if (/(udyam|msme).*(declar|declaration)|declaration.*(udyam|msme)/.test(n)) {
    return 'msme_declaration';
  }
  if (/\budyam\b|\bmsme\b/.test(n)) return 'msme';
  if (/\bkyc\b/.test(n)) return 'kyc';
  const safe = original.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 80);
  return `other__${safe || 'document'}`;
}
let fileDataColumnReady = false;

async function ensureFileDataColumn() {
  if (fileDataColumnReady) return;
  try {
    const [cols] = await pool.query(
      `SELECT 1 AS ok
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'vendor_documents'
         AND column_name = 'file_data'
       LIMIT 1`
    );
    if (!cols.length) {
      await pool.query(`ALTER TABLE vendor_documents ADD COLUMN file_data LONGBLOB NULL`);
    }
    fileDataColumnReady = true;
  } catch (err) {
    if (String(err.message || '').includes('Duplicate column')) {
      fileDataColumnReady = true;
      return;
    }
    throw err;
  }
}

function mapDocumentRow(d) {
  return {
    id: d.id,
    docType: d.doc_type,
    fileName: d.file_name,
    uploadedAt: formatDate(d.uploaded_at),
  };
}

async function attachDocumentsToVendors(vendors) {
  if (!vendors.length) return vendors;
  const ids = vendors.map((v) => v.id);
  const ph = ids.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT id, vendor_id, doc_type, file_name, uploaded_at
     FROM vendor_documents WHERE vendor_id IN (${ph}) ORDER BY doc_type`,
    ids
  );
  const byVendor = new Map();
  for (const d of rows) {
    const list = byVendor.get(d.vendor_id) || [];
    list.push(mapDocumentRow(d));
    byVendor.set(d.vendor_id, list);
  }
  return vendors.map((v) => ({ ...v, documents: byVendor.get(v.id) || [] }));
}

async function generateVendorCode() {
  const year = new Date().getFullYear();
  const prefix = `VND-${year}-`;
  const [rows] = await pool.query(
    `SELECT vendor_code FROM vendors WHERE vendor_code LIKE ?`,
    [`${prefix}%`]
  );
  let max = 0;
  for (const row of rows) {
    const match = String(row.vendor_code || '').match(/-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  for (let seq = max + 1; seq < max + 1000; seq += 1) {
    const code = `${prefix}${String(seq).padStart(4, '0')}`;
    const [exists] = await pool.query(
      `SELECT id FROM vendors WHERE vendor_code = ? LIMIT 1`,
      [code]
    );
    if (!exists.length) return code;
  }
  throw new Error('Could not assign a new vendor code');
}

async function getVendorDocuments(vendorId) {
  const [rows] = await pool.query(
    `SELECT id, doc_type, file_name, uploaded_at
     FROM vendor_documents WHERE vendor_id = ? ORDER BY doc_type`,
    [vendorId]
  );
  return rows.map(mapDocumentRow);
}

function yesNo(value, fallback = 'no') {
  const s = String(value ?? '').trim().toLowerCase();
  if (s === 'yes' || s === '1' || s === 'true' || s === 'y') return 'yes';
  if (s === 'no' || s === '0' || s === 'false' || s === 'n') return 'no';
  return fallback;
}

function msmeTypeValue(type) {
  const allowed = ['Micro', 'Small', 'Medium'];
  const match = allowed.find((t) => t.toLowerCase() === String(type || '').trim().toLowerCase());
  return match || null;
}

function mapVendor(row, documents = []) {
  return {
    id: row.id,
    vendorCode: row.vendor_code,
    name: row.name,
    vendorType: row.vendor_type,
    gstNumber: row.gst_number || '',
    panNumber: row.pan_number || '',
    email: row.email,
    phone: row.phone || '',
    address: row.address || '',
    category: row.category || '',
    contactName: row.contact_name || '',
    msme: row.msme && row.msme !== 'no' ? row.msme : '',
    msmeType: row.msme_type || '',
    documentsComplete: row.documents_complete || 'no',
    accountNumber: row.account_number || '',
    ifscCode: row.ifsc_code || '',
    bankName: row.bank_name || '',
    branch: row.branch || '',
    status: row.status,
    createdAt: formatDate(row.created_at),
    documents,
  };
}

const MAX_VENDOR_DOC_BYTES = 10 * 1024 * 1024;

function decodeVendorFile(base64Data) {
  const raw = String(base64Data || '').includes(',')
    ? String(base64Data).split(',').pop()
    : String(base64Data || '');
  return Buffer.from(String(raw).replace(/\s/g, ''), 'base64');
}

/**
 * Save vendor document.
 * Real uploads always write new bytes (DB blob + GCS/disk). View/Download use the DB blob first
 * so a re-upload never shows a previous vendor's or previous version of the same filename.
 */
async function saveVendorDocument(vendorId, docType, fileName, base64Data, { linkOnly = false } = {}) {
  const originalName = path.basename(String(fileName || '')).trim();
  if (!originalName) return null;

  const stamp = Date.now();
  const safeBase = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeName = `${vendorId}_${docType}_${stamp}_${safeBase}`;

  // Link-only / bulk import: point at existing GCS object, no new bytes
  if (linkOnly) {
    if (!useGcsForNewUploads()) {
      throw new Error('GCS is disabled — cannot link-only without upload');
    }
    const existingKey = await findExistingVendorKycObject({
      vendorId,
      docType,
      fileName: originalName,
    });
    if (!existingKey) {
      throw new Error(`GCS object not found for ${originalName} — upload required`);
    }
    const storedBase = path.basename(existingKey.replace(/^vendor-kyc\//, ''));
    console.log(`[GCS] reuse vendor doc ${existingKey} → vendor #${vendorId}`);
    return { fileName: originalName, filePath: storedBase, buffer: null, reused: true };
  }

  if (!base64Data) {
    throw new Error('File and file name are required');
  }

  const buffer = decodeVendorFile(base64Data);
  if (!buffer.length) {
    throw new Error(`Vendor document ${originalName} is empty or invalid`);
  }
  if (buffer.length > MAX_VENDOR_DOC_BYTES) {
    throw new Error(`Vendor document ${originalName} must be under 10MB`);
  }

  if (useGcsForNewUploads()) {
    await awaitGcsUpload(`vendor-kyc/${safeName}`, buffer, 'application/octet-stream');
  }

  try {
    ensureVendorDir();
    fs.writeFileSync(path.join(VENDOR_UPLOAD_DIR, safeName), buffer);
  } catch (err) {
    console.warn('Vendor document disk write skipped (will keep DB copy):', err.message);
  }

  // Always keep the new bytes in DB so preview/download match the latest upload
  return { fileName: originalName, filePath: safeName, buffer, reused: false };
}

async function upsertVendorDocument(vendorId, docType, fileName, base64Data, opts = {}) {
  const saved = await saveVendorDocument(vendorId, docType, fileName, base64Data, opts);
  if (!saved) return null;

  await ensureFileDataColumn();
  // Always replace metadata; clear stale blob when storing via GCS (buffer null)
  const sql = `INSERT INTO vendor_documents (vendor_id, doc_type, file_name, file_path, file_data)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       file_name = VALUES(file_name),
       file_path = VALUES(file_path),
       file_data = VALUES(file_data),
       uploaded_at = NOW()`;
  const params = [vendorId, docType, saved.fileName, saved.filePath, saved.buffer];
  try {
    await pool.query(sql, params);
  } catch (err) {
    if (String(err.message || '').includes('Unknown column') && String(err.message || '').includes('file_data')) {
      fileDataColumnReady = false;
      await pool.query(
        `INSERT INTO vendor_documents (vendor_id, doc_type, file_name, file_path)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           file_name = VALUES(file_name),
           file_path = VALUES(file_path),
           uploaded_at = NOW()`,
        [vendorId, docType, saved.fileName, saved.filePath]
      );
    } else {
      throw err;
    }
  }
  return saved;
}

function collectFileFields(body) {
  return [
    { docType: 'gst', file: body.gstFile, name: body.gstFileName },
    { docType: 'pan', file: body.panFile, name: body.panFileName },
    { docType: 'cheque', file: body.chequeFile, name: body.chequeFileName },
    { docType: 'msme', file: body.msmeFile, name: body.msmeFileName },
    { docType: 'kyc', file: body.kycFile, name: body.kycFileName },
    { docType: 'msme_declaration', file: body.msmeDeclarationFile, name: body.msmeDeclarationFileName },
  ];
}

async function saveBodyDocuments(vendorId, body) {
  const errors = [];
  for (const { docType, file, name } of collectFileFields(body)) {
    if (!file || !name) continue;
    try {
      await upsertVendorDocument(vendorId, docType, name, file);
    } catch (err) {
      errors.push(`${docType}: ${err.message || 'save failed'}`);
    }
  }
  if (errors.length) {
    throw new Error(`Vendor saved, but documents did not store: ${errors.join('; ')}`);
  }
}

export async function uploadVendorDocument(vendorId, body = {}) {
  let docType = String(body.docType || '').trim();
  const fileName = body.fileName || body.name;
  const file = body.file || body.data || body.fileData || body.base64;
  const linkOnly =
    body.linkOnly === true ||
    body.reuseGcs === true ||
    String(body.linkOnly || '').trim() === '1';

  if (!fileName) throw new Error('File name is required');
  if (!linkOnly && !file) throw new Error('File and file name are required');

  if (!docType || docType === 'auto' || docType === 'all') {
    docType = inferVendorDocType(fileName);
  }
  if (!isAllowedDocType(docType)) throw new Error('Invalid document type');

  const [rows] = await pool.query(`SELECT id FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) throw new Error('Vendor not found');

  const saved = await upsertVendorDocument(vendorId, docType, fileName, file, { linkOnly });
  const vendor = await getVendorById(vendorId);
  return { ...vendor, _uploadMeta: { reused: Boolean(saved?.reused), filePath: saved?.filePath } };
}

export async function listVendors({ search, includeInactive = false, page, limit } = {}) {
  let where = includeInactive ? `WHERE 1=1` : `WHERE status = 'active'`;
  const params = [];

  if (search?.trim()) {
    where += ` AND (name LIKE ? OR email LIKE ? OR vendor_code LIKE ? OR category LIKE ? OR contact_name LIKE ?)`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q, q);
  }

  const pageNum = page != null ? Math.max(1, Number(page) || 1) : null;
  const pageSize = limit != null ? Math.min(100, Math.max(1, Number(limit) || 10)) : null;

  let stats = null;
  let pagination = null;

  if (pageNum != null && pageSize != null) {
    const [countRows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN vendor_type = 'Company' THEN 1 ELSE 0 END) AS company,
         SUM(CASE WHEN vendor_type = 'Individual' THEN 1 ELSE 0 END) AS individual
       FROM vendors ${where}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(pageNum, totalPages);
    stats = {
      total,
      company: Number(countRows[0]?.company || 0),
      individual: Number(countRows[0]?.individual || 0),
    };
    pagination = {
      page: safePage,
      limit: pageSize,
      total,
      totalPages,
    };

    const offset = (safePage - 1) * pageSize;
    const [rows] = await pool.query(
      `SELECT * FROM vendors ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return { data: await attachDocumentsToVendors(rows.map((row) => mapVendor(row))), pagination, stats };
  }

  const [rows] = await pool.query(
    `SELECT * FROM vendors ${where} ORDER BY created_at DESC`,
    params
  );
  return { data: await attachDocumentsToVendors(rows.map((row) => mapVendor(row))), pagination, stats };
}

export async function createVendor(user, body) {
  const name = body.vendorName?.trim() || body.name?.trim();
  const email = body.email?.trim();

  if (!name) throw new Error('Vendor name is required');
  if (!email) throw new Error('Email is required');

  const allowDuplicateEmail = body.allowDuplicateEmail === true;
  if (!allowDuplicateEmail) {
    const [existing] = await pool.query(`SELECT id FROM vendors WHERE LOWER(email) = LOWER(?)`, [email]);
    if (existing.length) throw new Error('A vendor with this email already exists');
  }

  const msme = String(body.msme || '').trim() || null;
  let preferredCode = String(body.vendorCode || '').trim();
  let result;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const vendorCode = preferredCode || await generateVendorCode();
    preferredCode = '';
    try {
      [result] = await pool.query(
    `INSERT INTO vendors (
      vendor_code, name, vendor_type, gst_number, pan_number, email, phone, address,
      category, contact_name, msme, msme_type, documents_complete,
      account_number, ifsc_code, bank_name, branch, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      vendorCode,
      name,
      body.vendorType || 'Company',
      body.gstNumber?.trim() || null,
      body.panNumber?.trim() || null,
      email,
      body.phone?.trim() || null,
      body.address?.trim() || null,
      body.category?.trim() || null,
      body.contactName?.trim() || null,
      msme,
      msmeTypeValue(body.msmeType),
      yesNo(body.documentsComplete, 'no'),
      body.accountNumber?.trim() || null,
      body.ifscCode?.trim() || null,
      body.bankName?.trim() || null,
      body.branch?.trim() || null,
      user?.id || null,
    ]
      );
      break;
    } catch (err) {
      const duplicateCode = err?.code === 'ER_DUP_ENTRY' && /vendor_code/i.test(String(err.message || ''));
      if (!duplicateCode || attempt === 4) {
        if (duplicateCode) throw new Error('Could not assign a new vendor code. Try again.');
        throw err;
      }
    }
  }

  const vendorId = result.insertId;
  await saveBodyDocuments(vendorId, body);
  return getVendorById(vendorId);
}

export async function updateVendor(vendorId, body) {
  const [rows] = await pool.query(`SELECT * FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) throw new Error('Vendor not found');

  const name = body.vendorName?.trim() || body.name?.trim();
  const email = body.email?.trim();

  if (!name) throw new Error('Vendor name is required');
  if (!email) throw new Error('Email is required');

  const [existing] = await pool.query(`SELECT id FROM vendors WHERE LOWER(email) = LOWER(?) AND id != ?`, [email, vendorId]);
  if (existing.length && body.allowDuplicateEmail !== true) throw new Error('A vendor with this email already exists');

  const msme = String(body.msme || '').trim() || null;
  await pool.query(
    `UPDATE vendors SET
      name = ?, vendor_type = ?, gst_number = ?, pan_number = ?, email = ?, phone = ?, address = ?,
      category = ?, contact_name = ?, msme = ?, msme_type = ?, documents_complete = ?,
      account_number = ?, ifsc_code = ?, bank_name = ?, branch = ?, updated_at = NOW()
     WHERE id = ?`,
    [
      name,
      body.vendorType || 'Company',
      body.gstNumber?.trim() || null,
      body.panNumber?.trim() || null,
      email,
      body.phone?.trim() || null,
      body.address?.trim() || null,
      body.category?.trim() || null,
      body.contactName?.trim() || null,
      msme,
      msmeTypeValue(body.msmeType),
      yesNo(body.documentsComplete, 'no'),
      body.accountNumber?.trim() || null,
      body.ifscCode?.trim() || null,
      body.bankName?.trim() || null,
      body.branch?.trim() || null,
      vendorId,
    ]
  );

  await saveBodyDocuments(vendorId, body);
  return getVendorById(vendorId);
}

export async function deleteVendor(vendorId) {
  const [rows] = await pool.query(`SELECT id, vendor_code, name FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) throw new Error('Vendor not found');
  await pool.query(`DELETE FROM vendor_documents WHERE vendor_id = ?`, [vendorId]);
  try {
    await pool.query(`DELETE FROM vendors WHERE id = ?`, [vendorId]);
  } catch (err) {
    if (err?.errno === 1451 || err?.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new Error('This vendor is already used on a request or quotation and cannot be deleted');
    }
    throw err;
  }
  return { id: Number(vendorId), vendorCode: rows[0].vendor_code, name: rows[0].name };
}

export async function getVendorById(vendorId) {
  const [rows] = await pool.query(`SELECT * FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) return null;
  const documents = await getVendorDocuments(vendorId);
  return mapVendor(rows[0], documents);
}

export async function getVendorDocumentFile(vendorId, docType) {
  const type = decodeURIComponent(String(docType || '').trim());
  if (!isAllowedDocType(type)) throw new Error('Invalid document type');

  await ensureFileDataColumn();

  const [rows] = await pool.query(
    `SELECT file_name, file_path, file_data, uploaded_at FROM vendor_documents WHERE vendor_id = ? AND doc_type = ?`,
    [vendorId, type]
  );
  if (!rows.length) throw new Error('Document not found');

  const row = rows[0];
  const fileName = row.file_name || 'document';

  // Latest upload bytes in DB are authoritative for View / Download
  if (row.file_data && (Buffer.isBuffer(row.file_data) ? row.file_data.length : row.file_data.length)) {
    const buffer = Buffer.isBuffer(row.file_data) ? row.file_data : Buffer.from(row.file_data);
    return { fullPath: null, fileName, buffer };
  }

  if (gcsEnabled() && row.file_path) {
    const buf = await downloadFromGcs(`vendor-kyc/${path.basename(String(row.file_path))}`);
    if (buf?.length) return { fullPath: null, fileName, buffer: buf };
  }

  const fullPath = path.join(VENDOR_UPLOAD_DIR, row.file_path || '');
  if (row.file_path && fs.existsSync(fullPath)) {
    const buffer = fs.readFileSync(fullPath);
    try {
      await pool.query(
        `UPDATE vendor_documents SET file_data = ? WHERE vendor_id = ? AND doc_type = ?`,
        [buffer, vendorId, type]
      );
    } catch (err) {
      console.warn('Vendor document DB backfill skipped:', err.message);
    }
    return { fullPath, fileName, buffer };
  }

  throw new Error(
    'This document is missing after deployment. Open Edit Vendor and re-upload the file.'
  );
}

const VENDOR_HEADERS = [
  'vendorCode',
  'name',
  'vendorType',
  'email',
  'phone',
  'contactName',
  'gstNumber',
  'panNumber',
  'address',
  'category',
  'msme',
  'msmeType',
  'documentsComplete',
  'accountNumber',
  'ifscCode',
  'bankName',
  'branch',
  'status',
];

export async function exportVendorsCsv() {
  const { data: rows } = await listVendors({ includeInactive: true });
  return rowsToCsv(
    VENDOR_HEADERS,
    rows.map((r) => ({
      vendorCode: r.vendorCode,
      name: r.name,
      vendorType: r.vendorType,
      email: r.email,
      phone: r.phone,
      contactName: r.contactName,
      gstNumber: r.gstNumber,
      panNumber: r.panNumber,
      address: r.address,
      category: r.category,
      msme: r.msme,
      msmeType: r.msmeType,
      documentsComplete: r.documentsComplete,
      accountNumber: r.accountNumber,
      ifscCode: r.ifscCode,
      bankName: r.bankName,
      branch: r.branch,
      status: r.status,
    }))
  );
}

export function getVendorImportTemplateCsv() {
  return rowsToCsv(VENDOR_HEADERS, [
    {
      vendorCode: '',
      name: 'Sample Vendor Pvt Ltd',
      vendorType: 'Company',
      email: 'vendor@example.com',
      phone: '9876543210',
      contactName: 'Rajesh Kumar',
      gstNumber: '',
      panNumber: '',
      address: 'Chennai',
      category: 'IT',
      msme: 'UDYAM-TN-00-0000000',
      msmeType: '',
      documentsComplete: 'no',
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branch: '',
      status: 'active',
    },
  ]);
}

function collapseCsvRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row || {})) {
    const collapsed = String(key || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!collapsed) continue;
    if (out[collapsed] == null || String(out[collapsed]).trim() === '') out[collapsed] = value;
  }
  return out;
}

function clipText(value, max) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.slice(0, max);
}

function compactId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sameVendorName(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function placeholderImportEmail(name, rowNum) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'vendor';
  return `${slug}.row${rowNum}@vendor-import.local`;
}

async function loadVendorCodeState() {
  const year = new Date().getFullYear();
  const prefix = `VND-${year}-`;
  const [rows] = await pool.query(
    `SELECT vendor_code FROM vendors WHERE vendor_code LIKE ?`,
    [`${prefix}%`]
  );
  const used = new Set(rows.map((row) => String(row.vendor_code || '')));
  let next = 1;
  for (const code of used) {
    const match = code.match(/-(\d+)$/);
    if (match) next = Math.max(next, (Number(match[1]) || 0) + 1);
  }
  return { prefix, used, next };
}

function takeVendorCode(state, preferred) {
  const wanted = String(preferred || '').trim();
  if (wanted && !state.used.has(wanted)) {
    state.used.add(wanted);
    return wanted;
  }
  let code = `${state.prefix}${String(state.next).padStart(4, '0')}`;
  while (state.used.has(code)) {
    state.next += 1;
    code = `${state.prefix}${String(state.next).padStart(4, '0')}`;
  }
  state.used.add(code);
  state.next += 1;
  return code;
}

const VENDOR_IMPORT_ALIASES = {
  vendorCode: ['vendorcode', 'code'],
  name: ['name', 'vendorname', 'vendor', 'suppliername', 'companyname'],
  vendorType: ['vendortype', 'type'],
  email: ['email', 'mail', 'emailaddress', 'emailid', 'mailid', 'emailaddresss'],
  phone: ['phone', 'mobile', 'officephone', 'phonenumber', 'mobilenumber', 'alternatephone', 'contactno', 'contactnumber'],
  gstNumber: ['gstnumber', 'gst', 'gstno', 'gstin'],
  panNumber: ['pannumber', 'pan', 'panno'],
  address: ['address', 'registeredaddress', 'officeaddress', 'vendoraddress'],
  category: ['category', 'product'],
  contactName: ['contactname', 'contactperson'],
  msme: ['msme', 'msmeno', 'msmenumber', 'udyam', 'udyamno'],
  msmeType: ['msmetype', 'msmecategory'],
  documentsComplete: ['documentscomplete', 'docscomplete'],
  accountNumber: ['accountnumber', 'account', 'accountno', 'bankaccount'],
  ifscCode: ['ifsccode', 'ifsc'],
  bankName: ['bankname', 'bank'],
  branch: ['branch'],
  status: ['status'],
};

export async function importVendorsFromCsv(user, csvText) {
  const raw = String(csvText || '');
  if (raw.startsWith('PK')) {
    throw new Error('This is an Excel file. Save it as CSV, then import that file.');
  }
  const parsed = parseCsv(raw);
  if (!parsed.length) throw new Error('CSV has no data rows');

  let created = 0;
  let updated = 0;
  const errors = [];
  const codes = await loadVendorCodeState();

  for (let i = 0; i < parsed.length; i++) {
    const rowNum = i + 2;
    const mapped = normalizeHeaderKey(collapseCsvRow(parsed[i]), VENDOR_IMPORT_ALIASES);
    try {
      if (!mapped.name) throw new Error('name is required');
      const emailWasEmpty = !String(mapped.email || '').trim();
      const email = emailWasEmpty ? placeholderImportEmail(mapped.name, rowNum) : clipText(mapped.email, 150);

      const payload = {
        name: clipText(mapped.name, 150),
        vendorName: clipText(mapped.name, 150),
        vendorType: String(mapped.vendorType || '').trim().toLowerCase() === 'individual' ? 'Individual' : 'Company',
        email,
        phone: clipText(mapped.phone, 20),
        gstNumber: compactId(mapped.gstNumber).slice(0, 15),
        panNumber: compactId(mapped.panNumber).slice(0, 10),
        address: clipText(mapped.address, 2000),
        category: clipText(mapped.category, 100),
        contactName: clipText(mapped.contactName, 150),
        msme: clipText(mapped.msme, 150),
        msmeType: mapped.msmeType || '',
        documentsComplete: mapped.documentsComplete || 'no',
        accountNumber: clipText(mapped.accountNumber, 50),
        ifscCode: compactId(mapped.ifscCode).slice(0, 11),
        bankName: clipText(mapped.bankName, 100),
        branch: clipText(mapped.branch, 100),
      };
      const status = String(mapped.status || '').trim().toLowerCase();

      const [existing] = await pool.query(
        `SELECT id, name FROM vendors WHERE LOWER(email) = LOWER(?)`,
        [email]
      );
      const sameName = existing.find((row) => sameVendorName(row.name, payload.name));
      if (sameName) {
        await updateVendor(sameName.id, { ...payload, allowDuplicateEmail: true });
        if (status === 'inactive' || status === 'active') {
          await pool.query(`UPDATE vendors SET status = ? WHERE id = ?`, [status, sameName.id]);
        }
        updated += 1;
      } else {
        const vendorCode = takeVendorCode(codes, mapped.vendorCode);
        const createdVendor = await createVendor(user, {
          ...payload,
          vendorCode,
          allowDuplicateEmail: existing.length > 0,
        });
        if (status === 'inactive') {
          await pool.query(`UPDATE vendors SET status = 'inactive' WHERE id = ?`, [createdVendor.id]);
        }
        created += 1;
      }
    } catch (err) {
      errors.push(`Row ${rowNum}: ${err.message}`);
    }
  }

  return { created, updated, failed: errors.length, errors };
}
