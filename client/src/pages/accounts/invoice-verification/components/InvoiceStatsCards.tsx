import SoftInsightCard, { type InsightThemeName } from '../../../../components/base/SoftInsightCard';
import { InvoiceData, InvoiceStatus } from '../../../../mocks/invoice-data';

interface Props {
  invoices: InvoiceData[];
  filter: 'all' | InvoiceStatus;
  onFilter: (key: 'all' | InvoiceStatus) => void;
}

const CARDS: Array<{
  key: keyof ReturnType<typeof buildStats>;
  status: InvoiceStatus;
  label: string;
  icon: string;
  theme: InsightThemeName;
}> = [
  { key: 'pendingVerification', status: 'Pending Verification', label: 'Pending Verification', icon: 'ri-time-line', theme: 'orange' },
  { key: 'matched', status: 'Matched', label: 'Matched', icon: 'ri-checkbox-circle-line', theme: 'green' },
  { key: 'pendingManager', status: 'Pending Manager Approval', label: 'Pending Manager', icon: 'ri-user-star-line', theme: 'cyan' },
  { key: 'discrepancy', status: 'Discrepancy', label: 'Discrepancy', icon: 'ri-error-warning-line', theme: 'rose' },
  { key: 'onHold', status: 'On Hold', label: 'On Hold', icon: 'ri-pause-circle-line', theme: 'violet' },
  { key: 'approved', status: 'Approved for Payment', label: 'Approved', icon: 'ri-shield-check-line', theme: 'blue' },
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

export default function InvoiceStatsCards({ invoices, filter, onFilter }: Props) {
  const stats = buildStats(invoices);

  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
      {CARDS.map((card) => (
        <SoftInsightCard
          key={card.key}
          title={card.label}
          value={stats[card.key]}
          icon={card.icon}
          theme={card.theme}
          selected={filter === card.status}
          onClick={() => onFilter(filter === card.status ? 'all' : card.status)}
        />
      ))}
    </div>
  );
}
