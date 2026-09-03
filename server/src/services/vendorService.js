import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import { uploadToGcs, downloadFromGcs, gcsEnabled, useGcsForNewUploads } from './gcsStorage.js';
import { formatDate } from '../utils/constants.js';
import { parseCsv, rowsToCsv, normalizeHeaderKey } from '../utils/csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const VENDOR_UPLOAD_DIR = path.join(__dirname, '../../uploads/vendors');

function ensureVendorDir() {
  if (!fs.existsSync(VENDOR_UPLOAD_DIR)) {
    fs.mkdirSync(VENDOR_UPLOAD_DIR, { recursive: true });
  }
}

const DOC_TYPES = ['gst', 'pan', 'cheque', 'msme', 'kyc', 'msme_declaration'];
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
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM vendors WHERE YEAR(created_at) = ?`,
    [year]
  );
  const seq = String(Number(rows[0].cnt) + 1).padStart(4, '0');
  return `VND-${year}-${seq}`;
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
 * Save vendor document — GCS for new uploads; legacy disk + MySQL blob when GCS is off.
 */
async function saveVendorDocument(vendorId, docType, fileName, base64Data) {
  if (!base64Data || !fileName) return null;

  const originalName = path.basename(String(fileName)).trim();
  if (!originalName) return null;

  const safeName = `${vendorId}_${docType}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const buffer = decodeVendorFile(base64Data);
  if (!buffer.length) {
    throw new Error(`Vendor document ${originalName} is empty or invalid`);
  }
  if (buffer.length > MAX_VENDOR_DOC_BYTES) {
    throw new Error(`Vendor document ${originalName} must be under 10MB`);
  }

  if (useGcsForNewUploads()) {
    await uploadToGcs(`vendor-kyc/${safeName}`, buffer);
    return { fileName: originalName, filePath: safeName, buffer: null };
  }

  try {
    ensureVendorDir();
    fs.writeFileSync(path.join(VENDOR_UPLOAD_DIR, safeName), buffer);
  } catch (err) {
    console.warn('Vendor document disk write skipped (will keep DB copy):', err.message);
  }

  return { fileName: originalName, filePath: safeName, buffer };
}

async function upsertVendorDocument(vendorId, docType, fileName, base64Data) {
  const saved = await saveVendorDocument(vendorId, docType, fileName, base64Data);
  if (!saved) return;

  await ensureFileDataColumn();
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
      await ensureFileDataColumn();
      await pool.query(sql, params);
      return;
    }
    throw err;
  }
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
  const docType = String(body.docType || '').trim();
  if (!DOC_TYPES.includes(docType)) throw new Error('Invalid document type');
  const fileName = body.fileName || body.name;
  const file = body.file || body.data || body.fileData || body.base64;
  if (!file || !fileName) throw new Error('File and file name are required');

  const [rows] = await pool.query(`SELECT id FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) throw new Error('Vendor not found');

  await upsertVendorDocument(vendorId, docType, fileName, file);
  return getVendorById(vendorId);
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

  const [existing] = await pool.query(`SELECT id FROM vendors WHERE email = ?`, [email]);
  if (existing.length) throw new Error('A vendor with this email already exists');

  const vendorCode = await generateVendorCode();

  const msme = String(body.msme || '').trim() || null;
  const [result] = await pool.query(
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

  const [existing] = await pool.query(`SELECT id FROM vendors WHERE email = ? AND id != ?`, [email, vendorId]);
  if (existing.length) throw new Error('A vendor with this email already exists');

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

export async function getVendorById(vendorId) {
  const [rows] = await pool.query(`SELECT * FROM vendors WHERE id = ?`, [vendorId]);
  if (!rows.length) return null;
  const documents = await getVendorDocuments(vendorId);
  return mapVendor(rows[0], documents);
}

export async function getVendorDocumentFile(vendorId, docType) {
  if (!DOC_TYPES.includes(docType)) throw new Error('Invalid document type');

  await ensureFileDataColumn();

  const [rows] = await pool.query(
    `SELECT file_name, file_path, file_data FROM vendor_documents WHERE vendor_id = ? AND doc_type = ?`,
    [vendorId, docType]
  );
  if (!rows.length) throw new Error('Document not found');

  const row = rows[0];
  const fileName = row.file_name || 'document';

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
    if (!useGcsForNewUploads()) {
      try {
        await pool.query(
          `UPDATE vendor_documents SET file_data = ? WHERE vendor_id = ? AND doc_type = ?`,
          [buffer, vendorId, docType]
        );
      } catch (err) {
        console.warn('Vendor document DB backfill skipped:', err.message);
      }
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

export async function importVendorsFromCsv(user, csvText) {
  const parsed = parseCsv(csvText);
  if (!parsed.length) throw new Error('CSV has no data rows');

  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < parsed.length; i++) {
    const rowNum = i + 2;
    const mapped = normalizeHeaderKey(parsed[i], {
      vendorCode: ['vendorcode', 'vendor_code', 'code'],
      name: ['name', 'vendorname', 'vendor'],
      vendorType: ['vendortype', 'vendor_type', 'type'],
      email: ['email', 'mail'],
      phone: ['phone', 'mobile', 'contact'],
      gstNumber: ['gstnumber', 'gst', 'gst_number'],
      panNumber: ['pannumber', 'pan', 'pan_number'],
      address: ['address'],
      category: ['category'],
      contactName: ['contactname', 'contact_name', 'contactperson'],
      msme: ['msme'],
      msmeType: ['msmetype', 'msme_type', 'msmecategory'],
      documentsComplete: ['documentscomplete', 'documents_complete', 'docscomplete'],
      accountNumber: ['accountnumber', 'account_number', 'account'],
      ifscCode: ['ifsccode', 'ifsc', 'ifsc_code'],
      bankName: ['bankname', 'bank', 'bank_name'],
      branch: ['branch'],
      status: ['status'],
    });
    try {
      if (!mapped.name) throw new Error('name is required');
      if (!mapped.email) throw new Error('email is required');

      const payload = {
        name: mapped.name,
        vendorName: mapped.name,
        vendorType: mapped.vendorType === 'Individual' ? 'Individual' : 'Company',
        email: mapped.email,
        phone: mapped.phone || '',
        gstNumber: mapped.gstNumber || '',
        panNumber: mapped.panNumber || '',
        address: mapped.address || '',
        category: mapped.category || '',
        contactName: mapped.contactName || '',
        msme: mapped.msme || '',
        msmeType: mapped.msmeType || '',
        documentsComplete: mapped.documentsComplete || 'no',
        accountNumber: mapped.accountNumber || '',
        ifscCode: mapped.ifscCode || '',
        bankName: mapped.bankName || '',
        branch: mapped.branch || '',
      };

      const [existing] = await pool.query(`SELECT id FROM vendors WHERE email = ?`, [mapped.email]);
      if (existing.length) {
        await updateVendor(existing[0].id, payload);
        if (mapped.status === 'inactive' || mapped.status === 'active') {
          await pool.query(`UPDATE vendors SET status = ? WHERE id = ?`, [mapped.status, existing[0].id]);
        }
        updated += 1;
      } else {
        const createdVendor = await createVendor(user, payload);
        if (mapped.status === 'inactive') {
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
