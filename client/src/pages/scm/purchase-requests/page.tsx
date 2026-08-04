import { useState, useMemo, useEffect, useCallback, Fragment, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { prApi, poApi } from '../../../services/api';
import PRBucketExpandedRow from './components/PRBucketExpandedRow';
import {
  downloadPoImportSampleCsv,
  parsePoImportCsv,
  storePoCsvImport,
} from '../../../utils/poCsvImport';

type RowStatus = 'Ready for PO' | 'Pending Approval' | 'PO Approved' | 'PO Rejected';

interface BucketRow {
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

export default function SCMPurchaseRequestsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BucketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'created' | 'approved' | 'rejected'>('all');
  const [expandedPrId, setExpandedPrId] = useState<number | null>(null);
  const [importTarget, setImportTarget] = useState<BucketRow | null>(null);
  const [importTab, setImportTab] = useState<'reference' | 'csv'>('csv');
  const [importPoNumber, setImportPoNumber] = useState('');
  const [importError, setImportError] = useState('');
  const [importChecking, setImportChecking] = useState(false);
  const csvFileRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (prId: number) => {
    setExpandedPrId((prev) => (prev === prId ? null : prId));
  };

  const openCreatePo = (prId: number, opts?: { refPo?: string; fromCsv?: boolean }) => {
    const qs = new URLSearchParams({ prId: String(prId), mode: opts?.fromCsv ? 'import' : 'manual' });
    if (opts?.refPo?.trim()) {
      qs.set('refPo', opts.refPo.trim());
      qs.set('mode', 'import');
    }
    if (opts?.fromCsv) qs.set('from', 'csv');
    navigate(`/scm/create-po?${qs.toString()}`);
  };

  const openImportModal = (row?: BucketRow) => {
    const ready = rows.filter((r) => r.status === 'Ready for PO');
    const target = row || ready[0] || null;
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

  const readyForPoRows = useMemo(
    () => rows.filter((r) => r.status === 'Ready for PO'),
    [rows]
  );

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
      const prId = importTarget.prId;
      setImportTarget(null);
      openCreatePo(prId, { fromCsv: true });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setImportChecking(false);
      if (csvFileRef.current) csvFileRef.current.value = '';
    }
  };

  const load = useCallback(async () => {
    try {
      const [prRes, poRes] = await Promise.all([prApi.listScmBucket(), poApi.list()]);
      const prs = prRes.data as Array<Record<string, unknown>>;
      const pos = poRes.data as Array<Record<string, unknown>>;

      const poByPr = new Map<number, { poNumber: string; poId: number; status: string }>();
      for (const po of pos) {
        poByPr.set(Number(po.prId), {
          poNumber: String(po.poNumber),
          poId: Number(po.id),
          status: String(po.statusRaw || po.status),
        });
      }

      const merged: BucketRow[] = prs.map((p) => {
        const prId = Number(p.id);
        const po = poByPr.get(prId);
        let status: RowStatus = 'Ready for PO';
        if (po) {
          if (po.status === 'rejected') status = 'PO Rejected';
          else if (po.status === 'sent_to_vendor' || po.status === 'approved') status = 'PO Approved';
          else status = 'Pending Approval';
        } else if (p.status === 'PENDING_SCM_PO' || p.statusUI === 'Pending SCM PO') {
          status = 'Ready for PO';
        }

        return {
          prId,
          prNumber: String(p.prNumber),
          poNumber: po?.poNumber || null,
          poId: po?.poId || null,
          title: String(p.title),
          department: String(p.department),
          requester: String(p.requester),
          amount: Number(p.totalAmount),
          recommendedVendor: '',
          requiredDate: String(p.requiredDate || ''),
          status,
        };
      });

      for (const po of pos) {
        if (!merged.some((r) => r.prId === Number(po.prId))) {
          const st = String(po.statusRaw || po.status);
          merged.push({
            prId: Number(po.prId),
            prNumber: String(po.prNumber),
            poNumber: String(po.poNumber),
            poId: Number(po.id),
            title: String(po.prTitle || ''),
            department: String(po.department || ''),
            requester: String(po.requester || ''),
            amount: Number(po.grandTotal || 0),
            recommendedVendor: String(po.vendorName || ''),
            requiredDate: String(po.expectedDeliveryDate || ''),
            status: st === 'rejected' ? 'PO Rejected' : st === 'pending_approval' ? 'Pending Approval' : 'PO Approved',
          });
        }
      }

      setRows(merged);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => ({
    total: rows.length,
    readyForPO: rows.filter((r) => r.status === 'Ready for PO').length,
    pendingApproval: rows.filter((r) => r.status === 'Pending Approval').length,
    poApproved: rows.filter((r) => r.status === 'PO Approved').length,
    poRejected: rows.filter((r) => r.status === 'PO Rejected').length,
  }), [rows]);

  const filteredPRs = useMemo(() => {
    let filtered = rows;
    if (statusFilter === 'ready') filtered = filtered.filter((r) => r.status === 'Ready for PO');
    else if (statusFilter === 'created') filtered = filtered.filter((r) => r.status === 'Pending Approval');
    else if (statusFilter === 'approved') filtered = filtered.filter((r) => r.status === 'PO Approved');
    else if (statusFilter === 'rejected') filtered = filtered.filter((r) => r.status === 'PO Rejected');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.prNumber.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.poNumber && r.poNumber.toLowerCase().includes(q)) ||
          r.department.toLowerCase().includes(q) ||
          r.requester.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [rows, searchQuery, statusFilter]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

  const getStatusColor = (status: RowStatus) => {
    switch (status) {
      case 'Ready for PO': return 'bg-emerald-100 text-emerald-700';
      case 'Pending Approval': return 'bg-amber-100 text-amber-700';
      case 'PO Approved': return 'bg-blue-100 text-blue-700';
      case 'PO Rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Requests</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create PO from ready PRs, or import details from an existing reference PO
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

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-5 gap-4 mb-5">
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
            {([
              ['all', `All (${stats.total})`],
              ['ready', `Ready (${stats.readyForPO})`],
              ['created', `Pending (${stats.pendingApproval})`],
              ['approved', `Approved (${stats.poApproved})`],
              ['rejected', `Rejected (${stats.poRejected})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${statusFilter === key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        {loading ? (
          <p className="p-8 text-sm text-gray-500">Loading...</p>
        ) : (
          <table className="w-full min-w-[1100px] table-fixed">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-3 w-12"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">PR Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">PO Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[140px]">Department</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[140px]">Requester</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[110px]">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-[130px]">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-[120px] sticky right-0 bg-gray-50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPRs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm text-gray-500">
                    No purchase requests found
                  </td>
                </tr>
              ) : (
                filteredPRs.map((pr) => {
                  const isExpanded = expandedPrId === pr.prId;
                  return (
                    <Fragment key={pr.prId}>
                      <tr className="border-b hover:bg-gray-50 group">
                        <td className="px-3 py-4 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleExpand(pr.prId)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-white text-gray-600"
                          >
                            <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-lg`}></i>
                          </button>
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(pr.prId)}
                            className="font-semibold text-teal-600 hover:text-teal-800 cursor-pointer"
                          >
                            {pr.prNumber}
                          </button>
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap text-gray-700 truncate" title={pr.poNumber || undefined}>
                          {pr.poNumber || '—'}
                        </td>
                        <td className="px-4 py-4 align-middle text-gray-900 font-medium truncate" title={pr.title}>
                          {pr.title}
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap text-gray-700 truncate" title={pr.department}>
                          {pr.department}
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap text-gray-700 truncate" title={pr.requester}>
                          {pr.requester}
                        </td>
                        <td className="px-4 py-4 align-middle whitespace-nowrap text-right font-semibold text-gray-900">
                          {formatCurrency(pr.amount)}
                        </td>
                        <td className="px-4 py-4 align-middle">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(pr.status)}`}>
                            {pr.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 align-middle sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center justify-end gap-2">
                            {pr.status === 'Ready for PO' && (
                              <button
                                type="button"
                                onClick={() => openCreatePo(pr.prId)}
                                className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold whitespace-nowrap"
                              >
                                Create PO
                              </button>
                            )}
                            {pr.poId && (
                              <button
                                type="button"
                                onClick={() => navigate(`/scm/po-pdf-view?poId=${pr.poId}`)}
                                className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 whitespace-nowrap"
                              >
                                View PDF
                              </button>
                            )}
                            {pr.status !== 'Ready for PO' && !pr.poId && (
                              <button
                                type="button"
                                onClick={() => navigate(`/scm/rfq-entry/${pr.prId}`)}
                                className="px-3 py-1.5 border border-amber-300 text-amber-700 rounded-md text-xs font-medium hover:bg-amber-50 whitespace-nowrap"
                              >
                                RFQ
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
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
                const next = readyForPoRows.find((r) => r.prId === Number(e.target.value));
                if (next) setImportTarget(next);
              }}
              className="w-full mb-4 px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              {readyForPoRows.map((r) => (
                <option key={r.prId} value={r.prId}>
                  {r.prNumber} — {r.title}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-4">
              <button
                type="button"
                onClick={() => { setImportTab('csv'); setImportError(''); }}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold ${importTab === 'csv' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600'}`}
              >
                CSV Import
              </button>
              <button
                type="button"
                onClick={() => { setImportTab('reference'); setImportError(''); }}
                className={`flex-1 px-3 py-2.5 text-sm font-semibold border-l border-gray-200 ${importTab === 'reference' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600'}`}
              >
                Reference PO
              </button>
            </div>

            {importTab === 'csv' ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/60">
                  <p className="text-sm font-semibold text-violet-900 mb-1">1. Download sample CSV</p>
                  <p className="text-xs text-violet-700 mb-3">
                    Use this template, fill your PO line items, then upload in step 2.
                  </p>
                  <button
                    type="button"
                    onClick={downloadPoImportSampleCsv}
                    className="w-full px-4 py-3 bg-white border border-violet-300 text-violet-800 rounded-lg text-sm font-bold hover:bg-violet-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <i className="ri-file-excel-2-line text-lg"></i>
                    Download Sample CSV
                  </button>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <p className="text-sm font-semibold text-gray-900 mb-1">2. Upload filled CSV</p>
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
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-600 font-mono break-all">
                  Columns: description, quantity, unitPrice, category, deliveryAddress, expectedDeliveryDate, paymentTerms, incoterms, gstPercentage, specialInstructions
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
                <i className="ri-edit-line"></i>
                Manual Create PO instead
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
