import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchCreateOption = {
  id: number | string;
  label: string;
  subLabel?: string;
};

interface Props {
  options: SearchCreateOption[];
  displayValue: string;
  selectedId?: number | string | null;
  placeholder: string;
  hasError?: boolean;
  addNoun?: string;
  compact?: boolean;
  resetKey?: string;
  emptyHint?: string;
  onSelect: (option: SearchCreateOption) => void;
  onClear: () => void;
  onCreate?: (name: string, extra?: string) => Promise<void>;
  createExtraPlaceholder?: string;
  onOpen?: () => void;
  portal?: boolean;
}

export default function SearchCreateField({
  options,
  displayValue,
  selectedId,
  placeholder,
  hasError,
  addNoun,
  compact,
  resetKey,
  emptyHint,
  onSelect,
  onClear,
  onCreate,
  createExtraPlaceholder,
  onOpen,
  portal = false,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createExtra, setCreateExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);

  useEffect(() => {
    if (!open) setQuery(displayValue);
  }, [displayValue, open]);

  useEffect(() => {
    if (resetKey == null) return;
    setQuery(displayValue);
    setCreateExtra('');
    setOpen(false);
    setError('');
  }, [resetKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open || !portal) return;
    const place = () => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxH = Math.max(160, Math.min(280, openUp ? spaceAbove : spaceBelow));
      setMenuPos({
        top: openUp ? Math.max(8, r.top - maxH - 4) : r.bottom + 4,
        left: Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - r.width - 8)),
        width: r.width,
        maxH,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, portal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((opt) => `${opt.label} ${opt.subLabel || ''}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, query]);

  const typed = query.trim();
  const exactMatch = options.find((opt) => opt.label.trim().toLowerCase() === typed.toLowerCase());
  const canAdd = Boolean(onCreate && typed && !exactMatch);

  const apply = (opt: SearchCreateOption) => {
    onSelect(opt);
    setQuery(opt.label);
    setCreateExtra('');
    setOpen(false);
    setError('');
  };

  const handleAdd = async () => {
    if (!onCreate || !typed || saving) return;
    if (exactMatch) {
      apply(exactMatch);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate(typed, createExtra.trim() || undefined);
      setCreateExtra('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${addNoun || 'value'}`);
    } finally {
      setSaving(false);
    }
  };

  const inputPad = compact ? 'pl-9 pr-9 py-2 rounded-lg' : 'pl-9 pr-9 py-2.5 rounded-xl';

  return (
    <div ref={boxRef} className="relative w-full min-w-0">
      <div className="relative w-full min-w-0">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
        <input
          type="text"
          value={open ? query : displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError('');
            if (!e.target.value.trim()) onClear();
          }}
          onFocus={() => {
            setQuery(displayValue);
            setOpen(true);
            onOpen?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (exactMatch) apply(exactMatch);
            else if (canAdd) void handleAdd();
            else if (filtered[0]) apply(filtered[0]);
          }}
          placeholder={placeholder}
          className={`w-full min-w-0 max-w-full box-border ${inputPad} border text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
            hasError ? 'border-red-400 bg-red-50' : 'border-gray-200'
          }`}
          autoComplete="off"
        />
        {(displayValue || query) && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onClear();
              setOpen(true);
              setError('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
            title="Clear"
          >
            <i className="ri-close-line text-base" />
          </button>
        )}
      </div>
      {open &&
        (() => {
          const menu = (
            <div
              ref={menuRef}
              className={`${
                portal ? 'fixed z-[80]' : 'absolute z-30 mt-1 w-full'
              } max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg`}
              style={
                portal && menuPos
                  ? { top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: menuPos.maxH }
                  : undefined
              }
            >
              {filtered.length === 0 && !canAdd && (
                <p className="px-3 py-2.5 text-sm text-gray-500">
                  {typed
                    ? `No ${addNoun || 'matches'} for “${typed}”`
                    : emptyHint ||
                      (options.length === 0
                        ? `No ${addNoun || 'options'} available`
                        : 'Start typing to search')}
                </p>
              )}
              {filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => apply(opt)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 cursor-pointer ${
                    selectedId === opt.id ? 'bg-slate-100 font-semibold text-slate-900' : 'text-gray-800'
                  }`}
                >
                  <span className="block truncate">{opt.label}</span>
                  {opt.subLabel ? <span className="block text-[11px] text-gray-400">{opt.subLabel}</span> : null}
                </button>
              ))}
              {canAdd && (
                <div className="border-t border-teal-100 bg-teal-50/70 p-2.5 space-y-2">
                  {createExtraPlaceholder ? (
                    <textarea
                      value={createExtra}
                      onChange={(e) => setCreateExtra(e.target.value)}
                      placeholder={createExtraPlaceholder}
                      rows={2}
                      className="w-full px-2.5 py-2 border border-teal-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-white"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleAdd()}
                    disabled={saving}
                    className="w-full text-left px-2 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100 rounded-lg cursor-pointer"
                  >
                    <i className="ri-add-line mr-1"></i>
                    {saving ? 'Saving…' : `Save “${typed}” as new ${addNoun || 'entry'}`}
                  </button>
                </div>
              )}
            </div>
          );
          return portal ? createPortal(menu, document.body) : menu;
        })()}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
