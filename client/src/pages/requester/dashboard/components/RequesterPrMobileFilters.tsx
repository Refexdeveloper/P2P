import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import PeriodPicker from '../../../dashboard/components/PeriodPicker';
import { BRAND } from '../../../../constants/brandColors';

export type PrStatusFilter = 'all' | 'draft' | 'pending_approval' | 'approved' | 'returned' | 'rejected';

export type RequesterPrFilterValue = {
  search: string;
  status: PrStatusFilter;
  dateFrom: string;
  dateTo: string;
};

const STATUS_OPTIONS: Array<{ id: PrStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending_approval', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'returned', label: 'Returned' },
  { id: 'rejected', label: 'Rejected' },
];

const EMPTY: RequesterPrFilterValue = {
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
};

function countActive(value: RequesterPrFilterValue) {
  let n = 0;
  if (value.search.trim()) n += 1;
  if (value.status !== 'all') n += 1;
  if (value.dateFrom || value.dateTo) n += 1;
  return n;
}

/**
 * Phone/tablet only (max-width 991px): Filters button + bottom sheet with draft Apply/Clear.
 * Desktop toolbar stays outside this component.
 */
export default function RequesterPrMobileFilters({
  value,
  onApply,
}: {
  value: RequesterPrFilterValue;
  onApply: (next: RequesterPrFilterValue) => void;
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
    // Snapshot when sheet opens only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const closeSheet = () => setSheetOpen(false);
  const applySheet = () => {
    onApply({
      search: draft.search.trim(),
      status: draft.status,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
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
              aria-labelledby="requester-pr-filter-sheet-title"
              className="animate-sheet-up fixed inset-x-0 bottom-0 z-[10041] flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(16,24,40,0.18)]"
            >
              <div
                className="h-1 shrink-0 rounded-t-3xl"
                style={{ backgroundColor: BRAND.primary }}
              />
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEF0F5] bg-white px-4 py-3">
                <h2 id="requester-pr-filter-sheet-title" className="text-base font-semibold text-slate-900">
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
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Search
                  </p>
                  <div className="relative">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={draft.search}
                      onChange={(e) => setDraft((prev) => ({ ...prev, search: e.target.value }))}
                      placeholder="Search PR..."
                      className="h-11 w-full rounded-2xl border border-[#E6E8F0] bg-white pl-10 pr-3 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[rgba(244,85,59,0.25)]"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const active = draft.status === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDraft((prev) => ({ ...prev, status: opt.id }))}
                          className={`px-3.5 py-2 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
                            active ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-700'
                          }`}
                          style={active ? { backgroundColor: BRAND.secondary } : undefined}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <PeriodPicker
                  dateFrom={draft.dateFrom}
                  dateTo={draft.dateTo}
                  onChange={({ dateFrom, dateTo }) =>
                    setDraft((prev) => ({ ...prev, dateFrom, dateTo }))
                  }
                  fullWidth
                  portalZIndex={10060}
                  themeAccent
                />
              </div>

              <div className="sticky bottom-0 z-10 flex gap-3 border-t border-[#EEF0F5] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={clearSheet}
                  className="h-11 flex-1 rounded-xl border border-[#E6E8F0] text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applySheet}
                  className="h-11 flex-1 rounded-xl text-[13px] font-semibold text-white hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}
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
      <div className="min-[992px]:hidden mb-3 px-4 pt-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-gray-900">Recent Purchase Requests</h2>
        </div>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold ${
            activeCount ? 'text-white shadow-sm' : 'border border-[#E6E8F0] bg-white text-slate-800'
          }`}
          style={activeCount ? { backgroundColor: BRAND.primary } : undefined}
        >
          <i
            className="ri-filter-3-line text-lg"
            style={!activeCount ? { color: BRAND.primary } : undefined}
          ></i>
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>
      {sheet}
    </>
  );
}
