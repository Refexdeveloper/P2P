import { useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { invoiceData, InvoiceData, PaymentStatus } from '../../../mocks/invoice-data';
import PaymentStatsCards from './components/PaymentStatsCards';
import PaymentTable from './components/PaymentTable';
import PaymentExpandedRow from './components/PaymentExpandedRow';

export default function PaymentPage() {
  const [invoices] = useState<InvoiceData[]>(
    invoiceData.filter((inv) => inv.status === 'Approved for Payment')
  );
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | PaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs: { key: 'all' | PaymentStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Pending Payment', label: 'Pending' },
    { key: 'Paid', label: 'Paid' },
    { key: 'Overdue', label: 'Overdue' },
  ];

  const filtered = invoices.filter((inv) => {
    const matchTab = activeTab === 'all' || inv.paymentStatus === activeTab;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.vendor.toLowerCase().includes(q) ||
      inv.poNumber.toLowerCase().includes(q) ||
      inv.grnNumber.toLowerCase().includes(q) ||
      inv.department.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const handleToggleRow = (invoiceNumber: string) => {
    setExpandedRow((prev) => (prev === invoiceNumber ? null : invoiceNumber));
  };

  const handleUploadPayment = (invoice: InvoiceData) => {
    console.log('Upload payment for:', invoice.invoiceNumber);
    // Modal will be implemented in next step
  };

  const pendingCount = invoices.filter(
    (inv) => inv.paymentStatus === 'Pending Payment' || inv.paymentStatus === 'Overdue'
  ).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Payment Processing</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload and manage payment details for approved invoices
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <i className="ri-bank-card-line text-teal-600 text-base"></i>
            </div>
            <span className="text-sm font-medium text-teal-700">Accounts Team</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-teal-600 text-white text-xs font-semibold rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <PaymentStatsCards invoices={invoices} />

        {/* Search + Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-0 gap-4 flex-wrap">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  {tab.key !== 'all' && (
                    <span className="ml-1.5 text-xs text-gray-400">
                      ({invoices.filter((i) => i.paymentStatus === tab.key).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <i className="ri-search-line text-gray-400 text-sm"></i>
              </div>
              <input
                type="text"
                placeholder="Search invoice, vendor, PO, GRN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-72"
              />
            </div>
          </div>

          <PaymentTable
            invoices={filtered}
            expandedRow={expandedRow}
            onToggleRow={handleToggleRow}
            onUploadPayment={handleUploadPayment}
            renderExpanded={(inv) => (
              <PaymentExpandedRow invoice={inv} onUploadPayment={handleUploadPayment} />
            )}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}