import { useState, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import AcceptanceModal from './components/AcceptanceModal';
import POExpandedRow from './components/POExpandedRow';
import { vendorPOAcceptanceData, VendorPOAcceptanceStatus } from '../../../mocks/vendor-po-acceptance-data';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const StatusBadge = ({ status }: { status: VendorPOAcceptanceStatus }) => {
  const map: Record<VendorPOAcceptanceStatus, string> = {
    'Pending Acceptance': 'bg-amber-100 text-amber-700 border border-amber-200',
    'Accepted': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'Rejected': 'bg-red-100 text-red-700 border border-red-200',
    'Partially Accepted': 'bg-violet-100 text-violet-700 border border-violet-200',
  };
  const icon: Record<VendorPOAcceptanceStatus, string> = {
    'Pending Acceptance': 'ri-time-line',
    'Accepted': 'ri-check-double-line',
    'Rejected': 'ri-close-circle-line',
    'Partially Accepted': 'ri-git-commit-line',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[status]}`}>
      <i className={icon[status]}></i>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: 'high' | 'medium' | 'low' }) => {
  const map = {
    high: 'bg-red-50 text-red-600 border border-red-200',
    medium: 'bg-amber-50 text-amber-600 border border-amber-200',
    low: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize whitespace-nowrap ${map[priority]}`}>
      <i className="ri-flag-line text-xs"></i>
      {priority}
    </span>
  );
};

type ModalState = {
  isOpen: boolean;
  type: 'accept' | 'reject' | 'partial';
  poNumber: string;
  prTitle: string;
  vendorName: string;
  grandTotal: number;
};

export default function VendorPOAcceptancePage() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusUpdates, setStatusUpdates] = useState<Record<string, VendorPOAcceptanceStatus>>({});
  const [responseData, setResponseData] = useState<Record<string, { remarks: string; deliveryDate?: string }>>({});
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'accept',
    poNumber: '',
    prTitle: '',
    vendorName: '',
    grandTotal: 0,
  });

  const showToast = (text: string, type: 'success' | 'error' | 'warning') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openModal = (poNumber: string, type: 'accept' | 'reject' | 'partial') => {
    const po = vendorPOAcceptanceData.find((p) => p.poNumber === poNumber);
    if (!po) return;
    setModal({ isOpen: true, type, poNumber, prTitle: po.prTitle, vendorName: po.vendorName, grandTotal: po.grandTotal });
  };

  const handleConfirm = (remarks: string, deliveryDate?: string) => {
    const newStatus: VendorPOAcceptanceStatus =
      modal.type === 'accept' ? 'Accepted' :
      modal.type === 'reject' ? 'Rejected' :
      'Partially Accepted';

    setStatusUpdates((prev) => ({ ...prev, [modal.poNumber]: newStatus }));
    setResponseData((prev) => ({ ...prev, [modal.poNumber]: { remarks, deliveryDate } }));

    const msgs: Record<typeof modal.type, string> = {
      accept: `${modal.poNumber} has been accepted successfully`,
      reject: `${modal.poNumber} has been rejected`,
      partial: `${modal.poNumber} marked as Partially Accepted`,
    };
    const types: Record<typeof modal.type, 'success' | 'error' | 'warning'> = {
      accept: 'success',
      reject: 'error',
      partial: 'warning',
    };
    showToast(msgs[modal.type], types[modal.type]);
    setModal((prev) => ({ ...prev, isOpen: false }));
    setExpandedRow(null);
  };

  const processedPOs = useMemo(() =>
    vendorPOAcceptanceData.map((po) => ({
      ...po,
      status: statusUpdates[po.poNumber] || po.status,
      acceptanceRemarks: responseData[po.poNumber]?.remarks || po.acceptanceRemarks,
      rejectionReason: responseData[po.poNumber]?.remarks || po.rejectionReason,
      deliveryConfirmedDate: responseData[po.poNumber]?.deliveryDate || po.deliveryConfirmedDate,
    })),
    [statusUpdates, responseData]
  );

  const filteredPOs = useMemo(() => {
    let result = [...processedPOs];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((po) =>
        po.poNumber.toLowerCase().includes(q) ||
        po.prTitle.toLowerCase().includes(q) ||
        po.vendorName.toLowerCase().includes(q) ||
        po.vendorCode.toLowerCase().includes(q) ||
        po.department.toLowerCase().includes(q)
      );
    }
    if (filter !== 'all') {
      result = result.filter((po) => po.status === filter);
    }
    // Pending first
    result.sort((a, b) => {
      const order: Record<string, number> = { 'Pending Acceptance': 0, 'Partially Accepted': 1, 'Accepted': 2, 'Rejected': 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });
    return result;
  }, [processedPOs, searchTerm, filter]);

  const stats = useMemo(() => ({
    pending: processedPOs.filter((p) => p.status === 'Pending Acceptance').length,
    accepted: processedPOs.filter((p) => p.status === 'Accepted').length,
    rejected: processedPOs.filter((p) => p.status === 'Rejected').length,
    partial: processedPOs.filter((p) => p.status === 'Partially Accepted').length,
    pendingValue: processedPOs.filter((p) => p.status === 'Pending Acceptance').reduce((s, p) => s + p.grandTotal, 0),
    acceptedValue: processedPOs.filter((p) => p.status === 'Accepted').reduce((s, p) => s + p.grandTotal, 0),
  }), [processedPOs]);

  const toggleRow = (poNumber: string) =>
    setExpandedRow((prev) => (prev === poNumber ? null : poNumber));

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor PO Acceptance</h1>
        <p className="text-sm text-gray-500 mt-1">Track vendor responses to issued Purchase Orders — accept, reject, or partially accept</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Pending Acceptance', value: stats.pending, icon: 'ri-time-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
          { label: 'Accepted', value: stats.accepted, icon: 'ri-check-double-line', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
          { label: 'Partially Accepted', value: stats.partial, icon: 'ri-git-commit-line', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
          { label: 'Rejected', value: stats.rejected, icon: 'ri-close-circle-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
        ].map((card) => (
          <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-5 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
              <i className={`${card.icon} text-2xl ${card.text}`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Value Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-money-rupee-circle-line text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-amber-100 text-sm">Value Awaiting Acceptance</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.pendingValue)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-100 text-xs">{stats.pending} PO{stats.pending !== 1 ? 's' : ''} pending</p>
            <p className="text-white text-xs font-medium mt-0.5">SLA: 2 business days</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-teal-100 text-sm">Value Confirmed by Vendors</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.acceptedValue)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-teal-100 text-xs">{stats.accepted} PO{stats.accepted !== 1 ? 's' : ''} accepted</p>
            <p className="text-white text-xs font-medium mt-0.5">Ready for GRN tracking</p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filters */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-gray-900">Purchase Orders — Vendor Acceptance Status</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search PO, vendor, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-64"
                />
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'Pending Acceptance', label: 'Pending' },
                  { key: 'Accepted', label: 'Accepted' },
                  { key: 'Partially Accepted', label: 'Partial' },
                  { key: 'Rejected', label: 'Rejected' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      filter === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Showing <strong className="text-gray-700">{filteredPOs.length}</strong> purchase order{filteredPOs.length !== 1 ? 's' : ''} · Click any row to expand full details
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['', 'PO Number', 'Vendor', 'PR Reference', 'Department', 'Grand Total', 'Due Date', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredPOs.map((po) => {
                const isExpanded = expandedRow === po.poNumber;
                const isPending = po.status === 'Pending Acceptance';
                const isOverdue = isPending && new Date(po.acceptanceDueDate) < new Date('2024-02-01');

                return (
                  <>
                    <tr
                      key={po.poNumber}
                      onClick={() => toggleRow(po.poNumber)}
                      className={`border-b transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-teal-50 border-teal-200'
                          : isOverdue
                          ? 'hover:bg-red-50/30 border-gray-100 bg-red-50/10'
                          : isPending
                          ? 'hover:bg-amber-50/40 border-gray-100'
                          : 'hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      {/* Expand Icon */}
                      <td className="px-4 py-4 w-8">
                        <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                          <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </td>

                      {/* PO Number */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Issued: {po.issuedDate}</p>
                      </td>

                      {/* Vendor */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-teal-700 text-xs font-bold">
                              {po.vendorName.split(' ').slice(0, 2).map((n) => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 max-w-[160px] truncate">{po.vendorName}</p>
                            <p className="text-xs text-gray-400">{po.vendorCode}</p>
                          </div>
                        </div>
                      </td>

                      {/* PR Reference */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-teal-600">{po.prId}</p>
                        <p className="text-xs text-gray-500 max-w-[150px] truncate">{po.prTitle}</p>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{po.department}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <i className="ri-user-line text-xs"></i>{po.requester}
                        </p>
                      </td>

                      {/* Grand Total */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(po.grandTotal)}</p>
                        <p className="text-xs text-gray-400">{po.lineItems.length} line item{po.lineItems.length !== 1 ? 's' : ''}</p>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {isPending ? (
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            <i className={isOverdue ? 'ri-alarm-warning-line' : 'ri-calendar-line'}></i>
                            {isOverdue ? 'Overdue' : po.acceptanceDueDate}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">{po.acceptanceDueDate}</p>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <PriorityBadge priority={po.priority} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={po.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleRow(po.poNumber)}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="Expand"
                          >
                            <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => openModal(po.poNumber, 'accept')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                                title="Accept"
                              >
                                <i className="ri-check-line text-sm"></i>
                              </button>
                              <button
                                onClick={() => openModal(po.poNumber, 'partial')}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                                title="Partial Accept"
                              >
                                <i className="ri-git-commit-line text-sm"></i>
                              </button>
                              <button
                                onClick={() => openModal(po.poNumber, 'reject')}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                                title="Reject"
                              >
                                <i className="ri-close-line text-sm"></i>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {isExpanded && (
                      <POExpandedRow
                        key={`expanded-${po.poNumber}`}
                        po={po}
                        status={po.status}
                        onAccept={() => openModal(po.poNumber, 'accept')}
                        onReject={() => openModal(po.poNumber, 'reject')}
                        onPartial={() => openModal(po.poNumber, 'partial')}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredPOs.length === 0 && (
          <div className="py-16 text-center">
            <i className="ri-store-2-line text-5xl text-gray-200 mb-4 block"></i>
            <p className="text-gray-500 text-sm font-medium">No purchase orders found</p>
            {(searchTerm || filter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setFilter('all'); }}
                className="mt-3 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 cursor-pointer whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Acceptance Modal */}
      <AcceptanceModal
        isOpen={modal.isOpen}
        type={modal.type}
        poNumber={modal.poNumber}
        prTitle={modal.prTitle}
        vendorName={modal.vendorName}
        grandTotal={modal.grandTotal}
        onConfirm={handleConfirm}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' :
            toast.type === 'error' ? 'bg-red-700 text-white' :
            'bg-amber-600 text-white'
          }`}>
            <i className={
              toast.type === 'success' ? 'ri-check-double-line' :
              toast.type === 'error' ? 'ri-close-circle-line' :
              'ri-git-commit-line'
            }></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
