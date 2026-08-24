import { useEffect, useMemo, useRef, useState } from 'react';
import type { VendorRecord } from '../../../../services/api';

interface Props {
  vendors: VendorRecord[];
  value: string;
  takenNames?: Set<string>;
  takenIds?: Set<string>;
  onChange: (vendorId: string) => void;
  placeholder?: string;
  emptyHint?: string;
}

function vendorHaystack(v: VendorRecord) {
  return `${v.name} ${v.vendorCode || ''} ${v.email || ''} ${v.phone || ''} ${v.contactName || ''}`.toLowerCase();
}

function isTaken(v: VendorRecord, takenNames?: Set<string>, takenIds?: Set<string>) {
  return (
    Boolean(takenIds?.has(String(v.id))) || Boolean(takenNames?.has((v.name || '').toLowerCase()))
  );
}

export default function VendorSearchSelect({
  vendors,
  value,
  takenNames,
  takenIds,
  onChange,
  placeholder = 'Type vendor name, code, or email',
  emptyHint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = vendors.find((v) => String(v.id) === String(value));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? vendors.filter((v) => vendorHaystack(v).includes(q)) : vendors;
    return list.slice(0, 40);
  }, [vendors, query]);

  const pickable = matches.filter((v) => !isTaken(v, takenNames, takenIds) || String(v.id) === String(value));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const pick = (v: VendorRecord) => {
    if (isTaken(v, takenNames, takenIds) && String(v.id) !== String(value)) return;
    onChange(String(v.id));
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const display = open ? query : selected ? `${selected.name}${selected.vendorCode ? ` (${selected.vendorCode})` : ''}` : '';

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.min(pickable.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = pickable[highlight];
      if (hit) pick(hit);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative flex-1 min-w-0">
      <div
        className={`flex items-center gap-2 h-11 px-3 border rounded-xl bg-white ${
          open ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-gray-300'
        }`}
      >
        <i className="ri-search-line text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          value={display}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (value) onChange('');
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={selected && !open ? selected.name : placeholder}
          className="flex-1 min-w-0 h-full text-sm bg-transparent outline-none placeholder:text-gray-400"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {selected && !open ? (
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-700 shrink-0" title="Clear">
            <i className="ri-close-line text-lg" />
          </button>
        ) : (
          <i className={`ri-arrow-down-s-line text-gray-400 shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg"
          role="listbox"
        >
          {matches.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-600">
              <p className="font-medium text-gray-800">No vendor matches “{query.trim()}”</p>
              <p className="text-xs text-gray-500 mt-1">
                {emptyHint || (
                  <>
                    Try another spelling, or tap <strong>New vendor</strong> to add them.
                  </>
                )}
              </p>
            </div>
          ) : (
            matches.map((v) => {
              const taken = isTaken(v, takenNames, takenIds) && String(v.id) !== String(value);
              const active = pickable[highlight]?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  data-idx={pickable.findIndex((x) => x.id === v.id)}
                  disabled={taken}
                  onMouseEnter={() => {
                    const idx = pickable.findIndex((x) => x.id === v.id);
                    if (idx >= 0) setHighlight(idx);
                  }}
                  onClick={() => pick(v)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 ${
                    taken
                      ? 'opacity-50 cursor-not-allowed bg-gray-50'
                      : active
                        ? 'bg-teal-50'
                        : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v.name}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[v.vendorCode, v.email, v.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {taken ? (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        Already added
                      </span>
                    ) : String(v.id) === String(value) ? (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                        Selected
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
          {vendors.length > matches.length && matches.length > 0 && (
            <p className="px-3 py-2 text-[11px] text-gray-400 bg-gray-50">
              Showing {matches.length} of {vendors.length}. Keep typing to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
