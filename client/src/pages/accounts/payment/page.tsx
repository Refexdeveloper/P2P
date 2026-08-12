import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { InvoiceData, PaymentStatus } from '../../../mocks/invoice-data';
import PaymentStatsCards from './components/PaymentStatsCards';
import PaymentTable from './components/PaymentTable';
import PaymentExpandedRow from './components/PaymentExpandedRow';
import UploadPaymentModal, { PaymentData } from './components/UploadPaymentModal';
import { accountsApi } from '../../../services/api';

function mapApiInvoice(raw: Record<string, unknown>): InvoiceData {
  return {
    id: Number(raw.id),
    invoiceNumber: String(raw.invoiceNumber || `INV-${raw.id}`),
    invoiceDate: String(raw.invoiceDate || ''),
    submittedDate: String(raw.submittedDate || ''),
    dueDate: String(raw.dueDate || ''),
    vendor: String(raw.vendor || ''),
    vendorGSTIN: '',
    vendorAddress: '',
    poNumber: String(raw.poNumber || ''),
    grnNumber: String(raw.grnNumber || ''),
    prId: String(raw.prId || ''),
    prTitle: String(raw.prTitle || ''),
    department: String(raw.department || ''),
    requester: String(raw.requester || ''),
    paymentTerms: String(raw.paymentTerms || ''),
    lineItems: (raw.lineItems as InvoiceData['lineItems']) || [],
    invoiceSubtotal: Number(raw.invoiceSubtotal) || 0,
    invoiceGST: Number(raw.invoiceGST) || 0,
    invoiceGrandTotal: Number(raw.invoiceGrandTotal) || 0,
    poGrandTotal: Number(raw.poGrandTotal) || 0,
    grnReceivedValue: Number(raw.grnReceivedValue) || 0,
    matchStatus: (raw.matchStatus as InvoiceData['matchStatus']) || {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: [],
    status: (raw.status as InvoiceData['status']) || 'Approved for Payment',
    statusRaw: String(raw.statusRaw || ''),
    priority: 'medium',
    accountsRemarks: String(raw.accountsRemarks || ''),
    approvalHistory: (raw.approvalHistory as InvoiceData['approvalHistory']) || [],
    paymentStatus: (raw.paymentStatus as PaymentStatus) || 'Pending Payment',
    paymentDetails: raw.paymentDetails as InvoiceData['paymentDetails'],
    poStatus: String(raw.poStatus || ''),
  };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function PaymentPage() {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | PaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadInvoice, setUploadInvoice] = useState<InvoiceData | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await accountsApi.listInvoices(true);
      setInvoices(((res.data as Record<string, unknown>[]) || []).map(mapApiInvoice));
    } catch (err) {
      setInvoices([]);
      showToast(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tabs: { key: 'all' | PaymentStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'Pending Payment', label: 'Pending' },
    { key: 'Paid', label: 'Paid' },
  ];

  const filtered = invoices.filter((inv) => {
    const matchTab = activeTab === 'all' || inv.paymentStatus === activeTab;
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.vendor.toLowerCase().includes(q) ||
      inv.poNumber.toLowerCase().includes(q) ||
      inv.grnNumber.toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  const handleUploadPayment = (invoice: InvoiceData) => {
    if (invoice.paymentStatus === 'Paid') {
      showToast('Payment already recorded');
      return;
    }
    setUploadInvoice(invoice);
  };

  const handlePaymentSubmit = async (paymentData: PaymentData) => {
    if (!uploadInvoice?.id) return;
    try {
      let fileData: string | undefined;
      let fileName: string | undefined;
      if (paymentData.receiptFile) {
        fileData = await fileToBase64(paymentData.receiptFile);
        fileName = paymentData.receiptFile.name;
      }
      await accountsApi.uploadPayment(uploadInvoice.id, {
        paymentDate: paymentData.paymentDate,
        paymentMode: paymentData.paymentMode,
        bankAccount: paymentData.bankAccount,
        utrReference: paymentData.utrReference,
        amountPaid: paymentData.amountPaid,
        remarks: paymentData.remarks,
        fileName,
        fileData,
      });
      setUploadInvoice(null);
      showToast('Payment uploaded — PO status set to Paid');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment upload failed');
      throw err;
    }
  };

  const pendingCount = invoices.filter((inv) => inv.paymentStatus === 'Pending Payment').length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {toast && (
          <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-teal-700 text-white text-sm rounded-lg shadow-lg">
            {toast}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Payment Processing</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload payment proof for manager-approved invoices (updates PO to Paid)
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
            <i className="ri-bank-card-line text-teal-600 text-base"></i>
            <span className="text-sm font-medium text-teal-700">Accounts Team</span>
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-teal-600 text-white text-xs font-semibold rounded-full">
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        <PaymentStatsCards invoices={invoices} />

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-0 gap-4 flex-wrap">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
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
                <i className="ri-search-line text-gray-400"></i>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice / PO / vendor"
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading…</p>
          ) : (
            <PaymentTable
              invoices={filtered}
              expandedRow={expandedRow}
              onToggleRow={(invoiceNumber) =>
                setExpandedRow((prev) => (prev === invoiceNumber ? null : invoiceNumber))
              }
              onUploadPayment={handleUploadPayment}
              renderExpanded={(invoice) => <PaymentExpandedRow invoice={invoice} />}
            />
          )}
        </div>
      </div>

      {uploadInvoice && (
        <UploadPaymentModal
          isOpen
          onClose={() => setUploadInvoice(null)}
          invoice={{
            invoiceNumber: uploadInvoice.invoiceNumber,
            vendorName: uploadInvoice.vendor,
            invoiceAmount: uploadInvoice.invoiceGrandTotal,
            dueDate: uploadInvoice.dueDate,
          }}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </DashboardLayout>
  );
}
