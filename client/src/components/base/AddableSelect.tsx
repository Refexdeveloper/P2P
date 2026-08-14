import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false);
        onCloseAddRef.current();
      }
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

  const selected = options.find((opt) => opt.label === value);

  return (
    <div ref={boxRef}>
      <div className="flex items-center gap-2 mb-3">
        {icon ? (
          <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-full shrink-0">
            <i className={`${icon} text-teal-600`}></i>
          </div>
        ) : null}
        <h3 className="text-sm font-bold text-gray-900">{label}</h3>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (open) onCloseAdd();
          }}
          className={`w-full text-left px-3.5 py-2.5 pr-9 border border-gray-200 rounded-lg text-sm bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer ${
            open ? 'ring-2 ring-teal-500' : ''
          } ${multiline ? 'min-h-[88px] whitespace-pre-wrap' : ''}`}
        >
          {value ? (
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
          ) : (
            <span className={`block ${multiline ? '' : 'truncate'} text-gray-400`}>{placeholder}</span>
          )}
          <i className="ri-arrow-down-s-line absolute right-3 top-3 text-gray-400 text-lg"></i>
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
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
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-teal-50 cursor-pointer border-b border-gray-50 last:border-0 ${
                      opt.label === value ? 'bg-teal-50 text-teal-800' : 'text-gray-800'
                    }`}
                  >
                    <span className="block font-medium whitespace-pre-wrap">{opt.label}</span>
                    {opt.email || opt.phone ? (
                      <span className="mt-1 flex flex-col gap-0.5 text-[11px] text-gray-500 font-normal">
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
                      <span className="block text-[11px] text-gray-500 mt-0.5">{opt.subLabel}</span>
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
                  className="w-full px-3 py-2 text-left text-sm font-semibold text-teal-700 hover:bg-teal-50 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <i className="ri-add-line"></i>
                  Add new
                </button>
              ) : (
                <div className="p-3 space-y-2 bg-white">{addForm}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
