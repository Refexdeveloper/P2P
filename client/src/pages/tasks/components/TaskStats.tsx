import AnimatedKpiCard from '../../../components/feature/AnimatedKpiCard';

export type TaskStatFilter =
  | 'all'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'overdue';

export type TaskStatCard = {
  title: string;
  value: number;
  icon: string;
  filter: TaskStatFilter;
};

function subtitleFor(filter: TaskStatFilter, value: number): { text: string; live?: boolean } {
  switch (filter) {
    case 'pending_approval':
      return value ? { text: 'Requires your action', live: true } : { text: 'Nothing waiting on you' };
    case 'approved':
      return { text: value ? 'Successfully approved' : 'No approvals yet' };
    case 'rejected':
      return { text: value ? 'Declined requests' : 'No rejected requests' };
    case 'overdue':
      return value ? { text: 'Past SLA — act now', live: true } : { text: 'All within SLA' };
    case 'returned':
      return { text: value ? 'Sent back for rework' : 'Nothing returned' };
    default:
      return { text: 'All tasks' };
  }
}

export default function TaskStats({
  cards,
  selectedFilter,
  onSelect,
  total,
}: {
  cards: TaskStatCard[];
  selectedFilter: string;
  onSelect: (filter: TaskStatFilter) => void;
  /** Total tasks in scope, used for the share-of-total progress bar. */
  total: number;
}) {
  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 lg:grid-cols-4">
      {cards.map((card, i) => {
        const sub = subtitleFor(card.filter, Number(card.value) || 0);
        return (
          <AnimatedKpiCard
            key={card.title}
            title={card.title}
            value={card.value}
            variant={card.filter}
            index={i}
            total={total}
            subtitle={sub.text}
            live={sub.live}
            selected={selectedFilter === card.filter}
            fallbackIcon={card.icon}
            onClick={() => onSelect(card.filter)}
          />
        );
      })}
    </div>
  );
}
