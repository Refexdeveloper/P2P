interface Alert {
  id: string;
  prId: string;
  title: string;
  entity: string;
  amount: number;
  priority: string;
  daysWaiting: number;
}

interface HighValueAlertsProps {
  alerts: Alert[];
}

export default function HighValueAlerts({ alerts }: HighValueAlertsProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-amber-600 bg-amber-50';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <i className="ri-alarm-warning-line text-red-600"></i>
          High Value Alerts
        </h3>
        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
          {alerts.length}
        </span>
      </div>
      <div className="space-y-3">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <i className="ri-vip-crown-line text-red-600"></i>
                <p className="font-semibold text-gray-900 text-sm">{alert.prId}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(alert.priority)}`}>
                {alert.priority}
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{alert.title}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">{alert.entity}</p>
              <p className="text-sm font-bold text-gray-900">
                ₹{(alert.amount / 100000).toFixed(2)}L
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-700 font-medium">
                <i className="ri-time-line mr-1"></i>
                Waiting {alert.daysWaiting} days
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}