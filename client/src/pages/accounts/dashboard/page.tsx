import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import SoftInsightCard, { INSIGHT_THEME_CYCLE } from '../../../components/base/SoftInsightCard';
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
      icon: 'ri-upload-cloud-2-line',
    },
    {
      label: 'Pending Verification',
      value: data?.invoices.pendingVerification ?? 0,
      href: '/accounts/invoice-verification',
      icon: 'ri-file-search-line',
    },
    {
      label: 'Manager Approval',
      value: data?.invoices.pendingManagerApproval ?? 0,
      href: '/accounts/invoice-verification',
      icon: 'ri-shield-user-line',
    },
    {
      label: 'Ready for Payment',
      value: data?.invoices.readyForPayment ?? 0,
      href: '/accounts/payment',
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
            className="px-4 py-2 text-sm font-semibold text-[#1565C0] bg-[#E3F2FD] border border-[#90CAF9] rounded-lg hover:bg-[#BBDEFB] cursor-pointer"
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
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              {cards.map((c, i) => (
                <Link key={c.label} to={c.href} className="block h-full">
                  <SoftInsightCard
                    title={c.label}
                    value={c.value}
                    icon={c.icon}
                    theme={INSIGHT_THEME_CYCLE[i % INSIGHT_THEME_CYCLE.length]}
                  />
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-3">
              <SoftInsightCard
                title="Pending payment value"
                value={formatCurrency(data?.invoices.pendingPaymentValue || 0)}
                icon="ri-time-line"
                theme="orange"
              />
              <SoftInsightCard
                title="Paid value"
                value={formatCurrency(data?.invoices.paidValue || 0)}
                icon="ri-checkbox-circle-line"
                theme="green"
              />
              <SoftInsightCard
                title="PO paid"
                value={data?.po.paid ?? 0}
                icon="ri-file-check-line"
                theme="blue"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Recent invoices</h2>
                <Link to="/accounts/invoice-verification" className="text-sm font-semibold text-[#1E88E5]">
                  Open 3-way match →
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
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-[#E3F2FD] text-[#1565C0]">
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
