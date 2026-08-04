import { statusDistribution } from '../../mocks/dashboard-stats';

export default function StatusPieChart() {
  const total = statusDistribution.reduce((sum, item) => sum + item.count, 0);
  
  let cumulativePercent = 0;
  const segments = statusDistribution.map((item) => {
    const percent = (item.count / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return {
      ...item,
      percent,
      startPercent
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Task Distribution</h3>
      
      <div className="flex items-center justify-center">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {segments.map((segment, index) => {
              const startAngle = (segment.startPercent / 100) * 360;
              const endAngle = ((segment.startPercent + segment.percent) / 100) * 360;
              const largeArcFlag = segment.percent > 50 ? 1 : 0;
              
              const startX = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
              const startY = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
              const endX = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
              const endY = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
              
              return (
                <path
                  key={index}
                  d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                  fill={segment.color}
                  className="transition-opacity hover:opacity-80 cursor-pointer"
                />
              );
            })}
            <circle cx="50" cy="50" r="25" fill="white" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{total}</p>
              <p className="text-xs text-gray-500">Total Tasks</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {statusDistribution.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-sm text-gray-700">{item.status}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-semibold text-gray-900">{item.count}</span>
              <span className="text-xs text-gray-500">
                {((item.count / total) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
