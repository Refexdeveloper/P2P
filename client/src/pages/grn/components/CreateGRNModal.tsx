
import { useState, useMemo } from 'react';
import { poData } from '../../../mocks/po-data';

interface CreateGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewGRNData) => void;
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

const STEPS = ['Select PO', 'Receipt Details', 'Line Items', 'Review & Submit'];

export default function CreateGRNModal({ isOpen, onClose, onSubmit }: CreateGRNModalProps) {
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

  const approvedPOs = useMemo(
    () => poData.filter(p => p.status === 'PO Approved'),
    []
  );

  const filteredPOs = useMemo(() => {
    if (!poSearch.trim()) return approvedPOs;
    const q = poSearch.toLowerCase();
    return approvedPOs.filter(
      p =>
        p.poNumber.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.prTitle.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q)
    );
  }, [approvedPOs, poSearch]);

  const selectedPOData = useMemo(
    () => poData.find(p => p.poNumber === selectedPO) || null,
    [selectedPO]
  );

  const handleSelectPO = (poNumber: string) => {
    setSelectedPO(poNumber);
    const po = poData.find(p => p.poNumber === poNumber);
    if (po) {
      setDeliveryAddress(po.deliveryAddress);
      setLineItems(
        po.lineItems.map(item => ({
          id: item.id,
          description: item.description,
          orderedQty: item.quantity,
          receivedQty: item.quantity,
          unitPrice: item.unitPrice,
          condition: 'Good' as const,
          remarks: '',
        }))
      );
    }
  };

  const validateStep = () => {
    const newErrors: Record<string, string> = {};
    if (step === 0 && !selectedPO) {
      newErrors.po = 'Please select a PO to proceed.';
    }
    if (step === 1) {
      if (!receivedBy.trim()) newErrors.receivedBy = 'Received By is required.';
      if (!receivedDate) newErrors.receivedDate = 'Received Date is required.';
      if (!deliveryAddress.trim()) newErrors.deliveryAddress = 'Delivery Address is required.';
    }
    if (step === 2) {
      lineItems.forEach((item, idx) => {
        if (item.receivedQty < 0) newErrors[`qty_${idx}`] = 'Cannot be negative.';
        if (item.receivedQty > item.orderedQty) newErrors[`qty_${idx}`] = 'Cannot exceed ordered qty.';
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleLineItemChange = (
    idx: number,
    field: keyof NewGRNLineItem,
    value: string | number
  ) => {
    setLineItems(prev =>
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
    return `GRN-2024-0${num}`;
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
  };

  const handleReset = () => {
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
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-add-circle-line text-white text-xl"></i>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Create New GRN</h2>
                <p className="text-teal-100 text-xs mt-0.5">Goods Receipt Note — Step {step + 1} of {STEPS.length}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-white text-lg"></i>
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-5">
            {STEPS.map((label, idx) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    idx < step ? 'bg-white text-teal-600' :
                    idx === step ? 'bg-white text-teal-600 ring-2 ring-white/50' :
                    'bg-white/20 text-white/60'
                  }`}>
                    {idx < step ? <i className="ri-check-line text-sm"></i> : idx + 1}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap hidden sm:block ${idx <= step ? 'text-white' : 'text-white/50'}`}>
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full mx-1 ${idx < step ? 'bg-white' : 'bg-white/20'}`}></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 0: Select PO */}
          {step === 0 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Select Approved Purchase Order</h3>
              <p className="text-sm text-gray-500 mb-4">Only POs with status "PO Approved" are available for GRN creation.</p>

              <div className="relative mb-4">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by PO number, vendor, title..."
                  value={poSearch}
                  onChange={e => setPOSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                />
              </div>

              {errors.po && (
                <p className="text-xs text-red-500 mb-3 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>{errors.po}
                </p>
              )}

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredPOs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <i className="ri-file-search-line text-4xl block mb-2"></i>
                    <p className="text-sm">No approved POs found</p>
                  </div>
                ) : (
                  filteredPOs.map(po => (
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
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            selectedPO === po.poNumber ? 'border-teal-500 bg-teal-500' : 'border-gray-300'
                          }`}>
                            {selectedPO === po.poNumber && <i className="ri-check-line text-white text-xs"></i>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-teal-600">{po.poNumber}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{po.prId}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{po.prTitle}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <i className="ri-store-2-line"></i>{po.vendor}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <i className="ri-building-line"></i>{po.department}
                              </span>
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <i className="ri-calendar-line"></i>Delivery: {po.expectedDeliveryDate}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-gray-900">
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(po.grandTotal)}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 1: Receipt Details */}
          {step === 1 && selectedPOData && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Receipt Details</h3>
              <p className="text-sm text-gray-500 mb-5">Enter the receipt information for this delivery.</p>

              {/* PO Summary */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-file-text-line text-teal-600 text-sm"></i>
                  <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Selected PO</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">PO Number</p>
                    <p className="text-sm font-bold text-teal-600">{selectedPOData.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Vendor</p>
                    <p className="text-sm font-semibold text-gray-900">{selectedPOData.vendor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Grand Total</p>
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedPOData.grandTotal)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Received By <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={receivedBy}
                    onChange={e => setReceivedBy(e.target.value)}
                    placeholder="e.g. Anand Pillai"
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${errors.receivedBy ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors.receivedBy && <p className="text-xs text-red-500 mt-1">{errors.receivedBy}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Inspected By <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={inspectedBy}
                    onChange={e => setInspectedBy(e.target.value)}
                    placeholder="e.g. Ritu Sharma"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Received Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={e => setReceivedDate(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${errors.receivedDate ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors.receivedDate && <p className="text-xs text-red-500 mt-1">{errors.receivedDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Expected Delivery Date
                  </label>
                  <input
                    type="text"
                    value={selectedPOData.expectedDeliveryDate}
                    readOnly
                    className="w-full border border-gray-100 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none ${errors.deliveryAddress ? 'border-red-400' : 'border-gray-200'}`}
                  />
                  {errors.deliveryAddress && <p className="text-xs text-red-500 mt-1">{errors.deliveryAddress}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    General Remarks <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={generalRemarks}
                    onChange={e => setGeneralRemarks(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Any general notes about this receipt..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
                  />
                  <p className="text-xs text-gray-400 text-right mt-1">{generalRemarks.length}/500</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Line Items */}
          {step === 2 && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Line Items — Received Quantities</h3>
              <p className="text-sm text-gray-500 mb-4">Enter the actual received quantity and condition for each item.</p>

              <div className="space-y-3">
                {lineItems.map((item, idx) => (
                  <div key={item.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-teal-700 text-xs font-bold">{idx + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Unit Price: {formatCurrency(item.unitPrice)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Ordered Qty</label>
                        <input
                          type="number"
                          value={item.orderedQty}
                          readOnly
                          className="w-full border border-gray-100 bg-white rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">
                          Received Qty <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={item.orderedQty}
                          value={item.receivedQty}
                          onChange={e => handleLineItemChange(idx, 'receivedQty', Number(e.target.value))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 ${errors[`qty_${idx}`] ? 'border-red-400' : 'border-gray-200 bg-white'}`}
                        />
                        {errors[`qty_${idx}`] && <p className="text-xs text-red-500 mt-1">{errors[`qty_${idx}`]}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Condition</label>
                        <select
                          value={item.condition}
                          onChange={e => handleLineItemChange(idx, 'condition', e.target.value)}
                          className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 cursor-pointer"
                        >
                          <option value="Good">Good</option>
                          <option value="Damaged">Damaged</option>
                          <option value="Pending Inspection">Pending Inspection</option>
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Item Remarks (optional)</label>
                        <input
                          type="text"
                          value={item.remarks}
                          onChange={e => handleLineItemChange(idx, 'remarks', e.target.value)}
                          placeholder="Notes for this item..."
                          maxLength={200}
                          className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                        />
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Pending: <strong className={item.orderedQty - item.receivedQty > 0 ? 'text-amber-600' : 'text-gray-400'}>
                          {item.orderedQty - item.receivedQty} units
                        </strong>
                      </span>
                      <span className="text-sm font-bold text-teal-600">
                        Line Total: {formatCurrency(item.receivedQty * item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="mt-4 bg-teal-50 border border-teal-100 rounded-xl p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal (Received)</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(computedSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST ({gstPct}%)</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(computedTax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold pt-2 border-t border-teal-200">
                    <span className="text-gray-900">Grand Total</span>
                    <span className="text-teal-600">{formatCurrency(computedGrandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review & Submit */}
          {step === 3 && selectedPOData && (
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Review & Submit</h3>
              <p className="text-sm text-gray-500 mb-5">Please review all details before submitting the GRN.</p>

              {/* PO & Vendor */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-file-text-line text-teal-500"></i> PO Information
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'PO Number', value: selectedPOData.poNumber },
                      { label: 'PR Reference', value: selectedPOData.prId },
                      { label: 'Vendor', value: selectedPOData.vendor },
                      { label: 'Department', value: selectedPOData.department },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-user-line text-teal-500"></i> Receipt Details
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'Received By', value: receivedBy },
                      { label: 'Inspected By', value: inspectedBy || '—' },
                      { label: 'Received Date', value: receivedDate },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <i className="ri-map-pin-line text-teal-500"></i> Delivery Address
                </p>
                <p className="text-sm text-gray-800">{deliveryAddress}</p>
              </div>

              {/* Line Items Summary */}
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Line Items Summary</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['#', 'Description', 'Ordered', 'Received', 'Condition', 'Total'].map(h => (
                        <th key={h} className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${h === '#' ? 'text-center' : ['Ordered', 'Received', 'Total'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-500 text-center">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-900">{item.description}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{item.orderedQty}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-emerald-600 text-right">{item.receivedQty}</td>
                        <td className="px-3 py-2.5 text-xs">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.condition === 'Good' ? 'bg-emerald-100 text-emerald-700' :
                            item.condition === 'Damaged' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{item.condition}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-gray-900 text-right">{formatCurrency(item.receivedQty * item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Billing Summary */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                <div className="space-y-2">
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
              </div>

              {generalRemarks && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <i className="ri-chat-3-line"></i> Remarks
                  </p>
                  <p className="text-sm text-gray-700">{generalRemarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            onClick={step === 0 ? handleClose : handleBack}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
          >
            <i className={step === 0 ? 'ri-close-line' : 'ri-arrow-left-line'}></i>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Step {step + 1} / {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                Next <i className="ri-arrow-right-line"></i>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-check-double-line"></i> Submit GRN
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
