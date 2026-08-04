/** Client-side PO CSV sample + parser for Create PO import. */

export const PO_CSV_HEADERS = [
  'description',
  'quantity',
  'unitPrice',
  'category',
  'deliveryAddress',
  'expectedDeliveryDate',
  'paymentTerms',
  'incoterms',
  'gstPercentage',
  'specialInstructions',
] as const;

export type PoCsvImportPayload = {
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    category: string;
  }>;
  deliveryAddress?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  incoterms?: string;
  gstPercentage?: number;
  specialInstructions?: string;
};

const SAMPLE_ROWS = [
  {
    description: 'Laptop Dell Latitude 5540',
    quantity: '2',
    unitPrice: '55000',
    category: 'IT',
    deliveryAddress: 'Plot No. 42, Industrial Area Phase II, Chandigarh - 160002',
    expectedDeliveryDate: '2026-09-15',
    paymentTerms: 'Net 30 Days',
    incoterms: 'DDP',
    gstPercentage: '18',
    specialInstructions: 'Deliver during business hours',
  },
  {
    description: 'Wireless Mouse',
    quantity: '2',
    unitPrice: '800',
    category: 'IT',
    deliveryAddress: '',
    expectedDeliveryDate: '',
    paymentTerms: '',
    incoterms: '',
    gstPercentage: '',
    specialInstructions: '',
  },
];

function escapeCsvValue(value: unknown) {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function getPoImportSampleCsv() {
  const lines = [PO_CSV_HEADERS.join(',')];
  for (const row of SAMPLE_ROWS) {
    lines.push(PO_CSV_HEADERS.map((h) => escapeCsvValue(row[h])).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadPoImportSampleCsv() {
  const blob = new Blob([getPoImportSampleCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'po-import-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h: string) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

const HEADER_ALIASES: Record<string, keyof PoCsvImportPayload | 'description' | 'quantity' | 'unitPrice' | 'category'> = {
  description: 'description',
  item: 'description',
  itemname: 'description',
  quantity: 'quantity',
  qty: 'quantity',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  rate: 'unitPrice',
  category: 'category',
  deliveryaddress: 'deliveryAddress',
  address: 'deliveryAddress',
  expecteddeliverydate: 'expectedDeliveryDate',
  deliverydate: 'expectedDeliveryDate',
  paymentterms: 'paymentTerms',
  payment: 'paymentTerms',
  incoterms: 'incoterms',
  gstpercentage: 'gstPercentage',
  gst: 'gstPercentage',
  specialinstructions: 'specialInstructions',
  instructions: 'specialInstructions',
  remarks: 'specialInstructions',
};

function parseCsvRows(text: string): Record<string, string>[] {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  const rows: string[][] = [];
  let i = 0;
  let field = '';
  let row: string[] = [];
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

  const headers = rows[0].map((h) => normalizeHeader(h));
  return rows.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const key = HEADER_ALIASES[header];
      if (!key) return;
      obj[key] = cols[idx] == null ? '' : String(cols[idx]).trim();
    });
    return obj;
  });
}

export function parsePoImportCsv(text: string): PoCsvImportPayload {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSV has no data rows. Download the sample and try again.');

  const lineItems = rows
    .filter((r) => r.description)
    .map((r, index) => {
      const quantity = Math.max(0, Number(r.quantity) || 0);
      const unitPrice = Math.max(0, Number(r.unitPrice) || 0);
      return {
        id: `csv-${Date.now()}-${index}`,
        description: r.description,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        category: r.category || '',
      };
    });

  if (!lineItems.length) {
    throw new Error('No line items found. CSV needs a description column with at least one item.');
  }

  const firstWith = (key: string) => rows.map((r) => r[key]).find((v) => v && String(v).trim()) || '';

  const gstRaw = firstWith('gstPercentage');
  return {
    lineItems,
    deliveryAddress: firstWith('deliveryAddress') || undefined,
    expectedDeliveryDate: firstWith('expectedDeliveryDate') || undefined,
    paymentTerms: firstWith('paymentTerms') || undefined,
    incoterms: firstWith('incoterms') || undefined,
    gstPercentage: gstRaw ? Math.max(0, Number(gstRaw) || 0) : undefined,
    specialInstructions: firstWith('specialInstructions') || undefined,
  };
}

export const PO_CSV_STORAGE_KEY = 'p2p_po_csv_import';

export function storePoCsvImport(payload: PoCsvImportPayload) {
  sessionStorage.setItem(PO_CSV_STORAGE_KEY, JSON.stringify(payload));
}

export function consumePoCsvImport(): PoCsvImportPayload | null {
  const raw = sessionStorage.getItem(PO_CSV_STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PO_CSV_STORAGE_KEY);
  try {
    return JSON.parse(raw) as PoCsvImportPayload;
  } catch {
    return null;
  }
}
