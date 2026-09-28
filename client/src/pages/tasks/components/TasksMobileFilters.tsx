import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import FilterSheetSelect from '../../dashboard/components/FilterSheetSelect';

export type TasksFilterValue = {
  search: string;
  status: string;
  priority: string;
  sortBy: string;
  dateFrom: string;
  dateTo: string;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'returned', label: 'Returned' },
  { value: 'overdue', label: 'Overdue' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' },
];

const SORT_OPTIONS = [
  { value: 'sla', label: 'Sort: SLA Urgency' },
  { value: 'amount_high', label: 'Sort: Amount (High to Low)' },
  { value: 'amount_low', label: 'Sort: Amount (Low to High)' },
  { value: 'priority', label: 'Sort: Priority' },
  { value: 'date', label: 'Sort: Newest First' },
];

const EMPTY: TasksFilterValue = {
  search: '',
  status: 'all',
  priority: 'all',
  sortBy: 'date',
  dateFrom: '',
  dateTo: '',
};

function countActive(value: TasksFilterValue) {
  let n = 0;
  if (value.search.trim()) n += 1;
  if (value.status !== 'all') n += 1;
  if (value.priority !== 'all') n += 1;
  if (value.sortBy !== 'date') n += 1;
  return n;
}

/**
 * Phone/tablet only (max-width 991px): Filters button + bottom sheet with draft Apply/Clear.
 */
export default function TasksMobileFilters({
  value,
  onApply,
}: {
  value: TasksFilterValue;
  onApply: (next: TasksFilterValue) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const activeCount = useMemo(() => countActive(value), [value]);

  useEffect(() => {
    if (!sheetOpen) return;
    setDraft(value);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 992) setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const closeSheet = () => setSheetOpen(false);
  const applySheet = () => {
    onApply({
      search: draft.search.trim(),
      status: draft.status,
      priority: draft.priority,
      sortBy: draft.sortBy,
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
    });
    setSheetOpen(false);
  };
  const clearSheet = () => {
    onApply(EMPTY);
    setDraft(EMPTY);
    setSheetOpen(false);
  };

  const sheet =
    sheetOpen && typeof document !== 'undefined'
      ? createPortal(
          <div className="min-[992px]:hidden" role="presentation">
            <button
              type="button"
              aria-label="Close filters"
              className="fixed inset-0 z-[10040] bg-slate-900/40"
              onClick={closeSheet}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tasks-filter-sheet-title"
              className="animate-sheet-up fixed inset-x-0 bottom-0 z-[10041] flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(16,24,40,0.18)]"
            >
              <div className="h-1 shrink-0 rounded-t-3xl bg-[#1E88E5]" />
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEF0F5] bg-white px-4 py-3">
                <h2 id="tasks-filter-sheet-title" className="text-base font-semibold text-slate-900">
                  Filters
                </h2>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Search
                  </p>
                  <div className="relative">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#1E88E5]" />
                    <input
                      type="text"
                      value={draft.search}
                      onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                      placeholder="Search PR..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] text-slate-700 outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const active = draft.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, status: opt.value }))}
                          className={`cursor-pointer whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors active:scale-[0.98] ${
                            active
                              ? 'bg-[#1E88E5] text-white shadow-[0_8px_20px_-10px_rgba(21,101,192,0.55)]'
                              : 'bg-[#E3F2FD] text-[#1565C0]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FilterSheetSelect
                  label="Priority"
                  value={draft.priority}
                  options={PRIORITY_OPTIONS}
                  placeholder="All Priorities"
                  onChange={(priority) => setDraft((prev) => ({ ...prev, priority }))}
                />

                <FilterSheetSelect
                  label="Sort"
                  value={draft.sortBy}
                  options={SORT_OPTIONS}
                  placeholder="Sort: Newest First"
                  onChange={(sortBy) => setDraft((prev) => ({ ...prev, sortBy }))}
                />
              </div>

              <div className="sticky bottom-0 z-10 flex gap-3 border-t border-[#EEF0F5] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={clearSheet}
                  className="h-11 flex-1 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] active:scale-[0.98]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applySheet}
                  className="h-11 flex-1 rounded-xl bg-[#1E88E5] text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(21,101,192,0.55)] hover:bg-[#1565C0] active:scale-[0.98]"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="min-[992px]:hidden w-full">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold active:scale-[0.98] ${
            activeCount
              ? 'bg-[#1E88E5] text-white shadow-[0_8px_20px_-10px_rgba(21,101,192,0.55)]'
              : 'border border-transparent bg-white text-slate-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]'
          }`}
        >
          <i className={`ri-filter-3-line text-lg ${activeCount ? 'text-white' : 'text-[#1E88E5]'}`}></i>
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
      {sheet}
    </>
  );
}
