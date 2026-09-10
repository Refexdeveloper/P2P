/**
 * Bulk-upload vendor documents from folders → Vendor Master (API).
 *
 * STEP 1 — LOCAL (check first):
 *   apiBaseUrl: 'http://localhost:5000'
 *   dryRun: true   → preview
 *   dryRun: false  → upload into local DB
 *
 * STEP 2 — LIVE (after local OK):
 *   apiBaseUrl: 'https://p2p-backend-645830234926.asia-south1.run.app'
 *   dryRun: true again, then false
 *
 * Folder layout:
 *   D:\Vendor_KYC_Export\Vendor_KYC\
 *     3S SOLUTIONS\*.pdf
 *     A B Electricals\*.pdf
 *
 * RUN:
 *   cd d:\P2P\project-8090130\server
 *   node scripts/import-vendor-documents.js
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===================== EDIT THESE VALUES =====================
const CONFIG = {
  // STEP 1 local | STEP 2 live
  apiBaseUrl: 'http://localhost:5000',
  // After deploy, switch to live:
  // apiBaseUrl: 'https://p2p-backend-645830234926.asia-south1.run.app',

  // ROOT folder: each subfolder = one vendor, files inside = documents to upload
  vendorDocsRoot: 'D:\\Vendor_KYC_Export\\Vendor_KYC',

  // Login for that environment (Vendor Master access required)
  authEmail: 'admin@procure.com',
  authPassword: 'demo1234',
  authToken: '', // optional: paste JWT to skip login

  // true = preview only. false = real upload / GCS link.
  dryRun: true,

  // If folder has no match in Vendor Master → create vendor with folder name
  createMissingVendors: true,

  // Skip when vendor already has same file name in Vendor Master DB
  skipExisting: true,

  // If file already in GCS bucket → link path only (no re-upload). Falls back to upload if missing.
  preferGcsLink: true,

  // 'fuzzy' or 'strict' folder↔vendor name matching
  matchMode: 'fuzzy',
};
// =============================================================

const API_BASE_URL = String(process.env.API_BASE_URL || CONFIG.apiBaseUrl || 'http://localhost:5000')
  .trim()
  .replace(/\/$/, '');
const ROOT = String(process.env.VENDOR_DOCS_ROOT || CONFIG.vendorDocsRoot || '').trim();
const DRY_RUN =
  process.env.DRY_RUN != null
    ? String(process.env.DRY_RUN).trim() === '1'
    : Boolean(CONFIG.dryRun);
const CREATE_MISSING =
  process.env.CREATE_MISSING != null
    ? String(process.env.CREATE_MISSING).trim() !== '0'
    : CONFIG.createMissingVendors !== false;
const SKIP_EXISTING =
  process.env.SKIP_EXISTING != null
    ? String(process.env.SKIP_EXISTING).trim() !== '0'
    : CONFIG.skipExisting !== false;
const PREFER_GCS_LINK =
  process.env.PREFER_GCS_LINK != null
    ? String(process.env.PREFER_GCS_LINK).trim() !== '0'
    : CONFIG.preferGcsLink !== false;
const MATCH_MODE =
  String(process.env.MATCH_MODE || CONFIG.matchMode || 'fuzzy').trim().toLowerCase() === 'strict'
    ? 'strict'
    : 'fuzzy';
const AUTH_EMAIL = String(process.env.AUTH_EMAIL || CONFIG.authEmail || '').trim();
const AUTH_PASSWORD = String(process.env.AUTH_PASSWORD || CONFIG.authPassword || '');
const AUTH_TOKEN = String(process.env.AUTH_TOKEN || CONFIG.authToken || '').trim();

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop legal suffixes / M/S so "APAR INDUSTRIES LIMITED" ≈ "Apar Industries Ltd" */
function stripLegalName(value) {
  return normalizeName(value)
    .replace(/\b(m s|messrs)\b/g, ' ')
    .replace(
      /\b(private|pvt|ltd|limited|llp|inc|opc|plc|co|company|corp|corporation)\b/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function compactName(value) {
  return stripLegalName(value).replace(/\s+/g, '');
}

function tokenSet(name) {
  return new Set(stripLegalName(name).split(' ').filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function api(pathname, { method = 'GET', token, body, rawBody } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload = rawBody;
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE_URL}${pathname}`, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg = data?.message || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function login() {
  if (AUTH_TOKEN) return AUTH_TOKEN;
  if (!AUTH_EMAIL || !AUTH_PASSWORD || AUTH_PASSWORD === 'YOUR_PASSWORD_HERE') {
    throw new Error('Edit CONFIG in import-vendor-documents.js: set authEmail + authPassword (or authToken)');
  }
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
  });
  if (!data?.token) throw new Error('Login succeeded but no token returned');
  return data.token;
}

async function fetchAllVendors(token) {
  // No page/limit → full list from backend
  const data = await api('/api/vendors', { token });
  const list = Array.isArray(data?.data) ? data.data : [];
  return list;
}

function emailSlug(name) {
  const base = normalizeName(name).replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 40) || 'vendor';
  return `${base}.${Date.now().toString(36)}@kyc-import.local`;
}

async function createVendorFromFolder(token, folderName) {
  const data = await api('/api/vendors', {
    method: 'POST',
    token,
    body: {
      vendorName: folderName,
      vendorType: 'Company',
      email: emailSlug(folderName),
      documentsComplete: 'no',
    },
  });
  return data?.data || data;
}

function addVendorToIndex(index, vendor) {
  if (!vendor?.name) return;
  const key = normalizeName(vendor.name);
  const strip = stripLegalName(vendor.name);
  const compact = compactName(vendor.name);
  if (key) {
    if (!index.byExact.has(key)) index.byExact.set(key, []);
    index.byExact.get(key).push(vendor);
  }
  if (strip) {
    if (!index.byStrip.has(strip)) index.byStrip.set(strip, []);
    index.byStrip.get(strip).push(vendor);
  }
  if (compact) {
    if (!index.byCompact.has(compact)) index.byCompact.set(compact, []);
    index.byCompact.get(compact).push(vendor);
  }
  index.entries.push({
    vendor,
    key,
    strip,
    compact,
    tokens: tokenSet(vendor.name),
  });
}

function buildVendorIndex(vendors) {
  const byExact = new Map();
  const byStrip = new Map();
  const byCompact = new Map();
  const entries = [];
  for (const v of vendors) {
    const key = normalizeName(v.name);
    const strip = stripLegalName(v.name);
    const compact = compactName(v.name);
    if (!key) continue;
    if (!byExact.has(key)) byExact.set(key, []);
    byExact.get(key).push(v);
    if (strip) {
      if (!byStrip.has(strip)) byStrip.set(strip, []);
      byStrip.get(strip).push(v);
    }
    if (compact) {
      if (!byCompact.has(compact)) byCompact.set(compact, []);
      byCompact.get(compact).push(v);
    }
    entries.push({ vendor: v, key, strip, compact, tokens: tokenSet(v.name) });
  }
  return { byExact, byStrip, byCompact, entries };
}

function pickUnique(list, reason) {
  if (!list?.length) return null;
  if (list.length === 1) return { vendor: list[0], score: 1, reason };
  return { vendor: list[0], score: 1, reason: `${reason}_ambiguous_${list.length}` };
}

function matchVendor(folderName, index) {
  const key = normalizeName(folderName);
  if (!key) return { vendor: null, score: 0, reason: 'empty_folder_name' };

  const exact = pickUnique(index.byExact.get(key), 'exact');
  if (exact) return exact;

  const stripKey = stripLegalName(folderName);
  const stripHit = pickUnique(index.byStrip.get(stripKey), 'strip_legal');
  if (stripHit) return stripHit;

  const compactKey = compactName(folderName);
  const compactHit = pickUnique(index.byCompact.get(compactKey), 'compact');
  if (compactHit) return compactHit;

  if (MATCH_MODE === 'strict') {
    return { vendor: null, score: 0, reason: 'no_exact_match' };
  }

  const folderTokens = tokenSet(folderName);
  let best = null;
  let bestScore = 0;
  for (const entry of index.entries) {
    let score = jaccard(folderTokens, entry.tokens);
    // Containment after stripping spaces / legal words (handles M/S. prefix, extra spaces)
    if (
      stripKey &&
      entry.strip &&
      Math.min(stripKey.length, entry.strip.length) >= 6 &&
      (entry.strip.includes(stripKey) || stripKey.includes(entry.strip))
    ) {
      score = Math.max(score, 0.88);
    }
    if (entry.key.includes(key) || key.includes(entry.key)) {
      score = Math.max(score, 0.82);
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry.vendor;
    }
  }
  if (best && bestScore >= 0.72) {
    return { vendor: best, score: bestScore, reason: 'fuzzy' };
  }
  return { vendor: null, score: bestScore, reason: 'no_match' };
}

function listVendorFolders(root) {
  if (!fs.existsSync(root)) throw new Error(`VENDOR_DOCS_ROOT not found: ${root}`);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({ name: d.name, path: path.join(root, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function looksLikePdf(fullPath) {
  try {
    const fd = fs.openSync(fullPath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === '%PDF-';
  } catch {
    return false;
  }
}

function isUploadableFile(fullPath) {
  const ext = path.extname(fullPath).toLowerCase();
  if (ALLOWED_EXT.has(ext)) return true;
  // Windows may hide ".pdf" in Explorer — still accept real PDFs with no/odd extension
  if (!ext || ext.length > 8) return looksLikePdf(fullPath);
  return false;
}

function listFiles(folderPath) {
  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.'))
    .map((d) => path.join(folderPath, d.name))
    .filter((full) => isUploadableFile(full));
}

/** Ensure upload payload has a usable file name (add .pdf if missing for PDF bytes). */
function uploadFileName(fullPath) {
  const base = path.basename(fullPath);
  if (path.extname(base)) return base;
  if (looksLikePdf(fullPath)) return `${base}.pdf`;
  return base;
}

function fileToBase64(fullPath) {
  const buf = fs.readFileSync(fullPath);
  if (!buf.length) throw new Error('empty file');
  if (buf.length > MAX_FILE_BYTES) throw new Error('file exceeds 10MB');
  return buf.toString('base64');
}

function alreadyHasFile(vendor, fileName) {
  const want = String(fileName || '').trim().toLowerCase();
  return (vendor.documents || []).some((d) => String(d.fileName || '').trim().toLowerCase() === want);
}

async function uploadOne(token, vendorId, filePath) {
  const fileName = uploadFileName(filePath);

  // Live-friendly: if object already in GCS from local import → link only (no re-upload)
  if (PREFER_GCS_LINK) {
    try {
      return await api(`/api/vendors/${vendorId}/documents`, {
        method: 'POST',
        token,
        body: {
          docType: 'auto',
          fileName,
          linkOnly: true,
          reuseGcs: true,
        },
      });
    } catch {
      // not in bucket yet → full upload below
    }
  }

  const file = fileToBase64(filePath);
  return api(`/api/vendors/${vendorId}/documents`, {
    method: 'POST',
    token,
    body: {
      docType: 'auto',
      fileName,
      file,
    },
  });
}

function writeReport(rows) {
  const outDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `vendor-docs-import-${Date.now()}.csv`);
  const header = [
    'folder',
    'matchedVendorId',
    'matchedVendorName',
    'matchScore',
    'matchReason',
    'file',
    'status',
    'message',
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.folder,
        r.matchedVendorId,
        r.matchedVendorName,
        r.matchScore,
        r.matchReason,
        r.file,
        r.status,
        r.message,
      ]
        .map(escape)
        .join(',')
    );
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

async function main() {
  if (!ROOT) {
    console.error('Edit CONFIG.vendorDocsRoot in scripts/import-vendor-documents.js');
    process.exit(1);
  }
  if (!fs.existsSync(ROOT)) {
    console.error(`Folder not found: ${ROOT}`);
    console.error('Edit CONFIG.vendorDocsRoot to the parent folder that contains vendor-named subfolders.');
    process.exit(1);
  }

  console.log('=== Vendor documents bulk import (live API) ===');
  console.log(`API_BASE_URL : ${API_BASE_URL}`);
  console.log(`ROOT        : ${ROOT}`);
  console.log(`DRY_RUN     : ${DRY_RUN ? 'YES (no uploads)' : 'NO (will upload)'}`);
  console.log(`CREATE_MISSING: ${CREATE_MISSING ? 'YES' : 'NO'}`);
  console.log(`SKIP_EXISTING: ${SKIP_EXISTING ? 'YES' : 'NO'}`);
  console.log(`PREFER_GCS_LINK: ${PREFER_GCS_LINK ? 'YES (link if bucket has file)' : 'NO'}`);
  console.log(`MATCH_MODE  : ${MATCH_MODE}`);
  console.log('');

  const token = await login();
  console.log('Logged in OK');

  const vendors = await fetchAllVendors(token);
  console.log(`Loaded ${vendors.length} vendors from Vendor Master`);
  const index = buildVendorIndex(vendors);

  const folders = listVendorFolders(ROOT);
  console.log(`Found ${folders.length} vendor folders`);
  console.log('');

  const report = [];
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let unmatchedFolders = 0;
  let createdVendors = 0;

  for (const folder of folders) {
    let { vendor, score, reason } = matchVendor(folder.name, index);

    if (!vendor && CREATE_MISSING) {
      if (DRY_RUN) {
        createdVendors += 1;
        console.log(`+ WOULD CREATE vendor "${folder.name}" then upload docs`);
        report.push({
          folder: folder.name,
          matchedVendorId: '',
          matchedVendorName: folder.name,
          matchScore: 0,
          matchReason: 'would_create',
          file: '',
          status: 'would_create_vendor',
          message: 'Dry run — vendor would be created',
        });
        const files = listFiles(folder.path);
        for (const filePath of files) {
          skipped += 1;
          report.push({
            folder: folder.name,
            matchedVendorId: '',
            matchedVendorName: folder.name,
            matchScore: 0,
            matchReason: 'would_create',
            file: uploadFileName(filePath),
            status: 'dry_run',
            message: 'Would upload after create',
          });
        }
        continue;
      }

      try {
        vendor = await createVendorFromFolder(token, folder.name);
        addVendorToIndex(index, vendor);
        createdVendors += 1;
        score = 1;
        reason = 'created';
        console.log(`+ CREATED vendor "${vendor.name}" (#${vendor.id})`);
        report.push({
          folder: folder.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchScore: 1,
          matchReason: 'created',
          file: '',
          status: 'vendor_created',
          message: 'Created missing vendor from folder name',
        });
        await sleep(50);
      } catch (err) {
        unmatchedFolders += 1;
        console.error(`✗ CREATE FAILED  folder="${folder.name}": ${err.message}`);
        report.push({
          folder: folder.name,
          matchedVendorId: '',
          matchedVendorName: '',
          matchScore: 0,
          matchReason: 'create_failed',
          file: '',
          status: 'create_failed',
          message: err.message,
        });
        continue;
      }
    }

    if (!vendor) {
      unmatchedFolders += 1;
      console.warn(`✗ NO MATCH  folder="${folder.name}" (${reason})`);
      report.push({
        folder: folder.name,
        matchedVendorId: '',
        matchedVendorName: '',
        matchScore: score,
        matchReason: reason,
        file: '',
        status: 'unmatched_folder',
        message: 'No vendor found in Vendor Master',
      });
      continue;
    }

    const files = listFiles(folder.path);
    console.log(
      `→ ${folder.name}  ⇒  ${vendor.name} (#${vendor.id})  files=${files.length}  match=${reason}/${score.toFixed?.(2) ?? score}`
    );

    if (!files.length) {
      report.push({
        folder: folder.name,
        matchedVendorId: vendor.id,
        matchedVendorName: vendor.name,
        matchScore: score,
        matchReason: reason,
        file: '',
        status: 'empty_folder',
        message: 'No allowed files in folder',
      });
      continue;
    }

    // Refresh vendor docs for skip checks after uploads in this run
    let liveVendor = vendor;

    for (const filePath of files) {
      const fileName = uploadFileName(filePath);
      if (SKIP_EXISTING && alreadyHasFile(liveVendor, fileName)) {
        skipped += 1;
        report.push({
          folder: folder.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchScore: score,
          matchReason: reason,
          file: fileName,
          status: 'skipped_existing',
          message: 'Same fileName already on vendor',
        });
        continue;
      }

      if (DRY_RUN) {
        skipped += 1;
        report.push({
          folder: folder.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchScore: score,
          matchReason: reason,
          file: fileName,
          status: 'dry_run',
          message: 'Would upload',
        });
        continue;
      }

      try {
        const res = await uploadOne(token, vendor.id, filePath);
        liveVendor = res?.data || liveVendor;
        uploaded += 1;
        console.log(`   ✓ ${fileName}`);
        report.push({
          folder: folder.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchScore: score,
          matchReason: reason,
          file: fileName,
          status: 'uploaded',
          message: 'OK',
        });
        await sleep(50);
      } catch (err) {
        failed += 1;
        console.error(`   ✗ ${fileName}: ${err.message}`);
        report.push({
          folder: folder.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchScore: score,
          matchReason: reason,
          file: fileName,
          status: 'failed',
          message: err.message,
        });
      }
    }
  }

  const reportPath = writeReport(report);
  console.log('');
  console.log('=== Summary ===');
  console.log(`Folders        : ${folders.length}`);
  console.log(`Vendors created: ${createdVendors}`);
  console.log(`Unmatched      : ${unmatchedFolders}`);
  console.log(`Uploaded       : ${uploaded}`);
  console.log(`Skipped/dry-run: ${skipped}`);
  console.log(`Failed         : ${failed}`);
  console.log(`Report CSV     : ${reportPath}`);
  if (DRY_RUN) {
    console.log('');
    console.log('Dry run only. Set dryRun: false (or DRY_RUN=0) and run again to upload for real.');
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
