import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { useAuth } from '../../../contexts/AuthContext';
import RichTextEditor from '../../../components/base/RichTextEditor';
import AddableSelect from '../../../components/base/AddableSelect';
import {
  poApi,
  prApi,
  poLetterheadApi,
  letterheadMasterApi,
  masterApi,
  vendorApi,
  triggerBlobDownload,
  fileToAttachmentPayload,
  PoType,
  PoLetterheadClause,
  LetterheadMasterRecord,
  LetterheadLocationRecord,
  PoSiteLookupRecord,
  VendorRecord,
  EntityRecord,
} from '../../../services/api';
import ManualPoContextSection, {
  emptyComparisonRound,
  findRecommendedManualQuote,
  hydrateComparisonRoundsFromStored,
  hydrateManualPrDetailsFromStored,
  type ManualPrDetails,
  type ManualComparisonRound,
} from './ManualPoContextSection';
import {
  consumePoCsvImport,
  type PoCsvImportPayload,
} from '../../../utils/poCsvImport';
import PurchaseRequestsPanel from '../purchase-requests/components/PurchaseRequestsPanel';
import SearchCreateField from '../../requester/create-pr/SearchCreateField';
import POApprovalModal from '../po-approval/components/POApprovalModal';
import PostRfqApprovalModal from '../../rfq-approval/components/PostRfqApprovalModal';
import { numberToIndianWords } from '../../../utils/amountInWords';
import {
  AnnexureIiRow,
  emptyAnnexureIiRow,
  parseAnnexureIi,
  serializeAnnexureIi,
  annexureIiRowIsEmpty,
} from '../../../utils/annexureIi';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  CurrencyCode,
  currencySymbol,
  formatMoney,
  normalizeCurrency,
} from '../../../constants/currency';

interface LineItem {
  id: string | number;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  total: number;
  unit?: string;
}

function plainTextFromHtml(html: string) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isQuoteNoHeader(html: string) {
  const text = plainTextFromHtml(html)
    .replace(/\//g, ' ')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!text) return false;
  if (
    /^(quote|quotation|rfq)\s*(no|number)(\s*(date|c))?$/.test(text) ||
    /^ref\s*no(\s*date)?$/.test(text)
  ) {
    return true;
  }
  return /^(quote|rfq|quotation)\s*(no|number)\b/.test(text) && text.length <= 48;
}

/** Free text in Quote No / RFQ No terms description (ignores SugarCRM placeholders). */
function extractQuoteNoFromDescription(html: string): string | null {
  const withoutPlaceholders = String(html || '')
    .replace(/\$aos_quotes_[a-z0-9_]+/gi, ' ')
    .replace(/\$[a-z0-9_]+/gi, ' ');
  const text = plainTextFromHtml(withoutPlaceholders)
    .replace(/^[—–\-]+|[—–\-]+$/g, '')
    .trim();
  if (!text) return null;
  return text;
}

function escapeHtmlText(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripQuoteNoFromTermsClauses(clauses: PoLetterheadClause[]): PoLetterheadClause[] {
  return (clauses || []).filter((clause) => !isQuoteNoHeader(String(clause.termsHeader || '')));
}

function renameRfqHeadersToQuoteNo(clauses: PoLetterheadClause[]): PoLetterheadClause[] {
  return (clauses || []).map((clause) => {
    if (!isQuoteNoHeader(String(clause.termsHeader || ''))) return clause;
    return { ...clause, termsHeader: 'Quote No' };
  });
}

function calcLineTotal(quantity: number, unitPrice: number) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return Math.round(gross * 100) / 100;
}

function calcLineTax(total: number, taxPercentage: number) {
  return Math.round(((Number(total) || 0) * (Number(taxPercentage) || 0)) / 100 * 100) / 100;
}

function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function lineItemUnit(li: { unit?: unknown; uom?: unknown } | Record<string, unknown>) {
  const unit = String(li.unit || li.uom || '').trim();
  return unit || 'Nos';
}

function upsertSiteLookup(list: PoSiteLookupRecord[], item: PoSiteLookupRecord) {
  const rest = list.filter(
    (row) => row.id !== item.id && row.label.trim().toLowerCase() !== item.label.trim().toLowerCase()
  );
  return [item, ...rest];
}

const DEFAULT_SITE_CONTACTS: PoSiteLookupRecord[] = [
  { id: -1, type: 'site_contact', label: 'Sathish Karunanithi', email: 'sathishbabu.k@refex.co.in', phone: '8553656560', status: 'active' },
  { id: -2, type: 'site_contact', label: 'Nirmalantony S', email: 'nirmalantony.s@refex.co.in', phone: '7397783563', status: 'active' },
  { id: -3, type: 'site_contact', label: 'Nambu Santhiya N', email: 'nambu.santhiya@refex.co.in', phone: '8754595292', status: 'active' },
  { id: -4, type: 'site_contact', label: 'Naveen N', email: 'naveen.n@refexfleet.com', phone: '9771127799', status: 'active' },
  { id: -5, type: 'site_contact', label: 'Mohd Sameeuddin', email: 'mohd.sameeuddin@refex.co.in', phone: '7993689327', status: 'active' },
  { id: -6, type: 'site_contact', label: 'Mohd Arif Shaikh', email: 'mohd.arifshaikh@refex.co.in', phone: '9920400371', status: 'active' },
  { id: -7, type: 'site_contact', label: 'Mokthiyar', email: 'mokthiyar.n@refex.co.in', phone: '9844444520', status: 'active' },
  { id: -8, type: 'site_contact', label: 'Arjun Singh', email: 'emco5mw@refex.co.in', phone: '8426895998', status: 'active' },
  { id: -9, type: 'site_contact', label: 'Pushpendra Kumar', email: 'diwana3.25mw@refex.co.in', phone: '9414943645', status: 'active' },
  { id: -10, type: 'site_contact', label: 'Narendra Kumar', email: 'narendra.k@refex.co.in', phone: '9792435433', status: 'active' },
  { id: -11, type: 'site_contact', label: 'Abhilash Ghatage', email: 'abhilash.ag@refex.co.in', phone: '9834684067', status: 'active' },
  { id: -12, type: 'site_contact', label: 'Dhanunjay Patlolla', email: 'dhanunjay.p@refex.co.in', phone: '9043984072', status: 'active' },
  { id: -13, type: 'site_contact', label: 'Suresh Kumar', email: 'sureshkumar.m@refex.co.in', phone: '9782530640', status: 'active' },
  { id: -14, type: 'site_contact', label: 'Nikhil Kumar', email: 'jaipur.cluster.om@refex.co.in', phone: '9837570662', status: 'active' },
  { id: -15, type: 'site_contact', label: 'Jagan Tamilarasu', email: 'jagan.tamilarasu@refex.co.in', phone: '7418635321', status: 'active' },
  { id: -16, type: 'site_contact', label: 'Jaganraj.R', email: 'jaganraj.r@refex.co.in', phone: '8220817153', status: 'active' },
  { id: -17, type: 'site_contact', label: 'Venkatesha', email: 'venkatesha.ncv@refex.co.in', phone: '6381881348', status: 'active' },
  { id: -18, type: 'site_contact', label: 'Praveen', email: 'praveen@vyzagbioenergy.com', phone: '9739841093', status: 'active' },
  { id: -19, type: 'site_contact', label: 'Rajesh Das', email: 'rajeshdas@refex.co.in', phone: '7014049317', status: 'active' },
  { id: -20, type: 'site_contact', label: 'Nitesh Pawar', email: 'nitesh.p@refex.co.in', phone: '7489746407', status: 'active' },
];

const DEFAULT_PROJECT_MANAGERS: PoSiteLookupRecord[] = [
  { id: -101, type: 'project_manager', label: 'Palani', email: 'palani.c@refex.co.in', phone: '9766865267', status: 'active' },
  { id: -102, type: 'project_manager', label: 'Ramesh', email: 'ramesh.c@refex.co.in', phone: '7550048222', status: 'active' },
  { id: -103, type: 'project_manager', label: 'Sarath Kumar', email: 'sharathkumar.b@refex.co.in', phone: '8754444250', status: 'active' },
  { id: -104, type: 'project_manager', label: 'Babu Rathinam', email: 'babu.r@refex.co.in', phone: '9600811102', status: 'active' },
  { id: -105, type: 'project_manager', label: 'Jones Basil T', email: 'jones.t@refex.co.in', phone: '8220920195', status: 'active' },
  { id: -106, type: 'project_manager', label: 'Sangeetha', email: 'sangeetha.r@refex.co.in', phone: '7305394575', status: 'active' },
  { id: -107, type: 'project_manager', label: 'Chinna Ashok Kumar', email: 'chinna.ashok@refex.co.in', phone: '8122504180', status: 'active' },
];

function mergeLookups(defaults: PoSiteLookupRecord[], apiRows: PoSiteLookupRecord[]) {
  const byName = new Map<string, PoSiteLookupRecord>();
  for (const row of defaults) {
    byName.set(row.label.trim().toLowerCase(), row);
  }
  for (const row of apiRows) {
    const key = row.label.trim().toLowerCase();
    const existing = byName.get(key);
    byName.set(key, {
      ...row,
      email: row.email || existing?.email || '',
      phone: row.phone || existing?.phone || '',
    });
  }
  return [...byName.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function mergeSiteContacts(apiRows: PoSiteLookupRecord[]) {
  return mergeLookups(DEFAULT_SITE_CONTACTS, apiRows);
}

function mergeProjectManagers(apiRows: PoSiteLookupRecord[]) {
  return mergeLookups(DEFAULT_PROJECT_MANAGERS, apiRows);
}

const EMPTY_PO_TERMS_DETAILS = {
  paymentTermsText: '',
  siteAddress: '',
  siteContactPerson: '',
  siteContactPhone: '',
  siteContactEmail: '',
  projectManagerHo: '',
  projectManagerContact: '',
  projectManagerEmail: '',
  invoicingAddress: '',
  mailingAddress: '',
  reasonForCancellation: '',
  subject: '',
  quoteNo: '',
  quoteDate: '',
  locationName: '',
  buyerGstNo: '',
  letterheadLocationId: '',
};

function letterheadLocKey(loc: LetterheadLocationRecord, index = 0) {
  if (loc.id != null) return String(loc.id);
  return `name:${loc.location || index}`;
}

function buildInvoicingAddressFromLocation(loc: LetterheadLocationRecord) {
  const parts: string[] = [];
  if (loc.location?.trim()) {
    parts.push(`<p>${loc.location.trim()}</p>`);
  }
  if (loc.gstNo?.trim()) {
    parts.push(`<p>GSTIN: ${loc.gstNo.trim()}</p>`);
  }
  return parts.join('');
}

type PoTermsDetails = typeof EMPTY_PO_TERMS_DETAILS;

/** Quote No is a header field only — strip it from Terms & Conditions before save / preview. */
function withSyncedQuoteNo(
  clauses: PoLetterheadClause[],
  details: PoTermsDetails
): { terms: PoLetterheadClause[]; poTermsDetails: PoTermsDetails; quoteNo: string } {
  const renamed = renameRfqHeadersToQuoteNo(clauses);
  const quoteRow = renamed.find((c) => isQuoteNoHeader(String(c.termsHeader || '')));
  const fromField = String(details.quoteNo || '').trim();
  const fromTerms = extractQuoteNoFromDescription(String(quoteRow?.termsDescription || '')) || '';
  const quoteNo = fromField || fromTerms;
  return {
    terms: stripQuoteNoFromTermsClauses(renamed),
    poTermsDetails: { ...details, quoteNo },
    quoteNo,
  };
}

const INCOTERM_NOT_APPLICABLE = 'Not applicable';

/** Incoterms® 2020 — all 11 ICC rules, plus Not applicable */
const INCOTERMS_OPTIONS = [
  { code: INCOTERM_NOT_APPLICABLE, label: 'Not applicable' },
  { code: 'EXW', label: 'EXW — Ex Works' },
  { code: 'FCA', label: 'FCA — Free Carrier' },
  { code: 'CPT', label: 'CPT — Carriage Paid To' },
  { code: 'CIP', label: 'CIP — Carriage and Insurance Paid To' },
  { code: 'DAP', label: 'DAP — Delivered at Place' },
  { code: 'DPU', label: 'DPU — Delivered at Place Unloaded' },
  { code: 'DDP', label: 'DDP — Delivered Duty Paid' },
  { code: 'FAS', label: 'FAS — Free Alongside Ship (sea)' },
  { code: 'FOB', label: 'FOB — Free on Board (sea)' },
  { code: 'CFR', label: 'CFR — Cost and Freight (sea)' },
  { code: 'CIF', label: 'CIF — Cost, Insurance and Freight (sea)' },
] as const;

function normalizeIncoterm(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return 'DDP';
  const upper = raw.toUpperCase().replace(/[_-]+/g, ' ');
  if (['NA', 'N/A', 'N.A.', 'NOT APPLICABLE'].includes(upper)) {
    return INCOTERM_NOT_APPLICABLE;
  }
  // Map retired DAT (2010) → DPU (2020)
  if (upper === 'DAT' || upper.includes('DAT')) return 'DPU';
  const match = INCOTERMS_OPTIONS.find((o) => {
    if (o.code === INCOTERM_NOT_APPLICABLE) return false;
    return upper === o.code || upper.startsWith(`${o.code} `) || upper.startsWith(`${o.code}-`) || upper.includes(o.code);
  });
  return match?.code || 'DDP';
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toInputDate(value?: unknown): string {
  const s = String(value || '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPoDateLabel(ymd: string) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Gap between doc-type words (spaces, nbsp, or inline tags like </strong>) */
const DOC_WORD_GAP = '((?:\\s|&nbsp;|&#160;|<[^>]*>)*)';

/** Rewrite Purchase Order ↔ Work Order wording in clause / letterhead HTML */
function adaptWordingForDocumentType(
  html: string,
  documentType: 'purchase_order' | 'work_order'
): string {
  if (!html) return html;
  let out = String(html);
  if (documentType === 'work_order') {
    out = out
      .replace(/purchase\s*order\s*\/\s*work\s*order(?:\s*\/\s*service\s*order)?/gi, 'Work Order')
      .replace(/work\s*order\s*\/\s*purchase\s*order/gi, 'Work Order')
      .replace(new RegExp(`PURCHASE${DOC_WORD_GAP}ORDER`, 'g'), 'WORK$1ORDER')
      .replace(new RegExp(`Purchase${DOC_WORD_GAP}Order`, 'g'), 'Work$1Order')
      .replace(new RegExp(`purchase${DOC_WORD_GAP}order`, 'gi'), 'work$1order');
  } else {
    out = out
      .replace(/work\s*order\s*\/\s*purchase\s*order/gi, 'Purchase Order')
      .replace(/purchase\s*order\s*\/\s*work\s*order(?:\s*\/\s*service\s*order)?/gi, 'Purchase Order')
      .replace(new RegExp(`WORK${DOC_WORD_GAP}ORDER`, 'g'), 'PURCHASE$1ORDER')
      .replace(new RegExp(`Work${DOC_WORD_GAP}Order`, 'g'), 'Purchase$1Order')
      .replace(new RegExp(`work${DOC_WORD_GAP}order`, 'gi'), 'purchase$1order');
  }
  out = out.replace(/RFQ\s*No\.?/gi, 'Quote No').replace(/RFQ\s*Number/gi, 'Quote Number');
  return out;
}

function adaptClausesForDocumentType(
  clauses: PoLetterheadClause[],
  documentType: 'purchase_order' | 'work_order'
): PoLetterheadClause[] {
  return renameRfqHeadersToQuoteNo(
    (clauses || []).map((clause) => ({
      ...clause,
      termsHeader: adaptWordingForDocumentType(String(clause.termsHeader || ''), documentType),
      termsDescription: adaptWordingForDocumentType(
        String(clause.termsDescription || ''),
        documentType
      ),
    }))
  );
}

/** Letterhead master embeds "PURCHASE ORDER" — hide/adapt for Work Order preview */
function adaptLetterheadPreviewHtml(html: string, isWorkOrder: boolean) {
  if (!html) return '';
  let out = adaptWordingForDocumentType(html, isWorkOrder ? 'work_order' : 'purchase_order');
  out = out.replace(
    /<p[^>]*>\s*(?:<strong>\s*)?(?:PURCHASE|WORK)\s+ORDER(?:\s*<\/strong>)?\s*<\/p>/gi,
    ''
  );
  return out.trim();
}

const PO_TYPE_OPTIONS_BY_DOC: Record<
  'purchase_order' | 'work_order',
  { id: PoType; label: string }[]
> = {
  purchase_order: [
  { id: 'short_po', label: 'Short PO' },
  { id: 'long_po', label: 'Long PO' },
  ],
  work_order: [
    { id: 'short_wo', label: 'Short WO' },
    { id: 'long_wo', label: 'Long WO' },
  ],
};

function defaultTemplateForDocument(documentType: 'purchase_order' | 'work_order'): PoType {
  return documentType === 'work_order' ? 'short_wo' : 'short_po';
}

function alignTemplateWithDocument(
  poType: PoType,
  documentType: 'purchase_order' | 'work_order'
): PoType {
  const isLong = poType === 'long_po' || poType === 'long_wo';
  if (documentType === 'work_order') return isLong ? 'long_wo' : 'short_wo';
  return isLong ? 'long_po' : 'short_po';
}

function coercePoType(raw: unknown, documentType: 'purchase_order' | 'work_order'): PoType {
  const v = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const allowed: PoType[] = ['short_po', 'long_po', 'short_wo', 'long_wo'];
  const asType = (allowed.includes(v as PoType) ? v : defaultTemplateForDocument(documentType)) as PoType;
  return alignTemplateWithDocument(asType, documentType);
}

function formatEntityLabel(ent: EntityRecord | { id: number; name: string; code: string; costCenter?: string }) {
  const base = ent.code ? `${ent.code} — ${ent.name}` : ent.name;
  const costCenter = 'costCenter' in ent ? ent.costCenter : '';
  return costCenter ? `${base} (${costCenter})` : base;
}

function manualEntityPayload(
  manualEntityId: number | '',
  selected: EntityRecord | null
): { selectedEntityId: number | null; entityId: number | null; entity: string } {
  const id = manualEntityId === '' ? null : Number(manualEntityId);
  return {
    selectedEntityId: id,
    entityId: id,
    entity: id && selected ? String(selected.name || selected.code || '') : '',
  };
}

function matchEntityFromLetterhead(
  letterhead: LetterheadMasterRecord | null,
  options: Array<{ id: number; name: string; code: string }>
) {
  if (!letterhead || !options.length) return null;
  const entityName = String(letterhead.entity || '').trim().toLowerCase();
  const letterheadName = String(letterhead.name || '').trim().toLowerCase();
  return (
    options.find((e) => entityName && e.name.toLowerCase() === entityName) ||
    options.find((e) => letterheadName && e.code.toLowerCase() === letterheadName) ||
    options.find((e) => letterheadName && e.name.toLowerCase() === letterheadName) ||
    options.find((e) => entityName && e.code.toLowerCase() === entityName) ||
    null
  );
}

function normalizeVendorMatchKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(private|limited|pvt|ltd|llp|inc|corp|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchVendorFromMaster(
  vendors: VendorRecord[],
  opts: { name?: string; email?: string; gst?: string }
) {
  const name = normalizeVendorMatchKey(opts.name || '');
  const email = String(opts.email || '').trim().toLowerCase();
  const gst = String(opts.gst || '').replace(/\s+/g, '').toUpperCase();
  if (name) {
    const byName = vendors.find((v) => normalizeVendorMatchKey(v.name) === name);
    if (byName) return byName;
    const byPartial = vendors.find((v) => {
      const vn = normalizeVendorMatchKey(v.name);
      return vn.length > 8 && (vn.includes(name) || name.includes(vn));
    });
    if (byPartial) return byPartial;
  }
  if (gst) {
    const byGst = vendors.find(
      (v) => String(v.gstNumber || '').replace(/\s+/g, '').toUpperCase() === gst
    );
    if (byGst) return byGst;
  }
  if (email) {
    const byEmail = vendors.find((v) => String(v.email || '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  return null;
}

type EditableClauseRow = PoLetterheadClause & { clientKey: string };

function makeClauseClientKey() {
  return `clause-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyClauseRow(): EditableClauseRow {
  return { clientKey: makeClauseClientKey(), termsHeader: '', termsDescription: '' };
}

function toEditableClauseRows(clauses: PoLetterheadClause[]): EditableClauseRow[] {
  if (!clauses.length) return [emptyClauseRow()];
  return clauses.map((clause) => ({
    ...clause,
    clientKey: clause.id ? `db-${clause.id}` : makeClauseClientKey(),
  }));
}

function filterNonEmptyClauses(clauses: PoLetterheadClause[]): PoLetterheadClause[] {
  return clauses
    .filter(
      (clause) =>
        plainTextFromHtml(String(clause.termsHeader || '')) ||
        plainTextFromHtml(String(clause.termsDescription || ''))
    )
    .map((clause, index) => ({ ...clause, sortOrder: index }));
}

function clauseListSignature(clauses: PoLetterheadClause[]) {
  return JSON.stringify(
    (clauses || []).map((c) => [c.id ?? null, c.termsHeader || '', c.termsDescription || '', c.sortOrder ?? null])
  );
}

function ClauseTableEditor({
  title,
  headerColumnLabel,
  descriptionColumnLabel,
  headerPlaceholder,
  descriptionPlaceholder,
  emptyHint,
  clauses,
  onChange,
  onReloadFromMaster,
  reloadDisabled,
  docLabel = 'Purchase Order',
  editorRevision = '',
}: {
  title: string;
  headerColumnLabel: string;
  descriptionColumnLabel: string;
  headerPlaceholder: string;
  descriptionPlaceholder: string;
  emptyHint: string;
  clauses: PoLetterheadClause[];
  onChange: (next: PoLetterheadClause[]) => void;
  onReloadFromMaster?: () => void;
  reloadDisabled?: boolean;
  docLabel?: string;
  /** Bump when document type changes so rich-text editors remount with new wording */
  editorRevision?: string;
}) {
  const [rows, setRows] = useState<EditableClauseRow[]>(() => toEditableClauseRows(clauses));
  const lastExternalSig = useRef(clauseListSignature(clauses));
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  useEffect(() => {
    const sig = clauseListSignature(clauses);
    if (sig === lastExternalSig.current) return;
    lastExternalSig.current = sig;
    const next = toEditableClauseRows(clauses);
    rowsRef.current = next;
    setRows(next);
  }, [clauses]);

  const commit = (nextRows: EditableClauseRow[]) => {
    rowsRef.current = nextRows;
    setRows(nextRows);
    const payload = nextRows.map(({ clientKey: _key, ...clause }, index) => ({
      ...clause,
      sortOrder: index,
    }));
    lastExternalSig.current = clauseListSignature(payload);
    onChange(payload);
  };

  const updateRow = (index: number, patch: Partial<EditableClauseRow>) => {
    commit(rowsRef.current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => commit([...rowsRef.current, emptyClauseRow()]);

  const removeRow = (index: number) => {
    if (rowsRef.current.length <= 1) {
      commit([emptyClauseRow()]);
      return;
    }
    commit(rowsRef.current.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rowsRef.current.length) return;
    const next = [...rowsRef.current];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm w-full">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-200 rounded-full text-gray-500">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
            Rich text · paste keeps bold · shown on {docLabel} PDF
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onReloadFromMaster ? (
            <button
              type="button"
              onClick={onReloadFromMaster}
              disabled={reloadDisabled}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reload from Master
            </button>
          ) : null}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
          >
            <i className="ri-add-line"></i>
            Add Row
          </button>
        </div>
      </div>

      {!clauses.length ? (
        <p className="px-5 pt-3 text-xs text-gray-400 italic">{emptyHint}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-white border-b border-gray-100">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3 w-[280px]">{headerColumnLabel}</th>
              <th className="px-5 py-3">{descriptionColumnLabel}</th>
              <th className="px-5 py-3 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.clientKey} className="border-b border-gray-50 align-top hover:bg-gray-50/40">
                <td className="px-5 py-4 text-sm text-gray-400">{index + 1}</td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">Header</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-header-${editorRevision}`}
                    value={row.termsHeader || ''}
                    onChange={(html) => updateRow(index, { termsHeader: html })}
                    placeholder={headerPlaceholder}
                    minHeight={72}
                    advanced
                  />
                </td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-desc-${editorRevision}`}
                    value={row.termsDescription || ''}
                    onChange={(html) => updateRow(index, { termsDescription: html })}
                    placeholder={descriptionPlaceholder}
                    minHeight={120}
                    advanced
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-1 pt-5">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <i className="ri-arrow-up-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <i className="ri-arrow-down-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      title="Remove row"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type EditableAnnexureIiRow = AnnexureIiRow & { clientKey: string };

function toEditableAnnexureIiRows(rows: AnnexureIiRow[]): EditableAnnexureIiRow[] {
  const list = rows?.length ? rows : [emptyAnnexureIiRow()];
  return list.map((row) => ({
    ...emptyAnnexureIiRow(),
    ...row,
    clientKey: makeClauseClientKey(),
  }));
}

function AnnexureIiTableEditor({
  title,
  rows,
  onChange,
  docLabel = 'Purchase Order',
  editorRevision = '',
}: {
  title: string;
  rows: AnnexureIiRow[];
  onChange: (next: AnnexureIiRow[]) => void;
  docLabel?: string;
  editorRevision?: string;
}) {
  const [localRows, setLocalRows] = useState<EditableAnnexureIiRow[]>(() => toEditableAnnexureIiRows(rows));
  const lastSig = useRef(serializeAnnexureIi(rows));
  const localRowsRef = useRef(localRows);
  localRowsRef.current = localRows;

  useEffect(() => {
    const sig = serializeAnnexureIi(rows);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    const next = toEditableAnnexureIiRows(rows.length ? rows : [emptyAnnexureIiRow()]);
    localRowsRef.current = next;
    setLocalRows(next);
  }, [rows]);

  const commit = (next: EditableAnnexureIiRow[]) => {
    localRowsRef.current = next;
    setLocalRows(next);
    const payload = next.map(({ clientKey: _key, ...row }) => row);
    lastSig.current = serializeAnnexureIi(payload);
    onChange(payload);
  };

  const updateRow = (index: number, patch: Partial<AnnexureIiRow>) => {
    commit(localRowsRef.current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () =>
    commit([...localRowsRef.current, { ...emptyAnnexureIiRow(), clientKey: makeClauseClientKey() }]);

  const removeRow = (index: number) => {
    if (localRowsRef.current.length <= 1) {
      commit([{ ...emptyAnnexureIiRow(), clientKey: makeClauseClientKey() }]);
      return;
    }
    commit(localRowsRef.current.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= localRowsRef.current.length) return;
    const next = [...localRowsRef.current];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm w-full">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-200 rounded-full text-gray-500">
            {localRows.length} row{localRows.length !== 1 ? 's' : ''}
          </span>
          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
            Each row = one {docLabel} PDF page
          </span>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
        >
          <i className="ri-add-line"></i>
          Add Row
        </button>
      </div>
      <p className="px-5 pt-3 text-xs text-gray-500">
        Add technical data, scope, specifications, and images. Use Add Row for another page. Formatting is kept on save, preview, and PDF.
      </p>
      <div className="divide-y divide-gray-100">
        {localRows.map((row, index) => (
          <div key={row.clientKey} className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Row {index + 1} · PDF page
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveRow(index, -1)}
                  disabled={index === 0}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <i className="ri-arrow-up-line"></i>
                </button>
                <button
                  type="button"
                  onClick={() => moveRow(index, 1)}
                  disabled={index === localRows.length - 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <i className="ri-arrow-down-line"></i>
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                  title="Remove row"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Header</label>
              <RichTextEditor
                editorKey={`${row.clientKey}-h-${editorRevision}`}
                value={row.header || ''}
                onChange={(html) => updateRow(index, { header: html })}
                placeholder="e.g. Technical specification / Scope of work"
                minHeight={56}
                advanced
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description, images &amp; text</label>
              <RichTextEditor
                editorKey={`${row.clientKey}-d-${editorRevision}`}
                value={row.description || ''}
                onChange={(html) => updateRow(index, { description: html })}
                placeholder="Add formatted text and images for this page..."
                minHeight={180}
                advanced
                allowImages
              />
            </div>
        </div>
      ))}
      </div>
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 border border-dashed border-teal-300 rounded-lg hover:bg-teal-50 cursor-pointer"
        >
          <i className="ri-add-line"></i>
          Add another row
        </button>
      </div>
    </div>
  );
}

export default function CreatePOPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const prIdParam = searchParams.get('prId');
  const poIdParam = searchParams.get('poId');
  const refPoParam = searchParams.get('refPo');
  const fromCsvParam = searchParams.get('from');
  const numericPrId = prIdParam ? Number(prIdParam) : null;
  const editPoId = poIdParam ? Number(poIdParam) : null;
  const isEditMode = !!editPoId && !Number.isNaN(editPoId);
  const isManualMode =
    !isEditMode &&
    !numericPrId &&
    (searchParams.get('manual') === '1' || searchParams.get('mode') === 'manual-no-pr');
  const [manualPoNoPr, setManualPoNoPr] = useState(
    searchParams.get('manual') === '1' || searchParams.get('mode') === 'manual-no-pr'
  );
  const isManualPoFlow = isManualMode || manualPoNoPr;
  const fromParam = searchParams.get('from');
  const editReturnPath =
    fromParam === 'buyer-verify'
      ? '/scm/buyer-final-verify'
      : fromParam === 'tasks'
        ? '/tasks'
        : fromParam === 'purchase-requests' || fromParam === 'create-po' || fromParam === 'csv'
          ? '/scm/create-po'
          : fromParam === 'po-approval'
            ? '/scm/po-approval'
            : '/scm/po-approval';
  const isBuyerVerifyEdit = searchParams.get('from') === 'buyer-verify';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pr, setPr] = useState<{
    id: number;
    prNumber: string;
    title: string;
    department: string;
    entityId?: number | null;
    entityName?: string;
    entityCode?: string;
    requester: string;
    recommendedVendor: string;
    vendorEmail: string;
    lineItems: Array<{ id: number; description: string; quantity: number; unitPrice: number; category?: string; unit?: string }>;
    requiredDate?: string;
    amount?: number;
    requestType?: string;
    purchaseType?: 'purchase_order' | 'work_order';
    purchaseTypeLabel?: string;
    priority?: string;
    currency?: CurrencyCode;
  } | null>(null);

  const [poNumber, setPoNumber] = useState('');
  const handlePoNumberChange = (value: string) => {
    setPoNumber(value.replace(/[\r\n\t]/g, '').slice(0, 40));
  };
  const [referencePoNumber, setReferencePoNumber] = useState('');
  const [referencePoLoading, setReferencePoLoading] = useState(false);
  const [referencePoError, setReferencePoError] = useState('');
  const [referencePoLoaded, setReferencePoLoaded] = useState<{
    poNumber: string;
    vendorName: string;
    prNumber: string;
    grandTotal: number;
  } | null>(null);
  const [createdPoId, setCreatedPoId] = useState<number | null>(null);
  const [vendorMeta, setVendorMeta] = useState({
    name: '',
    email: '',
    quotedPrice: 0,
    leadTime: 30,
    paymentTerms: 'Net 30 Days',
    overallScore: 85,
    technicalScore: 85,
    commercialScore: 85,
    compliance: 'Yes',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [poDate, setPoDate] = useState(todayYmd);
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [incoterms, setIncoterms] = useState('DDP');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const moneySymbol = currencySymbol(currency);
  /** Effective GST % derived from line taxes (stored on PO for compatibility) */
  const [gstPercentage, setGstPercentage] = useState(18);
  const [poType, setPoType] = useState<PoType>('short_po');
  /** Document type for this PO create — can differ from PR default */
  const [documentType, setDocumentType] = useState<'purchase_order' | 'work_order'>('purchase_order');
  const [letterheadHeader, setLetterheadHeader] = useState('');
  const [letterheadOptions, setLetterheadOptions] = useState<LetterheadMasterRecord[]>([]);
  const [letterheadId, setLetterheadId] = useState<number | ''>('');
  const [letterheadLocationKey, setLetterheadLocationKey] = useState('');
  const [locationGstNo, setLocationGstNo] = useState('');
  const [entity, setEntity] = useState('');
  const [headerLogo, setHeaderLogo] = useState('');
  const [footerLogo, setFooterLogo] = useState('');
  const [termsClauses, setTermsClauses] = useState<PoLetterheadClause[]>([]);
  const [annexureClauses, setAnnexureClauses] = useState<PoLetterheadClause[]>([]);
  const [annexureIiRows, setAnnexureIiRows] = useState<AnnexureIiRow[]>([emptyAnnexureIiRow()]);
  const [poTermsDetails, setPoTermsDetails] = useState<PoTermsDetails>({ ...EMPTY_PO_TERMS_DETAILS });
  const [siteAddressOptions, setSiteAddressOptions] = useState<PoSiteLookupRecord[]>([]);
  const [siteContactOptions, setSiteContactOptions] = useState<PoSiteLookupRecord[]>(DEFAULT_SITE_CONTACTS);
  const [projectManagerOptions, setProjectManagerOptions] = useState<PoSiteLookupRecord[]>(DEFAULT_PROJECT_MANAGERS);
  const [addingSiteAddress, setAddingSiteAddress] = useState(false);
  const [addingSiteContact, setAddingSiteContact] = useState(false);
  const [addingProjectManager, setAddingProjectManager] = useState(false);
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteContact, setNewSiteContact] = useState({ label: '', email: '', phone: '' });
  const [newProjectManager, setNewProjectManager] = useState({ label: '', email: '', phone: '' });
  const [savingSiteLookup, setSavingSiteLookup] = useState(false);
  const [siteLookupError, setSiteLookupError] = useState('');
  const [letterheadLoading, setLetterheadLoading] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState('');
  const [loadedTemplate, setLoadedTemplate] = useState<{
    poType: PoType;
    title: string;
    termsCount: number;
    annexureCount: number;
  } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showScmConfirm, setShowScmConfirm] = useState(false);
  const [managerModal, setManagerModal] = useState<'sendback' | 'reject' | null>(null);
  const [showBuyerSendBack, setShowBuyerSendBack] = useState(false);
  const [scmManager, setScmManager] = useState<{ name: string; email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'lineItems' | 'terms' | 'preview'>('details');
  const [draftSaved, setDraftSaved] = useState(false);
  const [poEditStatus, setPoEditStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pageMode, setPageMode] = useState<'form' | 'pdf'>('form');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewHtmlUrl, setPreviewHtmlUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [letterheadLocked, setLetterheadLocked] = useState(false);
  const manualEntryParam =
    searchParams.get('manual') === '1' || searchParams.get('mode') === 'manual-no-pr';
  const [skipApproval, setSkipApproval] = useState(
    manualEntryParam || searchParams.get('legacy') === '1' || searchParams.get('skipApproval') === '1'
  );
  const [importedPoNumber, setImportedPoNumber] = useState('');
  const [importedVendorName, setImportedVendorName] = useState('');
  const [importedVendorEmail, setImportedVendorEmail] = useState('');
  const [manualEntityId, setManualEntityId] = useState<number | ''>('');
  const [entityOptions, setEntityOptions] = useState<EntityRecord[]>([]);
  const [manualVendorName, setManualVendorName] = useState('');
  const [manualVendorEmail, setManualVendorEmail] = useState('');
  const [manualVendorId, setManualVendorId] = useState('');
  const [manualPrDetails, setManualPrDetails] = useState<ManualPrDetails>({
    prNumber: '',
    title: '',
    department: '',
    requester: '',
    justification: '',
    requestType: 'Opex',
    priority: 'Medium',
  });
  const [manualComparisonRounds, setManualComparisonRounds] = useState<ManualComparisonRound[]>([
    emptyComparisonRound(1),
  ]);
  const [masterVendors, setMasterVendors] = useState<VendorRecord[]>([]);
  const csvAppliedRef = useRef(false);
  const brandingAutoApplied = useRef(false);
  const skipNextLetterheadLoad = useRef(Boolean(poIdParam));
  const letterheadLockedRef = useRef(false);
  letterheadLockedRef.current = letterheadLocked;
  const termsDraftRef = useRef<PoLetterheadClause[]>([]);
  const annexureDraftRef = useRef<PoLetterheadClause[]>([]);
  const annexureIiDraftRef = useRef<AnnexureIiRow[]>([emptyAnnexureIiRow()]);
  const lineItemsDraftRef = useRef<LineItem[]>([]);
  const poTermsDetailsRef = useRef(poTermsDetails);
  poTermsDetailsRef.current = poTermsDetails;
  const createdPoIdRef = useRef<number | null>(null);
  createdPoIdRef.current = createdPoId;
  const userEditedDraftRef = useRef(false);
  const prLineItemsHydratedRef = useRef(false);
  const keepLocalDraftAfterSaveRef = useRef(false);
  const contextLoadSeq = useRef(0);

  const markDraftEdited = useCallback(() => {
    userEditedDraftRef.current = true;
    if (!letterheadLockedRef.current) {
      letterheadLockedRef.current = true;
      setLetterheadLocked(true);
    }
  }, []);

  const documentTypeRef = useRef(documentType);
  documentTypeRef.current = documentType;
  const letterheadLoadSeq = useRef(0);

  const loadLetterhead = useCallback(async (type: PoType, docType?: 'purchase_order' | 'work_order', force = false) => {
    const targetDoc = docType || documentTypeRef.current;
    const alignedType = alignTemplateWithDocument(type, targetDoc);
    const seq = ++letterheadLoadSeq.current;
    setLetterheadLoading(true);
    setTemplateLoadError('');
    try {
      const res = await poLetterheadApi.get(alignedType);
      if (seq !== letterheadLoadSeq.current) return;
      if ((letterheadLockedRef.current || userEditedDraftRef.current) && !force) return;
      const terms = res.data.terms || [];
      const annexure = res.data.annexure || [];
      const nextTerms = stripQuoteNoFromTermsClauses(adaptClausesForDocumentType(terms, targetDoc));
      const nextAnnexure = adaptClausesForDocumentType(annexure, targetDoc);
      setLetterheadHeader(adaptWordingForDocumentType(res.data.letterheadHeader || '', targetDoc));
      termsDraftRef.current = nextTerms;
      annexureDraftRef.current = nextAnnexure;
      setTermsClauses(nextTerms);
      setAnnexureClauses(nextAnnexure);
      setLoadedTemplate({
        poType: alignedType,
        title: res.data.title || res.data.poTypeLabel || alignedType,
        termsCount: terms.length,
        annexureCount: annexure.length,
      });
    } catch (err) {
      if (seq !== letterheadLoadSeq.current) return;
      if ((letterheadLockedRef.current || userEditedDraftRef.current) && !force) return;
      setLetterheadHeader('');
      termsDraftRef.current = [];
      annexureDraftRef.current = [];
      setTermsClauses([]);
      setAnnexureClauses([]);
      setLoadedTemplate(null);
      setTemplateLoadError(err instanceof Error ? err.message : 'Could not load PO Type Master template');
    } finally {
      if (seq === letterheadLoadSeq.current) setLetterheadLoading(false);
    }
  }, []);

  const applyPoTypeTemplate = useCallback(
    (nextType: PoType, nextDoc?: 'purchase_order' | 'work_order') => {
      skipNextLetterheadLoad.current = false;
      userEditedDraftRef.current = false;
      letterheadLockedRef.current = false;
      setLetterheadLocked(false);
      setPoType(nextType);
      void loadLetterhead(nextType, nextDoc || documentTypeRef.current, true);
    },
    [loadLetterhead]
  );

  const selectedLetterhead = useMemo(
    () => letterheadOptions.find((o) => o.id === letterheadId) || null,
    [letterheadOptions, letterheadId]
  );
  const letterheadLocations = useMemo(() => {
    const locs = selectedLetterhead?.locations || [];
    if (locs.length) return locs;
    // Fallback: single location from master columns
    if (selectedLetterhead?.location || selectedLetterhead?.gstNo) {
      return [
        {
          id: selectedLetterhead.id,
          location: selectedLetterhead.location || '',
          gstNo: selectedLetterhead.gstNo || '',
          footerLogo: selectedLetterhead.footerLogo || '',
        },
      ];
    }
    return [];
  }, [selectedLetterhead]);

  const applyLetterheadLocation = useCallback(
    (loc: LetterheadLocationRecord | null, index = 0) => {
      if (!loc) {
        setLetterheadLocationKey('');
        setLocationGstNo('');
        setPoTermsDetails((prev) => ({
          ...prev,
          locationName: '',
          buyerGstNo: '',
          letterheadLocationId: '',
        }));
        return;
      }
      const key = letterheadLocKey(loc, index);
      setLetterheadLocationKey(key);
      setLocationGstNo(loc.gstNo || '');
      const invoicing = buildInvoicingAddressFromLocation(loc);
      setPoTermsDetails((prev) => ({
        ...prev,
        locationName: loc.location || '',
        buyerGstNo: loc.gstNo || '',
        letterheadLocationId: loc.id != null ? String(loc.id) : key,
        invoicingAddress: invoicing || prev.invoicingAddress,
      }));
    },
    []
  );

  const applyLetterheadBranding = useCallback(
    (row: LetterheadMasterRecord | null, opts?: { keepLocation?: boolean }) => {
    if (!row) {
      setLetterheadId('');
      setEntity('');
      setHeaderLogo('');
      setFooterLogo('');
        if (!opts?.keepLocation) applyLetterheadLocation(null);
      return;
    }
    setLetterheadId(row.id);
    setEntity(row.entity || '');
    setHeaderLogo(row.headerLogo || '');
    setFooterLogo(row.footerLogo || '');
      const locs = row.locations?.length
        ? row.locations
        : row.location || row.gstNo
          ? [
              {
                id: row.id,
                location: row.location || '',
                gstNo: row.gstNo || '',
                footerLogo: '',
              },
            ]
          : [];
      if (locs.length) {
        if (opts?.keepLocation) {
          setLetterheadLocationKey((currentKey) => {
            if (!currentKey) return currentKey;
            const idx = locs.findIndex(
              (l, i) =>
                letterheadLocKey(l, i) === currentKey ||
                String(l.id) === currentKey ||
                l.location === currentKey
            );
            if (idx >= 0) {
              const loc = locs[idx];
              setLocationGstNo(loc.gstNo || '');
              return letterheadLocKey(loc, idx);
            }
            return currentKey;
          });
          return;
        }
        applyLetterheadLocation(locs[0], 0);
      } else if (!opts?.keepLocation) {
        applyLetterheadLocation(null);
      }
    },
    [applyLetterheadLocation]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [addr, contact, managers] = await Promise.all([
          masterApi.listPoSiteLookups('site_address'),
          masterApi.listPoSiteLookups('site_contact'),
          masterApi.listPoSiteLookups('project_manager'),
        ]);
        if (cancelled) return;
        setSiteAddressOptions(addr.data || []);
        setSiteContactOptions(mergeSiteContacts(contact.data || []));
        setProjectManagerOptions(mergeProjectManagers(managers.data || []));
      } catch {
        if (!cancelled) {
          setSiteAddressOptions([]);
          setSiteContactOptions(mergeSiteContacts([]));
          setProjectManagerOptions(mergeProjectManagers([]));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await vendorApi.list();
        if (!cancelled) setMasterVendors(res.data || []);
      } catch {
        if (!cancelled) setMasterVendors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!masterVendors.length) return;
    const name = (
      manualVendorName ||
      importedVendorName ||
      vendorMeta.name ||
      pr?.recommendedVendor ||
      ''
    ).trim();
    const email = (manualVendorEmail || importedVendorEmail || vendorMeta.email || pr?.vendorEmail || '').trim();
    const hit = matchVendorFromMaster(masterVendors, { name, email });
    if (!hit) return;
    const masterEmail = String(hit.email || '').trim();
    if (isManualMode && !manualVendorId) {
      setManualVendorId(String(hit.id));
      if (hit.name) setManualVendorName(hit.name);
    }
    if (masterEmail) {
      if (isManualMode && masterEmail.toLowerCase() !== manualVendorEmail.trim().toLowerCase()) {
        setManualVendorEmail(masterEmail);
      }
      setVendorMeta((prev) =>
        prev.name === (hit.name || prev.name) && prev.email === masterEmail
          ? prev
          : { ...prev, name: hit.name || prev.name, email: masterEmail }
      );
    }
  }, [
    isManualMode,
    manualVendorId,
    masterVendors,
    manualVendorName,
    importedVendorName,
    manualVendorEmail,
    importedVendorEmail,
    vendorMeta.name,
    vendorMeta.email,
    pr?.recommendedVendor,
    pr?.vendorEmail,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await letterheadMasterApi.list({ status: 'active' });
        if (cancelled) return;
        const options = res.data || [];
        setLetterheadOptions(options);
        if (!isEditMode && !isManualMode && options.length && !brandingAutoApplied.current) {
          brandingAutoApplied.current = true;
          applyLetterheadBranding(options[0]);
        }
      } catch {
        if (!cancelled) setLetterheadOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, isManualMode, applyLetterheadBranding]);

  /** Keep logos/entity in sync with Letterhead Master when id is set (do not reset location pick). */
  useEffect(() => {
    if (!letterheadId) return;
    let cancelled = false;
    (async () => {
      try {
        const match = letterheadOptions.find((o) => o.id === letterheadId);
        if (match?.headerLogo || match?.footerLogo || match?.entity || match?.locations?.length) {
          if (!cancelled) applyLetterheadBranding(match, { keepLocation: true });
          return;
        }
        const res = await letterheadMasterApi.get(Number(letterheadId));
        if (cancelled) return;
        setLetterheadOptions((prev) =>
          prev.some((p) => p.id === res.data.id)
            ? prev.map((p) => (p.id === res.data.id ? res.data : p))
            : [...prev, res.data]
        );
        applyLetterheadBranding(res.data, { keepLocation: true });
      } catch {
        /* keep existing snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when letterheadId or options list identity changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterheadId, letterheadOptions.length]);

  useEffect(() => {
    termsDraftRef.current = termsClauses;
  }, [termsClauses]);
  useEffect(() => {
    annexureDraftRef.current = annexureClauses;
  }, [annexureClauses]);
  useEffect(() => {
    annexureIiDraftRef.current = annexureIiRows;
  }, [annexureIiRows]);
  useEffect(() => {
    lineItemsDraftRef.current = lineItems;
  }, [lineItems]);

  useEffect(() => {
    if (isEditMode || letterheadLocked) return;
    // Wait for PR context — it may redirect to an existing draft PO.
    if (numericPrId && !pr) return;
    if (skipNextLetterheadLoad.current) {
      skipNextLetterheadLoad.current = false;
      return;
    }
    void loadLetterhead(poType, documentType);
  }, [poType, documentType, loadLetterhead, letterheadLocked, isEditMode, numericPrId, pr]);

  useEffect(() => {
    if (!isManualPoFlow) return;
    setPr((prev) =>
      prev
        ? {
            ...prev,
            prNumber: manualPrDetails.prNumber || '—',
            title: manualPrDetails.title,
            department: manualPrDetails.department,
            requester: manualPrDetails.requester,
            requestType: manualPrDetails.requestType,
            priority: manualPrDetails.priority,
          }
        : prev
    );
    if (manualPrDetails.title.trim()) {
      setPoTermsDetails((prev) =>
        prev.subject?.trim() ? prev : { ...prev, subject: manualPrDetails.title.trim() }
      );
    }
    if (manualPrDetails.justification.trim()) {
      setSpecialInstructions((prev) => (prev.trim() ? prev : manualPrDetails.justification.trim()));
    }
  }, [isManualPoFlow, manualPrDetails]);

  useEffect(() => {
    if (!isManualPoFlow) return;
    const recommended = findRecommendedManualQuote(manualComparisonRounds);
    if (!recommended) return;
    if (recommended.vendorName.trim()) setManualVendorName(recommended.vendorName.trim());
    if (recommended.vendorEmail.trim()) setManualVendorEmail(recommended.vendorEmail.trim());
    if (recommended.vendorId) setManualVendorId(recommended.vendorId);
    if (recommended.paymentTerms) setPaymentTerms(recommended.paymentTerms);
    setVendorMeta((prev) => ({
      ...prev,
      name: recommended.vendorName.trim() || prev.name,
      email: recommended.vendorEmail.trim() || prev.email,
      paymentTerms: recommended.paymentTerms || prev.paymentTerms,
      quotedPrice: Number(recommended.quotedPrice) || prev.quotedPrice,
      leadTime: Number(recommended.leadTime) || prev.leadTime,
    }));
  }, [isManualPoFlow, manualComparisonRounds]);

  const selectedManualEntity = useMemo(
    () =>
      manualEntityId === ''
        ? null
        : entityOptions.find((e) => Number(e.id) === Number(manualEntityId)) || null,
    [manualEntityId, entityOptions]
  );

  useEffect(() => {
    if (!isManualPoFlow) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await masterApi.listEntities({ status: 'active' });
        if (!cancelled) setEntityOptions(res.data || []);
      } catch {
        if (!cancelled) setEntityOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isManualPoFlow]);

  const reloadClausesFromMaster = useCallback(async () => {
    skipNextLetterheadLoad.current = false;
    userEditedDraftRef.current = false;
    letterheadLockedRef.current = false;
    setLetterheadLocked(false);
    await loadLetterhead(poType, documentType, true);
  }, [loadLetterhead, poType, documentType]);

  // Keep Short/Long template family aligned with Purchase Order vs Work Order
  const prevDocumentTypeRef = useRef(documentType);
  useEffect(() => {
    if (prevDocumentTypeRef.current === documentType) return;
    prevDocumentTypeRef.current = documentType;
    const nextType = alignTemplateWithDocument(poType, documentType);
    if (nextType !== poType) setPoType(nextType);
  }, [documentType, poType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await poApi.getScmManager();
        if (!cancelled && res.data) {
          setScmManager({
            name: res.data.name || 'SCM Manager',
            email: res.data.email || '',
          });
        }
      } catch {
        if (!cancelled) {
          setScmManager({ name: 'Rajeev V', email: 'rajeev.v@refex.co.in' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadExistingPo = useCallback(async () => {
    if (!isEditMode || !editPoId) return;
    if (keepLocalDraftAfterSaveRef.current) {
      keepLocalDraftAfterSaveRef.current = false;
      skipNextLetterheadLoad.current = true;
      letterheadLoadSeq.current += 1;
      letterheadLockedRef.current = true;
      setLetterheadLocked(true);
      setCreatedPoId(editPoId);
      prLineItemsHydratedRef.current = true;
      return;
    }
    skipNextLetterheadLoad.current = true;
    letterheadLoadSeq.current += 1;
    setLetterheadLocked(true);
    setLoading(true);
    try {
      const res = await poApi.get(editPoId);
      const po = res.data as Record<string, unknown>;
      const statusRaw = String(po.statusRaw || po.status || '').toLowerCase().replace(/\s+/g, '_');
      const fromBuyerVerify = searchParams.get('from') === 'buyer-verify';
      const isPendingApproval =
        statusRaw === 'pending_approval' || statusRaw === 'pendingapproval';
      const isDraft = statusRaw === 'draft';
      setPoEditStatus(statusRaw);
      const isBuyerVerifyStatus =
        statusRaw === 'pending_buyer_verify' ||
        statusRaw === 'pending_buyerverify' ||
        statusRaw.includes('buyer_verify');
      const allowBuyerVerifyEdit = fromBuyerVerify && isBuyerVerifyStatus;
      if (!isPendingApproval && !allowBuyerVerifyEdit && !isBuyerVerifyStatus && !isDraft) {
        setLoadError('Only draft, pending, or buyer-verify POs can be edited');
        setPr(null);
        return;
      }

      const prDbId = Number(po.prId);
      setCreatedPoId(editPoId);
      setPoNumber(String(po.poNumber || ''));
      setReferencePoNumber(String(po.referencePoNumber || ''));
      if (po.referencePoNumber) {
        setReferencePoLoaded({
          poNumber: String(po.referencePoNumber),
          vendorName: '',
          prNumber: '',
          grandTotal: 0,
        });
      }
      setDeliveryAddress(String(po.deliveryAddress || ''));
      setExpectedDeliveryDate(String(po.expectedDeliveryDate || ''));
      setPoDate(toInputDate(po.poDate || po.createdAt) || todayYmd());
      setPaymentTerms(String(po.paymentTerms || 'Net 30 Days'));
      setIncoterms(normalizeIncoterm(po.incoterms));
      setSpecialInstructions(String(po.specialInstructions || ''));
      setGstPercentage(Number(po.gstPercentage) || 18);
      const loadedDocType: 'purchase_order' | 'work_order' =
        po.purchaseType === 'work_order' ? 'work_order' : 'purchase_order';
      setPoType(coercePoType(po.poType, loadedDocType));
      setLetterheadId(po.letterheadId ? Number(po.letterheadId) : '');
      setEntity(String(po.entity || ''));
      setHeaderLogo(String(po.headerLogo || ''));
      setFooterLogo(String(po.footerLogo || ''));
      setCurrency(normalizeCurrency(String(po.currency || DEFAULT_CURRENCY)));
      setDocumentType(loadedDocType);
      prevDocumentTypeRef.current = loadedDocType;
      const loadedTerms = (po.termsClauses as PoLetterheadClause[]) || [];
      const loadedAnnexure = (po.annexureClauses as PoLetterheadClause[]) || [];
      setLetterheadHeader(
        adaptWordingForDocumentType(String(po.letterheadHeader || ''), loadedDocType)
      );
      setAnnexureClauses(adaptClausesForDocumentType(loadedAnnexure, loadedDocType));
      annexureDraftRef.current = adaptClausesForDocumentType(loadedAnnexure, loadedDocType);
      {
        const loadedIi = parseAnnexureIi(po.annexureIiRows || po.annexureIiHtml || po.annexure_ii_html || '');
        const nextIi = loadedIi.length ? loadedIi : [emptyAnnexureIiRow()];
        annexureIiDraftRef.current = nextIi;
        setAnnexureIiRows(nextIi);
      }
      {
        const loadedDetails = { ...EMPTY_PO_TERMS_DETAILS, ...((po.poTermsDetails as PoTermsDetails) || {}) };
        const addr = loadedDetails.siteAddress || String(po.deliveryAddress || '');
        const adaptedTerms = adaptClausesForDocumentType(loadedTerms, loadedDocType);
        const quoteFromTerms = adaptedTerms.find((c) => isQuoteNoHeader(String(c.termsHeader || '')));
        const extractedQuote =
          extractQuoteNoFromDescription(String(quoteFromTerms?.termsDescription || '')) || '';
        const quoteNo = String(loadedDetails.quoteNo || extractedQuote || '').trim();
        setDeliveryAddress(addr);
        setPoTermsDetails({
          ...loadedDetails,
          paymentTermsText: loadedDetails.paymentTermsText || String(po.paymentTerms || ''),
          siteAddress: addr,
          quoteNo,
          quoteDate: toInputDate(loadedDetails.quoteDate) || '',
        });
        setTermsClauses(stripQuoteNoFromTermsClauses(adaptedTerms));
        termsDraftRef.current = stripQuoteNoFromTermsClauses(adaptedTerms);
        setLocationGstNo(loadedDetails.buyerGstNo || '');
        setLetterheadLocationKey(loadedDetails.letterheadLocationId || '');
      }
      const mappedLineItems = ((po.lineItems as Array<Record<string, unknown>>) || []).map((li) => {
        const quantity = Number(li.quantity) || 0;
        const unitPrice = Number(li.unitPrice) || 0;
        const taxPercentage = Math.max(0, Number(li.taxPercentage ?? li.tax_percentage ?? po.gstPercentage) || 18);
        const description = String(li.description || '');
        const itemName = String(li.itemName || li.name || '').trim() || plainTextFromHtml(description);
        return {
          id: Number(li.id) || `li-${itemName || description}`,
          itemName,
          description,
          quantity,
          unitPrice,
          taxPercentage,
          total: Number(li.total) || calcLineTotal(quantity, unitPrice),
          unit: lineItemUnit(li),
        };
      });
      lineItemsDraftRef.current = mappedLineItems;
      setLineItems(mappedLineItems);
      prLineItemsHydratedRef.current = true;
      setPr({
        id: prDbId,
        prNumber: String(po.prNumber || ''),
        title: String(po.prTitle || ''),
        department: String(po.department || ''),
        requester: String(po.requester || ''),
        recommendedVendor: String(po.vendorName || ''),
        vendorEmail: String(po.vendorEmail || ''),
        lineItems: ((po.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
          id: Number(li.id) || 0,
          description: String(li.description || ''),
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          category: String(li.category || ''),
          unit: lineItemUnit(li),
        })),
        requiredDate: String(po.expectedDeliveryDate || ''),
        amount: Number(po.grandTotal) || Number(po.subtotal) || 0,
        requestType: 'Opex',
        purchaseType: po.purchaseType === 'work_order' ? 'work_order' : 'purchase_order',
        purchaseTypeLabel:
          String(po.purchaseTypeLabel || '') ||
          (po.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'),
        priority: String(po.priority || 'medium'),
        currency: normalizeCurrency(String(po.currency || DEFAULT_CURRENCY)),
      });
      setDocumentType(po.purchaseType === 'work_order' ? 'work_order' : 'purchase_order');
      if (!prDbId) {
        setManualPoNoPr(true);
        setManualVendorName(String(po.vendorName || ''));
        setManualVendorEmail(String(po.vendorEmail || ''));
        const manualContext = (po.manualContext || {}) as {
          prDetails?: Partial<ManualPrDetails>;
          comparisonRounds?: Array<Record<string, unknown>>;
          vendorQuotes?: Array<Record<string, unknown>>;
          selectedEntityId?: number | null;
        };
        const ctxEntityId = manualContext.selectedEntityId;
        setManualEntityId(
          ctxEntityId != null && ctxEntityId !== '' ? Number(ctxEntityId) || '' : ''
        );
        setManualPrDetails(
          hydrateManualPrDetailsFromStored(manualContext.prDetails, {
            title: String(po.prTitle || ''),
            department: String(po.department || ''),
            requester: String(po.requester || ''),
            prNumber: String(po.prNumber || ''),
          })
        );
        const hydratedRounds = hydrateComparisonRoundsFromStored(
          (manualContext.comparisonRounds || []) as Parameters<typeof hydrateComparisonRoundsFromStored>[0],
          (manualContext.vendorQuotes || []) as Parameters<typeof hydrateComparisonRoundsFromStored>[1]
        );
        if (hydratedRounds.length) setManualComparisonRounds(hydratedRounds);
      }
      setVendorMeta({
        name: String(po.vendorName || ''),
        email: String(po.vendorEmail || ''),
        quotedPrice: Number(po.grandTotal) || 0,
        leadTime: 30,
        paymentTerms: String(po.paymentTerms || 'Net 30 Days'),
        overallScore: 85,
        technicalScore: 85,
        commercialScore: 85,
        compliance: 'Yes',
      });
      setLoadError('');
      try {
        const blob = await poApi.fetchPdfBlob(editPoId);
        setPdfPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch {
        /* draft PDF may not exist yet */
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load PO');
      setPr(null);
    } finally {
      setLoading(false);
    }
  }, [isEditMode, editPoId, searchParams]);

  useEffect(() => {
    if (isEditMode) {
      loadExistingPo();
    }
  }, [isEditMode, loadExistingPo]);

  const loadContext = useCallback(async () => {
    if (isEditMode) return;
    const seq = ++contextLoadSeq.current;
    const shouldApplyContext = () =>
      seq === contextLoadSeq.current &&
      !createdPoIdRef.current &&
      !keepLocalDraftAfterSaveRef.current;
    if (isManualMode) {
      setLoading(true);
      try {
        const entRes = await masterApi.listEntities({ status: 'active' }).catch(() => ({ data: [] }));
        const ents = (entRes.data || []) as EntityRecord[];
        if (!shouldApplyContext()) return;
        if (ents.length) setEntityOptions(ents);
        setManualPoNoPr(true);
        setLetterheadId('');
        setEntity('');
        setHeaderLogo('');
        setFooterLogo('');
        setLetterheadLocationKey('');
        letterheadLockedRef.current = false;
        setLetterheadLocked(false);
        setPr({
          id: 0,
          prNumber: '—',
          title: '',
          department: '',
          entityId: null,
          entityName: '',
          entityCode: '',
          requester: '',
          recommendedVendor: '',
          vendorEmail: '',
          purchaseType: 'purchase_order',
          purchaseTypeLabel: 'Purchase Order',
          currency: DEFAULT_CURRENCY,
          lineItems: [],
        });
        setLineItems([
          {
            id: `manual-${Date.now()}`,
            itemName: '',
            description: '',
            quantity: 1,
            unitPrice: 0,
            taxPercentage: 18,
            total: 0,
            unit: 'Nos',
          },
        ]);
        setManualVendorName('');
        setManualVendorEmail('');
        setManualVendorId('');
        setManualEntityId('');
        setManualPrDetails({
          prNumber: '',
          title: '',
          department: '',
          requester: '',
          justification: '',
          requestType: 'Opex',
          priority: 'Medium',
        });
        setManualComparisonRounds([emptyComparisonRound(1)]);
        setSkipApproval(true);
        setDocumentType('purchase_order');
        setLoadError('');
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to start manual PO');
        setPr(null);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (!numericPrId) {
      setLoading(false);
      return;
    }
    let redirectedToDraft = false;
    try {
      const res = await poApi.getCreateContext(numericPrId);
      if (!shouldApplyContext()) return;
      let existingDraftId = Number(
        (res.data as { draftPoId?: number | null })?.draftPoId || 0
      );
      if (!existingDraftId) {
        try {
          const listed = await poApi.list();
          const hit = ((listed.data || []) as Array<Record<string, unknown>>).find((row) => {
            const prMatch = Number(row.prId || 0) === numericPrId;
            const status = String(row.statusRaw || row.status || '').toLowerCase().replace(/\s+/g, '_');
            return prMatch && status === 'draft';
          });
          existingDraftId = Number(hit?.id || 0);
        } catch {
          /* list is optional — context.draftPoId is enough when backend is current */
        }
      }
      if (existingDraftId > 0) {
        redirectedToDraft = true;
        navigate(
          `/scm/create-po?poId=${existingDraftId}&from=${encodeURIComponent(fromParam || 'create-po')}`,
          { replace: true }
        );
        return;
      }
      const prData = res.data.pr as {
        id: number;
        prNumber: string;
        title: string;
        department: string;
        entityId?: number;
        entityName?: string;
        entityCode?: string;
        requester: string;
        currency?: string;
        purchaseType?: 'purchase_order' | 'work_order';
        purchaseTypeLabel?: string;
        placeOfDelivery?: string;
        deliveryPoc?: string;
        deliveryPocEmail?: string;
        deliveryPocPhone?: string;
        projectManagerHo?: string;
        projectManagerContact?: string;
        projectManagerEmail?: string;
        paymentTerms?: string;
        lineItems: Array<{ id: number; description: string; quantity: number; unitCost: number; category?: string; unit?: string; uom?: string }>;
      };
      const vendor = res.data.vendor as { name: string; email: string; paymentTerms: string; deliveryTerms: string };
      if (!shouldApplyContext()) return;
      const prCurrency = normalizeCurrency(prData.currency);
      setCurrency(prCurrency);
      setPr({
        id: prData.id,
        prNumber: prData.prNumber,
        title: prData.title,
        department: prData.department,
        entityId: prData.entityId || null,
        entityName: prData.entityName || '',
        entityCode: prData.entityCode || '',
        requester: prData.requester,
        purchaseType: prData.purchaseType === 'work_order' ? 'work_order' : 'purchase_order',
        purchaseTypeLabel: prData.purchaseTypeLabel || (prData.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'),
        recommendedVendor: vendor.name,
        vendorEmail: vendor.email,
        currency: prCurrency,
        lineItems: prData.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitCost,
          category: li.category,
          unit: li.unit || li.uom || 'Nos',
        })),
      });
      setDocumentType(prData.purchaseType === 'work_order' ? 'work_order' : 'purchase_order');
      if (!userEditedDraftRef.current) {
        setPoType(
          defaultTemplateForDocument(
            prData.purchaseType === 'work_order' ? 'work_order' : 'purchase_order'
          )
        );
      }
      setPaymentTerms(vendor.paymentTerms || prData.paymentTerms || 'Net 30 Days');
      setIncoterms(normalizeIncoterm(vendor.deliveryTerms));
      if (prData.placeOfDelivery) {
        setDeliveryAddress(prData.placeOfDelivery);
      }
      setPoTermsDetails((prev) => ({
        ...prev,
        subject: prev.subject?.trim() ? prev.subject : String(prData.title || '').trim(),
        paymentTermsText: prev.paymentTermsText || vendor.paymentTerms || prData.paymentTerms || 'Net 30 Days',
        siteAddress: prev.siteAddress || prData.placeOfDelivery || '',
        siteContactPerson: prev.siteContactPerson || prData.deliveryPoc || '',
        siteContactEmail: prev.siteContactEmail || prData.deliveryPocEmail || '',
        siteContactPhone: prev.siteContactPhone || prData.deliveryPocPhone || '',
        projectManagerHo: prev.projectManagerHo || prData.projectManagerHo || '',
        projectManagerEmail: prev.projectManagerEmail || prData.projectManagerEmail || '',
        projectManagerContact: prev.projectManagerContact || prData.projectManagerContact || '',
      }));
      setVendorMeta({
        name: vendor.name,
        email: vendor.email,
        quotedPrice: Number(vendor.quotedPrice) || 0,
        leadTime: 30,
        paymentTerms: vendor.paymentTerms || 'Net 30 Days',
        overallScore: 85,
        technicalScore: 85,
        commercialScore: 85,
        compliance: 'Yes',
      });
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load PR');
      setPr(null);
    } finally {
      if (!redirectedToDraft) setLoading(false);
    }
  }, [numericPrId, isEditMode, isManualMode, navigate, fromParam]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const updatePoTermsField = (key: keyof PoTermsDetails, value: string) => {
    setPoTermsDetails((prev) => {
      const next = { ...prev, [key]: value };
      poTermsDetailsRef.current = next;
      return next;
    });
    if (key === 'paymentTermsText') {
      const firstLine = value.trim().split('\n')[0]?.trim();
      if (firstLine) setPaymentTerms(firstLine.slice(0, 120));
    }
    if (key === 'siteAddress') {
      setDeliveryAddress(value);
    }
    if (key === 'quoteNo') {
      setTermsClauses((prev) => stripQuoteNoFromTermsClauses(prev));
    }
  };

  const handleTermsClausesChange = (next: PoLetterheadClause[]) => {
    markDraftEdited();
    const renamed = stripQuoteNoFromTermsClauses(
      renameRfqHeadersToQuoteNo(adaptClausesForDocumentType(next, documentType))
    );
    termsDraftRef.current = renamed;
    setTermsClauses(renamed);
    const quoteRow = renamed.find((c) => isQuoteNoHeader(String(c.termsHeader || '')));
    if (!quoteRow) return;
    const extracted = extractQuoteNoFromDescription(String(quoteRow.termsDescription || ''));
    // Only update quoteNo when the terms row has real typed text.
    // Do not clear an existing Quote No when the row still only has $placeholders.
    if (extracted == null) return;
    setPoTermsDetails((prev) =>
      prev.quoteNo === extracted ? prev : { ...prev, quoteNo: extracted }
    );
  };

  const saveSiteAddressLookup = async () => {
    const label = newSiteAddress.trim();
    if (!label) {
      setSiteLookupError('Site address is required');
      return;
    }
    setSavingSiteLookup(true);
    setSiteLookupError('');
    try {
      const res = await masterApi.createPoSiteLookup({ type: 'site_address', label });
      const saved = res.data;
      setSiteAddressOptions((prev) => upsertSiteLookup(prev, saved));
      updatePoTermsField('siteAddress', saved.label);
      setNewSiteAddress('');
      setAddingSiteAddress(false);
    } catch (err) {
      setSiteLookupError(err instanceof Error ? err.message : 'Could not save site address');
    } finally {
      setSavingSiteLookup(false);
    }
  };

  const saveSiteContactLookup = async () => {
    const label = newSiteContact.label.trim();
    if (!label) {
      setSiteLookupError('Contact name is required');
      return;
    }
    setSavingSiteLookup(true);
    setSiteLookupError('');
    try {
      const res = await masterApi.createPoSiteLookup({
        type: 'site_contact',
        label,
        email: newSiteContact.email.trim(),
        phone: newSiteContact.phone.trim(),
      });
      const saved = res.data;
      setSiteContactOptions((prev) => upsertSiteLookup(prev, saved));
      setPoTermsDetails((prev) => ({
        ...prev,
        siteContactPerson: saved.label,
        siteContactEmail: saved.email || '',
        siteContactPhone: saved.phone || '',
      }));
      setNewSiteContact({ label: '', email: '', phone: '' });
      setAddingSiteContact(false);
    } catch (err) {
      setSiteLookupError(err instanceof Error ? err.message : 'Could not save site contact');
    } finally {
      setSavingSiteLookup(false);
    }
  };

  const saveProjectManagerLookup = async () => {
    const label = newProjectManager.label.trim();
    if (!label) {
      setSiteLookupError('Project manager name is required');
      return;
    }
    setSavingSiteLookup(true);
    setSiteLookupError('');
    try {
      const res = await masterApi.createPoSiteLookup({
        type: 'project_manager',
        label,
        email: newProjectManager.email.trim(),
        phone: newProjectManager.phone.trim(),
      });
      const saved = res.data;
      setProjectManagerOptions((prev) =>
        upsertSiteLookup(prev, saved).sort((a, b) => a.label.localeCompare(b.label))
      );
      setPoTermsDetails((prev) => ({
        ...prev,
        projectManagerHo: saved.label,
        projectManagerEmail: saved.email || '',
        projectManagerContact: saved.phone || '',
      }));
      setNewProjectManager({ label: '', email: '', phone: '' });
      setAddingProjectManager(false);
    } catch (err) {
      setSiteLookupError(err instanceof Error ? err.message : 'Could not save project manager');
    } finally {
      setSavingSiteLookup(false);
    }
  };

  const subtotal = useMemo(() => roundMoney(lineItems.reduce((s, i) => s + i.total, 0)), [lineItems]);
  const taxAmount = useMemo(
    () => roundMoney(lineItems.reduce((s, i) => s + calcLineTax(i.total, i.taxPercentage), 0)),
    [lineItems]
  );
  const grandTotal = useMemo(() => roundMoney(subtotal + taxAmount), [subtotal, taxAmount]);
  const amountInWords = useMemo(() => numberToIndianWords(grandTotal), [grandTotal]);
  const effectiveGstPercentage = useMemo(
    () => (subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0),
    [subtotal, taxAmount]
  );

  useEffect(() => {
    setGstPercentage(effectiveGstPercentage);
  }, [effectiveGstPercentage]);

  const buildPreviewPayload = useCallback(() => {
    const synced = withSyncedQuoteNo(termsClauses, {
      ...poTermsDetails,
      siteAddress: poTermsDetails.siteAddress || deliveryAddress,
      paymentTermsText: poTermsDetails.paymentTermsText || paymentTerms,
    });

    const vendorNameForPo = isManualPoFlow
      ? manualVendorName.trim() || importedVendorName.trim() || vendorMeta.name.trim() || undefined
      : importedVendorName.trim() || pr?.recommendedVendor || vendorMeta.name.trim() || undefined;
    const vendorEmailFromForm = isManualPoFlow
      ? manualVendorEmail.trim() || importedVendorEmail.trim() || vendorMeta.email.trim() || undefined
      : importedVendorEmail.trim() || pr?.vendorEmail || vendorMeta.email.trim() || undefined;
    const masterVendor = matchVendorFromMaster(masterVendors, {
      name: vendorNameForPo,
      email: vendorEmailFromForm,
    });
    const manualEntityFields = isManualPoFlow
      ? manualEntityPayload(manualEntityId, selectedManualEntity)
      : null;
    return {
    poNumber: poNumber || undefined,
    prNumber: isManualPoFlow ? manualPrDetails.prNumber || undefined : pr?.prNumber || undefined,
    quoteNo: synced.quoteNo || undefined,
    quoteDate: synced.poTermsDetails.quoteDate || undefined,
    lineItems: lineItems.map((i) => ({
      itemName: i.itemName || '',
      description: i.description,
      quantity: i.quantity,
      unit: i.unit || 'Nos',
      unitPrice: i.unitPrice,
      taxPercentage: i.taxPercentage || 0,
      discount: 0,
    })),
    deliveryAddress: poTermsDetails.siteAddress || deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage: effectiveGstPercentage,
    poType,
    letterheadHeader,
    letterheadId: letterheadId || undefined,
    letterheadLocationId: poTermsDetails.letterheadLocationId || letterheadLocationKey || undefined,
    locationName: poTermsDetails.locationName || undefined,
    currency,
    entity: manualEntityFields ? manualEntityFields.entity : entity,
    entityId: manualEntityFields
      ? manualEntityFields.entityId || undefined
      : pr?.entityId || undefined,
    headerLogo,
    footerLogo,
    terms: synced.terms,
    termsClauses: synced.terms,
    annexure: annexureClauses,
    annexureIiRows: annexureIiRows.filter((row) => !annexureIiRowIsEmpty(row)),
    annexureIiHtml: serializeAnnexureIi(annexureIiRows.filter((row) => !annexureIiRowIsEmpty(row))),
    poTermsDetails: synced.poTermsDetails,
    purchaseType: documentType,
    vendorName: masterVendor?.name || vendorNameForPo,
    vendorEmail: masterVendor?.email || vendorEmailFromForm,
    title: isManualPoFlow
      ? manualPrDetails.title || poTermsDetails.subject || undefined
      : poTermsDetails.subject || pr?.title || undefined,
    department: isManualPoFlow ? manualPrDetails.department || undefined : pr?.department || undefined,
    requester: isManualPoFlow ? manualPrDetails.requester || undefined : pr?.requester || undefined,
  };
  }, [
    poNumber,
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    poDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    effectiveGstPercentage,
    poType,
    letterheadHeader,
    letterheadId,
    letterheadLocationKey,
    currency,
    entity,
    headerLogo,
    footerLogo,
    termsClauses,
    annexureClauses,
    annexureIiRows,
    poTermsDetails,
    documentType,
    isManualPoFlow,
    manualEntityId,
    selectedManualEntity,
    manualVendorName,
    manualVendorEmail,
    manualPrDetails,
    importedVendorName,
    importedVendorEmail,
    pr,
    vendorMeta.name,
    vendorMeta.email,
    masterVendors,
  ]);

  const applyMasterVendorToPayload = useCallback(
    async (payload: Record<string, unknown>) => {
      const vendorNameLive = String(
        payload.vendorName || vendorMeta.name || pr?.recommendedVendor || ''
      ).trim();
      let masterHit = matchVendorFromMaster(masterVendors, {
        name: vendorNameLive,
        email: String(payload.vendorEmail || vendorMeta.email || ''),
      });
      if (!masterHit && vendorNameLive) {
        try {
          const searchTerm = vendorNameLive.split(/\s+/).slice(0, 3).join(' ');
          const res = await vendorApi.list(searchTerm);
          masterHit = matchVendorFromMaster(res.data || [], {
            name: vendorNameLive,
            email: String(payload.vendorEmail || ''),
          });
        } catch {
          /* keep payload email */
        }
      }
      if (masterHit?.email) {
        payload.vendorName = masterHit.name || payload.vendorName;
        payload.vendorEmail = masterHit.email;
      }
      return payload;
    },
    [masterVendors, vendorMeta.name, vendorMeta.email, pr?.recommendedVendor]
  );

  const handleOpenLivePdf = useCallback(async () => {
    try {
      setPdfDownloading(true);
      const payload = await applyMasterVendorToPayload(buildPreviewPayload());
      if (!payload.vendorEmail && isManualPoFlow) {
        payload.vendorName =
          String(payload.vendorName || '').trim() ||
          manualVendorName.trim() ||
          vendorMeta.name.trim() ||
          'Vendor Name';
        payload.vendorEmail =
          String(payload.vendorEmail || '').trim() ||
          manualVendorEmail.trim() ||
          vendorMeta.email.trim() ||
          'vendor@example.com';
      }
      let blob: Blob;
      if (isEditMode && editPoId) {
        blob = await poApi.previewPdfBlobByPoId(editPoId, payload);
      } else if (isManualMode || isManualPoFlow) {
        blob = await poApi.previewManualPdfBlob(payload);
      } else if (numericPrId) {
        blob = await poApi.previewPdfBlob(numericPrId, payload);
      } else {
        throw new Error('Save draft first to generate PDF');
      }
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) {
        triggerBlobDownload(blob, `${poNumber || pr?.prNumber || 'PO'}_preview.pdf`);
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open PDF');
    } finally {
      setPdfDownloading(false);
    }
  }, [
    applyMasterVendorToPayload,
    buildPreviewPayload,
    isManualPoFlow,
    manualVendorName,
    manualVendorEmail,
    vendorMeta.name,
    vendorMeta.email,
    isEditMode,
    editPoId,
    isManualMode,
    numericPrId,
    poNumber,
    pr?.prNumber,
  ]);

  useEffect(() => {
    if (activeTab !== 'preview' || (!numericPrId && !editPoId && !isManualPoFlow)) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const payload = await applyMasterVendorToPayload(buildPreviewPayload());
        if (!payload.vendorEmail && isManualPoFlow) {
          payload.vendorName =
            String(payload.vendorName || '').trim() ||
            manualVendorName.trim() ||
            vendorMeta.name.trim() ||
            'Vendor Name';
          payload.vendorEmail =
            String(payload.vendorEmail || '').trim() ||
            manualVendorEmail.trim() ||
            vendorMeta.email.trim() ||
            'vendor@example.com';
        }
        const previewPrId =
          (numericPrId && !Number.isNaN(numericPrId) ? numericPrId : 0) ||
          (Number(pr?.id) > 0 ? Number(pr.id) : 0);
        const html =
          previewPrId && user?.role === 'SCM Buyer'
            ? await poApi.previewDocumentHtml(previewPrId, payload)
            : isEditMode && editPoId
              ? await poApi.previewDocumentHtmlByPoId(editPoId, payload)
              : isManualPoFlow
                ? await poApi.previewManualDocumentHtml(payload)
                : await poApi.previewDocumentHtml(numericPrId!, payload);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        setPreviewHtmlUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (err) {
        if (!cancelled) {
          const raw = err instanceof Error ? err.message : 'Could not load preview';
          let friendly = raw;
          try {
            const parsed = JSON.parse(raw) as { message?: string };
            if (parsed?.message) friendly = parsed.message;
          } catch {
            /* keep raw */
          }
          setPreviewError(friendly);
          setPreviewHtmlUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeTab, numericPrId, editPoId, isEditMode, isManualPoFlow, buildPreviewPayload, applyMasterVendorToPayload, manualVendorName, manualVendorEmail, vendorMeta.name, vendorMeta.email, masterVendors, pr?.id, user?.role]);

  useEffect(() => {
    return () => {
      if (previewHtmlUrl) URL.revokeObjectURL(previewHtmlUrl);
    };
  }, [previewHtmlUrl]);

  const patchLineItems = (updater: (prev: LineItem[]) => LineItem[]) => {
    markDraftEdited();
    setLineItems((prev) => {
      const next = updater(prev);
      lineItemsDraftRef.current = next;
      return next;
    });
  };

  const handleQtyChange = (id: string | number, val: number) => {
    patchLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: val, total: calcLineTotal(val, item.unitPrice) }
          : item
      )
    );
  };

  const handlePriceChange = (id: string | number, raw: string) => {
    patchLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const parsed = raw === '' || raw === '.' ? 0 : parseFloat(raw);
        const val = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        return { ...item, unitPrice: val, total: calcLineTotal(item.quantity, val) };
      })
    );
  };

  const handleTaxPercentageChange = (id: string | number, val: number) => {
    patchLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, taxPercentage: Math.min(100, Math.max(0, val)) } : item
      )
    );
  };

  const handleUnitChange = (id: string | number, val: string) => {
    patchLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unit: val } : item))
    );
  };

  const handleItemNameChange = (id: string | number, val: string) => {
    patchLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, itemName: val } : item))
    );
  };

  const handleDescriptionChange = (id: string | number, val: string) => {
    patchLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description: val } : item))
    );
  };

  const handleAddLineItem = () => {
    patchLineItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercentage: 18,
        total: 0,
        unit: 'Nos',
      },
    ]);
  };

  const handleDeleteLineItem = (id: string | number) => {
    patchLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const resolvedManualEntityId = isManualPoFlow
    ? Number(manualEntityId || 0) || ''
    : Number(
        manualEntityId ||
          pr?.entityId ||
          matchEntityFromLetterhead(selectedLetterhead, entityOptions)?.id ||
          0
      ) || '';

  const flushLiveEditors = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll('[contenteditable="true"]').forEach((node) => {
      if (node instanceof HTMLElement) node.blur();
    });
  };

  const collectLiveDraft = () => {
    const details = poTermsDetailsRef.current;
    return {
      details,
      termsToSave: termsDraftRef.current.length ? termsDraftRef.current : termsClauses,
      annexureToSave: annexureDraftRef.current.length ? annexureDraftRef.current : annexureClauses,
      annexureIiLive: annexureIiDraftRef.current.length ? annexureIiDraftRef.current : annexureIiRows,
      lineItemsLive: lineItemsDraftRef.current.length ? lineItemsDraftRef.current : lineItems,
    };
  };

  const handleSaveDraft = async () => {
    if ((!numericPrId && !editPoId && !isManualPoFlow) || !pr) return;
    if (isManualPoFlow && manualEntityId === '') {
      alert('Please select an entity for PO / WO numbering');
      setActiveTab('details');
      return;
    }
    setSubmitting(true);
    try {
      flushLiveEditors();
      await new Promise((r) => window.setTimeout(r, 80));
      const { details, termsToSave, annexureToSave, annexureIiLive, lineItemsLive } = collectLiveDraft();
      const annexureIiToSave = annexureIiLive.filter((row) => !annexureIiRowIsEmpty(row));
      const payload: Record<string, unknown> = {
        skipLetterheadMaster: true,
        lineItems: lineItemsLive.map((i) => ({
          itemName: i.itemName || '',
          description: i.description,
          quantity: i.quantity,
          unit: i.unit || 'Nos',
          unitPrice: i.unitPrice,
          taxPercentage: i.taxPercentage || 0,
          discount: 0,
        })),
        deliveryAddress: details.siteAddress || deliveryAddress,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        poDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        gstPercentage: effectiveGstPercentage,
        poType,
        letterheadHeader,
        letterheadId: letterheadId || undefined,
        letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || undefined,
        locationName: details.locationName || undefined,
        currency,
        entity,
        headerLogo,
        footerLogo,
        terms: filterNonEmptyClauses(
          withSyncedQuoteNo(termsToSave, {
            ...details,
            paymentTermsText: details.paymentTermsText || paymentTerms,
            siteAddress: details.siteAddress || deliveryAddress,
            letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || '',
            buyerGstNo: details.buyerGstNo || locationGstNo || '',
          }).terms
        ),
        annexure: filterNonEmptyClauses(annexureToSave),
        annexureIiRows: annexureIiToSave,
        annexureIiHtml: serializeAnnexureIi(annexureIiToSave),
        poTermsDetails: withSyncedQuoteNo(termsToSave, {
          ...details,
          paymentTermsText: details.paymentTermsText || paymentTerms,
          siteAddress: details.siteAddress || deliveryAddress,
          letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || '',
          buyerGstNo: details.buyerGstNo || locationGstNo || '',
        }).poTermsDetails,
        referencePoNumber: referencePoNumber.trim() || undefined,
        purchaseType: documentType,
        poNumber: poNumber.trim() || undefined,
      };

      if (isManualPoFlow) {
        const recommended = findRecommendedManualQuote(manualComparisonRounds);
        payload.vendorName = (recommended?.vendorName || manualVendorName).trim() || undefined;
        payload.vendorEmail = (recommended?.vendorEmail || manualVendorEmail).trim() || undefined;
        const entityFields = manualEntityPayload(manualEntityId, selectedManualEntity);
        payload.selectedEntityId = entityFields.selectedEntityId;
        payload.entityId = entityFields.entityId;
        payload.entity = entityFields.entity;
        payload.title = manualPrDetails.title.trim() || details.subject || '';
        payload.department = manualPrDetails.department.trim();
        payload.requester = manualPrDetails.requester.trim();
        payload.manualPrDetails = manualPrDetails;
        payload.comparisonRounds = await Promise.all(
          manualComparisonRounds.map(async (round) => ({
            round: round.round,
            label: round.label.trim() || `Round ${round.round}`,
            notes: round.notes.trim(),
            vendorQuotes: await Promise.all(
              round.vendorQuotes.map(async (row, idx) => ({
                vendorId: row.vendorId,
                vendorName: row.vendorName.trim(),
                vendorEmail: row.vendorEmail.trim(),
                quotedPrice: Number(row.quotedPrice) || 0,
                leadTime: row.leadTime.trim(),
                paymentTerms: row.paymentTerms,
                recommended: row.recommended,
                round: round.round,
                sortOrder: idx,
                files: [
                  ...(row.storedFiles || []).map((f) => ({
                    fileName: f.fileName,
                    mimeType: f.mimeType || null,
                    storedName: f.storedName,
                  })),
                  ...(await Promise.all(row.files.map((file) => fileToAttachmentPayload(file)))),
                ],
              }))
            ),
          }))
        );
      }

      if (editPoId || createdPoId) payload.poId = editPoId || createdPoId;
      else if (numericPrId) payload.prId = numericPrId;

      const res = await poApi.saveDraft(payload);
      const savedId = Number((res.data as { id?: number }).id);
      const savedPoNumber = String((res.data as { poNumber?: string }).poNumber || '');
      if (savedId) {
        createdPoIdRef.current = savedId;
        setCreatedPoId(savedId);
      }
      if (savedPoNumber) setPoNumber(savedPoNumber);
      skipNextLetterheadLoad.current = true;
      letterheadLoadSeq.current += 1;
      contextLoadSeq.current += 1;
      letterheadLockedRef.current = true;
      setLetterheadLocked(true);
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
      if (!editPoId && savedId) {
        keepLocalDraftAfterSaveRef.current = true;
        navigate(`/scm/create-po?poId=${savedId}&manual=1&from=create-po`, { replace: true });
      }
      const refreshPoId = savedId || editPoId || createdPoId;
      if (refreshPoId) {
        try {
          const payload = await applyMasterVendorToPayload(buildPreviewPayload());
          const blob = await poApi.previewPdfBlobByPoId(refreshPoId, payload);
          setPdfPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        } catch {
          /* preview PDF optional */
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save draft');
    } finally {
      setSubmitting(false);
    }
  };

  const applyReferencePoDetails = useCallback((po: Record<string, unknown>) => {
    const refNo = String(po.poNumber || '').trim();
    setReferencePoNumber(refNo);
    setLetterheadLocked(true);
    setDeliveryAddress(String(po.deliveryAddress || ''));
    if (po.expectedDeliveryDate) {
      setExpectedDeliveryDate(String(po.expectedDeliveryDate));
    }
    setPaymentTerms(String(po.paymentTerms || 'Net 30 Days'));
    setIncoterms(normalizeIncoterm(po.incoterms));
    setSpecialInstructions(String(po.specialInstructions || ''));
    setGstPercentage(Number(po.gstPercentage) || 18);
    const nextDocType: 'purchase_order' | 'work_order' =
      po.purchaseType === 'work_order'
        ? 'work_order'
        : po.purchaseType === 'purchase_order'
          ? 'purchase_order'
          : documentType;
    setPoType(coercePoType(po.poType, nextDocType));
    if (po.purchaseType === 'work_order' || po.purchaseType === 'purchase_order') {
      setDocumentType(po.purchaseType);
      prevDocumentTypeRef.current = po.purchaseType;
    }
    setLetterheadHeader(
      adaptWordingForDocumentType(String(po.letterheadHeader || ''), nextDocType)
    );
    setLetterheadId(po.letterheadId ? Number(po.letterheadId) : '');
    setEntity(String(po.entity || ''));
    setHeaderLogo(String(po.headerLogo || ''));
    setFooterLogo(String(po.footerLogo || ''));
    setAnnexureClauses(
      adaptClausesForDocumentType((po.annexureClauses as PoLetterheadClause[]) || [], nextDocType)
    );
    {
      const loadedIi = parseAnnexureIi(po.annexureIiRows || po.annexureIiHtml || po.annexure_ii_html || '');
      if (loadedIi.length) setAnnexureIiRows(loadedIi);
    }
    {
      const loadedDetails = { ...EMPTY_PO_TERMS_DETAILS, ...((po.poTermsDetails as PoTermsDetails) || {}) };
      const addr = loadedDetails.siteAddress || String(po.deliveryAddress || '');
      const adaptedTerms = adaptClausesForDocumentType(
        (po.termsClauses as PoLetterheadClause[]) || [],
        nextDocType
      );
      const quoteFromTerms = adaptedTerms.find((c) => isQuoteNoHeader(String(c.termsHeader || '')));
      const extractedQuote =
        extractQuoteNoFromDescription(String(quoteFromTerms?.termsDescription || '')) || '';
      const quoteNo = String(loadedDetails.quoteNo || extractedQuote || '').trim();
      setDeliveryAddress(addr);
      setPoTermsDetails({
        ...loadedDetails,
        paymentTermsText: loadedDetails.paymentTermsText || String(po.paymentTerms || ''),
        siteAddress: addr,
        quoteNo,
        quoteDate: toInputDate(loadedDetails.quoteDate) || '',
      });
      setTermsClauses(stripQuoteNoFromTermsClauses(adaptedTerms));
    }

    const refLineItems = ((po.lineItems as Array<Record<string, unknown>>) || []).map((li, index) => {
      const qty = Number(li.quantity) || 0;
      const unitPrice = Number(li.unitPrice) || 0;
      const taxPercentage = Math.max(0, Number(li.taxPercentage ?? li.tax_percentage ?? po.gstPercentage) || 18);
      const description = String(li.description || '');
      const itemName = String(li.itemName || li.name || '').trim() || plainTextFromHtml(description);
      return {
        id: `ref-${index}-${Date.now()}`,
        itemName,
        description,
        quantity: qty,
        unitPrice,
        taxPercentage,
        total: Number(li.total) || calcLineTotal(qty, unitPrice),
        unit: lineItemUnit(li),
      };
    });
    if (refLineItems.length) {
      setLineItems(refLineItems);
    }

    setReferencePoLoaded({
      poNumber: refNo,
      vendorName: String(po.vendorName || ''),
      prNumber: String(po.prNumber || ''),
      grandTotal: Number(po.grandTotal) || 0,
    });
  }, [documentType]);

  /** Enter existing PO number → auto-fill PO Details / Terms / line items */
  const loadPoDetailsByNumber = useCallback(
    async (rawNumber?: string) => {
      const num = String(rawNumber ?? referencePoNumber).trim();
      if (!num) {
        setReferencePoError('Enter a PO number to auto-fill details');
        return false;
      }
      setReferencePoNumber(num);
      setReferencePoLoading(true);
      setReferencePoError('');
      try {
        const res = await poApi.getByNumber(num);
        const po = res.data as Record<string, unknown>;
        if (!po?.poNumber) throw new Error('PO not found');
        applyReferencePoDetails(po);
        return true;
      } catch (err) {
        setReferencePoLoaded(null);
        setReferencePoError(err instanceof Error ? err.message : 'PO not found');
        return false;
      } finally {
        setReferencePoLoading(false);
      }
    },
    [referencePoNumber, applyReferencePoDetails]
  );

  const applyCsvImportPayload = useCallback((payload: PoCsvImportPayload) => {
    if (payload.lineItems?.length) {
      setLineItems(
        payload.lineItems.map((item) => ({
          id: item.id,
          itemName: item.itemName || '',
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercentage: item.taxPercentage ?? payload.gstPercentage ?? 18,
          total: item.total ?? calcLineTotal(item.quantity, item.unitPrice),
          unit: item.unit || 'Nos',
        }))
      );
    }
    if (payload.deliveryAddress) {
      setDeliveryAddress(payload.deliveryAddress);
      setPoTermsDetails((prev) => ({ ...prev, siteAddress: payload.deliveryAddress || prev.siteAddress }));
    }
    if (payload.expectedDeliveryDate) setExpectedDeliveryDate(payload.expectedDeliveryDate);
    if (payload.paymentTerms) setPaymentTerms(payload.paymentTerms);
    if (payload.incoterms) setIncoterms(normalizeIncoterm(String(payload.incoterms)));
    if (payload.gstPercentage != null) setGstPercentage(payload.gstPercentage);
    if (payload.specialInstructions) setSpecialInstructions(payload.specialInstructions);
    if (payload.poType) setPoType(coercePoType(payload.poType, documentType));
    if (payload.entity) setEntity(payload.entity);
    if (payload.letterheadHeader) setLetterheadHeader(payload.letterheadHeader);
    if (payload.referencePoNumber) setReferencePoNumber(payload.referencePoNumber);
    if (payload.termsClauses?.length) {
      setTermsClauses(stripQuoteNoFromTermsClauses(payload.termsClauses as PoLetterheadClause[]));
    }
    if (payload.annexureClauses?.length) setAnnexureClauses(payload.annexureClauses);
    if (payload.poNumber) setImportedPoNumber(payload.poNumber);
    if (payload.vendorName) setImportedVendorName(payload.vendorName);
    if (payload.vendorEmail) setImportedVendorEmail(payload.vendorEmail);
    if (payload.skipApproval) setSkipApproval(true);
  }, []);

  useEffect(() => {
    if (isEditMode || !pr) return;

    // CSV import from Purchase Requests takes priority over PR line items
    if (fromCsvParam === 'csv' && !csvAppliedRef.current) {
      const payload = consumePoCsvImport();
      if (payload) {
        csvAppliedRef.current = true;
        applyCsvImportPayload(payload);
        return;
      }
    }

    // Reference PO path will load its own line items
    if (refPoParam?.trim()) return;

    if (!pr.lineItems?.length) return;
    if (prLineItemsHydratedRef.current || userEditedDraftRef.current) return;
    prLineItemsHydratedRef.current = true;
    const mapped = pr.lineItems.map((item) => ({
      id: item.id,
      itemName: plainTextFromHtml(item.description || ''),
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercentage: 18,
      total: calcLineTotal(item.quantity, item.unitPrice),
      unit: item.unit || 'Nos',
    }));
    lineItemsDraftRef.current = mapped;
    setLineItems(mapped);
  }, [pr, isEditMode, fromCsvParam, refPoParam, applyCsvImportPayload]);

  // Auto-import reference PO when opened from Purchase Requests with ?refPo=
  useEffect(() => {
    if (isEditMode || !pr || !refPoParam?.trim() || referencePoLoaded) return;
    void loadPoDetailsByNumber(refPoParam.trim());
  }, [isEditMode, pr, refPoParam, referencePoLoaded, loadPoDetailsByNumber]);

  const validateBeforeSend = (): boolean => {
    if ((!numericPrId && !editPoId && !isManualPoFlow) || !pr) return false;
    if (!String(poTermsDetails.subject || '').trim()) {
      alert(`Please enter ${documentType === 'work_order' ? 'Work Order' : 'Purchase Order'} Subject`);
      setActiveTab('details');
      return false;
    }
    if (isManualPoFlow) {
      const recommended = findRecommendedManualQuote(manualComparisonRounds);
      const vendorName = (recommended?.vendorName || manualVendorName).trim();
      const vendorEmail = (recommended?.vendorEmail || manualVendorEmail).trim();
      if (!vendorName) {
        alert('Please select or enter a vendor (mark recommended in vendor comparison)');
        setActiveTab('details');
        return false;
      }
      if (!vendorEmail) {
        alert('Please enter vendor email');
        setActiveTab('details');
        return false;
      }
      if (!resolvedManualEntityId) {
        alert('Please select an entity for PO / WO numbering');
        setActiveTab('details');
        return false;
      }
    }
    if (!skipApproval && !letterheadId) {
      alert('Please select a letterhead entity');
      setActiveTab('terms');
      return false;
    }
    if (!skipApproval && letterheadLocations.length > 0 && !letterheadLocationKey) {
      alert('Please select a location for the letterhead entity');
      setActiveTab('terms');
      return false;
    }
    if (!poDate) {
      alert(`Please select ${documentType === 'work_order' ? 'WO' : 'PO'} date`);
      setActiveTab('details');
      return false;
    }
    if (!(poTermsDetails.siteAddress || deliveryAddress).trim()) {
      alert('Please select site / delivery address');
      setActiveTab('details');
      return false;
    }
    if (!expectedDeliveryDate) {
      alert('Please select expected delivery date');
      setActiveTab('details');
      return false;
    }
    return true;
  };

  /** Create / draft Save that goes to SCM Manager for approval */
  const needsScmManagerConfirm =
    !skipApproval &&
    !isBuyerVerifyEdit &&
    (!isEditMode || poEditStatus === 'draft');

  const handleSendForApproval = () => {
    if (!validateBeforeSend()) return;
    if (needsScmManagerConfirm) {
      setShowScmConfirm(true);
      return;
    }
    void executeSendForApproval();
  };

  const executeSendForApproval = async () => {
    if ((!numericPrId && !editPoId && !isManualPoFlow) || !pr) return;
    setShowScmConfirm(false);
    setSubmitting(true);
    try {
      flushLiveEditors();
      await new Promise((r) => window.setTimeout(r, 80));
      const { details, termsToSave, annexureToSave, annexureIiLive, lineItemsLive } = collectLiveDraft();
      const annexureIiToSave = annexureIiLive.filter((row) => !annexureIiRowIsEmpty(row));
      const payload: Record<string, unknown> = {
        skipLetterheadMaster: true,
        lineItems: lineItemsLive.map((i) => ({
          itemName: i.itemName || '',
          description: i.description,
          quantity: i.quantity,
          unit: i.unit || 'Nos',
          unitPrice: i.unitPrice,
          taxPercentage: i.taxPercentage || 0,
          discount: 0,
        })),
        deliveryAddress: details.siteAddress || deliveryAddress,
        expectedDeliveryDate,
        poDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        gstPercentage: effectiveGstPercentage,
        poType,
        letterheadHeader,
        letterheadId: letterheadId || undefined,
        letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || undefined,
        locationName: details.locationName || undefined,
        currency,
        entity,
        headerLogo,
        footerLogo,
        terms: filterNonEmptyClauses(
          withSyncedQuoteNo(termsToSave, {
            ...details,
            paymentTermsText: details.paymentTermsText || paymentTerms,
            siteAddress: details.siteAddress || deliveryAddress,
            letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || '',
            buyerGstNo: details.buyerGstNo || locationGstNo || '',
          }).terms
        ),
        annexure: filterNonEmptyClauses(annexureToSave),
        annexureIiRows: annexureIiToSave,
        annexureIiHtml: serializeAnnexureIi(annexureIiToSave),
        poTermsDetails: withSyncedQuoteNo(termsToSave, {
          ...details,
          paymentTermsText: details.paymentTermsText || paymentTerms,
          siteAddress: details.siteAddress || deliveryAddress,
          letterheadLocationId: details.letterheadLocationId || letterheadLocationKey || '',
          buyerGstNo: details.buyerGstNo || locationGstNo || '',
        }).poTermsDetails,
        referencePoNumber: referencePoNumber.trim() || undefined,
        changeSummary: changeSummary.trim() || undefined,
        purchaseType: documentType,
        poNumber: poNumber.trim() || undefined,
      };

      if (isManualPoFlow) {
        const recommended = findRecommendedManualQuote(manualComparisonRounds);
        payload.vendorName = (recommended?.vendorName || manualVendorName).trim();
        payload.vendorEmail = (recommended?.vendorEmail || manualVendorEmail).trim();
        const entityFields = manualEntityPayload(manualEntityId, selectedManualEntity);
        payload.selectedEntityId = entityFields.selectedEntityId;
        payload.entityId = entityFields.entityId;
        payload.entity = entityFields.entity;
        payload.title = manualPrDetails.title.trim() || details.subject || '';
        payload.department = manualPrDetails.department.trim();
        payload.requester = manualPrDetails.requester.trim();
        payload.manualPrDetails = manualPrDetails;
        payload.comparisonRounds = await Promise.all(
          manualComparisonRounds.map(async (round) => ({
            round: round.round,
            label: round.label.trim() || `Round ${round.round}`,
            notes: round.notes.trim(),
            vendorQuotes: await Promise.all(
              round.vendorQuotes.map(async (row, idx) => ({
                vendorId: row.vendorId,
                vendorName: row.vendorName.trim(),
                vendorEmail: row.vendorEmail.trim(),
                quotedPrice: Number(row.quotedPrice) || 0,
                leadTime: row.leadTime.trim(),
                paymentTerms: row.paymentTerms,
                recommended: row.recommended,
                round: round.round,
                sortOrder: idx,
                files: await Promise.all(row.files.map((file) => fileToAttachmentPayload(file))),
              }))
            ),
          }))
        );
      }

      if (skipApproval && !isManualMode) {
        payload.skipApproval = true;
        payload.legacyImport = true;
        if (importedPoNumber.trim()) payload.poNumber = importedPoNumber.trim();
        if (importedVendorName.trim()) payload.vendorName = importedVendorName.trim();
        if (importedVendorEmail.trim()) payload.vendorEmail = importedVendorEmail.trim();
      }

      if (isEditMode && editPoId) {
        await poApi.update(editPoId, payload);
        navigate(editReturnPath);
        return;
      }

      const res = isManualPoFlow && !isEditMode
        ? await poApi.createManual(payload)
        : await poApi.create(numericPrId!, payload);
      const data = res.data as { poNumber: string; id: number };
      setPoNumber(data.poNumber);
      setCreatedPoId(data.id);
      try {
      const blob = await poApi.fetchPdfBlob(data.id);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
      setPageMode('pdf');
      } catch (pdfErr) {
        // PO created successfully; PDF may still be regenerating
        setShowSuccessModal(true);
        alert(
          pdfErr instanceof Error
            ? `PO created, but PDF could not be opened: ${pdfErr.message}`
            : 'PO created, but PDF could not be opened'
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    formatMoney(n, currency, { maximumFractionDigits: 0 });

  const isWorkOrder = documentType === 'work_order';
  const docLabel = isWorkOrder ? 'Work Order' : 'Purchase Order';
  const docNoLabel = isWorkOrder ? 'WO No' : 'PO No';

  if (!numericPrId && !isEditMode && !isManualMode) {
    return (
      <DashboardLayout>
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Create PO</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create a purchase order or work order from a ready PR, or start a manual PO
          </p>
        </div>
        <PurchaseRequestsPanel />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96 text-gray-500">Loading PR details...</div>
      </DashboardLayout>
    );
  }

  if (pageMode === 'pdf' && pdfPreviewUrl && createdPoId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-100 flex flex-col">
          <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{poNumber}</h1>
              <p className="text-sm text-gray-500">Refex PO document — sent for SCM Manager approval</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/scm/create-po')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                Back to Create PO
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setPdfDownloading(true);
                    const blob = await poApi.fetchPdfBlob(createdPoId);
                    triggerBlobDownload(blob, `${poNumber || 'PO'}.pdf`);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Could not download PDF');
                  } finally {
                    setPdfDownloading(false);
                  }
                }}
                disabled={pdfDownloading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {pdfDownloading ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
          <iframe title="PO PDF Preview" src={pdfPreviewUrl} className="flex-1 w-full min-h-[calc(100vh-120px)] border-0" />
        </div>
      </DashboardLayout>
    );
  }

  if (!pr || loadError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-3xl text-amber-500"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isEditMode ? 'Purchase Order Not Found' : 'Purchase Request Not Found'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">{loadError || "The PR you're trying to create a PO for doesn't exist."}</p>
            <button
              onClick={() => navigate(isEditMode ? editReturnPath : '/scm/create-po')}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
            >
              {isBuyerVerifyEdit ? 'Back to Final Verify' : isEditMode ? 'Back' : 'Back to Create PO'}
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const canSaveDraft = !isEditMode || poEditStatus === 'draft';
  const isPendingManagerApproval =
    poEditStatus === 'pending_approval' || poEditStatus === 'pendingapproval';
  const isManagerPoReview =
    user?.role === 'SCM Manager' && isEditMode && isPendingManagerApproval;
  const activePrId = pr?.id || numericPrId || null;
  const isBuyerCreatePoSendBack =
    (user?.role === 'SCM Buyer' || user?.role === 'Super Admin') &&
    Boolean(activePrId) &&
    !isManualMode &&
    !isBuyerVerifyEdit &&
    !isManagerPoReview &&
    poEditStatus !== 'pending_approval' &&
    poEditStatus !== 'pendingapproval' &&
    poEditStatus !== 'pending_buyer_verify' &&
    poEditStatus !== 'pending_buyerverify';

  const handleManagerPoAction = async (remarks: string) => {
    if (!editPoId || !managerModal) return;
    try {
      if (managerModal === 'sendback') {
        const res = await poApi.sendBack(editPoId, remarks);
        alert(res.message || `${poNumber || 'PO'} sent back to SCM Buyer for revision`);
      } else {
        await poApi.reject(editPoId, remarks);
        alert(`${poNumber || 'PO'} has been rejected`);
      }
      setManagerModal(null);
      navigate(editReturnPath);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
      throw err;
    }
  };

  const handleBuyerSendBack = async (remarks: string, options?: { returnTo?: string }) => {
    if (!activePrId || !options?.returnTo) {
      throw new Error('Select a previous stage to send back to');
    }
    const res = await prApi.adminSendBack(activePrId, {
      returnTo: options.returnTo,
      remarks: remarks.trim(),
    });
    setShowBuyerSendBack(false);
    alert(res.message || 'PR sent back successfully');
    navigate('/scm/create-po');
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/60">
        {/* ── Top Header Bar ── */}
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
          <div className="px-3 sm:px-6 lg:px-8 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate(isEditMode ? editReturnPath : '/scm/create-po')}
                className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 bg-white hover:bg-gray-50 transition-colors cursor-pointer text-gray-500 shrink-0"
                aria-label="Back"
              >
                <i className="ri-arrow-left-line"></i>
              </button>
              <h1 className="text-lg font-bold text-slate-900 whitespace-nowrap">
                {isEditMode ? `Edit ${docLabel}` : `Create ${docLabel}`}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                  isBuyerVerifyEdit
                    ? 'bg-blue-100 text-blue-800'
                    : isEditMode && poEditStatus && poEditStatus !== 'draft'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-orange-100 text-orange-700'
                }`}
              >
                {isBuyerVerifyEdit
                  ? 'Buyer Final Verify'
                  : isEditMode && poEditStatus && poEditStatus !== 'draft'
                    ? 'Pending Review'
                    : 'Draft'}
              </span>
              {draftSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <i className="ri-checkbox-circle-fill"></i> Saved
                </span>
              )}

              <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
                {isEditMode && (
                  <input
                    type="text"
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    placeholder="Change summary"
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-36 bg-white"
                  />
                )}
                {isManagerPoReview && (
                  <>
                    <button
                      type="button"
                      onClick={() => setManagerModal('reject')}
                      disabled={submitting}
                      className="px-3.5 py-1.5 border border-red-200 bg-white text-red-700 rounded-md hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                    >
                      <i className="ri-close-circle-line mr-1"></i>
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagerModal('sendback')}
                      disabled={submitting}
                      className="px-3.5 py-1.5 border border-orange-200 bg-white text-orange-700 rounded-md hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                    >
                      <i className="ri-arrow-go-back-line mr-1"></i>
                      Send Back
                    </button>
                  </>
                )}
                {isBuyerCreatePoSendBack && (
                  <button
                    type="button"
                    onClick={() => setShowBuyerSendBack(true)}
                    disabled={submitting}
                    className="px-3.5 py-1.5 border border-orange-200 bg-white text-orange-700 rounded-md hover:bg-orange-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                  >
                    <i className="ri-arrow-go-back-line mr-1"></i>
                    Send Back
                  </button>
                )}
                {canSaveDraft && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={submitting}
                    className="px-3.5 py-1.5 border border-gray-300 bg-white text-slate-800 rounded-md hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save as Draft'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="px-3.5 py-1.5 border border-gray-300 bg-white text-slate-800 rounded-md hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
                >
                  Preview {docLabel === 'Work Order' ? 'WO' : 'PO'}
                </button>
                {(editPoId || numericPrId || isManualPoFlow) && (
                  <button
                    type="button"
                    onClick={() => void handleOpenLivePdf()}
                    disabled={pdfDownloading || submitting}
                    className="px-3.5 py-1.5 border border-gray-300 bg-white text-slate-800 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                  >
                    <i className="ri-file-pdf-line"></i>
                    {pdfDownloading ? 'PDF…' : 'PDF'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSendForApproval}
                  disabled={submitting}
                  className="px-3.5 py-1.5 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  <i className={isEditMode ? 'ri-save-3-line' : 'ri-send-plane-fill'}></i>
                  {submitting
                    ? 'Saving...'
                    : isEditMode
                      ? 'Save'
                      : isManualMode
                        ? `Save ${docLabel === 'Work Order' ? 'WO' : 'PO'}`
                        : skipApproval
                          ? `Create ${docLabel === 'Work Order' ? 'WO' : 'PO'}`
                          : 'Send for Approval'}
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <label className="inline-flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 font-medium">{docNoLabel}</span>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => handlePoNumberChange(e.target.value)}
                  onBlur={() => setPoNumber((v) => v.trim().slice(0, 40))}
                  placeholder="Auto on save"
                  maxLength={40}
                  className="font-semibold text-teal-700 bg-white border border-gray-200 rounded-md px-2 py-1 w-[13rem] text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </label>
              <span>
                Date: <span className="font-semibold text-slate-700">{formatPoDateLabel(poDate)}</span>
              </span>
              <span className="truncate max-w-[220px]" title={isManualPoFlow ? manualVendorName : pr.recommendedVendor}>
                Vendor:{' '}
                <span className="font-semibold text-slate-700">
                  {isManualPoFlow ? manualVendorName || '—' : pr.recommendedVendor}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 px-3 sm:px-6 lg:px-8">
            {(
              [
                { key: 'details' as const, n: 1, title: 'Basic Details', sub: 'PO number, site & vendor' },
                { key: 'lineItems' as const, n: 2, title: 'Line Items', sub: 'Qty, price & GST' },
                { key: 'terms' as const, n: 3, title: 'Terms & Conditions', sub: 'Letterhead, clauses & annexure' },
                { key: 'preview' as const, n: 4, title: 'Preview', sub: 'Review before send' },
              ]
            ).map((step) => {
              const active = activeTab === step.key;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setActiveTab(step.key)}
                  className={`flex items-center gap-2.5 px-2 sm:px-3 pb-2.5 pt-1 cursor-pointer border-b-[3px] transition-colors text-left ${
                    active ? 'border-teal-600 bg-teal-50/40' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                      active ? 'bg-teal-600 text-white' : 'bg-gray-200 text-slate-500'
                    }`}
                  >
                    {step.n}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold leading-tight ${active ? 'text-teal-700' : 'text-slate-600'}`}>
                      {step.title}
                    </span>
                    <span className={`hidden sm:block text-[11px] mt-0.5 leading-tight ${active ? 'text-teal-600' : 'text-gray-400'}`}>
                      {step.sub}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* ══════════════════════════════════════════
              TAB 1 — BASIC DETAILS
          ══════════════════════════════════════════ */}
          {activeTab === 'details' && (
            <div className="space-y-5">

                {/* Basic Details — PR, PO number, site & delivery */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                      <i className="ri-file-text-line text-teal-600"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Basic Details</h3>
                      <p className="text-xs text-gray-500">
                        {docLabel} number, PR reference, site and delivery details
                      </p>
                    </div>
                  </div>

                  {isManualPoFlow && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Entity for document number</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Select entity first for PO / WO numbering — no manager approval; data entry only
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Entity <span className="text-red-500">*</span>
                        </label>
                        <SearchCreateField
                          options={entityOptions.map((ent) => ({
                            id: ent.id,
                            label: formatEntityLabel(ent),
                            subLabel: ent.costCenter || undefined,
                          }))}
                          displayValue={
                            selectedManualEntity ? formatEntityLabel(selectedManualEntity) : ''
                          }
                          selectedId={manualEntityId || null}
                          placeholder="Search entity by code, name, cost center…"
                          addNoun="entity"
                          onSelect={(opt) => {
                            const id = Number(opt.id);
                            setManualEntityId(id);
                            const selected = entityOptions.find((x) => x.id === id);
                            if (selected) {
                              setPr((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      entityId: selected.id,
                                      entityName: selected.name,
                                      entityCode: selected.code,
                                    }
                                  : prev
                              );
                              if (!entity) setEntity(selected.name);
                            }
                          }}
                          onClear={() => {
                            setManualEntityId('');
                            setPr((prev) =>
                              prev
                                ? { ...prev, entityId: null, entityName: '', entityCode: '' }
                                : prev
                            );
                          }}
                        />
                        {entityOptions.length === 0 ? (
                          <p className="text-xs text-amber-600 mt-1.5">
                            No entities loaded. Check Entity Master or refresh the page.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {isManualPoFlow && (
                    <ManualPoContextSection
                      prDetails={manualPrDetails}
                      onPrDetailsChange={setManualPrDetails}
                      comparisonRounds={manualComparisonRounds}
                      onComparisonRoundsChange={setManualComparisonRounds}
                      vendors={masterVendors}
                      currencySymbol={moneySymbol}
                    />
                  )}

                  {!isManualPoFlow && (
                    <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 p-4 sm:p-5 text-white">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <p className="text-teal-100 text-xs font-medium uppercase tracking-wider mb-1">Purchase Request</p>
                          <h2 className="text-lg font-bold">{pr.title}</h2>
                          <div className="flex items-center gap-4 mt-2 text-sm text-teal-100 flex-wrap">
                            <span className="flex items-center gap-1.5"><i className="ri-hashtag"></i>{pr.prNumber}</span>
                            {(pr.entityCode || pr.entityName) && (
                              <span className="flex items-center gap-1.5">
                                <i className="ri-building-2-line"></i>
                                {pr.entityCode ? `${pr.entityCode}${pr.entityName ? ` — ${pr.entityName}` : ''}` : pr.entityName}
                              </span>
                            )}
                            <span className="flex items-center gap-1.5"><i className="ri-building-line"></i>{pr.department}</span>
                            <span className="flex items-center gap-1.5"><i className="ri-user-line"></i>{pr.requester}</span>
                            <span className="flex items-center gap-1.5"><i className="ri-calendar-line"></i>Required: {pr.requiredDate}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-teal-100 text-xs mb-1">Estimated Value</p>
                          <p className="text-2xl font-bold">{fmt(pr.amount ?? grandTotal)}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                            {pr.requestType}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 flex items-center justify-center bg-teal-50 rounded-lg shrink-0">
                        <i className="ri-search-eye-line text-teal-600 text-lg"></i>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900">
                          Load {docLabel} Details by Number
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Enter an existing {docNoLabel} to auto-fill delivery, terms, letterhead, line items and POD fields
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={referencePoNumber}
                        onChange={(e) => {
                          setReferencePoNumber(e.target.value);
                          setReferencePoError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadPoDetailsByNumber();
                          }
                        }}
                        placeholder="e.g. PO-RIL-2026-27-0001"
                        className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                        disabled={referencePoLoading}
                      />
                      <button
                        type="button"
                        onClick={() => void loadPoDetailsByNumber()}
                        disabled={referencePoLoading || !referencePoNumber.trim()}
                        className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        {referencePoLoading ? (
                          <>
                            <i className="ri-loader-4-line animate-spin"></i> Loading...
                          </>
                        ) : (
                          <>
                            <i className="ri-download-cloud-2-line"></i> Auto Fill
                          </>
                        )}
                      </button>
                    </div>
                    {referencePoError && (
                      <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                        <i className="ri-error-warning-line"></i>
                        {referencePoError}
                      </p>
                    )}
                    {referencePoLoaded && !referencePoError && (
                      <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5 flex-wrap">
                        <i className="ri-checkbox-circle-fill"></i>
                        Loaded <span className="font-semibold">{referencePoLoaded.poNumber}</span>
                        {referencePoLoaded.vendorName ? (
                          <span className="text-gray-500">· {referencePoLoaded.vendorName}</span>
                        ) : null}
                        {referencePoLoaded.prNumber ? (
                          <span className="text-gray-500">· PR {referencePoLoaded.prNumber}</span>
                        ) : null}
                        {referencePoLoaded.grandTotal ? (
                          <span className="text-gray-500">· {fmt(referencePoLoaded.grandTotal)}</span>
                        ) : null}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {docNoLabel}
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => handlePoNumberChange(e.target.value)}
                        onBlur={() => setPoNumber((v) => v.trim().slice(0, 40))}
                        placeholder="Auto on save"
                        maxLength={40}
                        className="w-full px-3.5 py-2.5 border border-teal-200 rounded-lg text-sm font-semibold text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-teal-50/40"
                      />
                      <p className="text-[11px] text-gray-500 mt-1">Leave blank to auto-generate on first save</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {docNoLabel === 'WO No' ? 'WO Date' : 'PO Date'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={poDate}
                        onChange={(e) => setPoDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {docLabel} Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={poTermsDetails.subject || ''}
                        onChange={(e) => updatePoTermsField('subject', e.target.value)}
                        placeholder="e.g. Supply of equipment for site"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Site, project manager, invoicing and mailing details
                    </p>
                    <AddableSelect
                        label="Site / Delivery Address"
                        icon="ri-map-pin-2-line"
                        multiline
                        value={poTermsDetails.siteAddress || deliveryAddress}
                        placeholder="Select site / delivery address"
                        options={siteAddressOptions.map((opt) => ({
                          id: opt.id,
                          label: opt.label,
                        }))}
                        adding={addingSiteAddress}
                        onOpenAdd={() => {
                          setSiteLookupError('');
                          setAddingSiteContact(false);
                          setAddingProjectManager(false);
                          setAddingSiteAddress(true);
                          setNewSiteAddress(poTermsDetails.siteAddress || deliveryAddress || '');
                        }}
                        onCloseAdd={() => {
                          setAddingSiteAddress(false);
                          setSiteLookupError('');
                        }}
                        onSelect={(opt) => updatePoTermsField('siteAddress', opt.label)}
                        addForm={
                          <>
                            <textarea
                              value={newSiteAddress}
                              onChange={(e) => setNewSiteAddress(e.target.value)}
                              rows={4}
                              placeholder="Enter site address"
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                            />
                            {siteLookupError && addingSiteAddress ? (
                              <p className="text-xs text-red-600">{siteLookupError}</p>
                            ) : null}
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingSiteAddress(false);
                                  setSiteLookupError('');
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveSiteAddressLookup()}
                                disabled={savingSiteLookup}
                                className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-60 cursor-pointer"
                              >
                                {savingSiteLookup ? 'Saving...' : 'Add'}
                              </button>
                            </div>
                          </>
                        }
                      />
                        <AddableSelect
                          label="Site Contact Person"
                          icon="ri-user-3-line"
                          value={poTermsDetails.siteContactPerson}
                          placeholder="Select site contact person"
                          options={siteContactOptions.map((opt) => ({
                            id: opt.id,
                            label: opt.label,
                            subLabel: [opt.email, opt.phone].filter(Boolean).join(' · '),
                            email: opt.email,
                            phone: opt.phone,
                          }))}
                          adding={addingSiteContact}
                          onOpenAdd={() => {
                            setSiteLookupError('');
                            setAddingSiteAddress(false);
                            setAddingProjectManager(false);
                            setAddingSiteContact(true);
                            setNewSiteContact({
                              label: poTermsDetails.siteContactPerson || '',
                              email: poTermsDetails.siteContactEmail || '',
                              phone: poTermsDetails.siteContactPhone || '',
                            });
                          }}
                          onCloseAdd={() => {
                            setAddingSiteContact(false);
                            setSiteLookupError('');
                          }}
                          onSelect={(opt) => {
                            setPoTermsDetails((prev) => ({
                              ...prev,
                              siteContactPerson: opt.label,
                              siteContactEmail: opt.email || '',
                              siteContactPhone: opt.phone || '',
                            }));
                          }}
                          addForm={
                            <>
                              <input
                                type="text"
                                value={newSiteContact.label}
                                onChange={(e) => setNewSiteContact((prev) => ({ ...prev, label: e.target.value }))}
                                placeholder="Contact name"
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                              <input
                                type="email"
                                value={newSiteContact.email}
                                onChange={(e) => setNewSiteContact((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                                <input
                                type="text"
                                value={newSiteContact.phone}
                                onChange={(e) => setNewSiteContact((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="Phone"
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                              {siteLookupError && addingSiteContact ? (
                                <p className="text-xs text-red-600">{siteLookupError}</p>
                              ) : null}
                              <div className="flex items-center justify-end gap-2">
                              <button
                                  type="button"
                                  onClick={() => {
                                    setAddingSiteContact(false);
                                    setSiteLookupError('');
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                                >
                                  Cancel
                              </button>
                                <button
                                  type="button"
                                  onClick={() => void saveSiteContactLookup()}
                                  disabled={savingSiteLookup}
                                  className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-60 cursor-pointer"
                                >
                                  {savingSiteLookup ? 'Saving...' : 'Add'}
                                </button>
                              </div>
                            </>
                          }
                        />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Site Contact Person&apos;s Mail</label>
                          <input
                            type="email"
                            value={poTermsDetails.siteContactEmail}
                            onChange={(e) => updatePoTermsField('siteContactEmail', e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Site Contact Person Phone No</label>
                          <input
                            type="text"
                            value={poTermsDetails.siteContactPhone}
                            onChange={(e) => updatePoTermsField('siteContactPhone', e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                  </div>

                    <AddableSelect
                      label="Project Manager at HO"
                      icon="ri-user-star-line"
                      value={poTermsDetails.projectManagerHo}
                      placeholder="Select project manager"
                      options={projectManagerOptions.map((opt) => ({
                        id: opt.id,
                        label: opt.label,
                        subLabel: [opt.email, opt.phone].filter(Boolean).join(' · '),
                        email: opt.email,
                        phone: opt.phone,
                      }))}
                      adding={addingProjectManager}
                      onOpenAdd={() => {
                        setSiteLookupError('');
                        setAddingSiteAddress(false);
                        setAddingSiteContact(false);
                        setAddingProjectManager(true);
                        setNewProjectManager({
                          label: poTermsDetails.projectManagerHo || '',
                          email: poTermsDetails.projectManagerEmail || '',
                          phone: poTermsDetails.projectManagerContact || '',
                        });
                      }}
                      onCloseAdd={() => {
                        setAddingProjectManager(false);
                        setSiteLookupError('');
                      }}
                      onSelect={(opt) => {
                        setPoTermsDetails((prev) => ({
                          ...prev,
                          projectManagerHo: opt.label,
                          projectManagerEmail: opt.email || '',
                          projectManagerContact: opt.phone || '',
                        }));
                      }}
                      addForm={
                        <>
                          <input
                            type="text"
                            value={newProjectManager.label}
                            onChange={(e) => setNewProjectManager((prev) => ({ ...prev, label: e.target.value }))}
                            placeholder="Project manager name"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <input
                            type="email"
                            value={newProjectManager.email}
                            onChange={(e) => setNewProjectManager((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="Email"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <input
                            type="text"
                            value={newProjectManager.phone}
                            onChange={(e) => setNewProjectManager((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="Phone"
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          {siteLookupError && addingProjectManager ? (
                            <p className="text-xs text-red-600">{siteLookupError}</p>
                          ) : null}
                          <div className="flex items-center justify-end gap-2">
                      <button
                              type="button"
                              onClick={() => {
                                setAddingProjectManager(false);
                                setSiteLookupError('');
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                            >
                              Cancel
                      </button>
                            <button
                              type="button"
                              onClick={() => void saveProjectManagerLookup()}
                              disabled={savingSiteLookup}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-md disabled:opacity-60 cursor-pointer"
                            >
                              {savingSiteLookup ? 'Saving...' : 'Add'}
                            </button>
                        </div>
                        </>
                      }
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Project Manager&apos;s Contact</label>
                              <input
                          type="text"
                          value={poTermsDetails.projectManagerContact}
                          onChange={(e) => updatePoTermsField('projectManagerContact', e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                            </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Project Manager&apos;s Email</label>
                        <input
                          type="email"
                          value={poTermsDetails.projectManagerEmail}
                          onChange={(e) => updatePoTermsField('projectManagerEmail', e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                          </div>
                        </div>

                    {/* Addresses */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Invoicing Address</label>
                        {(poTermsDetails.locationName || poTermsDetails.buyerGstNo || locationGstNo) && (
                          <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-teal-900 space-y-1 mb-1.5">
                            {poTermsDetails.locationName && (
                              <p>
                                <span className="font-semibold">Location:</span> {poTermsDetails.locationName}
                              </p>
                            )}
                            <p>
                              <span className="font-semibold">GSTIN:</span>{' '}
                              <span className="font-mono">
                                {poTermsDetails.buyerGstNo || locationGstNo || '—'}
                              </span>
                            </p>
                            {footerLogo &&
                              (footerLogo.startsWith('data:image/') ||
                                /^https?:\/\//i.test(footerLogo)) && (
                                <div className="pt-1">
                                  <p className="font-semibold mb-1">Footer</p>
                                  <img
                                    src={footerLogo}
                                    alt="Location footer"
                                    className="max-h-10 max-w-[180px] object-contain"
                                  />
                        </div>
                              )}
                      </div>
                        )}
                        <RichTextEditor
                          editorKey={`inv-addr-${letterheadId || 'none'}-${letterheadLocationKey || 'none'}`}
                          value={poTermsDetails.invoicingAddress}
                          onChange={(html) => updatePoTermsField('invoicingAddress', html)}
                          placeholder="Enter invoicing address. Pasted text is always normal (no bold or other fonts)."
                          minHeight={120}
                          plainTextOnly
                        />
                    </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Mailing Address</label>
                        <textarea
                          value={poTermsDetails.mailingAddress}
                          onChange={(e) => updatePoTermsField('mailingAddress', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                  </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Reason For Cancellation</label>
                      <textarea
                          value={poTermsDetails.reasonForCancellation}
                          onChange={(e) => updatePoTermsField('reasonForCancellation', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                      />
                    </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Quote No
                        </label>
                        <input
                          type="text"
                          value={poTermsDetails.quoteNo || ''}
                          onChange={(e) => updatePoTermsField('quoteNo', e.target.value)}
                          placeholder="Vendor quotation number"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <p className="text-[11px] text-gray-500">
                          Prints on the PDF header as Quote No. It is not listed in Terms &amp; Conditions.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Payment &amp; commercial terms
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Incoterms® 2020
                        </label>
                        <select
                          value={normalizeIncoterm(incoterms)}
                          onChange={(e) => setIncoterms(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                        >
                          {INCOTERMS_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                          Expected Delivery Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={expectedDeliveryDate}
                          onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
                        <i className="ri-sticky-note-line text-amber-600"></i>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">Special Instructions &amp; Notes</h4>
                    </div>
                    <textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      rows={5}
                      placeholder="Add any special instructions, quality requirements, packaging notes, or conditions for the vendor..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-gray-50/50"
                    />
                    <p className="text-xs text-gray-400">{specialInstructions.length}/500 characters</p>
                  </div>
                </div>

            </div>
                  )}

          {/* ══════════════════════════════════════════
              TAB 2 — LINE ITEMS
          ══════════════════════════════════════════ */}
          {activeTab === 'lineItems' && (
            <div className="space-y-5">
              {/* Line Items — full width */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Line Items</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''} — edit qty &amp; unit price as needed</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Currency</span>
                      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
                        {CURRENCY_OPTIONS.map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => setCurrency(opt.code)}
                            title={opt.label}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                              currency === opt.code
                                ? 'bg-teal-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            {opt.symbol} {opt.code}
                          </button>
                        ))}
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {lineItems.length} Items
                    </span>
                    <button
                      onClick={handleAddLineItem}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap"
                    >
                      <i className="ri-add-line text-sm"></i> Add Item
                    </button>
                  </div>
                </div>

                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[940px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-9">#</th>
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide min-w-[140px]">Item Name</th>
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">Item Description</th>
                        <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-20">Qty</th>
                        <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-24">Unit</th>
                        <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-36">Unit Price</th>
                        <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-24">GST</th>
                        <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50/60 transition-colors group align-top">
                          <td className="px-2 py-2.5 align-top">
                            <span className="mt-1 w-6 h-6 flex items-center justify-center bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <input
                              type="text"
                              value={item.itemName || ''}
                              onChange={(e) => handleItemNameChange(item.id, e.target.value)}
                              placeholder="Item name"
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <RichTextEditor
                              editorKey={`li-desc-${item.id}`}
                              value={item.description || ''}
                              onChange={(html) => handleDescriptionChange(item.id, html)}
                              placeholder="Item description..."
                              minHeight={56}
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                          <input
                            type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                          <input
                            type="text"
                              value={item.unit || ''}
                              onChange={(e) => handleUnitChange(item.id, e.target.value)}
                              placeholder="Nos"
                              className="w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              title="Unit"
                              aria-label="Unit"
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="relative min-w-[120px]">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-semibold pointer-events-none">
                                {moneySymbol}
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                inputMode="decimal"
                                value={item.unitPrice === 0 ? '' : item.unitPrice}
                                placeholder="0.00"
                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
                                title="Unit Price"
                                aria-label="Unit Price"
                          />
                        </div>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.taxPercentage}
                                onChange={(e) =>
                                  handleTaxPercentageChange(item.id, parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                      </div>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="flex items-start justify-end gap-1.5 pt-1">
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900 tabular-nums leading-6">{fmt(item.total)}</p>
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                  Tax {fmt(calcLineTax(item.total, item.taxPercentage))}
                                </p>
                              </div>
                        <button
                          type="button"
                                onClick={() => handleDeleteLineItem(item.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                                title="Remove item"
                        >
                                <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full">
                                <i className="ri-file-list-3-line text-gray-400 text-lg"></i>
                              </div>
                              <p className="text-sm text-gray-400">No line items yet</p>
                        <button
                                onClick={handleAddLineItem}
                                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap"
                        >
                                <i className="ri-add-line"></i> Add First Item
                        </button>
                      </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      onClick={handleAddLineItem}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-teal-400 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer text-xs font-medium whitespace-nowrap"
                    >
                      <i className="ri-add-line text-sm"></i> Add Another Item
                    </button>
                    <div className="w-full sm:w-72 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-semibold text-gray-900">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tax (per line)</span>
                        <span className="font-semibold text-gray-900">{fmt(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-bold text-gray-900">Grand Total</span>
                        <span className="text-lg font-bold text-teal-600">{fmt(grandTotal)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Amount In Words</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{amountInWords}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('terms')}
                  className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold flex items-center gap-2"
                >
                  Continue to Terms &amp; Conditions
                  <i className="ri-arrow-right-line"></i>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 3 — TERMS & CONDITIONS
          ══════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="space-y-5">
            {/* Document Type — Purchase Order / Work Order (drives all headings below) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <label className="block text-xs font-semibold text-gray-600 mb-2">
                Document Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    {
                      id: 'purchase_order' as const,
                      label: 'Purchase Order',
                      hint: 'Number: PO-Entity-FY-####',
                      icon: 'ri-shopping-bag-3-line',
                    },
                    {
                      id: 'work_order' as const,
                      label: 'Work Order',
                      hint: 'Number: WO-Entity-FY-####',
                      icon: 'ri-tools-line',
                    },
                  ]
                ).map((opt) => (
                      <button
                    key={opt.id}
                        type="button"
                    onClick={() => {
                      const nextDoc = opt.id;
                      const nextType = alignTemplateWithDocument(poType, nextDoc);
                      setDocumentType(nextDoc);
                      prevDocumentTypeRef.current = nextDoc;
                      applyPoTypeTemplate(nextType, nextDoc);
                    }}
                    className={`flex-1 min-w-[160px] px-4 py-3 rounded-xl text-left border transition-colors cursor-pointer ${
                      documentType === opt.id
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <i className={opt.icon}></i>
                      {opt.label}
                    </span>
                    <span
                      className={`block text-[10px] font-normal mt-1 ${
                        documentType === opt.id ? 'text-teal-100' : 'text-gray-400'
                      }`}
                    >
                      {opt.hint}
                    </span>
                      </button>
                ))}
                    </div>
              {pr.purchaseType && pr.purchaseType !== documentType && (
                <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5">
                  <i className="ri-information-line"></i>
                  PR default is {pr.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'} — document type
                  changed for this create.
                </p>
                  )}
                </div>

            {/* Format type + Letterhead */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                    <h3 className="text-sm font-bold text-gray-900">{docLabel} Type</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                      Terms and annexure load from {docLabel} Type Master
                      </p>
                    </div>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    {PO_TYPE_OPTIONS_BY_DOC[documentType].map((option) => (
                        <button
                          key={option.id}
                          type="button"
                        onClick={() => applyPoTypeTemplate(option.id, documentType)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                            poType === option.id
                              ? 'bg-white text-teal-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {letterheadLoading ? (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                      <i className="ri-loader-4-line animate-spin"></i>
                    Loading {PO_TYPE_OPTIONS_BY_DOC[documentType].find((o) => o.id === poType)?.label || 'template'} from PO Type Master...
                  </p>
                ) : templateLoadError ? (
                  <p className="text-xs text-red-600 mt-3">{templateLoadError}</p>
                ) : (
                  <div className="mt-4 p-4 bg-teal-50/50 border border-teal-100 rounded-lg text-sm text-gray-700">
                    <p className="text-xs font-semibold text-teal-800 mb-1">
                      Loaded from PO Type Master: {loadedTemplate?.title || PO_TYPE_OPTIONS_BY_DOC[documentType].find((o) => o.id === poType)?.label}
                    </p>
                    <p className="text-xs text-teal-700 mb-3">
                      {loadedTemplate
                        ? `${loadedTemplate.termsCount} terms · ${loadedTemplate.annexureCount} annexure`
                        : 'Switch Short / Long to load terms and annexure'}
                    </p>
                    {letterheadHeader ? (
                      <div
                        className="prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: letterheadHeader }}
                    />
                    ) : (
                      <p className="text-xs text-gray-400 italic">No header text in this template</p>
                    )}
                  </div>
                )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Letterhead / Entity</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                    Select entity from Letterhead Master — header/footer logos and PO/WO numbering use this entity
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Entity <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={letterheadId === '' ? '' : String(letterheadId)}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : '';
                        if (!id) {
                          applyLetterheadBranding(null);
                          return;
                        }
                        const selected = letterheadOptions.find((o) => o.id === id) || null;
                        applyLetterheadBranding(selected);
                      }}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                    >
                      <option value="">Select letterhead entity...</option>
                      {letterheadOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.entity ? `${opt.name} — ${opt.entity}` : opt.name}
                        </option>
                      ))}
                    </select>
                    {!letterheadOptions.length && (
                      <p className="text-xs text-amber-600 mt-2">
                        No active letterheads. Add one in Masters → Letterhead Master.
                      </p>
                    )}
                  </div>

                {letterheadLocations.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={letterheadLocationKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        const idx = letterheadLocations.findIndex(
                          (l, i) => letterheadLocKey(l, i) === key
                        );
                        if (idx < 0) {
                          applyLetterheadLocation(null);
                          return;
                        }
                        applyLetterheadLocation(letterheadLocations[idx], idx);
                      }}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                    >
                      <option value="">Select location...</option>
                      {letterheadLocations.map((loc, idx) => (
                        <option key={letterheadLocKey(loc, idx)} value={letterheadLocKey(loc, idx)}>
                          {loc.location}
                          {loc.gstNo ? ` — ${loc.gstNo}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1.5">
                      Selecting a location fills GSTIN into Invoicing Address. Footer comes from the letterhead.
                    </p>
                  </div>
                )}

                {(entity || headerLogo || footerLogo || locationGstNo) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Entity</p>
                        <p className="text-sm text-gray-800">{entity || '—'}</p>
                      </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">GSTIN</p>
                      <p className="text-sm font-mono text-gray-800">{locationGstNo || '—'}</p>
                    </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Header Logo</p>
                        {headerLogo && (headerLogo.startsWith('data:image/') || /^https?:\/\//i.test(headerLogo)) ? (
                          <img src={headerLogo} alt="Header logo" className="max-h-12 max-w-full object-contain" />
                        ) : headerLogo && /<[a-z]/i.test(headerLogo) ? (
                          <div className="text-xs" dangerouslySetInnerHTML={{ __html: headerLogo }} />
                        ) : (
                          <p className="text-sm text-gray-400">—</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Footer Logo</p>
                        {footerLogo && (footerLogo.startsWith('data:image/') || /^https?:\/\//i.test(footerLogo)) ? (
                          <img src={footerLogo} alt="Footer logo" className="max-h-12 max-w-full object-contain" />
                        ) : footerLogo && /<[a-z]/i.test(footerLogo) ? (
                          <div className="text-xs" dangerouslySetInnerHTML={{ __html: footerLogo }} />
                        ) : (
                          <p className="text-sm text-gray-400">—</p>
                        )}
                      </div>
                    </div>
                  )}
              </div>
                </div>

            {/* Terms & Annexure — headings follow Purchase Order / Work Order */}
            <div className="w-full space-y-5">
              {letterheadLoading && (
                <p className="text-xs text-teal-700 flex items-center gap-1.5">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Loading terms &amp; annexure from PO Type Master...
                </p>
              )}
              {templateLoadError && (
                <p className="text-xs text-red-600">{templateLoadError}</p>
              )}
              <ClauseTableEditor
                title={`${docLabel} — Terms & Conditions`}
                headerColumnLabel="Terms Header"
                descriptionColumnLabel="Terms Description"
                headerPlaceholder="e.g. Payment Terms"
                descriptionPlaceholder={`Clause details (shown on ${docLabel} PDF)`}
                emptyHint={`No terms yet — reload from master or add rows. Edits appear on the ${docLabel} PDF.`}
                clauses={termsClauses}
                onChange={handleTermsClausesChange}
                onReloadFromMaster={reloadClausesFromMaster}
                reloadDisabled={letterheadLoading}
                docLabel={docLabel}
                editorRevision={`${documentType}-${poType}`}
              />

              <AnnexureIiTableEditor
                title={`${docLabel} — Annexure II`}
                rows={annexureIiRows}
                onChange={(next) => {
                  markDraftEdited();
                  annexureIiDraftRef.current = next;
                  setAnnexureIiRows(next);
                }}
                docLabel={docLabel}
                editorRevision={`${documentType}-${poType}`}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveTab('preview')}
                className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <i className="ri-eye-line"></i> Preview {docLabel} Document
              </button>
            </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 3 — PREVIEW
          ══════════════════════════════════════════ */}
          {activeTab === 'preview' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">PO Document Preview</h3>
                    <p className="text-xs text-gray-500">Refex letterhead format with line items, terms, and annexure</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pdfDownloading || previewLoading || (!numericPrId && !editPoId && !isManualPoFlow)}
                      onClick={async () => {
                        try {
                          setPdfDownloading(true);
                          const payload = await applyMasterVendorToPayload(buildPreviewPayload());
                          const blob =
                            isEditMode && editPoId
                              ? await poApi.previewPdfBlobByPoId(editPoId, payload)
                              : isManualMode
                                ? await poApi.previewManualPdfBlob(payload)
                                : await poApi.previewPdfBlob(numericPrId!, payload);
                          triggerBlobDownload(
                            blob,
                            `${poNumber || pr?.prNumber || 'PO'}_preview.pdf`
                          );
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Could not download PDF');
                        } finally {
                          setPdfDownloading(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer disabled:opacity-50"
                    >
                      <i className="ri-download-2-line mr-1"></i>
                      {pdfDownloading ? 'Generating PDF…' : 'Download PDF'}
                    </button>
                    {isEditMode && editPoId && (
                      <button
                        type="button"
                        disabled={pdfDownloading}
                        onClick={async () => {
                          try {
                            setPdfDownloading(true);
                            const blob = await poApi.fetchPdfBlob(editPoId);
                            triggerBlobDownload(blob, `${poNumber || 'PO'}.pdf`);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Could not download saved PDF');
                          } finally {
                            setPdfDownloading(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                      >
                        Download saved PDF
                      </button>
                    )}
                    {previewHtmlUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const win = window.open(previewHtmlUrl, '_blank');
                          win?.focus();
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer"
                      >
                        Open in new tab
                      </button>
                    )}
                  </div>
                </div>
                {previewLoading ? (
                  <div className="py-24 text-center text-gray-400">
                    <i className="ri-loader-4-line animate-spin text-2xl"></i>
                    <p className="mt-2 text-sm">Loading PO document preview...</p>
                  </div>
                ) : previewHtmlUrl ? (
                  <iframe
                    title="PO Document Preview"
                    src={previewHtmlUrl}
                    className="w-full h-[820px] border-0 bg-white"
                  />
                ) : pdfPreviewUrl ? (
                  <iframe
                    title="PO PDF Preview"
                    src={pdfPreviewUrl}
                    className="w-full h-[820px] border-0 bg-white"
                  />
                ) : (
                  <div className="py-24 text-center text-gray-500 text-sm">
                    <p>Could not load document preview. Check line items and try again.</p>
                    {previewError && <p className="text-xs text-red-500 mt-2">{previewError}</p>}
                    {isManualMode && (
                      <p className="text-xs text-gray-400 mt-3 max-w-sm mx-auto">
                        Enter entity, vendor comparison, and line items on PO Details. PR reference fields are optional — expand <strong>PR details</strong> if needed.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg">
                    <i className="ri-checkbox-circle-line text-teal-600 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {isEditMode ? 'Save your changes?' : 'Ready to Submit?'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isEditMode
                        ? isBuyerVerifyEdit
                          ? 'Changes update the signed PO before you verify and send to vendor'
                          : poEditStatus === 'draft'
                            ? `Saving will send this draft to SCM Manager${scmManager?.name ? ` (${scmManager.name})` : ''} for approval`
                            : 'Updated PO stays pending until you sign from PO Approval'
                        : isManualMode
                          ? 'Manual entry — PR details and vendor quotations are stored; PO is saved without manager approval'
                          : skipApproval
                            ? 'Create PO without manager approval (legacy import)'
                            : `PO will be sent to SCM Manager${scmManager?.name ? ` — ${scmManager.name}` : ''} for approval`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {canSaveDraft && (
                    <button
                      onClick={handleSaveDraft}
                      disabled={submitting}
                      className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap disabled:opacity-50"
                    >
                      <i className="ri-save-line mr-1.5"></i> {submitting ? 'Saving...' : 'Save Draft'}
                    </button>
                  )}
                  <button
                    onClick={handleSendForApproval}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-bold whitespace-nowrap shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <i className={isEditMode ? 'ri-save-3-line' : 'ri-send-plane-fill'}></i>
                    {submitting
                      ? isEditMode ? 'Saving...' : 'Creating PO...'
                      : isEditMode
                        ? 'Save Changes'
                        : isManualMode
                          ? `Save ${docLabel === 'Work Order' ? 'WO' : 'PO'}`
                          : skipApproval
                            ? 'Create PO Only'
                            : 'Send for Approval'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {managerModal && editPoId && (
        <POApprovalModal
          isOpen
          type={managerModal}
          poNumber={poNumber || `PO #${editPoId}`}
          prTitle={pr?.title || ''}
          grandTotal={grandTotal}
          onConfirm={handleManagerPoAction}
          onClose={() => setManagerModal(null)}
        />
      )}

      {showBuyerSendBack && activePrId && pr && (
        <PostRfqApprovalModal
          isOpen
          action="rework"
          prNumber={pr.prNumber}
          title={pr.title}
          stageLabel="Create PO — Send Back"
          prId={activePrId}
          useAdminTargets
          onClose={() => setShowBuyerSendBack(false)}
          onConfirm={handleBuyerSendBack}
        />
      )}

      {/* ── Confirm: send to SCM Manager ── */}
      {showScmConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-5">
              <h3 className="text-lg font-bold text-white">
                {isEditMode && poEditStatus === 'draft'
                  ? 'Send draft for approval?'
                  : 'Send for SCM Manager approval?'}
              </h3>
              <p className="text-teal-100 text-sm mt-1">
                Confirm before moving this {docLabel.toLowerCase()} to the next level
              </p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Is it okay to send this {docLabel.toLowerCase()} to the{' '}
                <strong>next level — SCM Manager</strong> for sign &amp; approval?
              </p>
              <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700 mb-2">
                  SCM Manager
                </p>
                <p className="text-base font-bold text-gray-900">
                  {scmManager?.name || 'SCM Manager'}
                </p>
                {scmManager?.email ? (
                  <p className="text-sm text-teal-800 mt-0.5 break-all">{scmManager.email}</p>
                ) : null}
                <p className="text-xs text-gray-500 mt-2">
                  They will receive the approval task and email for this {docNoLabel}.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowScmConfirm(false)}
                  disabled={submitting}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void executeSendForApproval()}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Yes, send to SCM Manager'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-checkbox-circle-fill text-4xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-white">{docLabel} Created!</h3>
              <p className="text-emerald-100 text-sm mt-1">Sent for SCM Manager approval</p>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5">
                {[
                  { label: 'PO Number', value: poNumber, highlight: true },
                  { label: 'PO Date', value: formatPoDateLabel(poDate) },
                  { label: 'Vendor', value: pr.recommendedVendor },
                  { label: 'Grand Total', value: fmt(grandTotal) },
                  { label: 'Payment Terms', value: paymentTerms },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className={`font-semibold ${row.highlight ? 'text-teal-600' : 'text-gray-900'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setPageMode('pdf');
                  }}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold whitespace-nowrap"
                >
                  View {docLabel} PDF
                </button>
                <button
                  onClick={() => { setShowSuccessModal(false); navigate('/scm/create-po'); }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
                >
                  Back to PRs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
