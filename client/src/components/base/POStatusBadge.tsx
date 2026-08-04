import { useState } from 'react';

interface POStatusBadgeProps {
  status: 'Pending Approval' | 'PO Approved' | 'PO Rejected';
}

export default function POStatusBadge({ status }: POStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'Pending Approval':
        return {
          bgColor: 'bg-amber-100',
          textColor: 'text-amber-700',
          icon: 'ri-time-line',
          label: 'Pending Approval'
        };
      case 'PO Approved':
        return {
          bgColor: 'bg-emerald-100',
          textColor: 'text-emerald-700',
          icon: 'ri-checkbox-circle-line',
          label: 'PO Approved'
        };
      case 'PO Rejected':
        return {
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          icon: 'ri-close-circle-line',
          label: 'PO Rejected'
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-700',
          icon: 'ri-information-line',
          label: status
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <i className={`${config.icon} text-sm`}></i>
      {config.label}
    </span>
  );
}