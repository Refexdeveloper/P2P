import React from 'react';
import PriorityBadge from '../../../../components/base/PriorityBadge';

interface SLAAlertsProps {
  data: Array<{
    id: string;
    title: string;
    daysOverdue: number;
    priority: string;
    amount: number;
  }>;
}

const SLAAlerts: React.FC<SLAAlertsProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg border border-red-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <i className="ri-alarm-warning-fill text-red-600"></i>
        SLA Alerts
        <span className="ml-auto bg-red-100 text-red-600 text-xs font-semibold px-2 py-1 rounded-full">
          {data.length}
        </span>
      </h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {data.map((alert, index) => (
          <div
            key={index}
            className="bg-red-50 border border-red-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="text-sm font-medium text-teal-600">{alert.id}</div>
              <PriorityBadge priority={alert.priority} />
            </div>
            <div className="text-sm text-gray-900 font-medium mb-2">{alert.title}</div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <i className="ri-alarm-warning-line"></i>
                {alert.daysOverdue} days overdue
              </div>
              <div className="text-xs font-semibold text-gray-900">
                ₹{alert.amount.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SLAAlerts;