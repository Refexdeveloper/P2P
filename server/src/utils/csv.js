/** Minimal CSV helpers (Excel-compatible). */

export function escapeCsvValue(value) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvValue(row[h])).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  while (i < raw.length) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && raw[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((c) => String(c).trim() !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.some((c) => String(c).trim() !== '')) rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h || '').trim());
  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((header, idx) => {
      if (!header) return;
      obj[header] = cols[idx] == null ? '' : String(cols[idx]).trim();
    });
    return obj;
  });
}

export function normalizeHeaderKey(obj, aliases) {
  const lowerMap = {};
  for (const [k, v] of Object.entries(obj || {})) {
    lowerMap[String(k).trim().toLowerCase().replace(/\s+/g, '')] = v;
  }
  const out = {};
  for (const [target, keys] of Object.entries(aliases)) {
    for (const key of keys) {
      const normalized = key.toLowerCase().replace(/\s+/g, '');
      if (lowerMap[normalized] !== undefined && lowerMap[normalized] !== '') {
        out[target] = lowerMap[normalized];
        break;
      }
    }
  }
  return out;
}
