import AnimatedKpiCard from '../../../../components/feature/AnimatedKpiCard';
import type { PrStatusFilter } from './RequesterPrMobileFilters';

export type RequesterStatCard = {
  title: string;
  value: number;
  icon: string;
  filter: PrStatusFilter;
  wash?: string;
  accent?: string;
  iconBg?: string;
};

function subtitleFor(filter: PrStatusFilter, value: number): { text: string; live?: boolean } {
  switch (filter) {
    case 'all':
      return { text: value ? 'All your purchase requests' : 'No requests yet' };
    case 'pending_approval':
      return value ? { text: 'Awaiting approval', live: true } : { text: 'Nothing in approval' };
    case 'approved':
      return { text: value ? 'Successfully approved' : 'No approvals yet' };
    case 'rejected':
      return { text: value ? 'Declined requests' : 'No rejected requests' };
    case 'draft':
      return { text: value ? 'Not yet submitted' : 'No drafts' };
    case 'returned':
      return value ? { text: 'Needs your attention', live: true } : { text: 'Nothing open' };
    default:
      return { text: '' };
  }
}

export default function RequesterStatCards({
  cards,
  selectedFilter,
  onSelect,
  total,
}: {
  cards: RequesterStatCard[];
  selectedFilter: PrStatusFilter;
  onSelect: (filter: PrStatusFilter) => void;
  /** Total PRs, used for each card's share-of-total progress bar. */
  total: number;
}) {
  return (
    <div className="tfx-kpis-6 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
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
