interface PriorityBadgeProps {
  priority: string;
  size?: 'sm' | 'md';
}

const PriorityBadge = ({ priority, size = 'sm' }: PriorityBadgeProps) => {
  const getPriorityStyles = (priority: string) => {
    const priorityMap: Record<string, { bg: string; text: string; icon: string }> = {
      high: { bg: 'bg-red-50', text: 'text-red-600', icon: 'ri-arrow-up-line' },
      medium: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'ri-subtract-line' },
      low: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'ri-arrow-down-line' }
    };

    return priorityMap[priority] || priorityMap.medium;
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm'
  };

  const styles = getPriorityStyles(priority);

  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-medium whitespace-nowrap ${styles.bg} ${styles.text} ${sizeClasses[size]}`}>
      <i className={`${styles.icon} text-xs`}></i>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};

export default PriorityBadge;