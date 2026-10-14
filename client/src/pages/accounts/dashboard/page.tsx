import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import AnimatedKpiCard, { type KpiVariant } from '../../../components/feature/AnimatedKpiCard';
import { accountsApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import '../../../styles/dashboard-fx.css';

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const cards: Array<{
    label: string;
    value: number;
    href: string;
    icon: string;
    variant: KpiVariant;
    sub: string;
  }> = [
    {
      label: 'Awaiting Invoice Upload',
      value: data?.invoices.awaitingUpload ?? 0,
      href: '/accounts/invoice-verification',
      icon: 'ri-upload-cloud-2-line',
      variant: 'all',
      sub: 'Upload pending',
    },
    {
      label: 'Pending Verification',
      value: data?.invoices.pendingVerification ?? 0,
      href: '/accounts/invoice-verification',
      icon: 'ri-file-search-line',
      variant: 'pending_approval',
      sub: '3-way match queue',
    },
    {
      label: 'Manager Approval',
      value: data?.invoices.pendingManagerApproval ?? 0,
      href: '/accounts/invoice-verification',
      icon: 'ri-shield-user-line',
      variant: 'returned',
      sub: 'Awaiting manager',
    },
    {
      label: 'Ready for Payment',
      value: data?.invoices.readyForPayment ?? 0,
      href: '/accounts/payment',
      icon: 'ri-bank-card-line',
      variant: 'approved',
      sub: 'Payment queue',
    },
  ];
  const kpiTotal = cards.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

  return (
    <DashboardLayout>
      <div className="tasks-fx min-h-full font-sans text-[#0F172A]">
        <section className="tfx-hero">
          <div className="tfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className="tfx-hero-content">
            <div className="tfx-hi">
              {greetingForNow()}, <span className="tfx-wave">👋</span>
            </div>
            <h1>
              <span className="tfx-shimmer">{user?.name || 'User'}</span>
            </h1>
            <p>
              Invoice verification, payments, and PO fulfillment
              <span className="tfx-role-inline"> · Accounts</span>
            </p>
          </div>
          <div className="tfx-period hidden min-[992px]:block">
            <p className="tfx-period-lbl">Pending payment value</p>
            <div className="flex items-center gap-3 px-1 pb-1">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]">
                <i className="ri-money-rupee-circle-line text-xl" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold tabular-nums text-slate-900">
                  {formatCurrency(data?.invoices.pendingPaymentValue || 0)}
                </p>
                <p className="text-xs text-slate-500">Awaiting payment release</p>
              </div>
            </div>
          </div>
        </section>

        <section className="tfx-kpis mb-4">
          {loading && !data ? (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="min-h-[170px] animate-pulse rounded-[18px] bg-white/90 shadow-[0_10px_30px_rgba(20,90,120,0.08)]"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
              {cards.map((card, i) => (
                <AnimatedKpiCard
                  key={card.label}
                  title={card.label}
                  value={card.value}
                  variant={card.variant}
                  index={i}
                  total={kpiTotal}
                  subtitle={card.sub}
                  live={card.value > 0}
                  fallbackIcon={card.icon}
                  toastText={`Opening ${card.label}`}
                  onClick={() => navigate(card.href)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="p-2 pb-6 pt-0 sm:p-4 sm:pt-0 lg:p-6 lg:pt-0">
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={load} className="tfx-btn secondary">
              <i className="ri-refresh-line text-lg" />
              <span>Refresh</span>
            </button>
            <Link to="/accounts/invoice-verification" className="tfx-btn primary">
              <i className="ri-file-search-line text-lg" />
              <span>Invoice verification</span>
            </Link>
            <Link to="/accounts/payment" className="tfx-btn secondary">
              <i className="ri-bank-card-line text-lg" />
              <span>Payments</span>
            </Link>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mb-5 grid grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-3">
            <div className="tfx-panel rounded-2xl border border-white/70 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pending amount</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-[#0f6b7a]">
                {formatCurrency(data?.invoices.pendingPaymentValue || 0)}
              </p>
            </div>
            <div className="tfx-panel rounded-2xl border border-white/70 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Paid value</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">
                {formatCurrency(data?.invoices.paidValue || 0)}
              </p>
            </div>
            <div className="tfx-panel rounded-2xl border border-white/70 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PO paid</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{data?.po.paid ?? 0}</p>
            </div>
          </div>

          <section className="tfx-panel relative overflow-hidden rounded-2xl border border-white/70 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-3.5">
                <div className="tfx-panel-ic flex h-12 w-12 items-center justify-center rounded-xl">
                  <i className="ri-file-list-3-line text-lg sm:text-xl" aria-hidden />
                </div>
                <div>
                  <h2 className="tfx-panel-title text-lg font-semibold text-slate-900">Recent invoices</h2>
                  <p className="mt-1.5 text-sm text-slate-500">Latest invoice activity across PO / GRN</p>
                </div>
              </div>
              <Link to="/accounts/invoice-verification" className="tfx-btn secondary sm">
                Open 3-way match <i className="ri-arrow-right-line" aria-hidden />
              </Link>
            </div>
            <div className="overflow-x-auto px-4 pb-4">
              <table className="rfx-table w-full min-w-[720px] border-separate border-spacing-x-0 border-spacing-y-2.5 text-sm">
                <thead>
                  <tr>
                    {['Invoice', 'PO / GRN', 'Vendor', 'Amount', 'Invoice status', 'PO status'].map((h) => (
                      <th
                        key={h}
                        className={`tfx-th px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500 first:pl-5 last:pr-5 ${
                          h === 'Amount' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.recent || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                        No invoices yet — submit a GRN to create the invoice base entry
                      </td>
                    </tr>
                  ) : (
                    data?.recent.map((row, rowIndex) => (
                      <tr
                        key={row.id}
                        className="rfx-row tone-teal"
                        style={{ '--r': rowIndex } as CSSProperties}
                      >
                        <td className="pl-5 pr-3 font-semibold text-[#0f6b7a]">{row.invoiceNumber}</td>
                        <td className="px-3 text-slate-700">
                          {row.poNumber}
                          {row.grnNumber ? (
                            <span className="block text-xs text-slate-400">{row.grnNumber}</span>
                          ) : null}
                        </td>
                        <td className="px-3 text-slate-700">{row.vendor}</td>
                        <td className="px-3 text-right font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                        <td className="px-3">
                          <span className="inline-flex rounded-full bg-[#e6f6f8] px-2 py-1 text-xs font-semibold text-[#0f6b7a]">
                            {row.status}
                          </span>
                        </td>
                        <td className="pr-5 pl-3 text-xs font-medium text-slate-600">{row.poStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
