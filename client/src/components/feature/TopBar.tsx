import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ensureNavigation } from '../../constants/roleNavigation';
import { useAuth } from '../../contexts/AuthContext';
import {
  searchApi,
  type GlobalSearchPoHit,
  type GlobalSearchPrHit,
  type NavItem,
} from '../../services/api';
import { getUserDesignation } from '../../utils/roleDisplay';
import BrandLogo from './BrandLogo';

type TopBarProps = {
  onMenuClick?: () => void;
};

type PageHit = {
  kind: 'page';
  id: string;
  label: string;
  path: string;
  group?: string;
  icon: string;
};

type ResultHit =
  | PageHit
  | ({ kind: 'pr' } & GlobalSearchPrHit)
  | ({ kind: 'po' } & GlobalSearchPoHit);

function matchNavPages(nav: NavItem[], query: string): PageHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const hits: PageHit[] = [];
  for (const item of nav) {
    const hay = `${item.label} ${item.path} ${item.group || ''} ${item.code || ''}`.toLowerCase();
    if (!hay.includes(q)) continue;
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    hits.push({
      kind: 'page',
      id: item.code || item.path,
      label: item.label,
      path: item.path,
      group: item.group,
      icon: item.icon || 'ri-compass-3-line',
    });
  }
  return hits.slice(0, 8);
}

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

function hasNavPath(nav: NavItem[], path: string) {
  return nav.some((item) => item.path === path || item.path.startsWith(`${path}?`));
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prs, setPrs] = useState<GlobalSearchPrHit[]>([]);
  const [pos, setPos] = useState<GlobalSearchPoHit[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

  const navItems = useMemo(
    () => ensureNavigation(user?.role || null, user?.navigation || [], user?.email || null),
    [user?.navigation, user?.role, user?.email]
  );

  const pageHits = useMemo(() => matchNavPages(navItems, searchQuery), [navItems, searchQuery]);

  const results: ResultHit[] = useMemo(() => {
    const list: ResultHit[] = [
      ...pageHits,
      ...prs.map((hit) => ({ kind: 'pr' as const, ...hit })),
      ...pos.map((hit) => ({ kind: 'po' as const, ...hit })),
    ];
    return list;
  }, [pageHits, prs, pos]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setMobileSearch(true);
        setOpen(true);
        window.setTimeout(() => {
          (searchRef.current || mobileSearchRef.current)?.focus();
        }, 0);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setMobileSearch(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) {
      setPrs([]);
      setPos([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchApi
        .query(q, 8)
        .then((res) => {
          if (cancelled) return;
          setPrs(Array.isArray(res.data?.prs) ? res.data.prs : []);
          setPos(Array.isArray(res.data?.pos) ? res.data.pos : []);
        })
        .catch(() => {
          if (cancelled) return;
          setPrs([]);
          setPos([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, results.length]);

  const goToResult = (hit: ResultHit) => {
    setOpen(false);
    setMobileSearch(false);
    setSearchQuery('');
    if (hit.kind === 'page') {
      navigate(hit.path);
      return;
    }
    if (hit.kind === 'pr') {
      const q = encodeURIComponent(hit.prNumber || String(hit.id));
      if (hasNavPath(navItems, '/requester/track-pr')) {
        navigate(`/requester/track-pr?q=${q}`);
      } else if (hasNavPath(navItems, '/scm/purchase-requests')) {
        navigate(`/scm/purchase-requests?q=${q}`);
      } else if (hasNavPath(navItems, '/scm/track-po')) {
        navigate(`/scm/track-po?search=${q}`);
      } else if (hasNavPath(navItems, '/tasks')) {
        navigate(`/tasks?q=${q}`);
      } else {
        navigate(`/requester/track-pr?q=${q}`);
      }
      return;
    }
    const q = encodeURIComponent(hit.poNumber || String(hit.id));
    if (hasNavPath(navItems, '/scm/track-po')) {
      navigate(`/scm/track-po?search=${q}`);
    } else if (hasNavPath(navItems, '/requester/track-pr') && hit.prNumber) {
      navigate(`/requester/track-pr?q=${encodeURIComponent(hit.prNumber)}`);
    } else {
      navigate(`/scm/track-po?search=${q}`);
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && searchQuery.trim()) setOpen(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) goToResult(hit);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const getInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2);
  };

  const designation = getUserDesignation(user);
  const showPanel = open && searchQuery.trim().length > 0;

  const renderResults = (compact = false) => (
    <div
      className={`absolute left-0 right-0 z-[60] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)] ${
        compact ? 'max-h-[70vh]' : 'max-h-[min(28rem,70vh)]'
      }`}
      role="listbox"
    >
      <div className="max-h-[inherit] overflow-y-auto py-2">
        {loading && results.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <i className="ri-loader-4-line animate-spin" />
            Searching…
          </div>
        ) : null}
        {!loading && results.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            No matches for <span className="font-semibold text-slate-700">“{searchQuery.trim()}”</span>.
            Try a PR number, PO number, vendor, page name, or title.
          </div>
        ) : null}

        {pageHits.length > 0 ? (
          <div className="px-2 pb-1">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pages
            </p>
            {pageHits.map((hit) => {
              const idx = results.indexOf(hit);
              return (
                <button
                  key={hit.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                    idx === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goToResult(hit)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <i className={hit.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{hit.label}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {hit.group ? `${hit.group} · ` : ''}
                      {hit.path}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {prs.length > 0 ? (
          <div className="px-2 pb-1">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Purchase requests
            </p>
            {prs.map((hit) => {
              const item = { kind: 'pr' as const, ...hit };
              const idx = results.findIndex((r) => r.kind === 'pr' && r.id === hit.id);
              return (
                <button
                  key={`pr-${hit.id}`}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                    idx === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goToResult(item)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <i className="ri-file-list-3-line" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{hit.prNumber}</span>
                    <span className="block truncate text-xs text-slate-500">{hit.title}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                    {formatInr(hit.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {pos.length > 0 ? (
          <div className="px-2 pb-1">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Purchase orders
            </p>
            {pos.map((hit) => {
              const item = { kind: 'po' as const, ...hit };
              const idx = results.findIndex((r) => r.kind === 'po' && r.id === hit.id);
              return (
                <button
                  key={`po-${hit.id}`}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${
                    idx === activeIndex ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => goToResult(item)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                    <i className="ri-shopping-cart-2-line" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{hit.poNumber}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {hit.vendorName || hit.title || hit.prNumber || 'PO'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                    {formatInr(hit.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
        Search pages, PR / PO numbers, titles, vendors · ↑↓ Enter
      </div>
    </div>
  );

  return (
    <div className="h-14 sm:h-16 bg-[#f7f7f8] border-b border-gray-200 border-t-[3px] border-t-[#f5c9a8] flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 lg:px-5 shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-white/80 cursor-pointer shrink-0"
          aria-label="Open navigation"
        >
          <i className="ri-menu-line text-xl"></i>
        </button>

        <BrandLogo className="shrink-0" />

        <div ref={boxRef} className="relative hidden sm:block flex-1 max-w-xl lg:max-w-2xl min-w-0">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base z-[1]"></i>
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder="What are you looking for today?"
            className="w-full h-10 pl-10 pr-28 bg-white border border-gray-200 rounded-full text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 shadow-sm"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={showPanel}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 whitespace-nowrap select-none">
            {isMac ? 'Cmd+E' : 'Ctrl+E'}
          </span>
          {showPanel ? renderResults() : null}
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
        <button
          type="button"
          className="sm:hidden p-2 hover:bg-white/80 rounded-lg transition-colors"
          aria-label="Search"
          onClick={() => {
            setMobileSearch(true);
            setOpen(true);
            window.setTimeout(() => mobileSearchRef.current?.focus(), 0);
          }}
        >
          <i className="ri-search-line text-gray-600 text-xl"></i>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-sky-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-sm">{getInitials()}</span>
            </div>
            <div className="text-left min-w-0 max-w-[7rem] sm:max-w-[8rem]">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
              {designation ? (
                <p className="text-xs text-gray-500 truncate">{designation}</p>
              ) : null}
            </div>
            <i className="ri-arrow-down-s-line text-gray-600 hidden sm:inline"></i>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{user?.email}</p>
                  {designation ? (
                    <p className="text-xs text-sky-600 font-medium mt-1">{designation}</p>
                  ) : null}
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <i className="ri-user-line"></i>
                    <span className="whitespace-nowrap">Profile</span>
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <i className="ri-settings-3-line"></i>
                    <span className="whitespace-nowrap">Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <i className="ri-logout-box-line"></i>
                    <span className="whitespace-nowrap">Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {mobileSearch ? (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 sm:hidden" onClick={() => setMobileSearch(false)}>
          <div
            className="absolute inset-x-0 top-0 bg-[#f7f7f8] p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative" ref={boxRef}>
              <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
              <input
                ref={mobileSearchRef}
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setOpen(true);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Search pages, PR, PO, vendor…"
                className="w-full h-11 pl-10 pr-10 bg-white border border-gray-200 rounded-full text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                autoComplete="off"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500"
                onClick={() => setMobileSearch(false)}
                aria-label="Close search"
              >
                <i className="ri-close-line text-lg" />
              </button>
              {showPanel ? renderResults(true) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
