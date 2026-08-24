import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import PoSampleCsvTable from '../../../components/feature/PoSampleCsvTable';
import TrackPoExpandedRow from './components/TrackPoExpandedRow';
import { masterApi, poApi, prApi, CategoryRecord, DepartmentRecord, EntityRecord } from '../../../services/api';
import {
  parseAllPoImportCsv,
  storePoCsvImport,
} from '../../../utils/poCsvImport';

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
  entityId?: number | null;
  entityName?: string;
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

type ReadyOption = { prId: number; prNumber: string; title: string };

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function entityLabel(ent: EntityRecord) {
  return ent.code ? `${ent.code} — ${ent.name}` : ent.name;
}

function EntitySearchSelect({
  entities,
  value,
  onChange,
}: {
  entities: EntityRecord[];
  value: number | '';
  onChange: (id: number | '') => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = entities.find((e) => e.id === value) || null;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = query.trim()
    ? entities.filter((ent) => entityLabel(ent).toLowerCase().includes(query.trim().toLowerCase()))
    : entities;

  return (
    <div ref={boxRef} className="relative min-w-[280px] max-w-[420px] flex-1">
      <i className="ri-building-2-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
      <input
        type="text"
        value={open ? query : selected ? entityLabel(selected) : ''}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="Search PO entity (code or name)..."
        className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
      />
      <i className="ri-arrow-down-s-line absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 ${!value ? 'font-semibold text-teal-700 bg-teal-50' : 'text-gray-700'}`}
          >
            All Entities
          </button>
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">No entity found</p>
          ) : (
            filtered.map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => {
                  onChange(ent.id);
                  setQuery('');
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 ${
                  value === ent.id ? 'font-semibold text-teal-700 bg-teal-50' : 'text-gray-800'
                }`}
                title={entityLabel(ent)}
              >
                {entityLabel(ent)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
  const [purchaseTypeFilter, setPurchaseTypeFilter] = useState<PurchaseTypeFilter>('all');
  const [entityId, setEntityId] = useState<number | ''>('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<TrackPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
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
        purchaseType: purchaseTypeFilter,
        entityId: entityId || undefined,
        department: department || undefined,
        category: category || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setRows(res.data as TrackRow[]);
      if (res.pagination) {
        setPagination(res.pagination);
        if (res.pagination.page !== page) setPage(res.pagination.page);
      }
      setError('');
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load POs');
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, purchaseTypeFilter, entityId, department, category, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [entRes, deptRes, catRes] = await Promise.all([
          masterApi.listEntities({ status: 'active' }),
          masterApi.listDepartments({ status: 'active' }),
          masterApi.listCategories({ status: 'active' }),
        ]);
        setEntities(entRes.data || []);
        setDepartments(deptRes.data || []);
        setCategories(catRes.data || []);
      } catch {
        setEntities([]);
        setDepartments([]);
        setCategories([]);
      }
    })();
  }, []);

  const resetFilters = () => {
    setSearch('');
    setPurchaseTypeFilter('all');
    setEntityId('');
    setDepartment('');
    setCategory('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setExpandedKey(null);
  };

  const exportRows = (list: TrackRow[]) => {
    const header = [
      'PR Number',
      'PO Number',
      'Type',
      'Title',
      'Vendor',
      'Entity',
      'Department',
      'Requester',
      'Amount',
      'Status',
      'Required Date',
      'Created',
    ];
    const lines = list.map((r) =>
      [
        r.prNumber,
        r.poNumber || '',
        r.purchaseTypeLabel || r.purchaseType || '',
        r.title,
        r.vendorName,
        r.entityName || '',
        r.department,
        r.requester,
        r.amount,
        r.statusLabel,
        r.requiredDate,
        r.createdAt,
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `track-po-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleExportAll = async () => {
    try {
      const all: TrackRow[] = [];
      let pageNum = 1;
      let totalPages = 1;
      const filters = {
        search: debouncedSearch || undefined,
        purchaseType: purchaseTypeFilter,
        entityId: entityId || undefined,
        department: department || undefined,
        category: category || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      };
      do {
        const res = await poApi.listTrack({ ...filters, page: pageNum, limit: 100 });
        all.push(...((res.data || []) as TrackRow[]));
        totalPages = res.pagination?.totalPages || 1;
        pageNum += 1;
      } while (pageNum <= totalPages && pageNum <= 50);
      exportRows(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

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
            All purchase orders and work orders. Filter by entity, department, category, type, and date. Expand a row for details, documents, and approval history.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleExportAll()}
            className="px-4 py-2.5 border border-slate-300 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2"
          >
            <i className="ri-download-2-line"></i>
            Export
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

      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px] relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PR, PO/WO, vendor, title, entity..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <EntitySearchSelect
          entities={entities}
          value={entityId}
          onChange={(id) => {
            setEntityId(id);
            setPage(1);
            setExpandedKey(null);
          }}
        />
        <select
          value={department}
          onChange={(e) => {
            setDepartment(e.target.value);
            setPage(1);
            setExpandedKey(null);
          }}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
            setExpandedKey(null);
          }}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white min-w-[150px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
              setExpandedKey(null);
            }}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
              setExpandedKey(null);
            }}
            className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
          />
        </label>
        <button
          type="button"
          onClick={resetFilters}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          Clear filters
        </button>
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
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading purchase orders...</p>
          ) : (
            <table className="w-full min-w-[1280px] table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-3 w-11"></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[150px]">PR Number</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[150px]">PO / WO Number</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[90px]">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title / Vendor</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">Entity</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[120px]">Department</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[110px]">Amount</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">Status</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-sm text-gray-500">
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
                          <td className="px-3 py-3 text-sm font-bold text-gray-900 truncate" title={row.poNumber || undefined}>
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
                          <td className="px-3 py-3 text-sm text-gray-600 truncate" title={row.entityName || undefined}>
                            {row.entityName || '—'}
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
                        {open && <TrackPoExpandedRow row={row} colSpan={10} />}
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
