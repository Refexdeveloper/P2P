/** Client-side PO CSV sample + parser for Create PO import (full PO data). */

export const PO_CSV_HEADERS = [
  'prNumber',
  'poNumber',
  'referencePoNumber',
  'vendorName',
  'vendorEmail',
  'poType',
  'entity',
  'deliveryAddress',
  'expectedDeliveryDate',
  'paymentTerms',
  'incoterms',
  'gstPercentage',
  'specialInstructions',
  'letterheadHeader',
  'termsHeader',
  'termsDescription',
  'annexureHeader',
  'annexureDescription',
  'itemName',
  'description',
  'quantity',
  'unitPrice',
  'discount',
  'category',
  'unit',
  'skipApproval',
] as const;

export type PoCsvHeaderKey = (typeof PO_CSV_HEADERS)[number];

export type PoCsvImportPayload = {
  prNumber?: string;
  poNumber?: string;
  referencePoNumber?: string;
  vendorName?: string;
  vendorEmail?: string;
  poType?: 'short_po' | 'long_po';
  entity?: string;
  deliveryAddress?: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  incoterms?: string;
  gstPercentage?: number;
  specialInstructions?: string;
  letterheadHeader?: string;
  termsClauses?: Array<{ termsHeader: string; termsDescription: string }>;
  annexureClauses?: Array<{ termsHeader: string; termsDescription: string }>;
  skipApproval?: boolean;
  lineItems: Array<{
    id: string;
    itemName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    category: string;
    unit?: string;
  }>;
};

export const PO_CSV_COLUMN_LABELS: Record<PoCsvHeaderKey, string> = {
  prNumber: 'PR Number',
  poNumber: 'Old PO Number',
  referencePoNumber: 'Reference PO',
  vendorName: 'Vendor Name',
  vendorEmail: 'Vendor Email',
  poType: 'PO Type',
  entity: 'Entity',
  deliveryAddress: 'Delivery Address',
  expectedDeliveryDate: 'Expected Delivery Date',
  paymentTerms: 'Payment Terms',
  incoterms: 'Incoterms',
  gstPercentage: 'GST %',
  specialInstructions: 'Special Instructions',
  letterheadHeader: 'Letterhead / PO Header',
  termsHeader: 'Terms Header',
  termsDescription: 'Terms Description',
  annexureHeader: 'Annexure Header',
  annexureDescription: 'Annexure Description',
  itemName: 'Item Name',
  description: 'Item Description',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  discount: 'Discount Amt',
  category: 'Category',
  unit: 'Unit',
  skipApproval: 'Skip Approval (Y/N)',
};

export const PO_CSV_SAMPLE_ROWS: Array<Record<PoCsvHeaderKey, string>> = [
  {
    prNumber: 'PR-2026-0001',
    poNumber: 'PO-OLD-2024-001',
    referencePoNumber: '',
    vendorName: 'Global Supplies Inc',
    vendorEmail: 'vendor@example.com',
    poType: 'short_po',
    entity: 'Refex Industries',
    deliveryAddress: 'Plot No. 42, Industrial Area Phase II, Chandigarh - 160002',
    expectedDeliveryDate: '2026-09-15',
    paymentTerms: 'Net 30 Days',
    incoterms: 'DDP',
    gstPercentage: '18',
    specialInstructions: 'Deliver during business hours',
    letterheadHeader: 'PURCHASE ORDER',
    termsHeader: 'Payment Terms',
    termsDescription: 'Payment within 30 days of invoice acceptance',
    annexureHeader: 'Scope of Work',
    annexureDescription: 'As per attached technical specification',
    itemName: 'Laptop Dell Latitude 5540',
    description: 'Business laptop with 16GB RAM',
    quantity: '2',
    unitPrice: '55000',
    discount: '0',
    category: 'IT',
    unit: 'Nos',
    skipApproval: 'Y',
  },
  {
    prNumber: '',
    poNumber: '',
    referencePoNumber: '',
    vendorName: '',
    vendorEmail: '',
    poType: '',
    entity: '',
    deliveryAddress: '',
    expectedDeliveryDate: '',
    paymentTerms: '',
    incoterms: '',
    gstPercentage: '',
    specialInstructions: '',
    letterheadHeader: '',
    termsHeader: 'Delivery Terms',
    termsDescription: 'Delivery at site within agreed lead time',
    annexureHeader: '',
    annexureDescription: '',
    itemName: 'Wireless Mouse',
    description: 'USB optical mouse',
    quantity: '2',
    unitPrice: '800',
    discount: '80',
    category: 'IT',
    unit: 'Nos',
    skipApproval: '',
  },
];

const SAMPLE_ROWS = PO_CSV_SAMPLE_ROWS;

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
  a.download = 'po-import-full-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h: string) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-]+/g, '');
}

type ParsedKey =
  | PoCsvHeaderKey
  | 'description'
  | 'quantity'
  | 'unitPrice'
  | 'category'
  | 'unit';

const HEADER_ALIASES: Record<string, ParsedKey> = {
  prnumber: 'prNumber',
  pr: 'prNumber',
  prno: 'prNumber',
  'pr#': 'prNumber',
  ponumber: 'poNumber',
  po: 'poNumber',
  pono: 'poNumber',
  oldponumber: 'poNumber',
  existingponumber: 'poNumber',
  referenceponumber: 'referencePoNumber',
  referencepo: 'referencePoNumber',
  refpo: 'referencePoNumber',
  vendorname: 'vendorName',
  vendor: 'vendorName',
  vendoremail: 'vendorEmail',
  potype: 'poType',
  type: 'poType',
  entity: 'entity',
  entityname: 'entity',
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
  letterheadheader: 'letterheadHeader',
  letterhead: 'letterheadHeader',
  poheader: 'letterheadHeader',
  termsheader: 'termsHeader',
  termstitle: 'termsHeader',
  termsdescription: 'termsDescription',
  terms: 'termsDescription',
  annexureheader: 'annexureHeader',
  annexuretitle: 'annexureHeader',
  annexuredescription: 'annexureDescription',
  annexure: 'annexureDescription',
  itemname: 'itemName',
  name: 'itemName',
  item: 'itemName',
  description: 'description',
  itemdescription: 'description',
  quantity: 'quantity',
  qty: 'quantity',
  unitprice: 'unitPrice',
  price: 'unitPrice',
  rate: 'unitPrice',
  discount: 'discount',
  disc: 'discount',
  discountpercent: 'discount',
  discpct: 'discount',
  category: 'category',
  unit: 'unit',
  uom: 'unit',
  skipapproval: 'skipApproval',
  legacyimport: 'skipApproval',
  oldpo: 'skipApproval',
  noapproval: 'skipApproval',
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

function firstWith(rows: Record<string, string>[], key: string) {
  return rows.map((r) => r[key]).find((v) => v && String(v).trim()) || '';
}

function collectClauses(
  rows: Record<string, string>[],
  headerKey: string,
  descKey: string
): Array<{ termsHeader: string; termsDescription: string }> {
  const out: Array<{ termsHeader: string; termsDescription: string }> = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const header = String(r[headerKey] || '').trim();
    const desc = String(r[descKey] || '').trim();
    if (!header && !desc) continue;
    const key = `${header}||${desc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ termsHeader: header, termsDescription: desc });
  }
  return out;
}

function normalizePoType(raw: string): 'short_po' | 'long_po' | undefined {
  const v = String(raw || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  if (!v) return undefined;
  if (v === 'long' || v === 'long_po' || v === 'longpo') return 'long_po';
  if (v === 'short' || v === 'short_po' || v === 'shortpo') return 'short_po';
  return undefined;
}

function parseSkipApproval(raw: string): boolean {
  const v = String(raw || '').trim().toLowerCase();
  return ['y', 'yes', 'true', '1', 'skip', 'legacy', 'old'].includes(v);
}

function buildPayloadFromRows(groupRows: Record<string, string>[], gi = 0): PoCsvImportPayload | null {
  const lineItems = groupRows
    .filter((r) => r.itemName || r.description)
    .map((r, index) => {
      const quantity = Math.max(0, Number(r.quantity) || 0);
      const unitPrice = Math.max(0, Number(r.unitPrice) || 0);
      const gross = quantity * unitPrice;
      const discount = Math.min(gross, Math.max(0, Number(r.discount) || 0));
      const itemName = String(r.itemName || r.description || '').trim();
      const description = String(r.description || r.itemName || '').trim();
      return {
        id: `csv-${Date.now()}-${gi}-${index}`,
        itemName,
        description,
        quantity,
        unitPrice,
        discount,
        total: Math.round((gross - discount) * 100) / 100,
        category: r.category || '',
        unit: r.unit || '',
      };
    });
  if (!lineItems.length) return null;

  const gstRaw = firstWith(groupRows, 'gstPercentage');
  const termsClauses = collectClauses(groupRows, 'termsHeader', 'termsDescription');
  const annexureClauses = collectClauses(groupRows, 'annexureHeader', 'annexureDescription');

  return {
    prNumber: firstWith(groupRows, 'prNumber') || undefined,
    poNumber: firstWith(groupRows, 'poNumber') || undefined,
    referencePoNumber: firstWith(groupRows, 'referencePoNumber') || undefined,
    vendorName: firstWith(groupRows, 'vendorName') || undefined,
    vendorEmail: firstWith(groupRows, 'vendorEmail') || undefined,
    poType: normalizePoType(firstWith(groupRows, 'poType')),
    entity: firstWith(groupRows, 'entity') || undefined,
    deliveryAddress: firstWith(groupRows, 'deliveryAddress') || undefined,
    expectedDeliveryDate: firstWith(groupRows, 'expectedDeliveryDate') || undefined,
    paymentTerms: firstWith(groupRows, 'paymentTerms') || undefined,
    incoterms: firstWith(groupRows, 'incoterms') || undefined,
    gstPercentage: gstRaw ? Math.max(0, Number(gstRaw) || 0) : undefined,
    specialInstructions: firstWith(groupRows, 'specialInstructions') || undefined,
    letterheadHeader: firstWith(groupRows, 'letterheadHeader') || undefined,
    termsClauses: termsClauses.length ? termsClauses : undefined,
    annexureClauses: annexureClauses.length ? annexureClauses : undefined,
    skipApproval: parseSkipApproval(firstWith(groupRows, 'skipApproval')),
    lineItems,
  };
}

/** Parse one PO group of CSV rows into a full import payload. */
export function parsePoImportCsv(text: string): PoCsvImportPayload {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSV has no data rows. Download the sample and try again.');
  const payload = buildPayloadFromRows(rows, 0);
  if (!payload) {
    throw new Error('No line items found. CSV needs a description column with at least one item.');
  }
  return payload;
}

/**
 * Parse CSV that may contain multiple POs (grouped by prNumber).
 * Rows without prNumber continue the previous PR group.
 */
export function parseAllPoImportCsv(text: string): PoCsvImportPayload[] {
  const rows = parseCsvRows(text);
  if (!rows.length) throw new Error('CSV has no data rows. Download the sample and try again.');

  const groups: Record<string, string>[][] = [];
  let current: Record<string, string>[] = [];
  let currentPr = '';

  for (const row of rows) {
    const pr = String(row.prNumber || '').trim();
    if (pr && pr !== currentPr) {
      if (current.length) groups.push(current);
      current = [row];
      currentPr = pr;
    } else if (!current.length) {
      current = [row];
      currentPr = pr;
    } else {
      current.push(row);
    }
  }
  if (current.length) groups.push(current);

  const valid = groups
    .map((groupRows, gi) => buildPayloadFromRows(groupRows, gi))
    .filter(Boolean) as PoCsvImportPayload[];
  if (!valid.length) {
    throw new Error('No line items found. CSV needs a description column with at least one item.');
  }
  return valid;
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
