interface PriorityBadgeProps {
  priority: string;
  size?: 'sm' | 'md';
}

const PriorityBadge = ({ priority, size = 'sm' }: PriorityBadgeProps) => {
  const key = String(priority || '')
    .trim()
    .toLowerCase();

  const getPriorityStyles = (p: string) => {
    const priorityMap: Record<string, { bg: string; text: string }> = {
      critical: { bg: 'bg-rose-50', text: 'text-rose-700' },
      high: { bg: 'bg-red-50', text: 'text-red-600' },
      medium: { bg: 'bg-amber-50', text: 'text-amber-600' },
      low: { bg: 'bg-slate-50', text: 'text-slate-600' },
    };
    return priorityMap[p] || priorityMap.medium;
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const styles = getPriorityStyles(key);
  const label = key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Medium';

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium whitespace-nowrap ${styles.bg} ${styles.text} ${sizeClasses[size]}`}
    >
      {label}
    </span>
  );
};

export default PriorityBadge;
