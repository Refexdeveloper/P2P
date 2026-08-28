import { useEffect, useRef, useState } from 'react';

export type DashboardFiltersValue = {
  dateFrom: string;
  dateTo: string;
  entityId: string;
  department: string;
  category: string;
  vendor: string;
  poStatus: string;
  amountMin: string;
  amountMax: string;
};

const EMPTY: DashboardFiltersValue = {
  dateFrom: '',
  dateTo: '',
  entityId: '',
  department: '',
  category: '',
  vendor: '',
  poStatus: '',
  amountMin: '',
  amountMax: '',
};

const fieldClass =
  'h-10 px-3 border border-[#E6E8F0] rounded-xl bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400';

export default function DashboardFilters({
  value,
  entities,
  departments,
  categories,
  vendors,
  resetValue,
  onChange,
}: {
  value: DashboardFiltersValue;
  entities: Array<{ id: string; name: string }>;
  departments: string[];
  categories: string[];
  vendors: string[];
  resetValue?: DashboardFiltersValue;
  onChange: (next: DashboardFiltersValue) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const extraCount = [value.vendor, value.poStatus, value.amountMin, value.amountMax].filter(Boolean).length;
  const clearTo = resetValue || EMPTY;

  return (
    <div className="bg-white border border-[#EEF0F5] rounded-[16px] px-3 py-2.5 mb-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div className={`${fieldClass} inline-flex items-center gap-1.5 pl-3 pr-2 w-auto min-w-[268px] shrink-0`}>
          <i className="ri-calendar-line text-slate-400 text-sm shrink-0"></i>
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            className="bg-transparent border-0 p-0 text-[13px] text-slate-700 focus:outline-none w-[128px]"
            aria-label="From date"
          />
          <span className="text-slate-300 shrink-0">–</span>
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            className="bg-transparent border-0 p-0 text-[13px] text-slate-700 focus:outline-none w-[128px]"
            aria-label="To date"
          />
        </div>
        <select
          value={value.entityId}
          onChange={(e) => onChange({ ...value, entityId: e.target.value })}
          className={`${fieldClass} min-w-[160px] shrink-0`}
          aria-label="Company"
        >
          <option value="">All Companies</option>
          {entities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <select
          value={value.department}
          onChange={(e) => onChange({ ...value, department: e.target.value })}
          className={`${fieldClass} min-w-[150px] shrink-0`}
          aria-label="Department"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value })}
          className={`${fieldClass} min-w-[140px] shrink-0`}
          aria-label="Category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="relative shrink-0 ml-auto" ref={moreRef}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="h-10 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-xl whitespace-nowrap"
          >
            <i className="ri-filter-3-line"></i>
            More Filters{extraCount ? ` (${extraCount})` : ''}
          </button>
          {moreOpen ? (
            <div className="absolute right-0 top-full mt-2 z-30 w-[320px] bg-white border border-[#EEF0F5] rounded-2xl shadow-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">More filters</p>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Vendor</label>
                <select
                  value={draft.vendor}
                  onChange={(e) => setDraft({ ...draft, vendor: e.target.value })}
                  className={`${fieldClass} w-full`}
                >
                  <option value="">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">PO Status</label>
                <select
                  value={draft.poStatus}
                  onChange={(e) => setDraft({ ...draft, poStatus: e.target.value })}
                  className={`${fieldClass} w-full`}
                >
                  <option value="">All statuses</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending Approval">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Min amount</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.amountMin}
                    onChange={(e) => setDraft({ ...draft, amountMin: e.target.value })}
                    className={`${fieldClass} w-full`}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max amount</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.amountMax}
                    onChange={(e) => setDraft({ ...draft, amountMax: e.target.value })}
                    className={`${fieldClass} w-full`}
                    placeholder="Any"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onChange(clearTo);
                    setDraft(clearTo);
                    setMoreOpen(false);
                  }}
                  className="h-9 px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 rounded-lg"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(draft);
                    setMoreOpen(false);
                  }}
                  className="h-9 px-4 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { EMPTY as EMPTY_DASHBOARD_FILTERS };
