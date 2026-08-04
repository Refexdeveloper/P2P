
interface TaskStatsProps {
  stats: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    dueSoon: number;
  };
}

export default function TaskStats({ stats }: TaskStatsProps) {
  const cards = [
    { label: 'Total Tasks', value: stats.total, icon: 'ri-task-line', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
    { label: 'Pending', value: stats.pending, icon: 'ri-time-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    { label: 'In Progress', value: stats.inProgress, icon: 'ri-loader-4-line', bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
    { label: 'Completed', value: stats.completed, icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    { label: 'Overdue', value: stats.overdue, icon: 'ri-alarm-warning-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    { label: 'Due Soon', value: stats.dueSoon, icon: 'ri-timer-flash-line', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} border ${card.border} rounded-lg p-3.5 transition-all hover:shadow-sm cursor-default`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <div className={`w-7 h-7 rounded-md ${card.bg} flex items-center justify-center`}>
              <i className={`${card.icon} ${card.text} text-base`}></i>
            </div>
          </div>
          <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
        </div>
      ))}
    </div>
  );
}
