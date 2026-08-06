import { useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';

interface Invoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  poNumber: string;
  department: string;
  amount: number;
  dueDate: string;
  managerApprovalDate: string;
  status: 'Approved for Payment' | 'Payment Released';
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  poDetails: {
    poNumber: string;
    poDate: string;
    deliveryDate: string;
    terms: string;
  };
  approvalHistory: Array<{
    stage: string;
    approver: string;
    role: string;
    date: string;
    remarks: string;
    status: 'approved' | 'pending' | 'rejected';
  }>;
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    vendor: 'Tech Solutions Pvt Ltd',
    poNumber: 'PO-2024-001',
    department: 'IT',
    amount: 125000,
    dueDate: '2024-02-15',
    managerApprovalDate: '2024-01-28',
    status: 'Approved for Payment',
    items: [
      { description: 'Dell Laptop i7 16GB', quantity: 5, unitPrice: 65000, total: 325000 },
      { description: 'Wireless Mouse', quantity: 10, unitPrice: 800, total: 8000 }
    ],
    poDetails: {
      poNumber: 'PO-2024-001',
      poDate: '2024-01-10',
      deliveryDate: '2024-01-25',
      terms: 'Net 30'
    },
    approvalHistory: [
      {
        stage: 'Invoice Submitted',
        approver: 'Tech Solutions Pvt Ltd',
        role: 'Vendor',
        date: '2024-01-25 10:30 AM',
        remarks: 'Invoice submitted with GRN reference',
        status: 'approved'
      },
      {
        stage: 'Accounts Executive Review',
        approver: 'Priya Sharma',
        role: 'Accounts Executive',
        date: '2024-01-26 02:15 PM',
        remarks: '3-way match verified successfully',
        status: 'approved'
      },
      {
        stage: 'Accounts Manager Approval',
        approver: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-01-28 11:45 AM',
        remarks: 'Approved for payment release',
        status: 'approved'
      },
      {
        stage: 'SCM Manager Authorization',
        approver: 'Pending',
        role: 'SCM Manager',
        date: '-',
        remarks: '-',
        status: 'pending'
      }
    ]
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    vendor: 'Office Supplies Co',
    poNumber: 'PO-2024-005',
    department: 'Admin',
    amount: 45000,
    dueDate: '2024-02-10',
    managerApprovalDate: '2024-01-27',
    status: 'Approved for Payment',
    items: [
      { description: 'A4 Paper Reams', quantity: 50, unitPrice: 250, total: 12500 },
      { description: 'Printer Cartridges', quantity: 20, unitPrice: 1500, total: 30000 }
    ],
    poDetails: {
      poNumber: 'PO-2024-005',
      poDate: '2024-01-08',
      deliveryDate: '2024-01-22',
      terms: 'Net 30'
    },
    approvalHistory: [
      {
        stage: 'Invoice Submitted',
        approver: 'Office Supplies Co',
        role: 'Vendor',
        date: '2024-01-23 09:00 AM',
        remarks: 'Invoice submitted',
        status: 'approved'
      },
      {
        stage: 'Accounts Executive Review',
        approver: 'Priya Sharma',
        role: 'Accounts Executive',
        date: '2024-01-25 03:30 PM',
        remarks: 'All documents verified',
        status: 'approved'
      },
      {
        stage: 'Accounts Manager Approval',
        approver: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-01-27 10:20 AM',
        remarks: 'Approved for payment',
        status: 'approved'
      },
      {
        stage: 'SCM Manager Authorization',
        approver: 'Pending',
        role: 'SCM Manager',
        date: '-',
        remarks: '-',
        status: 'pending'
      }
    ]
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    vendor: 'Industrial Equipment Ltd',
    poNumber: 'PO-2024-008',
    department: 'Production',
    amount: 285000,
    dueDate: '2024-02-20',
    managerApprovalDate: '2024-01-29',
    status: 'Approved for Payment',
    items: [
      { description: 'Hydraulic Press Machine', quantity: 1, unitPrice: 250000, total: 250000 },
      { description: 'Safety Equipment Set', quantity: 5, unitPrice: 7000, total: 35000 }
    ],
    poDetails: {
      poNumber: 'PO-2024-008',
      poDate: '2024-01-12',
      deliveryDate: '2024-01-28',
      terms: 'Net 45'
    },
    approvalHistory: [
      {
        stage: 'Invoice Submitted',
        approver: 'Industrial Equipment Ltd',
        role: 'Vendor',
        date: '2024-01-28 02:00 PM',
        remarks: 'Invoice with installation certificate',
        status: 'approved'
      },
      {
        stage: 'Accounts Executive Review',
        approver: 'Priya Sharma',
        role: 'Accounts Executive',
        date: '2024-01-29 09:45 AM',
        remarks: '3-way match completed',
        status: 'approved'
      },
      {
        stage: 'Accounts Manager Approval',
        approver: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-01-29 04:30 PM',
        remarks: 'High value approved',
        status: 'approved'
      },
      {
        stage: 'SCM Manager Authorization',
        approver: 'Pending',
        role: 'SCM Manager',
        date: '-',
        remarks: '-',
        status: 'pending'
      }
    ]
  }
];

export default function SCMPaymentApprovalPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'po' | 'history'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'released'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.poNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'pending' && inv.status === 'Approved for Payment') ||
                         (statusFilter === 'released' && inv.status === 'Payment Released');
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pendingRelease: invoices.filter(i => i.status === 'Approved for Payment').length,
    released: invoices.filter(i => i.status === 'Payment Released').length,
    totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
    overdue: invoices.filter(i => new Date(i.dueDate) < new Date() && i.status === 'Approved for Payment').length
  };

  const handleReleasePayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowApprovalModal(true);
  };

  const handleApprove = () => {
    if (selectedInvoice) {
      setInvoices(prev => prev.map(inv => 
        inv.id === selectedInvoice.id 
          ? { ...inv, status: 'Payment Released' as const }
          : inv
      ));
      setShowApprovalModal(false);
      setSelectedInvoice(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Release Authorization</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-semibold rounded-full">
                SCM Manager
              </span>
              <span className="text-gray-500 text-sm">Final payment authorization</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 border border-orange-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Release</p>
                <p className="text-3xl font-bold text-orange-600">{stats.pendingRelease}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <i className="ri-time-line text-2xl text-orange-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Released</p>
                <p className="text-3xl font-bold text-green-600">{stats.released}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-2xl text-green-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-blue-600">₹{(stats.totalAmount / 100000).toFixed(1)}L</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <i className="ri-money-rupee-circle-line text-2xl text-blue-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Overdue</p>
                <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="ri-alarm-warning-line text-2xl text-red-600"></i>
              </div>
            </div>
          </div>
        </div>

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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-1 p-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Pending Release ({stats.pendingRelease})
            </button>
            <button
              onClick={() => setStatusFilter('released')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === 'released'
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Released ({stats.released})
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">PO Number</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Manager Approval</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <>
                  <tr 
                    key={invoice.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setExpandedRow(expandedRow === invoice.id ? null : invoice.id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <i className={`ri-arrow-${expandedRow === invoice.id ? 'down' : 'right'}-s-line text-gray-400`}></i>
                        <span className="font-semibold text-gray-900">{invoice.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.vendor}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.poNumber}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                        {invoice.department}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">₹{invoice.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.dueDate}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{invoice.managerApprovalDate}</td>
                    <td className="px-6 py-4">
                      {invoice.status === 'Approved for Payment' ? (
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full whitespace-nowrap">
                          Pending Release
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap">
                          Payment Released
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {invoice.status === 'Approved for Payment' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReleasePayment(invoice);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-indigo-600 hover:to-blue-600 transition-all whitespace-nowrap"
                        >
                          Release Payment
                        </button>
                      )}
                    </td>
                  </tr>

                  {expandedRow === invoice.id && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-6 py-6">
                        <div className="flex gap-2 mb-4 border-b border-gray-200">
                          <button
                            onClick={() => setActiveTab('summary')}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === 'summary'
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Invoice Summary
                          </button>
                          <button
                            onClick={() => setActiveTab('po')}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === 'po'
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            PO Details
                          </button>
                          <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === 'history'
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Approval History
                          </button>
                        </div>

                        {activeTab === 'summary' && (
                          <div className="bg-white rounded-lg p-6 border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Invoice Summary</h3>
                            <div className="grid grid-cols-2 gap-6 mb-6">
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Invoice Number</p>
                                <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Vendor</p>
                                <p className="font-semibold text-gray-900">{invoice.vendor}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">PO Number</p>
                                <p className="font-semibold text-gray-900">{invoice.poNumber}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Department</p>
                                <p className="font-semibold text-gray-900">{invoice.department}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                                <p className="text-xl font-bold text-indigo-600">₹{invoice.amount.toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Due Date</p>
                                <p className="font-semibold text-gray-900">{invoice.dueDate}</p>
                              </div>
                            </div>

                            <h4 className="font-semibold text-gray-900 mb-3">Line Items</h4>
                            <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Quantity</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {invoice.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{item.quantity}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 text-right">₹{item.unitPrice.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">₹{item.total.toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {activeTab === 'po' && (
                          <div className="bg-white rounded-lg p-6 border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Purchase Order Details</h3>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <p className="text-sm text-gray-600 mb-1">PO Number</p>
                                <p className="font-semibold text-gray-900">{invoice.poDetails.poNumber}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">PO Date</p>
                                <p className="font-semibold text-gray-900">{invoice.poDetails.poDate}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Delivery Date</p>
                                <p className="font-semibold text-gray-900">{invoice.poDetails.deliveryDate}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600 mb-1">Payment Terms</p>
                                <p className="font-semibold text-gray-900">{invoice.poDetails.terms}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === 'history' && (
                          <div className="bg-white rounded-lg p-6 border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Approval History</h3>
                            <div className="space-y-4">
                              {invoice.approvalHistory.map((history, idx) => (
                                <div key={idx} className="flex gap-4">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                      history.status === 'approved' ? 'bg-green-100' :
                                      history.status === 'pending' ? 'bg-orange-100' :
                                      'bg-red-100'
                                    }`}>
                                      <i className={`${
                                        history.status === 'approved' ? 'ri-checkbox-circle-fill text-green-600' :
                                        history.status === 'pending' ? 'ri-time-line text-orange-600' :
                                        'ri-close-circle-fill text-red-600'
                                      } text-xl`}></i>
                                    </div>
                                    {idx < invoice.approvalHistory.length - 1 && (
                                      <div className="w-0.5 h-12 bg-gray-200"></div>
                                    )}
                                  </div>
                                  <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between mb-1">
                                      <h4 className="font-semibold text-gray-900">{history.stage}</h4>
                                      <span className="text-sm text-gray-500">{history.date}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">{history.approver} • {history.role}</p>
                                    <p className="text-sm text-gray-700">{history.remarks}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 p-6 text-white">
              <h2 className="text-2xl font-bold">SCM Manager Authorization</h2>
              <p className="text-indigo-100 text-sm mt-1">Final payment release approval</p>
            </div>

            <div className="p-6">
              {/* Invoice Summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-6 mb-6 border border-indigo-200">
                <h3 className="font-bold text-gray-900 mb-4">Invoice Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Invoice Number</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Vendor</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.vendor}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">PO Number</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Amount</p>
                    <p className="text-xl font-bold text-indigo-600">₹{selectedInvoice.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Accounts Manager</p>
                    <p className="font-semibold text-gray-900">Ramesh Iyer</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Approval Date</p>
                    <p className="font-semibold text-gray-900">{selectedInvoice.managerApprovalDate}</p>
                  </div>
                </div>
              </div>

              {/* Authorization Checklist */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 mb-4">Authorization Checklist</h3>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" defaultChecked className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500" />
                    <div>
                      <p className="font-medium text-gray-900">3-way match verified by Accounts</p>
                      <p className="text-sm text-gray-600">PO, GRN, and Invoice match confirmed</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" defaultChecked className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500" />
                    <div>
                      <p className="font-medium text-gray-900">PO terms confirmed</p>
                      <p className="text-sm text-gray-600">Payment terms and conditions verified</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" defaultChecked className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500" />
                    <div>
                      <p className="font-medium text-gray-900">GRN fully received</p>
                      <p className="text-sm text-gray-600">All items received and quality checked</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                    <input type="checkbox" defaultChecked className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500" />
                    <div>
                      <p className="font-medium text-gray-900">Budget availability confirmed</p>
                      <p className="text-sm text-gray-600">Sufficient budget allocated for payment</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter authorization remarks (minimum 10 characters)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowApprovalModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg whitespace-nowrap"
                >
                  Authorize Payment Release
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}