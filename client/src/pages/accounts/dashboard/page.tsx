import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { accountsApi } from '../../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

type Dash = {
  po: {
    awaitingGrn: number;
    invoiceEntry: number;
    pendingManager: number;
    approvedForPayment: number;
    paid: number;
  };
  invoices: {
    awaitingUpload: number;
    pendingVerification: number;
    pendingManagerApproval: number;
    readyForPayment: number;
    paidInvoices: number;
    pendingPaymentValue: number;
    paidValue: number;
  };
  recent: Array<{
    id: number;
    invoiceNumber: string;
    status: string;
    amount: number;
    poNumber: string;
    grnNumber: string;
    vendor: string;
    poStatus: string;
    updatedAt: string;
  }>;
};

export default function AccountsDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await accountsApi.dashboard();
      setData(res.data as unknown as Dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cards = [
    {
      label: 'Awaiting Invoice Upload',
      value: data?.invoices.awaitingUpload ?? 0,
      href: '/accounts/invoice-verification',
      color: 'from-amber-500 to-orange-500',
      icon: 'ri-upload-cloud-2-line',
    },
    {
      label: 'Pending Verification',
      value: data?.invoices.pendingVerification ?? 0,
      href: '/accounts/invoice-verification',
      color: 'from-sky-500 to-blue-600',
      icon: 'ri-file-search-line',
    },
    {
      label: 'Manager Approval',
      value: data?.invoices.pendingManagerApproval ?? 0,
      href: '/accounts/invoice-verification',
      color: 'from-violet-500 to-purple-600',
      icon: 'ri-shield-user-line',
    },
    {
      label: 'Ready for Payment',
      value: data?.invoices.readyForPayment ?? 0,
      href: '/accounts/payment',
      color: 'from-teal-500 to-emerald-600',
      icon: 'ri-bank-card-line',
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Accounts Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">
              GRN → Invoice upload → Manager approval → Payment · PO status updates at each step
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
        )}

        {loading && !data ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {cards.map((c) => (
                <Link
                  key={c.label}
                  to={c.href}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className={`h-1.5 bg-gradient-to-r ${c.color}`} />
                  <div className="p-5 flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{c.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{c.value}</p>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-teal-600">
                      <i className={`${c.icon} text-xl`} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase">Pending payment value</p>
                <p className="text-2xl font-bold text-amber-600 mt-2">
                  {formatCurrency(data?.invoices.pendingPaymentValue || 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase">Paid value</p>
                <p className="text-2xl font-bold text-emerald-600 mt-2">
                  {formatCurrency(data?.invoices.paidValue || 0)}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase">PO paid</p>
                <p className="text-2xl font-bold text-teal-700 mt-2">{data?.po.paid ?? 0}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Recent invoices</h2>
                <Link to="/accounts/invoice-verification" className="text-sm font-semibold text-teal-600">
                  Open verification →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Invoice</th>
                      <th className="px-4 py-3 text-left">PO / GRN</th>
                      <th className="px-4 py-3 text-left">Vendor</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-left">Invoice status</th>
                      <th className="px-4 py-3 text-left">PO status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(data?.recent || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                          No invoices yet — submit a GRN to create the invoice base entry
                        </td>
                      </tr>
                    ) : (
                      data?.recent.map((row) => (
                        <tr key={row.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.invoiceNumber}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {row.poNumber}
                            {row.grnNumber ? (
                              <span className="block text-xs text-gray-400">{row.grnNumber}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{row.vendor}</td>
                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-600">{row.poStatus}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
