import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi } from '../../../services/api';
import { PM_PAGE_BG } from '../../../constants/pmTheme';

type ReportRow = {
  lineId: number;
  poId: number;
  poNumber: string;
  poDate: string;
  status: string;
  statusLabel: string;
  purchaseType: string;
  vendorId: number | null;
  vendorName: string;
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

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

const formatQty = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(n) || 0);

const selectClass =
  'h-11 min-w-[160px] rounded-2xl border border-transparent bg-white px-3.5 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15';

const inputClass =
  'h-11 rounded-2xl border border-transparent bg-white px-3.5 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15';

export default function PoReportPage() {
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [vendor, setVendor] = useState('');
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
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Array<{ value: string; label: string }>>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [compareItem, setCompareItem] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await poApi.consolidatedReport({
        page,
        limit,
        search: searchDebounced || undefined,
        vendor: vendor || undefined,
        category: category || undefined,
        item: item || undefined,
        compareItem: compareItem || item || undefined,
        status: status === 'all' ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        purchaseType: purchaseType === 'all' ? undefined : purchaseType,
      });
      const data = res.data;
      setRows(data.rows || []);
      setComparison(data.comparison || []);
      setSummary(data.summary || null);
      setVendors(data.filterOptions?.vendors || []);
      setCategories(data.filterOptions?.categories || []);
      setItems(data.filterOptions?.items || []);
      setStatuses(data.filterOptions?.statuses || []);
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
  }, [searchDebounced, vendor, category, item, status, dateFrom, dateTo, purchaseType, limit]);

  const clearFilters = () => {
    setSearch('');
    setSearchDebounced('');
    setVendor('');
    setCategory('');
    setItem('');
    setStatus('all');
    setDateFrom('');
    setDateTo('');
    setPurchaseType('all');
    setCompareItem(null);
    setPage(1);
  };

  const activeCompareItem = compareItem || item || null;

  const cards = useMemo(
    () => [
      {
        key: 'pos',
        label: 'Total POs',
        value: summary ? String(summary.totalPOs) : '—',
        icon: 'ri-file-list-3-line',
        tone: 'bg-[#E3F2FD] text-[#1565C0]',
      },
      {
        key: 'vendors',
        label: 'Vendors',
        value: summary ? String(summary.totalVendors) : '—',
        icon: 'ri-store-2-line',
        tone: 'bg-[#E8F5E9] text-[#2E7D32]',
      },
      {
        key: 'qty',
        label: 'Total Qty',
        value: summary ? formatQty(summary.totalQuantity) : '—',
        icon: 'ri-stack-line',
        tone: 'bg-[#FFF3E0] text-[#EF6C00]',
      },
      {
        key: 'value',
        label: 'PO Value',
        value: summary ? formatCurrency(summary.totalPoValue) : '—',
        icon: 'ri-money-rupee-circle-line',
        tone: 'bg-[#F3E5F5] text-[#7B1FA2]',
      },
    ],
    [summary]
  );

  return (
    <DashboardLayout>
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8" style={{ background: PM_PAGE_BG }}>
        <div className="mx-auto max-w-[1400px] space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1E88E5]">
                RMC Procurement
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
                Consolidated PO Report
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Line-level view of all purchase orders with vendor, category, item, date and status
                filters. Compare vendor rates for the same item without changing PO workflows.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1E88E5] px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(30,136,229,0.7)] hover:bg-[#1565C0]"
            >
              <i className="ri-refresh-line" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.key}
                className="rounded-2xl border border-transparent bg-white/95 p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {card.label}
                  </p>
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                    <i className={`${card.icon} text-lg`} />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-transparent bg-white/95 p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <i className="ri-search-line pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO, vendor, item…"
                  className={`${inputClass} w-full pl-10`}
                />
              </div>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className={selectClass}
                aria-label="Vendor filter"
              >
                <option value="">All vendors</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
                aria-label="Category filter"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={item}
                onChange={(e) => {
                  setItem(e.target.value);
                  setCompareItem(e.target.value || null);
                }}
                className={`${selectClass} min-w-[200px]`}
                aria-label="Item filter"
              >
                <option value="">All items</option>
                {items.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={selectClass}
                aria-label="Status filter"
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value)}
                className={selectClass}
                aria-label="Document type"
              >
                <option value="all">PO + WO</option>
                <option value="purchase_order">Purchase Order</option>
                <option value="work_order">Work Order</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass}
                aria-label="Date from"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass}
                aria-label="Date to"
              />
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <i className="ri-filter-off-line" />
                Clear
              </button>
            </div>
            {summary ? (
              <p className="mt-3 text-xs text-slate-500">
                Showing {rows.length} of {summary.lineCount} line(s) · Line value (ex-GST + tax){' '}
                {formatCurrency(summary.totalLineValue)}
              </p>
            ) : null}
          </div>

          {activeCompareItem && comparison.length > 0 ? (
            <div className="rounded-2xl border border-[#BBDEFB] bg-[#F5FAFF] p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Vendor rate comparison</h2>
                  <p className="text-sm text-slate-500">
                    Item: <span className="font-semibold text-slate-700">{activeCompareItem}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompareItem(null);
                    setItem('');
                  }}
                  className="text-sm font-medium text-[#1E88E5] hover:underline"
                >
                  Clear comparison
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#BBDEFB] text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Vendor</th>
                      <th className="px-3 py-2 font-semibold">POs</th>
                      <th className="px-3 py-2 font-semibold">Qty</th>
                      <th className="px-3 py-2 font-semibold">Min rate</th>
                      <th className="px-3 py-2 font-semibold">Avg rate</th>
                      <th className="px-3 py-2 font-semibold">Max rate</th>
                      <th className="px-3 py-2 font-semibold">Value (ex-GST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c) => (
                      <tr key={`${c.vendorName}-${c.itemName}`} className="border-b border-blue-50">
                        <td className="px-3 py-2.5 font-medium text-slate-800">{c.vendorName}</td>
                        <td className="px-3 py-2.5 tabular-nums">{c.poCount}</td>
                        <td className="px-3 py-2.5 tabular-nums">{formatQty(c.totalQuantity)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{formatCurrency(c.minRate)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold text-[#1565C0]">
                          {formatCurrency(c.avgRate)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">{formatCurrency(c.maxRate)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{formatCurrency(c.totalExGst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-transparent bg-white/95 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-base font-bold text-slate-900">PO line details</h2>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>Rows</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2"
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
            ) : loading ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">Loading report…</div>
            ) : rows.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No PO lines match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 font-semibold">PO No.</th>
                      <th className="px-3 py-3 font-semibold">PO date</th>
                      <th className="px-3 py-3 font-semibold">Vendor</th>
                      <th className="px-3 py-3 font-semibold">Item</th>
                      <th className="px-3 py-3 font-semibold">Category</th>
                      <th className="px-3 py-3 font-semibold text-right">Qty</th>
                      <th className="px-3 py-3 font-semibold">UOM</th>
                      <th className="px-3 py-3 font-semibold text-right">Unit rate</th>
                      <th className="px-3 py-3 font-semibold text-right">Tax</th>
                      <th className="px-3 py-3 font-semibold text-right">Line total</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Compare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.lineId} className="border-t border-slate-100 hover:bg-[#F8FBFF]">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-semibold text-[#1565C0]">
                          {row.poNumber}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{row.poDate}</td>
                        <td className="px-3 py-2.5 text-slate-800">{row.vendorName}</td>
                        <td className="px-3 py-2.5 text-slate-800">
                          <div className="font-medium">{row.itemName}</div>
                          {row.description ? (
                            <div className="mt-0.5 max-w-[240px] truncate text-xs text-slate-400">
                              {row.description}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">{row.category}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatQty(row.quantity)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.uom}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {formatCurrency(row.unitRate)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                          {row.taxPercentage}% · {formatCurrency(row.taxAmount)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                          {formatCurrency(row.lineTotal)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setItem(row.itemName);
                              setCompareItem(row.itemName);
                              setPage(1);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E88E5] hover:underline"
                            title="Compare vendors for this item"
                          >
                            <i className="ri-bar-chart-box-line" />
                            Compare
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
