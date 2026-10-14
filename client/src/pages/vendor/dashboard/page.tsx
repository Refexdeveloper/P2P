import { useAuth } from '../../../contexts/AuthContext';
import {
  vendorKPIData,
  vendorAlerts,
  vendorRFQSummary,
  vendorPOSummary,
  vendorInvoiceSummary,
} from '../../../mocks/vendor-dashboard-data';
import VendorKPIStrip from './components/VendorKPIStrip';
import VendorAlertsPanel from './components/VendorAlertsPanel';
import VendorRFQWidget from './components/VendorRFQWidget';
import VendorPOWidget from './components/VendorPOWidget';
import VendorInvoiceWidget from './components/VendorInvoiceWidget';
import '../../../styles/dashboard-fx.css';

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const fmtAmt = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(2)} Cr`
    : n >= 100000
      ? `₹${(n / 100000).toFixed(2)} L`
      : `₹${n.toLocaleString('en-IN')}`;

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="tasks-fx min-h-screen flex-1 overflow-y-auto font-sans text-[#0F172A]">
      <section className="tfx-hero">
        <div className="tfx-bubbles" aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i />
        </div>
        <div className="tfx-hero-content">
          <div className="tfx-hi">
            {greetingForNow()}, <span className="tfx-wave">👋</span>
          </div>
          <h1>
            <span className="tfx-shimmer">{user?.name?.split(' ')[0] ?? 'Vendor'}</span>
          </h1>
          <p>
            {today}
            <span className="tfx-role-inline"> · Vendor Portal</span>
          </p>
        </div>
        <div className="tfx-period hidden min-[992px]:block">
          <p className="tfx-period-lbl">Pending payment</p>
          <div className="flex items-center gap-3 px-1 pb-1">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <i className="ri-time-line text-xl" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold tabular-nums text-slate-900">
                {fmtAmt(vendorKPIData.totalPendingPayment)}
              </p>
              <p className="text-xs text-slate-500">
                Active orders {fmtAmt(vendorKPIData.totalActiveOrderValue)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-[4] space-y-5 px-4 pb-8 pt-2 sm:px-6">
        <VendorKPIStrip data={vendorKPIData} />

        <section className="tfx-panel overflow-hidden rounded-2xl border border-white/70 bg-white px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Vendor Workflow Status
          </p>
          <div className="flex flex-wrap items-center gap-0">
            {[
              { label: 'RFQ Received', value: vendorKPIData.openRFQs, icon: 'ri-file-list-3-line', done: true },
              {
                label: 'Quote Submitted',
                value: vendorKPIData.openRFQs - vendorKPIData.pendingQuotes,
                icon: 'ri-send-plane-line',
                done: vendorKPIData.pendingQuotes === 0,
              },
              {
                label: 'PO Accepted',
                value: vendorKPIData.acceptedPOs,
                icon: 'ri-shake-hands-line',
                done: vendorKPIData.pendingPOAcceptance === 0,
              },
              {
                label: 'Invoice Submitted',
                value: vendorKPIData.openRFQs - vendorKPIData.draftInvoices,
                icon: 'ri-file-invoice-line',
                done: vendorKPIData.draftInvoices === 0,
              },
              {
                label: 'Payment Received',
                value: vendorKPIData.paidInvoices,
                icon: 'ri-checkbox-circle-line',
                done: false,
              },
            ].map((step, idx, arr) => (
              <div key={step.label} className="flex items-center">
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 ${
                    step.done ? 'bg-[#e6f6f8]' : 'bg-slate-50'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      step.done ? 'bg-[#e6f6f8] text-[#0f6b7a]' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <i className={`${step.icon} text-sm`} />
                  </div>
                  <div>
                    <p
                      className={`text-xs font-semibold leading-tight ${
                        step.done ? 'text-[#0b5561]' : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className={`text-xs ${step.done ? 'text-[#0f6b7a]' : 'text-slate-400'}`}>
                      {step.value} item{step.value !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {idx < arr.length - 1 && <div className="h-px w-8 flex-shrink-0 bg-slate-200" />}
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            <VendorRFQWidget data={vendorRFQSummary} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <VendorPOWidget data={vendorPOSummary} />
              <VendorInvoiceWidget data={vendorInvoiceSummary} />
            </div>
          </div>
          <div>
            <VendorAlertsPanel alerts={vendorAlerts} />
          </div>
        </div>

        <section className="tfx-panel overflow-hidden rounded-2xl border border-white/70 bg-white px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                icon: 'ri-price-tag-3-line',
                label: 'Submit Quotation',
                desc: 'Respond to open RFQs',
                path: '/scm/vendor-quotation-portal',
              },
              {
                icon: 'ri-shake-hands-line',
                label: 'Accept PO',
                desc: 'Review & confirm POs',
                path: '/scm/vendor-po-acceptance',
              },
              {
                icon: 'ri-file-invoice-line',
                label: 'Submit Invoice',
                desc: 'Send invoices for payment',
                path: '/scm/vendor-invoice',
              },
              {
                icon: 'ri-search-eye-line',
                label: 'Track Status',
                desc: 'Follow up on submissions',
                path: '/scm/vendor-invoice',
              },
            ].map((action) => (
              <a
                key={action.label}
                href={action.path}
                className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#e6f6f8] p-3 text-[#0f6b7a] transition-colors hover:bg-[#d5eef2]"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
                  <i className={`${action.icon} text-xl`} />
                </div>
                <div className="min-w-0">
                  <p className="whitespace-nowrap text-sm font-semibold leading-tight">{action.label}</p>
                  <p className="text-xs leading-tight opacity-70">{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
