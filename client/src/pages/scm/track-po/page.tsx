import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import PoSampleCsvTable from '../../../components/feature/PoSampleCsvTable';
import { poApi, prApi } from '../../../services/api';
import {
  downloadPoImportSampleCsv,
  parseAllPoImportCsv,
  storePoCsvImport,
} from '../../../utils/poCsvImport';

type StatusFilter = 'all' | 'ready' | 'pending' | 'approved' | 'rejected' | 'sent';
type PurchaseTypeFilter = 'all' | 'purchase_order' | 'work_order';

type TrackRow = {
  key: string;
  prId: number;
  poId: number | null;
  prNumber: string;
  poNumber: string | null;
  title: string;
  department: string;
  requester: string;
  vendorName: string;
  amount: number;
  status: string;
  statusLabel: string;
  purchaseType?: string;
  purchaseTypeLabel?: string;
  requiredDate: string;
  createdAt: string;
  kind: 'ready' | 'po';
};

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

type ReadyOption = { prId: number; prNumber: string; title: string };

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function statusColor(status: string) {
  switch (status) {
    case 'ready':
      return 'bg-emerald-100 text-emerald-700';
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'approved':
      return 'bg-blue-100 text-blue-700';
    case 'sent':
      return 'bg-teal-100 text-teal-800';
    case 'rejected':
      return 'bg-red-100 text-red-700';
    case 'imported':
      return 'bg-indigo-100 text-indigo-800';
    case 'draft':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export default function TrackPoPage() {
  const navigate = useNavigate();
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<PurchaseTypeFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<TrackPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<TrackStats>({
    total: 0,
    ready: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPrId, setImportPrId] = useState<number | null>(null);
  const [importError, setImportError] = useState('');
  const [importChecking, setImportChecking] = useState(false);
  const [oldPoImport, setOldPoImport] = useState(true);
  const [readyOptions, setReadyOptions] = useState<ReadyOption[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poApi.listTrack({
        page,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter,
        purchaseType: purchaseTypeFilter,
      });
      setRows(res.data as TrackRow[]);
      if (res.pagination) {
        setPagination(res.pagination);
        if (res.pagination.page !== page) setPage(res.pagination.page);
      }
      if (res.stats) setStats(res.stats);
      setError('');
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load POs');
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, statusFilter, purchaseTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const loadReadyOptions = async () => {
    try {
      const res = await prApi.listScmBucket();
      const opts = (res.data as Array<Record<string, unknown>>).map((p) => ({
        prId: Number(p.id),
        prNumber: String(p.prNumber || ''),
        title: String(p.title || ''),
      }));
      setReadyOptions(opts);
      return opts;
    } catch {
      setReadyOptions([]);
      return [];
    }
  };

  const openCreatePo = (prId: number, opts?: { fromCsv?: boolean; legacy?: boolean }) => {
    const qs = new URLSearchParams({ prId: String(prId), mode: opts?.fromCsv ? 'import' : 'manual' });
    if (opts?.fromCsv) qs.set('from', 'csv');
    if (opts?.legacy) qs.set('legacy', '1');
    navigate(`/scm/create-po?${qs.toString()}`);
  };

  const openImportModal = async (prId?: number) => {
    const opts = await loadReadyOptions();
    const target = prId || opts[0]?.prId || null;
    setImportPrId(target);
    setImportError('');
    setShowImport(true);
  };

  const handleCsvUpload = async (file: File | null) => {
    if (!file) return;
    setImportChecking(true);
    setImportError('');
    try {
      const text = await file.text();
      const payloads = parseAllPoImportCsv(text);
      const payload = payloads[0];
      if (oldPoImport) payload.skipApproval = true;
      storePoCsvImport(payload);

      const csvPr = String(payload.prNumber || '').trim().toLowerCase();
      let targetPrId = importPrId;
      if (csvPr) {
        const match = readyOptions.find((r) => r.prNumber.toLowerCase() === csvPr);
        if (match) targetPrId = match.prId;
        else if (!targetPrId) {
          throw new Error(
            `PR ${payload.prNumber} from CSV is not in Ready for PO. Complete RFQ approval first, or pick a Ready PR.`
          );
        }
      }
      if (!targetPrId) {
        throw new Error('Select a Ready PR, or include prNumber in the CSV.');
      }

      setShowImport(false);
      if (payloads.length > 1) {
        setError(
          `CSV has ${payloads.length} PO groups. Opened the first (${payload.prNumber || `PR #${targetPrId}`}). Import remaining groups one at a time.`
        );
      }
      openCreatePo(targetPrId, { fromCsv: true, legacy: oldPoImport || Boolean(payload.skipApproval) });
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
    <DashboardLayout>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Track PO</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track purchase orders and import full PO data from CSV (line items, address, terms, annexure, and more)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
            <i className="ri-upload-2-line"></i>
            Import CSV
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

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="mb-5">
        <PoSampleCsvTable title="PO Import — Sample CSV table" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Ready for PO', value: stats.ready, color: 'text-emerald-600' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
          { label: 'Approved / Sent', value: stats.approved, color: 'text-blue-600' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PR, PO/WO, vendor, title..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ['all', 'All Types'],
              ['purchase_order', 'Purchase Order'],
              ['work_order', 'Work Order'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setPurchaseTypeFilter(key);
                setPage(1);
                setExpandedKey(null);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                purchaseTypeFilter === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ['all', `All (${stats.total})`],
              ['ready', `Ready (${stats.ready})`],
              ['pending', `Pending (${stats.pending})`],
              ['approved', `Approved (${stats.approved})`],
              ['rejected', `Rejected (${stats.rejected})`],
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
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
                statusFilter === key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading purchase orders...</p>
          ) : (
            <table className="w-full min-w-[1100px] table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-3 w-11"></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[160px]">PR Number</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[160px]">PO / WO Number</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[100px]">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title / Vendor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[120px]">Department</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[110px]">Amount</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[140px]">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[150px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-500">
                      No purchase orders found
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const open = expandedKey === row.key;
                    return (
                      <Fragment key={row.key}>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedKey(open ? null : row.key)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600"
                            >
                              <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-lg`}></i>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-teal-700 truncate" title={row.prNumber}>
                            {row.prNumber || '—'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-700 truncate" title={row.poNumber || undefined}>
                            {row.poNumber || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                                row.purchaseType === 'work_order'
                                  ? 'bg-violet-50 text-violet-700 border border-violet-200'
                                  : 'bg-teal-50 text-teal-700 border border-teal-200'
                              }`}
                            >
                              {row.purchaseTypeLabel ||
                                (row.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')}
                            </span>
                          </td>
                          <td className="px-3 py-3 overflow-hidden">
                            <p className="text-sm font-medium text-gray-900 truncate" title={row.title}>
                              {row.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate" title={row.vendorName || undefined}>
                              {row.vendorName || 'Vendor pending'}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600 truncate" title={row.department}>
                            {row.department}
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">
                            {formatCurrency(row.amount)}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColor(row.status)}`}>
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {row.kind === 'ready' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openCreatePo(row.prId)}
                                    className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold"
                                  >
                                    Create {row.purchaseType === 'work_order' ? 'WO' : 'PO'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openImportModal(row.prId)}
                                    className="px-3 py-1.5 border border-violet-300 text-violet-700 rounded-md text-xs font-semibold"
                                  >
                                    Import
                                  </button>
                                </>
                              )}
                              {row.poId && (
                                <button
                                  type="button"
                                  onClick={() => navigate(`/scm/po-pdf-view?poId=${row.poId}`)}
                                  className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50"
                                >
                                  View PDF
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={9} className="p-0 bg-slate-50 border-b">
                              <div className="m-4 bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-gray-500">Requester</p>
                                  <p className="font-medium text-gray-900">{row.requester || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Vendor</p>
                                  <p className="font-medium text-gray-900">{row.vendorName || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Required / Delivery</p>
                                  <p className="font-medium text-gray-900">{row.requiredDate || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500">Created / Submitted</p>
                                  <p className="font-medium text-gray-900">{row.createdAt || '—'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
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

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Import Full PO Data from CSV</h3>
                <p className="text-sm text-gray-500 mt-1">
                  For old POs: enable <strong>create only</strong> — no manager approval. Optional <strong>poNumber</strong> keeps the historical PO number.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>

            <label className="flex items-start gap-3 mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
              <input
                type="checkbox"
                checked={oldPoImport}
                onChange={(e) => setOldPoImport(e.target.checked)}
                className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <span>
                <span className="block text-sm font-semibold text-amber-900">Old PO import — create only (no approvals)</span>
                <span className="block text-xs text-amber-800 mt-0.5">
                  PO is saved as Approved immediately. Set skipApproval=Y and poNumber in CSV for historical numbers.
                </span>
              </span>
            </label>

            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Purchase request (optional if CSV has prNumber)
            </label>
            <select
              value={importPrId ?? ''}
              onChange={(e) => setImportPrId(e.target.value ? Number(e.target.value) : null)}
              className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">— Use prNumber from CSV —</option>
              {readyOptions.map((r) => (
                <option key={r.prId} value={r.prId}>
                  {r.prNumber} — {r.title}
                </option>
              ))}
            </select>

            <PoSampleCsvTable className="mb-4" title="Full PO sample CSV table (all columns)" />

            {importError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{importError}</div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowImport(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importChecking}
                onClick={() => csvFileRef.current?.click()}
                className="px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2"
              >
                {importChecking ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-upload-2-line"></i>}
                Upload CSV & Create PO
              </button>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleCsvUpload(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
