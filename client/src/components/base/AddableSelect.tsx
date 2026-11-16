import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface AddableSelectOption {
  id: number | string;
  label: string;
  subLabel?: string;
  email?: string;
  phone?: string;
}

interface AddableSelectProps {
  label: string;
  value: string;
  options: AddableSelectOption[];
  placeholder?: string;
  icon?: string;
  multiline?: boolean;
  adding: boolean;
  disabled?: boolean;
  variant?: 'default' | 'compact';
  onOpenAdd: () => void;
  onCloseAdd: () => void;
  onSelect: (option: AddableSelectOption) => void;
  addForm: ReactNode;
}

export default function AddableSelect({
  label,
  value,
  options,
  placeholder = 'Select...',
  icon,
  multiline = false,
  adding,
  disabled = false,
  variant = 'default',
  onOpenAdd,
  onCloseAdd,
  onSelect,
  addForm,
}: AddableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxH: number;
  } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onCloseAddRef = useRef(onCloseAdd);
  onCloseAddRef.current = onCloseAdd;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (boxRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
      onCloseAddRef.current();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.subLabel || ''} ${opt.email || ''} ${opt.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const el = boxRef.current?.querySelector('button');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const spaceAbove = r.top - 12;
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxH = Math.max(180, Math.min(320, openUp ? spaceAbove : spaceBelow));
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
  }, [open, adding, filtered.length, query]);

  const selected = options.find((opt) => opt.label === value);
  const compact = variant === 'compact';

  const menu =
    open && !disabled && menuPos ? (
      <div
        ref={menuRef}
        className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          maxHeight: menuPos.maxH,
        }}
      >
        <div className="border-b border-gray-100 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}...`}
            className={`w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 ${
              compact ? 'focus:ring-slate-400' : 'focus:ring-[#1E88E5]'
            }`}
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">No saved options yet</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                  onCloseAdd();
                  setQuery('');
                }}
                className={`w-full cursor-pointer border-b border-gray-50 px-3 py-2.5 text-left text-sm last:border-0 ${
                  compact
                    ? opt.label === value
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-gray-800 hover:bg-slate-50'
                    : opt.label === value
                      ? 'bg-[#E3F2FD] text-[#1565C0]'
                      : 'text-gray-800 hover:bg-[#E3F2FD]'
                }`}
              >
                <span className="block whitespace-pre-wrap font-medium">{opt.label}</span>
                {opt.email || opt.phone ? (
                  <span className="mt-1 flex flex-col gap-0.5 text-[11px] font-normal text-gray-500">
                    {opt.email ? (
                      <span className="inline-flex items-center gap-1 truncate">
                        <i className="ri-mail-line text-gray-400"></i>
                        {opt.email}
                      </span>
                    ) : null}
                    {opt.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <i className="ri-phone-line text-gray-400"></i>
                        {opt.phone}
                      </span>
                    ) : null}
                  </span>
                ) : opt.subLabel ? (
                  <span className="mt-0.5 block text-[11px] text-gray-500">{opt.subLabel}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
        <div className="border-t border-gray-100 bg-gray-50">
          {!adding ? (
            <button
              type="button"
              onClick={onOpenAdd}
              className={`inline-flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left text-sm font-semibold ${
                compact
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[#1565C0] hover:bg-[#E3F2FD]'
              }`}
            >
              <i className="ri-add-line"></i>
              Add new
            </button>
          ) : (
            <div className="space-y-2 bg-white p-3">{addForm}</div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={boxRef} className="relative z-10 min-w-0">
      {compact ? (
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          {label}
        </label>
      ) : (
        <div className="mb-3 flex items-center gap-2">
          {icon ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3F2FD]">
              <i className={`${icon} text-[#1E88E5]`}></i>
            </div>
          ) : null}
          <h3 className="text-sm font-bold text-gray-900">{label}</h3>
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
            if (open) onCloseAdd();
          }}
          className={
            compact
              ? `flex w-full items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-9 text-left text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  disabled ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer'
                } ${open ? 'ring-2 ring-slate-400' : ''}`
              : `w-full rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 pr-9 text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                  disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${open ? 'ring-2 ring-[#1E88E5]' : ''} ${
                  multiline ? 'min-h-[88px] whitespace-pre-wrap' : ''
                }`
          }
        >
          {value ? (
            compact ? (
              <span className="block min-w-0 flex-1 truncate text-gray-800">{value}</span>
            ) : (
              <span className={`block ${multiline ? 'whitespace-pre-wrap' : 'truncate'} text-gray-800`}>
                {value}
                {selected?.email || selected?.phone ? (
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-gray-500">
                    {[selected.email, selected.phone].filter(Boolean).join(' · ')}
                  </span>
                ) : selected?.subLabel ? (
                  <span className="mt-0.5 block truncate text-[11px] font-normal text-gray-500">
                    {selected.subLabel}
                  </span>
                ) : null}
              </span>
            )
          ) : (
            <span
              className={`block text-gray-400 ${
                compact ? 'min-w-0 flex-1 truncate' : multiline ? '' : 'truncate'
              }`}
            >
              {placeholder}
            </span>
          )}
          <i
            className={`ri-arrow-down-s-line absolute right-3 text-lg text-gray-400 ${
              compact ? 'top-1/2 -translate-y-1/2' : 'top-3'
            }`}
          ></i>
        </button>
        {menu ? createPortal(menu, document.body) : null}
      </div>
    </div>
  );
}
