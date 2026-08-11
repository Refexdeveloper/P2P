import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi } from '../../../services/api';
import POExpandedRow, { AcceptancePo } from './components/POExpandedRow';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

type AcceptanceStatus = 'pending' | 'accepted' | 'rejected' | 'partial' | null;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const StatusBadge = ({ status }: { status?: string | null }) => {
  const key = status || 'pending';
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    partial: 'bg-violet-100 text-violet-700 border-violet-200',
  };
  const label: Record<string, string> = {
    pending: 'Pending Acceptance',
    accepted: 'Accepted',
    rejected: 'Rejected',
    partial: 'Partially Accepted',
  };
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${
        map[key] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {label[key] || status}
    </span>
  );
};

export default function VendorPOAcceptancePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AcceptancePo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [manualFor, setManualFor] = useState<AcceptancePo | null>(null);
  const [manualAction, setManualAction] = useState<'accept' | 'reject' | 'partial'>('accept');
  const [remarks, setRemarks] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poApi.listVendorAcceptance();
      setRows((res.data as AcceptancePo[]) || []);
    } catch (err) {
      setRows([]);
      showToast(err instanceof Error ? err.message : 'Failed to load POs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (filter !== 'all') {
      list = list.filter((r) => (r.vendorAcceptanceStatus || 'pending') === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.poNumber?.toLowerCase().includes(q) ||
          r.vendorName?.toLowerCase().includes(q) ||
          r.prNumber?.toLowerCase().includes(q) ||
          r.prTitle?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, search]);

  const stats = useMemo(
    () => ({
      pending: rows.filter((r) => (r.vendorAcceptanceStatus || 'pending') === 'pending').length,
      accepted: rows.filter((r) => r.vendorAcceptanceStatus === 'accepted').length,
      rejected: rows.filter((r) => r.vendorAcceptanceStatus === 'rejected').length,
      total: rows.length,
    }),
    [rows]
  );

  const handleSendMail = async (po: AcceptancePo) => {
    setBusyId(po.id);
    try {
      const res = await poApi.sendVendorAcceptanceMail(po.id);
      showToast(res.message || `Mail sent to ${po.vendorEmail}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send mail', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const openManual = (po: AcceptancePo) => {
    setManualFor(po);
    setManualAction('accept');
    setRemarks('');
    setDeliveryDate('');
    setFile(null);
  };

  const viewPdf = async (poId: number) => {
    try {
      const blob = await poApi.downloadPdf(poId);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open PDF', 'error');
    }
  };

  const submitManual = async () => {
    if (!manualFor) return;
    if (!remarks.trim()) {
      showToast('Remarks are required', 'error');
      return;
    }
    if (manualAction !== 'reject' && !file) {
      showToast('Upload vendor acceptance / signed document', 'error');
      return;
    }
    setBusyId(manualFor.id);
    try {
      const fileData = file ? await fileToBase64(file) : undefined;
      const res = await poApi.submitManualVendorAcceptance(manualFor.id, {
        action: manualAction,
        remarks: remarks.trim(),
        deliveryDate: deliveryDate || undefined,
        fileName: file?.name,
        fileData,
      });
      setManualFor(null);
      await load();
      if (manualAction === 'accept' || manualAction === 'partial') {
        // Prepare GRN basic data on GRN page (awaiting row) — do NOT open GRN popup here.
        // User opens enter-fields popup later via Mark as Received on GRN.
        showToast(
          res.message || 'Vendor acceptance saved. GRN is ready — open GRN and click Mark as Received.',
          'success'
        );
      } else {
        showToast(res.message || 'Saved', 'success');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor PO Acceptance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Expand a row for full details. After accept → next step is GRN.
        </p>
      </div>

      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'pending', label: 'Pending', value: stats.pending },
          { key: 'accepted', label: 'Accepted', value: stats.accepted },
          { key: 'rejected', label: 'Rejected', value: stats.rejected },
          { key: 'all', label: 'Total', value: stats.total },
        ].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key as typeof filter)}
            className={`bg-white border rounded-xl p-4 text-left ${
              filter === c.key ? 'ring-2 ring-teal-500/30 border-teal-200' : 'border-gray-200'
            }`}
          >
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Purchase orders</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, vendor, PR..."
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {loading ? (
          <p className="p-8 text-sm text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-8 text-sm text-gray-400 text-center">
            No POs in this queue. Final-verify a PO first, then it appears here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['', 'PO Number', 'Vendor', 'PR', 'Amount', 'Mode', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h || 'expand'}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((po) => {
                  const pending = (po.vendorAcceptanceStatus || 'pending') === 'pending';
                  const accepted =
                    po.vendorAcceptanceStatus === 'accepted' || po.vendorAcceptanceStatus === 'partial';
                  const isExpanded = expandedId === po.id;
                  return (
                    <Fragment key={po.id}>
                      <tr
                        className={`border-b hover:bg-gray-50 cursor-pointer ${
                          isExpanded ? 'bg-teal-50/60' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : po.id)}
                      >
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600"
                            aria-expanded={isExpanded}
                          >
                            <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line`}></i>
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-teal-700">{po.poNumber}</p>
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <p className="font-medium text-gray-900">{po.vendorName}</p>
                          <p className="text-xs text-gray-500">{po.vendorEmail}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-700">
                          <p>{po.prNumber || '—'}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[180px]">{po.prTitle}</p>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold">
                          {formatCurrency(Number(po.grandTotal) || 0)}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 capitalize">
                          {po.vendorAcceptanceMode || '—'}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={(po.vendorAcceptanceStatus as AcceptanceStatus) || 'pending'} />
                        </td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          {pending ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busyId === po.id}
                                onClick={() => handleSendMail(po)}
                                className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                              >
                                {busyId === po.id ? 'Sending…' : 'Send Mail'}
                              </button>
                              <button
                                type="button"
                                onClick={() => openManual(po)}
                                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50"
                              >
                                Manual Entry
                              </button>
                            </div>
                          ) : accepted ? (
                            <button
                              type="button"
                              onClick={() => navigate('/grn')}
                              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg"
                            >
                              Go to GRN
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500">Completed</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <POExpandedRow
                          po={po}
                          busy={busyId === po.id}
                          onSendMail={() => handleSendMail(po)}
                          onManual={() => openManual(po)}
                          onViewPdf={() => viewPdf(po.id)}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {manualFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900">Manual vendor acceptance</h3>
            <p className="text-sm text-gray-500 mt-1">
              {manualFor.poNumber} — {manualFor.vendorName}
            </p>

            <div className="mt-4 flex gap-2">
              {(['accept', 'partial', 'reject'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setManualAction(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                    manualAction === a
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>

            <label className="block mt-4 text-xs font-semibold text-gray-600 mb-1">Remarks *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder="Vendor confirmation notes…"
            />

            {manualAction !== 'reject' && (
              <>
                <label className="block mt-3 text-xs font-semibold text-gray-600 mb-1">
                  Confirmed delivery date
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <label className="block mt-3 text-xs font-semibold text-gray-600 mb-1">
                  Upload acceptance / signed document *
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualFor(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === manualFor.id}
                onClick={submitManual}
                className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg disabled:opacity-50"
              >
                Save &amp; continue
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
