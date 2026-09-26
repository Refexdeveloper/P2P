import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import PoSampleCsvTable from '../../../components/feature/PoSampleCsvTable';
import TrackPoExpandedRow from './components/TrackPoExpandedRow';
import POApprovalModal from '../po-approval/components/POApprovalModal';
import { masterApi, poApi, prApi, CategoryRecord, DepartmentRecord, EntityRecord } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
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
  statusRaw?: string;
  purchaseType?: string;
  purchaseTypeLabel?: string;
  entityId?: number | null;
  entityName?: string;
  requiredDate: string;
  poDate?: string;
  createdAt: string;
  kind: 'ready' | 'po';
};

const ADMIN_BUYER_VERIFY_SEND_BACK_RAW = new Set([
  'sent_to_vendor',
  'awaiting_grn',
  'grn_completed',
  'invoice_entry',
  'pending_accounts_approval',
  'approved_for_payment',
]);

function canAdminSendBackToBuyerVerify(row: TrackRow): boolean {
  if (!row.poId) return false;
  const raw = String(row.statusRaw || '').toLowerCase();
  if (raw && ADMIN_BUYER_VERIFY_SEND_BACK_RAW.has(raw)) return true;
  // Fallback mapped status from track list
  return ['sent', 'grn', 'invoice', 'payment'].includes(String(row.status || '').toLowerCase());
}

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
      <i className="ri-building-2-line pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
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
        className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-8 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
      />
      <i className="ri-arrow-down-s-line pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-2xl border border-transparent bg-white shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]">
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setOpen(false);
            }}
            className={`w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#E3F2FD] ${!value ? 'bg-[#E3F2FD] font-semibold text-[#1E88E5]' : 'text-slate-700'}`}
          >
            All Entities
          </button>
          {filtered.length === 0 ? (
            <p className="px-3.5 py-2.5 text-sm text-slate-500">No entity found</p>
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
                className={`w-full px-3.5 py-2.5 text-left text-sm hover:bg-[#E3F2FD] ${
                  value === ent.id ? 'bg-[#E3F2FD] font-semibold text-[#1E88E5]' : 'text-[#2C3E50]'
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
      return 'bg-[#E3F2FD] text-[#1E88E5]';
    case 'pending':
      return 'bg-amber-50 text-amber-700';
    case 'approved':
      return 'bg-[#E3F2FD] text-[#1565C0]';
    case 'sent':
      return 'bg-[#E3F2FD] text-[#1E88E5]';
    case 'rejected':
      return 'bg-rose-50 text-rose-600';
    case 'imported':
      return 'bg-[#EDE9FE] text-[#7C3AED]';
    case 'draft':
      return 'bg-slate-100 text-slate-600';
    case 'cancelled':
      return 'bg-rose-50 text-rose-600';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function shortStatusLabel(label: string, status?: string) {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' && /buyer verify/i.test(label)) return 'Buyer Verify';
  if (s === 'pending') return 'SCM Manager';
  if (s === 'sent') return 'Vendor Acknowledged pending';
  const full = String(label || '').trim();
  if (/scm manager signed/i.test(full)) return 'Buyer Verify';
  if (/pending vendor acceptance/i.test(full)) return 'Vendor Acknowledged pending';
  if (/pending scm manager sign/i.test(full)) return 'SCM Manager';
  return full;
}

function StatusBadge({ label, status }: { label: string; status?: string }) {
  const text = shortStatusLabel(label, status);
  const isVendorAck = text === 'Vendor Acknowledged pending';
  return (
    <span
      className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug text-center ${statusColor(status || '')}`}
      title={label || text}
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
}

export default function TrackPoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'Super Admin');
  const isAdminEditor = Boolean(
    isSuperAdmin ||
      user?.role === 'SCM Manager' ||
      user?.role === 'SCM Buyer'
  );
  /** Admin / Manager can send pending-sign POs back to Create PO (draft) */
  const canSendBackPending = Boolean(
    isSuperAdmin || user?.role === 'SCM Manager'
  );
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
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [retrievingKey, setRetrievingKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [sendBackModal, setSendBackModal] = useState<{
    poId: number;
    poNumber: string;
    title: string;
    amount: number;
    mode: 'pending_sign' | 'buyer_verify';
  } | null>(null);
  const mastersLoadedRef = useRef(false);

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

  // Defer filter masters until after first list paint (don't compete with /api/po/track)
  useEffect(() => {
    if (loading || mastersLoadedRef.current) return;
    mastersLoadedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const [entRes, deptRes, catRes] = await Promise.all([
          masterApi.listEntities({ status: 'active' }),
          masterApi.listDepartments({ status: 'active' }),
          masterApi.listCategories({ status: 'active' }),
        ]);
        if (cancelled) return;
        setEntities(entRes.data || []);
        setDepartments(deptRes.data || []);
        setCategories(catRes.data || []);
      } catch {
        if (!cancelled) {
          setEntities([]);
          setDepartments([]);
          setCategories([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  const handleAdminDelete = async (row: TrackRow) => {
    if (!isSuperAdmin) return;
    if (row.poId) {
      const ok = window.confirm(
        `Delete ${row.poNumber || 'this PO'}?\n\nThis permanently removes the purchase order. This cannot be undone.`
      );
      if (!ok) return;
      setDeletingKey(row.key);
      setError('');
      try {
        const res = await poApi.adminDelete(row.poId);
        setToast(res.message || `${row.poNumber} deleted`);
        setTimeout(() => setToast(''), 3500);
        if (expandedKey === row.key) setExpandedKey(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete PO');
      } finally {
        setDeletingKey(null);
      }
      return;
    }
    if (row.prId > 0) {
      const ok = window.confirm(
        `Delete ${row.prNumber || 'this PR'}?\n\nThis permanently removes the purchase request and any linked RFQ / PO. This cannot be undone.`
      );
      if (!ok) return;
      setDeletingKey(row.key);
      setError('');
      try {
        const res = await prApi.adminDelete(row.prId);
        setToast(res.message || `${row.prNumber} deleted`);
        setTimeout(() => setToast(''), 3500);
        if (expandedKey === row.key) setExpandedKey(null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete PR');
      } finally {
        setDeletingKey(null);
      }
    }
  };

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
      'PO Date',
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
        r.poDate || '',
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

  const openEditDraft = (poId: number) => {
    navigate(`/scm/create-po?poId=${poId}&from=create-po`);
  };

  const openAdminEditPo = (poId: number) => {
    navigate(`/scm/create-po?poId=${poId}&from=track-po`);
  };

  const openSendBack = (row: TrackRow, mode: 'pending_sign' | 'buyer_verify' = 'pending_sign') => {
    if (!row.poId) return;
    setSendBackModal({
      poId: row.poId,
      poNumber: String(row.poNumber || `PO #${row.poId}`),
      title: String(row.title || row.vendorName || ''),
      amount: Number(row.amount) || 0,
      mode,
    });
  };

  const handleTrackSendBack = async (remarks: string) => {
    if (!sendBackModal) return;
    if (sendBackModal.mode === 'buyer_verify') {
      const res = await poApi.adminSendBackToBuyerVerify(sendBackModal.poId, remarks);
      setToast(
        res.message ||
          `${sendBackModal.poNumber} sent back to Buyer Verify (Approved PO verification)`
      );
    } else {
      const res = await poApi.sendBack(sendBackModal.poId, remarks);
      setToast(res.message || `${sendBackModal.poNumber} sent back to SCM Buyer for revision`);
    }
    setTimeout(() => setToast(''), 4000);
    setSendBackModal(null);
    setExpandedKey(null);
    await load();
  };

  const handleRetrieveCancelled = async (row: TrackRow) => {
    if (!row.poId) return;
    const ok = window.confirm(
      `Retrieve ${row.poNumber || 'this cancelled PO'} as a draft?\n\nYou can edit and resubmit it for approval.`
    );
    if (!ok) return;
    setRetrievingKey(row.key);
    setError('');
    try {
      await poApi.retrieve(row.poId);
      setToast(`${row.poNumber || 'PO'} retrieved as draft`);
      setTimeout(() => setToast(''), 3500);
      openEditDraft(row.poId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve cancelled PO');
    } finally {
      setRetrievingKey(null);
    }
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
      {toast ? (
        <div className="fixed right-4 top-4 z-50 rounded-xl bg-[#1E88E5] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                PO/WO Tracker
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
                All purchase orders and work orders. Filter by entity, department, category, type, and date.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleExportAll()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-transparent bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors hover:border-[#90CAF9]"
            >
              <i className="ri-download-2-line"></i>
              Export
            </button>
          </header>

          {error && (
            <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="cursor-pointer text-rose-500 hover:text-rose-700">
                <i className="ri-close-line"></i>
              </button>
            </div>
          )}

          <div className="relative mb-5 overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <div className="relative z-[1] space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search PR, PO/WO, vendor, title, entity..."
                    className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
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
                  className="h-11 min-w-[150px] cursor-pointer rounded-2xl border border-transparent bg-white px-3.5 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
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
                  className="h-11 min-w-[150px] cursor-pointer rounded-2xl border border-transparent bg-white px-3.5 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  From
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                      setExpandedKey(null);
                    }}
                    className="h-11 cursor-pointer rounded-2xl border border-transparent bg-white px-3 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  To
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                      setExpandedKey(null);
                    }}
                    className="h-11 cursor-pointer rounded-2xl border border-transparent bg-white px-3 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                  />
                </label>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-11 cursor-pointer rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]"
                >
                  Clear filters
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
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
                    className={`h-11 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                      purchaseTypeFilter === key
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
            id="po-tracker-table"
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
              data-po-tracker-scroll
              className="relative z-[1] w-full overflow-x-auto overflow-y-visible overscroll-x-contain px-0 pb-3 pt-1"
            >
              {loading ? (
                <p className="p-8 text-sm text-slate-500">Loading purchase orders...</p>
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
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Type
                      </th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Title / Vendor
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Entity
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Department
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
                        <td
                          colSpan={9}
                          className="rounded-2xl border border-transparent bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
                        >
                          No purchase orders found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const open = expandedKey === row.key;
                        const rowBorder = open
                          ? 'border-[#90CAF9]'
                          : 'border-transparent group-hover:border-[#90CAF9]';
                        const rowShadow = open
                          ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                          : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                        return (
                          <Fragment key={row.key}>
                            <tr
                              className="group cursor-pointer"
                              onClick={() => setExpandedKey(open ? null : row.key)}
                            >
                              <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                                <div
                                  className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 shadow-[8px_0_12px_-10px_rgba(15,23,42,0.16)] transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                                >
                                  <button
                                    type="button"
                                    className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                      open
                                        ? 'bg-[#1E88E5] text-white'
                                        : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                    }`}
                                    aria-expanded={open}
                                    aria-label={open ? 'Collapse details' : 'Expand details'}
                                  >
                                    <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                                  </button>
                                  <div
                                    className="min-w-0"
                                    title={[row.prNumber, row.poNumber].filter(Boolean).join(' · ') || undefined}
                                  >
                                    <p className="whitespace-nowrap text-sm font-bold text-[#1E88E5]">
                                      {row.prNumber || '—'}
                                    </p>
                                    <p className="mt-0.5 whitespace-nowrap text-xs font-semibold text-[#2C3E50]">
                                      {row.poNumber || '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-slate-600 transition-[border-color] sm:py-5 ${rowBorder}`}
                              >
                                {row.poDate || '—'}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                              >
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    row.purchaseType === 'work_order'
                                      ? 'bg-[#EDE9FE] text-[#7C3AED]'
                                      : 'bg-[#E3F2FD] text-[#1E88E5]'
                                  }`}
                                >
                                  {row.purchaseTypeLabel ||
                                    (row.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')}
                                </span>
                              </td>
                              <td
                                className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                                title={`${row.title}${row.vendorName ? ` · ${row.vendorName}` : ''}`}
                              >
                                <p className="truncate text-sm font-semibold text-[#2C3E50]">{row.title}</p>
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {row.vendorName || 'Vendor pending'}
                                </p>
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                                title={row.entityName || undefined}
                              >
                                {row.entityName || '—'}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-sm text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                                title={row.department}
                              >
                                {row.department || '—'}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right text-sm font-bold tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}
                              >
                                {formatCurrency(row.amount)}
                              </td>
                              <td
                                className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 transition-[border-color] sm:py-5 ${rowBorder}`}
                              >
                                <StatusBadge label={row.statusLabel} status={row.status} />
                              </td>
                              <td
                                className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div
                                  className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 shadow-[-8px_0_12px_-10px_rgba(15,23,42,0.16)] transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                                >
                                  {row.kind === 'ready' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openCreatePo(row.prId)}
                                        className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                      >
                                        Create {row.purchaseType === 'work_order' ? 'WO' : 'PO'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openImportModal(row.prId)}
                                        className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                      >
                                        Import
                                      </button>
                                    </>
                                  )}
                                  {row.status === 'draft' && row.poId && (
                                    <button
                                      type="button"
                                      onClick={() => openEditDraft(row.poId!)}
                                      className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                    >
                                      Edit Draft
                                    </button>
                                  )}
                                  {canSendBackPending && row.poId && row.status === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => openSendBack(row, 'pending_sign')}
                                      className="cursor-pointer whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                                      title="Send back to SCM Buyer Create PO as draft"
                                    >
                                      <i className="ri-arrow-go-back-line mr-1"></i>
                                      Send Back
                                    </button>
                                  )}
                                  {isSuperAdmin && canAdminSendBackToBuyerVerify(row) && (
                                    <button
                                      type="button"
                                      onClick={() => openSendBack(row, 'buyer_verify')}
                                      className="cursor-pointer whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                                      title="Send back to Approved PO verification (Buyer Verify). Clears vendor acceptance, GRN, and invoice for this PO."
                                    >
                                      <i className="ri-arrow-go-back-line mr-1"></i>
                                      To Buyer Verify
                                    </button>
                                  )}
                                  {isAdminEditor &&
                                    row.poId &&
                                    row.status !== 'draft' &&
                                    row.status !== 'cancelled' &&
                                    !(user?.role === 'SCM Buyer' && row.status === 'pending') && (
                                      <button
                                        type="button"
                                        onClick={() => openAdminEditPo(row.poId!)}
                                        className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                        title="Edit this purchase order"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  {user?.role === 'SCM Buyer' && row.poId && row.status === 'pending' && (
                                    <span
                                      className="whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800"
                                      title="Sent to SCM Manager for sign / approval"
                                    >
                                      SCM Manager
                                    </span>
                                  )}
                                  {row.status === 'cancelled' && row.poId && (
                                    <button
                                      type="button"
                                      disabled={retrievingKey === row.key}
                                      onClick={() => void handleRetrieveCancelled(row)}
                                      className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
                                      title="Retrieve cancelled PO as draft"
                                    >
                                      {retrievingKey === row.key ? 'Retrieving…' : 'Retrieve'}
                                    </button>
                                  )}
                                  {row.poId && (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/scm/po-pdf-view?poId=${row.poId}`)}
                                      className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                    >
                                      View PDF
                                    </button>
                                  )}
                                  {isSuperAdmin && (row.poId || row.prId > 0) && (
                                    <button
                                      type="button"
                                      disabled={deletingKey === row.key}
                                      onClick={() => void handleAdminDelete(row)}
                                      className="cursor-pointer whitespace-nowrap rounded-xl bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] hover:bg-rose-100 disabled:opacity-50"
                                      title={row.poId ? 'Permanently delete this PO' : 'Permanently delete this PR'}
                                    >
                                      {deletingKey === row.key ? 'Deleting…' : 'Delete'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {open && <TrackPoExpandedRow row={row} colSpan={9} />}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/80 px-4 py-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-700">{rangeFrom}</span>
                {'–'}
                <span className="font-semibold text-slate-700">{rangeTo}</span>
                {' of '}
                <span className="font-semibold text-slate-700">{pagination.total}</span> records
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Rows
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                      setExpandedKey(null);
                    }}
                    className="cursor-pointer rounded-xl border border-transparent bg-white px-2 py-1.5 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20"
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
                  <span className="whitespace-nowrap px-3 py-1.5 text-sm text-slate-600">
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
              className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none rounded-xl border border-slate-200 bg-white focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20"
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
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#1E88E5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
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

      {sendBackModal && (
        <POApprovalModal
          isOpen
          type="sendback"
          poNumber={sendBackModal.poNumber}
          prTitle={sendBackModal.title}
          grandTotal={sendBackModal.amount}
          onConfirm={handleTrackSendBack}
          onClose={() => setSendBackModal(null)}
          {...(sendBackModal.mode === 'buyer_verify'
            ? {
                sendBackTitle: 'Send Back to Buyer Verify',
                sendBackHint:
                  'Returns this PO to Approved PO verification. Clears vendor acceptance, GRN, and invoice so the flow can restart after re-verify.',
                sendBackPlaceholder: 'Why send this PO back to Buyer Verify?',
                sendBackConfirmLabel: 'Send to Buyer Verify',
              }
            : {})}
        />
      )}
    </DashboardLayout>
  );
}
