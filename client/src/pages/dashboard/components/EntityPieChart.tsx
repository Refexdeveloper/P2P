import { useState } from 'react';

type Entity = {
  entityName: string;
  code: string;
  totalPOAmount: number;
  color: string;
};

const formatCurrency = (value: number) => {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
};

export default function EntityPieChart({ entities }: { entities: Entity[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = entities.reduce((sum, e) => sum + e.totalPOAmount, 0);

  if (!entities.length || total <= 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Entity-wise PO Distribution</h3>
        <p className="text-sm text-gray-500 py-8 text-center">No PO spend data yet.</p>
      </div>
    );
  }

  let cumulativePercent = 0;
  const segments = entities.map((item) => {
    const percent = (item.totalPOAmount / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { ...item, percent, startPercent };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Entity-wise PO Distribution</h3>
      <div className="flex items-center justify-center mb-4">
        <div className="relative w-44 h-44">
          <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
            {segments.map((segment, index) => {
              const startAngle = (segment.startPercent / 100) * 360;
              const endAngle = ((segment.startPercent + segment.percent) / 100) * 360;
              const largeArcFlag = segment.percent > 50 ? 1 : 0;
              const r = hoveredIndex === index ? 43 : 40;
              const startX = 50 + r * Math.cos((startAngle * Math.PI) / 180);
              const startY = 50 + r * Math.sin((startAngle * Math.PI) / 180);
              const endX = 50 + r * Math.cos((endAngle * Math.PI) / 180);
              const endY = 50 + r * Math.sin((endAngle * Math.PI) / 180);
              return (
                <path
                  key={index}
                  d={`M 50 50 L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                  fill={segment.color}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
            <circle cx="50" cy="50" r="26" fill="white" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              {hoveredIndex !== null ? (
                <>
                  <p className="text-xs font-bold text-gray-900">
                    {formatCurrency(segments[hoveredIndex].totalPOAmount)}
                  </p>
                  <p className="text-xs text-gray-500">{segments[hoveredIndex].percent.toFixed(0)}%</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(total)}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {entities.map((item, index) => (
          <div
            key={`${item.entityName}-${index}`}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${hoveredIndex === index ? 'bg-gray-50' : ''}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center space-x-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-xs text-gray-700 truncate max-w-[120px]">{item.entityName}</span>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-900">{formatCurrency(item.totalPOAmount)}</p>
              <p className="text-xs text-gray-400">
                {((item.totalPOAmount / total) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
