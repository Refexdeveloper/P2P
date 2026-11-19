/** Parse New Joiners Laptop Excel (.xlsx/.xls/.csv) into joiner table rows.
 * Matches `RIL - New Joinee.xlsx` columns. Company + Reporting Head are NOT imported —
 * HR fills those in the UI.
 */
import * as XLSX from 'xlsx';

const DEVICE_OPTIONS = ['Laptop', 'Desktop', 'Smartphone / Tab'] as const;

/** Template headers aligned with RIL New Joinee sheet (no Company / Reporting Head). */
export const JOINER_EXCEL_HEADERS = [
  'HR Updated Date',
  'Joining Date',
  'First Name',
  'Last Name',
  'Mobile Number',
  'Designation',
  'Department',
  'LOCATION',
  'HR NAME',
  'ON ROLLS / CONTRACT',
  'EMAIL ID',
  'LAPTOP / DESKTOP',
] as const;

/** Shape matches JoinerRow in NewJoinersLaptopSection */
export type JoinerExcelRow = {
  hrUpdatedDate: string;
  joiningDate: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  designation: string;
  department: string;
  company: string;
  location: string;
  address: string;
  hrName: string;
  reportingHead: string;
  reportingHeadUserId: number | null;
  reportingHeadName: string;
  reportingHeadEmail: string;
  onRollsOrContract: string;
  emailRequired: string;
  deviceTypes: string[];
  deviceType: string;
  linkedRequesterId: number | null;
};

function emptyJoinerRow(): JoinerExcelRow {
  return {
    hrUpdatedDate: '',
    joiningDate: '',
    firstName: '',
    lastName: '',
    mobileNumber: '',
    designation: '',
    department: '',
    company: '',
    location: '',
    address: '',
    hrName: '',
    reportingHead: '',
    reportingHeadUserId: null,
    reportingHeadName: '',
    reportingHeadEmail: '',
    onRollsOrContract: 'On Rolls',
    emailRequired: 'Yes',
    deviceTypes: ['Laptop'],
    deviceType: 'Laptop',
    linkedRequesterId: null,
  };
}

type HeaderKey =
  | 'joiningDate'
  | 'firstName'
  | 'lastName'
  | 'mobileNumber'
  | 'designation'
  | 'department'
  | 'location'
  | 'address'
  | 'hrName'
  | 'onRollsOrContract'
  | 'emailRequired'
  | 'device'
  | 'hrUpdatedDate';

/** Headers we deliberately ignore from Excel (filled manually in UI). */
const SKIP_HEADERS = [
  'company',
  'reporting head email id',
  'reporting head email',
  'reporting head',
  'reporting manager',
  'reporting manager email',
];

const HEADER_ALIASES: Record<HeaderKey, string[]> = {
  joiningDate: ['joining date', 'joiningdate', 'joining_date', 'date of joining', 'doj'],
  firstName: ['first name', 'firstname', 'first_name', 'fname'],
  lastName: ['last name', 'lastname', 'last_name', 'lname'],
  mobileNumber: [
    'mobile number',
    'mobilenumber',
    'mobile_number',
    'mobile',
    'phone',
    'phone number',
    'contact',
  ],
  designation: ['designation', 'designation / role', 'role', 'title'],
  department: ['department', 'dept'],
  location: ['location', 'site', 'city', 'office location'],
  address: ['address', 'full address', 'delivery address', 'shipping address'],
  hrName: ['hr name', 'hrname', 'hr_name'],
  onRollsOrContract: [
    'on rolls / contract',
    'on rolls or contract',
    'rolls / contractor',
    'employment type',
    'onrollsorcontract',
    'on_rolls_or_contract',
    'contractor',
  ],
  emailRequired: [
    'email required',
    'email id',
    'emailid',
    'email_id',
    'email',
    'needs email',
  ],
  device: [
    'device',
    'device type',
    'device types',
    'devicetype',
    'devicetypes',
    'laptop / desktop',
    'laptop/desktop',
    'laptop desktop',
  ],
  hrUpdatedDate: ['hr updated date', 'hrupdateddate', 'hr_updated_date', 'updated date'],
};

function normalizeHeader(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSkippedHeader(header: string): boolean {
  const n = normalizeHeader(header);
  return SKIP_HEADERS.some((s) => n === s || n.includes(s));
}

function resolveHeaderKey(header: string): HeaderKey | null {
  if (isSkippedHeader(header)) return null;
  const n = normalizeHeader(header);
  if (!n) return null;
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [HeaderKey, string[]][]) {
    if (aliases.some((a) => normalizeHeader(a) === n)) return key;
  }
  return null;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

const MONTH_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

/** Excel serial / "1-Nov-2026" / "27-Oct-2026" / ISO → YYYY-MM-DD when possible. */
function toDateInputValue(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // 1-Nov-2026 / 27-Oct-2026 / 01 Nov 2026
  const named = s.match(/^(\d{1,2})[\s\-\/.]+([A-Za-z]+)[\s\-\/.]+(\d{2,4})$/);
  if (named) {
    const dd = named[1].padStart(2, '0');
    const mo = MONTH_MAP[named[2].toLowerCase()];
    const y = named[3].length === 2 ? `20${named[3]}` : named[3];
    if (mo) return `${y}-${mo}-${dd}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${mo}-${d}`;
  }

  // Excel serial as plain number string
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n > 20000 && n < 60000) {
      const parsed = XLSX.SSF.parse_date_code(n);
      if (parsed) {
        const mm = String(parsed.m).padStart(2, '0');
        const dd = String(parsed.d).padStart(2, '0');
        return `${parsed.y}-${mm}-${dd}`;
      }
    }
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return s;
}

function normalizeOnRolls(raw: string): string {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'On Rolls';
  if (s.includes('contract') || s === 'c' || s.includes('contractor')) return 'Contract';
  return 'On Rolls';
}

/** EMAIL ID column may be Yes/No or an actual email address. */
function normalizeEmailRequired(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return 'Yes';
  const lower = s.toLowerCase();
  if (['n', 'no', 'false', '0'].includes(lower)) return 'No';
  if (['y', 'yes', 'true', '1'].includes(lower)) return 'Yes';
  // Actual email → Email ID required = Yes
  if (s.includes('@')) return 'Yes';
  return 'Yes';
}

function parseDevices(raw: string): string[] {
  const s = String(raw || '').trim();
  if (!s) return ['Laptop'];
  const lower = s.toLowerCase();
  // RIL sheet often uses "Yes" under LAPTOP / DESKTOP
  if (['y', 'yes', 'true', '1'].includes(lower)) return ['Laptop'];
  if (['n', 'no', 'false', '0'].includes(lower)) return ['Laptop'];

  const parts = s
    .split(/[,|;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const n = part.toLowerCase().replace(/\s+/g, ' ');
    if (n.includes('smart') || n.includes('phone') || n.includes('tab')) {
      if (!out.includes('Smartphone / Tab')) out.push('Smartphone / Tab');
    } else if (n.includes('desk')) {
      if (!out.includes('Desktop')) out.push('Desktop');
    } else if (n.includes('lap')) {
      if (!out.includes('Laptop')) out.push('Laptop');
    } else {
      const match = DEVICE_OPTIONS.find((d) => d.toLowerCase() === n);
      if (match && !out.includes(match)) out.push(match);
    }
  }
  return out.length ? out : ['Laptop'];
}

function mapRow(raw: Record<string, string>): JoinerExcelRow | null {
  const mapped: Partial<Record<HeaderKey, string>> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = resolveHeaderKey(header);
    if (!key) continue;
    if (mapped[key] == null || mapped[key] === '') mapped[key] = value;
  }

  const firstName = String(mapped.firstName || '').trim();
  const lastName = String(mapped.lastName || '').trim();
  const mobileNumber = String(mapped.mobileNumber || '').replace(/\s+/g, '').trim();
  // Skip completely empty spreadsheet rows
  if (!firstName && !lastName && !mobileNumber && !mapped.joiningDate && !mapped.department) {
    return null;
  }

  const deviceTypes = parseDevices(mapped.device || '');
  const base = emptyJoinerRow();
  return {
    ...base,
    hrUpdatedDate: toDateInputValue(mapped.hrUpdatedDate || '') || base.hrUpdatedDate,
    joiningDate: toDateInputValue(mapped.joiningDate || ''),
    firstName,
    lastName,
    mobileNumber,
    designation: String(mapped.designation || '').trim(),
    department: String(mapped.department || '').trim(),
    // Company + Reporting Head: left blank — HR selects in UI
    company: '',
    location: String(mapped.location || '').trim(),
    address: String(mapped.address || '').trim(),
    hrName: String(mapped.hrName || '').trim(),
    reportingHead: '',
    reportingHeadEmail: '',
    reportingHeadName: '',
    reportingHeadUserId: null,
    onRollsOrContract: normalizeOnRolls(mapped.onRollsOrContract || ''),
    emailRequired: normalizeEmailRequired(mapped.emailRequired || ''),
    deviceTypes,
    deviceType: deviceTypes[0] || 'Laptop',
    linkedRequesterId: null,
  };
}

export async function parseJoinerExcelFile(file: File): Promise<JoinerExcelRow[]> {
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
  const rows: JoinerExcelRow[] = [];
  for (const row of json) {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[String(k).trim()] = cellToString(v);
    }
    const joiner = mapRow(normalized);
    if (joiner) rows.push(joiner);
  }
  return rows;
}

export function isJoinerExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    file.type.includes('spreadsheet') ||
    file.type === 'text/csv'
  );
}

/** Download a blank template matching RIL New Joinee columns (no Company / Reporting). */
export function downloadJoinerExcelTemplate(): void {
  const ws = XLSX.utils.aoa_to_sheet([
    [...JOINER_EXCEL_HEADERS],
    [
      '27-Oct-2026',
      '1-Nov-2026',
      'Priya',
      'Sharma',
      '9876543210',
      'Software Engineer',
      'IT',
      'Chennai',
      'HR Name',
      'On Rolls',
      'Yes',
      'Laptop',
    ],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'New Joiners');
  XLSX.writeFile(wb, 'new-joiners-laptop-template.xlsx');
}
