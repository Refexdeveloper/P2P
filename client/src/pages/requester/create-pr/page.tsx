import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
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
} from './FunctionalOwnRfqSection';
import UserSearchSelect from './UserSearchSelect';
import {
  clearCreatePrDraft,
  CreatePrDraftSnapshot,
  hasMeaningfulCreatePrDraft,
  readCreatePrDraft,
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
import {
  PR_PAYMENT_TERM_OPTIONS,
  PR_DELIVERY_TIMELINE_OPTIONS,
} from '../../../constants/prRequisition';

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

export default function CreatePRPage() {
  const { user } = useAuth();
  const { prId: prIdParam } = useParams<{ prId?: string }>();
  const editPrId = prIdParam ? Number(prIdParam) : null;
  const isEditMode = !!editPrId;
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
  const skipSoftSaveRef = useRef(false);
  const hydrateDoneRef = useRef(false);
  const snapshotRef = useRef<CreatePrDraftSnapshot | null>(null);

  const isReturned = prStatus === 'RETURNED';
  const isPendingEditFlow =
    isEditMode &&
    !isAdminEditFlow &&
    !isReturned &&
    ['PENDING_HOD_APPROVAL', 'PENDING_PR_MANAGER_APPROVAL', 'PENDING_CFO_APPROVAL'].includes(prStatus);
  const isResubmitFlow = isEditMode && isReturned && !isAdminEditFlow;
  const backTo = isAdminEditFlow || isEditMode ? '/requester/track-pr' : '/requester/dashboard';
  const persistPrId = editPrId || savedDraftId;
  const restoredKeyRef = useRef('');

  const applyDraftSnapshot = (draft: CreatePrDraftSnapshot) => {
    setPrTitle(draft.prTitle || '');
    setDepartment(draft.department || '');
    setEntityId(draft.entityId === '' || draft.entityId == null ? '' : Number(draft.entityId));
    setRequestType(draft.requestType || 'Opex');
    setPurchaseType(draft.purchaseType === 'work_order' ? 'work_order' : 'purchase_order');
    setVendorSelection(draft.vendorSelection === 'own' ? 'own' : 'scm');
    setPrFlow(draft.prFlow === 'functional' ? 'functional' : 'standard');
    setApprovalUserIds(Array.isArray(draft.approvalUserIds) ? draft.approvalUserIds : []);
    setRfqMaxRounds(draft.rfqMaxRounds || 1);
    setRfqVendors(
      (draft.rfqVendors || []).map((row) => ({
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
        })),
      }))
    );
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
    setLineItems(
      (draft.lineItems || []).map((item) => ({
        ...item,
        gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
      }))
    );
    setAttachedFiles(
      (draft.attachedFiles || [])
        .filter((f) => f.existingId)
        .map((f) => ({ id: f.id, name: f.name, size: f.size, existingId: f.existingId }))
    );
    if (draft.backendPrId && !editPrId) setSavedDraftId(draft.backendPrId);
    if (draft.prNumber) setPrNumber(draft.prNumber);
  };

  useEffect(() => {
    if (!editPrId) return;
    (async () => {
      setIsLoadingPr(true);
      setLoadError('');
      try {
        const res = await prApi.get(editPrId);
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

        setLineItems(
          pr.lineItems.length > 0
            ? pr.lineItems.map((item, i) => ({
                id: String(item.id != null ? `${item.id}-${i}` : `row-${i + 1}`),
                itemId: null,
                itemName: item.description,
                description: item.description,
                quantity: item.quantity,
                estimatedCost: item.unitCost,
                category: item.category,
                unit: item.unit || 'Nos',
                hsnCode: '',
                gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
              }))
            : []
        );
        setAttachedFiles(
          (pr.attachments || []).map((att) => ({
            id: `existing-${att.id}`,
            name: att.fileName,
            size: att.size,
            existingId: att.id,
          }))
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load PR');
      } finally {
        setIsLoadingPr(false);
      }
    })();
  }, [editPrId]);

  useEffect(() => {
    if (isLoadingPr) return;
    const key = `${user?.id || 'anon'}-${editPrId ?? 'new'}`;
    if (restoredKeyRef.current === key) {
      hydrateDoneRef.current = true;
      return;
    }
    restoredKeyRef.current = key;
    const draft = readCreatePrDraft(user?.id, editPrId);
    if (draft && hasMeaningfulCreatePrDraft(draft)) {
      applyDraftSnapshot(draft);
      setSoftSaveHint('Restored your unsaved changes');
    }
    hydrateDoneRef.current = true;
  }, [editPrId, isLoadingPr, user?.id]);

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
    if (!hydrateDoneRef.current || skipSoftSaveRef.current || isLoadingPr) return;
    const timer = window.setTimeout(() => {
      const snap = snapshotRef.current;
      if (!snap) return;
      writeCreatePrDraft(user?.id, editPrId, snap);
      if (hasMeaningfulCreatePrDraft(snap)) {
        setSoftSaveHint('Draft auto-saved');
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
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
    const flushLocal = () => {
      if (skipSoftSaveRef.current || !hydrateDoneRef.current) return;
      const snap = snapshotRef.current;
      if (!snap) return;
      writeCreatePrDraft(user?.id, editPrId, snap);
    };
    const flushApi = () => {
      flushLocal();
      const snap = snapshotRef.current;
      if (!snap || skipSoftSaveRef.current || !hydrateDoneRef.current) return;
      const id = snap.backendPrId;
      if (!id || !snap.lineItems.length) return;
      const payload = {
        title: snap.prTitle.trim() || snap.lineItems[0]?.description || `${snap.requestType} Request`,
        requestType: snap.requestType,
        purchaseType: snap.purchaseType,
        department: snap.department,
        entityId: snap.entityId ? Number(snap.entityId) : undefined,
        priority: snap.priority,
        currency: snap.currency,
        prFlow: snap.prFlow,
        approvalUserId: snap.prFlow === 'functional' && snap.approvalUserIds[0] ? Number(snap.approvalUserIds[0]) : undefined,
        approvalUserIds: snap.prFlow === 'functional' ? snap.approvalUserIds : undefined,
        vendorSelection: snap.vendorSelection,
        justification: snap.businessJustification,
        requiredDate: snap.requiredDate || undefined,
        billingLocationId: snap.billingLocationId || undefined,
        billingLocation: snap.billingLocation.trim() || undefined,
        billingGstNo: snap.billingGstNo.trim() || undefined,
        billingAddress: snap.billingAddress.trim() || undefined,
        deliveryPoc: snap.deliveryPoc.trim() || undefined,
        placeOfDelivery: snap.placeOfDelivery.trim() || undefined,
        expectedDeliveryTimeline: snap.expectedDeliveryTimeline.trim() || undefined,
        paymentTerms: snap.paymentTerms.trim() || undefined,
        lineItems: snap.lineItems.map((item) => ({
          category: item.category,
          description: item.description,
          quantity: item.quantity,
          unitCost: item.estimatedCost,
          unit: item.unit || 'Nos',
          gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
        })),
      };
      const req = snap.isAdminEditFlow ? prApi.adminUpdate(id, payload) : prApi.update(id, payload);
      void req.catch(() => undefined);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushApi();
    };
    window.addEventListener('pagehide', flushApi);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      flushApi();
      window.removeEventListener('pagehide', flushApi);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [editPrId, user?.id]);

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
    if (!editPrId || prFlow !== 'functional' || vendorSelection !== 'own') {
      setExistingRfqHasQuotes(false);
      return;
    }
    (async () => {
      try {
        const res = await rfqApi.getByPr(editPrId);
        const invitations = (res.data as {
          invitations?: Array<{
            submissions?: Array<{ quotedPrice?: number; quotationFileName?: string }>;
          }>;
        })?.invitations || [];
        const hasQuotes = invitations.some((inv) =>
          (inv.submissions || []).some((q) => Number(q.quotedPrice) > 0 && Boolean(q.quotationFileName))
        );
        setExistingRfqHasQuotes(hasQuotes);
      } catch {
        setExistingRfqHasQuotes(false);
      }
    })();
  }, [editPrId, prFlow, vendorSelection]);

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
    setLineEditor({ mode: 'add', item: createEmptyLineItem() });
  };

  const openEditLineItem = (item: LineItem) => {
    setDeleteLineItemId(null);
    setLineEditor({ mode: 'edit', item: { ...item } });
  };

  const closeLineEditor = () => setLineEditor(null);

  const saveLineItem = (item: LineItem) => {
    setLineItems((prev) => {
      if (lineEditor?.mode === 'edit') {
        return prev.map((row) => (row.id === item.id ? item : row));
      }
      return [...prev, item];
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.lineItems;
      return next;
    });
    setLineEditor(null);
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
    if (target?.existingId && editPrId) {
      try {
        await prApi.deleteAttachment(editPrId, target.existingId);
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
    if (billingLocations.length > 0 && !billingLocationId) {
      newErrors.billingLocationId = 'Select billing region / GST for this entity';
    }
    if (!billingAddress.trim()) newErrors.billingAddress = 'Billing address is required';
    if (!deliveryPoc.trim()) newErrors.deliveryPoc = 'POC for delivery is required';
    if (!placeOfDelivery.trim()) newErrors.placeOfDelivery = 'Place of delivery is required';
    if (!expectedDeliveryTimeline.trim()) newErrors.expectedDeliveryTimeline = 'Expected delivery timeline is required';
    if (!paymentTerms.trim()) newErrors.paymentTerms = 'Payment terms are required';
    if (prFlow === 'functional' && approvalUserIds.length === 0) {
      newErrors.approvalUserId = 'Select at least one user for Functional Flow approval';
    }
    if (prFlow === 'functional' && approvalUserIds.length > 5) {
      newErrors.approvalUserId = 'Select up to 5 users for Functional Flow approval';
    }
    if (prFlow === 'functional' && vendorSelection === 'own') {
      const hasRound1 = rfqVendors.some((row) => {
        const round1 = row.quotes.find((q) => q.round === 1);
        return Boolean(row.vendorId) && Number(round1?.quotedPrice) > 0 && Boolean(round1?.file);
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
      if (!(Number(item.estimatedCost) > 0)) {
        newErrors[`item_${index}_cost`] = 'Unit price is required';
        newErrors.lineItems = 'Unit price is required on every line item';
      }
      if (item.gstPercentage == null || !Number.isFinite(Number(item.gstPercentage))) {
        newErrors[`item_${index}_gst`] = 'GST % is required';
        newErrors.lineItems = newErrors.lineItems || 'GST % is required on every line item';
      }
    });
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

  const buildRfqVendorsPayload = async () => {
    const packed = [];
    for (const row of rfqVendors) {
      const master = vendorMaster.find((v) => String(v.id) === String(row.vendorId));
      const quotes = [];
      for (const quote of row.quotes) {
        if (!(Number(quote.quotedPrice) > 0) || !quote.file) continue;
        const filePayload = await fileToAttachmentPayload(quote.file);
        quotes.push({
          round: quote.round,
          quotedPrice: Number(quote.quotedPrice),
          leadTime: Number(quote.leadTime) || 0,
          paymentTerms: quote.paymentTerms || undefined,
          quotationFileName: filePayload.fileName,
          quotationFileData: filePayload.data,
        });
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

  const buildPayload = () => ({
    title: prTitle.trim() || lineItems[0]?.description || `${requestType} Request`,
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
    lineItems: lineItems.map((item) => ({
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unitCost: item.estimatedCost,
      unit: item.unit || 'Nos',
      gstPercentage: Number.isFinite(Number(item.gstPercentage)) ? Number(item.gstPercentage) : 18,
    })),
  });

  const uploadNewAttachments = async (prId: number) => {
    const pending = attachedFiles.filter((item) => item.file);
    for (const item of pending) {
      const filePayload = await fileToAttachmentPayload(item.file as File);
      await prApi.uploadAttachment(prId, filePayload);
    }
  };

  const savePR = async (submit: boolean, options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) setSubmitError('');
    if (!silent) setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = buildPayload();
      if (prFlow === 'functional' && vendorSelection === 'own') {
        const packed = await buildRfqVendorsPayload();
        if (packed.length) {
          payload.rfqVendors = packed;
          payload.maxRounds = rfqMaxRounds;
        }
      }
      const targetId = persistPrId;
      if (targetId) {
        if (isAdminEditFlow) {
          await prApi.adminUpdate(targetId, payload);
          await uploadNewAttachments(targetId);
          if (silent) return;
          setCreatedPrNumber(prNumber);
          setNextStepLabel('');
          setL1Manager(null);
          setShowConfirmModal(false);
          setShowSuccessModal(true);
          return;
        }
        if (submit) {
          skipSoftSaveRef.current = true;
          clearCreatePrDraft(user?.id, editPrId);
          const res = await prApi.resubmit(targetId, { ...payload, remarks: resubmitRemarks });
          const data = res.data as {
            prNumber?: string;
            nextStep?: string;
            l1Manager?: { name: string | null; email: string | null };
          };
          await uploadNewAttachments(targetId);
          setCreatedPrNumber(data.prNumber || prNumber);
          setNextStepLabel(data.nextStep || 'L1 Manager Approval');
          setL1Manager(data.l1Manager || null);
        } else {
          await prApi.update(targetId, payload);
          await uploadNewAttachments(targetId);
          setCreatedPrNumber(prNumber);
          setNextStepLabel('');
          setL1Manager(null);
        }
        if (silent) return;
        if (submit) setShowConfirmModal(false);
        setShowSuccessModal(true);
        return;
      }
      const res = await prApi.create({ ...payload, submit });
      const data = res.data as {
        id?: number;
        prNumber: string;
        nextStep?: string;
        l1Manager?: { name: string | null; email: string | null };
      };
      if (data.id) {
        await uploadNewAttachments(data.id);
        if (!submit) setSavedDraftId(data.id);
      }
      setCreatedPrNumber(data.prNumber);
      if (data.prNumber) setPrNumber(data.prNumber);
      if (submit) {
        skipSoftSaveRef.current = true;
        clearCreatePrDraft(user?.id, editPrId);
        setNextStepLabel(data.nextStep || 'L1 Manager Approval');
        setL1Manager(data.l1Manager || null);
        setShowConfirmModal(false);
      } else {
        setNextStepLabel('');
        setL1Manager(null);
      }
      if (!silent) setShowSuccessModal(true);
    } catch (err) {
      if (!silent) setSubmitError(err instanceof Error ? err.message : 'Failed to save PR');
    } finally {
      if (!silent) setIsSubmitting(false);
    }
  };

  const confirmSubmit = async () => {
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
                <p className="text-emerald-300/80 text-xs leading-none mb-0.5">Total Amount</p>
                <p className="text-emerald-300 font-bold text-base">
                  {formatMoney(getTotalAmount(), currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              : `${lineItems.filter((i) => i.description && i.estimatedCost > 0).length}/${lineItems.length} items filled`}
          </span>
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${lineItems.length > 0 ? (lineItems.filter(i => i.description && i.estimatedCost > 0).length / lineItems.length) * 100 : 0}%` }}
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
                    ? 'L1 → your RFQ entry → L1 vendor final → L2 → (optional CFO) → SCM Final RFQ → Create PO → SCM Manager sign-off.'
                    : 'L1 → L2 → CFO → SCM RFQ entry → SCM Manager vendor approval → Create PO → SCM Manager sign-off.'
                  : vendorSelection === 'own'
                    ? 'Enter vendor quotes on this page, pick approvers in order, then SCM Final RFQ → Buyer Final Verify → Create PO → SCM Manager approval.'
                    : 'No inline RFQ. Pick approvers in order; then SCM RFQ Entry → Buyer Final Verify → Create PO → SCM Manager approval.'}
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
                onSave={saveLineItem}
                onCancel={closeLineEditor}
                onMasterItemCreated={rememberMasterItem}
                onCategoryCreated={rememberCategory}
              />
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 border-b border-gray-200">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      <th className="px-3 py-2.5 w-10">#</th>
                      <th className="px-3 py-2.5">Item Name</th>
                      <th className="px-3 py-2.5">Category</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-3 py-2.5">HSN</th>
                      <th className="px-3 py-2.5 text-right">GST %</th>
                      <th className="px-3 py-2.5 text-right">Amount (incl. GST)</th>
                      <th className="px-3 py-2.5 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center">
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
                <div className="w-px h-8 bg-emerald-200"></div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-0.5">Average Unit Price</p>
                  <p className="text-lg font-bold text-gray-800">
                    {formatMoney(lineItems.length > 0 ? lineItems.reduce((s, i) => s + i.estimatedCost, 0) / lineItems.length : 0, currency, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
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
            </div>
          </div>
        </div>

        {prFlow === 'functional' && vendorSelection === 'own' && (
          <FunctionalOwnRfqSection
            vendors={vendorMaster}
            rows={rfqVendors}
            maxRounds={rfqMaxRounds}
            error={errors.rfqVendors}
            prNumber={prNumber}
            existingQuoteNote={
              existingRfqHasQuotes
                ? 'Quotes already saved on this PR. Re-upload only if you need to replace them.'
                : undefined
            }
            onMaxRoundsChange={setRfqMaxRounds}
            onChange={setRfqVendors}
            onVendorsRefresh={(vendor) => {
              if (vendor) {
                setVendorMaster((prev) =>
                  prev.some((v) => v.id === vendor.id) ? prev : [vendor, ...prev]
                );
              }
            }}
          />
        )}

        {/* ── Section 3: Billing & Delivery ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
              <i className="ri-map-pin-line text-white text-sm"></i>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Billing Address &amp; Delivery</h2>
              <p className="text-xs text-gray-500">
                Billing GSTIN is filled from the entity region and can be edited.
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Billing Region / GST <span className="text-red-500">*</span>
              </label>
              {billingLocations.length > 0 ? (
                <select
                  value={billingLocationId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setBillingLocationId(id);
                    const loc = billingLocations.find((row) => Number(row.id) === Number(id));
                    const previousLocation = billingLocation;
                    setBillingLocationId(id);
                    setBillingLocation(loc?.location || '');
                    setBillingGstNo((loc?.gstNo || '').toUpperCase());
                    setBillingAddress((prev) => {
                      const trimmed = prev.trim();
                      if (!trimmed || trimmed === previousLocation) return loc?.location || '';
                      return prev;
                    });
                    if (errors.billingLocationId) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.billingLocationId;
                        return next;
                      });
                    }
                  }}
                  disabled={!selectedEntity}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                    errors.billingLocationId ? 'border-red-400 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <option value="">{selectedEntity ? 'Select billing region…' : 'Select entity first'}</option>
                  {billingLocations.map((loc) => (
                    <option key={loc.id || loc.location} value={loc.id}>
                      {loc.location}{loc.gstNo ? ` — ${loc.gstNo}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={billingLocation}
                  onChange={(e) => setBillingLocation(e.target.value)}
                  disabled={!selectedEntity}
                  placeholder={selectedEntity ? 'No regions in entity master — enter billing location' : 'Select entity first'}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50"
                />
              )}
              {errors.billingLocationId && (
                <p className="text-xs text-red-500 mt-1">{errors.billingLocationId}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                GSTIN is filled from the selected region. You can edit it after it appears.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Billing GSTIN
              </label>
              <div className="relative">
                <i className="ri-shield-check-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                <input
                  type="text"
                  value={billingGstNo}
                  onChange={(e) => setBillingGstNo(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  disabled={!selectedEntity}
                  placeholder={
                    selectedEntity
                      ? billingLocationId || billingLocation
                        ? 'Edit GSTIN if needed'
                        : 'Select billing region to auto-fill, then edit'
                      : 'Select entity first'
                  }
                  maxLength={15}
                  autoComplete="off"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Auto-filled from the region. Change it if this PR needs a different GSTIN.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Billing Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={billingAddress}
                onChange={(e) => {
                  setBillingAddress(e.target.value);
                  if (errors.billingAddress) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.billingAddress;
                      return next;
                    });
                  }
                }}
                rows={3}
                placeholder="Enter billing / invoicing address"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white resize-none ${
                  errors.billingAddress ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {errors.billingAddress && <p className="text-xs text-red-500 mt-1">{errors.billingAddress}</p>}
              <p className="text-[11px] text-gray-400 mt-1">
                Filled from the selected region. Edit the full billing address if needed.
              </p>
            </div>

            <div data-field="deliveryPoc">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                POC for Delivery <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={deliveryPoc}
                onChange={(e) => {
                  setDeliveryPoc(e.target.value);
                  if (errors.deliveryPoc) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.deliveryPoc;
                      return next;
                    });
                  }
                }}
                placeholder="Name / phone of site contact"
                required
                aria-required="true"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                  errors.deliveryPoc ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {errors.deliveryPoc && <p className="text-xs text-red-500 mt-1">{errors.deliveryPoc}</p>}
            </div>

            <div data-field="placeOfDelivery">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Place of Delivery <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={placeOfDelivery}
                onChange={(e) => {
                  setPlaceOfDelivery(e.target.value);
                  if (errors.placeOfDelivery) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.placeOfDelivery;
                      return next;
                    });
                  }
                }}
                placeholder="Site / warehouse address (can differ from billing)"
                required
                aria-required="true"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                  errors.placeOfDelivery ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              {errors.placeOfDelivery && <p className="text-xs text-red-500 mt-1">{errors.placeOfDelivery}</p>}
            </div>

            <div data-field="expectedDeliveryTimeline">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Expected Delivery Timeline <span className="text-red-500">*</span>
              </label>
              <input
                list="pr-delivery-timeline"
                value={expectedDeliveryTimeline}
                onChange={(e) => {
                  setExpectedDeliveryTimeline(e.target.value);
                  if (errors.expectedDeliveryTimeline) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.expectedDeliveryTimeline;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Within 30 days"
                required
                aria-required="true"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                  errors.expectedDeliveryTimeline ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              <datalist id="pr-delivery-timeline">
                {PR_DELIVERY_TIMELINE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
              {errors.expectedDeliveryTimeline && (
                <p className="text-xs text-red-500 mt-1">{errors.expectedDeliveryTimeline}</p>
              )}
            </div>

            <div data-field="paymentTerms">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Payment Terms <span className="text-red-500">*</span>
              </label>
              <input
                list="pr-payment-terms"
                value={paymentTerms}
                onChange={(e) => {
                  setPaymentTerms(e.target.value);
                  if (errors.paymentTerms) {
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.paymentTerms;
                      return next;
                    });
                  }
                }}
                placeholder="e.g. Net 30 Days"
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                  errors.paymentTerms ? 'border-red-400 bg-red-50' : 'border-gray-200'
                }`}
              />
              <datalist id="pr-payment-terms">
                {PR_PAYMENT_TERM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
              {errors.paymentTerms && <p className="text-xs text-red-500 mt-1">{errors.paymentTerms}</p>}
            </div>
          </div>
        </div>

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
                      {file.existingId && editPrId ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            prApi.downloadAttachment(editPrId, file.existingId as number, file.name);
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
            <span>Draft auto-saves if you leave this page</span>
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
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-save-line"></i>
              Save Draft
            </button>
            <button
              onClick={handleSubmitPR}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-xl transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap shadow-sm ${
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
