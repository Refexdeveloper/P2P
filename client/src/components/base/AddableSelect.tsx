import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const boxRef = useRef<HTMLDivElement>(null);
  const onCloseAddRef = useRef(onCloseAdd);
  onCloseAddRef.current = onCloseAdd;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = `${opt.label} ${opt.subLabel || ''} ${opt.email || ''} ${opt.phone || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const selected = options.find((opt) => opt.label === value);

  const compact = variant === 'compact';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null
  );

  const placeMenu = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
    const spaceAbove = rect.top - gap - 12;
    const preferBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(160, Math.min(320, preferBelow ? spaceBelow : spaceAbove));
    const top = preferBelow ? rect.bottom + gap : Math.max(8, rect.top - gap - maxHeight);
    setMenuBox({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (!open || disabled) {
      setMenuBox(null);
      return;
    }
    placeMenu();
    const onMove = () => placeMenu();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, disabled, adding, filtered.length]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
      onCloseAddRef.current();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={boxRef} className="min-w-0">
      {compact ? (
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {label}
        </label>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          {icon ? (
            <div className="w-8 h-8 flex items-center justify-center bg-[#E3F2FD] rounded-full shrink-0">
              <i className={`${icon} text-[#1E88E5]`}></i>
            </div>
          ) : null}
          <h3 className="text-sm font-bold text-gray-900">{label}</h3>
        </div>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
            if (open) onCloseAdd();
          }}
          className={
            compact
              ? `w-full flex items-center text-left px-4 py-2.5 pr-9 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 ${
                  disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
                } ${open ? 'ring-2 ring-slate-400' : ''}`
              : `w-full text-left px-3.5 py-2.5 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-[#1E88E5] ${
                  disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                } ${open ? 'ring-2 ring-[#1E88E5]' : ''} ${multiline ? 'min-h-[88px] whitespace-pre-wrap' : ''}`
          }
        >
          {value ? (
            compact ? (
              <span className="block min-w-0 flex-1 truncate text-gray-800">{value}</span>
            ) : (
              <span className={`block ${multiline ? 'whitespace-pre-wrap' : 'truncate'} text-gray-800`}>
                {value}
                {selected?.email || selected?.phone ? (
                  <span className="block text-[11px] text-gray-500 font-normal mt-0.5 truncate">
                    {[selected.email, selected.phone].filter(Boolean).join(' · ')}
                  </span>
                ) : selected?.subLabel ? (
                  <span className="block text-[11px] text-gray-500 font-normal mt-0.5 truncate">{selected.subLabel}</span>
                ) : null}
              </span>
            )
          ) : (
            <span className={`block text-gray-400 ${compact ? 'min-w-0 flex-1 truncate' : multiline ? '' : 'truncate'}`}>
              {placeholder}
            </span>
          )}
          <i
            className={`ri-arrow-down-s-line absolute right-3 text-gray-400 text-lg ${
              compact ? 'top-1/2 -translate-y-1/2' : 'top-3'
            }`}
          ></i>
        </button>

        {open && !disabled && menuBox
          ? createPortal(
              <div
                ref={menuRef}
                style={{
                  position: 'fixed',
                  top: menuBox.top,
                  left: menuBox.left,
                  width: menuBox.width,
                  maxHeight: menuBox.maxHeight,
                  zIndex: 80,
                }}
                className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
              >
                <div className="shrink-0 border-b border-gray-100 p-2">
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
                <div className="min-h-0 flex-1 overflow-y-auto">
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
                        <span className="block font-medium whitespace-pre-wrap">{opt.label}</span>
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
                <div className="shrink-0 border-t border-gray-100 bg-gray-50">
                  {!adding ? (
                    <button
                      type="button"
                      onClick={onOpenAdd}
                      className={`inline-flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold ${
                        compact
                          ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-[#1565C0] hover:bg-[#E3F2FD]'
                      }`}
                    >
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E3F2FD] text-[#1565C0]">
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                          <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                      Add new
                    </button>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto bg-white p-3">{addForm}</div>
                  )}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}
