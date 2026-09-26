import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
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

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

const KPI_WASHES = [
  { value: '#1E88E5', iconBg: '#E3F2FD', wash: 'rgba(30, 136, 229, 0.14)', selectedBorder: 'border-[#90CAF9]' },
  { value: '#10B981', iconBg: '#D1FAE5', wash: 'rgba(16, 185, 129, 0.14)', selectedBorder: 'border-[#6EE7B7]' },
  { value: '#64748B', iconBg: '#F1F5F9', wash: 'rgba(100, 116, 139, 0.12)', selectedBorder: 'border-[#CBD5E1]' },
  { value: '#F59E0B', iconBg: '#FEF3C7', wash: 'rgba(245, 158, 11, 0.14)', selectedBorder: 'border-[#FCD34D]' },
  { value: '#2563EB', iconBg: '#DBEAFE', wash: 'rgba(37, 99, 235, 0.14)', selectedBorder: 'border-[#93C5FD]' },
  { value: '#F43F5E', iconBg: '#FFE4E6', wash: 'rgba(244, 63, 94, 0.12)', selectedBorder: 'border-[#FDA4AF]' },
] as const;

function getStatusColor(statusRaw: string, bucket: RowStatus) {
  const raw = String(statusRaw || '').toLowerCase();
  if (raw === 'pending_approval') return 'bg-amber-50 text-amber-700';
  if (raw === 'pending_buyer_verify') return 'bg-[#E3F2FD] text-[#1E88E5]';
  switch (bucket) {
    case 'Ready for PO':
      return 'bg-[#E3F2FD] text-[#1E88E5]';
    case 'Pending Approval':
      return 'bg-amber-50 text-amber-700';
    case 'PO Approved':
      return 'bg-[#E3F2FD] text-[#1565C0]';
    case 'PO Rejected':
      return 'bg-rose-50 text-rose-600';
    case 'Draft':
      return 'bg-slate-100 text-slate-600';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-600';
    default:
      return 'bg-slate-100 text-slate-600';
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

      <div className="mb-5 grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {(
          [
            { label: 'Total PRs', value: stats.total, icon: 'ri-file-list-3-line', filter: 'all' as const },
            { label: 'Ready for PO', value: stats.readyForPO, icon: 'ri-checkbox-circle-line', filter: 'ready' as const },
            { label: 'Draft POs', value: stats.draft, icon: 'ri-draft-line', filter: 'draft' as const },
            { label: 'With SCM Manager', value: stats.pendingApproval, icon: 'ri-time-line', filter: 'created' as const },
            { label: 'PO Approved', value: stats.poApproved, icon: 'ri-file-check-line', filter: 'approved' as const },
            { label: 'PO Rejected', value: stats.poRejected, icon: 'ri-close-circle-line', filter: 'rejected' as const },
          ]
        ).map((s, i) => {
          const theme = KPI_WASHES[i % KPI_WASHES.length];
          const selected = statusFilter === s.filter;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setStatusFilter(s.filter);
                setPage(1);
                setExpandedKey(null);
                document.getElementById('po-workspace-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              aria-pressed={selected}
              title={`View ${s.label} in table`}
              className={`group relative box-border flex min-h-[128px] w-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white p-4 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[box-shadow,border-color] duration-200 hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)] sm:min-h-[140px] sm:rounded-[18px] sm:p-5 border ${
                selected ? theme.selectedBorder : 'border-transparent'
              }`}
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(120% 90% at 100% 0%, ${theme.wash} 0%, rgba(255,255,255,0) 55%)`,
                }}
              />
              <div className="relative z-[1] flex flex-1 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-[11px]">
                    {s.label}
                  </p>
                  <p
                    className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-3 sm:text-[2.15rem]"
                    style={{ color: theme.value }}
                  >
                    {s.value}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
                  style={{ backgroundColor: theme.iconBg, color: theme.value }}
                >
                  <i className={`${s.icon} text-lg sm:text-xl`} aria-hidden />
                </div>
              </div>
              <span className="relative z-[1] mt-auto inline-flex translate-y-1 items-center gap-1 pt-3 text-[12px] font-semibold text-[#6366F1] opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                Click to view
                <i className="ri-arrow-right-line text-sm" aria-hidden />
              </span>
            </button>
          );
        })}
      </div>

      <div className={`${softCard} mb-5 px-4 py-4 sm:px-5`}>
        <div className="pointer-events-none absolute inset-0" style={softWash} />
        <div className="relative z-[1] flex flex-wrap items-center gap-4">
          <div className="relative min-w-[220px] flex-1">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="Search by PR number, PO number, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['all', `All (${stats.total})`],
                ['ready', `Ready (${stats.readyForPO})`],
                ['created', `SCM Sign (${stats.pendingApproval})`],
                ['approved', `Approved (${stats.poApproved})`],
                ['rejected', `Rejected (${stats.poRejected})`],
                ['draft', `Draft (${stats.draft})`],
                ['cancelled', `Cancelled (${stats.cancelled})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setPage(1);
                  setExpandedKey(null);
                }}
                className={`h-11 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                  statusFilter === key
                    ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                    : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        id="po-workspace-table"
        className="relative scroll-mt-24 overflow-x-clip overflow-y-visible rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)',
          }}
        />
        <div
          data-po-workspace-scroll
          className="relative z-[1] w-full overflow-x-auto overflow-y-visible overscroll-x-contain px-0 pb-3 pt-1"
        >
          {loading ? (
            <p className="p-8 text-sm text-slate-500">Loading...</p>
          ) : (
            <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)]">
                    PR / PO Number
                  </th>
                  <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    PO Date
                  </th>
                  <th className="w-[180px] max-w-[180px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Entity
                  </th>
                  <th className="w-[220px] max-w-[220px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Title
                  </th>
                  <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Department
                  </th>
                  <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Requester
                  </th>
                  <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Amount
                  </th>
                  <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Status
                  </th>
                  <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.18)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="rounded-2xl border border-transparent bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                      No purchase requests found
                    </td>
                  </tr>
                ) : (
                  rows.map((pr) => {
                    const isExpanded = expandedKey === pr.key;
                    const rowBorder = isExpanded
                      ? 'border-[#90CAF9]'
                      : 'border-transparent group-hover:border-[#90CAF9]';
                    const rowShadow = isExpanded
                      ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                      : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                    return (
                      <Fragment key={pr.key}>
                        <tr
                          className="group cursor-pointer"
                          onClick={() => toggleExpand(pr.key)}
                        >
                          <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                            <div
                              className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.16)] transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                            >
                              <button
                                type="button"
                                className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                  isExpanded
                                    ? 'bg-[#1E88E5] text-white'
                                    : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                }`}
                                aria-expanded={isExpanded}
                                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                              >
                                <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                              </button>
                              <div
                                className="min-w-0"
                                title={[pr.prNumber, pr.poNumber].filter(Boolean).join(' · ') || undefined}
                              >
                                <p className="whitespace-nowrap text-sm font-bold text-[#1E88E5]">
                                  {pr.prNumber || '—'}
                                </p>
                                <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-[#2C3E50]">
                                  {pr.poNumber || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td
                            className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-slate-600 transition-[border-color] sm:py-5 ${rowBorder}`}
                          >
                            {pr.poDate || '—'}
                          </td>
                          <td
                            className={`w-[180px] max-w-[180px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                            title={pr.entityName || undefined}
                          >
                            <p className="truncate text-sm text-[#2C3E50]">{pr.entityName || '—'}</p>
                          </td>
                          <td
                            className={`w-[220px] max-w-[220px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                            title={pr.title}
                          >
                            <p className="truncate text-sm font-semibold text-[#2C3E50]">{pr.title}</p>
                          </td>
                          <td
                            className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                            title={pr.department}
                          >
                            {pr.department || '—'}
                          </td>
                          <td
                            className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                            title={pr.requester}
                          >
                            {pr.requester || '—'}
                          </td>
                          <td
                            className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right text-sm font-bold tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                          >
                            {formatCurrency(pr.amount)}
                          </td>
                          <td
                            className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                          >
                            {(() => {
                              const text = shortStatusLabel(pr.statusLabel, pr.statusRaw);
                              const isVendorAck = text === 'Vendor Acknowledged pending';
                              return (
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${getStatusColor(pr.statusRaw, pr.status)}`}
                                  title={pr.statusLabel}
                                >
                                  {isVendorAck ? (
                                    <span className="block text-left">
                                      Vendor Acknowledged
                                      <br />
                                      pending
                                    </span>
                                  ) : (
                                    text
                                  )}
                                </span>
                              );
                            })()}
                          </td>
                          <td
                            className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div
                              className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.16)] transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                            >
                              {pr.status === 'Ready for PO' && (
                                <button
                                  type="button"
                                  onClick={() => openCreatePo(pr.prId)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                >
                                  Create PO
                                </button>
                              )}
                              {pr.status === 'Draft' && pr.poId && (
                                <button
                                  type="button"
                                  onClick={() => openEditDraft(pr.poId!)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                >
                                  Edit Draft
                                </button>
                              )}
                              {isSuperAdmin &&
                                pr.poId &&
                                pr.status !== 'Draft' &&
                                pr.status !== 'Cancelled' && (
                                  <button
                                    type="button"
                                    onClick={() => openAdminEditPo(pr.poId!)}
                                    className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                    title="Edit this purchase order / work order"
                                  >
                                    Edit
                                  </button>
                                )}
                              {pr.status === 'Pending Approval' && pr.poId && !isSuperAdmin && (
                                <span
                                  className="whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800"
                                  title="Sent to SCM Manager for sign / approval"
                                >
                                  SCM Manager
                                </span>
                              )}
                              {pr.status === 'Cancelled' && pr.poId && (
                                <button
                                  type="button"
                                  disabled={retrievingKey === pr.key}
                                  onClick={() => void handleRetrieveCancelled(pr)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
                                  title="Retrieve cancelled PO as draft"
                                >
                                  {retrievingKey === pr.key ? 'Retrieving…' : 'Retrieve'}
                                </button>
                              )}
                              {pr.poId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/po-pdf-view?poId=${pr.poId}`)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                >
                                  View PDF
                                </button>
                              )}
                              {isSuperAdmin && (pr.poId || pr.prId > 0) && (
                                <button
                                  type="button"
                                  disabled={deletingKey === pr.key}
                                  onClick={() => void handleAdminDelete(pr)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] hover:bg-rose-100 disabled:opacity-50"
                                  title={pr.poId ? 'Permanently delete this PO' : 'Permanently delete this PR'}
                                >
                                  {deletingKey === pr.key ? 'Deleting…' : 'Delete'}
                                </button>
                              )}
                              {pr.status !== 'Ready for PO' && !pr.poId && pr.prId > 0 && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/rfq-entry/${pr.prId}`)}
                                  className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-medium text-amber-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-amber-200"
                                >
                                  RFQ
                                </button>
                              )}
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

        <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/80 px-4 py-3">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{rangeFrom}</span>
            {'–'}
            <span className="font-semibold text-gray-700">{rangeTo}</span>
            {' of '}
            <span className="font-semibold text-gray-700">{pagination.total}</span> records
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                  setExpandedKey(null);
                }}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20"
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
                className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] hover:border-[#90CAF9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => {
                  setPage((p) => p + 1);
                  setExpandedKey(null);
                }}
                className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] hover:border-[#90CAF9] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

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
