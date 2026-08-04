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
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Welcome back, {user?.name?.split(' ')[0] ?? 'Vendor'} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{today} · Vendor Portal Overview</p>
          </div>

          {/* Value banners */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-time-line text-amber-500 text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium leading-tight">Pending Payment</p>
                <p className="text-sm font-bold text-amber-700">{fmtAmt(vendorKPIData.totalPendingPayment)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-bar-chart-box-line text-teal-500 text-sm"></i>
              </div>
              <div>
                <p className="text-xs text-teal-600 font-medium leading-tight">Active Order Value</p>
                <p className="text-sm font-bold text-teal-700">{fmtAmt(vendorKPIData.totalActiveOrderValue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Strip */}
        <VendorKPIStrip data={vendorKPIData} />

        {/* Workflow Progress Banner */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Vendor Workflow Status</p>
          <div className="flex items-center gap-0 flex-wrap">
            {[
              { label: 'RFQ Received', value: vendorKPIData.openRFQs, icon: 'ri-file-list-3-line', done: true },
              { label: 'Quote Submitted', value: vendorKPIData.openRFQs - vendorKPIData.pendingQuotes, icon: 'ri-send-plane-line', done: vendorKPIData.pendingQuotes === 0 },
              { label: 'PO Accepted', value: vendorKPIData.acceptedPOs, icon: 'ri-shake-hands-line', done: vendorKPIData.pendingPOAcceptance === 0 },
              { label: 'Invoice Submitted', value: vendorKPIData.openRFQs - vendorKPIData.draftInvoices, icon: 'ri-file-invoice-line', done: vendorKPIData.draftInvoices === 0 },
              { label: 'Payment Received', value: vendorKPIData.paidInvoices, icon: 'ri-checkbox-circle-line', done: false },
            ].map((step, idx, arr) => (
              <div key={step.label} className="flex items-center">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${step.done ? 'bg-teal-50' : 'bg-gray-50'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${step.done ? 'bg-teal-100' : 'bg-gray-200'}`}>
                    <i className={`${step.icon} text-sm ${step.done ? 'text-teal-600' : 'text-gray-400'}`}></i>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold leading-tight ${step.done ? 'text-teal-700' : 'text-gray-500'}`}>{step.label}</p>
                    <p className={`text-xs ${step.done ? 'text-teal-500' : 'text-gray-400'}`}>{step.value} item{step.value !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <div className="w-8 h-px bg-gray-200 flex-shrink-0"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 3 workflow widgets */}
          <div className="lg:col-span-2 space-y-5">
            <VendorRFQWidget data={vendorRFQSummary} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <VendorPOWidget data={vendorPOSummary} />
              <VendorInvoiceWidget data={vendorInvoiceSummary} />
            </div>
          </div>

          {/* Right: Alerts panel */}
          <div className="lg:col-span-1">
            <VendorAlertsPanel alerts={vendorAlerts} />
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: 'ri-price-tag-3-line', label: 'Submit Quotation', desc: 'Respond to open RFQs', path: '/scm/vendor-quotation-portal', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
              { icon: 'ri-shake-hands-line', label: 'Accept PO', desc: 'Review & confirm POs', path: '/scm/vendor-po-acceptance', color: 'text-orange-600 bg-orange-50 hover:bg-orange-100' },
              { icon: 'ri-file-invoice-line', label: 'Submit Invoice', desc: 'Send invoices for payment', path: '/scm/vendor-invoice', color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
              { icon: 'ri-search-eye-line', label: 'Track Status', desc: 'Follow up on submissions', path: '/scm/vendor-invoice', color: 'text-teal-600 bg-teal-50 hover:bg-teal-100' },
            ].map((action) => (
              <a
                key={action.label}
                href={action.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${action.color}`}
              >
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <i className={`${action.icon} text-xl`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight whitespace-nowrap">{action.label}</p>
                  <p className="text-xs opacity-70 leading-tight">{action.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
