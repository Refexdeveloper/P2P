import PmKpiCard from '../../../../components/base/PmKpiCard';

interface StatsCardsProps {
  stats: {
    totalPendingApprovals: number;
    highValuePRs: number;
    approvedThisMonth: number;
    totalSpendAllEntities: number;
    rejectedThisMonth: number;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const spendCr = (stats.totalSpendAllEntities / 10000000).toFixed(2);
  const queue =
    stats.totalPendingApprovals +
    stats.highValuePRs +
    stats.approvedThisMonth +
    stats.rejectedThisMonth || 1;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      <PmKpiCard
        title="Total Pending"
        value={stats.totalPendingApprovals}
        icon="ri-file-list-3-line"
        tone="total"
        subtitle="Awaiting CFO action"
        progress={Math.round((stats.totalPendingApprovals / queue) * 100)}
      />
      <PmKpiCard
        title="High Value PRs"
        value={stats.highValuePRs}
        icon="ri-vip-crown-line"
        tone="delayed"
        subtitle="Above ₹50L"
        delta={stats.highValuePRs > 0 ? `${stats.highValuePRs} flagged` : 'None'}
        deltaTone={stats.highValuePRs > 0 ? 'down' : 'flat'}
        progress={Math.round((stats.highValuePRs / queue) * 100)}
      />
      <PmKpiCard
        title="Approved This Month"
        value={stats.approvedThisMonth}
        icon="ri-checkbox-circle-line"
        tone="completed"
        subtitle="Cleared this month"
        progress={Math.round((stats.approvedThisMonth / queue) * 100)}
      />
      <PmKpiCard
        title="Rejected"
        value={stats.rejectedThisMonth}
        icon="ri-close-circle-line"
        tone="atRisk"
        subtitle="This month"
        progress={Math.round((stats.rejectedThisMonth / queue) * 100)}
      />
      <PmKpiCard
        title="Total Spend"
        value={`₹${spendCr}Cr`}
        icon="ri-money-rupee-circle-line"
        tone="active"
        subtitle="All entities"
        delta="Portfolio"
        deltaTone="flat"
      />
    </div>
  );
}
