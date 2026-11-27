import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import AnimatedKpiCard from '../../../components/feature/AnimatedKpiCard';
import { poApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import '../../../styles/dashboard-fx.css';

type ReportRow = {
  lineId: number;
  poId: number;
  poNumber: string;
  poDate: string;
  status: string;
  statusLabel: string;
  purchaseType: string;
  purchaseTypeLabel?: string;
  vendorId: number | null;
  vendorName: string;
  entityName?: string;
  plantName?: string;
  department?: string;
  category: string;
  itemName: string;
  description: string;
  quantity: number;
  uom: string;
  unitRate: number;
  taxPercentage: number;
  taxAmount: number;
  lineExGst: number;
  lineTotal: number;
  poSubtotal?: number;
  poTaxAmount?: number;
  poGrandTotal: number;
};

type ComparisonRow = {
  vendorName: string;
  itemName: string;
  category: string;
  poCount: number;
  totalQuantity: number;
  minRate: number;
  maxRate: number;
  avgRate: number;
  totalExGst: number;
};

type Summary = {
  totalPOs: number;
  totalVendors: number;
  totalQuantity: number;
  totalPoValue: number;
  totalLineExGst: number;
  totalLineTax: number;
  totalLineValue: number;
  lineCount: number;
};

type ColumnKey =
  | 'poNumber'
  | 'poDate'
  | 'vendorName'
  | 'itemName'
  | 'description'
  | 'category'
  | 'entityName'
  | 'plantName'
  | 'department'
  | 'quantity'
  | 'uom'
  | 'unitRate'
  | 'taxPercentage'
  | 'taxAmount'
  | 'lineExGst'
  | 'lineTotal'
  | 'poGrandTotal'
  | 'poSubtotal'
  | 'poTaxAmount'
  | 'purchaseTypeLabel'
  | 'statusLabel'
  | 'compare';

type FunnelKind = 'search' | 'select' | 'dateRange' | 'none';

type ColumnDef = {
  key: ColumnKey;
  label: string;
  defaultVisible: boolean;
  align?: 'left' | 'right';
  sticky?: boolean;
  minWidth?: string;
  funnel?: FunnelKind;
};

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'poNumber', label: 'PO Number', defaultVisible: true, sticky: true, minWidth: '180px', funnel: 'search' },
  { key: 'poDate', label: 'PO Date', defaultVisible: true, minWidth: '110px', funnel: 'dateRange' },
  { key: 'vendorName', label: 'Vendor Name', defaultVisible: true, minWidth: '180px', funnel: 'select' },
  { key: 'plantName', label: 'Plant', defaultVisible: true, minWidth: '140px', funnel: 'select' },
  { key: 'itemName', label: 'Item Name', defaultVisible: true, minWidth: '180px', funnel: 'select' },
  { key: 'description', label: 'Description', defaultVisible: false, minWidth: '200px', funnel: 'none' },
  { key: 'category', label: 'Category', defaultVisible: true, minWidth: '140px', funnel: 'select' },
  { key: 'entityName', label: 'Entity', defaultVisible: false, minWidth: '160px', funnel: 'none' },
  { key: 'department', label: 'Department', defaultVisible: false, minWidth: '140px', funnel: 'none' },
  { key: 'quantity', label: 'Quantity', defaultVisible: true, align: 'right', minWidth: '100px', funnel: 'none' },
  { key: 'uom', label: 'UOM', defaultVisible: true, minWidth: '70px', funnel: 'none' },
  { key: 'unitRate', label: 'Unit Rate', defaultVisible: true, align: 'right', minWidth: '110px', funnel: 'none' },
  { key: 'taxPercentage', label: 'Tax %', defaultVisible: false, align: 'right', minWidth: '80px', funnel: 'none' },
  { key: 'taxAmount', label: 'Tax Amount', defaultVisible: true, align: 'right', minWidth: '110px', funnel: 'none' },
  { key: 'lineExGst', label: 'Line Ex-GST', defaultVisible: false, align: 'right', minWidth: '120px', funnel: 'none' },
  { key: 'lineTotal', label: 'Line Total', defaultVisible: true, align: 'right', minWidth: '120px', funnel: 'none' },
  { key: 'poSubtotal', label: 'PO Subtotal', defaultVisible: false, align: 'right', minWidth: '120px', funnel: 'none' },
  { key: 'poTaxAmount', label: 'PO Tax', defaultVisible: false, align: 'right', minWidth: '110px', funnel: 'none' },
  { key: 'poGrandTotal', label: 'PO Value', defaultVisible: false, align: 'right', minWidth: '120px', funnel: 'none' },
  { key: 'purchaseTypeLabel', label: 'Doc Type', defaultVisible: false, minWidth: '120px', funnel: 'select' },
  { key: 'statusLabel', label: 'Status', defaultVisible: true, minWidth: '150px', funnel: 'select' },
  { key: 'compare', label: 'Compare', defaultVisible: true, minWidth: '100px', funnel: 'none' },
];

const COLUMN_STORAGE_KEY = 'rmc.poReport.visibleColumns.v2';
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatCompact = (amount: number) => {
  const n = Number(amount) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return formatCurrency(n);
};

const formatQty = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(n) || 0);

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function loadVisibleColumns(): Record<ColumnKey, boolean> {
  const defaults = Object.fromEntries(
    ALL_COLUMNS.map((c) => [c.key, c.defaultVisible])
  ) as Record<ColumnKey, boolean>;
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnKey, boolean>>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

const fieldClass =
  'h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/30';

function statusTone(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('approved') || s.includes('paid') || s.includes('grn')) {
    return { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' };
  }
  if (s.includes('reject') || s.includes('cancel')) {
    return { bg: 'bg-red-50', text: 'text-[#E53935]', dot: 'bg-[#E53935]' };
  }
  return { bg: 'bg-amber-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' };
}

type FunnelProps = {
  col: ColumnDef;
  open: boolean;
  onToggle: () => void;
  active: boolean;
  draft: string;
  onDraft: (v: string) => void;
  draftTo?: string;
  onDraftTo?: (v: string) => void;
  options?: Array<{ value: string; label: string }>;
  onApply: () => void;
  onClear: () => void;
};

function ColumnFunnel({
  col,
  open,
  onToggle,
  active,
  draft,
  onDraft,
  draftTo,
  onDraftTo,
  options,
  onApply,
  onClear,
}: FunnelProps) {
  if (!col.funnel || col.funnel === 'none') {
    return <span>{col.label}</span>;
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <span>{col.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
          active
            ? 'bg-[#E3F2FD] text-[#1E88E5]'
            : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
        }`}
        aria-label={`Filter ${col.label}`}
        title={`Filter ${col.label}`}
      >
        <i className="ri-filter-3-fill text-[11px]" />
      </button>
      {open ? (
        <div
          className={`absolute top-full z-50 mt-2 w-56 rounded-xl border border-[#EEF0F5] bg-white p-3 text-left font-normal normal-case tracking-normal shadow-lg ${
            col.align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter {col.label}
          </p>
          {col.funnel === 'search' ? (
            <input
              type="search"
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              placeholder={`Search ${col.label.toLowerCase()}…`}
              className={fieldClass}
              autoFocus
            />
          ) : null}
          {col.funnel === 'select' ? (
            <select
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              className={fieldClass}
              autoFocus
            >
              <option value="">All</option>
              {(options || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : null}
          {col.funnel === 'dateRange' ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">From</label>
                <input
                  type="date"
                  value={draft}
                  onChange={(e) => onDraft(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">To</label>
                <input
                  type="date"
                  value={draftTo || ''}
                  onChange={(e) => onDraftTo?.(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-8 items-center rounded-lg bg-[#1E88E5] px-3 text-[12px] font-semibold text-white hover:bg-[#1565C0]"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PoReportPage() {
  const { user } = useAuth();
  const columnsRef = useRef<HTMLDivElement>(null);
  const funnelRef = useRef<HTMLTableSectionElement>(null);

  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [vendor, setVendor] = useState('');
  const [plant, setPlant] = useState('');
  const [category, setCategory] = useState('');
  const [item, setItem] = useState('');
  const [status, setStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [purchaseType, setPurchaseType] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vendors, setVendors] = useState<string[]>([]);
  const [plants, setPlants] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [compareItem, setCompareItem] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<Record<ColumnKey, boolean>>(loadVisibleColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [funnelOpen, setFunnelOpen] = useState<ColumnKey | null>(null);
  const [funnelDraft, setFunnelDraft] = useState('');
  const [funnelDraftTo, setFunnelDraftTo] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleCols));
  }, [visibleCols]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!columnsRef.current?.contains(target)) setColumnsOpen(false);
      if (!funnelRef.current?.contains(target)) setFunnelOpen(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await poApi.consolidatedReport({
        page,
        limit,
        search: searchDebounced || undefined,
        vendor: vendor || undefined,
        plant: plant || undefined,
        category: category || undefined,
        item: item || undefined,
        compareItem: compareItem || item || undefined,
        status: status === 'all' || status === 'draft' ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        purchaseType: purchaseType === 'all' ? undefined : purchaseType,
      });
      const data = res.data;
      setRows(data.rows || []);
      setComparison(data.comparison || []);
      setSummary(data.summary || null);
      setVendors(data.filterOptions?.vendors || []);
      setPlants(data.filterOptions?.plants || []);
      setCategories(data.filterOptions?.categories || []);
      setItems(data.filterOptions?.items || []);
      setStatuses(
        (data.filterOptions?.statuses || []).filter((s) => String(s.value).toLowerCase() !== 'draft')
      );
      setPagination(data.pagination || { page: 1, limit, total: 0, totalPages: 1 });
      if (data.compareItem) setCompareItem(data.compareItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PO report');
      setRows([]);
      setComparison([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    searchDebounced,
    vendor,
    plant,
    category,
    item,
    compareItem,
    status,
    dateFrom,
    dateTo,
    purchaseType,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, vendor, plant, category, item, status, dateFrom, dateTo, purchaseType, limit]);

  const clearFilters = () => {
    setSearch('');
    setSearchDebounced('');
    setVendor('');
    setPlant('');
    setCategory('');
    setItem('');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setPurchaseType('all');
    setCompareItem(null);
    setFunnelOpen(null);
    setPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchDebounced) n += 1;
    if (vendor) n += 1;
    if (plant) n += 1;
    if (category) n += 1;
    if (item) n += 1;
    if (status !== 'all') n += 1;
    if (dateFrom) n += 1;
    if (dateTo) n += 1;
    if (purchaseType !== 'all') n += 1;
    return n;
  }, [searchDebounced, vendor, plant, category, item, status, dateFrom, dateTo, purchaseType]);

  const activeColumns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleCols[c.key]),
    [visibleCols]
  );

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const showAllColumns = () => {
    setVisibleCols(
      Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, true])) as Record<ColumnKey, boolean>
    );
  };

  const resetColumns = () => {
    setVisibleCols(
      Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, c.defaultVisible])) as Record<
        ColumnKey,
        boolean
      >
    );
  };

  const funnelActive = (key: ColumnKey) => {
    switch (key) {
      case 'poNumber':
        return Boolean(searchDebounced);
      case 'vendorName':
        return Boolean(vendor);
      case 'plantName':
        return Boolean(plant);
      case 'itemName':
        return Boolean(item);
      case 'category':
        return Boolean(category);
      case 'statusLabel':
        return status !== 'all';
      case 'purchaseTypeLabel':
        return purchaseType !== 'all';
      case 'poDate':
        return Boolean(dateFrom || dateTo);
      default:
        return false;
    }
  };

  const openFunnel = (key: ColumnKey) => {
    setColumnsOpen(false);
    if (funnelOpen === key) {
      setFunnelOpen(null);
      return;
    }
    switch (key) {
      case 'poNumber':
        setFunnelDraft(search);
        break;
      case 'vendorName':
        setFunnelDraft(vendor);
        break;
      case 'plantName':
        setFunnelDraft(plant);
        break;
      case 'itemName':
        setFunnelDraft(item);
        break;
      case 'category':
        setFunnelDraft(category);
        break;
      case 'statusLabel':
        setFunnelDraft(status === 'all' ? '' : status);
        break;
      case 'purchaseTypeLabel':
        setFunnelDraft(purchaseType === 'all' ? '' : purchaseType);
        break;
      case 'poDate':
        setFunnelDraft(dateFrom);
        setFunnelDraftTo(dateTo);
        break;
      default:
        setFunnelDraft('');
    }
    setFunnelOpen(key);
  };

  const applyFunnel = (key: ColumnKey) => {
    switch (key) {
      case 'poNumber':
        setSearch(funnelDraft.trim());
        break;
      case 'vendorName':
        setVendor(funnelDraft);
        break;
      case 'plantName':
        setPlant(funnelDraft);
        break;
      case 'itemName':
        setItem(funnelDraft);
        setCompareItem(funnelDraft || null);
        break;
      case 'category':
        setCategory(funnelDraft);
        break;
      case 'statusLabel':
        setStatus(funnelDraft || 'all');
        break;
      case 'purchaseTypeLabel':
        setPurchaseType(funnelDraft || 'all');
        break;
      case 'poDate':
        setDateFrom(funnelDraft);
        setDateTo(funnelDraftTo);
        break;
      default:
        break;
    }
    setFunnelOpen(null);
    setPage(1);
  };

  const clearFunnel = (key: ColumnKey) => {
    switch (key) {
      case 'poNumber':
        setSearch('');
        setSearchDebounced('');
        break;
      case 'vendorName':
        setVendor('');
        break;
      case 'plantName':
        setPlant('');
        break;
      case 'itemName':
        setItem('');
        setCompareItem(null);
        break;
      case 'category':
        setCategory('');
        break;
      case 'statusLabel':
        setStatus('all');
        break;
      case 'purchaseTypeLabel':
        setPurchaseType('all');
        break;
      case 'poDate':
        setDateFrom('');
        setDateTo('');
        break;
      default:
        break;
    }
    setFunnelDraft('');
    setFunnelDraftTo('');
    setFunnelOpen(null);
    setPage(1);
  };

  const funnelOptions = (key: ColumnKey): Array<{ value: string; label: string }> => {
    switch (key) {
      case 'vendorName':
        return vendors.map((v) => ({ value: v, label: v }));
      case 'plantName':
        return plants.map((p) => ({ value: p, label: p }));
      case 'itemName':
        return items.map((i) => ({ value: i, label: i }));
      case 'category':
        return categories.map((c) => ({ value: c, label: c }));
      case 'statusLabel':
        return statuses;
      case 'purchaseTypeLabel':
        return [
          { value: 'purchase_order', label: 'Purchase Order' },
          { value: 'work_order', label: 'Work Order' },
        ];
      default:
        return [];
    }
  };

  const activeCompareItem = compareItem || item || null;
  const pageStart = (pagination.page - 1) * pagination.limit;

  const cellValue = (row: ReportRow, key: ColumnKey) => {
    switch (key) {
      case 'poNumber':
        return (
          <span className="whitespace-nowrap text-sm font-bold text-[#1E88E5]" title={row.poNumber}>
            {row.poNumber || '—'}
          </span>
        );
      case 'poDate':
        return <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.poDate || '—'}</span>;
      case 'vendorName':
        return (
          <span className="block max-w-[220px] truncate text-sm font-medium text-[#2C3E50]" title={row.vendorName}>
            {row.vendorName}
          </span>
        );
      case 'itemName':
        return (
          <span className="block max-w-[220px] truncate text-sm font-medium text-[#2C3E50]" title={row.itemName}>
            {row.itemName}
          </span>
        );
      case 'description':
        return (
          <span className="block max-w-[260px] truncate text-sm text-slate-500" title={row.description}>
            {row.description || '—'}
          </span>
        );
      case 'category':
        return (
          <span className="block max-w-[160px] truncate text-sm text-[#2C3E50]" title={row.category}>
            {row.category}
          </span>
        );
      case 'entityName':
        return (
          <span className="block max-w-[180px] truncate text-sm text-[#2C3E50]" title={row.entityName || ''}>
            {row.entityName || '—'}
          </span>
        );
      case 'plantName':
        return (
          <span className="block max-w-[160px] truncate text-sm text-[#2C3E50]" title={row.plantName || ''}>
            {row.plantName || '—'}
          </span>
        );
      case 'department':
        return <span className="text-sm text-[#2C3E50]">{row.department || '—'}</span>;
      case 'quantity':
        return <span className="tabular-nums text-sm text-[#2C3E50]">{formatQty(row.quantity)}</span>;
      case 'uom':
        return <span className="text-sm text-slate-600">{row.uom}</span>;
      case 'unitRate':
        return <span className="tabular-nums text-sm text-[#2C3E50]">{formatCurrency(row.unitRate)}</span>;
      case 'taxPercentage':
        return <span className="tabular-nums text-sm text-slate-600">{row.taxPercentage}%</span>;
      case 'taxAmount':
        return <span className="tabular-nums text-sm text-[#2C3E50]">{formatCurrency(row.taxAmount)}</span>;
      case 'lineExGst':
        return <span className="tabular-nums text-sm text-[#2C3E50]">{formatCurrency(row.lineExGst)}</span>;
      case 'lineTotal':
        return (
          <span className="tabular-nums text-sm font-semibold text-slate-900">
            {formatCurrency(row.lineTotal)}
          </span>
        );
      case 'poSubtotal':
        return (
          <span className="tabular-nums text-sm text-[#2C3E50]">
            {formatCurrency(row.poSubtotal || 0)}
          </span>
        );
      case 'poTaxAmount':
        return (
          <span className="tabular-nums text-sm text-[#2C3E50]">
            {formatCurrency(row.poTaxAmount || 0)}
          </span>
        );
      case 'poGrandTotal':
        return (
          <span className="tabular-nums text-sm font-semibold text-slate-900">
            {formatCurrency(row.poGrandTotal)}
          </span>
        );
      case 'purchaseTypeLabel':
        return (
          <span className="text-sm text-[#2C3E50]">
            {row.purchaseTypeLabel ||
              (row.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')}
          </span>
        );
      case 'statusLabel': {
        const tone = statusTone(row.statusLabel || row.status);
        return (
          <span
            className={`inline-flex max-w-[180px] items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.bg} ${tone.text}`}
            title={row.statusLabel}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
            <span className="truncate">{row.statusLabel}</span>
          </span>
        );
      }
      case 'compare':
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setItem(row.itemName);
              setCompareItem(row.itemName);
              setPage(1);
            }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline"
          >
            <i className="ri-bar-chart-box-line" />
            Compare
          </button>
        );
      default:
        return '—';
    }
  };

  return (
    <DashboardLayout>
      <div className="tasks-fx fi-fx min-h-full font-sans text-[#0F172A]">
        <section className="tfx-hero">
          <div className="tfx-bubbles" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="tfx-hero-content">
            <div className="tfx-hi">
              {greetingForNow()}, <span className="tfx-wave">👋</span>
            </div>
            <h1>
              <span className="tfx-shimmer">{user?.name || 'User'}</span>
            </h1>
            <p>
              Consolidated PO report · line-level spend, rates and vendor compare
              <span className="tfx-role-inline"> · RMC Procurement</span>
            </p>
          </div>
          <div className="fi-actions">
            <button type="button" onClick={() => void load()} className="tfx-btn secondary">
              <i className="ri-refresh-line" />
              Refresh
            </button>
          </div>
        </section>

        <section className="tfx-kpis mb-5">
          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            <AnimatedKpiCard
              title="Total POs"
              value={summary?.totalPOs || 0}
              displayValue={summary ? String(summary.totalPOs) : '—'}
              variant="all"
              index={0}
              total={Math.max(summary?.totalPOs || 1, 1)}
              percent={100}
              subtitle="Distinct purchase orders"
              chart="spark"
            />
            <AnimatedKpiCard
              title="Vendors"
              value={summary?.totalVendors || 0}
              displayValue={summary ? String(summary.totalVendors) : '—'}
              variant="approved"
              index={1}
              total={Math.max(summary?.totalVendors || 1, 1)}
              percent={100}
              subtitle="Unique vendors in filter"
              chart="spark"
            />
            <AnimatedKpiCard
              title="Total Qty"
              value={summary?.totalQuantity || 0}
              displayValue={summary ? formatQty(summary.totalQuantity) : '—'}
              variant="pending_approval"
              index={2}
              total={Math.max(summary?.totalQuantity || 1, 1)}
              percent={100}
              subtitle="Sum of line quantities"
              chart="spark"
            />
            <AnimatedKpiCard
              title="PO Value"
              value={summary?.totalPoValue || 0}
              displayValue={summary ? formatCompact(summary.totalPoValue) : '—'}
              variant="payments"
              index={3}
              total={Math.max(summary?.totalPoValue || 1, 1)}
              percent={100}
              subtitle={summary ? formatCurrency(summary.totalPoValue) : 'Filtered PO grand total'}
              chart="spark"
            />
          </div>
        </section>

        <div className="fi-body space-y-5 px-1 pb-8 sm:px-0">
          <div className="relative overflow-visible rounded-2xl border border-white/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                Report filters
                {activeFilterCount ? (
                  <span className="ml-2 rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[11px] font-semibold text-[#1E88E5]">
                    {activeFilterCount} active
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-3">
                {summary ? (
                  <p className="hidden text-xs text-slate-500 sm:block">
                    {formatCurrency(summary.totalLineValue)} · {summary.lineCount} line(s)
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline"
                >
                  <i className="ri-filter-off-line" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-nowrap items-end gap-2 overflow-x-auto pb-0.5">
              <div className="relative min-w-[200px] flex-[1.6] shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Search
                </p>
                <div className="relative">
                  <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="PO, vendor, item, plant…"
                    className={`${fieldClass} pl-8`}
                  />
                </div>
              </div>
              <div className="min-w-[140px] flex-1 shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Vendor
                </p>
                <select
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className={fieldClass}
                  aria-label="Vendor"
                >
                  <option value="">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px] flex-1 shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Plant
                </p>
                <select
                  value={plant}
                  onChange={(e) => setPlant(e.target.value)}
                  className={fieldClass}
                  aria-label="Plant"
                >
                  <option value="">All Plants</option>
                  {plants.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[130px] flex-1 shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Category
                </p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={fieldClass}
                  aria-label="Category"
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px] flex-1 shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={fieldClass}
                  aria-label="Status"
                >
                  <option value="all">All Status</option>
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[128px] shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  From
                </p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={fieldClass}
                  aria-label="Date from"
                />
              </div>
              <div className="min-w-[128px] shrink-0">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  To
                </p>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={fieldClass}
                  aria-label="Date to"
                />
              </div>
            </div>
          </div>

          {activeCompareItem && comparison.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[#BBDEFB] bg-[#F5FAFF] shadow-lg shadow-slate-200/30">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#BBDEFB]/60 px-4 py-3 sm:px-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Vendor rate comparison</h2>
                  <p className="text-xs text-slate-500">
                    Item: <span className="font-semibold text-slate-700">{activeCompareItem}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompareItem(null);
                    setItem('');
                  }}
                  className="text-xs font-semibold text-[#1E88E5] hover:underline"
                >
                  Clear comparison
                </button>
              </div>
              <div className="overflow-x-auto px-2 pb-3 pt-1 sm:px-3">
                <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-sm">
                  <thead>
                    <tr>
                      {['Vendor', 'POs', 'Qty', 'Min rate', 'Avg rate', 'Max rate', 'Value (ex-GST)'].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 pb-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c) => (
                      <tr key={`${c.vendorName}-${c.category}`}>
                        <td className="rounded-l-2xl border border-r-0 border-transparent bg-white px-3 py-3 font-medium text-slate-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                          {c.vendorName}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-3 tabular-nums">
                          {c.poCount}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-3 tabular-nums">
                          {formatQty(c.totalQuantity)}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-3 tabular-nums">
                          {formatCurrency(c.minRate)}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-3 tabular-nums font-semibold text-[#1565C0]">
                          {formatCurrency(c.avgRate)}
                        </td>
                        <td className="border border-x-0 border-transparent bg-white px-3 py-3 tabular-nums">
                          {formatCurrency(c.maxRate)}
                        </td>
                        <td className="rounded-r-2xl border border-l-0 border-transparent bg-white px-3 py-3 tabular-nums">
                          {formatCurrency(c.totalExGst)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl">
            <div className="relative z-20 flex flex-col gap-3 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
                  <i className="ri-file-list-3-line text-lg" aria-hidden />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 sm:text-base">
                    All PO line details
                  </h3>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    {loading
                      ? 'Loading…'
                      : pagination.total
                        ? `${pageStart + 1}–${Math.min(pageStart + rows.length, pagination.total)} of ${pagination.total}`
                        : '0 records'}
                    {' · filters update KPI cards above'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative" ref={columnsRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setColumnsOpen((v) => !v);
                      setFunnelOpen(null);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <i className="ri-layout-column-line text-[#1E88E5]" />
                    Columns
                  </button>
                  {columnsOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-[#EEF0F5] bg-white p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Show columns
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={showAllColumns}
                            className="text-[11px] font-semibold text-[#1E88E5]"
                          >
                            All
                          </button>
                          <button
                            type="button"
                            onClick={resetColumns}
                            className="text-[11px] font-semibold text-slate-500"
                          >
                            Default
                          </button>
                        </div>
                      </div>
                      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                        {ALL_COLUMNS.map((col) => (
                          <label
                            key={col.key}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(visibleCols[col.key])}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded border-slate-300 text-[#1E88E5] focus:ring-[#1E88E5]"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-slate-500">Rows</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error ? (
              <div className="px-5 py-8 text-center text-sm text-rose-600">{error}</div>
            ) : (
              <div className="bg-[#F8FAFC]/70 px-2 pb-3 pt-1 sm:px-3 sm:pb-4">
                <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead ref={funnelRef} className="relative z-30">
                    <tr>
                      {activeColumns.map((col) => (
                        <th
                          key={col.key}
                          className={`relative whitespace-nowrap px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          }`}
                          style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                        >
                          <ColumnFunnel
                            col={col}
                            open={funnelOpen === col.key}
                            onToggle={() => openFunnel(col.key)}
                            active={funnelActive(col.key)}
                            draft={funnelDraft}
                            onDraft={setFunnelDraft}
                            draftTo={funnelDraftTo}
                            onDraftTo={setFunnelDraftTo}
                            options={funnelOptions(col.key)}
                            onApply={() => applyFunnel(col.key)}
                            onClear={() => clearFunnel(col.key)}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan={Math.max(activeColumns.length, 1)}
                          className="rounded-2xl border border-transparent bg-white px-5 py-16 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                        >
                          <i className="ri-loader-4-line animate-spin text-4xl text-slate-200" />
                          <p className="mt-2 text-sm text-slate-400">Loading purchase order lines…</p>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(activeColumns.length, 1)}
                          className="rounded-2xl border border-transparent bg-white px-5 py-16 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                        >
                          <i className="ri-file-search-line text-4xl text-slate-200" />
                          <p className="mt-2 text-sm text-slate-400">
                            No PO lines match the selected filters.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const edge = 'border-transparent group-hover:border-[#90CAF9]';
                        const shadow = 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]';
                        return (
                          <tr key={row.lineId} className="group">
                            {activeColumns.map((col, idx) => {
                              const isFirst = idx === 0;
                              const isLast = idx === activeColumns.length - 1;
                              const radius = [
                                isFirst ? 'rounded-l-2xl sm:rounded-l-[18px] border-r-0' : '',
                                isLast ? 'rounded-r-2xl sm:rounded-r-[18px] border-l-0' : '',
                                !isFirst && !isLast ? 'border-x-0' : '',
                              ]
                                .filter(Boolean)
                                .join(' ');
                              return (
                                <td
                                  key={col.key}
                                  className={`border bg-white px-3 py-4 transition-[border-color] sm:py-5 ${edge} ${shadow} ${radius} ${
                                    col.align === 'right' ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  {cellValue(row, col.key)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
              <p className="text-xs text-slate-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
