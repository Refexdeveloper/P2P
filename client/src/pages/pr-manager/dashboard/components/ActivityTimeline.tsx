import React from 'react';

interface ActivityTimelineProps {
  data: Array<{
    id: string;
    action: string;
    user: string;
    amount: number;
    time: string;
    type: 'approval' | 'rejection';
  }>;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <i className="ri-time-line text-teal-600"></i>
        Recent Activity
      </h3>
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {data.map((activity, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  activity.type === 'approval'
                    ? 'bg-green-100 text-green-600'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                <i
                  className={`text-sm ${
                    activity.type === 'approval' ? 'ri-check-line' : 'ri-close-line'
                  }`}
                ></i>
              </div>
              {index < data.length - 1 && <div className="w-0.5 h-12 bg-gray-200 my-1"></div>}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{activity.id}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {activity.action} • ₹{activity.amount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-1">{activity.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;