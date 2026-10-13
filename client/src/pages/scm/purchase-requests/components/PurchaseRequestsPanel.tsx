import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { poApi, prApi } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PRBucketExpandedRow from './PRBucketExpandedRow';
import PoSampleCsvTable from '../../../../components/feature/PoSampleCsvTable';
import {
  downloadPoImportSampleCsv,
  parsePoImportCsv,
  storePoCsvImport,
} from '../../../../utils/poCsvImport';
import AnimatedKpiCard, { type KpiVariant } from '../../../../components/feature/AnimatedKpiCard';

export type PurchaseRequestsPanelHandle = {
  openImport: () => void;
};

type RowStatus = 'Ready for PO' | 'Pending Approval' | 'PO Approved' | 'PO Rejected' | 'Draft' | 'Cancelled';

interface BucketRow {
  key: string;
  prId: number;
  prNumber: string;
  poNumber: string | null;
  poId: number | null;
  title: string;
  entityName?: string;
  department: string;
  requester: string;
  amount: number;
  recommendedVendor: string;
  requiredDate: string;
  poDate?: string;
  status: RowStatus;
  statusLabel: string;
  statusRaw: string;
}

type TrackPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type TrackStats = {
  total: number;
  ready: number;
  pending: number;
  approved: number;
  rejected: number;
  draft?: number;
  cancelled?: number;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function mapTrackStatusToBucket(status: string, statusRaw?: string): RowStatus {
  const s = String(status || '').toLowerCase();
  const raw = String(statusRaw || '').toLowerCase();
  if (s === 'ready') return 'Ready for PO';
  if (raw === 'pending_approval' || (s === 'pending' && raw !== 'pending_buyer_verify')) {
    return 'Pending Approval';
  }
  if (raw === 'pending_buyer_verify') return 'PO Approved';
  if (s === 'pending') return 'Pending Approval';
  if (s === 'rejected' || raw === 'rejected') return 'PO Rejected';
  if (s === 'draft' || raw === 'draft') return 'Draft';
  if (s === 'cancelled' || raw === 'cancelled') return 'Cancelled';
  return 'PO Approved';
}

function mapUiFilterToApi(filter: 'all' | 'ready' | 'created' | 'approved' | 'rejected' | 'draft' | 'cancelled'): string {
  if (filter === 'created') return 'pending';
  return filter;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);



type WorkspaceFilter = 'all' | 'ready' | 'draft' | 'created' | 'approved' | 'rejected';

/** Workspace KPI cards — rendered with the shared AnimatedKpiCard (same look as the requester dashboard). */
const PO_KPIS: {
  label: string;
  caption: string;
  emptyCaption: string;
  stat: 'total' | 'readyForPO' | 'draft' | 'pendingApproval' | 'poApproved' | 'poRejected';
  filter: WorkspaceFilter;
  icon: string;
  variant: KpiVariant;
  /** Pulsing dot when there is something waiting. */
  live?: boolean;
}[] = [
  { label: 'Total PRs', caption: 'All purchase requests', emptyCaption: 'No requests yet', stat: 'total', filter: 'all', icon: 'ri-file-list-3-line', variant: 'all' },
  { label: 'Ready for PO', caption: 'PRs ready to convert', emptyCaption: 'Nothing ready yet', stat: 'readyForPO', filter: 'ready', icon: 'ri-shopping-cart-2-line', variant: 'ready', live: true },
  { label: 'Draft POs', caption: 'Draft purchase orders', emptyCaption: 'No drafts', stat: 'draft', filter: 'draft', icon: 'ri-draft-line', variant: 'draft' },
  { label: 'With SCM Manager', caption: 'Awaiting SCM approval', emptyCaption: 'Nothing awaiting', stat: 'pendingApproval', filter: 'created', icon: 'ri-team-line', variant: 'pending_approval', live: true },
  { label: 'PO Approved', caption: 'Approved purchase orders', emptyCaption: 'No approvals yet', stat: 'poApproved', filter: 'approved', icon: 'ri-file-check-line', variant: 'approved' },
  { label: 'PO Rejected', caption: 'Rejected purchase orders', emptyCaption: 'No rejected POs', stat: 'poRejected', filter: 'rejected', icon: 'ri-close-circle-line', variant: 'rejected' },
];

/** Rotating colours for the document icon on each row. */
const DOC_TONES = ['blue', 'violet', 'green', 'orange', 'red', 'teal'] as const;

/** Stable avatar colour from a name. */
function avatarTone(name: string): string {
  const tones = ['blue', 'violet', 'green', 'orange', 'teal', 'red'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return tones[h % tones.length];
}

/** Page buttons with ellipses: 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): (number | '…')[] {
  const pages = Array.from({ length: Math.max(1, total) }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1 || (current <= 3 && p <= 5) || (current >= total - 2 && p >= total - 4)
  );
  const out: (number | '…')[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - (pages[i - 1] as number) > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** Colour family for a row's status pill. */
function statusTone(statusRaw: string, bucket: RowStatus): string {
  const raw = String(statusRaw || '').toLowerCase();
  if (raw === 'pending_approval') return 'blue';
  if (raw === 'pending_buyer_verify') return 'teal';
  if (raw === 'sent_to_vendor') return 'orange';
  if (raw === 'invoice_entry' || raw === 'pending_accounts_approval') return 'sky';
  switch (bucket) {
    case 'Ready for PO':
      return 'teal';
    case 'Pending Approval':
      return 'blue';
    case 'PO Approved':
      return 'green';
    case 'PO Rejected':
    case 'Cancelled':
      return 'red';
    case 'Draft':
      return 'violet';
    default:
      return 'gray';
  }
}


/** Compact badge text so long statuses do not overlap Actions. */
function shortStatusLabel(label: string, statusRaw?: string) {
  const raw = String(statusRaw || '').toLowerCase();
  if (raw === 'pending_buyer_verify') return 'Buyer Verify';
  if (raw === 'pending_approval') return 'SCM Manager';
  if (raw === 'sent_to_vendor') return 'Vendor Acknowledged pending';
  if (raw === 'awaiting_grn') return 'Awaiting GRN';
  if (raw === 'grn_completed') return 'GRN Done';
  if (raw === 'invoice_entry') return 'Invoice Entry';
  if (raw === 'pending_accounts_approval') return 'Accounts';
  if (raw === 'approved_for_payment') return 'For Payment';
  const full = String(label || '').trim();
  if (/scm manager signed/i.test(full)) return 'Buyer Verify';
  if (/pending vendor acceptance/i.test(full)) return 'Vendor Acknowledged pending';
  if (/pending scm manager sign/i.test(full)) return 'SCM Manager';
  return full;
}

const PurchaseRequestsPanel = forwardRef<PurchaseRequestsPanelHandle>(function PurchaseRequestsPanel(_props, ref) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'Super Admin');
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'created' | 'approved' | 'rejected' | 'draft' | 'cancelled'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<TrackPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState({
    total: 0,
    readyForPO: 0,
    pendingApproval: 0,
    poApproved: 0,
    poRejected: 0,
    draft: 0,
    cancelled: 0,
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<BucketRow | null>(null);
  const [readyOptions, setReadyOptions] = useState<BucketRow[]>([]);
  const [importTab, setImportTab] = useState<'reference' | 'csv'>('csv');
  const [importPoNumber, setImportPoNumber] = useState('');
  const [importError, setImportError] = useState('');
  const [importChecking, setImportChecking] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [retrievingKey, setRetrievingKey] = useState<string | null>(null);
  /** Row whose "⋯" actions menu is open. */
  const [menuKey, setMenuKey] = useState<string | null>(null);

  useEffect(() => {
    if (!menuKey) return;
    const close = () => setMenuKey(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuKey]);
  const csvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const mapTrackRows = (data: Array<Record<string, unknown>>): BucketRow[] =>
    data.map((r) => ({
      key: String(r.key),
      prId: Number(r.prId) || 0,
      prNumber: String(r.prNumber || ''),
      poNumber: r.poNumber ? String(r.poNumber) : null,
      poId: r.poId != null ? Number(r.poId) : null,
      title: String(r.title || ''),
      entityName: String(r.entityName || ''),
      department: String(r.department || ''),
      requester: String(r.requester || ''),
      amount: Number(r.amount) || 0,
      recommendedVendor: String(r.vendorName || ''),
      requiredDate: String(r.requiredDate || ''),
      poDate: r.poDate ? String(r.poDate) : '',
      status: mapTrackStatusToBucket(String(r.status), String(r.statusRaw || '')),
      statusLabel: String(r.statusLabel || r.status || ''),
      statusRaw: String(r.statusRaw || ''),
    }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poApi.listTrack({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: mapUiFilterToApi(statusFilter),
        includeStats: true,
      });
      setRows(mapTrackRows(res.data as Array<Record<string, unknown>>));
      if (res.pagination) {
        setPagination(res.pagination);
        if (res.pagination.page !== page) setPage(res.pagination.page);
      }
      const s = res.stats as TrackStats | undefined;
      if (s) {
        setStats({
          total: s.total,
          readyForPO: s.ready,
          pendingApproval: s.pending,
          poApproved: s.approved,
          poRejected: s.rejected,
          draft: s.draft ?? 0,
          cancelled: s.cancelled ?? 0,
        });
      }
      setError('');
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load');
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdminDelete = async (pr: BucketRow) => {
    if (!isSuperAdmin) return;
    if (pr.poId) {
      const ok = window.confirm(
        `Delete ${pr.poNumber || 'this PO'}?\n\nThis permanently removes the purchase order. This cannot be undone.`
      );
      if (!ok) return;
      setDeletingKey(pr.key);
      setError('');
      try {
        await poApi.adminDelete(pr.poId);
        if (expandedKey === pr.key) setExpandedKey(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete PO');
      } finally {
        setDeletingKey(null);
      }
      return;
    }
    if (pr.prId > 0) {
      const ok = window.confirm(
        `Delete ${pr.prNumber || 'this PR'}?\n\nThis permanently removes the purchase request and any linked RFQ / PO. This cannot be undone.`
      );
      if (!ok) return;
      setDeletingKey(pr.key);
      setError('');
      try {
        await prApi.adminDelete(pr.prId);
        if (expandedKey === pr.key) setExpandedKey(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete PR');
      } finally {
        setDeletingKey(null);
      }
    }
  };

  const loadReadyOptions = async (): Promise<BucketRow[]> => {
    try {
      const res = await poApi.listTrack({ status: 'ready', page: 1, limit: 100 });
      const opts = mapTrackRows(res.data as Array<Record<string, unknown>>);
      setReadyOptions(opts);
      return opts;
    } catch {
      setReadyOptions([]);
      return [];
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const openCreatePo = (prId: number, opts?: { refPo?: string; fromCsv?: boolean }) => {
    if (!prId) {
      setError('This row has no purchase request to create a PO from.');
      return;
    }
    const qs = new URLSearchParams({
      prId: String(prId),
      mode: opts?.fromCsv ? 'import' : 'manual',
      from: 'create-po',
    });
    if (opts?.refPo?.trim()) {
      qs.set('refPo', opts.refPo.trim());
      qs.set('mode', 'import');
    }
    if (opts?.fromCsv) qs.set('from', 'csv');
    navigate(`/scm/create-po?${qs.toString()}`);
  };

  const openEditDraft = (poId: number) => {
    if (!poId) {
      setError('This draft PO could not be opened.');
      return;
    }
    navigate(`/scm/create-po?poId=${poId}&from=create-po`);
  };

  const openAdminEditPo = (poId: number) => {
    if (!poId) {
      setError('This PO could not be opened.');
      return;
    }
    navigate(`/scm/create-po?poId=${poId}&from=create-po`);
  };

  const handleRetrieveCancelled = async (pr: BucketRow) => {
    if (!pr.poId) return;
    const ok = window.confirm(
      `Retrieve ${pr.poNumber || 'this cancelled PO'} as a draft?\n\nYou can edit and resubmit it for approval.`
    );
    if (!ok) return;
    setRetrievingKey(pr.key);
    setError('');
    try {
      await poApi.retrieve(pr.poId);
      openEditDraft(pr.poId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve cancelled PO');
    } finally {
      setRetrievingKey(null);
    }
  };

  const openImportModal = async (row?: BucketRow) => {
    const opts = await loadReadyOptions();
    const target = row || opts[0] || null;
    if (!target) {
      setError('No purchase requests are Ready for PO. Complete RFQ approval first.');
      return;
    }
    setImportTarget(target);
    setImportTab('csv');
    setImportPoNumber('');
    setImportError('');
    setError('');
  };

  useImperativeHandle(ref, () => ({
    openImport: () => {
      void openImportModal();
    },
  }));

  const confirmImportAndCreate = async () => {
    if (!importTarget) return;
    const value = importPoNumber.trim();
    if (!value) {
      setImportError('Enter a reference PO number');
      return;
    }
    setImportChecking(true);
    setImportError('');
    try {
      const res = await poApi.getByNumber(value);
      const po = res.data as { poNumber?: string };
      if (!po?.poNumber) throw new Error('PO not found');
      const prId = importTarget.prId;
      setImportTarget(null);
      openCreatePo(prId, { refPo: String(po.poNumber) });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'PO not found');
    } finally {
      setImportChecking(false);
    }
  };

  const handleCsvImportFile = async (file: File | null) => {
    if (!importTarget || !file) return;
    setImportChecking(true);
    setImportError('');
    try {
      const text = await file.text();
      const payload = parsePoImportCsv(text);
      storePoCsvImport(payload);
      let prId = importTarget.prId;
      const csvPr = String(payload.prNumber || '').trim().toLowerCase();
      if (csvPr) {
        const match = readyOptions.find((r) => r.prNumber.toLowerCase() === csvPr);
        if (match) prId = match.prId;
      }
      setImportTarget(null);
      openCreatePo(prId, { fromCsv: true });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImportChecking(false);
      if (csvFileRef.current) csvFileRef.current.value = '';
    }
  };

  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="tfx-kpis-6 mb-5 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {PO_KPIS.map((k, i) => {
          const value = Number(stats[k.stat]) || 0;
          return (
            <AnimatedKpiCard
              key={k.label}
              title={k.label}
              value={value}
              variant={k.variant}
              index={i}
              total={Number(stats.total) || 0}
              subtitle={value ? k.caption : k.emptyCaption}
              live={Boolean(k.live && value)}
              selected={statusFilter === k.filter}
              fallbackIcon={k.icon}
              onClick={() => {
                setStatusFilter(k.filter);
                setPage(1);
                setExpandedKey(null);
                document.getElementById('po-workspace-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          );
        })}
      </div>

      <section id="po-workspace-table" className="po-panel tfx-panel relative scroll-mt-24 rounded-[20px]">
        <div className="po-filter">
          <div className="po-search">
            <i className="ri-search-line" aria-hidden />
            <input
              type="text"
              placeholder="Search by PR number, PO number, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="tfx-input"
            />
          </div>
          <div className="po-tabs">
            {(
              [
                ['all', 'All', stats.total, 'teal'],
                ['ready', 'Ready', stats.readyForPO, 'blue'],
                ['created', 'SCM Sign', stats.pendingApproval, 'blue'],
                ['approved', 'Approved', stats.poApproved, 'green'],
                ['rejected', 'Rejected', stats.poRejected, 'red'],
                ['draft', 'Draft', stats.draft, 'violet'],
                ['cancelled', 'Cancelled', stats.cancelled, 'gray'],
              ] as const
            ).map(([key, label, count, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setPage(1);
                  setExpandedKey(null);
                }}
                className={`tfx-tab po-tab3 tone-${tone}${statusFilter === key ? ' is-active' : ''}`}
              >
                {label}
                <span className="tfx-cnt">{count}</span>
              </button>
            ))}
          </div>
        </div>

        <div data-po-workspace-scroll className="relative z-[1] w-full overflow-x-auto px-4 pb-2">
          {loading ? (
            <div className="space-y-2.5 py-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="po-skel h-16 rounded-2xl" />
              ))}
            </div>
          ) : (
            <table className="po-table w-full min-w-[1120px] table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-sm">
              <colgroup>
                <col className="w-[17%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[17%]" />
              </colgroup>
              <thead>
                <tr>
                  {['PR / PO Number', 'PO Date', 'Entity', 'Title', 'Department', 'Requester', 'Amount', 'Status', 'Actions'].map(
                    (label) => (
                      <th
                        key={label}
                        className={`tfx-th px-3 py-3 text-[13px] font-extrabold uppercase tracking-[0.06em] text-[#0F172A] first:pl-4 last:pr-4 ${
                          label === 'Amount' || label === 'Actions' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="po-empty">
                      <i className="ri-inbox-line" aria-hidden />
                      No purchase requests found
                    </td>
                  </tr>
                ) : (
                  rows.map((pr, rowIndex) => {
                    const isExpanded = expandedKey === pr.key;
                    const statusText = shortStatusLabel(pr.statusLabel, pr.statusRaw);
                    const tone = statusTone(pr.statusRaw, pr.status);
                    return (
                      <Fragment key={pr.key}>
                        <tr
                          className={`po-row cursor-pointer${isExpanded ? ' is-open' : ''}`}
                          style={{ '--r': rowIndex } as CSSProperties}
                          onClick={() => toggleExpand(pr.key)}
                        >
                          <td className="pl-3 pr-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="po-expand"
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                                role="button"
                              >
                                <i className="ri-arrow-right-s-line" aria-hidden />
                              </span>
                              <span className={`po-docic tone-${DOC_TONES[rowIndex % DOC_TONES.length]}`} aria-hidden>
                                <i className="ri-file-text-line" />
                              </span>
                              <div
                                className="min-w-0"
                                title={[pr.prNumber, pr.poNumber].filter(Boolean).join(' · ') || undefined}
                              >
                                <p className="po-prno max-w-full truncate">{pr.prNumber || '—'}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">{pr.poNumber || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 text-slate-600">{pr.poDate || '—'}</td>
                          <td className="px-3" title={pr.entityName || undefined}>
                            <p className="truncate text-slate-600">{pr.entityName || '—'}</p>
                          </td>
                          <td className="px-3" title={pr.title}>
                            <p className="truncate font-semibold text-slate-800">{pr.title}</p>
                          </td>
                          <td className="truncate px-3 text-slate-600" title={pr.department}>
                            {pr.department ? (
                              <>
                                <i className={`po-dot tone-${avatarTone(pr.department)}`} aria-hidden />
                                {pr.department}
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3" title={pr.requester}>
                            {pr.requester ? (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`po-avatar tone-${avatarTone(pr.requester)}`} aria-hidden>
                                  {pr.requester.trim().charAt(0).toUpperCase()}
                                </span>
                                <span className="truncate text-slate-600">{pr.requester}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 text-right font-bold tabular-nums text-slate-900">
                            {formatCurrency(pr.amount)}
                          </td>
                          <td className="px-3">
                            <span className={`po-pill tone-${tone}`} title={pr.statusLabel}>
                              {tone === 'green' && <i className="ri-checkbox-circle-fill" aria-hidden />}
                              {tone === 'blue' && /scm/i.test(statusText) && (
                                <i className="ri-shield-check-fill" aria-hidden />
                              )}
                              {statusText === 'Vendor Acknowledged pending' ? 'Vendor Ack. pending' : statusText}
                            </span>
                          </td>
                          <td className="pl-3 pr-4" onClick={(e) => e.stopPropagation()}>
                            <div className="relative flex flex-nowrap items-center justify-end gap-1.5">
                              {pr.status === 'Ready for PO' ? (
                                <button type="button" onClick={() => openCreatePo(pr.prId)} className="po-act solid">
                                  Create PO
                                </button>
                              ) : pr.status === 'Draft' && pr.poId ? (
                                <button type="button" onClick={() => openEditDraft(pr.poId!)} className="po-act tint">
                                  <i className="ri-edit-line mr-1.5" aria-hidden />
                                  Edit
                                </button>
                              ) : pr.status === 'Cancelled' && pr.poId ? (
                                <button
                                  type="button"
                                  disabled={retrievingKey === pr.key}
                                  onClick={() => void handleRetrieveCancelled(pr)}
                                  className="po-act solid"
                                  title="Retrieve cancelled PO as draft"
                                >
                                  {retrievingKey === pr.key ? 'Retrieving…' : 'Retrieve'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(pr.key)}
                                  className={`po-act icon${isExpanded ? ' is-on' : ''}`}
                                  title={isExpanded ? 'Hide details' : 'View details'}
                                  aria-label={isExpanded ? 'Hide details' : 'View details'}
                                >
                                  <i className={isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'} />
                                </button>
                              )}
                              {pr.poId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/po-pdf-view?poId=${pr.poId}&from=purchase-requests`)}
                                  className="po-act"
                                >
                                  <i className="ri-file-pdf-2-line mr-1.5" aria-hidden />
                                  View PDF
                                </button>
                              )}
                              {(() => {
                                const items: { label: string; icon: string; danger?: boolean; disabled?: boolean; run: () => void }[] = [];
                                // When the primary button is Create PO / Edit / Retrieve, "View details" moves into the menu.
                                if (pr.status === 'Ready for PO' || (pr.status === 'Draft' && pr.poId) || (pr.status === 'Cancelled' && pr.poId)) {
                                  items.push({ label: isExpanded ? 'Hide details' : 'View details', icon: 'ri-eye-line', run: () => toggleExpand(pr.key) });
                                }
                                if (isSuperAdmin && pr.poId && pr.status !== 'Draft' && pr.status !== 'Cancelled') {
                                  items.push({ label: 'Edit PO / WO', icon: 'ri-edit-line', run: () => openAdminEditPo(pr.poId!) });
                                }
                                if (pr.status !== 'Ready for PO' && !pr.poId && pr.prId > 0) {
                                  items.push({ label: 'Open RFQ', icon: 'ri-file-list-3-line', run: () => navigate(`/scm/rfq-entry/${pr.prId}`) });
                                }
                                if (isSuperAdmin && (pr.poId || pr.prId > 0)) {
                                  items.push({
                                    label: deletingKey === pr.key ? 'Deleting…' : pr.poId ? 'Delete PO' : 'Delete PR',
                                    icon: 'ri-delete-bin-line',
                                    danger: true,
                                    disabled: deletingKey === pr.key,
                                    run: () => void handleAdminDelete(pr),
                                  });
                                }
                                if (items.length === 0) return null;
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuKey((k) => (k === pr.key ? null : pr.key));
                                      }}
                                      className={`po-act icon${menuKey === pr.key ? ' is-on' : ''}`}
                                      aria-label="More actions"
                                      aria-expanded={menuKey === pr.key}
                                    >
                                      <i className="ri-more-fill" />
                                    </button>
                                    {menuKey === pr.key && (
                                      <div className="po-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                                        {items.map((it) => (
                                          <button
                                            key={it.label}
                                            type="button"
                                            role="menuitem"
                                            disabled={it.disabled}
                                            onClick={() => {
                                              setMenuKey(null);
                                              it.run();
                                            }}
                                            className={it.danger ? 'danger' : undefined}
                                          >
                                            <i className={it.icon} aria-hidden />
                                            {it.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (pr.prId > 0 || !!pr.poId) && (
                          <PRBucketExpandedRow
                            prId={pr.prId}
                            colSpan={9}
                            statusLabel={pr.statusLabel}
                            statusRaw={pr.statusRaw}
                            poId={pr.poId}
                            poNumber={pr.poNumber}
                            title={pr.title}
                            showCreatePo={pr.status === 'Ready for PO'}
                            onCreatePo={() => openCreatePo(pr.prId)}
                            onEditPo={
                              pr.poId &&
                              (pr.status === 'Draft' ||
                                (isSuperAdmin && pr.status !== 'Cancelled'))
                                ? () =>
                                    pr.status === 'Draft'
                                      ? openEditDraft(pr.poId!)
                                      : openAdminEditPo(pr.poId!)
                                : undefined
                            }
                          />
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="po-foot">
          <p className="text-sm text-slate-500">
            Showing <b className="text-slate-800">{rangeFrom}</b>–<b className="text-slate-800">{rangeTo}</b> of{' '}
            <b className="text-slate-800">{pagination.total}</b> results
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-500">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                  setExpandedKey(null);
                }}
                className="tfx-input h-9 cursor-pointer rounded-xl border bg-white px-2 text-sm outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setExpandedKey(null);
                }}
                className="po-pg"
                aria-label="Previous page"
              >
                <i className="ri-arrow-left-s-line" />
              </button>
              {pageNumbers(pagination.page, pagination.totalPages).map((p, idx) =>
                p === '…' ? (
                  <span key={`gap-${idx}`} className="px-1 text-sm text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setPage(p);
                      setExpandedKey(null);
                    }}
                    className={`po-pg${p === pagination.page ? ' is-active' : ''}`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => {
                  setPage((p) => p + 1);
                  setExpandedKey(null);
                }}
                className="po-pg"
                aria-label="Next page"
              >
                <i className="ri-arrow-right-s-line" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {importTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Import PO</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a Ready for PO request, then import via Sample CSV or a reference PO.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportTarget(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Purchase request</label>
            <select
              value={importTarget.prId}
              onChange={(e) => {
                const next = readyOptions.find((r) => r.prId === Number(e.target.value));
                if (next) setImportTarget(next);
              }}
              className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5] bg-white"
            >
              {readyOptions.map((r) => (
                <option key={r.prId} value={r.prId}>
                  {r.prNumber} — {r.title}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => {
                  setImportTab('csv');
                  setImportError('');
                }}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold ${importTab === 'csv' ? 'bg-[#1E88E5] text-white' : 'bg-white text-gray-600'}`}
              >
                CSV Import
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTab('reference');
                  setImportError('');
                }}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold border-l border-gray-200 ${importTab === 'reference' ? 'bg-[#1E88E5] text-white' : 'bg-white text-gray-600'}`}
              >
                Reference PO
              </button>
            </div>

            {importTab === 'csv' ? (
              <div className="space-y-4">
                <PoSampleCsvTable title="Sample CSV table" />
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-sm font-semibold text-gray-900 mb-1">Upload filled CSV</p>
                  <p className="text-xs text-gray-500 mb-3">Creates the PO form with imported line items and fields.</p>
                  <button
                    type="button"
                    disabled={importChecking}
                    onClick={() => csvFileRef.current?.click()}
                    className="w-full px-4 py-3 bg-[#1E88E5] text-white rounded-lg text-sm font-bold hover:bg-[#1565C0] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {importChecking ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-upload-2-line"></i>}
                    Upload CSV & Create PO
                  </button>
                  <input
                    ref={csvFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => handleCsvImportFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">Reference PO number</label>
                <input
                  type="text"
                  value={importPoNumber}
                  onChange={(e) => {
                    setImportPoNumber(e.target.value);
                    setImportError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      confirmImportAndCreate();
                    }
                  }}
                  placeholder="e.g. PO-2026-0001"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={confirmImportAndCreate}
                  disabled={importChecking}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
                >
                  {importChecking ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-download-2-line"></i>}
                  {importChecking ? 'Checking...' : 'Import Reference PO & Create'}
                </button>
              </div>
            )}

            {importError && (
              <p className="mt-3 text-xs text-red-600 flex items-center gap-1">
                <i className="ri-error-warning-line"></i>
                {importError}
              </p>
            )}

            <div className="mt-5 flex justify-between gap-2 flex-wrap border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setImportTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const prId = importTarget.prId;
                  setImportTarget(null);
                  openCreatePo(prId);
                }}
                className="px-4 py-2 text-sm font-semibold text-[#1E88E5] border border-[#BBDEFB] rounded-xl hover:bg-[#E3F2FD] flex items-center gap-2"
              >
                <i className="ri-shopping-cart-2-line"></i>
                Create PO manually
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default PurchaseRequestsPanel;
