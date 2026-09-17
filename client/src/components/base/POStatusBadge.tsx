interface POStatusBadgeProps {
  status: string;
}

export default function POStatusBadge({ status }: POStatusBadgeProps) {
  const s = String(status || '');

  const getStatusConfig = () => {
    if (s === 'Pending Approval' || s === 'Pending SCM Manager Sign') {
      return {
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-700',
        icon: 'ri-time-line',
        label: s,
      };
    }
    if (s === 'PO Approved' || s === 'WO Approved') {
      return {
        bgColor: 'bg-emerald-100',
        textColor: 'text-emerald-700',
        icon: 'ri-checkbox-circle-line',
        label: s,
      };
    }
    if (s === 'PO Rejected' || s === 'WO Rejected') {
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        icon: 'ri-close-circle-line',
        label: s,
      };
    }
    return {
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      icon: 'ri-information-line',
      label: s || 'Unknown',
    };
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      <i className={`${config.icon} text-sm`}></i>
      {config.label}
    </span>
  );
}
