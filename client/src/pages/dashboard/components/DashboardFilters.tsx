import { useEffect, useMemo, useState } from 'react';
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
  'h-11 w-full px-3 border border-slate-200 rounded-2xl bg-white text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]';

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
  if (value.vendor) n += 1;
  if (value.poStatus) n += 1;
  if (value.dateFrom !== base.dateFrom || value.dateTo !== base.dateTo) n += 1;
  return n;
}

function FieldLabel({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <div className="mb-1.5 flex min-h-[16px] items-center justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[#E53935] hover:underline"
        >
          <i className="ri-close-line" />
          Remove
        </button>
      ) : (
        <span className="invisible text-[10px]">Remove</span>
      )}
    </div>
  );
}

export default function DashboardFilters({
  value,
  entities,
  departments,
  vendors,
  resetValue,
  onChange,
  lockEntity = false,
  lockedEntityLabel,
}: {
  value: DashboardFiltersValue;
  entities: Array<{ id: string; name: string }>;
  departments: string[];
  vendors: string[];
  resetValue?: DashboardFiltersValue;
  onChange: (next: DashboardFiltersValue) => void;
  lockEntity?: boolean;
  lockedEntityLabel?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetDraft, setSheetDraft] = useState(value);

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

  const clearTo = resetValue || EMPTY;
  const activeCount = countActiveFilters(value, clearTo, lockEntity);
  const periodChanged = value.dateFrom !== clearTo.dateFrom || value.dateTo !== clearTo.dateTo;
  const sheetPeriodChanged = sheetDraft.dateFrom !== clearTo.dateFrom || sheetDraft.dateTo !== clearTo.dateTo;

  const companyOptions = useMemo(
    () => [
      { value: '', label: lockEntity ? lockedEntityLabel || 'Assigned entity' : 'All Companies' },
      ...entities.map((e) => ({ value: e.id, label: e.name })),
    ],
    [entities, lockEntity, lockedEntityLabel]
  );
  const departmentOptions = useMemo(
    () => [{ value: '', label: 'All Functions' }, ...departments.map((d) => ({ value: d, label: d }))],
    [departments]
  );
  const vendorOptions = useMemo(
    () => [{ value: '', label: 'All Vendors' }, ...vendors.map((v) => ({ value: v, label: v }))],
    [vendors]
  );

  const closeSheet = () => setSheetOpen(false);
  const applySheet = () => {
    onChange({ ...sheetDraft, category: '' });
    setSheetOpen(false);
  };
  const clearSheet = () => {
    onChange({ ...clearTo, category: '' });
    setSheetDraft({ ...clearTo, category: '' });
    setSheetOpen(false);
  };
  const clearAll = () => onChange({ ...clearTo, category: '' });

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
              <div className="h-1 shrink-0 rounded-t-3xl bg-[#1E88E5]" />
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

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
                <PeriodPicker
                  dateFrom={sheetDraft.dateFrom}
                  dateTo={sheetDraft.dateTo}
                  onChange={({ dateFrom, dateTo }) => setSheetDraft((prev) => ({ ...prev, dateFrom, dateTo }))}
                  onClear={
                    sheetPeriodChanged
                      ? () =>
                          setSheetDraft((prev) => ({
                            ...prev,
                            dateFrom: clearTo.dateFrom,
                            dateTo: clearTo.dateTo,
                          }))
                      : undefined
                  }
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
                  onClear={
                    !lockEntity && sheetDraft.entityId
                      ? () => setSheetDraft((prev) => ({ ...prev, entityId: '' }))
                      : undefined
                  }
                />
                <FilterSheetSelect
                  label="Business / Functions"
                  value={sheetDraft.department}
                  options={departmentOptions}
                  placeholder="All Functions"
                  onChange={(department) => setSheetDraft((prev) => ({ ...prev, department }))}
                  onClear={
                    sheetDraft.department
                      ? () => setSheetDraft((prev) => ({ ...prev, department: '' }))
                      : undefined
                  }
                />
                <FilterSheetSelect
                  label="Vendor"
                  value={sheetDraft.vendor}
                  options={vendorOptions}
                  placeholder="All Vendors"
                  onChange={(vendor) => setSheetDraft((prev) => ({ ...prev, vendor }))}
                  onClear={sheetDraft.vendor ? () => setSheetDraft((prev) => ({ ...prev, vendor: '' })) : undefined}
                />
                <FilterSheetSelect
                  label="PO Status"
                  value={sheetDraft.poStatus}
                  options={PO_STATUSES}
                  placeholder="All statuses"
                  onChange={(poStatus) => setSheetDraft((prev) => ({ ...prev, poStatus }))}
                  onClear={
                    sheetDraft.poStatus ? () => setSheetDraft((prev) => ({ ...prev, poStatus: '' })) : undefined
                  }
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
                  className="h-11 flex-1 rounded-xl bg-[#1E88E5] text-[13px] font-semibold text-white hover:bg-[#1565C0]"
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
      <div className="mb-8 min-[992px]:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[14px] font-semibold ${
            activeCount
              ? 'bg-[#1E88E5] text-white shadow-sm'
              : 'border border-[#E6E8F0] bg-white text-slate-800'
          }`}
        >
          <i className="ri-filter-3-line text-lg"></i>
          Filters{activeCount ? ` (${activeCount})` : ''}
        </button>
      </div>

      {sheet}

      <div className="relative mb-8 hidden overflow-visible rounded-2xl border border-transparent bg-white px-5 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] min-[992px]:block">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
          }}
        />
        <div className="relative z-[1] flex flex-wrap items-end gap-3">
          <PeriodPicker
            dateFrom={value.dateFrom}
            dateTo={value.dateTo}
            onChange={({ dateFrom, dateTo }) => onChange({ ...value, dateFrom, dateTo, category: '' })}
            onClear={
              periodChanged
                ? () => onChange({ ...value, dateFrom: clearTo.dateFrom, dateTo: clearTo.dateTo, category: '' })
                : undefined
            }
          />
          <div className="min-w-[160px] shrink-0">
            <FieldLabel
              label="Company"
              onRemove={
                !lockEntity && value.entityId ? () => onChange({ ...value, entityId: '', category: '' }) : undefined
              }
            />
            <select
              value={value.entityId}
              onChange={(e) => onChange({ ...value, entityId: e.target.value, category: '' })}
              disabled={lockEntity}
              className={`${fieldClass} min-w-[160px] ${lockEntity ? 'cursor-not-allowed bg-slate-50 text-slate-600' : ''}`}
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
          <div className="min-w-[160px] shrink-0">
            <FieldLabel
              label="Business / Functions"
              onRemove={value.department ? () => onChange({ ...value, department: '', category: '' }) : undefined}
            />
            <select
              value={value.department}
              onChange={(e) => onChange({ ...value, department: e.target.value, category: '' })}
              className={`${fieldClass} min-w-[160px]`}
              aria-label="Business / Functions"
            >
              <option value="">All Functions</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px] shrink-0">
            <FieldLabel
              label="Vendor"
              onRemove={value.vendor ? () => onChange({ ...value, vendor: '', category: '' }) : undefined}
            />
            <select
              value={value.vendor}
              onChange={(e) => onChange({ ...value, vendor: e.target.value, category: '' })}
              className={`${fieldClass} min-w-[160px]`}
              aria-label="Vendor"
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px] shrink-0">
            <FieldLabel
              label="PO Status"
              onRemove={value.poStatus ? () => onChange({ ...value, poStatus: '', category: '' }) : undefined}
            />
            <select
              value={value.poStatus}
              onChange={(e) => onChange({ ...value, poStatus: e.target.value, category: '' })}
              className={`${fieldClass} min-w-[150px]`}
              aria-label="PO Status"
            >
              {PO_STATUSES.map((status) => (
                <option key={status.label} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
          {activeCount > 0 ? (
            <div className="shrink-0 pb-0.5">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-semibold text-[#E53935] hover:bg-red-50"
              >
                <i className="ri-close-circle-line" />
                Clear all
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

export { EMPTY as EMPTY_DASHBOARD_FILTERS };
