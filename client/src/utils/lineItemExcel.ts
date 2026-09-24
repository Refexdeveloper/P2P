/** Line-item Excel sample / export / import. Item name uses Item Master as a dropdown list. */
import * as XLSX from 'xlsx';
import {
  LINE_ITEM_CSV_HEADERS,
  LINE_ITEM_SAMPLE_ROWS,
  parseLineItemCsv,
  parseLineItemObjectRows,
  type LineItemCsvRow,
} from './lineItemCsv';

function xmlEscape(value: string | number) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function xmlStringCell(value: string | number) {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function xmlNumberCell(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
}

function uniqueItemNames(names: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  names.forEach((raw) => {
    const name = String(raw || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out.sort((a, b) => a.localeCompare(b));
}

function sampleRowsWithMasterNames(itemNames: string[]): LineItemCsvRow[] {
  const names = uniqueItemNames(itemNames);
  if (!names.length) return LINE_ITEM_SAMPLE_ROWS;
  return LINE_ITEM_SAMPLE_ROWS.map((row, i) => ({
    ...row,
    itemName: names[i] || names[0] || row.itemName,
  }));
}

/** SpreadsheetML 2003 so Excel shows an Item Master dropdown on item_name. */
function buildSpreadsheetMl(rows: LineItemCsvRow[], itemNames: string[]) {
  const names = uniqueItemNames(itemNames);
  const dataRows = rows.length ? rows : [{ ...LINE_ITEM_SAMPLE_ROWS[0], itemName: names[0] || '' }];
  const blankRows = Math.max(20, 8);
  const headerCells = LINE_ITEM_CSV_HEADERS.map((h) => xmlStringCell(h)).join('');
  const bodyRows = [
    ...dataRows.map(
      (row) =>
        `<Row>${xmlStringCell(row.itemName)}${xmlStringCell(row.description)}${xmlStringCell(row.category)}${xmlNumberCell(row.quantity)}${xmlStringCell(row.unit)}${xmlNumberCell(row.unitPrice)}${xmlStringCell(row.hsnCode)}${xmlNumberCell(row.gstPercentage)}</Row>`
    ),
    ...Array.from({ length: blankRows }, () => `<Row>${LINE_ITEM_CSV_HEADERS.map(() => '<Cell></Cell>').join('')}</Row>`),
  ].join('');

  const masterRows = [
    `<Row>${xmlStringCell('item_name')}</Row>`,
    ...(names.length
      ? names.map((name) => `<Row>${xmlStringCell(name)}</Row>`)
      : [`<Row>${xmlStringCell('Add items in Item Master')}</Row>`]),
  ].join('');

  const lastMaster = Math.max(2, names.length + 1);
  const lastData = dataRows.length + blankRows + 1;
  const validation = names.length
    ? `<DataValidation xmlns="urn:schemas-microsoft-com:office:excel">
  <Range>R2C1:R${lastData}C1</Range>
  <Type>List</Type>
  <CellRangeList/>
  <Value>ItemMaster!R2C1:R${lastMaster}C1</Value>
</DataValidation>`
    : '';

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="LineItems">
  <Table>
   <Column ss:Width="160"/>
   <Column ss:Width="200"/>
   <Column ss:Width="120"/>
   <Column ss:Width="70"/>
   <Column ss:Width="60"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Row ss:StyleID="header">${headerCells}</Row>
   ${bodyRows}
  </Table>
  ${validation}
 </Worksheet>
 <Worksheet ss:Name="ItemMaster">
  <Table>
   <Column ss:Width="220"/>
   ${masterRows}
  </Table>
 </Worksheet>
</Workbook>`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadLineItemExcelSample(itemNames: string[], filename = 'po-line-items-sample.xls') {
  const xml = buildSpreadsheetMl(sampleRowsWithMasterNames(itemNames), itemNames);
  downloadBlob(filename, new Blob([xml], { type: 'application/vnd.ms-excel' }));
}

export function downloadLineItemExcelExport(
  rows: LineItemCsvRow[],
  itemNames: string[],
  filename = 'po-line-items.xlsx'
) {
  if (!rows.length) {
    downloadLineItemExcelSample(itemNames, filename.replace(/\.xlsx$/i, '.xls'));
    return;
  }
  const names = uniqueItemNames(itemNames);
  const ws = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      item_name: row.itemName,
      description: row.description,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      unit_price: row.unitPrice,
      hsn_code: row.hsnCode,
      gst_percentage: row.gstPercentage,
    }))
  );
  const master = XLSX.utils.aoa_to_sheet([['item_name'], ...names.map((n) => [n])]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LineItems');
  XLSX.utils.book_append_sheet(wb, master, 'ItemMaster');
  XLSX.writeFile(wb, filename);
}

export async function parseLineItemSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    return parseLineItemCsv(await file.text());
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const sheetName =
    workbook.SheetNames.find((s) => !/^item\s*master$/i.test(s)) || workbook.SheetNames[0];
  if (!sheetName) return { rows: [], errors: ['The file has no worksheets'] };
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
    raw: false,
    blankrows: false,
  });
  const objects = json.map((row) => {
    const out: Record<string, string> = {};
    Object.entries(row).forEach(([k, v]) => {
      out[String(k).trim()] = v == null ? '' : String(v).trim();
    });
    return out;
  });
  return parseLineItemObjectRows(objects);
}

export function isLineItemSpreadsheet(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type === 'text/csv'
  );
}
