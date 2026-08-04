interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

type Status = 'pending_approval' | 'approved' | 'rejected' | 'in_review' | 'draft' | 'returned' | 'po_issued';

const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const getStatusStyles = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
      returned: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Returned' },
      pending_approval: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval' },
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
      in_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Review' },
      issued: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Issued' },
      delivered: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Delivered' },
      pending: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pending' },
      paid: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid' },
      pending_payment: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Payment' },
      under_review: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Under Review' },
      active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
      inactive: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Inactive' },
      'Pending Approval': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending Approval' },
      'Pending HOD Approval': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending HOD' },
      'Pending CFO Approval': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending CFO' },
      Approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
      Rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
      'Returned for Rework': { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Returned' },
    };

    return statusMap[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const styles = getStatusStyles(status);

  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${styles.bg} ${styles.text} ${sizeClasses[size]}`}>
      {styles.label}
    </span>
  );
};

export default StatusBadge;