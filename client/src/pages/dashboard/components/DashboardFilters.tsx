import { useEffect, useRef, useState } from 'react';
import PeriodPicker from './PeriodPicker';
import { defaultFyFilter } from '../fyPeriod';

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
  ...defaultFyFilter(),
  entityId: '',
  department: '',
  category: '',
  vendor: '',
  poStatus: '',
  amountMin: '',
  amountMax: '',
};

const fieldClass =
  'h-11 px-3 border border-[#E6E8F0] rounded-2xl bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400';

export default function DashboardFilters({
  value,
  entities,
  departments,
  categories,
  vendors,
  resetValue,
  onChange,
  lockEntity = false,
  lockedEntityLabel,
}: {
  value: DashboardFiltersValue;
  entities: Array<{ id: string; name: string }>;
  departments: string[];
  categories: string[];
  vendors: string[];
  resetValue?: DashboardFiltersValue;
  onChange: (next: DashboardFiltersValue) => void;
  lockEntity?: boolean;
  lockedEntityLabel?: string;
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
    <div className="bg-white border border-[#EEF0F5] rounded-[16px] px-4 py-3 mb-5">
      <div className="flex items-end gap-3 overflow-x-auto pb-0.5">
        <PeriodPicker
          dateFrom={value.dateFrom}
          dateTo={value.dateTo}
          onChange={({ dateFrom, dateTo }) => onChange({ ...value, dateFrom, dateTo })}
        />
        <div className="shrink-0">
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-1.5">Company</p>
          <select
            value={value.entityId}
            onChange={(e) => onChange({ ...value, entityId: e.target.value })}
            disabled={lockEntity}
            className={`${fieldClass} min-w-[160px] ${lockEntity ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : ''}`}
            aria-label="Company"
          >
            <option value="">{lockEntity ? lockedEntityLabel || 'Assigned entity' : 'All Companies'}</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-1.5">Department</p>
          <select
            value={value.department}
            onChange={(e) => onChange({ ...value, department: e.target.value })}
            className={`${fieldClass} min-w-[150px]`}
            aria-label="Department"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-1.5">Category</p>
          <select
            value={value.category}
            onChange={(e) => onChange({ ...value, category: e.target.value })}
            className={`${fieldClass} min-w-[140px]`}
            aria-label="Category"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="relative shrink-0 ml-auto pb-0.5" ref={moreRef}>
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-1.5 invisible">More</p>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="h-11 px-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50 rounded-2xl whitespace-nowrap"
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
