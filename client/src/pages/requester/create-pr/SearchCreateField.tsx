import { useEffect, useMemo, useRef, useState } from 'react';

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
  onCreate?: (name: string) => Promise<void>;
  onOpen?: () => void;
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
  onOpen,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) setQuery(displayValue);
  }, [displayValue, open]);

  useEffect(() => {
    if (resetKey == null) return;
    setQuery(displayValue);
    setOpen(false);
    setError('');
  }, [resetKey]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

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
      await onCreate(typed);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${addNoun || 'value'}`);
    } finally {
      setSaving(false);
    }
  };

  const inputPad = compact ? 'pl-9 pr-9 py-2 rounded-lg' : 'pl-9 pr-9 py-2.5 rounded-xl';

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
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
          className={`w-full ${inputPad} border text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
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
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg">
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
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={saving}
              className="w-full text-left px-3 py-2.5 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border-t border-teal-100 cursor-pointer"
            >
              <i className="ri-add-line mr-1"></i>
              {saving ? 'Saving…' : `Save “${typed}” as new ${addNoun || 'entry'}`}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
