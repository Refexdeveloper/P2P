import { Link } from 'react-router-dom';

interface Activity {
  id: string;
  type: string;
  prId: string;
  entity: string;
  amount: number;
  user: string;
  timestamp: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

function poDetailPath(activity: Activity) {
  const poId = Number(activity.id);
  if (Number.isFinite(poId) && poId > 0) return `/dashboard/po/${poId}`;
  if (activity.prId) return `/dashboard/po?poNumber=${encodeURIComponent(activity.prId)}`;
  return null;
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'approved':
        return 'ri-checkbox-circle-line';
      case 'rejected':
        return 'ri-close-circle-line';
      case 'submitted':
        return 'ri-file-add-line';
      case 'info requested':
        return 'ri-question-line';
      default:
        return 'ri-file-line';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'approved':
        return 'text-teal-600 bg-teal-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'submitted':
        return 'text-blue-600 bg-blue-50';
      case 'info requested':
        return 'text-amber-600 bg-amber-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <i className="ri-time-line text-teal-600"></i>
        Recent Activity
      </h3>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No recent CFO activity yet.</p>
        ) : (
          activities.map((activity, index) => {
            const href = poDetailPath(activity);
            const body = (
              <>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    <i className={`${getActivityIcon(activity.type)} text-sm`}></i>
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-0.5 flex-1 bg-gray-200 mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-4 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.type}</p>
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {activity.prId} •{' '}
                    <span
                      className={
                        href
                          ? 'text-teal-700 font-medium underline-offset-2 group-hover:underline'
                          : undefined
                      }
                    >
                      {activity.entity}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-gray-900 mt-1">
                    ₹{(activity.amount / 100000).toFixed(2)}L
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                </div>
              </>
            );

            if (!href) {
              return (
                <div key={activity.id} className="flex gap-3">
                  {body}
                </div>
              );
            }

            return (
              <Link
                key={activity.id}
                to={href}
                className="group flex gap-3 rounded-lg -mx-1 px-1 hover:bg-white/80 transition-colors"
                title={`Open PO details — ${activity.entity}`}
              >
                {body}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
