import React from 'react';

interface DepartmentBudgetProps {
  data: Array<{
    department: string;
    allocated: number;
    utilized: number;
    percentage: number;
  }>;
}

const DepartmentBudget: React.FC<DepartmentBudgetProps> = ({ data }) => {
  const getColorClass = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-teal-500';
    return 'bg-green-500';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">Department-wise Budget Utilization</h2>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">&lt;50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-teal-500 rounded"></div>
            <span className="text-gray-600">50-75%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-gray-600">75-90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">&gt;90%</span>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {data.map((dept, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">{dept.department}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  ₹{(dept.utilized / 100000).toFixed(1)}L / ₹{(dept.allocated / 100000).toFixed(1)}L
                </span>
                <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                  {dept.percentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${getColorClass(dept.percentage)}`}
                style={{ width: `${dept.percentage}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DepartmentBudget;