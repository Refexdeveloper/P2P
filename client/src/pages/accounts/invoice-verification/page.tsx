import { useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import InvoiceStatsCards from './components/InvoiceStatsCards';
import InvoiceTable from './components/InvoiceTable';
import InvoiceActionModal from './components/InvoiceActionModal';
import { invoiceData, InvoiceData, InvoiceStatus } from '../../../mocks/invoice-data';

export default function InvoiceVerificationPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>(invoiceData);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'hold' | 'reject' | 'manager_approve';
    invoice: InvoiceData;
  } | null>(null);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = (type: 'approve' | 'hold' | 'reject' | 'manager_approve', invoice: InvoiceData) => {
    setActionModal({ type, invoice });
  };

  const handleSubmitAction = (remarks: string) => {
    if (!actionModal) return;

    const { type, invoice } = actionModal;
    let newStatus: InvoiceStatus;

    switch (type) {
      case 'approve':
        newStatus = 'Pending Manager Approval';
        break;
      case 'manager_approve':
        newStatus = 'Approved for Payment';
        break;
      case 'hold':
        newStatus = 'On Hold';
        break;
      case 'reject':
        newStatus = 'Discrepancy';
        break;
      default:
        newStatus = invoice.status;
    }

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.invoiceNumber === invoice.invoiceNumber
          ? {
              ...inv,
              status: newStatus,
              accountsRemarks: remarks,
              approvalHistory: [
                ...inv.approvalHistory,
                {
                  action: type === 'approve' ? 'Sent to Manager' : type === 'manager_approve' ? 'Manager Approved' : type === 'hold' ? 'Put On Hold' : 'Discrepancy Raised',
                  performedBy: type === 'manager_approve' ? 'Ramesh Iyer' : 'Priya Menon',
                  role: type === 'manager_approve' ? 'Accounts Manager' : 'Accounts Executive',
                  date: new Date().toLocaleString('en-IN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  }),
                  notes: remarks,
                },
              ],
            }
          : inv
      )
    );

    setActionModal(null);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice Verification</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-sm font-semibold rounded-full">
                Accounts Executive
              </span>
              <span className="text-gray-500 text-sm">3-way match verification</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <InvoiceStatsCards invoices={invoices} />

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="text"
                  placeholder="Search by invoice, vendor, or PO number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-1 p-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'all' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('Pending Verification')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'Pending Verification' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending Verification ({invoices.filter((i) => i.status === 'Pending Verification').length})
            </button>
            <button
              onClick={() => setStatusFilter('Matched')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'Matched' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Matched ({invoices.filter((i) => i.status === 'Matched').length})
            </button>
            <button
              onClick={() => setStatusFilter('Pending Manager Approval')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'Pending Manager Approval' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending Manager ({invoices.filter((i) => i.status === 'Pending Manager Approval').length})
            </button>
            <button
              onClick={() => setStatusFilter('Discrepancy')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'Discrepancy' ? 'bg-red-100 text-red-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Discrepancy ({invoices.filter((i) => i.status === 'Discrepancy').length})
            </button>
            <button
              onClick={() => setStatusFilter('On Hold')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'On Hold' ? 'bg-yellow-100 text-yellow-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              On Hold ({invoices.filter((i) => i.status === 'On Hold').length})
            </button>
          </div>
        </div>

        {/* Table */}
        <InvoiceTable invoices={filteredInvoices} onAction={handleAction} />
      </div>

      {/* Action Modal */}
      {actionModal && (
        <InvoiceActionModal
          type={actionModal.type}
          invoice={actionModal.invoice}
          onSubmit={handleSubmitAction}
          onClose={() => setActionModal(null)}
        />
      )}
    </DashboardLayout>
  );
}