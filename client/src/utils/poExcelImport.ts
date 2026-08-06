/** Parse PO Excel (.xlsx) / CSV into row objects for the Excel Import API. */
import * as XLSX from 'xlsx';

export const PO_EXCEL_IMPORT_HEADERS = [
  'poNumber',
  'prNumber',
  'vendorName',
  'vendorEmail',
  'deliveryAddress',
  'expectedDeliveryDate',
  'paymentTerms',
  'incoterms',
  'gstPercentage',
  'specialInstructions',
  'poType',
  'entity',
  'description',
  'quantity',
  'unitPrice',
  'category',
  'unit',
] as const;

export type PoExcelImportRow = Record<string, string>;

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

/** Parse first sheet of .xlsx/.xls/.csv into array of objects (header row → keys). */
export async function parsePoExcelFile(file: File): Promise<PoExcelImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('The file has no worksheets');
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  });
  return json.map((row) => {
    const out: PoExcelImportRow = {};
    for (const [k, v] of Object.entries(row)) {
      out[String(k).trim()] = cellToString(v);
    }
    return out;
  });
}

export function isPoExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type === 'text/csv'
  );
}
