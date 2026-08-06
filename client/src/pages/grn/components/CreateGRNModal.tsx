import { useState, useMemo, useEffect, useCallback } from 'react';
import { poApi } from '../../../services/api';

interface CreateGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewGRNData) => void;
  initialPoNumber?: string;
  initialPoId?: number;
}

export interface NewGRNLineItem {
  id: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice: number;
  condition: 'Good' | 'Damaged' | 'Pending Inspection';
  remarks: string;
}

export interface NewGRNData {
  grnNumber: string;
  poNumber: string;
  vendor: string;
  prId: string;
  prTitle: string;
  department: string;
  requester: string;
  paymentTerms: string;
  deliveryAddress: string;
  receivedBy: string;
  inspectedBy: string;
  receivedDate: string;
  expectedDeliveryDate: string;
  lineItems: NewGRNLineItem[];
  remarks: string;
  subtotal: number;
  gstPercentage: number;
  taxAmount: number;
  grandTotal: number;
}

type ApprovedPo = {
  id?: number;
  poNumber: string;
  vendor: string;
  prId: string;
  prTitle: string;
  department: string;
  requester: string;
  paymentTerms: string;
  deliveryAddress: string;
  expectedDeliveryDate: string;
  gstPercentage: number;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  vendorAcceptanceStatus?: string | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
};

type ApiPo = {
  id: number;
  poNumber: string;
  vendorName?: string;
  prNumber?: string;
  prTitle?: string;
  department?: string;
  requester?: string;
  paymentTerms?: string;
  deliveryAddress?: string;
  expectedDeliveryDate?: string;
  gstPercentage?: number;
  subtotal?: number;
  taxAmount?: number;
  grandTotal?: number;
  vendorAcceptanceStatus?: string | null;
  lineItems?: Array<{
    id?: string | number;
    description?: string;
    itemName?: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
};

function mapApiPo(p: ApiPo): ApprovedPo {
  return {
    id: p.id,
    poNumber: p.poNumber,
    vendor: p.vendorName || '',
    prId: p.prNumber || '',
    prTitle: p.prTitle || '',
    department: p.department || '',
    requester: p.requester || '',
    paymentTerms: p.paymentTerms || '',
    deliveryAddress: p.deliveryAddress || '',
    expectedDeliveryDate: p.expectedDeliveryDate || '',
    gstPercentage: Number(p.gstPercentage) || 18,
    subtotal: Number(p.subtotal) || 0,
    taxAmount: Number(p.taxAmount) || 0,
    grandTotal: Number(p.grandTotal) || 0,
    vendorAcceptanceStatus: p.vendorAcceptanceStatus || null,
    lineItems: (p.lineItems || []).map((li, idx) => ({
      id: String(li.id || idx + 1),
      description: String(li.itemName || li.description || `Item ${idx + 1}`)
        .replace(/<[^>]+>/g, ' ')
        .trim(),
      quantity: Number(li.quantity) || 0,
      unitPrice: Number(li.unitPrice) || 0,
      total: Number(li.total) || 0,
    })),
  };
}

const ALL_STEPS = ['Select PO', 'Receipt Details', 'Line Items', 'Review & Submit'] as const;
const LOCKED_STEPS = ['Receipt Details', 'Line Items', 'Review & Submit'] as const;

export default function CreateGRNModal({
  isOpen,
  onClose,
  onSubmit,
  initialPoNumber,
  initialPoId,
}: CreateGRNModalProps) {
  const lockedFromPo = Boolean(initialPoId || initialPoNumber);
  const steps = lockedFromPo ? [...LOCKED_STEPS] : [...ALL_STEPS];

  const [step, setStep] = useState(0);
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [poSearch, setPOSearch] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [inspectedBy, setInspectedBy] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [generalRemarks, setGeneralRemarks] = useState('');
  const [lineItems, setLineItems] = useState<NewGRNLineItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [approvedPOs, setApprovedPOs] = useState<ApprovedPo[]>([]);
  const [lockedPo, setLockedPo] = useState<ApprovedPo | null>(null);
  const [loadingPo, setLoadingPo] = useState(false);
  const [loadError, setLoadError] = useState('');

  const applyPoSelection = useCallback((po: ApprovedPo) => {
    setSelectedPO(po.poNumber);
    setDeliveryAddress(po.deliveryAddress || '');
    setLineItems(
      po.lineItems.map((item) => ({
        id: item.id,
        description: item.description,
        orderedQty: item.quantity,
        receivedQty: item.quantity,
        unitPrice: item.unitPrice,
        condition: 'Good' as const,
        remarks: '',
      }))
    );
  }, []);

  const handleReset = useCallback(() => {
    setStep(0);
    setSelectedPO('');
    setPOSearch('');
    setReceivedBy('');
    setInspectedBy('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setDeliveryAddress('');
    setGeneralRemarks('');
    setLineItems([]);
    setErrors({});
    setLockedPo(null);
    setLoadError('');
    setLoadingPo(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingPo(true);
      setLoadError('');
      try {
        if (initialPoId || initialPoNumber) {
          let raw: ApiPo | null = null;
          if (initialPoId) {
            const res = await poApi.get(initialPoId);
            raw = res.data as ApiPo;
          } else if (initialPoNumber) {
            const res = await poApi.getByNumber(initialPoNumber);
            raw = res.data as ApiPo;
          }
          if (cancelled || !raw) return;
          const mapped = mapApiPo(raw);
          setLockedPo(mapped);
          setApprovedPOs([mapped]);
          applyPoSelection(mapped);
          setStep(0);
        } else {
          const res = await poApi.listVendorAcceptance();
          const accepted = ((res.data as ApiPo[]) || [])
            .filter(
              (p) => p.vendorAcceptanceStatus === 'accepted' || p.vendorAcceptanceStatus === 'partial'
            )
            .map(mapApiPo);
          if (cancelled) return;
          setApprovedPOs(accepted);
          setLockedPo(null);
          setStep(0);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load PO data');
          setApprovedPOs([]);
          setLockedPo(null);
        }
      } finally {
        if (!cancelled) setLoadingPo(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialPoId, initialPoNumber, applyPoSelection, handleReset]);

  const filteredPOs = useMemo(() => {
    if (!poSearch.trim()) return approvedPOs;
    const q = poSearch.toLowerCase();
    return approvedPOs.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.prTitle.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
    );
  }, [approvedPOs, poSearch]);

  const selectedPOData = useMemo(() => {
    if (lockedPo) return lockedPo;
    return approvedPOs.find((p) => p.poNumber === selectedPO) || null;
  }, [selectedPO, approvedPOs, lockedPo]);

  /** 0=select (unlocked only), 1=receipt, 2=lines, 3=review */
  const contentStep = lockedFromPo ? step + 1 : step;

  const handleSelectPO = (poNumber: string) => {
    const po = approvedPOs.find((p) => p.poNumber === poNumber);
    if (po) applyPoSelection(po);
  };

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    if (contentStep === 0 && !selectedPO) {
      newErrors.po = 'Please select a PO to proceed.';
    }
    if (contentStep === 1) {
      if (!receivedBy.trim()) newErrors.receivedBy = 'Received By is required.';
      if (!receivedDate) newErrors.receivedDate = 'Received Date is required.';
      if (!deliveryAddress.trim()) newErrors.deliveryAddress = 'Delivery Address is required.';
    }
    if (contentStep === 2) {
      lineItems.forEach((item, idx) => {
        if (item.receivedQty < 0) newErrors[`qty_${idx}`] = 'Cannot be negative.';
        if (item.receivedQty > item.orderedQty) newErrors[`qty_${idx}`] = 'Cannot exceed ordered qty.';
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep((s) => s + 1);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleBack = () => {
    setErrors({});
    if (lockedFromPo && step === 0) {
      handleClose();
      return;
    }
    setStep((s) => s - 1);
  };

  const handleLineItemChange = (
    idx: number,
    field: keyof NewGRNLineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const computedSubtotal = useMemo(
    () => lineItems.reduce((s, item) => s + item.receivedQty * item.unitPrice, 0),
    [lineItems]
  );
  const gstPct = selectedPOData?.gstPercentage ?? 18;
  const computedTax = Math.round(computedSubtotal * (gstPct / 100));
  const computedGrandTotal = computedSubtotal + computedTax;

  const generateGRNNumber = () => {
    const num = Math.floor(Math.random() * 900) + 100;
    return `GRN-${new Date().getFullYear()}-0${num}`;
  };

  const handleSubmit = () => {
    if (!selectedPOData) return;
    const newGRN: NewGRNData = {
      grnNumber: generateGRNNumber(),
      poNumber: selectedPOData.poNumber,
      vendor: selectedPOData.vendor,
      prId: selectedPOData.prId,
      prTitle: selectedPOData.prTitle,
      department: selectedPOData.department,
      requester: selectedPOData.requester,
      paymentTerms: selectedPOData.paymentTerms,
      deliveryAddress,
      receivedBy,
      inspectedBy,
      receivedDate,
      expectedDeliveryDate: selectedPOData.expectedDeliveryDate,
      lineItems,
      remarks: generalRemarks,
      subtotal: computedSubtotal,
      gstPercentage: gstPct,
      taxAmount: computedTax,
      grandTotal: computedGrandTotal,
    };
    onSubmit(newGRN);
    handleReset();
    onClose();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      amount || 0
    );

  const OriginalPoPanel = ({ po }: { po: ApprovedPo }) => (
    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <i className="ri-file-list-3-line text-teal-600 text-sm"></i>
          <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">
            Original PO Data
          </span>
        </div>
        {po.vendorAcceptanceStatus ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 capitalize">
            Vendor {po.vendorAcceptanceStatus}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">PO Number</p>
          <p className="font-bold text-teal-700">{po.poNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">PR</p>
          <p className="font-semibold text-gray-900">{po.prId || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Vendor</p>
          <p className="font-semibold text-gray-900">{po.vendor || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Department</p>
          <p className="font-medium text-gray-800">{po.department || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Requester</p>
          <p className="font-medium text-gray-800">{po.requester || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Payment Terms</p>
          <p className="font-medium text-gray-800">{po.paymentTerms || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Expected Delivery</p>
          <p className="font-medium text-gray-800">{po.expectedDeliveryDate || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Line Items</p>
          <p className="font-medium text-gray-800">{po.lineItems.length}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Grand Total</p>
          <p className="font-bold text-gray-900">{formatCurrency(po.grandTotal)}</p>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs text-gray-500">Title</p>
          <p className="font-medium text-gray-900">{po.prTitle || '—'}</p>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <p className="text-xs text-gray-500">Delivery Address (from PO)</p>
          <p className="font-medium text-gray-800">{po.deliveryAddress || '—'}</p>
        </div>
      </div>
      {po.lineItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-teal-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-1 pr-2">#</th>
                <th className="pb-1 pr-2">Item</th>
                <th className="pb-1 pr-2">Qty</th>
                <th className="pb-1 pr-2">Unit Price</th>
                <th className="pb-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((li, idx) => (
                <tr key={li.id} className="border-t border-teal-50">
                  <td className="py-1.5 pr-2 text-gray-500">{idx + 1}</td>
                  <td
                    className="py-1.5 pr-2 font-medium text-gray-800 max-w-[220px] truncate"
                    title={li.description}
                  >
                    {li.description}
                  </td>
                  <td className="py-1.5 pr-2">{li.quantity}</td>
                  <td className="py-1.5 pr-2">{formatCurrency(li.unitPrice)}</td>
                  <td className="py-1.5 font-semibold">{formatCurrency(li.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-truck-line text-white text-xl"></i>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">
                  {lockedFromPo ? 'Enter GRN' : 'Create New GRN'}
                </h2>
                <p className="text-teal-100 text-xs mt-0.5">
                  {lockedFromPo && selectedPOData
                    ? `Using original PO ${selectedPOData.poNumber} — Step ${step + 1} of ${steps.length}`
                    : `Goods Receipt Note — Step ${step + 1} of ${steps.length}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-white text-lg"></i>
            </button>
          </div>

          <div className="flex items-center gap-2 mt-5">
            {steps.map((label, idx) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      idx < step
                        ? 'bg-white text-teal-600'
                        : idx === step
                          ? 'bg-white text-teal-600 ring-2 ring-white/50'
                          : 'bg-white/20 text-white/60'
                    }`}
                  >
                    {idx < step ? <i className="ri-check-line text-sm"></i> : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium whitespace-nowrap hidden sm:block ${
                      idx <= step ? 'text-white' : 'text-white/50'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 rounded-full mx-1 ${idx < step ? 'bg-white' : 'bg-white/20'}`}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loadingPo && (
            <div className="text-center py-16 text-gray-400">
              <i className="ri-loader-4-line text-4xl block mb-2 animate-spin"></i>
              <p className="text-sm">Loading original PO data…</p>
            </div>
          )}

          {!loadingPo && loadError && (
            <div className="text-center py-12">
              <i className="ri-error-warning-line text-4xl text-red-300 block mb-2"></i>
              <p className="text-sm text-red-600 font-medium">{loadError}</p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-4 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg"
              >
                Close
              </button>
            </div>
          )}

          {!loadingPo && !loadError && contentStep === 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Select Vendor-Accepted Purchase Order</h3>
              <p className="text-sm text-gray-500 mb-4">
                Only POs accepted (or partially accepted) by the vendor are available for GRN.
              </p>

              <div className="relative mb-4">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by PO number, vendor, title..."
                  value={poSearch}
                  onChange={(e) => setPOSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>

              {errors.po && (
                <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>
                  {errors.po}
                </p>
              )}

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredPOs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <i className="ri-file-search-line text-4xl block mb-2"></i>
                    <p className="text-sm">No vendor-accepted POs found</p>
                  </div>
                ) : (
                  filteredPOs.map((po) => (
                    <div
                      key={po.poNumber}
                      onClick={() => handleSelectPO(po.poNumber)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                        selectedPO === po.poNumber
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-teal-600">{po.poNumber}</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{po.prTitle}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {po.vendor} · {po.department} · {po.lineItems.length} items
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(po.grandTotal)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {!loadingPo && !loadError && contentStep === 1 && selectedPOData && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Receipt Details</h3>
              <p className="text-sm text-gray-500 mb-5">
                Original PO is loaded below. Enter receipt information for this delivery.
              </p>

              <OriginalPoPanel po={selectedPOData} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Received By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${
                      errors.receivedBy ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="Name of receiver"
                  />
                  {errors.receivedBy && <p className="text-xs text-red-500 mt-1">{errors.receivedBy}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Inspected By</label>
                  <input
                    type="text"
                    value={inspectedBy}
                    onChange={(e) => setInspectedBy(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Received Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${
                      errors.receivedDate ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {errors.receivedDate && <p className="text-xs text-red-500 mt-1">{errors.receivedDate}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${
                      errors.deliveryAddress ? 'border-red-300' : 'border-gray-200'
                    }`}
                  />
                  {errors.deliveryAddress && (
                    <p className="text-xs text-red-500 mt-1">{errors.deliveryAddress}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Remarks</label>
                  <textarea
                    value={generalRemarks}
                    onChange={(e) => setGeneralRemarks(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                    placeholder="Optional remarks"
                  />
                </div>
              </div>
            </div>
          )}

          {!loadingPo && !loadError && contentStep === 2 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Line Items Receipt</h3>
              <p className="text-sm text-gray-500 mb-5">
                Quantities are prefilled from the original PO. Adjust received qty if needed.
              </p>
              {selectedPOData && <OriginalPoPanel po={selectedPOData} />}

              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Ordered: {item.orderedQty} · Unit: {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.receivedQty * item.unitPrice)}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Received Qty</label>
                        <input
                          type="number"
                          min={0}
                          max={item.orderedQty}
                          value={item.receivedQty}
                          onChange={(e) =>
                            handleLineItemChange(idx, 'receivedQty', Number(e.target.value))
                          }
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${
                            errors[`qty_${idx}`] ? 'border-red-300' : 'border-gray-200'
                          }`}
                        />
                        {errors[`qty_${idx}`] && (
                          <p className="text-xs text-red-500 mt-1">{errors[`qty_${idx}`]}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Condition</label>
                        <select
                          value={item.condition}
                          onChange={(e) =>
                            handleLineItemChange(
                              idx,
                              'condition',
                              e.target.value as NewGRNLineItem['condition']
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                          <option value="Good">Good</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Pending Inspection">Pending Inspection</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks</label>
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={(e) => handleLineItemChange(idx, 'remarks', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {!lineItems.length && (
                  <p className="text-center text-sm text-gray-400 py-8">No line items on this PO</p>
                )}
              </div>
            </div>
          )}

          {!loadingPo && !loadError && contentStep === 3 && selectedPOData && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Review & Submit</h3>
              <p className="text-sm text-gray-500 mb-5">Confirm GRN details before submitting.</p>

              <OriginalPoPanel po={selectedPOData} />

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Received By</p>
                  <p className="font-semibold">{receivedBy}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Received Date</p>
                  <p className="font-semibold">{receivedDate}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Inspected By</p>
                  <p className="font-semibold">{inspectedBy || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Delivery Address</p>
                  <p className="font-semibold">{deliveryAddress}</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Item</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Ordered</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Received</th>
                      <th className="px-3 py-2 text-left text-xs text-gray-500">Condition</th>
                      <th className="px-3 py-2 text-right text-xs text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id} className="border-t">
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2">{item.orderedQty}</td>
                        <td className="px-3 py-2 font-semibold">{item.receivedQty}</td>
                        <td className="px-3 py-2">{item.condition}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatCurrency(item.receivedQty * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(computedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST ({gstPct}%)</span>
                  <span className="font-semibold">{formatCurrency(computedTax)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-teal-200">
                  <span>Grand Total</span>
                  <span className="text-teal-600">{formatCurrency(computedGrandTotal)}</span>
                </div>
              </div>

              {generalRemarks && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Remarks</p>
                  <p className="text-sm text-gray-700">{generalRemarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            onClick={step === 0 && !lockedFromPo ? handleClose : handleBack}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <i className={step === 0 ? 'ri-close-line' : 'ri-arrow-left-line'}></i>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              Step {step + 1} / {steps.length}
            </span>
            {!loadingPo && !loadError && step < steps.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={contentStep === 0 && !selectedPO}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
              >
                Next <i className="ri-arrow-right-line"></i>
              </button>
            ) : !loadingPo && !loadError ? (
              <button
                onClick={handleSubmit}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-check-double-line"></i> Submit GRN
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
