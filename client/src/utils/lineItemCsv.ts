export const LINE_ITEM_CSV_HEADERS = [
  'item_name',
  'description',
  'category',
  'quantity',
  'unit',
  'unit_price',
  'hsn_code',
  'gst_percentage',
] as const;

export type LineItemCsvRow = {
  itemName: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  hsnCode: string;
  gstPercentage: number;
};

const HEADER_ALIASES: Record<string, keyof LineItemCsvRow> = {
  item_name: 'itemName',
  itemname: 'itemName',
  item: 'itemName',
  name: 'itemName',
  description: 'description',
  desc: 'description',
  category: 'category',
  quantity: 'quantity',
  qty: 'quantity',
  unit: 'unit',
  uom: 'unit',
  unit_price: 'unitPrice',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  estimated_cost: 'unitPrice',
  estimatedcost: 'unitPrice',
  hsn_code: 'hsnCode',
  hsncode: 'hsnCode',
  hsn: 'hsnCode',
  gst_percentage: 'gstPercentage',
  gstpercentage: 'gstPercentage',
  gst: 'gstPercentage',
  tax: 'gstPercentage',
  tax_percentage: 'gstPercentage',
  taxpercentage: 'gstPercentage',
};

export const LINE_ITEM_SAMPLE_ROWS: LineItemCsvRow[] = [
  {
    itemName: 'Laptop Dell Latitude',
    description: 'Office laptop i5 16GB RAM',
    category: 'IT Hardware',
    quantity: 2,
    unit: 'Nos',
    unitPrice: 65000,
    hsnCode: '8471',
    gstPercentage: 18,
  },
  {
    itemName: 'A4 Paper Ream',
    description: '75 GSM white copier paper',
    category: 'Stationery',
    quantity: 10,
    unit: 'Box',
    unitPrice: 280,
    hsnCode: '4802',
    gstPercentage: 12,
  },
];

function normalizeHeader(raw: string) {
  return String(raw || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((cell) => cell.trim());
}

function splitCsvRows(text: string): string[] {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toNumber(raw: string, fallback: number) {
  const n = parseFloat(String(raw || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : fallback;
}

export function parseLineItemObjectRows(
  objects: Record<string, string>[]
): { rows: LineItemCsvRow[]; errors: string[] } {
  if (!objects.length) {
    return { rows: [], errors: ['Spreadsheet has no data rows'] };
  }
  const header = LINE_ITEM_CSV_HEADERS.join(',');
  const body = objects.map((obj) => {
    const cells = LINE_ITEM_CSV_HEADERS.map((key) => {
      const aliases = Object.entries(HEADER_ALIASES)
        .filter(([, field]) => {
          const col =
            key === 'item_name'
              ? 'itemName'
              : key === 'unit_price'
                ? 'unitPrice'
                : key === 'hsn_code'
                  ? 'hsnCode'
                  : key === 'gst_percentage'
                    ? 'gstPercentage'
                    : key;
          return field === col;
        })
        .map(([alias]) => alias);
      const rawKey = Object.keys(obj).find((k) => {
        const n = normalizeHeader(k);
        return n === key || aliases.includes(n);
      });
      return csvEscape(rawKey ? obj[rawKey] : '');
    });
    return cells.join(',');
  });
  return parseLineItemCsv([header, ...body].join('\n'));
}

export function parseLineItemCsv(text: string): { rows: LineItemCsvRow[]; errors: string[] } {
  const lines = splitCsvRows(text);
  if (lines.length < 2) {
    return { rows: [], errors: ['CSV needs a header row and at least one data row'] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const mapped = headers.map((h) => HEADER_ALIASES[h] || null);
  if (!mapped.some((key) => key === 'itemName' || key === 'description')) {
    return { rows: [], errors: ['CSV must include item_name or description'] };
  }

  const rows: LineItemCsvRow[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, index) => {
    const cells = parseCsvLine(line);
    const rec: Partial<LineItemCsvRow> = {};
    mapped.forEach((key, i) => {
      if (!key) return;
      const value = cells[i] ?? '';
      if (key === 'quantity' || key === 'unitPrice' || key === 'gstPercentage') {
        (rec as Record<string, number>)[key] = toNumber(value, key === 'quantity' ? 1 : key === 'gstPercentage' ? 18 : 0);
      } else {
        (rec as Record<string, string>)[key] = value;
      }
    });

    const itemName = String(rec.itemName || '').trim();
    const description = String(rec.description || '').trim() || itemName;
    if (!itemName && !description) {
      errors.push(`Row ${index + 2}: missing item name / description`);
      return;
    }

    const quantity = Math.max(0, Number(rec.quantity) || 0);
    if (!(quantity > 0)) {
      errors.push(`Row ${index + 2}: quantity must be greater than 0`);
      return;
    }

    rows.push({
      itemName: itemName || description,
      description,
      category: String(rec.category || '').trim(),
      quantity,
      unit: String(rec.unit || '').trim() || 'Nos',
      unitPrice: Math.max(0, Number(rec.unitPrice) || 0),
      hsnCode: String(rec.hsnCode || '').trim(),
      gstPercentage: Math.min(100, Math.max(0, Number(rec.gstPercentage) || 0)),
    });
  });

  return { rows, errors };
}

export function serializeLineItemCsv(rows: LineItemCsvRow[]): string {
  const header = LINE_ITEM_CSV_HEADERS.join(',');
  const body = rows.map((row) =>
    [
      csvEscape(row.itemName),
      csvEscape(row.description),
      csvEscape(row.category),
      csvEscape(row.quantity),
      csvEscape(row.unit),
      csvEscape(row.unitPrice),
      csvEscape(row.hsnCode),
      csvEscape(row.gstPercentage),
    ].join(',')
  );
  return [header, ...body].join('\n');
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadLineItemSample(filename = 'line-items-sample.csv') {
  downloadTextFile(filename, serializeLineItemCsv(LINE_ITEM_SAMPLE_ROWS));
}

export function downloadLineItemExport(filename: string, rows: LineItemCsvRow[]) {
  downloadTextFile(filename, serializeLineItemCsv(rows));
}

export function stripHtml(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
