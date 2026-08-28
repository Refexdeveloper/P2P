import { useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultFyFilter,
  fyOptions,
  Granularity,
  monthOptions,
  periodButtonLabel,
  PeriodKind,
  rangeForKind,
  weekOptions,
} from '../fyPeriod';

const KINDS: Array<{ id: PeriodKind; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'mtd', label: 'MTD' },
  { id: 'qtd', label: 'QTD' },
  { id: 'this_fy', label: 'This FY' },
];

const GRAINS: Array<{ id: Granularity; label: string }> = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'year', label: 'Year' },
  { id: 'custom', label: 'Custom' },
];

export default function PeriodPicker({
  dateFrom,
  dateTo,
  onChange,
}: {
  dateFrom: string;
  dateTo: string;
  onChange: (next: { dateFrom: string; dateTo: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<PeriodKind>('this_fy');
  const [grain, setGrain] = useState<Granularity>('year');
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setCustomFrom(dateFrom);
    setCustomTo(dateTo);
  }, [dateFrom, dateTo]);

  const years = useMemo(() => fyOptions(), []);
  const months = useMemo(() => monthOptions(), []);
  const weeks = useMemo(() => weekOptions(), []);
  const label = periodButtonLabel(dateFrom, dateTo);
  const activeKind = (['today', 'mtd', 'qtd', 'this_fy'] as PeriodKind[]).find((k) => {
    const r = rangeForKind(k);
    return r.from === dateFrom && r.to === dateTo;
  });

  const applyRange = (from: string, to: string) => {
    onChange({ dateFrom: from, dateTo: to });
  };

  const pickKind = (next: PeriodKind) => {
    setKind(next);
    const r = rangeForKind(next);
    applyRange(r.from, r.to);
    if (next === 'this_fy') setGrain('year');
    if (next === 'mtd') setGrain('monthly');
    if (next === 'today') setOpen(false);
  };

  const list =
    grain === 'monthly' ? months : grain === 'weekly' ? weeks : grain === 'year' ? years : [];

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-1.5">Period</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-11 min-w-[168px] px-2.5 inline-flex items-center gap-2 bg-white border border-[#E6E8F0] rounded-2xl text-[13px] font-medium text-slate-800 hover:border-indigo-200"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="w-8 h-8 rounded-lg bg-[#EEF3FF] text-indigo-600 flex items-center justify-center shrink-0">
          <i className="ri-calendar-line text-base"></i>
        </span>
        <span className="truncate">{label}</span>
        <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-slate-400 ml-auto text-lg`}></i>
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-2 z-40 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-[#EEF0F5] rounded-2xl shadow-[0_12px_40px_rgba(16,24,40,0.12)] p-4">
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase mb-2">Choose period type</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {KINDS.map((k) => {
              const active = (activeKind || kind) === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => pickKind(k.id)}
                  className={`h-8 px-3 rounded-full text-[12px] font-medium ${
                    active
                      ? 'bg-[#E8F0FE] text-slate-800 border border-sky-200'
                      : 'bg-slate-100 text-slate-700 border border-transparent hover:bg-slate-200'
                  }`}
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          <div className="bg-slate-100 rounded-full p-1 flex mb-3">
            {GRAINS.map((g) => {
              const active = grain === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGrain(g.id)}
                  className={`flex-1 h-8 rounded-full text-[12px] font-medium ${
                    active ? 'bg-white text-slate-800 shadow-sm border border-sky-200' : 'text-slate-600'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {grain === 'year' ? (
            <p className="text-[11px] text-slate-400 mb-2">Indian financial year · 1 April → 31 March next year</p>
          ) : null}

          {grain === 'custom' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-10 w-full px-3 border border-[#E6E8F0] rounded-xl text-[13px] text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-10 w-full px-3 border border-[#E6E8F0] rounded-xl text-[13px] text-slate-700"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (customFrom && customTo) {
                    applyRange(customFrom, customTo);
                    setOpen(false);
                  }
                }}
                className="w-full h-9 rounded-xl text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Apply custom range
              </button>
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2">
              {list.map((item) => {
                const selected = dateFrom === item.from && dateTo === item.to;
                return (
                  <button
                    key={item.from + item.label}
                    type="button"
                    onClick={() => {
                      applyRange(item.from, item.to);
                      if ('current' in item && item.current) setKind('this_fy');
                      setOpen(false);
                    }}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border ${
                      selected ? 'border-slate-800' : 'border-[#EEF0F5] hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-slate-900">{item.label}</p>
                      {selected ? <i className="ri-check-line text-slate-900"></i> : null}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
                    {item.current ? (
                      <span className="inline-flex mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700">
                        {grain === 'year' ? 'CURRENT FINANCIAL YEAR' : grain === 'monthly' ? 'CURRENT MONTH' : 'CURRENT WEEK'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export { defaultFyFilter };
