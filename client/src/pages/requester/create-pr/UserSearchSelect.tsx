import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ApprovalUserOption = {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
};

interface Props {
  users: ApprovalUserOption[];
  value: number[];
  onChange: (userIds: number[]) => void;
  placeholder?: string;
  error?: boolean;
  max?: number;
}

const AVATAR_TONES = [
  'bg-teal-600',
  'bg-slate-700',
  'bg-indigo-600',
  'bg-cyan-700',
  'bg-emerald-700',
  'bg-sky-700',
  'bg-violet-700',
  'bg-amber-700',
];

function haystack(u: ApprovalUserOption) {
  return `${u.name} ${u.email} ${u.role} ${u.department}`.toLowerCase();
}

function initials(name: string) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarClass(id: number) {
  return AVATAR_TONES[Math.abs(Number(id) || 0) % AVATAR_TONES.length];
}

function roleBadgeClass(role: string) {
  const r = role.toLowerCase();
  if (r.includes('cfo')) return 'bg-violet-50 text-violet-700 border-violet-200';
  if (r.includes('scm')) return 'bg-sky-50 text-sky-800 border-sky-200';
  if (r.includes('hod') || r.includes('pr manager')) return 'bg-amber-50 text-amber-800 border-amber-200';
  if (r.includes('requester')) return 'bg-slate-100 text-slate-700 border-slate-200';
  if (r.includes('admin')) return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-teal-50 text-teal-800 border-teal-200';
}

export default function UserSearchSelect({
  users,
  value,
  onChange,
  placeholder = 'Search by name, email, role, or department',
  error,
  max = 5,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIds = value;
  const selected = selectedIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is ApprovalUserOption => Boolean(u));
  const atMax = selectedIds.length >= max;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? users.filter((u) => haystack(u).includes(q)) : users;
    return list.slice(0, 60);
  }, [users, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ApprovalUserOption[]>();
    for (const u of matches) {
      const key = u.role || 'Other';
      const bucket = map.get(key) || [];
      bucket.push(u);
      map.set(key, bucket);
    }
    return [...map.entries()];
  }, [matches]);

  const updateMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const spaceBelow = window.innerHeight - r.bottom - 16;
    const spaceAbove = r.top - 16;
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxH = Math.max(180, Math.min(360, openUp ? spaceAbove - gap : spaceBelow - gap));
    const width = Math.min(Math.max(r.width, 320), Math.max(280, window.innerWidth - 24));
    const left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - width - 8));
    setMenuPos({
      top: openUp ? r.top - gap - maxH : r.bottom + gap,
      left,
      width,
      maxH,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    const onWin = () => updateMenuPos();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const pick = (u: ApprovalUserOption) => {
    if (selectedIds.includes(u.id)) {
      onChange(selectedIds.filter((id) => id !== u.id));
      return;
    }
    if (selectedIds.length >= max) return;
    onChange([...selectedIds, u.id]);
    setQuery('');
  };

  const removeAt = (id: number) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const move = (id: number, dir: -1 | 1) => {
    const idx = selectedIds.indexOf(id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= selectedIds.length) return;
    const copy = [...selectedIds];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    onChange(copy);
  };

  const clear = () => {
    onChange([]);
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((i) => Math.min(matches.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = matches[highlight];
      if (hit) pick(hit);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={listRef}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: menuPos.maxH }}
            className="fixed z-[90] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="listbox"
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/90">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {query.trim() ? `Matches for “${query.trim()}”` : 'Select approvers in order'}
              </p>
              <span className="text-[11px] font-semibold text-slate-400">
                {matches.length} of {users.length}
              </span>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: menuPos.maxH - 44 }}>
              {matches.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <span className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                    <i className="ri-user-search-line text-lg" />
                  </span>
                  <p className="text-sm font-semibold text-slate-800">No users match “{query.trim()}”</p>
                  <p className="text-xs text-slate-500 mt-1">Try another name, email, role, or department.</p>
                </div>
              ) : (
                grouped.map(([role, list]) => (
                  <div key={role}>
                    {!query.trim() && (
                      <div className="sticky top-0 z-10 px-3.5 py-1.5 bg-slate-50/95 border-y border-slate-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{role}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">{list.length}</span>
                      </div>
                    )}
                    {list.map((u) => {
                      const idx = matches.findIndex((x) => x.id === u.id);
                      const active = highlight === idx;
                      const isSelected = selectedIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setHighlight(idx)}
                          onClick={() => pick(u)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-b border-slate-50 last:border-0 ${
                            active ? 'bg-teal-50' : 'hover:bg-slate-50'
                          } ${isSelected ? 'ring-inset' : ''}`}
                        >
                          <span
                            className={`w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0 ${avatarClass(u.id)}`}
                          >
                            {initials(u.name)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold text-slate-900 truncate">{u.name}</span>
                              <span
                                className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}
                              >
                                {u.role}
                              </span>
                            </span>
                            <span className="block text-xs text-slate-500 truncate mt-0.5">
                              {u.email}
                              {u.department ? ` · ${u.department}` : ''}
                            </span>
                          </span>
                          {isSelected ? (
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {selectedIds.indexOf(u.id) + 1}
                            </span>
                          ) : active ? (
                            <i className="ri-arrow-right-s-line text-teal-600 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative w-full space-y-2">
      {selected.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Approval order — {selected.length === 1 ? '1 person' : `${selected.length} people`}
          </p>
          {selected.map((u, index) => (
            <div
              key={u.id}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white"
            >
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <span className={`w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0 ${avatarClass(u.id)}`}>
                {initials(u.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${roleBadgeClass(u.role)}`}>
                    {u.role}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {index === 0 ? 'Approves first' : `Then person ${index + 1}`}
                  {u.email ? ` · ${u.email}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => move(u.id, -1)}
                  disabled={index === 0}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                  title="Move up"
                >
                  <i className="ri-arrow-up-s-line" />
                </button>
                <button
                  type="button"
                  onClick={() => move(u.id, 1)}
                  disabled={index === selected.length - 1}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                  title="Move down"
                >
                  <i className="ri-arrow-down-s-line" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(u.id)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Remove"
                >
                  <i className="ri-close-line" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div
        className={`flex items-center gap-2 h-12 px-3.5 border rounded-2xl bg-white ${
          open ? 'border-teal-500 ring-2 ring-teal-500/15' : error ? 'border-red-400' : 'border-slate-200'
        }`}
      >
        <i className="ri-user-search-line text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHighlight(0);
            updateMenuPos();
          }}
          onKeyDown={onKeyDown}
          placeholder={atMax ? `Maximum ${max} approvers selected` : placeholder}
          className="flex-1 min-w-0 h-full text-sm bg-transparent outline-none placeholder:text-slate-400"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {selected.length > 0 && (
          <button type="button" onClick={clear} className="text-[11px] font-semibold text-slate-500 hover:text-red-600 shrink-0">
            Clear
          </button>
        )}
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-700 shrink-0"
          >
            <i className="ri-close-line text-lg" />
          </button>
        ) : (
          <i className={`ri-arrow-down-s-line text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </div>
      {menu}
    </div>
  );
}
