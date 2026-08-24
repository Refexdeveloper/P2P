import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import VendorComparisonMatrix from '../../../components/rfq/VendorComparisonMatrix';
import SendBackModal from '../../scm/rfq-entry/components/SendBackModal';
import CreateVendorForm from '../../scm/vendor-master/components/CreateVendorForm';
import { useAuth } from '../../../contexts/AuthContext';
import {
  rfqApi,
  RfqFieldDefinition,
  VendorComparisonData,
  vendorApi,
  VendorRecord,
} from '../../../services/api';
import RfqChatbot, { openRfqChat } from '../../../components/feature/RfqChatbot';
import RfqVendorQuoteTable from './components/RfqVendorQuoteTable';
import VendorSearchSelect from './components/VendorSearchSelect';
import RfqExtraQuestionsPanel from './components/RfqExtraQuestionsPanel';

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

function formatFieldValue(field: RfqFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.id === 'quotedPrice') return formatCurrency(Number(value));
  return String(value);
}

export default function RfqEntryDetailPage() {
  const { user } = useAuth();
  const { prId } = useParams<{ prId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
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
  const [toast, setToast] = useState('');
  const [sendBackTarget, setSendBackTarget] = useState<TableRow | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);
  const [manualDrafts, setManualDrafts] = useState<Record<number, Record<string, unknown>>>({});
  const [manualFiles, setManualFiles] = useState<Record<number, File | null>>({});
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

  const parseAmountInput = (raw: string): number | string | '' => {
    const text = String(raw).replace(/[,₹\s]/g, '');
    if (text === '') return '';
    if (/^\d*\.?\d{0,2}$/.test(text)) return text;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : '';
  };

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
    setManualDrafts((prev) => ({
      ...prev,
      [invitationId]: {
        ...prev[invitationId],
        quoteLineItems: nextLines,
        quotedPrice: total,
      },
    }));
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

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadRfq = useCallback(async (opts?: { soft?: boolean }) => {
    if (!prId) return;
    const soft = Boolean(opts?.soft);
    if (!soft) setLoading(true);
    try {
      const res = await rfqApi.getByPr(Number(prId));
      const data = res.data;
      setPr(data.pr as typeof pr);
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
    if (!hasInvitations || isFinalized) return;
    const interval = setInterval(() => loadRfq({ soft: true }), 15000);
    return () => clearInterval(interval);
  }, [hasInvitations, isFinalized, loadRfq]);

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
    const quotedPrice =
      quoteLineItems.length > 0
        ? quoteLineItems.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0)
        : Number(vals.quotedPrice) || 0;

    setManualDrafts((prev) => ({
      ...prev,
      [row.invitationId]: {
        ...vals,
        quotedPrice,
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
    setEditingRoundById((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
  };

  const validateRequiredQuote = (row: TableRow) => {
    const quote = getDisplayQuote(row, editingRoundById[row.invitationId]);
    const draft = manualDrafts[row.invitationId] || {};
    const file = manualFiles[row.invitationId];
    const hasFile = Boolean(file) || Boolean(quote?.quotationFileName);
    if (!hasFile) {
      setError('Quotation file is required. Upload a PDF or photo first.');
      return null;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Quotation file must be under 5MB');
      return null;
    }
    const quoteLineItems = getWorkingLines(row.invitationId).map((l) => {
      const quotedUnitPrice = Number(l.quotedUnitPrice) || 0;
      const quantity = Number(l.quantity) || 0;
      const gstPercent = l.gstPercent != null ? Number(l.gstPercent) : 18;
      return {
        ...l,
        quotedUnitPrice,
        quantity,
        gstPercent,
        quotedTotal: lineQuotedTotal({ quotedUnitPrice, quantity, gstPercent }),
      };
    });
    if (!quoteLineItems.length) {
      setError('Line items are required. Add at least one item with a quoted price.');
      return null;
    }
    if (quoteLineItems.some((l) => !String(l.description || '').trim())) {
      setError('Enter a name for every line item');
      return null;
    }
    if (quoteLineItems.some((l) => !l.quantity || l.quantity <= 0)) {
      setError('Enter quantity for every line item');
      return null;
    }
    if (quoteLineItems.some((l) => !l.quotedUnitPrice || l.quotedUnitPrice <= 0)) {
      setError('Enter quoted unit price for every line item');
      return null;
    }
    const quotedPrice = quoteLineItems.reduce((sum, l) => sum + (Number(l.quotedTotal) || 0), 0);
    if (!quotedPrice || quotedPrice <= 0) {
      setError('Quotation price is required and must be greater than 0');
      return null;
    }
    return { quote, draft, file, quoteLineItems, quotedPrice };
  };

  const handleSaveExistingQuote = async (row: TableRow) => {
    const checked = validateRequiredQuote(row);
    if (!checked) return;
    const { quote, draft, file, quoteLineItems, quotedPrice } = checked;
    const preferred = editingRoundById[row.invitationId];
    const editingQuote = preferred ? quoteForRound(row, preferred) : quote;
    const submissionId = editingQuote?.submissionId || quote?.submissionId || row.submissionId;
    if (!submissionId) {
      setError('No submission to update');
      return;
    }

    setSavingManualId(row.invitationId);
    setError('');
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
      if (file) {
        const quotationFileData = await readFileAsBase64(file);
        if (!quotationFileData) {
          setError('Could not read quotation file — try again');
          return;
        }
        body.quotationFileName = file.name;
        body.quotationFileData = quotationFileData;
      }

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
      setError(err instanceof Error ? err.message : 'Failed to update quotation');
    } finally {
      setSavingManualId(null);
    }
  };

  const handleSaveManualEntry = async (row: TableRow) => {
    const checked = validateRequiredQuote(row);
    if (!checked) return;
    const { draft, file, quoteLineItems, quotedPrice } = checked;
    if (!file) {
      setError('Quotation file is required. Upload a PDF or photo first.');
      return;
    }

    setSavingManualId(row.invitationId);
    setError('');
    try {
      const quotationFileData = await readFileAsBase64(file);
      if (!quotationFileData) {
        setError('Could not read quotation file — try again');
        return;
      }

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
        quotationFileName: file.name,
        quotationFileData,
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
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save manual entry');
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
    const isMoney = field.id === 'quotedPrice';
    const isNumber = field.type === 'number';
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        min={isNumber ? 0 : undefined}
        step={isMoney ? '1' : undefined}
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
      showToast(`Re-quote Round ${sendBackTarget.round + 1} sent`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send-back failed');
    }
  };

  const openFilePreview = async (submissionId: number, fileName: string) => {
    const token = localStorage.getItem('p2p_token');
    try {
      const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
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
      setFilePreview({ url: URL.createObjectURL(blob), fileName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
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
      if (Number(q.quotedPrice) > 0) return Math.max(max, Number(q.round) || 0);
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
        quotes.find((q) => q.round === previewRound && Number(q.quotedPrice) > 0) ||
        quotes.find((q) => q.round === previewRound) ||
        null;
      if (forRound) return forRound;
    }
    const active = quotes.find(
      (q) => q.round === row.round && q.status === 'submitted' && Number(q.quotedPrice) > 0
    );
    if (active) return active;
    if (row.status === 'submitted') {
      return [...quotes].reverse().find((q) => q.status === 'submitted' && Number(q.quotedPrice) > 0) || null;
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

  const openQuotePopup = (row: TableRow, targetRound?: number) => {
    setError('');
    const existingRound = latestExistingRound(row);
    const wanted = targetRound && targetRound > 0 ? targetRound : existingRound || row.round || 1;
    const existingForWanted = quoteForRound(row, wanted);

    if (existingForWanted) {
      startEditExistingQuote(row, existingForWanted);
      setQuotePopupId(row.invitationId);
      return;
    }

    if (row.hasActiveQuote || existingRound > 0) {
      setQuoteAsk({
        row,
        existingRound: existingRound || 1,
        targetRound: wanted,
        source: 'edit',
      });
      return;
    }

    const quote = getDisplayQuote(row);
    const vals = quoteFieldValues(quote, row);
    const saved = (Array.isArray(vals.quoteLineItems) ? vals.quoteLineItems : []) as ManualQuoteLine[];
    persistWorkingLines(row.invitationId, seedQuoteLines(saved));
    setQuotePopupId(row.invitationId);
  };

  const askBeforeRequote = (row: TableRow) => {
    if (row.hasActiveQuote || latestExistingRound(row) > 0) {
      setQuoteAsk({
        row,
        existingRound: latestExistingRound(row) || row.round || 1,
        targetRound: (latestExistingRound(row) || row.round || 1) + 1,
        source: 'requote',
      });
      return;
    }
    setSendBackTarget(row);
  };

  const closeQuotePopup = () => {
    if (quotePopupId != null) cancelEditExistingQuote(quotePopupId);
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
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg">
          {toast}
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
          {!isFinalized && hasInvitations && (
            <button
              type="button"
              onClick={handleSubmitRfq}
              disabled={submitting || !recommendedId || !canSubmitRfq}
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
              {submitting ? 'Submitting...' : isScm ? 'Finish RFQ' : 'Send for approval'}
            </button>
          )}
        </div>
      </div>

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
              ? 'RFQ finalized. Ready for next SCM step (vendor approval / Create PO).'
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
                    Switch <strong>Q1–Q4</strong> tabs, tap <strong>Edit</strong> to fill that round, then <strong>Choose</strong> a vendor.
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
                maxRounds={config?.maxRounds}
                removingId={removingId}
                resendingId={resendingId}
                onEdit={(row, targetRound) => openQuotePopup(row as TableRow, targetRound)}
                onChoose={(row) =>
                  row.hasActiveQuote && openRecommendModal(row.invitationId, row.vendorName)
                }
                onRemove={(row) => handleRemoveVendor(row as TableRow)}
                onResend={(row) => handleResendMail(row as TableRow)}
                onSendBack={(row) => askBeforeRequote(row as TableRow)}
              />

              {tableRows.filter((row) => row.invitationId === quotePopupId).map((row, i) => {
                  const quote = getDisplayQuote(row, editingRoundById[row.invitationId]);
                  const vals = quoteFieldValues(quote, row);
                  const submissionId = quote?.submissionId || row.submissionId;
                  const isManualRow = row.inviteMode === 'manual';
                  const isEmailRow = row.inviteMode !== 'manual';
                  const awaitingManualEntry = isManualRow && !row.hasActiveQuote;
                  const isEditingExisting = editingQuoteIds.has(row.invitationId);
                  const quoteFieldsEditable =
                    mode === 'entry' &&
                    (awaitingManualEntry || (isEditingExisting && canEditExistingQuote));
                  const awaitingVendorEmail =
                    isEmailRow && !row.hasActiveQuote && (row.status === 'invited' || row.status === 'sent_back');
                  const isRecommended =
                    Number(recommendedId) === Number(row.invitationId) || Boolean(row.isRecommended);
                  const statusLabel = awaitingManualEntry
                    ? 'Your turn — type quote'
                    : awaitingVendorEmail
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
                                Round {mode === 'preview' ? previewRound : row.round}
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
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
                                  <i className="ri-star-fill text-amber-500"></i>
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              First upload the quotation file, then fill line items and quoted price. Those three are required.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {awaitingManualEntry && (
                            <button
                              type="button"
                              onClick={() => handleSaveManualEntry(row)}
                              disabled={savingManualId === row.invitationId}
                              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                              {savingManualId === row.invitationId ? 'Saving...' : 'Save quote + file'}
                            </button>
                          )}
                          {(isEditingExisting || (row.hasActiveQuote && canEditExistingQuote)) && !awaitingManualEntry && (
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
                        {awaitingVendorEmail ? (
                          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 px-4 py-6 text-center">
                            <i className="ri-mail-send-line text-2xl text-amber-500"></i>
                            <p className="text-sm font-medium text-amber-800 mt-2">Waiting for this vendor to send their quote</p>
                            <p className="text-xs text-amber-700 mt-1">You can resend the email if they did not get it.</p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                                Quotation file <span className="text-red-500">*</span>
                              </p>
                              {quote?.quotationFileName && quote?.submissionId ? (
                                <button
                                  type="button"
                                  onClick={() => openFilePreview(quote.submissionId!, quote.quotationFileName)}
                                  className="mb-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-teal-700 hover:bg-teal-50"
                                >
                                  <i className="ri-file-look-line" />
                                  {quote.quotationFileName}
                                  <span className="text-xs text-gray-500">Preview</span>
                                </button>
                              ) : null}
                              {quoteFieldsEditable ? (
                                <label
                                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 border-2 border-dashed rounded-xl cursor-pointer ${
                                    manualFiles[row.invitationId] || quote?.quotationFileName
                                      ? 'border-teal-300 bg-teal-50/40 hover:bg-teal-50'
                                      : 'border-red-200 bg-red-50/40 hover:bg-red-50/70'
                                  }`}
                                >
                                  <i className={`text-xl shrink-0 ${manualFiles[row.invitationId] || quote?.quotationFileName ? 'ri-upload-2-line text-teal-700' : 'ri-upload-cloud-2-line text-red-500'}`} />
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-semibold truncate ${manualFiles[row.invitationId] || quote?.quotationFileName ? 'text-teal-800' : 'text-red-700'}`}>
                                      {manualFiles[row.invitationId]?.name ||
                                        (quote?.quotationFileName
                                          ? 'Replace quotation file'
                                          : 'Upload quotation file (required)')}
                                    </p>
                                    <p className="text-xs text-gray-600 mt-0.5">
                                      PDF, Word, or photo · max 5MB · then type line items and price
                                    </p>
                                  </div>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                                    className="text-xs max-w-full"
                                    onChange={(e) => {
                                      const nextFile = e.target.files?.[0] || null;
                                      setManualFiles((prev) => ({ ...prev, [row.invitationId]: nextFile }));
                                    }}
                                  />
                                </label>
                              ) : !quote?.quotationFileName ? (
                                <p className="text-sm text-red-600">No quotation file uploaded.</p>
                              ) : null}
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
                                                  <span className="pl-2 pr-1 text-sm text-gray-500 shrink-0">₹</span>
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={unitPrice === '' ? '' : String(unitPrice)}
                                                    onChange={(e) =>
                                                      setManualLineField(
                                                        row.invitationId,
                                                        lineId,
                                                        'quotedUnitPrice',
                                                        parseAmountInput(e.target.value)
                                                      )
                                                    }
                                                    className="w-full h-full min-w-0 px-1 text-sm text-right outline-none"
                                                    placeholder="0.00"
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
                                {(prLineItems.length > 0 ||
                                ((manualDrafts[row.invitationId]?.quoteLineItems as ManualQuoteLine[]) || []).length > 0
                                  ? vendorFieldsWithoutPrice
                                  : vendorFields
                                ).map((f) => (
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
                                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-teal-700 leading-none">
                                      Quoted Price (₹) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="min-h-[44px] px-3 rounded-xl bg-white border border-teal-100 text-sm font-bold text-teal-800 flex items-center">
                                      {formatCurrency(
                                        quoteFieldsEditable
                                          ? getManualQuoteTotal(row.invitationId)
                                          : Number(vals.quotedPrice) || 0
                                      )}
                                    </div>
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
                                      {mode === 'entry' && (!isFinalized || isEditingExisting) ? (
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
                        )}
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
                  setSendBackTarget(row);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <span className="font-semibold">{filePreview.fileName}</span>
              <button type="button" onClick={() => { URL.revokeObjectURL(filePreview.url); setFilePreview(null); }}>×</button>
            </div>
            <div className="p-4 flex-1">
              {/\.pdf$/i.test(filePreview.fileName) ? (
                <iframe title="preview" src={filePreview.url} className="w-full h-[70vh] border rounded" />
              ) : (
                <img src={filePreview.url} alt="" className="max-h-[70vh] mx-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
