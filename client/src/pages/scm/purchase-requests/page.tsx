import { useState, useEffect, useCallback, Fragment, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, rfqApi, taskApi, PostRfqPendingItem } from '../../../services/api';
import PRBucketExpandedRow from './components/PRBucketExpandedRow';
import PoSampleCsvTable from '../../../components/feature/PoSampleCsvTable';
import {
  downloadPoImportSampleCsv,
  parsePoImportCsv,
  storePoCsvImport,
} from '../../../utils/poCsvImport';

type RowStatus = 'Ready for PO' | 'Pending Approval' | 'PO Approved' | 'PO Rejected' | 'Sent Back';

interface BucketRow {
  key: string;
  prId: number;
  prNumber: string;
  poNumber: string | null;
  poId: number | null;
  title: string;
  department: string;
  requester: string;
  amount: number;
  recommendedVendor: string;
  requiredDate: string;
  status: RowStatus;
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
};

type TaskPreview = {
  id: string | number;
  prId?: number;
  prNumber?: string;
  title?: string;
  actionPath?: string;
  statusUI?: string;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function mapTrackStatusToBucket(status: string, statusRaw?: string): RowStatus {
  const s = String(status || '').toLowerCase();
  const raw = String(statusRaw || '').toLowerCase();
  if (s === 'ready') return 'Ready for PO';
  if (s === 'pending' || raw === 'pending_approval' || raw === 'pending_buyer_verify') return 'Pending Approval';
  if (s === 'rejected' || raw === 'rejected') return 'PO Rejected';
  if (s === 'draft' || raw === 'draft') return 'Sent Back';
  return 'PO Approved';
}

function mapUiFilterToApi(filter: 'all' | 'ready' | 'created' | 'approved' | 'rejected'): string {
  if (filter === 'created') return 'pending';
  return filter;
}

export default function SCMPurchaseRequestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'created' | 'approved' | 'rejected'>('all');
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
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [importTarget, setImportTarget] = useState<BucketRow | null>(null);
  const [readyOptions, setReadyOptions] = useState<BucketRow[]>([]);
  const [importTab, setImportTab] = useState<'reference' | 'csv'>('csv');
  const [importPoNumber, setImportPoNumber] = useState('');
  const [importError, setImportError] = useState('');
  const [importChecking, setImportChecking] = useState(false);
  const [rfqPending, setRfqPending] = useState<PostRfqPendingItem[]>([]);
  const [myTasks, setMyTasks] = useState<TaskPreview[]>([]);
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
      department: String(r.department || ''),
      requester: String(r.requester || ''),
      amount: Number(r.amount) || 0,
      recommendedVendor: String(r.vendorName || ''),
      requiredDate: String(r.requiredDate || ''),
      status: mapTrackStatusToBucket(String(r.status), String(r.statusRaw || '')),
    }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poApi.listTrack({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: mapUiFilterToApi(statusFilter),
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rfqRes, taskRes] = await Promise.all([
          rfqApi.listPostApprovalPending().catch(() => ({ data: [] as PostRfqPendingItem[] })),
          taskApi.list().catch(() => ({ data: [] as unknown[] })),
        ]);
        if (cancelled) return;
        setRfqPending(rfqRes.data || []);
        setMyTasks(
          ((taskRes.data as TaskPreview[]) || []).map((t) => ({
            id: t.id,
            prId: t.prId,
            prNumber: t.prNumber,
            title: t.title,
            actionPath: t.actionPath,
            statusUI: t.statusUI,
          }))
        );
      } catch {
        if (!cancelled) {
          setRfqPending([]);
          setMyTasks([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const qs = new URLSearchParams({ prId: String(prId), mode: opts?.fromCsv ? 'import' : 'manual' });
    if (opts?.refPo?.trim()) {
      qs.set('refPo', opts.refPo.trim());
      qs.set('mode', 'import');
    }
    if (opts?.fromCsv) qs.set('from', 'csv');
    navigate(`/scm/create-po?${qs.toString()}`);
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

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusColor = (status: RowStatus) => {
    switch (status) {
      case 'Ready for PO':
        return 'bg-emerald-100 text-emerald-700';
      case 'Pending Approval':
        return 'bg-amber-100 text-amber-700';
      case 'PO Approved':
        return 'bg-blue-100 text-blue-700';
      case 'PO Rejected':
        return 'bg-red-100 text-red-700';
      case 'Sent Back':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <DashboardLayout>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SCM Buyer Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            RFQ approval, My Tasks, and Create PO from ready purchase requests
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/rfq-approval')}
            className="px-4 py-2.5 border border-teal-300 text-teal-800 rounded-lg text-sm font-semibold hover:bg-teal-50 flex items-center gap-2"
          >
            <i className="ri-bar-chart-box-line"></i>
            RFQ Approval
          </button>
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="px-4 py-2.5 border border-slate-300 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"
          >
            <i className="ri-task-line"></i>
            My Tasks
          </button>
          <button
            type="button"
            onClick={() => navigate('/scm/create-po')}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 flex items-center gap-2"
          >
            <i className="ri-shopping-cart-2-line"></i>
            Create PO
          </button>
          <button
            type="button"
            onClick={() => openImportModal()}
            className="px-4 py-2.5 border border-violet-300 text-violet-700 rounded-lg text-sm font-semibold hover:bg-violet-50 flex items-center gap-2"
          >
            <i className="ri-download-2-line"></i>
            Import
          </button>
          <button
            type="button"
            onClick={downloadPoImportSampleCsv}
            className="px-4 py-2.5 border border-emerald-300 text-emerald-800 bg-emerald-50 rounded-lg text-sm font-semibold hover:bg-emerald-100 flex items-center gap-2"
          >
            <i className="ri-file-excel-2-line"></i>
            Sample CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          {
            label: 'RFQ Approvals',
            value: rfqPending.length,
            sub: `${rfqPending.filter((i) => i.approvalState === 'pending').length} pending · ${rfqPending.filter((i) => i.approvalState === 'approved').length} approved`,
            icon: 'ri-bar-chart-box-line',
            to: '/rfq-approval',
            border: 'border-teal-100',
            text: 'text-teal-700',
            iconBg: 'bg-teal-100',
          },
          {
            label: 'My Tasks',
            value: myTasks.length,
            sub: 'Open workflow tasks',
            icon: 'ri-task-line',
            to: '/tasks',
            border: 'border-slate-100',
            text: 'text-slate-700',
            iconBg: 'bg-slate-100',
          },
          {
            label: 'Ready for PO',
            value: stats.readyForPO,
            sub: 'PRs ready to convert',
            icon: 'ri-checkbox-circle-line',
            to: null as string | null,
            border: 'border-emerald-100',
            text: 'text-emerald-700',
            iconBg: 'bg-emerald-100',
            onClick: () => {
              setStatusFilter('ready');
              setPage(1);
              setExpandedKey(null);
            },
          },
          {
            label: 'Create PO',
            value: 'Open',
            sub: 'Start a new purchase order',
            icon: 'ri-shopping-cart-2-line',
            to: '/scm/create-po',
            border: 'border-teal-100',
            text: 'text-teal-700',
            iconBg: 'bg-teal-100',
          },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              if (card.to) navigate(card.to);
              else card.onClick?.();
            }}
            className={`text-left bg-white rounded-xl border ${card.border} p-5 hover:shadow-md transition-shadow cursor-pointer`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className={`text-xs mt-1 ${card.text}`}>{card.sub}</p>
              </div>
              <div className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                <i className={`${card.icon} text-xl ${card.text}`}></i>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">RFQ Approvals</h2>
              <p className="text-xs text-gray-500">Pending manager approval and approved for Create PO</p>
            </div>
            <Link to="/rfq-approval" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open queue →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {rfqPending.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No RFQ approvals waiting</p>
            ) : (
              rfqPending.slice(0, 5).map((item) => (
                <button
                  key={item.prId}
                  type="button"
                  onClick={() =>
                    navigate(
                      item.approvalState === 'approved'
                        ? `/scm/create-po?prId=${item.prId}&from=rfq-approval`
                        : `/rfq-approval/${item.prId}?from=rfq-approval`
                    )
                  }
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">
                      {item.prNumber || `PR #${item.prId}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.title || item.stageLabel || 'RFQ approval'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      item.approvalState === 'approved'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.approvalState === 'approved' ? 'Approved' : 'Pending'}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">My Tasks</h2>
              <p className="text-xs text-gray-500">Create PO and other workflow tasks</p>
            </div>
            <Link to="/tasks" className="text-xs font-semibold text-teal-700 hover:text-teal-900">
              Open tasks →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {myTasks.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No open tasks</p>
            ) : (
              myTasks.slice(0, 5).map((task) => (
                <button
                  key={String(task.id)}
                  type="button"
                  onClick={() => {
                    if (task.actionPath) {
                      navigate(task.actionPath);
                      return;
                    }
                    if (task.prId) {
                      navigate(`/scm/create-po?prId=${task.prId}&from=tasks`);
                      return;
                    }
                    navigate('/tasks');
                  }}
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-teal-700 truncate">
                      {task.prNumber || `Task #${task.id}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {task.title || task.statusUI || 'Workflow task'}
                    </p>
                  </div>
                  <i className="ri-arrow-right-s-line text-gray-400 text-lg"></i>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="mb-3">
        <h2 className="text-base font-bold text-gray-900">Purchase Requests</h2>
        <p className="text-xs text-gray-500">Create PO from ready PRs, or import from an existing reference PO</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
        {[
          { label: 'Total PRs', value: stats.total, color: 'text-gray-900', icon: 'ri-file-list-3-line', bg: 'bg-teal-100', ic: 'text-teal-600' },
          { label: 'Ready for PO', value: stats.readyForPO, color: 'text-emerald-600', icon: 'ri-checkbox-circle-line', bg: 'bg-emerald-100', ic: 'text-emerald-600' },
          { label: 'Pending Approval', value: stats.pendingApproval, color: 'text-amber-600', icon: 'ri-time-line', bg: 'bg-amber-100', ic: 'text-amber-600' },
          { label: 'PO Approved', value: stats.poApproved, color: 'text-blue-600', icon: 'ri-file-check-line', bg: 'bg-blue-100', ic: 'text-blue-600' },
          { label: 'PO Rejected', value: stats.poRejected, color: 'text-red-600', icon: 'ri-close-circle-line', bg: 'bg-red-100', ic: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-gray-600 truncate mb-1">{s.label}</p>
                <p className={`text-2xl font-bold leading-tight ${s.color}`}>{s.value}</p>
              </div>
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <i className={`${s.icon} text-xl ${s.ic}`}></i>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"></i>
            <input
              type="text"
              placeholder="Search by PR number, PO number, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                ['all', `All (${stats.total})`],
                ['ready', `Ready (${stats.readyForPO})`],
                ['created', `Pending (${stats.pendingApproval})`],
                ['approved', `Approved (${stats.poApproved})`],
                ['rejected', `Rejected (${stats.poRejected})`],
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
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${statusFilter === key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="w-full overflow-x-hidden">
          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading...</p>
          ) : (
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-10" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-1.5 py-3"></th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PR Number</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">PO Number</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Requester</th>
                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-2 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-500">
                      No purchase requests found
                    </td>
                  </tr>
                ) : (
                  rows.map((pr) => {
                    const isExpanded = expandedKey === pr.key;
                    return (
                      <Fragment key={pr.key}>
                        <tr className="border-b hover:bg-gray-50 group">
                          <td className="px-1.5 py-3 align-middle">
                            <button
                              type="button"
                              onClick={() => toggleExpand(pr.key)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white text-gray-600"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                            >
                              <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                            </button>
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleExpand(pr.key)}
                              className="block w-full max-w-full font-semibold text-teal-600 hover:text-teal-800 cursor-pointer text-left text-sm truncate"
                              title={pr.prNumber}
                            >
                              {pr.prNumber || '—'}
                            </button>
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden text-gray-700 text-sm truncate" title={pr.poNumber || undefined}>
                            {pr.poNumber || '—'}
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden text-gray-900 font-medium text-sm truncate" title={pr.title}>
                            {pr.title}
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden text-gray-700 text-sm truncate" title={pr.department}>
                            {pr.department}
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden text-gray-700 text-sm truncate" title={pr.requester}>
                            {pr.requester}
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden text-right font-semibold text-gray-900 text-sm tabular-nums truncate" title={formatCurrency(pr.amount)}>
                            {formatCurrency(pr.amount)}
                          </td>
                          <td className="px-2 py-3 align-middle overflow-hidden">
                            <span
                              className={`inline-flex max-w-full px-2 py-1 rounded-full text-xs font-medium truncate ${getStatusColor(pr.status)}`}
                              title={pr.status}
                            >
                              {pr.status}
                            </span>
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {pr.status === 'Ready for PO' && (
                                <button
                                  type="button"
                                  onClick={() => openCreatePo(pr.prId)}
                                  className="px-2.5 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold whitespace-nowrap"
                                >
                                  Create PO
                                </button>
                              )}
                              {pr.status === 'Sent Back' && pr.poId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/create-po?poId=${pr.poId}&from=purchase-requests`)}
                                  className="px-2.5 py-1.5 bg-orange-600 text-white rounded-md text-xs font-semibold whitespace-nowrap"
                                >
                                  Revise PO
                                </button>
                              )}
                              {pr.poId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/po-pdf-view?poId=${pr.poId}`)}
                                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 whitespace-nowrap"
                                >
                                  View PDF
                                </button>
                              )}
                              {pr.status !== 'Ready for PO' && !pr.poId && pr.prId > 0 && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/rfq-entry/${pr.prId}`)}
                                  className="px-2.5 py-1.5 border border-amber-300 text-amber-700 rounded-md text-xs font-medium hover:bg-amber-50 whitespace-nowrap"
                                >
                                  RFQ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && pr.prId > 0 && (
                          <PRBucketExpandedRow
                            prId={pr.prId}
                            colSpan={9}
                            statusLabel={pr.status}
                            showCreatePo={pr.status === 'Ready for PO'}
                            onCreatePo={() => openCreatePo(pr.prId)}
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

        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
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
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
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
                className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
                className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
              className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
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
                className={`flex-1 px-3 py-2.5 text-sm font-semibold ${importTab === 'csv' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600'}`}
              >
                CSV Import
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportTab('reference');
                  setImportError('');
                }}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold border-l border-gray-200 ${importTab === 'reference' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600'}`}
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
                    className="w-full px-4 py-3 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={confirmImportAndCreate}
                  disabled={importChecking}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                className="px-4 py-2 text-sm font-semibold text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 flex items-center gap-2"
              >
                <i className="ri-shopping-cart-2-line"></i>
                Create PO manually
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
