import { activities } from '../../mocks/procurement-data';

const ActivityTimeline = () => {
  const getActivityIcon = (type: string) => {
    const iconMap: Record<string, { icon: string; color: string }> = {
      approval: { icon: 'ri-checkbox-circle-line', color: 'bg-emerald-100 text-emerald-600' },
      creation: { icon: 'ri-add-circle-line', color: 'bg-blue-100 text-blue-600' },
      rejection: { icon: 'ri-close-circle-line', color: 'bg-red-100 text-red-600' },
      payment: { icon: 'ri-money-dollar-circle-line', color: 'bg-green-100 text-green-600' },
      delivery: { icon: 'ri-truck-line', color: 'bg-indigo-100 text-indigo-600' }
    };

    return iconMap[type] || { icon: 'ri-information-line', color: 'bg-slate-100 text-slate-600' };
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer whitespace-nowrap">
          View All
        </button>
      </div>

      <div className="space-y-4">
        {activities.map((activity, index) => {
          const iconData = getActivityIcon(activity.type);
          return (
            <div key={activity.id} className="relative">
              {index !== activities.length - 1 && (
                <div className="absolute left-5 top-10 bottom-0 w-px bg-slate-200"></div>
              )}
              <div className="flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconData.color}`}>
                  <i className={`${iconData.icon} text-lg`}></i>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        <span className="font-semibold">{activity.user}</span>
                        {' '}
                        <span className="text-slate-600">{activity.action}</span>
                        {' '}
                        <span className="font-medium text-blue-600">{activity.target}</span>
                      </p>
                      <p className="text-sm text-slate-500 mt-1">{activity.description}</p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityTimeline;