import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { prApi, masterApi, ItemRecord, CategoryRecord, EntityRecord, DepartmentRecord } from '../../../services/api';

interface LineItem {
  id: string;
  itemId?: number | null;
  itemName?: string;
  description: string;
  quantity: number;
  estimatedCost: number;
  category: string;
  hsnCode?: string;
  gstPercentage?: number;
}

interface AttachedFile {
  id: string;
  name: string;
  size: number;
}

interface ReturnFeedback {
  stage: string;
  user: string;
  role: string;
  date: string;
  remarks: string;
}

interface ReturnFeedback {
  stage: string;
  user: string;
  role: string;
  date: string;
  remarks: string;
}

export default function CreatePRPage() {
  const { prId: prIdParam } = useParams<{ prId?: string }>();
  const editPrId = prIdParam ? Number(prIdParam) : null;
  const isEditMode = !!editPrId;

  const [prNumber, setPrNumber] = useState(isEditMode ? '' : 'Auto on save');
  const [department, setDepartment] = useState('');
  const [entityId, setEntityId] = useState<number | ''>('');
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [requestType, setRequestType] = useState<'Capex' | 'Opex' | 'Service'>('Opex');
  const [purchaseType, setPurchaseType] = useState<'purchase_order' | 'work_order'>('purchase_order');
  const [vendorSelection, setVendorSelection] = useState<'own' | 'scm'>('scm');
  const [priority, setPriority] = useState('Medium');
  const [businessJustification, setBusinessJustification] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', itemId: null, itemName: '', description: '', quantity: 1, estimatedCost: 0, category: '', hsnCode: '', gstPercentage: 18 },
  ]);
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
  const [isLoadingPr, setIsLoadingPr] = useState(isEditMode);
  const [loadError, setLoadError] = useState('');
  const [prStatus, setPrStatus] = useState('');
  const [returnFeedback, setReturnFeedback] = useState<ReturnFeedback | null>(null);
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isReturned = prStatus === 'RETURNED';
  const isResubmitFlow = isEditMode && isReturned;

  useEffect(() => {
    if (!editPrId) return;
    (async () => {
      setIsLoadingPr(true);
      setLoadError('');
      try {
        const res = await prApi.get(editPrId);
        const pr = res.data as {
          prNumber: string;
          department: string;
          entityId?: number;
          requestType: 'Capex' | 'Opex' | 'Service';
          purchaseType?: 'purchase_order' | 'work_order' | string;
          vendorSelection?: 'own' | 'scm';
          priority: string;
          justification: string;
          requiredDate: string;
          status: string;
          lineItems: { id?: number; description: string; quantity: number; unitCost: number; category: string }[];
          approvalHistory?: { stage: string; user: string; role: string; date: string; status: string; remarks: string }[];
        };
        setPrNumber(pr.prNumber);
        setDepartment(pr.department || '');
        setEntityId(pr.entityId ? Number(pr.entityId) : '');
        setRequestType(pr.requestType);
        setPurchaseType(
          pr.purchaseType === 'work_order' || pr.purchaseType === 'Work Order'
            ? 'work_order'
            : 'purchase_order'
        );
        setVendorSelection(pr.vendorSelection === 'own' ? 'own' : 'scm');
        setPriority(pr.priority);
        setBusinessJustification(pr.justification || '');
        setRequiredDate(pr.requiredDate || '');
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
                id: String(item.id ?? i + 1),
                itemId: null,
                itemName: item.description,
                description: item.description,
                quantity: item.quantity,
                estimatedCost: item.unitCost,
                category: item.category,
                hsnCode: '',
                gstPercentage: 18,
              }))
            : [{ id: '1', itemId: null, itemName: '', description: '', quantity: 1, estimatedCost: 0, category: '', hsnCode: '', gstPercentage: 18 }]
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load PR');
      } finally {
        setIsLoadingPr(false);
      }
    })();
  }, [editPrId]);

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
            const match = items.find(
              (m) =>
                m.name.toLowerCase() === (row.itemName || row.description || '').toLowerCase()
            );
            if (!match) return row;
            return {
              ...row,
              itemId: match.id,
              itemName: match.name,
              description: row.description || match.description || match.name,
              category: row.category || match.categoryName || '',
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

  const categoryOptions = useMemo(() => {
    return masterCategories.map((c) => c.name);
  }, [masterCategories]);

  const priorityOptions = ['Low', 'Medium', 'High', 'Critical'];

  const getTotalAmount = () =>
    lineItems.reduce((sum, item) => sum + item.quantity * item.estimatedCost, 0);

  const addLineItem = () => {
    const newId = Date.now().toString();
    setLineItems([
      ...lineItems,
      {
        id: newId,
        itemId: null,
        itemName: '',
        description: '',
        quantity: 1,
        estimatedCost: 0,
        category: '',
        hsnCode: '',
        gstPercentage: 18,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number | null) => {
    setLineItems(lineItems.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const selectMasterItem = (lineId: string, itemIdValue: string) => {
    if (!itemIdValue) {
      setLineItems((prev) =>
        prev.map((row) =>
          row.id === lineId
            ? { ...row, itemId: null, itemName: '', description: '', hsnCode: '', gstPercentage: 18 }
            : row
        )
      );
      return;
    }
    const master = masterItems.find((m) => String(m.id) === itemIdValue);
    if (!master) return;
    setLineItems((prev) =>
      prev.map((row) =>
        row.id === lineId
          ? {
              ...row,
              itemId: master.id,
              itemName: master.name,
              description: master.description || master.name,
              category: master.categoryName || row.category,
              hsnCode: master.hsnCode || '',
              gstPercentage: Number(master.gstPercentage ?? 18),
            }
          : row
      )
    );
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
    const newFiles: AttachedFile[] = files.map(f => ({ id: Math.random().toString(36).substr(2, 9), name: f.name, size: f.size }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
  };
  const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!entityId) newErrors.entityId = 'Entity is required';
    if (!department) newErrors.department = 'Department is required';
    if (!businessJustification.trim()) newErrors.businessJustification = 'Business justification is required';
    if (!requiredDate) newErrors.requiredDate = 'Required date is required';
    lineItems.forEach((item, index) => {
      if (!item.itemId && !item.description.trim()) {
        newErrors[`item_${index}_description`] = 'Select an item from Item Master';
      } else if (!item.description.trim()) {
        newErrors[`item_${index}_description`] = 'Item description is required';
      }
      if (!item.category) newErrors[`item_${index}_category`] = 'Category is required';
      if (item.quantity <= 0) newErrors[`item_${index}_quantity`] = 'Quantity must be > 0';
      if (item.estimatedCost <= 0) newErrors[`item_${index}_cost`] = 'Cost must be > 0';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = async () => {
    setSubmitAction('draft');
    await savePR(false);
  };

  const handleSubmitPR = () => {
    if (validateForm()) {
      setSubmitAction('submit');
      setShowConfirmModal(true);
    }
  };

  const buildPayload = () => ({
    title: lineItems[0]?.description || `${requestType} Request`,
    requestType,
    purchaseType,
    department,
    entityId: entityId ? Number(entityId) : undefined,
    priority,
    vendorSelection,
    justification: businessJustification,
    requiredDate: requiredDate || undefined,
    lineItems: lineItems.map((item) => ({
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unitCost: item.estimatedCost,
    })),
  });

  const savePR = async (submit: boolean) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEditMode && editPrId) {
        if (submit) {
          await prApi.resubmit(editPrId, { ...payload, remarks: resubmitRemarks });
        } else {
          await prApi.update(editPrId, payload);
        }
        setCreatedPrNumber(prNumber);
        if (submit) setShowConfirmModal(false);
        setShowSuccessModal(true);
        return;
      }
      const res = await prApi.create({ ...payload, submit });
      const data = res.data as { prNumber: string };
      setCreatedPrNumber(data.prNumber);
      if (submit) setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save PR');
    } finally {
      setIsSubmitting(false);
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
            <Link to="/requester/dashboard" className="text-sm font-medium text-red-800 hover:underline">
              Back to Dashboard
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
              <Link to="/requester/dashboard" className="hover:text-white transition-colors cursor-pointer">Dashboard</Link>
              <i className="ri-arrow-right-s-line"></i>
              <span className="text-slate-300">
                {isEditMode ? (isReturned ? 'Edit & Resubmit PR' : 'Edit Purchase Requisition') : 'Create Purchase Requisition'}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {isEditMode ? (isReturned ? 'Edit & Resubmit PR' : 'Edit Purchase Requisition') : 'New Purchase Requisition'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isReturned
                ? 'Update the fields based on feedback, then resubmit for approval'
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
                  ₹{getTotalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <span className="text-xs text-gray-400">
            {lineItems.filter(i => i.description && i.estimatedCost > 0).length}/{lineItems.length} items filled
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
                  Review the feedback below, update the form fields, then resubmit for HOD approval.
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

            {/* Entity */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Entity <span className="text-red-500">*</span>
              </label>
              <select
                value={entityId === '' ? '' : String(entityId)}
                onChange={(e) => setEntityId(e.target.value ? Number(e.target.value) : '')}
                disabled={isEditMode}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer disabled:bg-gray-50 disabled:cursor-not-allowed ${errors.entityId ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              >
                <option value="">Select Entity</option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.code ? `${ent.code} — ${ent.name}` : ent.name}
                    {ent.costCenter ? ` (${ent.costCenter})` : ''}
                  </option>
                ))}
              </select>
              {errors.entityId && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>
                  {errors.entityId}
                </p>
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
                    disabled={isEditMode}
                    onClick={() => setPurchaseType(opt.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
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
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer ${errors.department ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                    {d.code ? ` (${d.code})` : ''}
                  </option>
                ))}
              </select>
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

            {/* Request Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Request Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {(['Capex', 'Opex', 'Service'] as const).map(type => (
                  <button
                    key={type}
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

            {/* Vendor Selection */}
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
                {vendorSelection === 'own'
                  ? 'Flow: L1 → your RFQ entry → L1 vendor final → L2 → (optional CFO) → SCM Final RFQ → Create PO → SCM Manager sign-off.'
                  : 'Flow: L1 → L2 → CFO → SCM RFQ entry → SCM Manager vendor approval → Create PO → SCM Manager sign-off.'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Line Items ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
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
              onClick={addLineItem}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              Add Item
            </button>
          </div>

          <div className="p-6 space-y-4">
            {lineItems.map((item, index) => (
              <div key={item.id} className="relative border border-gray-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors">
                {/* Item header */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-slate-800 text-white text-xs font-bold rounded-full">{index + 1}</span>
                    <span className="text-xs font-semibold text-slate-600">
                      {item.itemName || item.description || `Item ${index + 1}`}
                    </span>
                    {item.quantity > 0 && item.estimatedCost > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        ₹{(item.quantity * item.estimatedCost).toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-sm"></i>
                    </button>
                  )}
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Item Name from Item Master */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={item.itemId ? String(item.itemId) : ''}
                      onChange={(e) => selectMasterItem(item.id, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer ${
                        errors[`item_${index}_description`] ? 'border-red-400' : 'border-gray-200'
                      }`}
                    >
                      <option value="">Select Item</option>
                      {masterItems.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}{m.itemCode ? ` (${m.itemCode})` : ''}
                        </option>
                      ))}
                    </select>
                    {masterItems.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">No items in Item Master. Add items under Masters → Item Master.</p>
                    )}
                    {errors[`item_${index}_description`] && (
                      <p className="text-xs text-red-500 mt-1">{errors[`item_${index}_description`]}</p>
                    )}
                  </div>

                  {/* Category from Category Master */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Category <span className="text-red-500">*</span></label>
                    <select
                      value={item.category}
                      onChange={e => updateLineItem(item.id, 'category', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white cursor-pointer ${errors[`item_${index}_category`] ? 'border-red-400' : 'border-gray-200'}`}
                    >
                      <option value="">Select Category</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {item.category && !categoryOptions.includes(item.category) && (
                        <option value={item.category}>{item.category}</option>
                      )}
                    </select>
                    {errors[`item_${index}_category`] && <p className="text-xs text-red-500 mt-1">{errors[`item_${index}_category`]}</p>}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Quantity <span className="text-red-500">*</span></label>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateLineItem(item.id, 'quantity', Math.max(1, item.quantity - 1))}
                        className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                      >
                        <i className="ri-subtract-line text-sm"></i>
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                        className="flex-1 px-2 py-2 text-center text-sm focus:outline-none border-x border-gray-200"
                      />
                      <button
                        onClick={() => updateLineItem(item.id, 'quantity', item.quantity + 1)}
                        className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                      >
                        <i className="ri-add-line text-sm"></i>
                      </button>
                    </div>
                  </div>

                  {/* Unit Cost */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Unit Cost (₹) <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">₹</span>
                      <input
                        type="number"
                        value={item.estimatedCost || ''}
                        onChange={e => updateLineItem(item.id, 'estimatedCost', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full pl-7 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors[`item_${index}_cost`] ? 'border-red-400' : 'border-gray-200'}`}
                      />
                    </div>
                    {errors[`item_${index}_cost`] && <p className="text-xs text-red-500 mt-1">{errors[`item_${index}_cost`]}</p>}
                  </div>

                  {/* HSN */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">HSN Code</label>
                    <input
                      type="text"
                      value={item.hsnCode || ''}
                      readOnly
                      placeholder="From Item Master"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                    />
                  </div>

                  {/* GST */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">GST %</label>
                    <input
                      type="text"
                      value={item.gstPercentage != null ? `${item.gstPercentage}%` : '—'}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-700"
                    />
                  </div>

                  {/* Line Total */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Line Total</label>
                    <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <span className="text-sm font-bold text-emerald-700">
                        ₹{(item.quantity * item.estimatedCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Description (auto from item master, editable) */}
                  <div className="md:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Item Description <span className="text-red-500">*</span></label>
                    <textarea
                      value={item.description}
                      onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                      rows={2}
                      placeholder="Select an item to auto-fill description, or enter manually..."
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none ${errors[`item_${index}_description`] ? 'border-red-400' : 'border-gray-200'}`}
                    />
                  </div>
                </div>
              </div>
            ))}
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
                  <p className="text-xs text-gray-500 mb-0.5">Total Qty</p>
                  <p className="text-lg font-bold text-gray-800">{lineItems.reduce((s, i) => s + i.quantity, 0)}</p>
                </div>
                <div className="w-px h-8 bg-emerald-200"></div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-0.5">Avg Unit Cost</p>
                  <p className="text-lg font-bold text-gray-800">
                    ₹{lineItems.length > 0 ? (lineItems.reduce((s, i) => s + i.estimatedCost, 0) / lineItems.length).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">Total Estimated Amount</p>
                  <p className="text-2xl font-extrabold text-emerald-700">
                    ₹{getTotalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-500 rounded-xl">
                  <i className="ri-money-dollar-circle-line text-white text-xl"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Business Justification ── */}
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

        {/* ── Section 4: Attachments ── */}
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
              <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
            </div>

            {attachedFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {attachedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white transition-colors">
                    <div className="w-9 h-9 flex items-center justify-center bg-slate-100 rounded-lg flex-shrink-0">
                      <i className="ri-file-text-line text-slate-600 text-sm"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <i className="ri-shield-check-line text-emerald-500"></i>
            <span>All data is saved securely</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/requester/dashboard"
              className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Cancel
            </Link>
            <button
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-save-line"></i>
              Save Draft
            </button>
            <button
              onClick={handleSubmitPR}
              className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl transition-colors text-sm font-semibold cursor-pointer whitespace-nowrap shadow-sm ${
                isResubmitFlow ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-800 hover:bg-slate-700'
              }`}
            >
              <i className={isResubmitFlow ? 'ri-refresh-line' : 'ri-send-plane-fill'}></i>
              {isResubmitFlow ? 'Resubmit PR' : 'Submit PR'}
            </button>
          </div>
        </div>
      </div>

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
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-sm text-amber-800">
                <i className="ri-information-line mr-1"></i>
                {isResubmitFlow
                  ? 'Your updated PR will be sent to HOD for approval again.'
                  : <>Once submitted, this PR will be sent for HOD approval and <strong>cannot be edited</strong>.</>}
              </p>
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
                ₹{getTotalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                {submitAction === 'draft'
                  ? 'Changes Saved!'
                  : isResubmitFlow
                  ? 'PR Resubmitted Successfully!'
                  : 'PR Submitted Successfully!'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {submitAction === 'draft'
                  ? `${createdPrNumber || prNumber} saved. You can continue editing later.`
                  : `${createdPrNumber || prNumber} has been ${isResubmitFlow ? 'resubmitted' : 'submitted'} and is pending HOD approval.`}
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
                  <span className="font-bold text-emerald-700">₹{getTotalAmount().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Next Step</span>
                  <span className="font-medium text-amber-600">HOD Approval</span>
                </div>
              </div>
            )}
            <button
              onClick={() => { setShowSuccessModal(false); window.REACT_APP_NAVIGATE('/requester/dashboard'); }}
              className="w-full py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700 text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      </>
      )}
    </DashboardLayout>
  );
}
