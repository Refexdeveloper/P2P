import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import VendorComparisonMatrix from '../../../components/rfq/VendorComparisonMatrix';
import SendBackModal from '../../scm/rfq-entry/components/SendBackModal';
import CreateVendorForm from '../../scm/vendor-master/components/CreateVendorForm';
import { useAuth } from '../../../contexts/AuthContext';
import {
  rfqApi,
  prApi,
  masterApi,
  RfqFieldDefinition,
  VendorComparisonData,
  vendorApi,
  VendorRecord,
  EntityRecord,
} from '../../../services/api';
import RfqChatbot from '../../../components/feature/RfqChatbot';
import { openRfqChat } from '../../../components/feature/rfqChatOpen';
import RfqVendorQuoteTable from './components/RfqVendorQuoteTable';
import VendorSearchSelect from './components/VendorSearchSelect';
import RfqExtraQuestionsPanel from './components/RfqExtraQuestionsPanel';
import PrBillingDeliverySection, {
  PrBillingDeliveryValue,
} from '../create-pr/PrBillingDeliverySection';
import RfqEditPrModal from './components/RfqEditPrModal';
import {
  billingFromDraft,
  clearRfqEntryDraft,
  readRfqEntryDraft,
  writeRfqEntryDraft,
} from './rfqEntryDraftStorage';

const REQUESTER_SCORE_IDS = new Set(['technicalScore', 'commercialScore', 'overallScore']);

function normalizeFieldDef(f: RfqFieldDefinition): RfqFieldDefinition {
  const filledBy =
    f.filledBy === 'requester' || f.filledBy === 'vendor'
      ? f.filledBy
      : REQUESTER_SCORE_IDS.has(f.id)
        ? 'requester'
        : 'vendor';
  const showIn =
    f.showIn === 'commercial' || f.showIn === 'technical'
      ? f.showIn
      : /make|brand|hdg|freight/i.test(f.id) || /make|brand|^hdg\b|freight/i.test(f.label || '')
        ? 'commercial'
        : 'technical';
  return { ...f, filledBy, showIn };
}

interface DraftRow {
  key: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
}

interface RfqConfig {
  fieldDefinitions: RfqFieldDefinition[];
  recommendedInvitationId: number | null;
  recommendationJustification?: string;
  sendBackRemarks?: string;
  maxRounds: number | null;
  requesterSubmittedAt?: string | null;
  finalizedAt: string | null;
}

interface TableRow {
  id: string;
  invitationId: number;
  vendorName: string;
  inviteMode?: 'email' | 'manual';
  status: string;
  round: number;
  submissionId: number | null;
  hasActiveQuote?: boolean;
  quotationFileName: string;
  canSendBack: boolean;
  isRecommended: boolean;
  fieldValues: Record<string, unknown>;
  quotes: Array<{
    submissionId: number | null;
    round: number;
    quotedPrice: number;
    quotationFileName: string;
    quotationFiles?: Array<{ id?: number | null; fileName: string; isPrimary?: boolean; submissionId?: number }>;
    fieldValues: Record<string, unknown>;
    requesterFields: Record<string, unknown>;
    status?: string;
  }>;
}

function newDraftRow(): DraftRow {
  return { key: `d-${Date.now()}-${Math.random()}`, vendorId: '', vendorName: '', vendorEmail: '' };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

/** Indian-style commas while typing (e.g. 45000 → 45,000). Keeps a trailing decimal point. */
function formatInrTyping(value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).replace(/[,₹\s]/g, '');
  if (raw === '' || raw === '.') return raw === '.' ? '0.' : '';
  if (!/^\d*\.?\d{0,2}$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return '';
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  const hasDot = raw.includes('.');
  const [intRaw, decRaw = ''] = raw.split('.');
  const intPart = intRaw === '' ? '0' : String(Number(intRaw));
  const grouped = Number(intPart).toLocaleString('en-IN');
  if (!hasDot) return grouped;
  return `${grouped}.${decRaw.slice(0, 2)}`;
}

/** Strip ₹ / commas → number, or keep a partial decimal string while typing. */
function parseInrAmountInput(raw: string): number | string | '' {
  const text = String(raw).replace(/[,₹\s]/g, '');
  if (text === '') return '';
  if (!/^\d*\.?\d{0,2}$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : '';
  }
  // Keep intermediate typing states: ".", "12.", "12.5"
  if (text === '.' || text.endsWith('.') || /^\d+\.\d$/.test(text)) {
    return text === '.' ? '0.' : text;
  }
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : '';
}

function formatFieldValue(field: RfqFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.id === 'quotedPrice') return formatCurrency(Number(value));
  return String(value);
}

function emptyBilling(): PrBillingDeliveryValue {
  return {
    billingLocationId: '',
    billingLocation: '',
    billingGstNo: '',
    billingAddress: '',
    deliveryPoc: '',
    deliveryPocEmail: '',
    deliveryPocPhone: '',
    projectManagerHo: '',
    projectManagerContact: '',
    projectManagerEmail: '',
    placeOfDelivery: '',
    expectedDeliveryTimeline: '',
    paymentTerms: '',
  };
}

export default function RfqEntryDetailPage() {
  const { user } = useAuth();
  const { prId } = useParams<{ prId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isScm = location.pathname.startsWith('/scm/rfq-entry');
  const listPath = isScm ? '/scm/rfq-entry' : '/requester/rfq-entry';
  const taskId = searchParams.get('taskId');
  const canEditExistingQuote =
    user?.role === 'Super Admin' ||
    user?.role === 'SCM Manager' ||
    user?.role === 'SCM Buyer' ||
    user?.role === 'Requester';

  const [mode, setMode] = useState<'entry' | 'preview'>('entry');
  const [previewRound, setPreviewRound] = useState(1);
  const [pr, setPr] = useState<{
    prNumber: string;
    title: string;
    department: string;
    totalAmount: number;
    entityId?: number | null;
    vendorSelection?: string;
    billingLocationId?: number | null;
    billingLocation?: string;
    billingGstNo?: string;
    billingAddress?: string;
    deliveryPoc?: string;
    placeOfDelivery?: string;
    expectedDeliveryTimeline?: string;
    paymentTerms?: string;
    lineItems?: Array<{
      id: number | string;
      description: string;
      category?: string;
      quantity: number;
      unitCost: number;
      total: number;
    }>;
  } | null>(null);
  const [config, setConfig] = useState<RfqConfig | null>(null);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([newDraftRow()]);
  const [recommendedId, setRecommendedId] = useState<number | null>(null);
  const [recommendationJustification, setRecommendationJustification] = useState('');
  const [recommendModal, setRecommendModal] = useState<{
    invitationId: number;
    vendorName: string;
  } | null>(null);
  const [recommendDraft, setRecommendDraft] = useState('');
  const [comparison, setComparison] = useState<VendorComparisonData | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendingMail, setSendingMail] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [quotePopupError, setQuotePopupError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preferredTab, setPreferredTab] = useState<number | null>(null);
  const [startingRoundId, setStartingRoundId] = useState<number | null>(null);
  const [sendBackTarget, setSendBackTarget] = useState<TableRow | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);
  const [manualDrafts, setManualDrafts] = useState<Record<number, Record<string, unknown>>>({});
  const [manualFiles, setManualFiles] = useState<Record<number, File[]>>({});
  const [removedQuoteFileKeys, setRemovedQuoteFileKeys] = useState<Record<number, string[]>>({});
  const [savingManualId, setSavingManualId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  /** Invitation IDs currently in admin/edit mode for an existing submitted quote */
  const [editingQuoteIds, setEditingQuoteIds] = useState<Set<number>>(new Set());
  const [editingRoundById, setEditingRoundById] = useState<Record<number, number>>({});
  const [vendorCatalog, setVendorCatalog] = useState<VendorRecord[]>([]);
  const [addVendorRowKey, setAddVendorRowKey] = useState<string | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [quotePopupId, setQuotePopupId] = useState<number | null>(null);
  const [quoteAsk, setQuoteAsk] = useState<{
    row: TableRow;
    existingRound: number;
    targetRound: number;
    source: 'edit' | 'requote';
  } | null>(null);
  const [zeroSaveAsk, setZeroSaveAsk] = useState<{
    row: TableRow;
    kind: 'existing' | 'new';
    zeroCount: number;
    total: number;
  } | null>(null);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [billing, setBilling] = useState<PrBillingDeliveryValue>(emptyBilling);
  const billingHydratedRef = useRef(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [softSaveHint, setSoftSaveHint] = useState('');
  const [editPrOpen, setEditPrOpen] = useState(false);
  /** True only after local draft restore attempt finished for this PR (blocks empty wipe). */
  const draftHydratedRef = useRef(false);
  const localDraftRestoredForPrRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const skipLeaveBlockRef = useRef(false);
  const skipDirtyOnceRef = useRef(true);
  const billingRef = useRef(billing);
  billingRef.current = billing;

  const markDirty = () => {
    if (isFinalized || !draftHydratedRef.current) return;
    dirtyRef.current = true;
    setIsDirty(true);
  };

  const clearDirty = () => {
    dirtyRef.current = false;
    setIsDirty(false);
  };

  const loadVendors = useCallback(async () => {
    try {
      const res = await vendorApi.list();
      setVendorCatalog((res.data || []).filter((v) => v.status !== 'inactive'));
    } catch {
      /* dropdown stays empty until retry */
    }
  }, []);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const localFilesFor = (invitationId: number) => manualFiles[invitationId] || [];

  const quoteFileKey = (f: { id?: number | null; isPrimary?: boolean }) =>
    Number(f.id) > 0 ? `extra:${Number(f.id)}` : 'primary';

  const savedQuoteFilesFor = (
    row: TableRow,
    quote?: TableRow['quotes'][number] | null
  ) => {
    const q = quote || null;
    const extras = Array.isArray(q?.quotationFiles) ? q!.quotationFiles : [];
    const removed = new Set(removedQuoteFileKeys[row.invitationId] || []);
    const list =
      extras.length > 0
        ? extras
        : q?.quotationFileName
          ? [{ id: null as number | null, fileName: q.quotationFileName, isPrimary: true }]
          : [];
    return list.filter((f) => !removed.has(quoteFileKey(f)));
  };

  const removeSavedQuoteFile = (
    invitationId: number,
    file: { id?: number | null; isPrimary?: boolean }
  ) => {
    const key = quoteFileKey(file);
    setRemovedQuoteFileKeys((prev) => {
      const current = prev[invitationId] || [];
      if (current.includes(key)) return prev;
      return { ...prev, [invitationId]: [...current, key] };
    });
  };

  const packQuoteFilePayload = async (
    row: TableRow,
    quote: TableRow['quotes'][number] | undefined,
    files: File[]
  ) => {
    const saved = savedQuoteFilesFor(row, quote);
    const hasPrimary = saved.some((s) => s.isPrimary || !(Number(s.id) > 0));
    const out: Record<string, unknown> = {
      keepExtraFileIds: saved.filter((f) => Number(f.id) > 0).map((f) => Number(f.id)),
      clearPrimary: !hasPrimary,
    };
    if (!files.length) return out;
    const uploaded = [];
    for (const f of files) {
      const data = await readFileAsBase64(f);
      if (!data) throw new Error('Could not read quotation file — try again');
      uploaded.push({ fileName: f.name, fileData: data });
    }
    if (!hasPrimary) {
      out.quotationFileName = uploaded[0].fileName;
      out.quotationFileData = uploaded[0].fileData;
      if (uploaded.length > 1) out.quotationFiles = uploaded.slice(1);
    } else {
      out.quotationFiles = uploaded;
    }
    return out;
  };

  const getManualValue = (invitationId: number, fieldId: string, fallback: unknown = '') => {
    const draft = manualDrafts[invitationId];
    if (draft && draft[fieldId] !== undefined) return draft[fieldId];
    return fallback;
  };

  const setManualValue = (invitationId: number, fieldId: string, value: unknown) => {
    setManualDrafts((prev) => ({
      ...prev,
      [invitationId]: { ...prev[invitationId], [fieldId]: value },
    }));
  };

  const prLineItems = pr?.lineItems || [];

  type ManualQuoteLine = {
    lineItemId: string;
    description?: string;
    category?: string;
    estimatedUnitCost?: number;
    quotedUnitPrice?: number | string;
    gstPercent?: number;
    quantity?: number;
    quotedTotal?: number;
    extra?: boolean;
  };

  const GST_RATES = [0, 5, 12, 18, 28];

  const lineQuotedTotal = (l: Pick<ManualQuoteLine, 'quantity' | 'quotedUnitPrice' | 'gstPercent' | 'quotedTotal'>) => {
    const qty = Number(l.quantity) || 0;
    const unit = Number(l.quotedUnitPrice) || 0;
    const gst = Number(l.gstPercent) || 0;
    return Math.round(qty * unit * (1 + gst / 100) * 100) / 100;
  };

  const parseAmountInput = (raw: string): number | string | '' => parseInrAmountInput(raw);

  const seedQuoteLines = (savedLines: ManualQuoteLine[] = []): ManualQuoteLine[] => {
    const saved = Array.isArray(savedLines) ? savedLines : [];
    const prIds = new Set(prLineItems.map((li) => String(li.id)));
    const fromPr = prLineItems.map((li) => {
      const id = String(li.id);
      const hit = saved.find((l) => String(l.lineItemId) === id);
      return {
        lineItemId: id,
        description: hit?.description || li.description,
        category: hit?.category || li.category || '',
        estimatedUnitCost: Number(hit?.estimatedUnitCost ?? li.unitCost) || 0,
        quantity: Number(hit?.quantity ?? li.quantity) || 0,
        quotedUnitPrice: Number(hit?.quotedUnitPrice) || 0,
        gstPercent: hit?.gstPercent != null ? Number(hit.gstPercent) : 18,
        quotedTotal: 0,
        extra: false,
      };
    });
    const extras = saved
      .filter((l) => l.extra || !prIds.has(String(l.lineItemId)))
      .map((l) => ({
        lineItemId: String(l.lineItemId || `extra-${Date.now()}`),
        description: l.description || '',
        category: l.category || '',
        estimatedUnitCost: Number(l.estimatedUnitCost) || 0,
        quantity: Number(l.quantity) || 1,
        quotedUnitPrice: Number(l.quotedUnitPrice) || 0,
        gstPercent: l.gstPercent != null ? Number(l.gstPercent) : 18,
        quotedTotal: 0,
        extra: true,
      }));
    return [...fromPr, ...extras].map((l) => ({
      ...l,
      quotedTotal: lineQuotedTotal(l),
    }));
  };

  const getWorkingLines = (invitationId: number, savedLines: ManualQuoteLine[] = []): ManualQuoteLine[] => {
    const draft = (manualDrafts[invitationId]?.quoteLineItems as ManualQuoteLine[]) || [];
    if (draft.length) return draft;
    return seedQuoteLines(savedLines);
  };

  const persistWorkingLines = (invitationId: number, lines: ManualQuoteLine[]) => {
    const nextLines = lines.map((l) => ({
      ...l,
      quotedTotal: lineQuotedTotal(l),
    }));
    const total = nextLines.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0);
    setManualDrafts((prev) => {
      const prevDraft = prev[invitationId] || {};
      const keepManual = Boolean(prevDraft.quotedPriceManual);
      return {
        ...prev,
        [invitationId]: {
          ...prevDraft,
          quoteLineItems: nextLines,
          // Keep a manually typed Quoted Price; otherwise sync from line totals
          ...(keepManual ? {} : { quotedPrice: total }),
          lineItemsTotal: total,
        },
      };
    });
  };

  const setQuotedPriceManual = (invitationId: number, value: number | string | '') => {
    setManualDrafts((prev) => ({
      ...prev,
      [invitationId]: {
        ...prev[invitationId],
        quotedPrice: value,
        quotedPriceManual: true,
      },
    }));
  };

  const useLineTotalAsQuotedPrice = (invitationId: number) => {
    const total = getManualQuoteTotal(invitationId);
    setManualDrafts((prev) => ({
      ...prev,
      [invitationId]: {
        ...prev[invitationId],
        quotedPrice: total,
        quotedPriceManual: false,
        lineItemsTotal: total,
      },
    }));
  };

  const getEffectiveQuotedPrice = (invitationId: number, fallback = 0) => {
    const draft = manualDrafts[invitationId] || {};
    if (draft.quotedPriceManual) {
      const n = Number(String(draft.quotedPrice ?? '').toString().replace(/[,₹\s]/g, ''));
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    }
    const lineTotal = getManualQuoteTotal(invitationId);
    if (lineTotal > 0) return lineTotal;
    const n = Number(draft.quotedPrice);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const getManualLineDraft = (invitationId: number, lineItemId: string): ManualQuoteLine | undefined => {
    const lines = (manualDrafts[invitationId]?.quoteLineItems as ManualQuoteLine[]) || [];
    return lines.find((l) => String(l.lineItemId) === String(lineItemId));
  };

  const getManualLineUnitPrice = (invitationId: number, lineItemId: string): number | string | '' => {
    const found = getManualLineDraft(invitationId, lineItemId);
    if (found?.quotedUnitPrice === undefined || found.quotedUnitPrice === null || found.quotedUnitPrice === '') {
      return '';
    }
    return found.quotedUnitPrice;
  };

  const getManualLineQty = (invitationId: number, lineItemId: string, fallbackQty: number): number | '' => {
    const found = getManualLineDraft(invitationId, lineItemId);
    if (!found || found.quantity === undefined || found.quantity === null) return fallbackQty || '';
    return Number(found.quantity) || 0;
  };

  const getManualLineGst = (invitationId: number, lineItemId: string, fallback = 18): number => {
    const found = getManualLineDraft(invitationId, lineItemId);
    if (found?.gstPercent === undefined || found.gstPercent === null) return fallback;
    return Number(found.gstPercent) || 0;
  };

  const setManualLineField = (
    invitationId: number,
    lineItemId: string,
    field: 'quotedUnitPrice' | 'quantity' | 'gstPercent' | 'description',
    value: number | string | ''
  ) => {
    const current = getWorkingLines(invitationId);
    const next = current.map((l) => {
      if (String(l.lineItemId) !== String(lineItemId)) return l;
      if (field === 'description') return { ...l, description: String(value) };
      if (field === 'quotedUnitPrice') {
        if (value === '') return { ...l, quotedUnitPrice: '' };
        if (typeof value === 'string' && /^\d*\.?\d{0,2}$/.test(value)) {
          return { ...l, quotedUnitPrice: value };
        }
        return { ...l, quotedUnitPrice: Math.max(0, Number(value) || 0) };
      }
      const n = value === '' ? 0 : Math.max(0, Number(value) || 0);
      return { ...l, [field]: n };
    });
    persistWorkingLines(invitationId, next);
  };

  const addExtraQuoteLine = (invitationId: number) => {
    const current = getWorkingLines(invitationId);
    persistWorkingLines(invitationId, [
      ...current,
      {
        lineItemId: `extra-${Date.now()}`,
        description: '',
        category: '',
        estimatedUnitCost: 0,
        quantity: 1,
        quotedUnitPrice: 0,
        gstPercent: 18,
        quotedTotal: 0,
        extra: true,
      },
    ]);
  };

  const removeExtraQuoteLine = (invitationId: number, lineItemId: string) => {
    persistWorkingLines(
      invitationId,
      getWorkingLines(invitationId).filter((l) => String(l.lineItemId) !== String(lineItemId))
    );
  };

  const getManualQuoteTotal = (invitationId: number) => {
    const lines =
      (manualDrafts[invitationId]?.quoteLineItems as ManualQuoteLine[]) || [];
    if (!lines.length) return Number(manualDrafts[invitationId]?.quotedPrice) || 0;
    return lines.reduce((sum, l) => sum + lineQuotedTotal(l), 0);
  };

  const fields = (config?.fieldDefinitions || []).map(normalizeFieldDef);
  const vendorFields = fields.filter((f) => f.filledBy === 'vendor');
  const vendorFieldsWithoutPrice = vendorFields.filter((f) => f.id !== 'quotedPrice');
  const requesterFields = fields.filter((f) => f.filledBy === 'requester');
  // Requester locks after own-vendor submit; SCM continues until final finalize
  const isFinalized = isScm
    ? Boolean(config?.finalizedAt)
    : Boolean(config?.finalizedAt || config?.requesterSubmittedAt);
  const selectedEntity = useMemo(
    () => (pr?.entityId ? entities.find((e) => Number(e.id) === Number(pr.entityId)) || null : null),
    [entities, pr?.entityId]
  );
  const billingLocations = selectedEntity?.locations?.filter((loc) => loc.location) || [];
  const hasInvitations = tableRows.length > 0;
  const quotedCount = tableRows.filter((r) => r.hasActiveQuote).length;
  const guideStep = !hasInvitations ? 1 : quotedCount === 0 ? 2 : recommendedId ? 3 : 2;
  const invitedVendorNames = new Set(tableRows.map((r) => r.vendorName.toLowerCase()));
  const recommendedRow = tableRows.find(
    (r) => Number(r.invitationId) === Number(recommendedId)
  );
  const canSubmitRfq = Boolean(
    recommendedRow?.hasActiveQuote && recommendationJustification.trim()
  );

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), type === 'err' ? 7000 : 4000);
  };

  const failQuote = (msg: string) => {
    setError(msg);
    setQuotePopupError(msg);
    showToast(msg, 'err');
  };

  const loadRfq = useCallback(async (opts?: { soft?: boolean }) => {
    if (!prId) return;
    const soft = Boolean(opts?.soft);
    if (!soft) setLoading(true);
    try {
      const res = await rfqApi.getByPr(Number(prId));
      const data = res.data;
      setPr(data.pr as typeof pr);
      const loaded = data.pr as {
        billingLocationId?: number | null;
        billingLocation?: string;
        billingGstNo?: string;
        billingAddress?: string;
        deliveryPoc?: string;
        deliveryPocEmail?: string;
        deliveryPocPhone?: string;
        projectManagerHo?: string;
        projectManagerContact?: string;
        projectManagerEmail?: string;
        placeOfDelivery?: string;
        expectedDeliveryTimeline?: string;
        paymentTerms?: string;
      };
      setBilling((prev) =>
        billingHydratedRef.current
          ? prev
          : {
              billingLocationId: loaded.billingLocationId ? Number(loaded.billingLocationId) : '',
              billingLocation: loaded.billingLocation || '',
              billingGstNo: loaded.billingGstNo || '',
              billingAddress: loaded.billingAddress || '',
              deliveryPoc: loaded.deliveryPoc || '',
              deliveryPocEmail: loaded.deliveryPocEmail || '',
              deliveryPocPhone: loaded.deliveryPocPhone || '',
              projectManagerHo: loaded.projectManagerHo || '',
              projectManagerContact: loaded.projectManagerContact || '',
              projectManagerEmail: loaded.projectManagerEmail || '',
              placeOfDelivery: loaded.placeOfDelivery || '',
              expectedDeliveryTimeline: loaded.expectedDeliveryTimeline || '',
              paymentTerms: loaded.paymentTerms || '',
            }
      );
      if (!soft) billingHydratedRef.current = true;
      const cfg = data.config as RfqConfig;
      setConfig(cfg);
      // Don't wipe a local Recommend choice during soft/poll refresh
      setRecommendedId((prev) =>
        soft && prev != null ? prev : cfg.recommendedInvitationId
      );
      setRecommendationJustification((prev) => {
        if (soft && prev.trim()) return prev;
        return String(cfg.recommendationJustification || '');
      });
      const rows = (data.tableRows || []) as TableRow[];
      setTableRows(rows);
      if (rows.length) {
        const rounds = rows.map((r) => Number(r.round) || 1);
        setPreviewRound(Math.max(1, ...rounds));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFQ');
    } finally {
      if (!soft) setLoading(false);
    }
  }, [prId]);

  useEffect(() => {
    loadRfq();
    loadVendors();
  }, [loadRfq, loadVendors]);

  useEffect(() => {
    billingHydratedRef.current = false;
    draftHydratedRef.current = false;
    localDraftRestoredForPrRef.current = null;
    skipDirtyOnceRef.current = true;
    clearDirty();
    setManualDrafts({});
    setDraftRows([newDraftRow()]);
    setBilling(emptyBilling());
    setSoftSaveHint('');
  }, [prId]);

  /** Restore in-progress quote fields / pending vendors after RFQ loads */
  useEffect(() => {
    if (!prId || loading || isFinalized) return;
    if (localDraftRestoredForPrRef.current === Number(prId)) return;

    const snap = readRfqEntryDraft(user?.id, Number(prId));
    localDraftRestoredForPrRef.current = Number(prId);

    if (snap?.manualDrafts && Object.keys(snap.manualDrafts).length) {
      const mapped: Record<number, Record<string, unknown>> = {};
      for (const [k, v] of Object.entries(snap.manualDrafts)) {
        const id = Number(k);
        if (Number.isFinite(id) && v && typeof v === 'object') mapped[id] = v;
      }
      if (Object.keys(mapped).length) {
        setManualDrafts(mapped);
      }
    }

    if (Array.isArray(snap?.draftRows) && snap.draftRows.length) {
      const restored = snap.draftRows
        .filter((r) => r && (r.vendorId || r.vendorName || r.vendorEmail))
        .map((r) => ({
          key: r.key || `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          vendorId: String(r.vendorId || ''),
          vendorName: String(r.vendorName || ''),
          vendorEmail: String(r.vendorEmail || ''),
        }));
      if (restored.length) {
        setDraftRows([...restored, newDraftRow()]);
      }
    }

    if (snap?.recommendedInvitationId != null) {
      setRecommendedId((prev) => prev ?? Number(snap.recommendedInvitationId));
    }
    if (snap?.recommendationJustification?.trim()) {
      setRecommendationJustification((prev) =>
        prev.trim() ? prev : String(snap.recommendationJustification)
      );
    }

    const localBilling = billingFromDraft(snap);
    if (localBilling) {
      setBilling((prev) => ({
        billingLocationId: localBilling.billingLocationId || prev.billingLocationId || '',
        billingLocation: localBilling.billingLocation.trim() || prev.billingLocation || '',
        billingGstNo: localBilling.billingGstNo.trim() || prev.billingGstNo || '',
        billingAddress: localBilling.billingAddress.trim() || prev.billingAddress || '',
        deliveryPoc: localBilling.deliveryPoc.trim() || prev.deliveryPoc || '',
        deliveryPocEmail: localBilling.deliveryPocEmail?.trim() || prev.deliveryPocEmail || '',
        deliveryPocPhone: localBilling.deliveryPocPhone?.trim() || prev.deliveryPocPhone || '',
        projectManagerHo: localBilling.projectManagerHo?.trim() || prev.projectManagerHo || '',
        projectManagerContact: localBilling.projectManagerContact?.trim() || prev.projectManagerContact || '',
        projectManagerEmail: localBilling.projectManagerEmail?.trim() || prev.projectManagerEmail || '',
        placeOfDelivery: localBilling.placeOfDelivery.trim() || prev.placeOfDelivery || '',
        expectedDeliveryTimeline:
          localBilling.expectedDeliveryTimeline.trim() || prev.expectedDeliveryTimeline || '',
        paymentTerms: localBilling.paymentTerms.trim() || prev.paymentTerms || '',
      }));
    }

    // Allow soft-autosave only after restore state has been scheduled
    window.setTimeout(() => {
      draftHydratedRef.current = true;
      skipDirtyOnceRef.current = true;
    }, 0);
  }, [prId, loading, isFinalized, user?.id]);

  // If user id arrives later, retry restore once when still empty
  useEffect(() => {
    if (!prId || loading || isFinalized || !user?.id) return;
    if (!draftHydratedRef.current) return;
    const snap = readRfqEntryDraft(user.id, Number(prId));
    if (!snap) return;
    if (Object.keys(manualDrafts).length === 0 && snap.manualDrafts && Object.keys(snap.manualDrafts).length) {
      const mapped: Record<number, Record<string, unknown>> = {};
      for (const [k, v] of Object.entries(snap.manualDrafts)) {
        const id = Number(k);
        if (Number.isFinite(id) && v && typeof v === 'object') mapped[id] = v;
      }
      if (Object.keys(mapped).length) setManualDrafts(mapped);
    }
    if (recommendedId == null && snap.recommendedInvitationId != null) {
      setRecommendedId(Number(snap.recommendedInvitationId));
    }
    if (!recommendationJustification.trim() && snap.recommendationJustification?.trim()) {
      setRecommendationJustification(String(snap.recommendationJustification));
    }
    const localBilling = billingFromDraft(snap);
    if (localBilling) {
      const hasLocal =
        localBilling.billingLocation.trim() ||
        localBilling.billingAddress.trim() ||
        localBilling.billingGstNo.trim() ||
        localBilling.deliveryPoc.trim() ||
        localBilling.placeOfDelivery.trim();
      if (hasLocal) {
        setBilling((prev) => {
          const serverEmpty =
            !prev.billingLocation.trim() &&
            !prev.billingAddress.trim() &&
            !prev.billingGstNo.trim();
          if (!serverEmpty) return prev;
          return {
            billingLocationId: localBilling.billingLocationId || '',
            billingLocation: localBilling.billingLocation,
            billingGstNo: localBilling.billingGstNo,
            billingAddress: localBilling.billingAddress,
            deliveryPoc: localBilling.deliveryPoc,
            deliveryPocEmail: localBilling.deliveryPocEmail || '',
            deliveryPocPhone: localBilling.deliveryPocPhone || '',
            projectManagerHo: localBilling.projectManagerHo || '',
            projectManagerContact: localBilling.projectManagerContact || '',
            projectManagerEmail: localBilling.projectManagerEmail || '',
            placeOfDelivery: localBilling.placeOfDelivery,
            expectedDeliveryTimeline: localBilling.expectedDeliveryTimeline,
            paymentTerms: localBilling.paymentTerms,
          };
        });
      }
    }
  }, [
    user?.id,
    prId,
    loading,
    isFinalized,
    manualDrafts,
    recommendedId,
    recommendationJustification,
  ]);

  useEffect(() => {
    if (isScm) return;
    (async () => {
      try {
        const res = await masterApi.listEntities({ status: 'active' });
        setEntities(res.data || []);
      } catch {
        setEntities([]);
      }
    })();
  }, [isScm]);

  useEffect(() => {
    if (!hasInvitations || isFinalized) return;
    const interval = setInterval(() => loadRfq({ soft: true }), 15000);
    return () => clearInterval(interval);
  }, [hasInvitations, isFinalized, loadRfq]);

  useEffect(() => {
    if (isScm || !prId || isFinalized || !billingHydratedRef.current || !draftHydratedRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      void persistBilling().catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [billing, isScm, prId, isFinalized]);

  /** Soft-persist in-progress quote forms so refresh doesn't lose work */
  useEffect(() => {
    if (!prId || isFinalized || loading) return;
    if (!draftHydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (!prId || isFinalized || !draftHydratedRef.current) return;
      writeRfqEntryDraft(
        user?.id,
        Number(prId),
        {
          recommendedInvitationId: recommendedId,
          recommendationJustification,
          maxRounds: config?.maxRounds ?? null,
          draftRows: draftRows.filter((r) => r.vendorId || r.vendorName || r.vendorEmail),
          manualDrafts: manualDrafts as unknown as Record<string, Record<string, unknown>>,
          billing,
        },
        { allowEmptyOverwrite: false }
      );
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    prId,
    isFinalized,
    loading,
    recommendedId,
    recommendationJustification,
    manualDrafts,
    draftRows,
    billing,
    config?.maxRounds,
    user?.id,
  ]);

  /** Track unsaved edits after hydrate (skip restore-driven updates). */
  useEffect(() => {
    if (!draftHydratedRef.current || isFinalized) return;
    if (skipDirtyOnceRef.current) {
      skipDirtyOnceRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setIsDirty(true);
  }, [
    billing,
    manualDrafts,
    draftRows,
    recommendedId,
    recommendationJustification,
    isFinalized,
  ]);

  useEffect(() => {
    if (mode !== 'preview' || !prId || !hasInvitations) {
      if (mode !== 'preview') setComparison(null);
      return;
    }
    let cancelled = false;
    setComparisonLoading(true);
    rfqApi
      .getComparison(Number(prId))
      .then((res) => {
        if (!cancelled) setComparison(res.data);
      })
      .catch(() => {
        if (!cancelled) setComparison(null);
      })
      .finally(() => {
        if (!cancelled) setComparisonLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, prId, hasInvitations, tableRows.length]);

  const saveConfig = async (updates: Partial<RfqConfig>) => {
    if (!prId) return;
    const next = {
      fieldDefinitions: updates.fieldDefinitions ?? config?.fieldDefinitions ?? [],
      maxRounds: updates.maxRounds ?? config?.maxRounds ?? null,
      recommendedInvitationId: updates.recommendedInvitationId ?? recommendedId,
      recommendationJustification:
        updates.recommendationJustification ?? recommendationJustification,
    };
    const res = await rfqApi.saveConfig(Number(prId), next);
    setConfig(res.data.config as RfqConfig);
  };

  const addFieldDef = async (field: RfqFieldDefinition) => {
    if (fields.some((f) => f.id === field.id)) {
      setError(`Field "${field.label}" is already added`);
      return;
    }
    await saveConfig({ fieldDefinitions: [...fields, normalizeFieldDef(field)] });
    showToast(
      field.filledBy === 'requester'
        ? `${field.label} added. You can fill this after the quote.`
        : `${field.label} added. Vendors will answer this on the quote.`
    );
  };

  const removeField = async (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId);
    if (f?.core) return;
    await saveConfig({ fieldDefinitions: fields.filter((x) => x.id !== fieldId) });
  };

  const vendorFieldPresets: RfqFieldDefinition[] = [
    { id: 'make', label: 'Make', type: 'text', filledBy: 'vendor', showIn: 'commercial' },
    { id: 'hdg', label: 'HDG', type: 'text', filledBy: 'vendor', showIn: 'commercial' },
    { id: 'freight', label: 'Freight', type: 'text', filledBy: 'vendor', showIn: 'commercial' },
    { id: 'leadTime', label: 'Lead Time (days)', type: 'number', filledBy: 'vendor', showIn: 'technical' },
    { id: 'paymentTerms', label: 'Payment Terms', type: 'text', filledBy: 'vendor', showIn: 'technical' },
    { id: 'warranty', label: 'Warranty', type: 'text', filledBy: 'vendor', showIn: 'technical' },
    { id: 'deliveryTerms', label: 'Delivery Terms', type: 'text', filledBy: 'vendor', showIn: 'technical' },
    { id: 'compliance', label: 'Compliance', type: 'boolean', filledBy: 'vendor', showIn: 'technical' },
    { id: 'vendorNotes', label: 'Notes / Comments', type: 'text', filledBy: 'vendor', showIn: 'technical' },
  ];

  const inviteSelectedVendors = async (sendEmail: boolean) => {
    if (!prId) return;
    const selected = draftRows.filter((r) => r.vendorId);
    if (!selected.length) {
      setError(sendEmail ? 'Select at least one vendor to send mail' : 'Select at least one vendor for manual entry');
      return;
    }

    const vendors = selected
      .map((r) => ({ name: r.vendorName, email: r.vendorEmail }))
      .filter((v) => !invitedVendorNames.has(v.name.toLowerCase()));

    const alreadyInvited = selected.filter((r) => invitedVendorNames.has(r.vendorName.toLowerCase()));
    if (!vendors.length) {
      setError(
        alreadyInvited.length === 1
          ? `"${alreadyInvited[0].vendorName}" is already in the table. Choose a different vendor.`
          : 'Selected vendor(s) are already in the quotation table.'
      );
      return;
    }

    if (sendEmail) setSendingMail(true);
    else setAddingManual(true);
    setError('');
    try {
      const res = await rfqApi.invite(Number(prId), vendors, fields, sendEmail);
      const data = res.data as { tableRows: TableRow[]; config: RfqConfig };
      setTableRows(data.tableRows || []);
      setConfig(data.config);
      setDraftRows([newDraftRow()]);
      const msg = res.message || (sendEmail ? 'Emails sent' : 'Added for manual entry');
      if (alreadyInvited.length) {
        showToast(`${msg} (${alreadyInvited.length} already in table, skipped)`);
      } else {
        showToast(msg);
      }
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : sendEmail ? 'Failed to send mail' : 'Failed to add manual entry');
    } finally {
      setSendingMail(false);
      setAddingManual(false);
    }
  };

  const handleSendMail = () => inviteSelectedVendors(true);
  const handleAddManualEntry = () => inviteSelectedVendors(false);

  const handleRemoveVendor = async (row: TableRow) => {
    if (isFinalized) return;
    const ok = window.confirm(
      `Remove "${row.vendorName}" from this RFQ?\n\nTheir invitation and any quoted data for this RFQ will be deleted.`
    );
    if (!ok) return;

    setRemovingId(row.invitationId);
    setError('');
    try {
      const res = await rfqApi.removeInvitation(row.invitationId);
      const data = res.data as { tableRows?: TableRow[]; config?: RfqConfig };
      if (data.tableRows) setTableRows(data.tableRows);
      if (data.config) {
        setConfig(data.config);
        setRecommendedId(data.config.recommendedInvitationId ?? null);
        setRecommendationJustification(data.config.recommendationJustification || '');
      }
      if (Number(recommendedId) === Number(row.invitationId)) {
        setRecommendedId(null);
        setRecommendationJustification('');
      }
      setManualDrafts((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      setManualFiles((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      setRemovedQuoteFileKeys((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      showToast(res.message || `"${row.vendorName}" removed`);
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove vendor');
    } finally {
      setRemovingId(null);
    }
  };

  const handleResendMail = async (row: TableRow) => {
    setResendingId(row.invitationId);
    setError('');
    try {
      const res = await rfqApi.resendInviteEmail(row.invitationId);
      showToast(res.message || 'RFQ email resent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend mail');
    } finally {
      setResendingId(null);
    }
  };

  const startEditExistingQuote = (row: TableRow, quoteOverride?: ReturnType<typeof getDisplayQuote>) => {
    const quote = quoteOverride || getDisplayQuote(row);
    const vals = quoteFieldValues(quote, row);
    const savedLines = (Array.isArray(vals.quoteLineItems) ? vals.quoteLineItems : []) as ManualQuoteLine[];
    const quoteLineItems = seedQuoteLines(savedLines);
    const lineTotal = quoteLineItems.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0);
    const savedPrice = Number(vals.quotedPrice) || 0;
    const quotedPriceManual =
      savedPrice > 0 && lineTotal > 0 && Math.abs(savedPrice - lineTotal) > 0.009;
    const quotedPrice = quotedPriceManual ? savedPrice : lineTotal || savedPrice;

    setManualDrafts((prev) => ({
      ...prev,
      [row.invitationId]: {
        ...vals,
        quotedPrice,
        quotedPriceManual,
        lineItemsTotal: lineTotal,
        quoteLineItems,
        leadTime: vals.leadTime ?? '',
        paymentTerms: vals.paymentTerms ?? 'Net 30',
        warranty: vals.warranty ?? '',
        deliveryTerms: vals.deliveryTerms ?? '',
        compliance: vals.compliance !== false,
        vendorNotes: vals.vendorNotes ?? '',
        technicalScore: vals.technicalScore ?? 0,
        commercialScore: vals.commercialScore ?? 0,
        overallScore: vals.overallScore ?? 0,
      },
    }));
    setEditingQuoteIds((prev) => new Set(prev).add(row.invitationId));
    if (quote?.round) {
      setEditingRoundById((prev) => ({ ...prev, [row.invitationId]: Number(quote.round) }));
    }
  };

  const cancelEditExistingQuote = (invitationId: number) => {
    setEditingQuoteIds((prev) => {
      const next = new Set(prev);
      next.delete(invitationId);
      return next;
    });
    setManualDrafts((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    setManualFiles((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    setRemovedQuoteFileKeys((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    setEditingRoundById((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
  };

  const validateRequiredQuote = (row: TableRow) => {
    const quote = getDisplayQuote(row, editingRoundById[row.invitationId]);
    const draft = manualDrafts[row.invitationId] || {};
    const files = localFilesFor(row.invitationId);
    const saved = savedQuoteFilesFor(row, quote);
    const hasFile = files.length > 0 || saved.length > 0;
    if (!hasFile) {
      failQuote('Quotation file is required. Upload a PDF or photo first.');
      return null;
    }
    if (files.some((f) => f.size > 10 * 1024 * 1024)) {
      failQuote('Each quotation file must be under 10MB');
      return null;
    }
    const quoteLineItems = getWorkingLines(row.invitationId)
      .map((l) => {
        const rawUnit = l.quotedUnitPrice;
        const quotedUnitPrice = rawUnit === '' || rawUnit === null || rawUnit === undefined ? NaN : Number(rawUnit);
        const quantity = Number(l.quantity) || 0;
        const gstPercent = l.gstPercent != null ? Number(l.gstPercent) : 18;
        return {
          ...l,
          quotedUnitPrice,
          quantity,
          gstPercent,
          quotedTotal: Number.isFinite(quotedUnitPrice)
            ? lineQuotedTotal({ quotedUnitPrice, quantity, gstPercent })
            : 0,
        };
      })
      .filter((l) => (l.extra ? String(l.description || '').trim() : true));
    if (!quoteLineItems.length) {
      failQuote('Line items are required. Add at least one item with a quoted price.');
      return null;
    }
    if (quoteLineItems.some((l) => !String(l.description || '').trim())) {
      failQuote('Enter a name for every line item');
      return null;
    }
    if (quoteLineItems.some((l) => !l.quantity || l.quantity <= 0)) {
      failQuote('Enter quantity for every line item');
      return null;
    }
    if (quoteLineItems.some((l) => !Number.isFinite(Number(l.quotedUnitPrice)) || Number(l.quotedUnitPrice) < 0)) {
      failQuote('Enter quoted unit price for every line item (0 is allowed)');
      return null;
    }
    const lineTotal = quoteLineItems.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0);
    const manualRaw = draft.quotedPrice;
    const manualPrice =
      manualRaw === '' || manualRaw === null || manualRaw === undefined
        ? NaN
        : Number(String(manualRaw).replace(/[,₹\s]/g, ''));
    const quotedPrice =
      draft.quotedPriceManual && Number.isFinite(manualPrice) && manualPrice >= 0
        ? manualPrice
        : Number.isFinite(manualPrice) && manualPrice > 0 && Math.abs(manualPrice - lineTotal) > 0.009
          ? manualPrice
          : lineTotal;
    if (!Number.isFinite(quotedPrice) || quotedPrice < 0) {
      failQuote('Quotation price cannot be negative');
      return null;
    }
    if (quotedPrice === 0 && !draft.quotedPriceManual) {
      // still allow zero via confirm dialog below
    }
    const zeroCount = quoteLineItems.filter((l) => Number(l.quotedUnitPrice) === 0).length;
    return { quote, draft, files, quoteLineItems, quotedPrice, zeroCount, lineTotal };
  };

  const handleSaveExistingQuote = async (row: TableRow, opts?: { acceptZero?: boolean }) => {
    if (isFinalized) {
      failQuote('RFQ is approved — quotation cannot be edited');
      return;
    }
    const checked = validateRequiredQuote(row);
    if (!checked) return;
    const { quote, draft, files, quoteLineItems, quotedPrice, zeroCount } = checked;
    if ((zeroCount > 0 || quotedPrice === 0) && !opts?.acceptZero) {
      setZeroSaveAsk({ row, kind: 'existing', zeroCount: zeroCount || 1, total: quotedPrice });
      return;
    }
    const preferred = editingRoundById[row.invitationId];
    const editingQuote = preferred ? quoteForRound(row, preferred) : quote;
    const submissionId = editingQuote?.submissionId || quote?.submissionId || row.submissionId;
    if (!submissionId) {
      failQuote('No submission to update. Use Save quote + file for a new round.');
      return;
    }

    setSavingManualId(row.invitationId);
    setError('');
    setQuotePopupError('');
    try {
      const body: Record<string, unknown> = {
        quotedPrice,
        quoteLineItems,
        leadTime: Number(draft.leadTime) || 0,
        paymentTerms: String(draft.paymentTerms || 'Net 30'),
        warranty: String(draft.warranty || ''),
        deliveryTerms: String(draft.deliveryTerms || ''),
        compliance: draft.compliance !== false,
        vendorNotes: String(draft.vendorNotes || ''),
        technicalScore: Number(draft.technicalScore) || 0,
        commercialScore: Number(draft.commercialScore) || 0,
        overallScore: Number(draft.overallScore) || 0,
        customFields: draft,
      };
      Object.assign(body, await packQuoteFilePayload(row, editingQuote || quote, files));

      const res = await rfqApi.updateSubmission(submissionId, body);
      showToast(res.message || 'Quotation updated');
      cancelEditExistingQuote(row.invitationId);
      setQuotePopupId(null);
      if (res.data?.tableRows) {
        setTableRows(res.data.tableRows as TableRow[]);
      }
      if (res.data?.config) {
        setConfig(res.data.config as RfqConfig);
      }
      await loadRfq();
    } catch (err) {
      failQuote(err instanceof Error ? err.message : 'Failed to update quotation');
    } finally {
      setSavingManualId(null);
    }
  };

  const handleSaveManualEntry = async (row: TableRow, opts?: { acceptZero?: boolean }) => {
    const checked = validateRequiredQuote(row);
    if (!checked) return;
    const { draft, files, quoteLineItems, quotedPrice, zeroCount } = checked;
    if ((zeroCount > 0 || quotedPrice === 0) && !opts?.acceptZero) {
      setZeroSaveAsk({ row, kind: 'new', zeroCount: zeroCount || 1, total: quotedPrice });
      return;
    }
    const previousFile =
      savedQuoteFilesFor(row, quoteForRound(row, editingRoundById[row.invitationId]) || row.quotes?.[0]).length > 0;
    if (!files.length && !previousFile) {
      failQuote('Quotation file is required. Upload a PDF or photo first.');
      return;
    }

    setSavingManualId(row.invitationId);
    setError('');
    setQuotePopupError('');
    try {
      const filePayload = await packQuoteFilePayload(
        row,
        quoteForRound(row, editingRoundById[row.invitationId]) || row.quotes?.[0],
        files
      );

      const requesterFieldValues: Record<string, unknown> = {};
      for (const f of requesterFields) {
        if (draft[f.id] !== undefined) requesterFieldValues[f.id] = draft[f.id];
      }

      const res = await rfqApi.manualSubmit(row.invitationId, {
        quotedPrice,
        quoteLineItems,
        leadTime: Number(draft.leadTime) || 0,
        paymentTerms: String(draft.paymentTerms || 'Net 30'),
        warranty: String(draft.warranty || ''),
        deliveryTerms: String(draft.deliveryTerms || ''),
        compliance: draft.compliance !== false,
        vendorNotes: String(draft.vendorNotes || 'Manually entered by requester'),
        ...filePayload,
        requesterFields: requesterFieldValues,
        technicalScore: Number(draft.technicalScore) || 0,
        commercialScore: Number(draft.commercialScore) || 0,
        overallScore: Number(draft.overallScore) || 0,
        customFields: draft,
      });

      showToast(res.message || 'Manual quotation saved');
      setQuotePopupId(null);
      setManualDrafts((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      setManualFiles((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      setRemovedQuoteFileKeys((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      await loadRfq();
    } catch (err) {
      failQuote(err instanceof Error ? err.message : 'Failed to save quote');
    } finally {
      setSavingManualId(null);
    }
  };

  const isWideQuoteField = (field: RfqFieldDefinition) =>
    /note|comment|remark|description/i.test(`${field.id} ${field.label}`);

  const quoteFieldControlClass =
    'w-full h-11 min-h-[44px] box-border px-3 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

  const renderFieldInput = (
    field: RfqFieldDefinition,
    value: unknown,
    onChange: (val: unknown) => void,
    disabled = false
  ) => {
    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2.5 h-11 min-h-[44px] px-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 cursor-pointer select-none w-full">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-teal-600 shrink-0"
          />
          {Boolean(value) ? 'Yes' : 'No'}
        </label>
      );
    }
    if (field.id === 'paymentTerms') {
      return (
        <select
          value={String(value || 'Net 30')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={quoteFieldControlClass}
        >
          {['Net 30', 'Net 45', 'Net 60', 'Advance 50%', 'On Delivery', 'Deviated'].map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (isWideQuoteField(field)) {
      return (
        <textarea
          rows={3}
          value={value === undefined || value === null ? '' : String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[88px] box-border px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-50"
          placeholder={field.label}
        />
      );
    }
    const isMoney = field.id === 'quotedPrice' || /price|amount|cost/i.test(field.id + field.label);
    const isNumber = field.type === 'number' && !isMoney;
    if (isMoney) {
      return (
        <div className="flex items-center h-11 border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500">
          <span className="pl-3 pr-1 text-sm font-semibold text-gray-500 shrink-0 select-none">₹</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            value={formatInrTyping(value)}
            onChange={(e) => onChange(parseInrAmountInput(e.target.value))}
            onBlur={() => {
              const n = Number(String(value ?? '').replace(/[,₹\s]/g, ''));
              if (Number.isFinite(n) && n >= 0) onChange(Math.round(n * 100) / 100);
            }}
            className="w-full h-full min-w-0 pr-3 text-sm text-right font-semibold text-gray-900 outline-none disabled:bg-gray-50"
            placeholder="e.g. 45,000"
            aria-label={field.label}
          />
        </div>
      );
    }
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        min={isNumber ? 0 : undefined}
        value={value === undefined || value === null ? '' : String(value)}
        disabled={disabled}
        onChange={(e) => {
          if (isNumber) {
            const n = e.target.value === '' ? '' : Number(e.target.value);
            onChange(n === '' ? '' : Math.max(0, Number(n)));
          } else {
            onChange(e.target.value);
          }
        }}
        className={quoteFieldControlClass}
        placeholder={field.label}
      />
    );
  };

  const handleReviewFieldChange = async (submissionId: number | null, fieldId: string, value: unknown) => {
    if (!submissionId) return;
    const row = tableRows.find((r) => r.submissionId === submissionId || r.quotes?.some((q) => q.submissionId === submissionId));
    const quote = row?.quotes?.find((q) => q.submissionId === submissionId);
    const current = quote?.requesterFields || {};
    const requesterFields = { ...current, [fieldId]: value };
    await rfqApi.updateReviewFields(submissionId, requesterFields);
    setTableRows((rows) =>
      rows.map((r) => ({
        ...r,
        fieldValues: r.submissionId === submissionId ? { ...r.fieldValues, [fieldId]: value } : r.fieldValues,
        quotes: r.quotes?.map((q) =>
          q.submissionId === submissionId ? { ...q, requesterFields, fieldValues: { ...q.fieldValues, [fieldId]: value } } : q
        ),
      }))
    );
  };

  const persistBilling = async () => {
    if (!prId || isScm) return;
    const b = billingRef.current;
    await prApi.updateBilling(Number(prId), {
      billingLocationId: b.billingLocationId || undefined,
      billingLocation: b.billingLocation.trim() || undefined,
      billingGstNo: b.billingGstNo.trim() || undefined,
      billingAddress: b.billingAddress.trim() || undefined,
      deliveryPoc: b.deliveryPoc.trim() || undefined,
      deliveryPocEmail: b.deliveryPocEmail?.trim() || undefined,
      deliveryPocPhone: b.deliveryPocPhone?.trim() || undefined,
      projectManagerHo: b.projectManagerHo?.trim() || undefined,
      projectManagerContact: b.projectManagerContact?.trim() || undefined,
      projectManagerEmail: b.projectManagerEmail?.trim() || undefined,
      placeOfDelivery: b.placeOfDelivery.trim() || undefined,
      expectedDeliveryTimeline: b.expectedDeliveryTimeline.trim() || undefined,
      paymentTerms: b.paymentTerms.trim() || undefined,
    });
  };

  const buildLocalDraftPayload = () => ({
    recommendedInvitationId: recommendedId,
    recommendationJustification,
    maxRounds: config?.maxRounds ?? null,
    draftRows: draftRows.filter((r) => r.vendorId || r.vendorName || r.vendorEmail),
    manualDrafts: manualDrafts as unknown as Record<string, Record<string, unknown>>,
    billing: billingRef.current,
  });

  const persistLocalDraft = (force = false) => {
    if (!prId || isFinalized) return false;
    return writeRfqEntryDraft(user?.id, Number(prId), buildLocalDraftPayload(), {
      allowEmptyOverwrite: force,
    });
  };

  /** Save progress without sending for approval */
  const handleSaveDraft = async (): Promise<boolean> => {
    if (!prId || isFinalized) return false;
    setSavingDraft(true);
    setError('');
    try {
      // Always keep a local copy first so reload restores even if API fails
      persistLocalDraft(true);
      if (!isScm) await persistBilling();
      await rfqApi.saveConfig(Number(prId), {
        fieldDefinitions: fields,
        recommendedInvitationId: recommendedId,
        maxRounds: config?.maxRounds ?? null,
        recommendationJustification: recommendationJustification.trim() || undefined,
      });
      const ok = persistLocalDraft(true);
      draftHydratedRef.current = true;
      localDraftRestoredForPrRef.current = Number(prId);
      skipDirtyOnceRef.current = true;
      clearDirty();
      setSoftSaveHint(ok ? 'Draft saved' : 'Draft saved on server');
      showToast('RFQ draft saved — you can leave and continue later');
      window.setTimeout(() => setSoftSaveHint(''), 4000);
      return true;
    } catch (err) {
      // Local draft already written — still clear dirty so leave isn't blocked forever
      persistLocalDraft(true);
      const msg = err instanceof Error ? err.message : 'Failed to save draft';
      setError(msg);
      showToast(msg, 'err');
      return false;
    } finally {
      setSavingDraft(false);
    }
  };

  /** Ask to save before leaving RFQ Entry (sidebar / reload). */
  useEffect(() => {
    if (isFinalized) return;

    const flushLocal = () => {
      if (!prId || !draftHydratedRef.current) return;
      writeRfqEntryDraft(user?.id, Number(prId), buildLocalDraftPayload(), {
        allowEmptyOverwrite: true,
      });
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skipLeaveBlockRef.current || !dirtyRef.current) {
        flushLocal();
        return;
      }
      flushLocal();
      e.preventDefault();
      e.returnValue = '';
    };

    const onPageHide = () => {
      flushLocal();
    };

    const onDocClick = (e: MouseEvent) => {
      if (skipLeaveBlockRef.current || !dirtyRef.current || isFinalized) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      if (/^https?:\/\//i.test(href) && !href.includes(window.location.host)) return;

      let path = href;
      try {
        const u = new URL(href, window.location.origin);
        path = u.pathname + u.search;
      } catch {
        /* keep href */
      }
      const basename = String(__BASE_PATH__ || '').replace(/\/$/, '');
      if (basename && path.startsWith(basename)) {
        path = path.slice(basename.length) || '/';
      }
      const here = location.pathname;
      if (path === here || path.startsWith(`${here}?`)) return;
      // Staying on same RFQ detail (mode toggles etc.)
      if (prId && (path.includes(`/rfq-entry/${prId}`) || path.includes(`/rfq/${prId}`))) return;

      e.preventDefault();
      e.stopPropagation();

      const save = window.confirm(
        'You have unsaved RFQ changes.\n\nOK = Save Draft and leave\nCancel = Stay on this page'
      );
      if (!save) return;

      skipLeaveBlockRef.current = true;
      void (async () => {
        const ok = await handleSaveDraft();
        if (!ok) {
          // Local draft saved in handleSaveDraft; still allow leave after confirm
          clearDirty();
        }
        navigate(path);
        window.setTimeout(() => {
          skipLeaveBlockRef.current = false;
        }, 500);
      })();
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('click', onDocClick, true);
    return () => {
      flushLocal();
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('click', onDocClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: leave guards use refs + latest handlers via closure refresh on key deps
  }, [prId, isFinalized, user?.id, location.pathname, recommendedId, recommendationJustification, manualDrafts, draftRows, billing, config?.maxRounds, fields]);

  const handleSubmitRfq = async () => {
    if (!prId || !recommendedId) {
      setError('Select a recommended vendor before submitting RFQ');
      return;
    }
    const justification = recommendationJustification.trim();
    if (!justification) {
      setError('Provide justification for the recommended vendor');
      const rec = tableRows.find((r) => Number(r.invitationId) === Number(recommendedId));
      if (rec) {
        setRecommendDraft('');
        setRecommendModal({ invitationId: rec.invitationId, vendorName: rec.vendorName });
      }
      return;
    }
    const recRow = tableRows.find((r) => r.invitationId === recommendedId);
    if (!recRow?.hasActiveQuote) {
      if (recRow?.status === 'invited') {
        setError(`${recRow.vendorName} has no quotation yet. Send RFQ mail, or use Save Manual Entry in the table.`);
      } else if (recRow?.status === 'sent_back') {
        setError(`${recRow.vendorName} must re-submit quotation for Round ${recRow.round} before you can submit RFQ.`);
      } else {
        setError('Recommended vendor must have a submitted quotation. Select a vendor with a completed quote.');
      }
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (!isScm) await persistBilling();
      await rfqApi.saveConfig(Number(prId), {
        fieldDefinitions: fields,
        recommendedInvitationId: recommendedId,
        maxRounds: config?.maxRounds ?? null,
        recommendationJustification: justification,
      });
      const res = await rfqApi.finalize(
        Number(prId),
        recommendedId,
        taskId ? Number(taskId) : undefined,
        justification
      );
      clearRfqEntryDraft(user?.id, Number(prId));
      if (isScm) {
        const isOwn = String(pr?.vendorSelection || '').toLowerCase() === 'own';
        showToast(
          res.message ||
            (isOwn ? 'RFQ finalized. Continue to Create PO.' : 'RFQ finalized. Task is now in RFQ Approval.')
        );
        navigate(
          isOwn
            ? `/scm/create-po?prId=${prId}&from=rfq-entry`
            : '/scm/purchase-requests'
        );
        return;
      }
      showToast(res.message || 'RFQ submitted for HOD vendor final approval');
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBack = async (reason: string, backFields: string[]) => {
    if (!sendBackTarget) return;
    try {
      const res = await rfqApi.sendBack(sendBackTarget.invitationId, reason, backFields);
      setTableRows((res.data.tableRows || []) as TableRow[]);
      if (res.data.config) setConfig(res.data.config as RfqConfig);
      setSendBackTarget(null);
      showToast(res.message || `Re-quote Round ${sendBackTarget.round + 1} started`);
      setPreferredTab(sendBackTarget.round + 1);
      const updated = ((res.data.tableRows || []) as TableRow[]).find(
        (r) => r.invitationId === sendBackTarget.invitationId
      );
      if (updated) {
        openNewRoundPopup(updated, sendBackTarget);
      }
    } catch (err) {
      failQuote(err instanceof Error ? err.message : 'Send-back failed');
    }
  };

  const openFilePreview = async (submissionId: number, fileName: string, extraFileId?: number | null) => {
    const token = localStorage.getItem('p2p_token');
    try {
      const res = await fetch(
        extraFileId ? rfqApi.quotationExtraFileUrl(extraFileId) : rfqApi.quotationFileUrl(submissionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text();
        let message = 'Could not load quotation file';
        try {
          message = (JSON.parse(text) as { message?: string }).message || message;
        } catch {
          /* keep default */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      // Prefer server content-type so JPG/PDF render correctly even if name is odd
      const typed =
        blob.type && blob.type !== 'application/octet-stream'
          ? blob
          : new Blob([blob], {
              type: /\.pdf$/i.test(fileName)
                ? 'application/pdf'
                : /\.png$/i.test(fileName)
                  ? 'image/png'
                  : /\.(jpe?g)$/i.test(fileName)
                    ? 'image/jpeg'
                    : /\.webp$/i.test(fileName)
                      ? 'image/webp'
                      : blob.type || 'application/octet-stream',
            });
      setFilePreview({ url: URL.createObjectURL(typed), fileName });
    } catch (err) {
      failQuote(err instanceof Error ? err.message : 'Preview failed');
    }
  };

  const updateDraftVendor = (key: string, vendorId: string) => {
    const vendor = vendorCatalog.find((v) => String(v.id) === vendorId);
    setError('');
    setDraftRows((rows) => {
      const next = rows.map((r) =>
        r.key === key
          ? { ...r, vendorId, vendorName: vendor?.name || '', vendorEmail: vendor?.email || '' }
          : r
    );
      const filled = next.filter((r) => r.vendorId);
      const empty = next.find((r) => !r.vendorId) || newDraftRow();
      return [...filled, empty];
    });
  };

  const handleVendorCreated = async (vendor?: VendorRecord) => {
    const rowKey = addVendorRowKey;
    setAddVendorRowKey(null);
    await loadVendors();
    if (vendor && rowKey) {
      setDraftRows((rows) => {
        const next = rows.map((r) =>
          r.key === rowKey
            ? {
                ...r,
                vendorId: String(vendor.id),
                vendorName: vendor.name || '',
                vendorEmail: vendor.email || '',
              }
            : r
      );
        const filled = next.filter((r) => r.vendorId);
        const empty = next.find((r) => !r.vendorId) || newDraftRow();
        return [...filled, empty];
      });
      showToast(`Vendor ${vendor.name} added`);
    } else {
      showToast('Vendor added to master list');
    }
  };

  const quoteForRound = (row: TableRow, roundNum: number) => {
    const quotes = Array.isArray(row.quotes) ? row.quotes : [];
    return (
      quotes.find((q) => Number(q.round) === Number(roundNum) && Number(q.quotedPrice) > 0) ||
      quotes.find((q) => Number(q.round) === Number(roundNum)) ||
      null
    );
  };

  const latestExistingRound = (row: TableRow) => {
    const quotes = Array.isArray(row.quotes) ? row.quotes : [];
    return quotes.reduce((max, q) => {
      const filled = q.status === 'submitted' || Number(q.quotedPrice) > 0;
      if (filled) return Math.max(max, Number(q.round) || 0);
      return max;
    }, row.hasActiveQuote ? Number(row.round) || 1 : 0);
  };

  const getDisplayQuote = (row: TableRow, preferredRound?: number) => {
    const quotes = Array.isArray(row.quotes) ? row.quotes : [];
    if (preferredRound) {
      const hit = quoteForRound(row, preferredRound);
      if (hit) return hit;
    }
    if (mode === 'preview') {
      const forRound =
        quotes.find((q) => q.round === previewRound && q.status === 'submitted') ||
        quotes.find((q) => q.round === previewRound && Number(q.quotedPrice) > 0) ||
        quotes.find((q) => q.round === previewRound) ||
        null;
      if (forRound) return forRound;
    }
    const active = quotes.find((q) => q.round === row.round && q.status === 'submitted');
    if (active) return active;
    if (row.status === 'submitted') {
      return [...quotes].reverse().find((q) => q.status === 'submitted') || null;
    }
    // Fallback: latest quote with values so Recommend re-render never blanks the card
    if (row.hasActiveQuote && quotes.length) {
      return [...quotes].reverse().find((q) => Number(q.quotedPrice) > 0) || quotes[quotes.length - 1] || null;
    }
    return null;
  };

  const quoteFieldValues = (quote: ReturnType<typeof getDisplayQuote>, row?: TableRow) => {
    const fromQuote = {
      ...(quote?.fieldValues && typeof quote.fieldValues === 'object' ? quote.fieldValues : {}),
      ...(quote?.requesterFields && typeof quote.requesterFields === 'object' ? quote.requesterFields : {}),
    };
    // Fall back to top-level quote columns when fieldValues is sparse
    if (quote) {
      if (fromQuote.quotedPrice == null && quote.quotedPrice != null) fromQuote.quotedPrice = quote.quotedPrice;
    }
    if (row && fromQuote.quotedPrice == null && row.fieldValues?.quotedPrice != null) {
      fromQuote.quotedPrice = row.fieldValues.quotedPrice;
    }
    return fromQuote;
  };

  const seedDraftFromPrevious = (row: TableRow, previous?: TableRow) => {
    const source = previous || row;
    const lastRound = latestExistingRound(source);
    const last = (lastRound ? quoteForRound(source, lastRound) : null) || getDisplayQuote(source);
    const vals = quoteFieldValues(last, source);
    const saved = (Array.isArray(vals.quoteLineItems) ? vals.quoteLineItems : []) as ManualQuoteLine[];
    persistWorkingLines(row.invitationId, seedQuoteLines(saved));
    setManualDrafts((prev) => ({
      ...prev,
      [row.invitationId]: {
        ...vals,
        ...(prev[row.invitationId] || {}),
        quoteLineItems: seedQuoteLines(saved),
        leadTime: vals.leadTime ?? 0,
        paymentTerms: vals.paymentTerms ?? 'Net 30',
        warranty: vals.warranty ?? '',
        deliveryTerms: vals.deliveryTerms ?? '',
      },
    }));
  };

  const openNewRoundPopup = (row: TableRow, previous?: TableRow) => {
    cancelEditExistingQuote(row.invitationId);
    seedDraftFromPrevious(row, previous);
    setQuotePopupError('');
    setPreferredTab(Number(row.round) || 1);
    setQuotePopupId(row.invitationId);
  };

  const beginNextQuoteRound = async (row: TableRow) => {
    if (row.status === 'invited' || row.status === 'sent_back') {
      openNewRoundPopup(row);
      return;
    }
    if (row.status !== 'submitted') {
      failQuote('Save the current quote before starting the next round.');
      return;
    }
    setStartingRoundId(row.invitationId);
    try {
      const res = await rfqApi.sendBack(row.invitationId, 'Next quotation round', []);
      const rows = (res.data.tableRows || []) as TableRow[];
      setTableRows(rows);
      if (res.data.config) setConfig(res.data.config as RfqConfig);
      const updated = rows.find((r) => r.invitationId === row.invitationId) || row;
      showToast(`Q${updated.round} is ready. Fill line items and save the quote.`);
      openNewRoundPopup(updated, row);
    } catch (err) {
      failQuote(err instanceof Error ? err.message : 'Could not start the next round');
    } finally {
      setStartingRoundId(null);
    }
  };

  const openQuotePopup = (row: TableRow, targetRound?: number) => {
    if (isFinalized) return;
    setError('');
    setQuotePopupError('');
    const existingRound = latestExistingRound(row);
    const wanted = targetRound && targetRound > 0 ? targetRound : existingRound || row.round || 1;
    const existingForWanted = quoteForRound(row, wanted);

    if (existingForWanted) {
      startEditExistingQuote(row, existingForWanted);
      setQuotePopupId(row.invitationId);
      return;
    }

    if (row.status === 'invited' || row.status === 'sent_back') {
      openNewRoundPopup(row);
      return;
    }

    if (row.hasActiveQuote || existingRound > 0 || row.status === 'submitted') {
      void beginNextQuoteRound(row);
      return;
    }

    const quote = getDisplayQuote(row);
    const vals = quoteFieldValues(quote, row);
    const saved = (Array.isArray(vals.quoteLineItems) ? vals.quoteLineItems : []) as ManualQuoteLine[];
    persistWorkingLines(row.invitationId, seedQuoteLines(saved));
    setQuotePopupId(row.invitationId);
  };

  const askBeforeRequote = (row: TableRow) => {
    void beginNextQuoteRound(row);
  };

  const closeQuotePopup = () => {
    if (quotePopupId != null) cancelEditExistingQuote(quotePopupId);
    setQuotePopupError('');
    setQuotePopupId(null);
  };

  const openRecommendModal = (invitationId: number, vendorName: string) => {
    setRecommendDraft(recommendationJustification);
    setRecommendModal({ invitationId, vendorName });
    setError('');
  };

  const confirmRecommend = async () => {
    if (!recommendModal) return;
    const text = recommendDraft.trim();
    if (!text) {
      setError('Justification is required to recommend a vendor');
      return;
    }
    setRecommendedId(Number(recommendModal.invitationId));
    setRecommendationJustification(text);
    setRecommendModal(null);
    setError('');
    try {
      await saveConfig({
        recommendedInvitationId: Number(recommendModal.invitationId),
        recommendationJustification: text,
      });
      showToast(`Recommended ${recommendModal.vendorName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save recommendation');
    }
  };

  return (
    <DashboardLayout>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[80] max-w-sm px-4 py-3 text-sm font-medium rounded-lg shadow-lg ${
            toast.type === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="w-full max-w-full">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div className="flex items-start gap-3">
          <Link to={listPath} className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
            <i className="ri-arrow-left-line text-lg"></i>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Purchase request {pr?.prNumber || '—'}</p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">Collect vendor quotes</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              {pr?.title || 'Add vendors, get their prices, then pick one to send for approval.'}
            </p>
              {isScm && config?.requesterSubmittedAt && !config?.finalizedAt && (
              <span className="inline-flex mt-2 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                SCM final check
                </span>
              )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden bg-white">
            <button type="button" onClick={() => setMode('entry')} className={`px-4 py-2.5 text-sm font-medium ${mode === 'entry' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              Work on quotes
                </button>
            <button type="button" onClick={() => setMode('preview')} className={`px-4 py-2.5 text-sm font-medium border-l border-gray-200 ${mode === 'preview' ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              Compare prices
            </button>
            </div>
          {prId && !isFinalized && (
            <button
              type="button"
              onClick={() => setEditPrOpen(true)}
              className="px-5 py-2.5 border border-teal-300 text-teal-800 bg-teal-50 text-sm font-semibold rounded-xl hover:bg-teal-100"
            >
              <i className="ri-edit-line mr-1.5"></i>
              Edit PR
            </button>
          )}
          {!isFinalized && (
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={savingDraft || submitting || loading}
              className={`px-5 py-2.5 border text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50 ${
                isDirty ? 'border-amber-400 text-amber-900 bg-amber-50' : 'border-gray-300 text-gray-700'
              }`}
            >
              <i className="ri-save-line mr-1.5"></i>
              {savingDraft ? 'Saving…' : isDirty ? 'Save Draft*' : 'Save Draft'}
            </button>
          )}
          {!isFinalized && hasInvitations && (
            <button
              type="button"
              onClick={handleSubmitRfq}
              disabled={submitting || savingDraft || !recommendedId || !canSubmitRfq}
              title={
                !recommendedId
                  ? 'First choose a recommended vendor'
                  : !recommendedRow?.hasActiveQuote
                    ? 'That vendor still needs a quote'
                    : !recommendationJustification.trim()
                      ? 'Write why you picked this vendor'
                      : undefined
              }
              className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {submitting ? (isScm ? 'Go PO…' : 'Submitting...') : isScm ? 'Go PO' : 'Send for approval'}
            </button>
          )}
        </div>
      </div>

      {softSaveHint && !isFinalized && (
        <p className="mb-3 text-xs text-emerald-600 font-medium">
          <i className="ri-checkbox-circle-line mr-1"></i>
          {softSaveHint}
        </p>
      )}

      {!isFinalized && mode === 'entry' && !loading && (
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              n: 1,
              title: 'Add vendors',
              hint: 'Choose who should quote',
              done: hasInvitations,
            },
            {
              n: 2,
              title: 'Get quotes',
              hint: 'Email them, type a quote, or upload with AI',
              done: quotedCount > 0,
            },
            {
              n: 3,
              title: 'Pick one vendor',
              hint: 'Recommend the winner and send for approval',
              done: Boolean(recommendedId && canSubmitRfq),
            },
          ].map((s) => {
            const active = guideStep === s.n;
            return (
              <div
                key={s.n}
                className={`rounded-2xl border px-4 py-3 ${
                  s.done
                    ? 'border-emerald-200 bg-emerald-50'
                    : active
                      ? 'border-teal-300 bg-teal-50 shadow-sm'
                      : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                      s.done
                        ? 'bg-emerald-600 text-white'
                        : active
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s.done ? <i className="ri-check-line" /> : s.n}
                  </span>
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 pl-9">{s.hint}</p>
              </div>
            );
          })}
        </div>
      )}

      {!isScm && pr && (
        <div className="mb-5">
          <PrBillingDeliverySection
            value={billing}
            selectedEntity={selectedEntity}
            billingLocations={billingLocations}
            disabled={isFinalized}
            hint="For Standard + Own vendor, fill billing and delivery here (not on Create PR)."
            onChange={(patch) => {
              setBilling((prev) => ({ ...prev, ...patch }));
            }}
          />
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {!isFinalized && config?.sendBackRemarks && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-900">
          <p className="font-semibold flex items-center gap-1.5 mb-1">
            <i className="ri-arrow-go-back-line"></i>
            Sent back — action required
          </p>
          <p className="whitespace-pre-wrap text-orange-800">{config.sendBackRemarks}</p>
        </div>
      )}
      {isFinalized && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          {config?.finalizedAt
            ? isScm
              ? 'RFQ finalized. This task is on SCM Dashboard → RFQ Approval (or Create PO for own vendor).'
              : 'RFQ finalized. Task completed.'
            : 'RFQ submitted for HOD vendor final → L2 → CFO approval. Task completed.'}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-4 pb-4">
          {!isFinalized && mode === 'entry' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 1</p>
                <h2 className="text-base font-bold text-gray-900 mt-0.5">Add vendors</h2>
                <p className="text-sm text-gray-500 mt-1">Search a vendor, then choose email, type the quote, or upload with AI.</p>
              </div>

              {draftRows.filter((r) => r.vendorId).length > 0 && (
                <div className="space-y-2 mb-4">
                  {draftRows.filter((r) => r.vendorId).map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-teal-200 bg-teal-50/60"
                    >
                      <span className="w-8 h-8 rounded-lg bg-white border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                        <i className="ri-store-2-line" />
                  </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{row.vendorName}</p>
                        <p className="text-xs text-gray-500 truncate">{row.vendorEmail || 'No email on file'}</p>
              </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftRows((rows) => {
                            const next = rows.filter((x) => x.key !== row.key);
                            return next.some((x) => !x.vendorId) ? next : [...next, newDraftRow()];
                          })
                        }
                        className="text-sm text-gray-500 hover:text-red-600 px-2"
                      >
                        Remove
                      </button>
              </div>
                  ))}
            </div>
          )}

              {draftRows.filter((r) => !r.vendorId).slice(0, 1).map((row) => (
                <div key={row.key} className="space-y-2 mb-4">
                  <label className="text-xs font-semibold text-gray-600">Search vendor</label>
                  <VendorSearchSelect
                    vendors={vendorCatalog}
                      value={row.vendorId}
                    takenNames={invitedVendorNames}
                    takenIds={new Set(draftRows.filter((r) => r.vendorId).map((r) => r.vendorId))}
                    onChange={(vendorId) => updateDraftVendor(row.key, vendorId)}
                    placeholder="Type name, vendor code, or email"
                  />
                    <button
                      type="button"
                      onClick={() => setAddVendorRowKey(row.key)}
                    className="text-sm text-teal-700 font-semibold inline-flex items-center gap-1.5"
                    >
                    <i className="ri-user-add-line" />
                    Vendor not in the list? Create new
                    </button>
                  </div>
                ))}

              <p className="text-sm font-semibold text-gray-800 mb-2">How do you want to get the quote?</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handleSendMail}
                  disabled={sendingMail || addingManual}
                  className="text-left rounded-2xl border border-amber-200 bg-amber-50/70 p-4 hover:border-amber-300 disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-lg bg-amber-500 text-white inline-flex items-center justify-center mb-2">
                    <i className="ri-mail-send-line" />
                  </span>
                  <p className="text-sm font-bold text-gray-900">{sendingMail ? 'Sending…' : 'Email the vendor'}</p>
                  <p className="text-xs text-gray-600 mt-1">They open the link and type their price themselves.</p>
                </button>
                <button
                  type="button"
                  onClick={handleAddManualEntry}
                  disabled={sendingMail || addingManual}
                  className="text-left rounded-2xl border border-teal-200 bg-teal-50/70 p-4 hover:border-teal-300 disabled:opacity-50"
                >
                  <span className="w-9 h-9 rounded-lg bg-teal-600 text-white inline-flex items-center justify-center mb-2">
                    <i className="ri-edit-line" />
                  </span>
                  <p className="text-sm font-bold text-gray-900">{addingManual ? 'Adding…' : 'I will type the quote'}</p>
                  <p className="text-xs text-gray-600 mt-1">You already have the price. Fill it here and attach the file.</p>
                </button>
                <button
                  type="button"
                  onClick={openRfqChat}
                  className="text-left rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-slate-300"
                >
                  <span className="w-9 h-9 rounded-lg bg-slate-900 text-white inline-flex items-center justify-center mb-2">
                    <i className="ri-robot-2-line" />
                  </span>
                  <p className="text-sm font-bold text-gray-900">Upload with AI</p>
                  <p className="text-xs text-gray-600 mt-1">Chat asks the vendor name, then you upload the quotation file.</p>
                </button>
              </div>
            </div>
          )}

          {hasInvitations && mode === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Compare vendor prices</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    See each vendor’s price side by side, then go back to pick a winner.
                  </p>
                </div>
                {comparison && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-800">
                    <i className="ri-refresh-line"></i>
                    Total Rounds:{' '}
                    {comparison.maxRounds != null && comparison.maxRounds > 0
                      ? `${comparison.totalRounds || 1} of ${comparison.maxRounds}`
                      : comparison.totalRounds || 1}
                  </span>
                )}
              </div>
              {comparisonLoading ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-500">
                  Loading comparison…
                </div>
              ) : comparison ? (
                <VendorComparisonMatrix
                  data={comparison}
                  selectedVendorId={recommendedId}
                  onPreviewFile={(submissionId, _vendorName, fileName) => {
                    void openFilePreview(submissionId, fileName);
                  }}
                />
              ) : (
                <div className="bg-white border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
                  Comparison data unavailable. Switch back to Entry or refresh the page.
                </div>
              )}
            </div>
          )}

          {hasInvitations && mode === 'entry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Step 2 &amp; 3</p>
                  <h2 className="text-base font-bold text-gray-900 mt-0.5">Get quotes and pick a vendor</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Tap <strong>Edit</strong> to fill the current round. Use <strong>Next round</strong> only when you need a re-quote, then <strong>Save quote + file</strong>. Finally <strong>Choose</strong> a vendor.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-600">
                  {quotedCount} of {tableRows.length} quotes received
                </div>
              </div>

              <RfqVendorQuoteTable
                rows={tableRows}
                recommendedId={recommendedId}
                quotedCount={quotedCount}
                isFinalized={isFinalized}
                removingId={removingId}
                resendingId={resendingId}
                preferredTab={preferredTab}
                onEdit={(row, targetRound) => openQuotePopup(row as TableRow, targetRound)}
                onChoose={(row) =>
                  row.hasActiveQuote && openRecommendModal(row.invitationId, row.vendorName)
                }
                onRemove={(row) => handleRemoveVendor(row as TableRow)}
                onResend={(row) => handleResendMail(row as TableRow)}
                onSendBack={(row) => askBeforeRequote(row as TableRow)}
                onNextRound={(nextRound) => setPreferredTab(nextRound)}
                onViewFile={(row) => {
                  const extraId = Number(row.quotationExtraFileId) || 0;
                  const submissionId =
                    Number(row.quotationSubmissionId) ||
                    Number(row.submissionId) ||
                    0;
                  const fileName = row.quotationFileName || 'quotation';
                  if (extraId) {
                    void openFilePreview(submissionId, fileName, extraId);
                    return;
                  }
                  if (!submissionId) {
                    failQuote('No saved quotation file to preview. Open Edit and re-upload if needed.');
                    return;
                  }
                  void openFilePreview(submissionId, fileName);
                }}
              />

              {tableRows.filter((row) => row.invitationId === quotePopupId).map((row, i) => {
                  const quote = getDisplayQuote(row, editingRoundById[row.invitationId]);
                  const vals = quoteFieldValues(quote, row);
                  const submissionId = quote?.submissionId || row.submissionId;
                  const isManualRow = row.inviteMode === 'manual';
                  const isEmailRow = row.inviteMode !== 'manual';
                  const awaitingManualEntry =
                    !row.hasActiveQuote &&
                    (row.status === 'invited' || row.status === 'sent_back' || isManualRow);
                  const isEditingExisting = editingQuoteIds.has(row.invitationId);
                  const quoteFieldsEditable =
                    mode === 'entry' &&
                    !isFinalized &&
                    (awaitingManualEntry || (isEditingExisting && canEditExistingQuote));
                  const awaitingVendorEmail =
                    isEmailRow &&
                    !row.hasActiveQuote &&
                    (row.status === 'invited' || row.status === 'sent_back');
                  const isRecommended =
                    Number(recommendedId) === Number(row.invitationId) || Boolean(row.isRecommended);
                  const displayRound = editingRoundById[row.invitationId] || row.round;
                  const statusLabel = awaitingManualEntry
                    ? 'Your turn — type quote'
                    : awaitingVendorEmail && !quoteFieldsEditable
                      ? row.status === 'sent_back'
                        ? 'Waiting for new quote'
                        : 'Waiting for vendor email'
                      : row.hasActiveQuote
                        ? 'Quote received'
                        : row.status;

                  return (
                    <div key={row.id} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
                      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/80">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900 truncate">Edit quote — {row.vendorName}</h3>
                              <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[11px] font-semibold text-gray-600">
                                Round {displayRound}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  awaitingManualEntry
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : awaitingVendorEmail
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : row.hasActiveQuote
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {statusLabel}
                              </span>
                              {isRecommended && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1">
                                  <i className="ri-star-fill text-emerald-500"></i>
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {quote?.quotationFileName
                                ? 'Update line items and quoted price. Replace the file only if needed.'
                                : 'Upload the quotation file, then fill line items and quoted price. Those three are required.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {awaitingManualEntry && (
                            <button
                              type="button"
                              onClick={() => handleSaveManualEntry(row)}
                              disabled={savingManualId === row.invitationId || startingRoundId === row.invitationId}
                              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                              {savingManualId === row.invitationId ? 'Saving...' : 'Save quote + file'}
                            </button>
                          )}
                          {!isFinalized &&
                            (isEditingExisting || (row.hasActiveQuote && canEditExistingQuote)) &&
                            !awaitingManualEntry && (
                            <button
                              type="button"
                              onClick={() => void handleSaveExistingQuote(row)}
                              disabled={savingManualId === row.invitationId}
                              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                              {savingManualId === row.invitationId ? 'Saving…' : 'Save changes'}
                            </button>
                          )}
                            <button
                              type="button"
                            onClick={closeQuotePopup}
                            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                            >
                            Close
                            </button>
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-6">
                        {quotePopupError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {quotePopupError}
                          </div>
                        )}
                        {awaitingVendorEmail && (
                          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3">
                            <p className="text-sm font-medium text-amber-800">
                              Vendor email was sent. You can still type this round here and save it.
                            </p>
                          </div>
                        )}
                        <>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                                Quotation files{' '}
                                {savedQuoteFilesFor(row, quote).length || localFilesFor(row.invitationId).length
                                  ? null
                                  : <span className="text-red-500">*</span>}
                              </p>
                              {(() => {
                                const saved = savedQuoteFilesFor(row, quote);
                                const locals = localFilesFor(row.invitationId);
                                const hasAny = saved.length + locals.length > 0;
                                return (
                                  <>
                              {saved.map((sf, idx) => (
                                <span
                                  key={`saved-${sf.id || sf.fileName}-${idx}`}
                                  className="mb-2 mr-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-teal-700"
                                >
                                  <i className="ri-file-look-line" />
                                  <span className="truncate max-w-[220px]">{sf.fileName}</span>
                                  <button
                                    type="button"
                                    className="text-xs text-gray-500 hover:text-teal-800"
                                    onClick={() => {
                                      if (sf.id) void openFilePreview(quote?.submissionId || 0, sf.fileName, sf.id);
                                      else if (quote?.submissionId) void openFilePreview(quote.submissionId, sf.fileName);
                                    }}
                                  >
                                    Preview
                                  </button>
                                  {quoteFieldsEditable ? (
                                    <button
                                      type="button"
                                      title="Remove file"
                                      className="ml-1 text-gray-400 hover:text-red-600"
                                      onClick={() => removeSavedQuoteFile(row.invitationId, sf)}
                                    >
                                      <i className="ri-close-line" />
                                    </button>
                                  ) : null}
                                </span>
                              ))}
                              {locals.map((lf, idx) => (
                                <span
                                  key={`local-${lf.name}-${idx}`}
                                  className="mb-2 mr-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-sm font-medium text-teal-800"
                                >
                                  {lf.name}
                                  <button
                                    type="button"
                                    className="text-gray-400 hover:text-red-600"
                                    onClick={() =>
                                      setManualFiles((prev) => ({
                                        ...prev,
                                        [row.invitationId]: (prev[row.invitationId] || []).filter((_, i) => i !== idx),
                                      }))
                                    }
                                  >
                                    <i className="ri-close-line" />
                                  </button>
                                </span>
                              ))}
                              {quoteFieldsEditable ? (
                                <label
                                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 border-2 border-dashed rounded-xl cursor-pointer ${
                                    hasAny
                                      ? 'border-teal-300 bg-teal-50/40 hover:bg-teal-50'
                                      : 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                                  }`}
                                >
                                  <i className={`text-xl shrink-0 ${hasAny ? 'ri-upload-2-line text-teal-700' : 'ri-upload-cloud-2-line text-red-500'}`} />
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold ${hasAny ? 'text-teal-800' : 'text-red-700'}`}>
                                      {hasAny ? 'Add more quotation files' : 'Upload quotation files (required)'}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      PDF, Word, Excel, or photo · multiple files · max 10MB each
                                    </p>
                                  </div>
                                  <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                                    className="text-xs max-w-full"
                                    onChange={(e) => {
                                      const picked = Array.from(e.target.files || []);
                                      e.target.value = '';
                                      if (!picked.length) return;
                                      setManualFiles((prev) => ({
                                        ...prev,
                                        [row.invitationId]: [...(prev[row.invitationId] || []), ...picked],
                                      }));
                                    }}
                                  />
                                </label>
                              ) : !hasAny ? (
                                <p className="text-sm text-red-600">No quotation file uploaded.</p>
                              ) : null}
                                  </>
                                );
                              })()}
                      </div>

                            {(() => {
                              const savedLines = (Array.isArray(vals.quoteLineItems)
                                ? vals.quoteLineItems
                                : []) as ManualQuoteLine[];
                              const displayLines = quoteFieldsEditable
                                ? getWorkingLines(row.invitationId, savedLines)
                                : seedQuoteLines(savedLines);
                              const inputClass =
                                'w-full min-w-[4.5rem] h-10 box-border px-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
                              return (
                              <div>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                    Line items <span className="text-red-500">*</span>
                                  </p>
                                  {quoteFieldsEditable && (
                                    <button
                                      type="button"
                                      onClick={() => addExtraQuoteLine(row.invitationId)}
                                      className="text-sm font-semibold text-teal-700 inline-flex items-center gap-1"
                                    >
                                      <i className="ri-add-line" />
                                      Add another line item
                                    </button>
                                  )}
                          </div>
                                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead className="bg-teal-50/70">
                                      <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                          Item
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-teal-700 uppercase w-24">
                                          Qty
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-teal-700 uppercase w-36">
                                          Quoted unit (₹)
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-teal-700 uppercase w-24">
                                          GST %
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-32">
                                          Line total
                                        </th>
                                        {quoteFieldsEditable && (
                                          <th className="px-3 py-3 w-12" />
                                        )}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {displayLines.length === 0 ? (
                                        <tr>
                                          <td colSpan={quoteFieldsEditable ? 6 : 5} className="px-4 py-6 text-center text-sm text-gray-500">
                                            No line items yet. Tap Add another line item.
                                          </td>
                                        </tr>
                                      ) : (
                                      displayLines.map((li) => {
                                        const lineId = String(li.lineItemId);
                                        const prItem = prLineItems.find((p) => String(p.id) === lineId);
                                        const editable = quoteFieldsEditable;
                                        const unitPrice = editable
                                          ? getManualLineUnitPrice(row.invitationId, lineId)
                                          : Number(li.quotedUnitPrice) || 0;
                                        const qty = editable
                                          ? getManualLineQty(row.invitationId, lineId, Number(li.quantity) || 0)
                                          : Number(li.quantity) || 0;
                                        const gst = editable
                                          ? getManualLineGst(row.invitationId, lineId, Number(li.gstPercent) || 18)
                                          : Number(li.gstPercent) || 0;
                                        const lineTotal = lineQuotedTotal({
                                          quantity: Number(qty) || 0,
                                          quotedUnitPrice: Number(unitPrice) || 0,
                                          gstPercent: gst,
                                        });
                                        return (
                                          <tr key={lineId} className="border-t border-gray-100">
                                            <td className="px-4 py-3">
                                              {editable && li.extra ? (
                                                <input
                                                  type="text"
                                                  value={li.description || ''}
                                                  onChange={(e) =>
                                                    setManualLineField(
                                                      row.invitationId,
                                                      lineId,
                                                      'description',
                                                      e.target.value
                                                    )
                                                  }
                                                  className={inputClass}
                                                  placeholder="Item name"
                                                />
                        ) : (
                          <>
                                                  <p className="font-medium text-gray-900">{li.description || prItem?.description}</p>
                                                  {(li.category || prItem?.category) ? (
                                                    <p className="text-xs text-gray-400">{li.category || prItem?.category}</p>
                                                  ) : li.extra ? (
                                                    <p className="text-xs text-teal-600">Added on this quote</p>
                                                  ) : (
                                                    <p className="text-xs text-gray-400">From PR</p>
                                                  )}
                                                </>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              {editable ? (
                                                <input
                                                  type="number"
                                                  min={1}
                                                  step="any"
                                                  value={qty === '' ? '' : String(qty)}
                                                  onChange={(e) =>
                                                    setManualLineField(
                                                      row.invitationId,
                                                      lineId,
                                                      'quantity',
                                                      e.target.value === ''
                                                        ? ''
                                                        : Math.max(0, Number(e.target.value) || 0)
                                                    )
                                                  }
                                                  className={`${inputClass} text-center`}
                                                  placeholder="1"
                                                />
                                              ) : (
                                                <div className="text-center font-semibold text-gray-900">{qty || '—'}</div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              {editable ? (
                                                <div className="flex items-center h-10 border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-teal-500">
                                                  <span className="pl-2 pr-1 text-sm font-semibold text-gray-500 shrink-0">₹</span>
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    autoComplete="off"
                                                    value={formatInrTyping(unitPrice)}
                                                    onChange={(e) =>
                                                      setManualLineField(
                                                        row.invitationId,
                                                        lineId,
                                                        'quotedUnitPrice',
                                                        parseAmountInput(e.target.value)
                                                      )
                                                    }
                                                    className="w-full h-full min-w-0 px-1 text-sm text-right font-medium outline-none"
                                                    placeholder="0"
                                                  />
                                                </div>
                                              ) : (
                                                <div className="text-right font-medium text-gray-900">
                                                  {unitPrice ? formatCurrency(Number(unitPrice)) : '—'}
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              {editable ? (
                                                <select
                                                  value={String(gst)}
                                                  onChange={(e) =>
                                                    setManualLineField(
                                                      row.invitationId,
                                                      lineId,
                                                      'gstPercent',
                                                      Number(e.target.value) || 0
                                                    )
                                                  }
                                                  className="w-full h-10 px-2 border border-gray-300 rounded-lg text-sm bg-white text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                                                >
                                                  {GST_RATES.map((rate) => (
                                                    <option key={rate} value={rate}>
                                                      {rate}%
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : (
                                                <div className="text-center text-sm text-gray-900">{gst}%</div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                              {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                                            </td>
                                            {editable && (
                                              <td className="px-3 py-3 text-center">
                                                {li.extra ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => removeExtraQuoteLine(row.invitationId, lineId)}
                                                    className="text-red-500 hover:text-red-700"
                                                    title="Remove line"
                                                  >
                                                    <i className="ri-delete-bin-line" />
                                                  </button>
                                                ) : null}
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })
                                      )}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-teal-200 bg-teal-50">
                                        <td
                                          colSpan={4}
                                          className="px-4 py-3 text-right text-xs font-bold text-teal-900 uppercase"
                                        >
                                          Total quoted amount
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-teal-800">
                                          {formatCurrency(
                                            quoteFieldsEditable
                                              ? getManualQuoteTotal(row.invitationId)
                                              : Number(vals.quotedPrice) || 0
                                          )}
                                        </td>
                                        {quoteFieldsEditable && <td />}
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">
                                  Enter quoted unit amount and GST. Line total = qty × quoted unit + GST. Extra items apply to this quote only.
                                </p>
                              </div>
                              );
                            })()}

                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Other quote details</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                {vendorFieldsWithoutPrice.map((f) => (
                                  <div
                                    key={f.id}
                                    className={`flex flex-col gap-2 min-w-0 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 ${
                                      isWideQuoteField(f) ? 'md:col-span-2' : ''
                                    }`}
                                  >
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 leading-none">
                                      {f.label}
                                    </label>
                                    {quoteFieldsEditable ? (
                                      renderFieldInput(
                                        f,
                                        getManualValue(row.invitationId, f.id, f.id === 'compliance' ? true : ''),
                                        (val) => setManualValue(row.invitationId, f.id, val)
                                      )
                                    ) : (
                                      <div className="min-h-[44px] px-3 rounded-xl bg-white border border-gray-200 text-sm text-gray-900 flex items-center">
                                        {formatFieldValue(f, vals[f.id])}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <div className="flex flex-col gap-2 min-w-0 rounded-xl border border-teal-200 bg-teal-50/70 p-3.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-teal-700 leading-none">
                                        Quoted Price (₹) <span className="text-red-500">*</span>
                                      </label>
                                      {quoteFieldsEditable &&
                                        Boolean(manualDrafts[row.invitationId]?.quotedPriceManual) && (
                                          <button
                                            type="button"
                                            onClick={() => useLineTotalAsQuotedPrice(row.invitationId)}
                                            className="text-[10px] font-semibold text-teal-700 hover:text-teal-900 underline"
                                          >
                                            Use line total
                                          </button>
                                        )}
                                    </div>
                                    {quoteFieldsEditable ? (
                                      <div className="flex items-center h-11 border border-teal-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500">
                                        <span className="pl-3 pr-1 text-sm font-semibold text-teal-600 shrink-0 select-none">
                                          ₹
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          autoComplete="off"
                                          value={formatInrTyping(
                                            getManualValue(
                                              row.invitationId,
                                              'quotedPrice',
                                              getManualQuoteTotal(row.invitationId) || ''
                                            )
                                          )}
                                          onChange={(e) =>
                                            setQuotedPriceManual(
                                              row.invitationId,
                                              parseInrAmountInput(e.target.value)
                                            )
                                          }
                                          onBlur={() => {
                                            const raw = getManualValue(row.invitationId, 'quotedPrice', '');
                                            const n = Number(String(raw ?? '').replace(/[,₹\s]/g, ''));
                                            if (Number.isFinite(n) && n >= 0) {
                                              setQuotedPriceManual(row.invitationId, Math.round(n * 100) / 100);
                                            }
                                          }}
                                          className="w-full h-full min-w-0 pr-3 text-sm text-right font-bold text-teal-900 outline-none"
                                          placeholder="Type total quoted price"
                                        />
                                      </div>
                                    ) : (
                                      <div className="min-h-[44px] px-3 rounded-xl bg-white border border-teal-100 text-sm font-bold text-teal-800 flex items-center">
                                        {formatCurrency(Number(vals.quotedPrice) || 0)}
                                      </div>
                                    )}
                                    {quoteFieldsEditable && (
                                      <p className="text-[11px] text-teal-800/80 leading-snug">
                                        You can type Quoted Price manually. Line table total is{' '}
                                        <span className="font-semibold">
                                          {formatCurrency(getManualQuoteTotal(row.invitationId))}
                                        </span>
                                        {manualDrafts[row.invitationId]?.quotedPriceManual
                                          ? ' — manual value will be saved.'
                                          : ' — editing lines updates this unless you type a custom amount.'}
                                      </p>
                                    )}
                                  </div>
                              </div>
                            </div>

                            {(mode === 'entry' || requesterFields.some((f) => vals[f.id] !== undefined && vals[f.id] !== '')) &&
                              requesterFields.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-3">Your scoring fields</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                  {requesterFields.map((f) => (
                                    <div
                                      key={f.id}
                                      className={`flex flex-col gap-2 min-w-0 rounded-xl border border-violet-200 bg-violet-50/50 p-3.5 ${
                                        isWideQuoteField(f) ? 'md:col-span-2' : ''
                                      }`}
                                    >
                                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-violet-700 leading-none">
                                        {f.label}
                                      </label>
                                      {mode === 'entry' && !isFinalized ? (
                                        quoteFieldsEditable ? (
                                          renderFieldInput(
                                            f,
                                            getManualValue(row.invitationId, f.id, vals[f.id]),
                                            (val) => setManualValue(row.invitationId, f.id, val)
                                          )
                                        ) : f.type === 'boolean' ? (
                                          <label className="inline-flex items-center gap-2.5 h-11 min-h-[44px] px-3 rounded-xl border border-violet-200 bg-white text-sm text-gray-700 cursor-pointer w-full">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(vals[f.id])}
                                              onChange={(e) => handleReviewFieldChange(submissionId, f.id, e.target.checked)}
                                              className="w-4 h-4 accent-violet-600"
                                            />
                                            {Boolean(vals[f.id]) ? 'Yes' : 'No'}
                                          </label>
                                        ) : isWideQuoteField(f) ? (
                                          <textarea
                                            rows={3}
                                            value={String(vals[f.id] ?? '')}
                                            onChange={(e) => handleReviewFieldChange(submissionId, f.id, e.target.value)}
                                            className="w-full min-h-[88px] box-border px-3 py-2.5 border border-violet-200 rounded-xl text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            placeholder={f.label}
                                          />
                                        ) : (
                                          <input
                                            type={f.type === 'number' ? 'number' : 'text'}
                                            min={f.type === 'number' ? 0 : undefined}
                                            value={String(vals[f.id] ?? '')}
                                            onChange={(e) =>
                                              handleReviewFieldChange(
                                                submissionId,
                                                f.id,
                                                f.type === 'number'
                                                  ? Math.max(0, Number(e.target.value) || 0)
                                                  : e.target.value
                                              )
                                            }
                                            className="w-full h-11 min-h-[44px] box-border px-3 border border-violet-200 rounded-xl text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-violet-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder={f.label}
                                          />
                                        )
                                      ) : (
                                        <div className="min-h-[44px] px-3 rounded-xl bg-white border border-violet-100 text-sm text-gray-900 flex items-center">
                                          {formatFieldValue(f, vals[f.id])}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                                  </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {!isFinalized && mode === 'entry' && (
            <RfqExtraQuestionsPanel
              open={fieldsOpen}
              onToggle={() => setFieldsOpen((v) => !v)}
              fields={fields}
              presets={vendorFieldPresets}
              onAdd={(field) => void addFieldDef(field)}
              onRemove={(fieldId) => void removeField(fieldId)}
            />
          )}
        </div>
      )}
      </div>

      {recommendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Choose this vendor</h3>
                <p className="text-xs text-gray-500 mt-0.5">{recommendModal.vendorName}</p>
              </div>
              <button
                type="button"
                onClick={() => setRecommendModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                Why this vendor? <span className="text-red-500">*</span>
                                </label>
              <textarea
                value={recommendDraft}
                onChange={(e) => setRecommendDraft(e.target.value)}
                rows={4}
                placeholder="Example: Lowest price and delivery in 10 days"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-gray-500">
                Required before you send this RFQ for approval. Managers will see this reason.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                                <button
                                  type="button"
                onClick={() => setRecommendModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                Cancel
                                </button>
              <button
                type="button"
                onClick={() => void confirmRecommend()}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Save choice
              </button>
                            </div>
          </div>
        </div>
      )}

      {zeroSaveAsk && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Save quote with ₹0?</h3>
              <p className="text-sm text-gray-600 mt-1">{zeroSaveAsk.row.vendorName}</p>
                      </div>
            <div className="p-5 text-sm text-gray-700 space-y-2">
              <p>
                {zeroSaveAsk.zeroCount > 1
                  ? `${zeroSaveAsk.zeroCount} line items have quoted unit ₹0.`
                  : 'A line item has quoted unit ₹0.'}
                {zeroSaveAsk.total <= 0 ? ' Total quoted amount is ₹0.' : ''}
              </p>
              <p className="text-xs text-gray-500">Save this quote anyway?</p>
                    </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setZeroSaveAsk(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { row, kind } = zeroSaveAsk;
                  setZeroSaveAsk(null);
                  if (kind === 'existing') void handleSaveExistingQuote(row, { acceptZero: true });
                  else void handleSaveManualEntry(row, { acceptZero: true });
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Save anyway
              </button>
            </div>
              </div>
            </div>
          )}

      {quoteAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Quote already exists</h3>
              <p className="text-sm text-gray-600 mt-1">{quoteAsk.row.vendorName}</p>
            </div>
            <div className="p-5 space-y-3 text-sm text-gray-700">
              <p>
                Q{quoteAsk.existingRound} is already saved. Do not create a new round unless you need a
                re-quote.
              </p>
              <p className="text-xs text-gray-500">
                {quoteAsk.source === 'requote'
                  ? `Re-quote will start Q${quoteAsk.targetRound}. To change the current price, edit Q${quoteAsk.existingRound}.`
                  : `Q${quoteAsk.targetRound} is empty. Edit the existing Q${quoteAsk.existingRound} quote, or start a new re-quote round.`}
              </p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuoteAsk(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const { row, existingRound } = quoteAsk;
                  const quote = quoteForRound(row, existingRound);
                  setQuoteAsk(null);
                  startEditExistingQuote(row, quote);
                  setQuotePopupId(row.invitationId);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Edit existing Q{quoteAsk.existingRound}
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = quoteAsk.row;
                  setQuoteAsk(null);
                  void beginNextQuoteRound(row);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                Create new round
              </button>
            </div>
          </div>
        </div>
      )}

      {sendBackTarget && (
        <SendBackModal vendorName={sendBackTarget.vendorName} currentRound={sendBackTarget.round} onConfirm={handleSendBack} onClose={() => setSendBackTarget(null)} />
      )}

      {addVendorRowKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <CreateVendorForm
              compact
              onSuccess={handleVendorCreated}
              onCancel={() => setAddVendorRowKey(null)}
            />
          </div>
        </div>
      )}

      {!isFinalized && prId ? (
        <RfqChatbot
          prId={Number(prId)}
          prNumber={pr?.prNumber}
          isFinalized={isFinalized}
          vendors={vendorCatalog}
          tableRows={tableRows}
          lineItems={prLineItems}
          fieldDefinitions={fields}
          onRefresh={() => loadRfq({ soft: true })}
          onToast={showToast}
        />
      ) : null}

      {filePreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <span className="font-semibold text-gray-900 truncate">{filePreview.fileName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={filePreview.url}
                  download={filePreview.fileName}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Download
                </a>
                <button
                  type="button"
                  className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                  onClick={() => {
                    URL.revokeObjectURL(filePreview.url);
                    setFilePreview(null);
                  }}
                >
                  ×
                </button>
            </div>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-slate-100/80">
              {/\.pdf$/i.test(filePreview.fileName) ? (
                <iframe title="Quotation preview" src={filePreview.url} className="w-full h-[75vh] border rounded-lg bg-white" />
              ) : /\.(png|jpe?g|gif|webp|bmp)$/i.test(filePreview.fileName) ? (
                <div className="flex items-center justify-center min-h-[50vh]">
                  <img
                    src={filePreview.url}
                    alt={filePreview.fileName}
                    className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-sm bg-white"
                  />
                </div>
              ) : (
                <div className="text-center py-16 text-sm text-gray-600 space-y-3">
                  <p>Preview is not available for this file type.</p>
                  <a
                    href={filePreview.url}
                    download={filePreview.fileName}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white font-semibold"
                  >
                    <i className="ri-download-line" />
                    Download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {prId ? (
        <RfqEditPrModal
          open={editPrOpen}
          prId={Number(prId)}
          onClose={() => setEditPrOpen(false)}
          onToast={(msg) => showToast(msg)}
          onSaved={() => {
            billingHydratedRef.current = false;
            void loadRfq();
          }}
        />
      ) : null}
    </DashboardLayout>
  );
}
