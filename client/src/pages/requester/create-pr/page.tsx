import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { prApi, masterApi, vendorApi, fileToAttachmentPayload, ItemRecord, CategoryRecord, EntityRecord, DepartmentRecord, PrAttachmentRecord, VendorRecord, rfqApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import DepartmentCombobox from './DepartmentCombobox';
import SearchCreateField from './SearchCreateField';
import LineItemEditorForm, {
  LineItem,
  createEmptyLineItem,
  lineInclusiveAmount,
} from './LineItemEditorForm';
import FunctionalOwnRfqSection, {
  FunctionalRfqVendorRow,
  quoteHasQuotationFile,
  localQuoteFiles,
  savedQuoteFiles,
  filesFromSubmission,
} from './FunctionalOwnRfqSection';
import UserSearchSelect from './UserSearchSelect';
import PrBillingDeliverySection from './PrBillingDeliverySection';
import {
  clearCreatePrDraft,
  CreatePrDraftSnapshot,
  consumeCreatePrSoftResume,
  draftContentScore,
  hasMeaningfulCreatePrDraft,
  markCreatePrSoftResume,
  peekCreatePrSoftResume,
  readCreatePrDraft,
  startFreshCreatePr,
  writeCreatePrDraft,
} from './createPrDraftStorage';
import {
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  CurrencyCode,
  currencySymbol,
  formatMoney,
  normalizeCurrency,
} from '../../../constants/currency';

const ADMIN_EDIT_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  file?: File;
  existingId?: number;
}

function mapServerAttachments(atts: PrAttachmentRecord[] | undefined | null): AttachedFile[] {
  return (atts || [])
    .filter((att) => Number(att?.id) > 0)
    .map((att) => ({
      id: `existing-${att.id}`,
      name: att.fileName,
      size: Number(att.size) || 0,
      existingId: Number(att.id),
    }));
}

function mergeAttachedFiles(prev: AttachedFile[], incoming: AttachedFile[]): AttachedFile[] {
  const byExisting = new Map<number, AttachedFile>();
  const pending: AttachedFile[] = [];
  for (const file of [...prev, ...incoming]) {
    if (file.existingId) {
      byExisting.set(file.existingId, { id: file.id, name: file.name, size: file.size, existingId: file.existingId });
    } else if (file.file) {
      pending.push(file);
    }
  }
  return [...byExisting.values(), ...pending];
}

interface ReturnFeedback {
  stage: string;
  user: string;
  role: string;
  date: string;
  remarks: string;
}

const FIELD_SCROLL_ORDER = [
  'prTitle',
  'entityId',
  'department',
  'businessJustification',
  'requiredDate',
  'billingLocationId',
  'billingAddress',
  'deliveryPoc',
  'placeOfDelivery',
  'expectedDeliveryTimeline',
  'paymentTerms',
  'approvalUserId',
  'rfqVendors',
  'lineItems',
];

function scrollToFirstError(errs: Record<string, string>) {
  const first =
    FIELD_SCROLL_ORDER.find((key) => errs[key]) ||
    Object.keys(errs).find((key) => key.startsWith('item_')) ||
    Object.keys(errs)[0];
  if (!first) return;
  const field = first.startsWith('item_') ? 'lineItems' : first;
  requestAnimationFrame(() => {
    document.querySelector(`[data-field="${field}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function isReusableDraftStatus(status?: string) {
  const st = String(status || '').toUpperCase();
  return st === 'DRAFT' || st === 'RETURNED';
}

function isUnusablePersistError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /no longer be edited|Only returned or draft|PR not found/i.test(msg);
}

export default function CreatePRPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { prId: prIdParam } = useParams<{ prId?: string }>();
  const editPrId = prIdParam ? Number(prIdParam) : null;
  const isEditMode = !!editPrId;
  const wantFreshStart = !editPrId && searchParams.get('new') === '1';
  const freshHandledRef = useRef(false);
  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  /** Admin editing any PR (including in-flight) — save via admin API, all fields unlocked */
  const isAdminEditFlow = isEditMode && isAdminEditor;

  const [prNumber, setPrNumber] = useState(isEditMode ? '' : 'Auto on save');
  const [prTitle, setPrTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [entityId, setEntityId] = useState<number | ''>('');
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [requestType, setRequestType] = useState<'Capex' | 'Opex' | 'Service'>('Opex');
  const [purchaseType, setPurchaseType] = useState<'purchase_order' | 'work_order'>('purchase_order');
  const [vendorSelection, setVendorSelection] = useState<'own' | 'scm'>('scm');
  const [prFlow, setPrFlow] = useState<'standard' | 'functional'>('standard');
  const [approvalUserIds, setApprovalUserIds] = useState<number[]>([]);
  const [vendorMaster, setVendorMaster] = useState<VendorRecord[]>([]);
  const [rfqMaxRounds, setRfqMaxRounds] = useState(1);
  const [rfqVendors, setRfqVendors] = useState<FunctionalRfqVendorRow[]>([]);
  const [rfqRecommendedKey, setRfqRecommendedKey] = useState<string | null>(null);
  const [rfqRecommendedMeta, setRfqRecommendedMeta] = useState<{
    vendorId?: string;
    vendorName?: string;
    vendorEmail?: string;
  }>({});
  const [rfqRecommendationJustification, setRfqRecommendationJustification] = useState('');
  const [existingRfqHasQuotes, setExistingRfqHasQuotes] = useState(false);
  const [approvalUsers, setApprovalUsers] = useState<
    Array<{ id: number; name: string; email: string; role: string; department: string }>
  >([]);
  const [priority, setPriority] = useState('Medium');
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [businessJustification, setBusinessJustification] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [billingLocationId, setBillingLocationId] = useState<number | ''>('');
  const [billingLocation, setBillingLocation] = useState('');
  const [billingGstNo, setBillingGstNo] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [deliveryPoc, setDeliveryPoc] = useState('');
  const [placeOfDelivery, setPlaceOfDelivery] = useState('');
  const [expectedDeliveryTimeline, setExpectedDeliveryTimeline] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const moneySymbol = currencySymbol(currency);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineEditor, setLineEditor] = useState<{ mode: 'add' | 'edit'; item: LineItem } | null>(null);
  const [deleteLineItemId, setDeleteLineItemId] = useState<string | null>(null);
  const [masterItems, setMasterItems] = useState<ItemRecord[]>([]);
  const [masterCategories, setMasterCategories] = useState<CategoryRecord[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitAction, setSubmitAction] = useState<'draft' | 'submit'>('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [createdPrNumber, setCreatedPrNumber] = useState('');
  const [nextStepLabel, setNextStepLabel] = useState('L1 Manager Approval');
  const [l1Manager, setL1Manager] = useState<{ name: string | null; email: string | null } | null>(null);
  const [isLoadingL1, setIsLoadingL1] = useState(false);
  const [isLoadingPr, setIsLoadingPr] = useState(isEditMode);
  const [loadError, setLoadError] = useState('');
  const [prStatus, setPrStatus] = useState('');
  const [returnFeedback, setReturnFeedback] = useState<ReturnFeedback | null>(null);
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedDraftId, setSavedDraftId] = useState<number | null>(null);
  const [softSaveHint, setSoftSaveHint] = useState('');
  const [hydrateVersion, setHydrateVersion] = useState(0);
  const skipSoftSaveRef = useRef(false);
  const persistReadyRef = useRef(false);
  const savingInFlightRef = useRef(false);
  const hydrateDoneRef = useRef(false);
  const snapshotRef = useRef<CreatePrDraftSnapshot | null>(null);
  const pendingLineDraftRef = useRef<LineItem | null>(null);
  const lineEditorModeRef = useRef<'add' | 'edit' | null>(null);
  /** Synchronous draft id — avoids duplicate prApi.create while setState is pending. */
  const savedDraftIdRef = useRef<number | null>(null);
  const createDraftLockRef = useRef<Promise<number | null> | null>(null);
  const suppressSoftResumeRef = useRef(false);
  const bootRedirectDoneRef = useRef(false);
  const loadedEditPrIdRef = useRef<number | null>(null);
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const editPrIdRef = useRef(editPrId);
  editPrIdRef.current = editPrId;
  const savePRRef = useRef<
    (
      submit: boolean,
      options?: { silent?: boolean; forceUploadFiles?: boolean; allowCreate?: boolean }
    ) => Promise<void>
  >(async () => undefined);

  const bindSavedDraftId = (id: number | null) => {
    savedDraftIdRef.current = id && id > 0 ? id : null;
    setSavedDraftId(savedDraftIdRef.current);
  };

  const resolvePersistPrId = (): number | null => {
    if (editPrId && editPrId > 0) return editPrId;
    if (savedDraftIdRef.current && savedDraftIdRef.current > 0) return savedDraftIdRef.current;
    if (savedDraftId && savedDraftId > 0) return savedDraftId;
    const fromSnap = Number(snapshotRef.current?.backendPrId || 0);
    if (fromSnap > 0) {
      savedDraftIdRef.current = fromSnap;
      return fromSnap;
    }
    const stored =
      readCreatePrDraft(user?.id, editPrId) ||
      readCreatePrDraft(user?.id, null) ||
      readCreatePrDraft(undefined, null) ||
      readCreatePrDraft('anon', null);
    const fromStore = Number(stored?.backendPrId || 0);
    if (fromStore > 0) {
      savedDraftIdRef.current = fromStore;
      return fromStore;
    }
    return null;
  };

  const isReturned = prStatus === 'RETURNED';
  const isPendingEditFlow =
    isEditMode &&
    !isAdminEditFlow &&
    !isReturned &&
    ['PENDING_HOD_APPROVAL', 'PENDING_PR_MANAGER_APPROVAL', 'PENDING_CFO_APPROVAL'].includes(prStatus);
  const isResubmitFlow = isEditMode && isReturned && !isAdminEditFlow;
  const backTo = isAdminEditFlow || isEditMode ? '/requester/track-pr' : '/requester/dashboard';
  const persistPrId = editPrId || savedDraftId;
  const askBillingOnCreatePr = !(prFlow === 'standard' && vendorSelection === 'own');
  /** Standard + Own Vendor: no unit price / HSN / GST on PR lines (quotes come at RFQ). */
  const hideLinePricing = prFlow === 'standard' && vendorSelection === 'own';
  const restoredKeyRef = useRef('');

  const applyDraftSnapshot = (draft: CreatePrDraftSnapshot, options?: { preserveRicherLineItems?: boolean }) => {
    const preserveRicher = options?.preserveRicherLineItems !== false;
    setPrTitle(draft.prTitle || '');
    setDepartment(draft.department || '');
    setEntityId(draft.entityId === '' || draft.entityId == null ? '' : Number(draft.entityId));
    setRequestType(draft.requestType || 'Opex');
    setPurchaseType(draft.purchaseType === 'work_order' ? 'work_order' : 'purchase_order');
    setVendorSelection(draft.vendorSelection === 'own' ? 'own' : 'scm');
    setPrFlow(draft.prFlow === 'functional' ? 'functional' : 'standard');
    setApprovalUserIds(Array.isArray(draft.approvalUserIds) ? draft.approvalUserIds : []);
    setRfqMaxRounds(draft.rfqMaxRounds || 1);
    setRfqRecommendedKey(draft.rfqRecommendedKey || null);
    setRfqRecommendedMeta({
      vendorId: draft.rfqRecommendedVendorId || undefined,
      vendorName: draft.rfqRecommendedVendorName || undefined,
      vendorEmail: draft.rfqRecommendedVendorEmail || undefined,
    });
    setRfqRecommendationJustification(draft.rfqRecommendationJustification || '');
    setRfqVendors((prev) => {
      const next = (draft.rfqVendors || []).map((row) => ({
        key: row.key,
        vendorId: row.vendorId,
        name: row.name,
        email: row.email,
        quotes: (row.quotes || []).map((q) => ({
          round: q.round,
          quotedPrice: q.quotedPrice,
          leadTime: q.leadTime,
          paymentTerms: q.paymentTerms,
          file: null,
          files: [],
          savedFiles: q.savedFiles || (q.savedFileName ? [{ id: null, fileName: q.savedFileName, isPrimary: true }] : []),
          savedFileName: q.savedFileName || undefined,
          savedSubmissionId: q.savedSubmissionId || undefined,
        })),
      }));
      return next.length ? next : prev;
    });
    setPriority(draft.priority || 'Medium');
    setCurrency(normalizeCurrency(draft.currency));
    setBusinessJustification(draft.businessJustification || '');
    setRequiredDate(draft.requiredDate || '');
    setBillingLocationId(draft.billingLocationId === '' || draft.billingLocationId == null ? '' : Number(draft.billingLocationId));
    setBillingLocation(draft.billingLocation || '');
    setBillingGstNo(draft.billingGstNo || '');
    setBillingAddress(draft.billingAddress || '');
    setDeliveryPoc(draft.deliveryPoc || '');
    setPlaceOfDelivery(draft.placeOfDelivery || '');
    setExpectedDeliveryTimeline(draft.expectedDeliveryTimeline || '');
    setPaymentTerms(draft.paymentTerms || '');
    setLineItems((prev) => {
      const next = (draft.lineItems || []).map((item) => ({
        ...item,
        gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
      }));
      // Never wipe line items the user just added with an older / empty draft restore.
      if (preserveRicher && prev.length > next.length) return prev;
      return next;
    });
    setAttachedFiles((prev) => {
      const persisted = (draft.attachedFiles || [])
        .filter((f) => Number(f.existingId) > 0)
        .map((f) => ({
          id: f.id || `existing-${f.existingId}`,
          name: f.name,
          size: f.size,
          existingId: Number(f.existingId),
        }));
      // localStorage cannot keep File blobs. Never wipe server-hydrated FSD files
      // with a draft that only has unsaved names (no existingId).
      if (!persisted.length) return prev;
      return mergeAttachedFiles(prev, persisted);
    });
    if (draft.prNumber) setPrNumber(draft.prNumber);
  };

  useEffect(() => {
    if (editPrId && editPrId > 0) {
      bindSavedDraftId(editPrId);
    }
  }, [editPrId]);

  // Create PR (?new=1) = blank form. Soft-resume / existing draft → edit-pr once at boot (never mid-edit).
  useEffect(() => {
    if (editPrId || isLoadingPr) return;
    if (freshHandledRef.current) return;
    freshHandledRef.current = true;

    const soft = peekCreatePrSoftResume();
    if (soft) {
      // Coming back from another menu — resume same PR#, ignore ?new=
      if (wantFreshStart) setSearchParams({}, { replace: true });
      const softId = typeof soft === 'number' ? soft : null;
      const draftId =
        softId ||
        Number(
          readCreatePrDraft(user?.id, null)?.backendPrId ||
            readCreatePrDraft('anon', null)?.backendPrId ||
            0
        ) ||
        null;
      if (draftId && !bootRedirectDoneRef.current) {
        bootRedirectDoneRef.current = true;
        bindSavedDraftId(draftId);
        navigate(`/requester/edit-pr/${draftId}`, { replace: true });
      }
      return;
    }
    if (wantFreshStart) {
      startFreshCreatePr(user?.id);
      bindSavedDraftId(null);
      savedDraftIdRef.current = null;
      setSearchParams({}, { replace: true });
      setSoftSaveHint('Starting a new purchase requisition');
      return;
    }

    // Hard refresh on /create-pr with an active server draft — open edit-pr once before typing.
    const existing =
      Number(
        readCreatePrDraft(user?.id, null)?.backendPrId ||
          readCreatePrDraft('anon', null)?.backendPrId ||
          0
      ) || null;
    if (existing && !bootRedirectDoneRef.current) {
      bootRedirectDoneRef.current = true;
      bindSavedDraftId(existing);
      navigate(`/requester/edit-pr/${existing}`, { replace: true });
    }
  }, [editPrId, isLoadingPr, wantFreshStart, user?.id, setSearchParams, navigate]);

  useEffect(() => {
    if (!editPrId) return;
    // Auth boot resolving user.id must not remount/reload and wipe a just-added line item.
    if (loadedEditPrIdRef.current === editPrId) return;
    let cancelled = false;
    (async () => {
      setIsLoadingPr(true);
      setLoadError('');
      try {
        const res = await prApi.get(editPrId);
        if (cancelled) return;
        loadedEditPrIdRef.current = editPrId;
        const pr = res.data as {
          prNumber: string;
          title?: string;
          department: string;
          entityId?: number;
          requestType: 'Capex' | 'Opex' | 'Service';
          purchaseType?: 'purchase_order' | 'work_order' | string;
          vendorSelection?: 'own' | 'scm';
          prFlow?: 'standard' | 'functional';
          approvalUserId?: number | null;
          approvalUserIds?: number[];
          approvalUserName?: string;
          priority: string;
          currency?: string;
          justification: string;
          requiredDate: string;
          billingLocationId?: number | null;
          billingLocation?: string;
          billingGstNo?: string;
          billingAddress?: string;
          deliveryPoc?: string;
          placeOfDelivery?: string;
          expectedDeliveryTimeline?: string;
          paymentTerms?: string;
          status: string;
          lineItems: { id?: number; description: string; quantity: number; unitCost: number; category: string; unit?: string; gstPercentage?: number }[];
          approvalHistory?: { stage: string; user: string; role: string; date: string; status: string; remarks: string }[];
          attachments?: PrAttachmentRecord[];
        };
        setPrNumber(pr.prNumber);
        setPrTitle(pr.title || '');
        setDepartment(pr.department || '');
        setEntityId(pr.entityId ? Number(pr.entityId) : '');
        const loadedPurchaseType =
          pr.purchaseType === 'work_order' || pr.purchaseType === 'Work Order'
            ? 'work_order'
            : 'purchase_order';
        setPurchaseType(loadedPurchaseType);
        // Service is only allowed for Work Order
        setRequestType(
          loadedPurchaseType === 'purchase_order' && pr.requestType === 'Service'
            ? 'Opex'
            : pr.requestType
        );
        setVendorSelection(pr.vendorSelection === 'own' ? 'own' : 'scm');
        setPrFlow(pr.prFlow === 'functional' ? 'functional' : 'standard');
        setApprovalUserIds(
          Array.isArray(pr.approvalUserIds) && pr.approvalUserIds.length
            ? pr.approvalUserIds.map((id) => Number(id)).filter((id) => id > 0)
            : pr.approvalUserId
              ? [Number(pr.approvalUserId)]
              : []
        );
        setPriority(pr.priority);
        setCurrency(normalizeCurrency(pr.currency));
        setBusinessJustification(pr.justification || '');
        setRequiredDate(pr.requiredDate || '');
        setBillingLocationId(pr.billingLocationId ? Number(pr.billingLocationId) : '');
        setBillingLocation(pr.billingLocation || '');
        setBillingGstNo(pr.billingGstNo || '');
        setBillingAddress(pr.billingAddress || '');
        setDeliveryPoc(pr.deliveryPoc || '');
        setPlaceOfDelivery(pr.placeOfDelivery || '');
        setExpectedDeliveryTimeline(pr.expectedDeliveryTimeline || '');
        setPaymentTerms(pr.paymentTerms || '');
        setPrStatus(pr.status);

        const latestReturn = [...(pr.approvalHistory || [])]
          .reverse()
          .find(
            (item) =>
              item.status?.toLowerCase() === 'return' ||
              item.status?.toLowerCase() === 'rework' ||
              item.status?.toLowerCase().includes('return')
          );
        if (latestReturn) {
          setReturnFeedback({
            stage: latestReturn.stage,
            user: latestReturn.user,
            role: latestReturn.role,
            date: latestReturn.date,
            remarks: latestReturn.remarks?.trim() || 'No justification provided.',
          });
        } else {
          setReturnFeedback(null);
        }

        setLineItems((prev) => {
          const fromServer =
          pr.lineItems.length > 0
            ? pr.lineItems.map((item, i) => ({
                  id: String(item.id != null ? `${item.id}-${i}` : `row-${i + 1}`),
                itemId: null,
                  itemName: (item as { itemName?: string }).itemName || item.description,
                description: item.description,
                quantity: item.quantity,
                estimatedCost: item.unitCost,
                category: item.category,
                  unit: item.unit || 'Nos',
                hsnCode: '',
                  gstPercentage: Number.isFinite(Number(item.gstPercentage))
                    ? Number(item.gstPercentage)
                    : 18,
                }))
              : [];
          // Prefer local draft line items when they are richer than the server payload.
          const local = readCreatePrDraft(user?.id, editPrId);
          if (local?.lineItems?.length && local.lineItems.length >= fromServer.length) {
            return local.lineItems.map((item) => ({
              ...item,
              gstPercentage: Number.isFinite(Number(item.gstPercentage))
                ? Number(item.gstPercentage)
                : 18,
            }));
          }
          return fromServer.length ? fromServer : prev;
        });
        setAttachedFiles(mapServerAttachments(pr.attachments));

        // Prefer newer local auto-draft (justification / address) over stale server — line items already merged above.
        const local = readCreatePrDraft(user?.id, editPrId);
        if (local && hasMeaningfulCreatePrDraft(local)) {
          const serverScore =
            (pr.lineItems?.length || 0) * 10 +
            (pr.justification?.trim() ? 8 : 0) +
            (pr.billingAddress?.trim() ? 4 : 0) +
            (pr.placeOfDelivery?.trim() ? 4 : 0);
          if (draftContentScore(local) >= serverScore) {
            applyDraftSnapshot(local, { preserveRicherLineItems: true });
            setSoftSaveHint('Restored your unsaved changes');
          }
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load PR');
      } finally {
        if (!cancelled) setIsLoadingPr(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editPrId]);

  useEffect(() => {
    if (!editPrId) loadedEditPrIdRef.current = null;
  }, [editPrId]);

  useEffect(() => {
    if (isLoadingPr) return;
    let cancelled = false;
    const scopeKey = `${editPrId ?? 'new'}`;
    const run = async () => {
      // Do not re-apply a full draft when only auth user.id arrives later — that wiped line items.
      if (hydrateDoneRef.current && restoredKeyRef.current === scopeKey) {
        persistReadyRef.current = true;
        return;
      }
      restoredKeyRef.current = scopeKey;
      persistReadyRef.current = false;
      const draft =
        readCreatePrDraft(user?.id, editPrId) ||
        readCreatePrDraft(undefined, editPrId) ||
        readCreatePrDraft('anon', editPrId);
      if (draft && hasMeaningfulCreatePrDraft(draft)) {
        applyDraftSnapshot(draft, { preserveRicherLineItems: true });
        setSoftSaveHint('Restored your unsaved changes');
        if (user?.id) {
          writeCreatePrDraft(user.id, editPrId ?? draft.backendPrId ?? null, draft);
        }
        const softResume = consumeCreatePrSoftResume();
        const backendId = !editPrId
          ? Number(
              (typeof softResume === 'number' ? softResume : null) ||
                draft.backendPrId ||
                0
            ) || null
          : null;
        if (backendId) {
          // Bind immediately so autosave cannot create a second PR while get() is in flight.
          bindSavedDraftId(backendId);
          try {
            const res = await prApi.get(backendId);
            if (cancelled) return;
            const data = res.data as {
              status?: string;
              prNumber?: string;
              lineItems?: Array<{
                id?: number;
                description: string;
                quantity: number;
                unitCost: number;
                category: string;
                unit?: string;
                gstPercentage?: number;
              }>;
              justification?: string;
              billingAddress?: string;
              placeOfDelivery?: string;
              deliveryPoc?: string;
              expectedDeliveryTimeline?: string;
              paymentTerms?: string;
              title?: string;
              attachments?: PrAttachmentRecord[];
            };
            if (isReusableDraftStatus(data.status)) {
              bindSavedDraftId(backendId);
              setPrStatus(String(data.status || '').toUpperCase());
              if (data.prNumber) setPrNumber(data.prNumber);
              setAttachedFiles((prev) => mergeAttachedFiles(prev, mapServerAttachments(data.attachments)));
              const localCount = draft.lineItems?.length || 0;
              const serverItems = Array.isArray(data.lineItems) ? data.lineItems : [];
              if (localCount === 0 && serverItems.length > 0) {
                setLineItems((prev) => {
                  if (prev.length > 0) return prev;
                  return serverItems.map((item, i) => ({
                    id: String(item.id != null ? `${item.id}-${i}` : `row-${i + 1}`),
                    itemId: null,
                    itemName: (item as { itemName?: string }).itemName || item.description,
                    description: item.description,
                    quantity: item.quantity,
                    estimatedCost: item.unitCost,
                    category: item.category,
                    unit: item.unit || 'Nos',
                    hsnCode: '',
                    gstPercentage: Number.isFinite(Number(item.gstPercentage))
                      ? Number(item.gstPercentage)
                      : 18,
                  }));
                });
                if (data.justification && !draft.businessJustification?.trim()) {
                  setBusinessJustification(data.justification);
                }
                if (data.billingAddress && !draft.billingAddress?.trim()) {
                  setBillingAddress(data.billingAddress);
                }
                if (data.placeOfDelivery && !draft.placeOfDelivery?.trim()) {
                  setPlaceOfDelivery(data.placeOfDelivery);
                }
                if (data.deliveryPoc && !draft.deliveryPoc?.trim()) {
                  setDeliveryPoc(data.deliveryPoc);
                }
                if (data.expectedDeliveryTimeline && !draft.expectedDeliveryTimeline?.trim()) {
                  setExpectedDeliveryTimeline(data.expectedDeliveryTimeline);
                }
                if (data.paymentTerms && !draft.paymentTerms?.trim()) {
                  setPaymentTerms(data.paymentTerms);
                }
                if (data.title && !draft.prTitle?.trim()) {
                  setPrTitle(data.title);
                }
              }
            } else {
              bindSavedDraftId(null);
            }
          } catch {
            // Keep optimistic id — update may still work; only clear if PR truly missing.
            if (!cancelled) {
              /* leave bindSavedDraftId(backendId) */
            }
          }
        }
      }
      if (!cancelled) {
        persistReadyRef.current = true;
        hydrateDoneRef.current = true;
        setHydrateVersion((v) => v + 1);
      }
    };
    void run();
    return () => {
      cancelled = true;
      // Strict Mode remount resets React state — allow re-hydrate from localStorage.
      // user.id is intentionally NOT a dep (that used to wipe line items mid-edit).
      restoredKeyRef.current = '';
      hydrateDoneRef.current = false;
      persistReadyRef.current = false;
    };
  }, [editPrId, isLoadingPr]);

  // When auth resolves, migrate local draft key — never re-apply a full snapshot (wipes line items).
  useEffect(() => {
    if (!user?.id || isLoadingPr || !hydrateDoneRef.current) return;
    const draft =
      readCreatePrDraft(user.id, editPrId) ||
      readCreatePrDraft(undefined, editPrId) ||
      readCreatePrDraft('anon', editPrId);
    if (!draft || !hasMeaningfulCreatePrDraft(draft)) return;
    writeCreatePrDraft(user.id, editPrId ?? draft.backendPrId ?? null, draft);
    setLineItems((prev) => {
      if (prev.length > 0) return prev;
      if (!draft.lineItems?.length) return prev;
      return draft.lineItems.map((item) => ({
        ...item,
        gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
      }));
    });
  }, [user?.id, editPrId, isLoadingPr]);

  useEffect(() => {
    snapshotRef.current = {
      v: 1,
      savedAt: Date.now(),
      backendPrId: persistPrId,
      prNumber: prNumber && prNumber !== 'Auto on save' ? prNumber : undefined,
      isAdminEditFlow,
      prTitle,
      department,
      entityId,
      requestType,
      purchaseType,
      vendorSelection,
      prFlow,
      approvalUserIds,
      rfqMaxRounds,
      rfqRecommendedKey,
      rfqRecommendedVendorId: rfqRecommendedMeta.vendorId || null,
      rfqRecommendedVendorName: rfqRecommendedMeta.vendorName || null,
      rfqRecommendedVendorEmail: rfqRecommendedMeta.vendorEmail || null,
      rfqRecommendationJustification,
      rfqVendors: rfqVendors.map((row) => ({
        key: row.key,
        vendorId: row.vendorId,
        name: row.name,
        email: row.email,
        quotes: row.quotes.map((q) => ({
          round: q.round,
          quotedPrice: q.quotedPrice,
          leadTime: q.leadTime,
          paymentTerms: q.paymentTerms,
          // Only persist server-confirmed file names — never File.name (lost on refresh).
          savedFileName: q.savedFileName || undefined,
          savedSubmissionId: q.savedSubmissionId || undefined,
          savedFiles: savedQuoteFiles(q),
        })),
      })),
      priority,
      currency,
      businessJustification,
      requiredDate,
      billingLocationId,
      billingLocation,
      billingGstNo,
      billingAddress,
      deliveryPoc,
      placeOfDelivery,
      expectedDeliveryTimeline,
      paymentTerms,
      lineItems,
      attachedFiles: attachedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        existingId: f.existingId,
      })),
    };
  });

  useEffect(() => {
    if (!hydrateDoneRef.current || !persistReadyRef.current || skipSoftSaveRef.current || isLoadingPr) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (skipSoftSaveRef.current || !hydrateDoneRef.current) return;
      const snap = snapshotRef.current;
      if (!snap || !hasMeaningfulCreatePrDraft(snap)) return;
      writeCreatePrDraft(user?.id, persistPrId ?? editPrId, snap);
      setSoftSaveHint('Draft auto-saved locally');
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    hydrateVersion,
    prTitle,
    department,
    entityId,
    requestType,
    purchaseType,
    vendorSelection,
    prFlow,
    approvalUserIds,
    rfqMaxRounds,
    rfqVendors,
    rfqRecommendedKey,
    rfqRecommendedMeta,
    rfqRecommendationJustification,
    priority,
    currency,
    businessJustification,
    requiredDate,
    billingLocationId,
    billingLocation,
    billingGstNo,
    billingAddress,
    deliveryPoc,
    placeOfDelivery,
    expectedDeliveryTimeline,
    paymentTerms,
    lineItems,
    attachedFiles,
    persistPrId,
    editPrId,
    user?.id,
    isLoadingPr,
  ]);

  useEffect(() => {
    const flushOnLeave = () => {
      if (suppressSoftResumeRef.current || skipSoftSaveRef.current || !hydrateDoneRef.current) return;
      const snap = snapshotRef.current;
      if (!snap || !hasMeaningfulCreatePrDraft(snap)) return;
      const id = resolvePersistPrId();
      writeCreatePrDraft(userIdRef.current, id ?? editPrIdRef.current, {
        ...snap,
        backendPrId: id ?? snap.backendPrId,
      });
      markCreatePrSoftResume(id);
      // Keep the Add/Edit line-item form open; local draft is already written above.
      if (lineEditorModeRef.current) return;
      // Upload quotation files + persist same PR# when leaving to another menu.
      if (snap.entityId && !savingInFlightRef.current) {
        void savePRRef.current(false, {
          silent: true,
          forceUploadFiles: true,
          allowCreate: true,
        });
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushOnLeave();
    };
    window.addEventListener('pagehide', flushOnLeave);
    window.addEventListener('beforeunload', flushOnLeave);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      // Only flush on real unmount (menu leave), not when draft id / user deps change.
      flushOnLeave();
      window.removeEventListener('pagehide', flushOnLeave);
      window.removeEventListener('beforeunload', flushOnLeave);
      document.removeEventListener('visibilitychange', onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced server draft — updates existing PR only (never create mid-edit / refresh the page).
  useEffect(() => {
    if (
      !hydrateDoneRef.current ||
      !persistReadyRef.current ||
      skipSoftSaveRef.current ||
      isLoadingPr ||
      isAdminEditFlow
    ) {
      return;
    }
    if (!entityId) return;
    if (
      !businessJustification.trim() &&
      !billingAddress.trim() &&
      !placeOfDelivery.trim() &&
      !deliveryPoc.trim() &&
      lineItems.length === 0 &&
      !prTitle.trim() &&
      rfqVendors.length === 0
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (
        skipSoftSaveRef.current ||
        savingInFlightRef.current ||
        !hydrateDoneRef.current ||
        !persistReadyRef.current
      ) {
        return;
      }
      const snap = snapshotRef.current;
      if (!snap?.entityId) return;
      const existingId = resolvePersistPrId();
      writeCreatePrDraft(user?.id, existingId ?? editPrId, {
        ...snap,
        backendPrId: existingId ?? snap.backendPrId ?? null,
      });
      // Autosave must not create a new PR (that remounted /edit-pr and wiped the new line item).
      if (!existingId) {
        setSoftSaveHint('Draft auto-saved locally');
        return;
      }
      // Keep Add/Edit line-item form open — silent save used to close it and wipe fields.
      if (lineEditorModeRef.current) {
        setSoftSaveHint('Draft auto-saved locally');
        return;
      }
      void savePRRef.current(false, { silent: true, forceUploadFiles: true }).then(() => {
        if (!skipSoftSaveRef.current) setSoftSaveHint('Draft auto-saved');
      });
    }, 2000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hydrateVersion,
    prTitle,
    department,
    entityId,
    requestType,
    purchaseType,
    vendorSelection,
    prFlow,
    approvalUserIds,
    priority,
    currency,
    businessJustification,
    requiredDate,
    billingLocationId,
    billingLocation,
    billingGstNo,
    billingAddress,
    deliveryPoc,
    placeOfDelivery,
    expectedDeliveryTimeline,
    paymentTerms,
    lineItems,
    rfqVendors,
    persistPrId,
    editPrId,
    user?.id,
    isLoadingPr,
    isAdminEditFlow,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await prApi.listApprovalUsers();
        setApprovalUsers(res.data || []);
      } catch {
        setApprovalUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await vendorApi.list();
        setVendorMaster(res.data || []);
      } catch {
        setVendorMaster([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!persistPrId || prFlow !== 'functional' || vendorSelection !== 'own') {
      setExistingRfqHasQuotes(false);
      return;
    }
    (async () => {
      try {
        const res = await rfqApi.getByPr(persistPrId);
        const data = res.data as {
          config?: {
            recommendedInvitationId?: number | null;
            recommendationJustification?: string;
          };
          invitations?: Array<{
            id?: number;
            vendorId?: number;
            vendorName?: string;
            vendorEmail?: string;
            submissions?: Array<{
              id?: number;
              round?: number;
              quotedPrice?: number;
              leadTime?: number;
              paymentTerms?: string;
              quotationFileName?: string;
              quotationFiles?: Array<{ id?: number | null; fileName?: string; isPrimary?: boolean }>;
            }>;
          }>;
        };
        const invitations = data?.invitations || [];
        const hasQuotes = invitations.some((inv) =>
          (inv.submissions || []).some(
            (q) =>
              Number(q.quotedPrice) >= 0 &&
              Boolean(q.quotationFileName || (Array.isArray(q.quotationFiles) && q.quotationFiles.length))
          )
        );
        setExistingRfqHasQuotes(hasQuotes);

        // Restore Choose selection from RFQ config
        const recId = data.config?.recommendedInvitationId
          ? Number(data.config.recommendedInvitationId)
          : null;
        if (recId) {
          const recInv = invitations.find((i) => Number(i.id) === recId);
          if (recInv) {
            setRfqRecommendationJustification(data.config?.recommendationJustification || '');
            setRfqRecommendedMeta({
              vendorName: recInv.vendorName,
              vendorEmail: recInv.vendorEmail,
            });
          }
        }

        // Hydrate functional RFQ rows (incl. submission ids so Open / Show works)
        if (invitations.length) {
          setRfqVendors((prev) => {
            let next: FunctionalRfqVendorRow[];
            if (prev.length > 0) {
              // Merge savedSubmissionId / savedFileName into existing rows by vendor
              next = prev.map((row) => {
                const inv = invitations.find(
                  (i) =>
                    (i.vendorName || '').toLowerCase() === row.name.toLowerCase() ||
                    ((i.vendorEmail || '') &&
                      (row.email || '') &&
                      (i.vendorEmail || '').toLowerCase() === row.email.toLowerCase())
                );
                if (!inv) return row;
                const subs = inv.submissions || [];
                return {
                  ...row,
                  quotes: row.quotes.map((q) => {
                    const sub = subs.find((s) => Number(s.round) === Number(q.round));
                    if (!sub && !q.file && !q.files?.length) return q;
                    const locals = localQuoteFiles(q);
                    const saved = filesFromSubmission(sub);
                    const remainingLocals = locals.filter(
                      (f) => !saved.some((s) => s.fileName === f.name)
                    );
                    return {
                      ...q,
                      quotedPrice: q.quotedPrice || (sub?.quotedPrice != null ? String(sub.quotedPrice) : ''),
                      leadTime: q.leadTime || (sub?.leadTime != null ? String(sub.leadTime) : ''),
                      paymentTerms: q.paymentTerms || sub?.paymentTerms || '',
                      file: remainingLocals[0] || null,
                      files: remainingLocals,
                      savedFiles: saved.length ? saved : q.savedFiles,
                      savedFileName: saved[0]?.fileName || q.savedFileName,
                      savedSubmissionId: sub?.id ? Number(sub.id) : q.savedSubmissionId,
                    };
                  }),
                };
              });
            } else {
              next = invitations.map((inv, idx) => {
                const subs = inv.submissions || [];
                const maxR = Math.max(1, ...subs.map((s) => Number(s.round) || 1), rfqMaxRounds);
                const quotes = Array.from({ length: Math.min(4, maxR) }, (_, i) => {
                  const round = i + 1;
                  const sub = subs.find((s) => Number(s.round) === round);
                  const saved = filesFromSubmission(sub);
                  return {
                    round,
                    quotedPrice: sub?.quotedPrice != null ? String(sub.quotedPrice) : '',
                    leadTime: sub?.leadTime != null ? String(sub.leadTime) : '',
                    paymentTerms: sub?.paymentTerms || '',
                    file: null as File | null,
                    files: [],
                    savedFiles: saved,
                    savedFileName: saved[0]?.fileName || sub?.quotationFileName || undefined,
                    savedSubmissionId: sub?.id ? Number(sub.id) : undefined,
                  };
                });
                return {
                  key: `rfq-loaded-${inv.id || idx}`,
                  vendorId: inv.vendorId != null ? String(inv.vendorId) : '',
                  name: inv.vendorName || '',
                  email: inv.vendorEmail || '',
                  quotes,
                };
              });
            }

            // Re-bind Choose selection to current row keys
            const recId = data.config?.recommendedInvitationId
              ? Number(data.config.recommendedInvitationId)
              : null;
            const recInv = recId ? invitations.find((i) => Number(i.id) === recId) : null;
            const match =
              next.find((r) =>
                recInv
                  ? (recInv.vendorName || '').toLowerCase() === r.name.toLowerCase() ||
                    ((recInv.vendorEmail || '') &&
                      r.email &&
                      (recInv.vendorEmail || '').toLowerCase() === r.email.toLowerCase())
                  : false
              ) ||
              next.find(
                (r) =>
                  (rfqRecommendedMeta.vendorEmail &&
                    r.email &&
                    rfqRecommendedMeta.vendorEmail.toLowerCase() === r.email.toLowerCase()) ||
                  (rfqRecommendedMeta.vendorName &&
                    rfqRecommendedMeta.vendorName.toLowerCase() === r.name.toLowerCase()) ||
                  (rfqRecommendedKey && r.key === rfqRecommendedKey)
              );
            if (match) {
              setRfqRecommendedKey(match.key);
              setRfqRecommendedMeta({
                vendorId: match.vendorId,
                vendorName: match.name,
                vendorEmail: match.email,
              });
            }
            return next;
          });
        }
      } catch {
        setExistingRfqHasQuotes(false);
      }
    })();
  }, [persistPrId, prFlow, vendorSelection]);

  useEffect(() => {
    (async () => {
      try {
        const [itemsRes, catsRes, entityRes, deptRes] = await Promise.all([
          masterApi.listItems({ status: 'active' }),
          masterApi.listCategories({ status: 'active', requestType }),
          masterApi.listEntities({ status: 'active' }),
          masterApi.listDepartments({ status: 'active' }),
        ]);
        const items = itemsRes.data || [];
        setMasterItems(items);
        setMasterCategories(catsRes.data || []);
        setEntities(entityRes.data || []);
        setDepartments(deptRes.data || []);
        // Match existing line items to Item Master by name when editing
        setLineItems((prev) =>
          prev.map((row) => {
            if (row.itemId) return row;
            const name = (row.itemName || row.description || '').trim().toLowerCase();
            if (!name) return row;
            const match = items.find((m) => m.name.toLowerCase() === name);
            if (!match) return row;
            return {
              ...row,
              itemId: match.id,
              itemName: match.name,
              description: row.description || match.description || match.name,
              category: row.category || match.categoryName || '',
              unit: match.unit || row.unit || 'Nos',
              hsnCode: match.hsnCode || '',
              gstPercentage: Number(match.gstPercentage ?? 18),
            };
          })
        );
      } catch {
        setMasterItems([]);
        setMasterCategories([]);
      }
    })();
  }, [requestType]);

  const selectedEntity = useMemo(
    () => (entityId === '' ? null : entities.find((e) => e.id === entityId) || null),
    [entities, entityId]
  );

  const billingLocations = useMemo(
    () => selectedEntity?.locations?.filter((loc) => loc.location) || [],
    [selectedEntity]
  );

  useEffect(() => {
    if (!billingLocations.length) return;
    if (billingLocationId) {
      const match = billingLocations.find((loc) => Number(loc.id) === Number(billingLocationId));
      if (match) {
        setBillingLocation(match.location);
        return;
      }
    }
    if (billingLocation.trim()) {
      const match = billingLocations.find(
        (loc) => loc.location.trim().toLowerCase() === billingLocation.trim().toLowerCase()
      );
      if (match) {
        setBillingLocationId(match.id ? Number(match.id) : '');
      }
    }
  }, [billingLocations, billingLocationId, billingLocation]);

  const formatEntityLabel = (ent: EntityRecord) => {
    const base = ent.code ? `${ent.code} — ${ent.name}` : ent.name;
    return ent.costCenter ? `${base} (${ent.costCenter})` : base;
  };

  const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];

  const getTotalAmount = () =>
    lineItems.reduce(
      (sum, item) => sum + lineInclusiveAmount(item.quantity, item.estimatedCost, item.gstPercentage),
      0
    );

  const openAddLineItem = () => {
    setDeleteLineItemId(null);
    lineEditorModeRef.current = 'add';
    setLineEditor({ mode: 'add', item: createEmptyLineItem() });
  };

  const openEditLineItem = (item: LineItem) => {
    setDeleteLineItemId(null);
    lineEditorModeRef.current = 'edit';
    setLineEditor({ mode: 'edit', item: { ...item } });
  };

  const closeLineEditor = () => {
    pendingLineDraftRef.current = null;
    lineEditorModeRef.current = null;
    setLineEditor(null);
  };

  const saveLineItem = (item: LineItem) => {
    setLineItems((prev) => {
      const next =
        lineEditor?.mode === 'edit'
          ? prev.map((row) => (row.id === item.id ? item : row))
          : [...prev, item];
      // Persist immediately so auth hydrate / autosave cannot wipe this add.
      const snap: CreatePrDraftSnapshot = {
        ...(snapshotRef.current || {
          v: 1 as const,
          savedAt: Date.now(),
          backendPrId: persistPrId,
          prTitle,
          department,
          entityId,
          requestType,
          purchaseType,
          vendorSelection,
          prFlow,
          approvalUserIds,
          rfqMaxRounds,
          rfqVendors: [],
          priority,
          currency,
          businessJustification,
          requiredDate,
          billingLocationId,
          billingLocation,
          billingGstNo,
          billingAddress,
          deliveryPoc,
          placeOfDelivery,
          expectedDeliveryTimeline,
          paymentTerms,
          attachedFiles: [],
        }),
        lineItems: next,
        backendPrId: persistPrId,
        savedAt: Date.now(),
      };
      snapshotRef.current = snap;
      writeCreatePrDraft(user?.id, persistPrId ?? editPrId, snap);
      writeCreatePrDraft(user?.id || 'anon', persistPrId ?? editPrId, snap);
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.lineItems;
      return next;
    });
    pendingLineDraftRef.current = null;
    lineEditorModeRef.current = null;
    setLineEditor(null);
    setSoftSaveHint('Line item saved');
  };

  /** Commit open Add/Edit form into the table before Save Draft / autosave. */
  const commitPendingLineItem = (options?: { closeEditor?: boolean }): LineItem[] => {
    const closeEditor = options?.closeEditor !== false;
    const pending = pendingLineDraftRef.current;
    const mode = lineEditorModeRef.current || lineEditor?.mode;
    if (!pending || !mode) return lineItems;
    const hasBasics =
      Boolean(pending.category?.trim()) &&
      Boolean(pending.description?.trim() || pending.itemName?.trim()) &&
      Number(pending.quantity) >= 1;
    if (!hasBasics) return lineItems;
    const normalized: LineItem = {
      ...pending,
      itemName: pending.itemName || pending.description,
      description: (pending.description || pending.itemName || '').trim(),
      quantity: Number(pending.quantity) || 1,
      estimatedCost: Number(pending.estimatedCost) || 0,
      unit: pending.unit || 'Nos',
      gstPercentage: Number.isFinite(Number(pending.gstPercentage)) ? Number(pending.gstPercentage) : 18,
    };
    let next = lineItems;
    if (mode === 'edit') {
      next = lineItems.map((row) => (row.id === normalized.id ? normalized : row));
    } else if (!lineItems.some((row) => row.id === normalized.id)) {
      next = [...lineItems, normalized];
    }
    setLineItems(next);
    if (closeEditor) {
      pendingLineDraftRef.current = null;
      lineEditorModeRef.current = null;
      setLineEditor(null);
    }
    return next;
  };

  const confirmRemoveLineItem = () => {
    if (!deleteLineItemId) return;
    setLineItems((prev) => prev.filter((item) => item.id !== deleteLineItemId));
    if (lineEditor?.item.id === deleteLineItemId) setLineEditor(null);
    setDeleteLineItemId(null);
  };

  const rememberMasterItem = (created: ItemRecord) => {
    setMasterItems((prev) => {
      if (prev.some((item) => item.id === created.id)) return prev;
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const rememberDepartment = (created: DepartmentRecord) => {
    setDepartments((prev) => {
      if (prev.some((item) => item.id === created.id)) return prev;
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const rememberCategory = (created: CategoryRecord) => {
    setMasterCategories((prev) => {
      if (prev.some((item) => item.id === created.id)) return prev;
      return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };
  const addFiles = (files: File[]) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png)$/i;
    const accepted = files.filter((f) => allowed.test(f.name) && f.size <= 10 * 1024 * 1024);
    const newFiles: AttachedFile[] = accepted.map((f) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      size: f.size,
      file: f,
    }));
    setAttachedFiles((prev) => [...prev, ...newFiles]);
  };
  const removeFile = async (id: string) => {
    const target = attachedFiles.find((f) => f.id === id);
    if (target?.existingId && persistPrId) {
      try {
        await prApi.deleteAttachment(persistPrId, target.existingId);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to remove file');
        return;
      }
    }
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!prTitle.trim()) newErrors.prTitle = 'PR Title is required';
    if (!entityId) newErrors.entityId = 'Entity is required';
    if (!department) newErrors.department = 'Department is required';
    if (!businessJustification.trim()) newErrors.businessJustification = 'Business justification is required';
    if (!requiredDate) newErrors.requiredDate = 'Required date is required';
    if (askBillingOnCreatePr) {
      if (billingLocations.length > 0 && !billingLocationId) {
        newErrors.billingLocationId = 'Select billing region / GST for this entity';
      }
      if (!billingAddress.trim()) newErrors.billingAddress = 'Billing address is required';
    }
    if (prFlow === 'functional' && approvalUserIds.length === 0) {
      newErrors.approvalUserId = 'Select at least one user for Functional Flow approval';
    }
    if (prFlow === 'functional' && approvalUserIds.length > 5) {
      newErrors.approvalUserId = 'Select up to 5 users for Functional Flow approval';
    }
    if (prFlow === 'functional' && vendorSelection === 'own') {
      const hasRound1 = rfqVendors.some((row) => {
        const round1 = row.quotes.find((q) => q.round === 1);
        const price = Number(round1?.quotedPrice);
        return (
          Boolean(row.vendorId) &&
          Number.isFinite(price) &&
          price >= 0 &&
          String(round1?.quotedPrice ?? '').trim() !== '' &&
          quoteHasQuotationFile(round1)
        );
      });
      if (!hasRound1 && !existingRfqHasQuotes) {
        newErrors.rfqVendors = 'Add at least one vendor with a round-1 quoted price and quotation file';
      }
    }
    if (lineItems.length === 0) {
      newErrors.lineItems = 'Add at least one line item';
    }
    lineItems.forEach((item, index) => {
      if (!item.itemId && !item.description.trim()) {
        newErrors[`item_${index}_description`] = 'Search an item or type a new name and save it';
      } else if (!item.description.trim()) {
        newErrors[`item_${index}_description`] = 'Item description is required';
      }
      if (!item.category) newErrors[`item_${index}_category`] = 'Category is required';
      if (item.quantity <= 0) newErrors[`item_${index}_quantity`] = 'Quantity must be > 0';
    });
    setErrors(newErrors);
    const ok = Object.keys(newErrors).length === 0;
    if (!ok) scrollToFirstError(newErrors);
    return ok;
  };

  const validateDraftBasics = () => {
    const newErrors: Record<string, string> = {};
    // Draft: only Entity is required (PR number needs entity). Department + line items are enforced on Submit.
    if (!entityId) newErrors.entityId = 'Entity is required';
    setErrors(newErrors);
    const ok = Object.keys(newErrors).length === 0;
    if (!ok) scrollToFirstError(newErrors);
    return ok;
  };

  const selectedApprovalUsers = approvalUserIds
    .map((id) => approvalUsers.find((u) => u.id === id))
    .filter((u): u is { id: number; name: string; email: string; role: string; department: string } => Boolean(u));
  const selectedApprovalUser = selectedApprovalUsers[0] || null;

  const handleSaveDraft = async () => {
    if (!validateDraftBasics()) return;
    setSubmitAction('draft');
    await savePR(false);
  };

  const handleSubmitPR = async () => {
    if (!validateForm()) return;
      setSubmitAction('submit');
      setShowConfirmModal(true);
    if (prFlow === 'functional') {
      setNextStepLabel(
        selectedApprovalUsers.length > 1
          ? `User Approval 1 of ${selectedApprovalUsers.length}`
          : 'User Approval'
      );
      setL1Manager(
        selectedApprovalUser
          ? { name: selectedApprovalUser.name, email: selectedApprovalUser.email }
          : null
      );
      setIsLoadingL1(false);
      return;
    }
    setIsLoadingL1(true);
    try {
      const res = await prApi.previewL1Manager(department || undefined);
      setNextStepLabel(res.data.nextStep || 'L1 Manager Approval');
      setL1Manager(res.data.l1Manager || null);
    } catch {
      setNextStepLabel('L1 Manager Approval');
      setL1Manager(null);
    } finally {
      setIsLoadingL1(false);
    }
  };

  const buildRfqVendorsPayload = async (options?: { skipFileData?: boolean }) => {
    const skipFileData = Boolean(options?.skipFileData);
    const packed = [];
    for (const row of rfqVendors) {
      const master = vendorMaster.find((v) => String(v.id) === String(row.vendorId));
      const quotes = [];
      for (const quote of row.quotes) {
        const price = Number(quote.quotedPrice);
        if (!Number.isFinite(price) || price < 0) continue;
        const locals = localQuoteFiles(quote);
        const saved = savedQuoteFiles(quote);
        const hasNewFile = locals.length > 0;
        const hasSavedFile = saved.length > 0 || Boolean(quote.savedFileName || quote.savedSubmissionId);
        if (!hasNewFile && !hasSavedFile) continue;
        const entry: Record<string, unknown> = {
          round: quote.round,
          quotedPrice: price,
          leadTime: Number(quote.leadTime) || 0,
          paymentTerms: quote.paymentTerms || undefined,
        };
        const alreadyOnServer = Boolean(quote.savedSubmissionId || (saved.length && !locals.length));
        if (skipFileData && alreadyOnServer) {
          entry.quotationFileName = saved[0]?.fileName || quote.savedFileName;
          entry.keepExtraFileIds = saved.filter((f) => f.id).map((f) => f.id);
        } else if (locals.length) {
          const uploaded = [];
          for (const file of locals) {
            uploaded.push(await fileToAttachmentPayload(file));
          }
          if (!saved.some((f) => f.isPrimary) && !quote.savedFileName) {
            entry.quotationFileName = uploaded[0].fileName;
            entry.quotationFileData = uploaded[0].data;
            if (uploaded.length > 1) {
              entry.quotationFiles = uploaded.slice(1).map((p) => ({ fileName: p.fileName, fileData: p.data }));
            }
          } else {
            entry.quotationFileName = saved[0]?.fileName || quote.savedFileName;
            entry.quotationFiles = uploaded.map((p) => ({ fileName: p.fileName, fileData: p.data }));
          }
          entry.keepExtraFileIds = saved.filter((f) => !f.isPrimary && f.id).map((f) => f.id);
          if (!saved.some((f) => f.isPrimary) && quote.savedFileName) {
            entry.replacePrimary = true;
          }
        } else if (quote.savedFileName) {
          entry.quotationFileName = quote.savedFileName;
          entry.keepExtraFileIds = saved.filter((f) => f.id).map((f) => f.id);
        }
        quotes.push(entry);
      }
      if (!quotes.length) continue;
      packed.push({
        vendorId: row.vendorId ? Number(row.vendorId) : undefined,
        name: master?.name || row.name,
        email: master?.email || row.email,
        quotes,
      });
    }
    return packed;
  };

  const buildPayload = (items: LineItem[] = lineItems) => ({
    title: prTitle.trim() || items[0]?.description || `${requestType} Request`,
    requestType,
    purchaseType,
    department,
    entityId: entityId ? Number(entityId) : undefined,
    priority,
    currency,
    prFlow,
    approvalUserId: prFlow === 'functional' && approvalUserIds[0] ? Number(approvalUserIds[0]) : undefined,
    approvalUserIds: prFlow === 'functional' ? approvalUserIds : undefined,
    vendorSelection,
    justification: businessJustification,
    requiredDate: requiredDate || undefined,
    billingLocationId: billingLocationId || undefined,
    billingLocation: billingLocation.trim() || undefined,
    billingGstNo: billingGstNo.trim() || undefined,
    billingAddress: billingAddress.trim() || undefined,
    deliveryPoc: deliveryPoc.trim() || undefined,
    placeOfDelivery: placeOfDelivery.trim() || undefined,
    expectedDeliveryTimeline: expectedDeliveryTimeline.trim() || undefined,
    paymentTerms: paymentTerms.trim() || undefined,
    lineItems: items.map((item) => ({
      category: item.category,
      itemName: item.itemName || item.description,
      description: item.description,
      quantity: item.quantity,
      unitCost: hideLinePricing ? 0 : item.estimatedCost,
      unit: item.unit || 'Nos',
      gstPercentage: hideLinePricing
        ? 0
        : Number.isFinite(Number(item.gstPercentage))
          ? Number(item.gstPercentage)
          : 18,
    })),
  });

  const persistAttachedFilesSnapshot = (prId: number, files: AttachedFile[]) => {
    const meta = files
      .filter((f) => Number(f.existingId) > 0)
      .map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        existingId: Number(f.existingId),
      }));
    if (!snapshotRef.current) return;
    snapshotRef.current = {
      ...snapshotRef.current,
      backendPrId: prId,
      attachedFiles: meta,
    };
    writeCreatePrDraft(user?.id, prId, snapshotRef.current);
  };

  const uploadNewAttachments = async (prId: number) => {
    const pending = attachedFiles.filter((item) => item.file);
    const uploaded: AttachedFile[] = [];
    for (const item of pending) {
      const filePayload = await fileToAttachmentPayload(item.file as File);
      const res = await prApi.uploadAttachment(prId, filePayload);
      const rec = res.data;
      if (rec?.id) {
        uploaded.push({
          id: `existing-${rec.id}`,
          name: rec.fileName || item.name,
          size: Number(rec.size) || item.size,
          existingId: Number(rec.id),
        });
      }
    }
    let next = mergeAttachedFiles(
      attachedFiles.filter((item) => !item.file),
      uploaded
    );
    if (pending.length) {
      try {
        const res = await prApi.get(prId);
        const fromServer = mapServerAttachments(
          (res.data as { attachments?: PrAttachmentRecord[] })?.attachments
        );
        if (fromServer.length) next = mergeAttachedFiles(next, fromServer);
      } catch {
        /* keep upload-response ids */
      }
      setAttachedFiles(next);
      persistAttachedFilesSnapshot(prId, next);
    }
  };

  const savePR = async (
    submit: boolean,
    options?: { silent?: boolean; forceUploadFiles?: boolean; allowCreate?: boolean }
  ) => {
    const silent = Boolean(options?.silent);
    const forceUploadFiles = Boolean(options?.forceUploadFiles);
    const allowCreate = Boolean(options?.allowCreate) || !silent;
    if (!silent) setSubmitError('');
    if (!silent) setIsSubmitting(true);
    savingInFlightRef.current = true;
    if (submit) skipSoftSaveRef.current = true;
    try {
      const itemsForSave = commitPendingLineItem({ closeEditor: !silent });
      const draftSnap: CreatePrDraftSnapshot = {
        ...(snapshotRef.current || {
          v: 1 as const,
          savedAt: Date.now(),
          backendPrId: persistPrId,
          prTitle,
          department,
          entityId,
          requestType,
          purchaseType,
          vendorSelection,
          prFlow,
          approvalUserIds,
          rfqMaxRounds,
          rfqVendors: [],
          priority,
          currency,
          businessJustification,
          requiredDate,
          billingLocationId,
          billingLocation,
          billingGstNo,
          billingAddress,
          deliveryPoc,
          placeOfDelivery,
          expectedDeliveryTimeline,
          paymentTerms,
          lineItems: itemsForSave,
          attachedFiles: [],
        }),
        lineItems: itemsForSave,
        businessJustification,
        billingAddress,
        placeOfDelivery,
        deliveryPoc,
        expectedDeliveryTimeline,
        paymentTerms,
        prTitle,
        backendPrId: persistPrId,
        savedAt: Date.now(),
        attachedFiles: attachedFiles.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
          existingId: f.existingId,
        })),
      };
      if (hasMeaningfulCreatePrDraft(draftSnap)) {
        writeCreatePrDraft(user?.id, persistPrId ?? editPrId, draftSnap);
        snapshotRef.current = draftSnap;
      }
      const payload: Record<string, unknown> = {
        ...buildPayload(itemsForSave),
        vendorSelection: vendorSelection === 'own' ? 'own' : 'scm',
        prFlow: prFlow === 'functional' ? 'functional' : 'standard',
      };
      if (prFlow === 'functional' && vendorSelection === 'own') {
        const needsQuotationUpload = rfqVendors.some((row) =>
          row.quotes.some((q) => localQuoteFiles(q).length > 0)
        );
        // Always upload local quotation Files (also on silent / menu leave) so they survive navigation.
        const packed = await buildRfqVendorsPayload({
          skipFileData: silent && !forceUploadFiles && !needsQuotationUpload,
        });
        if (packed.length) {
          payload.rfqVendors = packed;
          payload.maxRounds = rfqMaxRounds;
          const chosen =
            rfqVendors.find((r) => r.key === rfqRecommendedKey) ||
            rfqVendors.find(
              (r) =>
                (rfqRecommendedMeta.vendorEmail &&
                  r.email &&
                  rfqRecommendedMeta.vendorEmail.toLowerCase() === r.email.toLowerCase()) ||
                (rfqRecommendedMeta.vendorName &&
                  rfqRecommendedMeta.vendorName.toLowerCase() === r.name.toLowerCase())
            );
          if (chosen) {
            payload.rfqRecommendedVendorEmail = chosen.email;
            payload.rfqRecommendedVendorName = chosen.name;
            payload.rfqRecommendationJustification = rfqRecommendationJustification;
          }
        }
      }

      const markQuoteFilesSaved = async (savedPrId?: number) => {
        if (payload.rfqVendors) setExistingRfqHasQuotes(true);
        const prId = Number(savedPrId || persistPrId || editPrId);
        if (!prId) return;
        try {
          const res = await rfqApi.getByPr(prId);
          const invitations = (res.data as {
            invitations?: Array<{
              vendorName?: string;
              vendorEmail?: string;
              submissions?: Array<{
                id?: number;
                round?: number;
                quotationFileName?: string;
                quotationFiles?: Array<{ id?: number | null; fileName?: string; isPrimary?: boolean }>;
              }>;
            }>;
          })?.invitations || [];
          if (!invitations.length) return;
          setRfqVendors((prev) => {
            const next = prev.map((row) => {
              const inv = invitations.find(
                (i) =>
                  (i.vendorName || '').toLowerCase() === row.name.toLowerCase() ||
                  ((i.vendorEmail || '') &&
                    (row.email || '') &&
                    (i.vendorEmail || '').toLowerCase() === row.email.toLowerCase())
              );
              if (!inv) return row;
              return {
                ...row,
                quotes: row.quotes.map((q) => {
                  const sub = (inv.submissions || []).find((s) => Number(s.round) === Number(q.round));
                  if (!sub?.id && !sub?.quotationFileName && !sub?.quotationFiles?.length) return q;
                  const saved = filesFromSubmission(sub);
                  const keepLocal = localQuoteFiles(q);
                  return {
                    ...q,
                    file: sub.id ? null : q.file,
                    files: sub.id ? [] : keepLocal,
                    savedFiles: saved.length ? saved : q.savedFiles,
                    savedFileName: saved[0]?.fileName || sub.quotationFileName || q.savedFileName,
                    savedSubmissionId: sub.id ? Number(sub.id) : q.savedSubmissionId,
                  };
                }),
              };
            });
            const snap = snapshotRef.current;
            if (snap) {
              writeCreatePrDraft(user?.id, prId, {
                ...snap,
                backendPrId: prId,
                rfqVendors: next.map((row) => ({
                  key: row.key,
                  vendorId: row.vendorId,
                  name: row.name,
                  email: row.email,
                  quotes: row.quotes.map((q) => ({
                    round: q.round,
                    quotedPrice: q.quotedPrice,
                    leadTime: q.leadTime,
                    paymentTerms: q.paymentTerms,
                    savedFileName: q.savedFileName,
                    savedSubmissionId: q.savedSubmissionId,
                    savedFiles: q.savedFiles,
                  })),
                })),
              });
            }
            return next;
          });
        } catch {
          /* ignore hydrate errors */
        }
      };

      const markSubmitSuccess = () => {
        skipSoftSaveRef.current = true;
        suppressSoftResumeRef.current = true;
        clearCreatePrDraft(user?.id, editPrId);
        clearCreatePrDraft(user?.id, persistPrId);
        startFreshCreatePr(user?.id);
      };

      const finishCreate = async (res: { data: unknown }) => {
        const data = res.data as {
          id?: number;
          prNumber: string;
          nextStep?: string;
          l1Manager?: { name: string | null; email: string | null };
        };
        if (data.id) {
          await uploadNewAttachments(data.id);
          if (!submit) bindSavedDraftId(data.id);
          await markQuoteFilesSaved(data.id);
          writeCreatePrDraft(user?.id, data.id, {
            ...snapshotRef.current!,
            backendPrId: data.id,
            prNumber: data.prNumber,
          });
        }
        setCreatedPrNumber(data.prNumber);
        if (data.prNumber) setPrNumber(data.prNumber);
        if (submit) {
          markSubmitSuccess();
          setNextStepLabel(data.nextStep || 'L1 Manager Approval');
          setL1Manager(data.l1Manager || null);
          setShowConfirmModal(false);
        } else {
          setNextStepLabel('');
          setL1Manager(null);
        }
        if (silent) return;
        if (!submit) {
          suppressSoftResumeRef.current = true;
          // Save Draft → leave Create PR and open dashboard / Track PR
          window.REACT_APP_NAVIGATE(backTo);
          return;
        }
        setShowSuccessModal(true);
      };

      const finishExisting = async (id: number) => {
        if (isAdminEditFlow) {
          await prApi.adminUpdate(id, payload);
          await uploadNewAttachments(id);
          await markQuoteFilesSaved(id);
          if (silent) return;
        setCreatedPrNumber(prNumber);
          setNextStepLabel('');
          setL1Manager(null);
          setShowConfirmModal(false);
        setShowSuccessModal(true);
        return;
      }
        if (submit) {
          const res = await prApi.resubmit(id, { ...payload, remarks: resubmitRemarks });
          const data = res.data as {
            prNumber?: string;
            nextStep?: string;
            l1Manager?: { name: string | null; email: string | null };
          };
          await uploadNewAttachments(id);
          await markQuoteFilesSaved(id);
          markSubmitSuccess();
          setCreatedPrNumber(data.prNumber || prNumber);
          setNextStepLabel(data.nextStep || 'L1 Manager Approval');
          setL1Manager(data.l1Manager || null);
        } else {
          await prApi.update(id, payload);
          await uploadNewAttachments(id);
          await markQuoteFilesSaved(id);
          bindSavedDraftId(id);
          setCreatedPrNumber(prNumber);
          setNextStepLabel('');
          setL1Manager(null);
          writeCreatePrDraft(user?.id, id, {
            ...snapshotRef.current!,
            backendPrId: id,
            prNumber,
            lineItems: (snapshotRef.current?.lineItems?.length
              ? snapshotRef.current.lineItems
              : lineItems) as CreatePrDraftSnapshot['lineItems'],
            attachedFiles: snapshotRef.current?.attachedFiles || [],
          });
        }
        if (silent) return;
        if (!submit) {
          suppressSoftResumeRef.current = true;
          window.REACT_APP_NAVIGATE(backTo);
          return;
        }
        setShowConfirmModal(false);
      setShowSuccessModal(true);
      };

      // Always resolve from ref/localStorage — never create duplicates while setState is pending.
      let targetId = resolvePersistPrId();

      // If another create is already running, wait and then UPDATE that draft.
      if (!targetId && createDraftLockRef.current) {
        const lockedId = await createDraftLockRef.current;
        if (lockedId) {
          bindSavedDraftId(lockedId);
          targetId = lockedId;
        }
      }

      if (targetId) {
        try {
          await finishExisting(targetId);
          return;
    } catch (err) {
          if (silent) throw err;
          if (isAdminEditFlow || !isUnusablePersistError(err)) throw err;
          bindSavedDraftId(null);
          if (snapshotRef.current) {
            snapshotRef.current = { ...snapshotRef.current, backendPrId: null };
          }
        }
      }

      targetId = resolvePersistPrId();
      if (targetId) {
        await finishExisting(targetId);
        return;
      }

      // First server draft: manual Save Draft / submit, or leave-menu flush (allowCreate).
      // Silent autosave without an id stays local — creating here remounted the page and wiped line items.
      if (silent && !allowCreate) {
        setSoftSaveHint('Draft auto-saved locally');
        return;
      }
      if (silent && !entityId) {
        setSoftSaveHint('Draft auto-saved locally');
        return;
      }

      const createJob = (async (): Promise<number | null> => {
        const res = await prApi.create({ ...payload, submit: Boolean(submit) });
        const created = res.data as { id?: number };
        if (created.id) bindSavedDraftId(created.id);
        await finishCreate(res);
        return created.id ? Number(created.id) : null;
      })();

      createDraftLockRef.current = createJob.finally(() => {
        createDraftLockRef.current = null;
      });
      await createJob;
    } catch (err) {
      if (submit) skipSoftSaveRef.current = false;
      if (!silent) setSubmitError(err instanceof Error ? err.message : 'Failed to save PR');
    } finally {
      savingInFlightRef.current = false;
      if (!silent) setIsSubmitting(false);
    }
  };

  savePRRef.current = savePR;

  const confirmSubmit = async () => {
    if (snapshotRef.current && hasMeaningfulCreatePrDraft(snapshotRef.current)) {
      writeCreatePrDraft(user?.id, persistPrId ?? editPrId, snapshotRef.current);
    }
    await savePR(true);
  };

  const typeColors: Record<string, string> = {
    Capex: 'bg-violet-100 text-violet-700 border-violet-200',
    Opex: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Service: 'bg-amber-100 text-amber-700 border-amber-200',
  };

  const priorityColors: Record<string, string> = {
    Low: 'bg-gray-100 text-gray-600',
    Medium: 'bg-amber-100 text-amber-700',
    High: 'bg-orange-100 text-orange-700',
    Critical: 'bg-red-100 text-red-700',
  };

  return (
    <DashboardLayout>
      {isLoadingPr ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <i className="ri-loader-4-line text-3xl text-slate-400 animate-spin"></i>
            <p className="text-sm text-gray-500 mt-3">Loading purchase request...</p>
          </div>
        </div>
      ) : loadError ? (
        <div className="p-8">
          <div className="max-w-md mx-auto p-6 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-700 mb-4">{loadError}</p>
            <Link to={backTo} className="text-sm font-medium text-red-800 hover:underline">
              {isAdminEditFlow || isEditMode ? 'Back to Track PR' : 'Back to Dashboard'}
            </Link>
          </div>
        </div>
      ) : (
      <>
      {/* ── Hero Header Banner ── */}
      <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-4 sm:px-8 py-5 sm:py-6 mb-0">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: breadcrumb + title */}
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
              <Link to={backTo} className="hover:text-white transition-colors cursor-pointer">
                {isAdminEditFlow || isEditMode ? 'Track PR' : 'Dashboard'}
              </Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-slate-300">
                {isAdminEditFlow
                  ? 'Admin Edit PR'
                  : isEditMode
                    ? isReturned
                      ? 'Edit & Resubmit PR'
                      : 'Edit Purchase Requisition'
                    : 'Create Purchase Requisition'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isAdminEditFlow
                ? 'Admin Edit Purchase Requisition'
                : isEditMode
                  ? isReturned
                    ? 'Edit & Resubmit PR'
                    : 'Edit Purchase Requisition'
                  : 'New Purchase Requisition'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isAdminEditFlow
                ? 'Update any PR field or line item, then save changes'
                : isReturned
                ? 'Update the fields based on feedback, then resubmit for approval'
                : isPendingEditFlow
                ? 'Update the request. It stays in the current approval step.'
                : isEditMode
                ? 'Update your draft or submit when ready'
                : 'Fill in the details to raise a new procurement request'}
            </p>
          </div>

          {/* Right: PR Number + Total Amount chips */}
          <div className="flex flex-wrap items-center gap-3">
            {/* PR Number */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3 backdrop-blur-sm">
              <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
                <i className="ri-file-list-3-line text-white text-sm"></i>
              </div>
              <div>
                <p className="text-slate-400 text-xs leading-none mb-0.5">PR Number</p>
                <p className="text-white font-bold text-base tracking-wide">{prNumber}</p>
              </div>
            </div>

            {/* Total Amount */}
            <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-4 py-3 backdrop-blur-sm">
              <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/30 rounded-lg">
                <i className="ri-money-dollar-circle-line text-emerald-300 text-sm"></i>
              </div>
              <div>
                <p className="text-emerald-300/80 text-xs leading-none mb-0.5">
                  {hideLinePricing ? 'Vendor Path' : 'Total Amount'}
                </p>
                <p className="text-emerald-300 font-bold text-base">
                  {hideLinePricing
                    ? 'Own Vendor'
                    : formatMoney(getTotalAmount(), currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Items count */}
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-3 backdrop-blur-sm">
              <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg">
                <i className="ri-shopping-cart-line text-white text-sm"></i>
              </div>
              <div>
                <p className="text-slate-400 text-xs leading-none mb-0.5">Line Items</p>
                <p className="text-white font-bold text-base">{lineItems.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Sub-header (type + status bar) ── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm px-3 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${typeColors[requestType]}`}>
            {requestType}
          </span>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityColors[priority]}`}>
            {priority} Priority
          </span>
          {department && (
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-600">
              <i className="ri-building-line mr-1"></i>{department}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {softSaveHint && (
            <span className="hidden sm:inline text-xs text-emerald-600 font-medium">
              <i className="ri-checkbox-circle-line mr-1"></i>
              {softSaveHint}
            </span>
          )}
          <span className="text-xs text-gray-400">
            {lineItems.length === 0
              ? 'No items yet'
              : hideLinePricing
                ? `${lineItems.filter((i) => i.description || i.itemName).length}/${lineItems.length} items filled`
                : `${lineItems.filter((i) => i.description && i.estimatedCost > 0).length}/${lineItems.length} items filled`}
          </span>
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{
                width: `${
                  lineItems.length > 0
                    ? ((hideLinePricing
                        ? lineItems.filter((i) => i.description || i.itemName).length
                        : lineItems.filter((i) => i.description && i.estimatedCost > 0).length) /
                        lineItems.length) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="p-8 space-y-6">

        {isReturned && (
          <div className="p-5 bg-orange-50 border border-orange-200 rounded-xl space-y-4">
            <div className="flex items-start gap-3">
              <i className="ri-arrow-go-back-line text-orange-600 text-xl mt-0.5"></i>
              <div>
                <p className="text-sm font-semibold text-orange-800">Returned for Rework</p>
                <p className="text-xs text-orange-700 mt-1">
                  Review the feedback below, update the form fields, then resubmit for L1 Manager approval.
                </p>
              </div>
            </div>

            {returnFeedback ? (
              <div className="bg-white border border-orange-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Return Justification</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {returnFeedback.user} · {returnFeedback.role} · {returnFeedback.stage}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{returnFeedback.date}</span>
                </div>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-orange-50/60 rounded-lg p-3 border border-orange-100">
                  {returnFeedback.remarks}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* ── Section 1: Basic Information ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
              <i className="ri-information-line text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Basic Information</h2>
              <p className="text-xs text-gray-500">General details about this requisition</p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* PR Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">PR Number</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <i className="ri-lock-line text-slate-400 text-sm"></i>
                <span className="text-sm font-bold text-slate-700 tracking-wide">{prNumber}</span>
                <span className="ml-auto text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Auto</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Format: PR-EntityCode-FY-####</p>
            </div>

            {/* PR Title */}
            <div className="md:col-span-2 lg:col-span-2" data-field="prTitle">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                PR Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={prTitle}
                onChange={(e) => {
                  setPrTitle(e.target.value);
                  if (errors.prTitle) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.prTitle;
                      return next;
                    });
                  }
                }}
                placeholder="Enter a short title for this purchase request"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                  errors.prTitle ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {errors.prTitle && <p className="text-xs text-red-500 mt-1">{errors.prTitle}</p>}
            </div>

            {/* Entity */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Entity <span className="text-red-500">*</span>
              </label>
              <SearchCreateField
                options={entities.map((ent) => ({
                  id: ent.id,
                  label: formatEntityLabel(ent),
                  subLabel: ent.costCenter || undefined,
                }))}
                displayValue={selectedEntity ? formatEntityLabel(selectedEntity) : ''}
                selectedId={entityId || null}
                placeholder="Search entity by code, name, cost center…"
                hasError={Boolean(errors.entityId)}
                addNoun="entity"
                onSelect={(opt) => {
                  setEntityId(Number(opt.id));
                  const ent = entities.find((e) => e.id === Number(opt.id));
                  const locs = ent?.locations?.filter((loc) => loc.location) || [];
                  const stillValid = locs.some((loc) => Number(loc.id) === Number(billingLocationId));
                  if (!stillValid) {
                    setBillingLocationId('');
                    setBillingLocation('');
                    setBillingGstNo('');
                    setBillingAddress('');
                  }
                  if (errors.entityId || errors.billingLocationId) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.entityId;
                      delete next.billingLocationId;
                      return next;
                    });
                  }
                }}
                onClear={() => {
                  setEntityId('');
                  setBillingLocationId('');
                  setBillingLocation('');
                  setBillingGstNo('');
                  setBillingAddress('');
                }}
              />
              {errors.entityId && (
                <p className="text-xs text-red-500 mt-1">{errors.entityId}</p>
              )}
            </div>

            {/* Purchase Type */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Purchase Type <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'purchase_order' as const, label: 'Purchase Order', hint: 'Number: PO-Entity-FY-####' },
                    { id: 'work_order' as const, label: 'Work Order', hint: 'Number: WO-Entity-FY-####' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setPurchaseType(opt.id);
                      // Service is only valid for Work Order
                      if (opt.id === 'purchase_order' && requestType === 'Service') {
                        setRequestType('Opex');
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      purchaseType === opt.id
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${purchaseType === opt.id ? 'text-teal-100' : 'text-gray-400'}`}>
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <DepartmentCombobox
                departments={departments}
                selectedName={department}
                hasError={Boolean(errors.department)}
                onSelect={(dept) => {
                  setDepartment(dept.name);
                  if (errors.department) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.department;
                      return next;
                    });
                  }
                }}
                onClear={() => setDepartment('')}
                onCreated={(created) => {
                  rememberDepartment(created);
                  setDepartment(created.name);
                }}
              />
              {errors.department && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>
                  {errors.department}
                </p>
              )}
            </div>

            {/* Required Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Required Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={requiredDate}
                onChange={e => setRequiredDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer ${errors.requiredDate ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              {errors.requiredDate && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.requiredDate}</p>}
            </div>

            {/* Currency — INR / USD / EUR */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Currency <span className="text-red-500">*</span>
              </label>
              <div className="inline-flex w-full rounded-xl border border-gray-200 bg-white p-0.5">
                {CURRENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => setCurrency(opt.code)}
                    className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                      currency === opt.code
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.symbol} {opt.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Type — Service only for Work Order */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Request Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {(
                  purchaseType === 'work_order'
                    ? (['Capex', 'Opex', 'Service'] as const)
                    : (['Capex', 'Opex'] as const)
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRequestType(type)}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                      requestType === type
                        ? typeColors[type] + ' shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Priority</label>
              <div className="flex gap-2">
                {priorityOptions.map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                      priority === p
                        ? priorityColors[p] + ' border-current shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Request Flow */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Flow <span className="text-red-500">*</span>
              </label>
              <select
                value={prFlow}
                onChange={(e) => {
                  const next = e.target.value === 'functional' ? 'functional' : 'standard';
                  setPrFlow(next);
                }}
                className="w-full max-w-md px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer"
              >
                <option value="standard">Standard</option>
                <option value="functional">Functional</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {prFlow === 'standard'
                  ? 'Standard: current L1 / L2 / CFO / RFQ path (Own vendor or SCM vendor).'
                  : 'Functional: shortened path — quotes on Create PR for Own vendor, selected user approval, then SCM RFQ / Final RFQ.'}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Vendor Selection <span className="text-red-500">*</span>
              </label>
              <select
                value={vendorSelection}
                onChange={(e) => setVendorSelection(e.target.value === 'own' ? 'own' : 'scm')}
                className="w-full max-w-md px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer"
              >
                <option value="scm">SCM vendor Selection</option>
                <option value="own">Own vendor</option>
              </select>
              <p className="text-xs text-gray-500 mt-1.5">
                {prFlow === 'standard'
                  ? vendorSelection === 'own'
                    ? 'L1 → your RFQ entry (billing & delivery are asked there) → L1 vendor final → L2 → (optional CFO) → SCM Final RFQ → Create PO → SCM Manager sign-off.'
                    : 'L1 → L2 → CFO → SCM RFQ entry → SCM Manager vendor approval → Create PO → SCM Manager sign-off. Billing & delivery are filled on this page.'
                  : vendorSelection === 'own'
                    ? 'Enter vendor quotes on this page, pick approvers in order, then SCM Final RFQ → Buyer Final Verify → Create PO → SCM Manager approval.'
                    : 'No inline RFQ. Pick approvers in order; then SCM RFQ Entry → Buyer Final Verify → Create PO → SCM Manager approval. Billing & delivery are filled on this page.'}
              </p>
            </div>

            {prFlow === 'functional' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Select User Approval <span className="text-red-500">*</span>
                </label>
                <UserSearchSelect
                  users={approvalUsers}
                  value={approvalUserIds}
                  onChange={setApprovalUserIds}
                  placeholder="Search by name, email, role, or department"
                  error={Boolean(errors.approvalUserId)}
                />
                {errors.approvalUserId && (
                  <p className="text-xs text-red-500 mt-1">{errors.approvalUserId}</p>
                )}
                <p className="text-xs text-gray-500 mt-1.5">
                  Select 1–5 people in approval order. Person 1 approves first, then person 2, then the rest in that order.
                  After all selected users approve:{' '}
                  {vendorSelection === 'own' ? 'SCM Final RFQ' : 'SCM RFQ Entry'} → Buyer Final Verify → Create PO → SCM Manager approval.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* ── Section 2: Line Items ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-field="lineItems">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
                <i className="ri-shopping-cart-line text-white text-sm"></i>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Line Items</h2>
                <p className="text-xs text-gray-500">Add all items required for this requisition</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddLineItem}
              disabled={Boolean(lineEditor)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-add-line"></i>
              Add Line Item
            </button>
          </div>

          <div className="p-6 space-y-4">
            {errors.lineItems && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <i className="ri-error-warning-line"></i>
                {errors.lineItems}
              </p>
            )}

            {lineEditor && (
              <LineItemEditorForm
                key={`${lineEditor.mode}-${lineEditor.item.id}`}
                mode={lineEditor.mode}
                initial={lineEditor.item}
                masterItems={masterItems}
                masterCategories={masterCategories}
                requestType={requestType}
                currency={currency}
                moneySymbol={moneySymbol}
                hidePricing={hideLinePricing}
                onSave={saveLineItem}
                onCancel={closeLineEditor}
                onMasterItemCreated={rememberMasterItem}
                onCategoryCreated={rememberCategory}
                onLiveChange={(item) => {
                  pendingLineDraftRef.current = item;
                }}
              />
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className={`w-full text-sm ${hideLinePricing ? 'min-w-[520px]' : 'min-w-[720px]'}`}>
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2.5 w-10">#</th>
                      <th className="px-3 py-2.5">Item Name</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      {!hideLinePricing && (
                        <>
                          <th className="px-3 py-2.5 text-right">Unit Price</th>
                          <th className="px-3 py-2.5">HSN</th>
                          <th className="px-3 py-2.5 text-right">GST %</th>
                          <th className="px-3 py-2.5 text-right">Amount (incl. GST)</th>
                        </>
                      )}
                      <th className="px-3 py-2.5 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={hideLinePricing ? 5 : 9} className="px-4 py-10 text-center">
                          <p className="text-sm font-medium text-gray-600">No line items yet</p>
                          <p className="text-xs text-gray-400 mt-1">Click Add Line Item to enter the first item</p>
                          {!lineEditor && (
                    <button
                              type="button"
                              onClick={openAddLineItem}
                              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                              <i className="ri-add-line"></i>
                              Add Line Item
                    </button>
                  )}
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, index) => {
                        const isEditing = lineEditor?.mode === 'edit' && lineEditor.item.id === item.id;
                        return (
                          <tr
                            key={`line-row-${item.id}-${index}`}
                            className={`border-b border-gray-100 last:border-b-0 ${isEditing ? 'bg-slate-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-3 py-3 text-xs font-semibold text-gray-500">{index + 1}</td>
                            <td className="px-3 py-3">
                              <p className="font-medium text-gray-800">{item.itemName || item.description || `Item ${index + 1}`}</p>
                              {item.description && item.description !== item.itemName && (
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1" title={item.description}>
                                  {item.description}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-700">{item.category || '—'}</td>
                            <td className="px-3 py-3 text-right text-gray-700">
                              {item.quantity} <span className="text-xs text-gray-400">{item.unit || 'Nos'}</span>
                            </td>
                            {!hideLinePricing && (
                              <>
                                <td className="px-3 py-3 text-right text-gray-700">
                                  {formatMoney(item.estimatedCost, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-3 text-gray-600">{item.hsnCode || '—'}</td>
                                <td className="px-3 py-3 text-right text-gray-700">
                                  {item.gstPercentage != null ? `${item.gstPercentage}%` : '—'}
                                </td>
                                <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                                  {formatMoney(
                                    lineInclusiveAmount(item.quantity, item.estimatedCost, item.gstPercentage),
                                    currency,
                                    {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                  )}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-1">
                      <button
                                  type="button"
                                  onClick={() => openEditLineItem(item)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Edit"
                                  aria-label={`Edit ${item.itemName || item.description || 'line item'}`}
                                >
                                  <i className="ri-pencil-line text-sm"></i>
                      </button>
                      <button
                                  type="button"
                                  onClick={() => setDeleteLineItemId(item.id)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete"
                                  aria-label={`Delete ${item.itemName || item.description || 'line item'}`}
                                >
                                  <i className="ri-delete-bin-line text-sm"></i>
                      </button>
                    </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                  </div>
                    </div>
          </div>

          {/* Total Summary Bar */}
          <div className="mx-6 mb-6 rounded-xl overflow-hidden border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Total Items</p>
                  <p className="text-lg font-bold text-gray-800">{lineItems.length}</p>
                </div>
                <div className="w-px h-8 bg-emerald-200"></div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Total Quantity</p>
                  <p className="text-lg font-bold text-gray-800">{lineItems.reduce((s, i) => s + i.quantity, 0)}</p>
                </div>
                {!hideLinePricing && (
                  <>
                <div className="w-px h-8 bg-emerald-200"></div>
                <div className="text-center">
                      <p className="text-xs text-gray-500 mb-0.5">Average Unit Price</p>
                  <p className="text-lg font-bold text-gray-800">
                        {formatMoney(lineItems.length > 0 ? lineItems.reduce((s, i) => s + i.estimatedCost, 0) / lineItems.length : 0, currency, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                  </>
                )}
              </div>
              {!hideLinePricing ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                    <p className="text-xs text-gray-500 mb-0.5">Estimated Total (incl. GST)</p>
                  <p className="text-2xl font-extrabold text-emerald-700">
                      {formatMoney(getTotalAmount(), currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-500 rounded-xl">
                  <i className="ri-money-dollar-circle-line text-white text-xl"></i>
                </div>
              </div>
              ) : (
                <p className="text-xs text-teal-800/80 max-w-xs text-right">
                  Own Vendor — unit price, GST and totals are collected during RFQ quotation.
                </p>
              )}
            </div>
          </div>
        </div>

        {prFlow === 'functional' && vendorSelection === 'own' && (
          <div data-field="rfqVendors">
          <FunctionalOwnRfqSection
            vendors={vendorMaster}
            rows={rfqVendors}
            maxRounds={rfqMaxRounds}
            error={errors.rfqVendors}
            prNumber={prNumber}
            recommendedKey={rfqRecommendedKey}
            recommendationJustification={rfqRecommendationJustification}
            existingQuoteNote={
              existingRfqHasQuotes
                ? 'Quotes already saved on this PR. Re-upload only if you need to replace them.'
                : undefined
            }
            onMaxRoundsChange={setRfqMaxRounds}
            onChange={setRfqVendors}
            onRecommendedChange={({ key, vendorId, vendorName, vendorEmail, justification }) => {
              setRfqRecommendedKey(key);
              setRfqRecommendedMeta({
                vendorId,
                vendorName,
                vendorEmail,
              });
              setRfqRecommendationJustification(justification);
            }}
            onVendorsRefresh={(vendor) => {
              if (vendor) {
                setVendorMaster((prev) =>
                  prev.some((v) => v.id === vendor.id) ? prev : [vendor, ...prev]
                );
              }
            }}
          />
          </div>
        )}

        {askBillingOnCreatePr ? (
          <PrBillingDeliverySection
            value={{
              billingLocationId,
              billingLocation,
              billingGstNo,
              billingAddress,
              deliveryPoc,
              placeOfDelivery,
              expectedDeliveryTimeline,
              paymentTerms,
            }}
            selectedEntity={selectedEntity}
            billingLocations={billingLocations}
            errors={errors}
            requireBillingCore
            onChange={(patch) => {
              if (patch.billingLocationId !== undefined) setBillingLocationId(patch.billingLocationId);
              if (patch.billingLocation !== undefined) setBillingLocation(patch.billingLocation);
              if (patch.billingGstNo !== undefined) setBillingGstNo(patch.billingGstNo);
              if (patch.billingAddress !== undefined) setBillingAddress(patch.billingAddress);
              if (patch.deliveryPoc !== undefined) setDeliveryPoc(patch.deliveryPoc);
              if (patch.placeOfDelivery !== undefined) setPlaceOfDelivery(patch.placeOfDelivery);
              if (patch.expectedDeliveryTimeline !== undefined) {
                setExpectedDeliveryTimeline(patch.expectedDeliveryTimeline);
              }
              if (patch.paymentTerms !== undefined) setPaymentTerms(patch.paymentTerms);
            }}
            onClearError={(key) => {
              if (!errors[key]) return;
              setErrors((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
            }}
          />
        ) : (
          <div className="bg-teal-50 border border-teal-200 rounded-2xl px-5 py-4">
            <p className="text-sm font-semibold text-teal-900">Billing &amp; delivery on RFQ Entry</p>
            <p className="text-xs text-teal-800 mt-1">
              For Standard + Own vendor, billing region, GSTIN, address, POC, place of delivery, timeline, and
              payment terms are asked on RFQ Entry after L1 approval — not on this page.
            </p>
          </div>
        )}

        {/* ── Section 4: Business Justification ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
              <i className="ri-article-line text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Business Justification</h2>
              <p className="text-xs text-gray-500">Explain the business need and expected benefits</p>
            </div>
          </div>
          <div className="p-6">
            <textarea
              value={businessJustification}
              onChange={e => setBusinessJustification(e.target.value)}
              rows={5}
              placeholder="Describe the business need, expected benefits, and why this purchase is necessary for operations..."
              className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none ${errors.businessJustification ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
            />
            <div className="flex items-center justify-between mt-2">
              {errors.businessJustification
                ? <p className="text-xs text-red-500 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.businessJustification}</p>
                : <p className="text-xs text-gray-400">Minimum 50 characters recommended</p>
              }
              <p className="text-xs text-gray-400">{businessJustification.length} chars</p>
            </div>
          </div>
        </div>

        {/* ── Section 5: Attachments ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
              <i className="ri-attachment-2 text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">FSD Document (Functional Specification Document)</h2>
              <p className="text-xs text-gray-500">Upload FSD / functional specification documents</p>
            </div>
          </div>
          <div className="p-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${isDragging ? 'border-slate-500 bg-slate-50' : 'border-gray-200 hover:border-slate-400 hover:bg-gray-50'}`}
            >
              <div className="w-14 h-14 flex items-center justify-center bg-slate-100 rounded-2xl mx-auto mb-3">
                <i className="ri-upload-cloud-2-line text-2xl text-slate-500"></i>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">Drop files here or click to browse</p>
              <p className="text-xs text-gray-400">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG — Max 10MB each</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
            </div>

            {attachedFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {attachedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white transition-colors">
                    <div className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-lg flex-shrink-0">
                      <i className="ri-file-text-line text-slate-600 text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      {file.existingId && persistPrId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            prApi.downloadAttachment(persistPrId, file.existingId as number, file.name);
                          }}
                          className="text-sm font-medium text-teal-700 hover:underline truncate text-left cursor-pointer"
                        >
                          {file.name}
                        </button>
                      ) : (
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                      )}
                      <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeFile(file.id); }} className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0">
                      <i className="ri-close-line text-sm"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ── */}
        {submitError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{submitError}</div>
        )}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-gray-500">
            <i className="ri-shield-check-line text-emerald-500"></i>
            <span>Autosave keeps the same PR# (incl. quotation files). Create New PR starts blank.</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Link
              to={backTo}
              className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap text-center"
            >
              Cancel
            </Link>
            {isAdminEditFlow || isPendingEditFlow ? (
              <button
                onClick={() => {
                  if (!validateForm()) return;
                  setSubmitAction('draft');
                  void savePR(false);
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-60"
              >
                <i className="ri-save-line"></i>
                {isSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            ) : (
              <>
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              <i className="ri-save-line"></i>
              {isSubmitting && submitAction === 'draft' ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={handleSubmitPR}
              disabled={isSubmitting}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-xl transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap shadow-sm disabled:opacity-60 ${
                isResubmitFlow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <i className={isResubmitFlow ? 'ri-refresh-line' : 'ri-send-plane-fill'}></i>
              {isResubmitFlow ? 'Resubmit PR' : 'Submit PR'}
            </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Line Item Confirm ── */}
      {deleteLineItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-red-50 rounded-xl">
                <i className="ri-delete-bin-line text-2xl text-red-600"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Line Item</h3>
                <p className="text-xs text-gray-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Remove{' '}
              <span className="font-semibold text-gray-800">
                {lineItems.find((item) => item.id === deleteLineItemId)?.itemName
                  || lineItems.find((item) => item.id === deleteLineItemId)?.description
                  || 'this line item'}
              </span>{' '}
              from the requisition?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteLineItemId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveLineItem}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl">
                <i className="ri-send-plane-fill text-2xl text-slate-700"></i>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {isResubmitFlow ? 'Resubmit Purchase Requisition' : 'Submit Purchase Requisition'}
                </h3>
                <p className="text-xs text-gray-500">{prNumber}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 space-y-2">
              <p className="text-sm text-amber-800">
                <i className="ri-information-line mr-1"></i>
                {isResubmitFlow
                  ? prFlow === 'functional'
                    ? selectedApprovalUsers.length > 1
                      ? 'Your updated PR will go back to person 1, then each selected user in order.'
                      : 'Your updated PR will be sent to the selected user for approval again.'
                    : 'Your updated PR will be sent to L1 Manager for approval again.'
                  : prFlow === 'functional'
                    ? selectedApprovalUsers.length > 1
                      ? <>Once submitted, person 1 approves first, then person 2, then the rest in order. After all selected users approve: SCM Final RFQ / RFQ Entry → Buyer Final Verify → Create PO → SCM Manager approval. This PR <strong>cannot be edited</strong>.</>
                      : <>Once submitted, this PR will be sent for User Approval, then SCM Final RFQ / RFQ Entry → Buyer Final Verify → Create PO → SCM Manager approval, and <strong>cannot be edited</strong>.</>
                    : <>Once submitted, this PR will be sent for L1 Manager approval and <strong>cannot be edited</strong>.</>}
              </p>
              <div className="flex justify-between text-sm gap-3 pt-2 border-t border-amber-200">
                <span className="text-amber-700/80 shrink-0">Next Step</span>
                <span className="font-semibold text-amber-900 text-right">{nextStepLabel || 'L1 Manager Approval'}</span>
              </div>
              <div className="flex justify-between text-sm gap-3">
                <span className="text-amber-700/80 shrink-0">{prFlow === 'functional' ? (selectedApprovalUsers.length > 1 ? 'Approvers' : 'Approver') : 'L1 Manager'}</span>
                <span className="font-semibold text-amber-900 text-right">
                  {isLoadingL1 ? (
                    <span className="font-normal text-amber-700">Looking up…</span>
                  ) : prFlow === 'functional' && selectedApprovalUsers.length > 0 ? (
                    <span className="block space-y-1">
                      {selectedApprovalUsers.map((u, i) => (
                        <span key={u.id} className="block">
                          {i + 1}. {u.name}
                          {u.email ? (
                            <span className="block text-xs font-normal text-amber-700/80">{u.email}</span>
                          ) : null}
                        </span>
                      ))}
                    </span>
                  ) : l1Manager?.name || l1Manager?.email ? (
                    <>
                      {l1Manager.name || '—'}
                      {l1Manager.email ? (
                        <span className="block text-xs font-normal text-amber-700/80 mt-0.5">{l1Manager.email}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="font-normal">Will be assigned on submit</span>
                  )}
                </span>
              </div>
              {prFlow === 'functional' && (
                <p className="text-[11px] text-amber-800/80 pt-1 border-t border-amber-200">
                  Then: {vendorSelection === 'own' ? 'SCM Final RFQ' : 'SCM RFQ Entry'} → Buyer Final Verify → Create PO → SCM Manager approval.
                </p>
              )}
            </div>
            {isResubmitFlow && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Resubmit Remarks (optional)</label>
                <textarea
                  value={resubmitRemarks}
                  onChange={(e) => setResubmitRemarks(e.target.value)}
                  placeholder="Describe changes made after rework..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400 resize-none"
                />
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-5">
              <span className="text-sm text-gray-600">Total Amount</span>
              <span className="text-base font-bold text-emerald-700">
                {formatMoney(getTotalAmount(), currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium cursor-pointer whitespace-nowrap">
                Cancel
              </button>
              <button onClick={confirmSubmit} disabled={isSubmitting} className={`flex-1 py-2.5 text-white rounded-xl text-sm font-semibold cursor-pointer whitespace-nowrap disabled:opacity-50 ${isResubmitFlow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
                {isSubmitting ? 'Submitting...' : isResubmitFlow ? 'Yes, Resubmit' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-5">
              <div className="w-16 h-16 flex items-center justify-center bg-emerald-100 rounded-2xl mx-auto mb-3">
                <i className={`text-3xl ${submitAction === 'draft' ? 'ri-save-line text-gray-600' : 'ri-check-line text-emerald-600'}`}></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {isAdminEditFlow
                  ? 'PR Updated Successfully!'
                  : submitAction === 'draft'
                  ? 'Changes Saved!'
                  : isResubmitFlow
                  ? 'PR Resubmitted Successfully!'
                  : 'PR Submitted Successfully!'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {isAdminEditFlow
                  ? `${createdPrNumber || prNumber} details have been updated.`
                  : submitAction === 'draft'
                  ? `${createdPrNumber || prNumber} saved. You can continue editing later.`
                    : `${createdPrNumber || prNumber} has been ${isResubmitFlow ? 'resubmitted' : 'submitted'} and is pending ${prFlow === 'functional' ? (selectedApprovalUsers.length > 1 ? `User Approval 1 of ${selectedApprovalUsers.length}` : 'User Approval') : 'L1 Manager approval'}.`}
              </p>
            </div>
            {submitAction === 'submit' && (
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">PR Number</span>
                  <span className="font-semibold text-gray-800">{createdPrNumber || prNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Amount</span>
                  <span className="font-bold text-emerald-700">{formatMoney(getTotalAmount(), currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-gray-500 shrink-0">Next Step</span>
                  <span className="font-medium text-amber-600 text-right">{nextStepLabel || 'L1 Manager Approval'}</span>
                </div>
                <div className="flex justify-between text-sm gap-3 pt-1 border-t border-gray-200">
                  <span className="text-gray-500 shrink-0">{prFlow === 'functional' ? (selectedApprovalUsers.length > 1 ? 'Approvers' : 'Approver') : 'L1 Manager'}</span>
                  <span className="font-semibold text-gray-900 text-right">
                    {prFlow === 'functional' && selectedApprovalUsers.length > 0 ? (
                      <span className="block space-y-1">
                        {selectedApprovalUsers.map((u, i) => (
                          <span key={u.id} className="block">
                            {i + 1}. {u.name}
                          </span>
                        ))}
                      </span>
                    ) : l1Manager?.name || l1Manager?.email ? (
                      <>
                        {l1Manager.name || '—'}
                        {l1Manager.email ? (
                          <span className="block text-xs font-normal text-gray-500 mt-0.5">{l1Manager.email}</span>
                        ) : null}
                      </>
                    ) : (
                      'Will be assigned shortly'
                    )}
                  </span>
                </div>
                {prFlow === 'functional' && (
                  <p className="text-[11px] text-gray-500 pt-1">
                    After all selected users approve: {vendorSelection === 'own' ? 'SCM Final RFQ' : 'SCM RFQ Entry'} → Buyer Final Verify → Create PO → SCM Manager approval.
                  </p>
                )}
              </div>
            )}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                window.REACT_APP_NAVIGATE(backTo);
              }}
              className="w-full py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              {isAdminEditFlow || isEditMode ? 'Back to Track PR' : 'Go to Dashboard'}
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </DashboardLayout>
  );
}
