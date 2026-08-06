import { useState, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import InvoiceSubmitModal from './components/InvoiceSubmitModal';
import InvoiceDetailRow from './components/InvoiceDetailRow';
import { vendorInvoiceData, VendorInvoiceStatus } from '../../../mocks/vendor-invoice-data';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const STATUS_CONFIG: Record<VendorInvoiceStatus, { bg: string; text: string; border: string; icon: string }> = {
  Draft:               { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',   icon: 'ri-draft-line' },
  Submitted:           { bg: 'bg-teal-50',    text: 'text-teal-700',   border: 'border-teal-200',   icon: 'ri-send-plane-line' },
  'Under Verification':{ bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',  icon: 'ri-search-eye-line' },
  'Approved for Payment':{ bg:'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-200',icon: 'ri-checkbox-circle-line' },
  Paid:                { bg: 'bg-violet-50',  text: 'text-violet-700', border: 'border-violet-200', icon: 'ri-money-rupee-circle-line' },
  Discrepancy:         { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200',    icon: 'ri-error-warning-line' },
  Rejected:            { bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200',   icon: 'ri-close-circle-line' },
};

const PriorityBadge = ({ priority }: { priority: 'high' | 'medium' | 'low' }) => {
  const map = { high: 'bg-red-50 text-red-600 border-red-200', medium: 'bg-amber-50 text-amber-600 border-amber-200', low: 'bg-gray-100 text-gray-500 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize whitespace-nowrap border ${map[priority]}`}>
      <i className="ri-flag-line text-xs"></i>{priority}
    </span>
  );
};

const StatusBadge = ({ status }: { status: VendorInvoiceStatus }) => {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${c.bg} ${c.text} ${c.border}`}>
      <i className={c.icon}></i>{status}
    </span>
  );
};

type ModalState = { isOpen: boolean; invoiceNumber: string; mode: 'submit' | 'resubmit' };

export default function VendorInvoicePage() {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VendorInvoiceStatus>('all');
  const [statusUpdates, setStatusUpdates] = useState<Record<string, VendorInvoiceStatus>>({});
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'warning' } | null>(null);
  const [modal, setModal] = useState<ModalState>({ isOpen: false, invoiceNumber: '', mode: 'submit' });

  const showToast = (text: string, type: 'success' | 'warning') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const processedInvoices = useMemo(() =>
    vendorInvoiceData.map((inv) => ({
      ...inv,
      status: statusUpdates[inv.invoiceNumber] || inv.status,
    })), [statusUpdates]);

  const filteredInvoices = useMemo(() => {
    let res = [...processedInvoices];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter((inv) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.poNumber.toLowerCase().includes(q) ||
        inv.vendorName.toLowerCase().includes(q) ||
        inv.grnNumber.toLowerCase().includes(q) ||
        inv.prTitle.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') res = res.filter((inv) => inv.status === statusFilter);
    const order: Partial<Record<VendorInvoiceStatus, number>> = { Draft: 0, Discrepancy: 1, Submitted: 2, 'Under Verification': 3, 'Approved for Payment': 4, Paid: 5, Rejected: 6 };
    res.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    return res;
  }, [processedInvoices, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    draft: processedInvoices.filter((i) => i.status === 'Draft').length,
    submitted: processedInvoices.filter((i) => i.status === 'Submitted').length,
    underVerification: processedInvoices.filter((i) => i.status === 'Under Verification').length,
    approved: processedInvoices.filter((i) => i.status === 'Approved for Payment').length,
    paid: processedInvoices.filter((i) => i.status === 'Paid').length,
    discrepancy: processedInvoices.filter((i) => i.status === 'Discrepancy').length,
    totalPending: processedInvoices.filter((i) => ['Draft','Submitted','Under Verification','Discrepancy'].includes(i.status)).reduce((s, i) => s + i.grandTotal, 0),
    totalPaid: processedInvoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.grandTotal, 0),
  }), [processedInvoices]);

  const handleModalConfirm = (invoiceNumber: string, _remarks: string) => {
    const newStatus: VendorInvoiceStatus = modal.mode === 'resubmit' ? 'Submitted' : 'Submitted';
    setStatusUpdates((prev) => ({ ...prev, [invoiceNumber]: newStatus }));
    showToast(
      modal.mode === 'resubmit'
        ? `${invoiceNumber} re-submitted successfully`
        : `${invoiceNumber} submitted to accounts`,
      'success'
    );
    setModal({ isOpen: false, invoiceNumber: '', mode: 'submit' });
    setExpandedRow(null);
  };

  const openModal = (invoiceNumber: string, mode: 'submit' | 'resubmit') => {
    setModal({ isOpen: true, invoiceNumber, mode });
  };

  const activeModalInvoice = processedInvoices.find((i) => i.invoiceNumber === modal.invoiceNumber) ?? null;

  const filterTabs: { key: 'all' | VendorInvoiceStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: processedInvoices.length },
    { key: 'Draft', label: 'Draft', count: stats.draft },
    { key: 'Submitted', label: 'Submitted', count: stats.submitted },
    { key: 'Under Verification', label: 'Verifying', count: stats.underVerification },
    { key: 'Approved for Payment', label: 'Approved', count: stats.approved },
    { key: 'Discrepancy', label: 'Discrepancy', count: stats.discrepancy },
    { key: 'Paid', label: 'Paid', count: stats.paid },
  ];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Invoice Submission</h1>
        <p className="text-sm text-gray-500 mt-1">Submit and track invoices against accepted Purchase Orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {[
          { label: 'Draft / Pending', value: stats.draft, icon: 'ri-draft-line', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
          { label: 'Under Verification', value: stats.underVerification + stats.submitted, icon: 'ri-search-eye-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
          { label: 'Discrepancy', value: stats.discrepancy, icon: 'ri-error-warning-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
          { label: 'Paid Invoices', value: stats.paid, icon: 'ri-money-rupee-circle-line', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        ].map((c) => (
          <div key={c.label} className={`bg-white rounded-xl border ${c.border} p-5 flex items-center justify-between`}>
            <div>
              <p className="text-xs text-gray-500 mb-1">{c.label}</p>
              <p className="text-3xl font-bold text-gray-900">{c.value}</p>
            </div>
            <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center`}>
              <i className={`${c.icon} text-2xl ${c.text}`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Value Banners */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-time-line text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-amber-100 text-sm">Invoices Pending Payment</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalPending)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-100 text-xs">{stats.draft + stats.submitted + stats.underVerification + stats.discrepancy} invoice(s)</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-violet-600 to-violet-700 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-white text-2xl"></i>
            </div>
            <div>
              <p className="text-violet-100 text-sm">Total Payments Received</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalPaid)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-violet-100 text-xs">{stats.paid} invoice(s) settled</p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filters */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-base font-bold text-gray-900">Invoice Register</h2>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search invoice, PO, vendor, GRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-72"
              />
            </div>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === tab.key ? 'bg-white text-teal-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    statusFilter === tab.key ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-600'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Showing <strong className="text-gray-700">{filteredInvoices.length}</strong> invoice{filteredInvoices.length !== 1 ? 's' : ''} · Click row to expand
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['', 'Invoice No.', 'PO Number', 'Vendor', 'GRN Ref', 'Department', 'Invoice Amount', 'Invoice Date', 'Due Date', 'Priority', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const isExpanded = expandedRow === inv.invoiceNumber;
                const isDisc = inv.status === 'Discrepancy';
                const isDraft = inv.status === 'Draft';

                return (
                  <>
                    <tr
                      key={inv.invoiceNumber}
                      onClick={() => setExpandedRow(expandedRow === inv.invoiceNumber ? null : inv.invoiceNumber)}
                      className={`border-b transition-colors cursor-pointer ${
                        isExpanded ? 'bg-teal-50 border-teal-200' :
                        isDisc ? 'bg-red-50/20 hover:bg-red-50/40 border-gray-100' :
                        isDraft ? 'bg-gray-50/60 hover:bg-gray-100/60 border-gray-100' :
                        'hover:bg-gray-50 border-gray-100'
                      }`}
                    >
                      <td className="px-4 py-4 w-8">
                        <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                          <i className={`text-sm ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{inv.invoiceNumber}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{inv.prId}</p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-teal-600">{inv.poNumber}</p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-teal-700 text-xs font-bold">{inv.vendorName.split(' ').slice(0,2).map((n)=>n[0]).join('')}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 max-w-[150px] truncate">{inv.vendorName}</p>
                            <p className="text-xs text-gray-400">{inv.vendorCode}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-violet-600">{inv.grnNumber}</p>
                        <p className="text-xs text-gray-400">{inv.grnDate}</p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-800">{inv.department}</p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inv.grandTotal)}</p>
                        <p className="text-xs text-gray-400">{inv.lineItems.length} line item{inv.lineItems.length !== 1 ? 's' : ''}</p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-700">{inv.invoiceDate}</p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className={`text-sm font-medium ${inv.status !== 'Paid' && new Date(inv.dueDate) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                          {inv.dueDate}
                        </p>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <PriorityBadge priority={inv.priority} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={inv.status} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setExpandedRow(expandedRow === inv.invoiceNumber ? null : inv.invoiceNumber)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
                            title="View Details"
                          >
                            <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                          </button>
                          {isDraft && (
                            <button
                              onClick={() => openModal(inv.invoiceNumber, 'submit')}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg cursor-pointer"
                              title="Submit Invoice"
                            >
                              <i className="ri-send-plane-line text-sm"></i>
                            </button>
                          )}
                          {isDisc && (
                            <button
                              onClick={() => openModal(inv.invoiceNumber, 'resubmit')}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              title="Re-submit"
                            >
                              <i className="ri-refresh-line text-sm"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <InvoiceDetailRow
                        key={`expanded-${inv.invoiceNumber}`}
                        invoice={inv}
                        status={inv.status}
                        onSubmit={() => openModal(inv.invoiceNumber, 'submit')}
                        onResubmit={() => openModal(inv.invoiceNumber, 'resubmit')}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="py-16 text-center">
            <i className="ri-file-invoice-line text-5xl text-gray-200 mb-4 block"></i>
            <p className="text-gray-500 text-sm font-medium">No invoices found</p>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="mt-3 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 cursor-pointer whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submit Modal */}
      <InvoiceSubmitModal
        isOpen={modal.isOpen}
        invoice={activeModalInvoice}
        mode={modal.mode}
        onConfirm={handleModalConfirm}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold ${toast.type === 'success' ? 'bg-teal-700 text-white' : 'bg-amber-600 text-white'}`}>
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-refresh-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
