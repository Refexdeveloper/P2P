
import { useState, useMemo } from 'react';
import { GRNData } from '../../../mocks/grn-data';
import { poData } from '../../../mocks/po-data';

interface GRNApprovalModalProps {
  isOpen: boolean;
  grn: GRNData | null;
  onApprove: (remarks: string) => void;
  onReject: (remarks: string) => void;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

type CheckStatus = 'match' | 'mismatch' | 'partial' | 'pending';

function CheckBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { cls: string; icon: string; label: string }> = {
    match: { cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: 'ri-check-double-line', label: 'Match' },
    mismatch: { cls: 'bg-red-100 text-red-700 border border-red-200', icon: 'ri-close-circle-line', label: 'Mismatch' },
    partial: { cls: 'bg-amber-100 text-amber-700 border border-amber-200', icon: 'ri-error-warning-line', label: 'Partial' },
    pending: { cls: 'bg-gray-100 text-gray-500 border border-gray-200', icon: 'ri-time-line', label: 'Pending' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      <i className={icon}></i>{label}
    </span>
  );
}

export default function GRNApprovalModal({ isOpen, grn, onApprove, onReject, onClose }: GRNApprovalModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'items' | 'po'>('summary');
  const [remarks, setRemarks] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const po = useMemo(() => {
    if (!grn) return null;
    return poData.find(p => p.poNumber === grn.poNumber) || null;
  }, [grn]);

  const lineChecks = useMemo(() => {
    if (!grn || !po) return [];
    return grn.lineItems.map((grnItem) => {
      const poItem = po.lineItems.find(p => p.description === grnItem.description);
      const qtyMatch = poItem ? grnItem.receivedQty === poItem.quantity : false;
      const qtyPartial = poItem ? grnItem.receivedQty > 0 && grnItem.receivedQty < poItem.quantity : false;
      const priceMatch = poItem ? grnItem.unitPrice === poItem.unitPrice : false;
      const conditionOk = grnItem.condition === 'Good';

      let overallStatus: CheckStatus = 'pending';
      if (!poItem) {
        overallStatus = 'mismatch';
      } else if (qtyMatch && priceMatch && conditionOk) {
        overallStatus = 'match';
      } else if (qtyPartial || !conditionOk) {
        overallStatus = 'partial';
      } else {
        overallStatus = 'mismatch';
      }

      return {
        grnItem,
        poItem: poItem || null,
        qtyStatus: !poItem ? 'mismatch' : qtyMatch ? 'match' : qtyPartial ? 'partial' : 'mismatch' as CheckStatus,
        priceStatus: !poItem ? 'mismatch' : priceMatch ? 'match' : 'mismatch' as CheckStatus,
        conditionStatus: conditionOk ? 'match' : grnItem.condition === 'Pending Inspection' ? 'pending' : 'mismatch' as CheckStatus,
        overallStatus,
      };
    });
  }, [grn, po]);

  const summary = useMemo(() => {
    const totalItems = lineChecks.length;
    const matched = lineChecks.filter(c => c.overallStatus === 'match').length;
    const mismatched = lineChecks.filter(c => c.overallStatus === 'mismatch').length;
    const partial = lineChecks.filter(c => c.overallStatus === 'partial').length;

    const poQtyMatch = lineChecks.every(c => c.qtyStatus === 'match');
    const poQtyPartial = !poQtyMatch && lineChecks.some(c => c.qtyStatus === 'match' || c.qtyStatus === 'partial');
    const priceMatch = lineChecks.every(c => c.priceStatus === 'match');
    const conditionOk = lineChecks.every(c => c.conditionStatus === 'match');

    const qtyCheckStatus: CheckStatus = poQtyMatch ? 'match' : poQtyPartial ? 'partial' : 'mismatch';
    const priceCheckStatus: CheckStatus = priceMatch ? 'match' : 'mismatch';
    const conditionCheckStatus: CheckStatus = conditionOk ? 'match' : lineChecks.some(c => c.conditionStatus === 'pending') ? 'pending' : 'mismatch';

    const canApprove = mismatched === 0 && conditionOk;

    return { totalItems, matched, mismatched, partial, qtyCheckStatus, priceCheckStatus, conditionCheckStatus, canApprove };
  }, [lineChecks]);

  const discrepancies = useMemo(() => {
    const list: string[] = [];
    lineChecks.forEach(c => {
      if (c.qtyStatus === 'mismatch') list.push(`${c.grnItem.description}: Received qty (${c.grnItem.receivedQty}) ≠ PO qty (${c.poItem?.quantity ?? 'N/A'})`);
      if (c.qtyStatus === 'partial') list.push(`${c.grnItem.description}: Partial receipt — ${c.grnItem.receivedQty} of ${c.poItem?.quantity} received`);
      if (c.priceStatus === 'mismatch') list.push(`${c.grnItem.description}: Unit price mismatch — GRN ${formatCurrency(c.grnItem.unitPrice)} vs PO ${formatCurrency(c.poItem?.unitPrice ?? 0)}`);
      if (c.conditionStatus === 'mismatch') list.push(`${c.grnItem.description}: Condition issue — ${c.grnItem.condition}`);
      if (c.conditionStatus === 'pending') list.push(`${c.grnItem.description}: Inspection pending`);
    });
    return list;
  }, [lineChecks]);

  const handleAction = (type: 'approve' | 'reject') => {
    setAction(type);
    setConfirming(true);
  };

  const handleConfirm = () => {
    if (!remarks.trim()) return;
    if (action === 'approve') onApprove(remarks);
    else if (action === 'reject') onReject(remarks);
    setRemarks('');
    setConfirming(false);
    setAction(null);
    setActiveTab('summary');
  };

  const handleClose = () => {
    setRemarks('');
    setConfirming(false);
    setAction(null);
    setActiveTab('summary');
    onClose();
  };

  if (!isOpen || !grn) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-shield-check-line text-white text-xl"></i>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">GRN Approval — PO vs GRN Check</h2>
                <p className="text-teal-100 text-xs mt-0.5">{grn.grnNumber} · {grn.vendor} · {grn.poNumber}</p>
              </div>
            </div>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer">
              <i className="ri-close-line text-white text-lg"></i>
            </button>
          </div>

          {/* Overall Check Pills */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {[
              { label: 'Qty vs PO', status: summary.qtyCheckStatus, icon: 'ri-scales-line' },
              { label: 'Price vs PO', status: summary.priceCheckStatus, icon: 'ri-price-tag-3-line' },
              { label: 'Item Condition', status: summary.conditionCheckStatus, icon: 'ri-shield-check-line' },
            ].map(item => {
              const colorMap: Record<CheckStatus, string> = {
                match: 'bg-emerald-500/30 text-white border border-emerald-400/40',
                mismatch: 'bg-red-500/30 text-white border border-red-400/40',
                partial: 'bg-amber-500/30 text-white border border-amber-400/40',
                pending: 'bg-white/20 text-white/70 border border-white/20',
              };
              const iconMap: Record<CheckStatus, string> = {
                match: 'ri-check-line',
                mismatch: 'ri-close-line',
                partial: 'ri-error-warning-line',
                pending: 'ri-time-line',
              };
              return (
                <div key={item.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${colorMap[item.status]}`}>
                  <i className={`${item.icon}`}></i>
                  {item.label}
                  <i className={`${iconMap[item.status]} ml-1`}></i>
                </div>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-teal-100 text-xs">{summary.matched}/{summary.totalItems} items fully matched</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 bg-white flex-shrink-0">
          {[
            { key: 'summary', label: 'Match Summary', icon: 'ri-bar-chart-grouped-line' },
            { key: 'items', label: 'Line Item Comparison', icon: 'ri-list-check-2' },
            { key: 'po', label: 'PO Details', icon: 'ri-file-text-line' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'summary' | 'items' | 'po')}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.key ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <i className={tab.icon}></i>{tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {/* 3 Check Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    title: 'Quantity Check',
                    subtitle: 'GRN received qty vs PO ordered qty',
                    status: summary.qtyCheckStatus,
                    icon: 'ri-scales-line',
                    detail: summary.qtyCheckStatus === 'match'
                      ? 'All items received as per PO quantity'
                      : summary.qtyCheckStatus === 'partial'
                      ? 'Some items partially received'
                      : 'Quantity discrepancy found',
                  },
                  {
                    title: 'Price Check',
                    subtitle: 'GRN unit price vs PO unit price',
                    status: summary.priceCheckStatus,
                    icon: 'ri-price-tag-3-line',
                    detail: summary.priceCheckStatus === 'match'
                      ? 'All prices match PO terms'
                      : 'Price discrepancy detected',
                  },
                  {
                    title: 'Condition Check',
                    subtitle: 'Physical condition of received goods',
                    status: summary.conditionCheckStatus,
                    icon: 'ri-shield-check-line',
                    detail: summary.conditionCheckStatus === 'match'
                      ? 'All items in good condition'
                      : summary.conditionCheckStatus === 'pending'
                      ? 'Some items pending inspection'
                      : 'Damaged items found',
                  },
                ].map(card => {
                  const bgMap: Record<CheckStatus, string> = {
                    match: 'bg-emerald-50 border-emerald-200',
                    mismatch: 'bg-red-50 border-red-200',
                    partial: 'bg-amber-50 border-amber-200',
                    pending: 'bg-gray-50 border-gray-200',
                  };
                  const iconBgMap: Record<CheckStatus, string> = {
                    match: 'bg-emerald-100 text-emerald-600',
                    mismatch: 'bg-red-100 text-red-600',
                    partial: 'bg-amber-100 text-amber-600',
                    pending: 'bg-gray-100 text-gray-500',
                  };
                  return (
                    <div key={card.title} className={`rounded-xl border p-4 ${bgMap[card.status]}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBgMap[card.status]}`}>
                          <i className={`${card.icon} text-lg`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{card.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{card.subtitle}</p>
                        </div>
                      </div>
                      <CheckBadge status={card.status} />
                      <p className="text-xs text-gray-600 mt-2">{card.detail}</p>
                    </div>
                  );
                })}
              </div>

              {/* GRN vs PO Value Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-file-text-line text-teal-500"></i> PO Value
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold">{formatCurrency(po?.subtotal ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST ({po?.gstPercentage ?? 0}%)</span>
                      <span className="font-semibold">{formatCurrency(po?.taxAmount ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-teal-200">
                      <span>Grand Total</span>
                      <span className="text-teal-600">{formatCurrency(po?.grandTotal ?? 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-truck-line text-teal-500"></i> GRN Received Value
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal (Received)</span>
                      <span className="font-semibold">{formatCurrency(grn.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">GST ({grn.gstPercentage}%)</span>
                      <span className="font-semibold">{formatCurrency(grn.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                      <span>Grand Total</span>
                      <span className={grn.grandTotal === (po?.grandTotal ?? 0) ? 'text-emerald-600' : 'text-amber-600'}>
                        {formatCurrency(grn.grandTotal)}
                      </span>
                    </div>
                  </div>
                  {grn.grandTotal !== (po?.grandTotal ?? 0) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                      <span className="text-gray-500">Variance</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(Math.abs(grn.grandTotal - (po?.grandTotal ?? 0)))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Discrepancies */}
              {discrepancies.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                    <i className="ri-error-warning-line"></i>
                    Discrepancies Found ({discrepancies.length})
                  </h4>
                  <ul className="space-y-2">
                    {discrepancies.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <i className="ri-close-circle-line flex-shrink-0 mt-0.5"></i>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {discrepancies.length === 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="ri-check-double-line text-emerald-600 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-700">All Checks Passed</p>
                    <p className="text-xs text-emerald-600 mt-0.5">GRN matches PO on quantity, price, and item condition. Ready for approval.</p>
                  </div>
                </div>
              )}

              {/* Item Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Fully Matched', value: summary.matched, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                  { label: 'Partial / Issues', value: summary.partial, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
                  { label: 'Mismatched', value: summary.mismatched, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 text-center ${s.bg}`}>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LINE ITEMS TAB */}
          {activeTab === 'items' && (
            <div className="border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['#', 'Item Description', 'PO Qty', 'GRN Qty', 'Qty Check', 'PO Price', 'GRN Price', 'Price Check', 'Condition', 'Status'].map(h => (
                      <th key={h} className={`px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                        h === '#' ? 'text-center' : ['PO Qty', 'GRN Qty', 'PO Price', 'GRN Price'].includes(h) ? 'text-right' : 'text-left'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineChecks.map((check, idx) => (
                    <tr key={check.grnItem.id} className={`transition-colors ${
                      check.overallStatus === 'match' ? 'hover:bg-emerald-50/30' :
                      check.overallStatus === 'mismatch' ? 'bg-red-50/40 hover:bg-red-50/60' :
                      check.overallStatus === 'partial' ? 'bg-amber-50/40 hover:bg-amber-50/60' :
                      'hover:bg-gray-50'
                    }`}>
                      <td className="px-3 py-3 text-xs text-gray-500 text-center">{idx + 1}</td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 max-w-[180px]">
                        <p className="truncate">{check.grnItem.description}</p>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 text-right font-medium">{check.poItem?.quantity ?? '—'}</td>
                      <td className={`px-3 py-3 text-sm font-bold text-right ${
                        check.qtyStatus === 'match' ? 'text-emerald-600' :
                        check.qtyStatus === 'partial' ? 'text-amber-600' : 'text-red-600'
                      }`}>{check.grnItem.receivedQty}</td>
                      <td className="px-3 py-3"><CheckBadge status={check.qtyStatus} /></td>
                      <td className="px-3 py-3 text-sm text-gray-700 text-right">{check.poItem ? formatCurrency(check.poItem.unitPrice) : '—'}</td>
                      <td className={`px-3 py-3 text-sm font-bold text-right ${check.priceStatus === 'match' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(check.grnItem.unitPrice)}
                      </td>
                      <td className="px-3 py-3"><CheckBadge status={check.priceStatus} /></td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                          check.grnItem.condition === 'Good' ? 'bg-emerald-100 text-emerald-700' :
                          check.grnItem.condition === 'Damaged' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{check.grnItem.condition}</span>
                      </td>
                      <td className="px-3 py-3"><CheckBadge status={check.overallStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PO DETAILS TAB */}
          {activeTab === 'po' && po && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-file-text-line text-teal-500"></i> PO Information
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'PO Number', value: po.poNumber },
                      { label: 'PR Reference', value: po.prId },
                      { label: 'Created Date', value: po.createdDate },
                      { label: 'Expected Delivery', value: po.expectedDeliveryDate },
                      { label: 'Payment Terms', value: po.paymentTerms },
                      { label: 'Status', value: po.status },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <i className="ri-store-2-line text-teal-500"></i> Vendor & Department
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: 'Vendor', value: po.vendor },
                      { label: 'Department', value: po.department },
                      { label: 'Requester', value: po.requester },
                      { label: 'Created By', value: po.createdBy },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className="text-xs font-semibold text-gray-900">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {po.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <i className="ri-information-line"></i> Special Instructions
                  </p>
                  <p className="text-sm text-gray-700">{po.specialInstructions}</p>
                </div>
              )}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">PO Line Items</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['#', 'Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase ${
                          h === '#' ? 'text-center' : ['Qty', 'Unit Price', 'Total'].includes(h) ? 'text-right' : 'text-left'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {po.lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-gray-500 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-sm text-gray-600 text-right">Subtotal</td>
                      <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(po.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({po.gstPercentage}%)</td>
                      <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">{formatCurrency(po.taxAmount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                      <td colSpan={2} className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(po.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Action Panel */}
        {confirming && (
          <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <div className={`rounded-xl border p-4 mb-3 ${action === 'approve' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm font-bold mb-2 ${action === 'approve' ? 'text-emerald-700' : 'text-red-700'}`}>
                <i className={`${action === 'approve' ? 'ri-check-double-line' : 'ri-close-circle-line'} mr-1.5`}></i>
                {action === 'approve' ? 'Approve GRN' : 'Reject GRN'} — Add Remarks
              </p>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={action === 'approve' ? 'Enter approval remarks...' : 'Enter rejection reason...'}
                rows={2}
                maxLength={500}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none bg-white"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{remarks.length}/500</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirming(false); setAction(null); setRemarks(''); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!remarks.trim()}
                className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                  action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <i className={`${action === 'approve' ? 'ri-check-double-line' : 'ri-close-circle-line'} mr-1.5`}></i>
                Confirm {action === 'approve' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!confirming && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
            >
              <i className="ri-close-line"></i> Close
            </button>
            <div className="flex items-center gap-3">
              {!summary.canApprove && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <i className="ri-error-warning-line"></i>
                  Discrepancies found — review before approving
                </span>
              )}
              <button
                onClick={() => handleAction('reject')}
                className="px-5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                <i className="ri-close-circle-line"></i> Reject GRN
              </button>
              <button
                onClick={() => handleAction('approve')}
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  summary.canApprove
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                <i className="ri-shield-check-line"></i>
                {summary.canApprove ? 'Approve GRN' : 'Approve with Discrepancy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
