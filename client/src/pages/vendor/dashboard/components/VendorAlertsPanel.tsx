import { VendorAlertItem } from '../../../../mocks/vendor-dashboard-data';

interface Props {
  alerts: VendorAlertItem[];
}

const urgencyConfig = {
  critical: { bg: 'bg-red-50 border-red-200', icon: 'ri-alarm-warning-line', iconColor: 'text-red-500', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50 border-amber-200', icon: 'ri-error-warning-line', iconColor: 'text-amber-500', dot: 'bg-amber-500' },
  info: { bg: 'bg-sky-50 border-sky-200', icon: 'ri-information-line', iconColor: 'text-sky-500', dot: 'bg-sky-500' },
  success: { bg: 'bg-green-50 border-green-200', icon: 'ri-checkbox-circle-line', iconColor: 'text-green-500', dot: 'bg-green-500' },
};

const fmtTime = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtAmt = (n?: number) => {
  if (!n) return null;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
};

export default function VendorAlertsPanel({ alerts }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 flex items-center justify-center">
            <i className="ri-notification-3-line text-teal-600 text-lg"></i>
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Alerts &amp; Activity</h3>
        </div>
        <span className="text-xs text-gray-400">{alerts.length} notifications</span>
      </div>

      <div className="divide-y divide-gray-50">
        {alerts.map((alert) => {
          const cfg = urgencyConfig[alert.urgency];
          return (
            <div key={alert.id} className={`flex gap-3 px-5 py-3.5 border-l-4 ${cfg.bg} ${alert.urgency === 'critical' ? 'border-l-red-400' : alert.urgency === 'warning' ? 'border-l-amber-400' : alert.urgency === 'success' ? 'border-l-green-400' : 'border-l-sky-400'}`}>
              <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.iconColor}`}>
                <i className={`${cfg.icon} text-base`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">{alert.title}</p>
                  {alert.amount && (
                    <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">{fmtAmt(alert.amount)}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{alert.refNumber}</span>
                  <span className="text-xs text-gray-400">{fmtTime(alert.timestamp)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
