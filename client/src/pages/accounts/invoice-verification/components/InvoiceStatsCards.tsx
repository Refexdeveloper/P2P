import { InvoiceData } from '../../../../mocks/invoice-data';

interface Props {
  invoices: InvoiceData[];
}

const CARDS: Array<{
  key: keyof ReturnType<typeof buildStats>;
  label: string;
  icon: string;
  border: string;
  text: string;
  iconBg: string;
}> = [
  {
    key: 'pendingVerification',
    label: 'Pending Verification',
    icon: 'ri-time-line',
    border: 'border-orange-200',
    text: 'text-orange-600',
    iconBg: 'bg-orange-100',
  },
  {
    key: 'matched',
    label: 'Matched',
    icon: 'ri-checkbox-circle-line',
    border: 'border-green-200',
    text: 'text-green-600',
    iconBg: 'bg-green-100',
  },
  {
    key: 'pendingManager',
    label: 'Pending Manager',
    icon: 'ri-user-star-line',
    border: 'border-blue-200',
    text: 'text-blue-600',
    iconBg: 'bg-blue-100',
  },
  {
    key: 'discrepancy',
    label: 'Discrepancy',
    icon: 'ri-error-warning-line',
    border: 'border-red-200',
    text: 'text-red-600',
    iconBg: 'bg-red-100',
  },
  {
    key: 'onHold',
    label: 'On Hold',
    icon: 'ri-pause-circle-line',
    border: 'border-yellow-200',
    text: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
  },
  {
    key: 'approved',
    label: 'Approved',
    icon: 'ri-shield-check-line',
    border: 'border-teal-200',
    text: 'text-teal-600',
    iconBg: 'bg-teal-100',
  },
];

function buildStats(invoices: InvoiceData[]) {
  return {
    pendingVerification: invoices.filter((i) => i.status === 'Pending Verification').length,
    matched: invoices.filter((i) => i.status === 'Matched').length,
    pendingManager: invoices.filter((i) => i.status === 'Pending Manager Approval').length,
    discrepancy: invoices.filter((i) => i.status === 'Discrepancy').length,
    onHold: invoices.filter((i) => i.status === 'On Hold').length,
    approved: invoices.filter((i) => i.status === 'Approved for Payment').length,
  };
}

export default function InvoiceStatsCards({ invoices }: Props) {
  const stats = buildStats(invoices);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-6 w-full min-w-0">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className={`bg-white rounded-xl p-3 sm:p-4 border ${card.border} shadow-sm min-w-0`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600 mb-1 leading-snug break-words">
                {card.label}
              </p>
              <p className={`text-2xl sm:text-3xl font-bold ${card.text} tabular-nums`}>
                {stats[card.key]}
              </p>
            </div>
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 ${card.iconBg} rounded-lg flex items-center justify-center shrink-0`}
            >
              <i className={`${card.icon} text-lg sm:text-xl ${card.text}`}></i>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
