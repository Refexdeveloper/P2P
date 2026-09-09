import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PeriodPicker from './PeriodPicker';
import FilterSheetSelect from './FilterSheetSelect';
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

const PO_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Pending Approval', label: 'Pending' },
  { value: 'Rejected', label: 'Rejected' },
];

function countActiveFilters(
  value: DashboardFiltersValue,
  resetValue: DashboardFiltersValue,
  lockEntity: boolean
) {
  const base = resetValue || EMPTY;
  let n = 0;
  if (!lockEntity && value.entityId && value.entityId !== (base.entityId || '')) n += 1;
  if (value.department) n += 1;
  if (value.category) n += 1;
  if (value.vendor) n += 1;
  if (value.poStatus) n += 1;
  if (value.amountMin) n += 1;
  if (value.amountMax) n += 1;
  if (value.dateFrom !== base.dateFrom || value.dateTo !== base.dateTo) n += 1;
  return n;
}

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState(value);

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

  useEffect(() => {
    if (!sheetOpen) return;
    setSheetDraft(value);
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
    // Snapshot filters only when the sheet opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  const extraCount = [value.vendor, value.poStatus, value.amountMin, value.amountMax].filter(Boolean).length;
  const clearTo = resetValue || EMPTY;
  const activeCount = countActiveFilters(value, clearTo, lockEntity);

  const companyOptions = useMemo(
    () => [
      { value: '', label: lockEntity ? lockedEntityLabel || 'Assigned entity' : 'All Companies' },
      ...entities.map((e) => ({ value: e.id, label: e.name })),
    ],
    [entities, lockEntity, lockedEntityLabel]
  );
  const departmentOptions = useMemo(
    () => [{ value: '', label: 'All Departments' }, ...departments.map((d) => ({ value: d, label: d }))],
    [departments]
  );
  const categoryOptions = useMemo(
    () => [{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c, label: c }))],
    [categories]
  );
  const vendorOptions = useMemo(
    () => [{ value: '', label: 'All Vendors' }, ...vendors.map((v) => ({ value: v, label: v }))],
    [vendors]
  );

  const closeSheet = () => setSheetOpen(false);
  const applySheet = () => {
    onChange(sheetDraft);
    setSheetOpen(false);
  };
  const clearSheet = () => {
    onChange(clearTo);
    setSheetDraft(clearTo);
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
              aria-labelledby="dashboard-filter-sheet-title"
              className="animate-sheet-up fixed inset-x-0 bottom-0 z-[10041] flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(16,24,40,0.18)]"
            >
              <div className="h-1 shrink-0 rounded-t-3xl bg-teal-600" />
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEF0F5] bg-white px-4 py-3">
                <h2 id="dashboard-filter-sheet-title" className="text-base font-semibold text-slate-900">
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

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
                <PeriodPicker
                  dateFrom={sheetDraft.dateFrom}
                  dateTo={sheetDraft.dateTo}
                  onChange={({ dateFrom, dateTo }) => setSheetDraft((prev) => ({ ...prev, dateFrom, dateTo }))}
                  fullWidth
                  portalZIndex={10060}
                  themeAccent
                />
                <FilterSheetSelect
                  label="Company"
                  value={sheetDraft.entityId}
                  options={companyOptions}
                  placeholder="All Companies"
                  disabled={lockEntity}
                  onChange={(entityId) => setSheetDraft((prev) => ({ ...prev, entityId }))}
                />
                <FilterSheetSelect
                  label="Department"
                  value={sheetDraft.department}
                  options={departmentOptions}
                  placeholder="All Departments"
                  onChange={(department) => setSheetDraft((prev) => ({ ...prev, department }))}
                />
                <FilterSheetSelect
                  label="Category"
                  value={sheetDraft.category}
                  options={categoryOptions}
                  placeholder="All Categories"
                  onChange={(category) => setSheetDraft((prev) => ({ ...prev, category }))}
                />
                <FilterSheetSelect
                  label="Vendor"
                  value={sheetDraft.vendor}
                  options={vendorOptions}
                  placeholder="All Vendors"
                  onChange={(vendor) => setSheetDraft((prev) => ({ ...prev, vendor }))}
                />
                <FilterSheetSelect
                  label="PO Status"
                  value={sheetDraft.poStatus}
                  options={PO_STATUSES}
                  placeholder="All statuses"
                  onChange={(poStatus) => setSheetDraft((prev) => ({ ...prev, poStatus }))}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Min amount
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={sheetDraft.amountMin}
                      onChange={(e) => setSheetDraft((prev) => ({ ...prev, amountMin: e.target.value }))}
                      className="h-11 w-full rounded-2xl border border-[#E6E8F0] bg-white px-3 text-[13px] text-slate-700"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Max amount
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={sheetDraft.amountMax}
                      onChange={(e) => setSheetDraft((prev) => ({ ...prev, amountMax: e.target.value }))}
                      className="h-11 w-full rounded-2xl border border-[#E6E8F0] bg-white px-3 text-[13px] text-slate-700"
                      placeholder="Any"
                    />
                  </div>
                </div>
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
                  className="h-11 flex-1 rounded-xl bg-teal-600 text-[13px] font-semibold text-white hover:bg-teal-700"
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
      <div className="mb-5 min-[992px]:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold ${
            activeCount
              ? 'bg-teal-600 text-white shadow-sm'
              : 'border border-[#E6E8F0] bg-white text-slate-800'
          }`}
        >
          <i className="ri-filter-3-line text-lg"></i>
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      {sheet}

      <div className="mb-5 hidden overflow-visible rounded-[16px] border border-[#EEF0F5] bg-white px-4 py-3 min-[992px]:block">
      <div className="flex items-end gap-3 flex-wrap">
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
    </>
  );
}

export { EMPTY as EMPTY_DASHBOARD_FILTERS };
