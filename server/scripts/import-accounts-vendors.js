/**
 * Import / upsert vendors from Accounts (CRM) CSV → Vendor Master.
 *
 * Rules:
 *   - Vendor not in master  → CREATE (name + email + GST / MSME / address / PAN / phone / contact)
 *   - Vendor already exists → UPDATE registered address, GSTIN, MSME number (only when CSV has values)
 *
 * CSV columns used:
 *   Vendor Name, Email Address, Office Phone, Contact Name, PAN NO,
 *   MSME No, Registered Address, GST NO, Product
 *
 * RUN (local first):
 *   cd d:\P2P\project-8090130\server
 *   node scripts/import-accounts-vendors.js
 *
 * Or: npm run vendor:import-accounts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ===================== EDIT THESE VALUES =====================
const CONFIG = {
  // LIVE Vendor Master
  apiBaseUrl: 'https://p2p-backend-645830234926.asia-south1.run.app',
  // Local:
  // apiBaseUrl: 'http://localhost:5000',

  // Accounts export CSV
  csvPath: path.join(__dirname, '../uploads/Accounts-import.csv'),
  // Or use Downloads directly:
  // csvPath: 'C:\\Users\\Sathish Kumar R\\Downloads\\Accounts (2).csv',

  authEmail: 'admin@procure.com',
  authPassword: 'demo1234',
  authToken: '',

  // true = preview only. false = create / update for real.
  dryRun: false,

  // Create vendors that are missing from Vendor Master
  createMissing: true,

  // Update address / GST / MSME on existing matches
  updateExisting: true,

  matchMode: 'fuzzy', // 'fuzzy' | 'strict'
};
// =============================================================

const API_BASE_URL = String(process.env.API_BASE_URL || CONFIG.apiBaseUrl || 'http://localhost:5000')
  .trim()
  .replace(/\/$/, '');
const CSV_PATH = String(process.env.ACCOUNTS_CSV || CONFIG.csvPath || '').trim();
const DRY_RUN =
  process.env.DRY_RUN != null
    ? String(process.env.DRY_RUN).trim() === '1'
    : Boolean(CONFIG.dryRun);
const CREATE_MISSING =
  process.env.CREATE_MISSING != null
    ? String(process.env.CREATE_MISSING).trim() !== '0'
    : CONFIG.createMissing !== false;
const UPDATE_EXISTING =
  process.env.UPDATE_EXISTING != null
    ? String(process.env.UPDATE_EXISTING).trim() !== '0'
    : CONFIG.updateExisting !== false;
const MATCH_MODE =
  String(process.env.MATCH_MODE || CONFIG.matchMode || 'fuzzy').trim().toLowerCase() === 'strict'
    ? 'strict'
    : 'fuzzy';
const AUTH_EMAIL = String(process.env.AUTH_EMAIL || CONFIG.authEmail || '').trim();
const AUTH_PASSWORD = String(process.env.AUTH_PASSWORD || CONFIG.authPassword || '');
const AUTH_TOKEN = String(process.env.AUTH_TOKEN || CONFIG.authToken || '').trim();

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

function cleanText(value) {
  return String(value ?? '').trim();
}

function cleanMsme(value) {
  const v = cleanText(value);
  if (!v) return '';
  if (/^(na|n\/a|nil|none|-)$/i.test(v)) return '';
  return v;
}

function cleanGst(value) {
  return cleanText(value).toUpperCase().replace(/\s+/g, '');
}

function emailSlug(name) {
  const base =
    normalizeName(name).replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '').slice(0, 40) || 'vendor';
  return `${base}.${Date.now().toString(36)}@accounts-import.local`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cur += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    if (c === '\r') continue;
    cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? '';
    });
    return obj;
  });
}

function mapAccountRow(raw) {
  return {
    name: cleanText(raw['Vendor Name'] || raw.name),
    email: cleanText(raw['Email Address'] || raw.email).toLowerCase(),
    phone: cleanText(raw['Office Phone'] || raw['Alternate Phone'] || ''),
    contactName: cleanText(raw['Contact Name'] || ''),
    panNumber: cleanText(raw['PAN NO'] || '').toUpperCase(),
    msme: cleanMsme(raw['MSME No'] || ''),
    address: cleanText(raw['Registered Address'] || ''),
    gstNumber: cleanGst(raw['GST NO'] || ''),
    category: cleanText(raw['Product'] || ''),
    sourceId: cleanText(raw.ID || ''),
  };
}

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
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
    throw new Error(data?.message || text || `HTTP ${res.status}`);
  }
  return data;
}

async function login() {
  if (AUTH_TOKEN) return AUTH_TOKEN;
  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    throw new Error('Set authEmail + authPassword in CONFIG');
  }
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { email: AUTH_EMAIL, password: AUTH_PASSWORD },
  });
  if (!data?.token) throw new Error('Login succeeded but no token returned');
  return data.token;
}

async function fetchAllVendors(token) {
  const data = await api('/api/vendors', { token });
  return Array.isArray(data?.data) ? data.data : [];
}

function buildVendorIndex(vendors) {
  const byExact = new Map();
  const byStrip = new Map();
  const byCompact = new Map();
  const byGst = new Map();
  const byEmail = new Map();
  const entries = [];
  for (const v of vendors) {
    const key = normalizeName(v.name);
    const strip = stripLegalName(v.name);
    const compact = compactName(v.name);
    if (key) {
      if (!byExact.has(key)) byExact.set(key, []);
      byExact.get(key).push(v);
    }
    if (strip) {
      if (!byStrip.has(strip)) byStrip.set(strip, []);
      byStrip.get(strip).push(v);
    }
    if (compact) {
      if (!byCompact.has(compact)) byCompact.set(compact, []);
      byCompact.get(compact).push(v);
    }
    const gst = cleanGst(v.gstNumber);
    if (gst) {
      if (!byGst.has(gst)) byGst.set(gst, []);
      byGst.get(gst).push(v);
    }
    const email = cleanText(v.email).toLowerCase();
    if (email) byEmail.set(email, v);
    entries.push({ vendor: v, key, strip, compact, tokens: tokenSet(v.name) });
  }
  return { byExact, byStrip, byCompact, byGst, byEmail, entries };
}

function pickUnique(list, reason) {
  if (!list?.length) return null;
  if (list.length === 1) return { vendor: list[0], score: 1, reason };
  return { vendor: list[0], score: 1, reason: `${reason}_ambiguous_${list.length}` };
}

function matchVendor(row, index) {
  if (row.email && index.byEmail.has(row.email)) {
    return { vendor: index.byEmail.get(row.email), score: 1, reason: 'email' };
  }
  if (row.gstNumber) {
    const gstHit = pickUnique(index.byGst.get(row.gstNumber), 'gst');
    if (gstHit) return gstHit;
  }

  const key = normalizeName(row.name);
  if (!key) return { vendor: null, score: 0, reason: 'empty_name' };

  const exact = pickUnique(index.byExact.get(key), 'exact');
  if (exact) return exact;

  const stripKey = stripLegalName(row.name);
  const stripHit = pickUnique(index.byStrip.get(stripKey), 'strip_legal');
  if (stripHit) return stripHit;

  const compactHit = pickUnique(index.byCompact.get(compactName(row.name)), 'compact');
  if (compactHit) return compactHit;

  if (MATCH_MODE === 'strict') {
    return { vendor: null, score: 0, reason: 'no_exact_match' };
  }

  const folderTokens = tokenSet(row.name);
  let best = null;
  let bestScore = 0;
  for (const entry of index.entries) {
    let score = jaccard(folderTokens, entry.tokens);
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
  const gst = cleanGst(vendor.gstNumber);
  if (gst) {
    if (!index.byGst.has(gst)) index.byGst.set(gst, []);
    index.byGst.get(gst).push(vendor);
  }
  const email = cleanText(vendor.email).toLowerCase();
  if (email) index.byEmail.set(email, vendor);
  index.entries.push({
    vendor,
    key,
    strip,
    compact,
    tokens: tokenSet(vendor.name),
  });
}

function vendorToUpdatePayload(vendor, patch) {
  return {
    vendorName: vendor.name,
    name: vendor.name,
    vendorType: vendor.vendorType || 'Company',
    email: vendor.email,
    phone: vendor.phone || '',
    gstNumber: patch.gstNumber ?? vendor.gstNumber ?? '',
    panNumber: vendor.panNumber || '',
    address: patch.address ?? vendor.address ?? '',
    category: vendor.category || '',
    contactName: vendor.contactName || '',
    msme: patch.msme ?? vendor.msme ?? '',
    msmeType: vendor.msmeType || '',
    documentsComplete: vendor.documentsComplete || 'no',
    accountNumber: vendor.accountNumber || '',
    ifscCode: vendor.ifscCode || '',
    bankName: vendor.bankName || '',
    branch: vendor.branch || '',
  };
}

function buildCreatePayload(row) {
  return {
    vendorName: row.name,
    name: row.name,
    vendorType: 'Company',
    email: row.email || emailSlug(row.name),
    phone: row.phone || '',
    gstNumber: row.gstNumber || '',
    panNumber: row.panNumber || '',
    address: row.address || '',
    category: row.category || '',
    contactName: row.contactName || '',
    msme: row.msme || '',
    documentsComplete: 'no',
  };
}

function diffUpdateFields(vendor, row) {
  const patch = {};
  const changes = [];
  if (row.address && row.address !== cleanText(vendor.address)) {
    patch.address = row.address;
    changes.push('address');
  }
  if (row.gstNumber && row.gstNumber !== cleanGst(vendor.gstNumber)) {
    patch.gstNumber = row.gstNumber;
    changes.push('gst');
  }
  if (row.msme && row.msme !== cleanMsme(vendor.msme)) {
    patch.msme = row.msme;
    changes.push('msme');
  }
  return { patch, changes };
}

function writeReport(rows) {
  const outDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `accounts-vendors-import-${Date.now()}.csv`);
  const header = [
    'vendorName',
    'matchedVendorId',
    'matchedVendorName',
    'matchReason',
    'status',
    'fields',
    'message',
  ];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [r.vendorName, r.matchedVendorId, r.matchedVendorName, r.matchReason, r.status, r.fields, r.message]
        .map(escape)
        .join(',')
    );
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}

async function main() {
  if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH || '(empty)'}`);
    console.error('Copy Accounts CSV to server/uploads/Accounts-import.csv or set CONFIG.csvPath');
    process.exit(1);
  }

  console.log('=== Accounts CSV → Vendor Master upsert ===');
  console.log(`API_BASE_URL   : ${API_BASE_URL}`);
  console.log(`CSV            : ${CSV_PATH}`);
  console.log(`DRY_RUN        : ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log(`CREATE_MISSING : ${CREATE_MISSING ? 'YES' : 'NO'}`);
  console.log(`UPDATE_EXISTING: ${UPDATE_EXISTING ? 'YES' : 'NO'}`);
  console.log(`MATCH_MODE     : ${MATCH_MODE}`);
  console.log('');

  const token = await login();
  console.log('Logged in OK');

  const rawText = fs.readFileSync(CSV_PATH, 'utf8');
  const accountRows = parseCsv(rawText)
    .map(mapAccountRow)
    .filter((r) => r.name);

  console.log(`Accounts rows  : ${accountRows.length}`);

  const vendors = await fetchAllVendors(token);
  console.log(`Vendor Master  : ${vendors.length}`);
  const index = buildVendorIndex(vendors);
  console.log('');

  const report = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let unmatched = 0;

  for (const row of accountRows) {
    const { vendor, score, reason } = matchVendor(row, index);

    if (vendor) {
      if (!UPDATE_EXISTING) {
        skipped += 1;
        report.push({
          vendorName: row.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchReason: reason,
          status: 'skipped_no_update',
          fields: '',
          message: 'Matched but UPDATE_EXISTING=false',
        });
        continue;
      }

      const { patch, changes } = diffUpdateFields(vendor, row);
      if (!changes.length) {
        skipped += 1;
        console.log(`= ${row.name}  ⇒  ${vendor.name} (#${vendor.id})  no changes`);
        report.push({
          vendorName: row.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchReason: reason,
          status: 'unchanged',
          fields: '',
          message: 'Already has same address/GST/MSME',
        });
        continue;
      }

      if (DRY_RUN) {
        updated += 1;
        console.log(
          `~ WOULD UPDATE ${row.name}  ⇒  ${vendor.name} (#${vendor.id})  fields=${changes.join(',')}`
        );
        report.push({
          vendorName: row.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchReason: reason,
          status: 'would_update',
          fields: changes.join('|'),
          message: `score=${score}`,
        });
        continue;
      }

      try {
        const payload = vendorToUpdatePayload(vendor, {
          address: patch.address ?? vendor.address,
          gstNumber: patch.gstNumber ?? vendor.gstNumber,
          msme: patch.msme ?? vendor.msme,
        });
        const res = await api(`/api/vendors/${vendor.id}`, {
          method: 'PUT',
          token,
          body: payload,
        });
        const updatedVendor = res?.data || { ...vendor, ...patch };
        // refresh index entry values for later GST/email matches
        vendor.address = updatedVendor.address ?? patch.address ?? vendor.address;
        vendor.gstNumber = updatedVendor.gstNumber ?? patch.gstNumber ?? vendor.gstNumber;
        vendor.msme = updatedVendor.msme ?? patch.msme ?? vendor.msme;
        updated += 1;
        console.log(`~ UPDATED ${row.name}  ⇒  ${vendor.name} (#${vendor.id})  fields=${changes.join(',')}`);
        report.push({
          vendorName: row.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchReason: reason,
          status: 'updated',
          fields: changes.join('|'),
          message: 'OK',
        });
        await sleep(40);
      } catch (err) {
        failed += 1;
        console.error(`✗ UPDATE FAIL ${row.name}: ${err.message}`);
        report.push({
          vendorName: row.name,
          matchedVendorId: vendor.id,
          matchedVendorName: vendor.name,
          matchReason: reason,
          status: 'update_failed',
          fields: changes.join('|'),
          message: err.message,
        });
      }
      continue;
    }

    // No match → create
    if (!CREATE_MISSING) {
      unmatched += 1;
      console.warn(`✗ NO MATCH  "${row.name}"`);
      report.push({
        vendorName: row.name,
        matchedVendorId: '',
        matchedVendorName: '',
        matchReason: reason,
        status: 'unmatched',
        fields: '',
        message: 'Not in Vendor Master',
      });
      continue;
    }

    if (DRY_RUN) {
      created += 1;
      console.log(`+ WOULD CREATE "${row.name}"`);
      report.push({
        vendorName: row.name,
        matchedVendorId: '',
        matchedVendorName: row.name,
        matchReason: 'would_create',
        status: 'would_create',
        fields: ['address', 'gst', 'msme', 'pan', 'email', 'phone'].filter((f) => {
          if (f === 'address') return Boolean(row.address);
          if (f === 'gst') return Boolean(row.gstNumber);
          if (f === 'msme') return Boolean(row.msme);
          if (f === 'pan') return Boolean(row.panNumber);
          if (f === 'email') return Boolean(row.email);
          if (f === 'phone') return Boolean(row.phone);
          return false;
        }).join('|'),
        message: 'Dry run',
      });
      continue;
    }

    try {
      const res = await api('/api/vendors', {
        method: 'POST',
        token,
        body: buildCreatePayload(row),
      });
      const createdVendor = res?.data;
      if (createdVendor) addVendorToIndex(index, createdVendor);
      created += 1;
      console.log(`+ CREATED "${createdVendor?.name || row.name}" (#${createdVendor?.id || '?'})`);
      report.push({
        vendorName: row.name,
        matchedVendorId: createdVendor?.id || '',
        matchedVendorName: createdVendor?.name || row.name,
        matchReason: 'created',
        status: 'created',
        fields: 'new',
        message: 'OK',
      });
      await sleep(40);
    } catch (err) {
      failed += 1;
      console.error(`✗ CREATE FAIL "${row.name}": ${err.message}`);
      report.push({
        vendorName: row.name,
        matchedVendorId: '',
        matchedVendorName: '',
        matchReason: 'create_failed',
        status: 'create_failed',
        fields: '',
        message: err.message,
      });
    }
  }

  const reportPath = writeReport(report);
  console.log('');
  console.log('=== Summary ===');
  console.log(`Accounts rows : ${accountRows.length}`);
  console.log(`Created       : ${created}`);
  console.log(`Updated       : ${updated}`);
  console.log(`Unchanged/skip: ${skipped}`);
  console.log(`Unmatched     : ${unmatched}`);
  console.log(`Failed        : ${failed}`);
  console.log(`Report CSV    : ${reportPath}`);
  if (DRY_RUN) {
    console.log('');
    console.log('Dry run only. Set dryRun: false (or DRY_RUN=0) and run again to apply.');
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
