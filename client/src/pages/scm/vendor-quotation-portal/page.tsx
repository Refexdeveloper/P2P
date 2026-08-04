import { useState, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { vendorRFQData, type VendorRFQItem, type RFQItemStatus } from '../../../mocks/vendor-quotation-portal-data';
import PRDetailModal from './components/PRDetailModal';
import QuoteSubmitModal from './components/QuoteSubmitModal';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const statusConfig: Record<RFQItemStatus, { bg: string; text: string; icon: string }> = {
  'Pending Quote':      { bg: '#fef3c7', text: '#92400e', icon: 'ri-time-line' },
  'Re-quote Requested': { bg: '#fee2e2', text: '#991b1b', icon: 'ri-refresh-line' },
  'Quote Submitted':    { bg: '#dbeafe', text: '#1e40af', icon: 'ri-send-plane-line' },
  'Quote Accepted':     { bg: '#d1fae5', text: '#065f46', icon: 'ri-checkbox-circle-line' },
  'Quote Rejected':     { bg: '#fce7f3', text: '#9d174d', icon: 'ri-close-circle-line' },
  'Expired':            { bg: '#f1f5f9', text: '#475569', icon: 'ri-calendar-close-line' },
};

const priorityConfig = {
  High:   { bg: '#fee2e2', text: '#991b1b' },
  Medium: { bg: '#fef3c7', text: '#92400e' },
  Low:    { bg: '#f1f5f9', text: '#475569' },
};

const ALL_STATUSES: RFQItemStatus[] = [
  'Pending Quote', 'Re-quote Requested', 'Quote Submitted',
  'Quote Accepted', 'Quote Rejected', 'Expired',
];

export default function VendorQuotationPortalPage() {
  const [data, setData] = useState<VendorRFQItem[]>(vendorRFQData);
  const [detailRFQ, setDetailRFQ] = useState<VendorRFQItem | null>(null);
  const [submitModal, setSubmitModal] = useState<VendorRFQItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFQItemStatus | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [successMsg, setSuccessMsg] = useState('');

  const stats = useMemo(() => ({
    total: data.length,
    pending: data.filter(r => r.status === 'Pending Quote').length,
    reQuote: data.filter(r => r.status === 'Re-quote Requested').length,
    submitted: data.filter(r => r.status === 'Quote Submitted').length,
    accepted: data.filter(r => r.status === 'Quote Accepted').length,
    totalValue: data.reduce((s, r) => s + (r.quotedValue || r.estimatedValue), 0),
  }), [data]);

  const filtered = useMemo(() => data.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      r.rfqNumber.toLowerCase().includes(q) ||
      r.prNumber.toLowerCase().includes(q) ||
      r.prTitle.toLowerCase().includes(q) ||
      r.buyerDepartment.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchPriority = priorityFilter === 'All' || r.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }), [data, searchQuery, statusFilter, priorityFilter]);

  // When user clicks "Upload Quotation" inside PR Detail modal
  const handleOpenUpload = (rfq: VendorRFQItem) => {
    setSubmitModal(rfq);
  };

  const handleSubmitQuote = (
    rfqId: string,
    quotedLines: { id: string; quotedUnitPrice: number; quantity: number }[],
    paymentTerms: string,
    _notes: string,
  ) => {
    const total = quotedLines.reduce((s, l) => s + l.quotedUnitPrice * l.quantity, 0);
    setData(prev => prev.map(r => {
      if (r.id !== rfqId) return r;
      const updatedLines = r.lineItems.map(li => {
        const ql = quotedLines.find(q => q.id === li.id);
        return ql ? { ...li, quotedUnitPrice: ql.quotedUnitPrice, quotedTotal: ql.quotedUnitPrice * li.quantity } : li;
      });
      const newRound = {
        round: r.currentRound,
        submittedDate: new Date().toISOString().slice(0, 10),
        totalAmount: total,
        leadTimeDays: 14,
        paymentTerms,
        status: 'rejected' as const,
      };
      return {
        ...r,
        status: 'Quote Submitted' as RFQItemStatus,
        quotedValue: total,
        lineItems: updatedLines,
        quoteHistory: [...r.quoteHistory, newRound],
        reQuoteReason: undefined,
        reQuoteFields: undefined,
      };
    }));
    setSubmitModal(null);
    setDetailRFQ(null);
    setSuccessMsg('Quotation submitted successfully! The buyer will review and respond shortly.');
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 pb-10">

        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vendor Quotation Portal</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Click any row to view PR details and upload your quotation
              </p>
            </div>
            {(stats.pending + stats.reQuote) > 0 && (
              <span className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-full text-sm font-bold">
                <i className="ri-error-warning-line mr-1.5"></i>
                {stats.pending + stats.reQuote} Action Required
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">

          {/* Success Toast */}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center gap-3">
              <div className="w-6 h-6 flex items-center justify-center">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl"></i>
              </div>
              <p className="text-sm font-semibold text-emerald-800">{successMsg}</p>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-6 gap-4">
            {[
              { label: 'Total RFQs',       value: stats.total,                        icon: 'ri-file-list-3-line',         color: '#6366f1', bg: '#eef2ff' },
              { label: 'Pending Quote',     value: stats.pending,                      icon: 'ri-time-line',                color: '#d97706', bg: '#fffbeb' },
              { label: 'Re-quote Req.',     value: stats.reQuote,                      icon: 'ri-refresh-line',             color: '#dc2626', bg: '#fef2f2' },
              { label: 'Submitted',         value: stats.submitted,                    icon: 'ri-send-plane-line',          color: '#2563eb', bg: '#eff6ff' },
              { label: 'Accepted',          value: stats.accepted,                     icon: 'ri-checkbox-circle-line',     color: '#059669', bg: '#ecfdf5' },
              { label: 'Total Quote Value', value: formatCurrency(stats.totalValue),   icon: 'ri-money-rupee-circle-line',  color: '#0f766e', bg: '#f0fdfa' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: s.bg }}>
                    <i className={`${s.icon} text-base`} style={{ color: s.color }}></i>
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-56">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search RFQ no., PR no., title..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-400 whitespace-nowrap">Status:</span>
              {(['All', ...ALL_STATUSES] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
                  style={{
                    background: statusFilter === s ? '#0f766e' : '#f1f5f9',
                    color: statusFilter === s ? '#fff' : '#64748b',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400">Priority:</span>
              {(['All', 'High', 'Medium', 'Low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
                  style={{
                    background: priorityFilter === p ? '#0f766e' : '#f1f5f9',
                    color: priorityFilter === p ? '#fff' : '#64748b',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 whitespace-nowrap ml-auto">{filtered.length} of {data.length}</p>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">RFQ / PR</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">PR Description</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Buyer</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase">Priority</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase">Round</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">Est. Value</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">Quoted</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center">
                      <i className="ri-file-search-line text-4xl text-gray-200 block mb-3"></i>
                      <p className="text-gray-400 font-medium">No RFQs match your filters</p>
                    </td>
                  </tr>
                )}
                {filtered.map((rfq, idx) => {
                  const sc = statusConfig[rfq.status];
                  const pc = priorityConfig[rfq.priority];
                  const canSubmit = rfq.status === 'Pending Quote' || rfq.status === 'Re-quote Requested';
                  return (
                    <tr
                      key={rfq.id}
                      onClick={() => setDetailRFQ(rfq)}
                      className="cursor-pointer hover:bg-teal-50/40 transition-colors"
                      style={{ borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-teal-600 text-xs">{rfq.rfqNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{rfq.prNumber}</p>
                      </td>
                      <td className="px-5 py-4 max-w-xs">
                        <p className="font-semibold text-gray-900 truncate">{rfq.prTitle}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{rfq.lineItems.length} item{rfq.lineItems.length !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">{rfq.buyerName}</p>
                        <p className="text-xs text-gray-400">{rfq.buyerDepartment}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: pc.bg, color: pc.text }}>
                          {rfq.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <p className={`text-sm font-semibold ${canSubmit ? 'text-red-600' : 'text-gray-600'}`}>{rfq.dueDate}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-full text-xs font-bold">Q{rfq.currentRound}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-500 text-sm">{formatCurrency(rfq.estimatedValue)}</td>
                      <td className="px-5 py-4 text-right">
                        {rfq.quotedValue
                          ? <span className="font-bold text-teal-600">{formatCurrency(rfq.quotedValue)}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                          style={{ background: sc.bg, color: sc.text }}
                        >
                          <i className={sc.icon}></i>
                          {rfq.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center" onClick={e => e.stopPropagation()}>
                        {canSubmit ? (
                          <button
                            onClick={() => { setDetailRFQ(rfq); }}
                            className="px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 mx-auto"
                            style={{ background: '#0f766e', color: '#fff' }}
                          >
                            <i className="ri-eye-line"></i>
                            View & Quote
                          </button>
                        ) : (
                          <button
                            onClick={() => setDetailRFQ(rfq)}
                            className="px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 mx-auto"
                            style={{ background: '#f1f5f9', color: '#64748b' }}
                          >
                            <i className="ri-eye-line"></i>
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* PR Detail Modal */}
        {detailRFQ && (
          <PRDetailModal
            rfq={detailRFQ}
            onClose={() => setDetailRFQ(null)}
            onUploadQuotation={rfq => handleOpenUpload(rfq)}
          />
        )}

        {/* Quote Submit Modal */}
        {submitModal && (
          <QuoteSubmitModal
            rfq={submitModal}
            onClose={() => setSubmitModal(null)}
            onSubmit={handleSubmitQuote}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
