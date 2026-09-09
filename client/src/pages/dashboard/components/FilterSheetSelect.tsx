import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type FilterSheetOption = { value: string; label: string };

const MENU_Z = 10060;

export default function FilterSheetSelect({
  label,
  value,
  options,
  placeholder = 'All',
  disabled = false,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterSheetOption[];
  placeholder?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const width = Math.max(rect.width, 160);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(140, Math.min(320, openUp ? spaceAbove : spaceBelow));
      const top = openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4;
      setPos({ top, left, width, maxHeight });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label || placeholder;

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: MENU_Z,
            }}
            className="overflow-y-auto overscroll-contain rounded-xl border border-[#EEF0F5] bg-white py-1 shadow-[0_12px_40px_rgba(16,24,40,0.18)]"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value || '__all'}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] ${
                    active ? 'bg-teal-50 font-semibold text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {active ? <i className="ri-check-line text-teal-600"></i> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`flex h-11 w-full items-center gap-2 rounded-2xl border border-[#E6E8F0] bg-white px-3 text-left text-[13px] text-slate-700 ${
          disabled ? 'cursor-not-allowed bg-slate-50 text-slate-600' : 'hover:border-teal-300'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-lg text-slate-400`}></i>
      </button>
      {menu}
    </div>
  );
}
