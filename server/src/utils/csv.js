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

function countDelim(line, delim) {
  let n = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === delim) n += 1;
  }
  return n;
}

function detectCsvDelimiter(raw) {
  const header = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^sep=/i.test(line)) || '';
  let best = ',';
  let bestCount = countDelim(header, ',');
  for (const delim of [';', '\t']) {
    const count = countDelim(header, delim);
    if (count > bestCount) {
      best = delim;
      bestCount = count;
    }
  }
  return best;
}

function parseRecords(raw, delim, honorQuotes) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    field = '';
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
    row = [];
  };

  while (i < raw.length) {
    const ch = raw[i];
    if (honorQuotes && inQuotes) {
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
      if ((ch === '\n' || ch === '\r') && raw.slice(i).indexOf('"') === -1) {
        inQuotes = false;
      } else {
        field += ch;
        i += 1;
        continue;
      }
    }

    if (honorQuotes && ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delim) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && raw[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  pushRow();
  return rows;
}

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').replace(/^\s*sep=.\s*\r?\n/i, '').trim();
  if (!raw) return [];

  const delim = detectCsvDelimiter(raw);
  let table = parseRecords(raw, delim, true);
  const quoteCount = (raw.match(/"/g) || []).length;
  if (quoteCount % 2 === 1) {
    const retry = parseRecords(raw, delim, false);
    if (retry.length > table.length) table = retry;
  }
  const rows = table;

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
