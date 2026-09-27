import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import SoftInsightCard, { type InsightThemeName } from '../../../components/base/SoftInsightCard';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
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
  const location = useLocation();
  const isRequesterView = location.pathname.startsWith('/requester/');
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
  const [sendMailFor, setSendMailFor] = useState<AcceptancePo | null>(null);
  const [sendMailComments, setSendMailComments] = useState('');

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

  const openSendMail = (po: AcceptancePo) => {
    setSendMailFor(po);
    setSendMailComments('');
  };

  const handleSendMail = async () => {
    if (!sendMailFor) return;
    setBusyId(sendMailFor.id);
    try {
      const res = await poApi.sendVendorAcceptanceMail(sendMailFor.id, {
        comments: sendMailComments.trim() || undefined,
      });
      setSendMailFor(null);
      setSendMailComments('');
      showToast(res.message || 'Mail sent to requester to upload Vendor Signed PO', 'success');
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
        const isWo = manualFor.purchaseType === 'work_order';
        showToast(
          res.message ||
            (isWo
              ? 'Vendor acceptance saved — upload vendor invoice next.'
              : 'Vendor acceptance saved — invoice proceeds to Accounts verification.'),
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
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="space-y-4 p-2 pb-6 sm:p-4 lg:p-6">
          <header className="border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-0 sm:pb-4">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">
              Vendor PO Acceptance
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
              {isRequesterView
                ? 'Record vendor acceptance after GRN and invoice upload (Work Orders appear right after final verify).'
                : 'POs awaiting vendor acceptance — send mail to requester to upload Vendor Signed PO, or record manual acceptance.'}
            </p>
          </header>

          {toast && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                toast.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {toast.text}
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {(
              [
                { key: 'pending', label: 'Pending', value: stats.pending, icon: 'ri-time-line', theme: 'cyan' },
                { key: 'accepted', label: 'Accepted', value: stats.accepted, icon: 'ri-checkbox-circle-line', theme: 'green' },
                { key: 'rejected', label: 'Rejected', value: stats.rejected, icon: 'ri-close-circle-line', theme: 'rose' },
                { key: 'all', label: 'Total', value: stats.total, icon: 'ri-file-list-3-line', theme: 'blue' },
              ] as const
            ).map((c) => (
              <SoftInsightCard
                key={c.key}
                title={c.label}
                value={c.value}
                icon={c.icon}
                theme={c.theme as InsightThemeName}
                selected={filter === c.key}
                onClick={() => setFilter(c.key as typeof filter)}
              />
            ))}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
              }}
            />
            <div className="relative z-[1]">
              <div className="relative min-w-[220px] max-w-md">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search PO, vendor, PR..."
                  className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-x-clip rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)',
              }}
            />
            {loading ? (
              <p className="relative z-[1] p-8 text-sm text-slate-500">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="relative z-[1] p-8 text-center text-sm text-slate-400">
                No POs in this queue. Purchase Orders appear after GRN and invoice upload; Work Orders after final verify.
              </p>
            ) : (
              <div className="relative z-[1] overflow-x-auto px-0 pb-3 pt-1">
                <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PO Number
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Vendor
                      </th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PR
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Amount
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Mode
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Status
                      </th>
                      <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((po) => {
                      const pending = (po.vendorAcceptanceStatus || 'pending') === 'pending';
                      const accepted =
                        po.vendorAcceptanceStatus === 'accepted' || po.vendorAcceptanceStatus === 'partial';
                      const isExpanded = expandedId === po.id;
                      const rowBorder = isExpanded
                        ? 'border-[#90CAF9]'
                        : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = isExpanded
                        ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                        : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                      return (
                        <Fragment key={po.id}>
                          <tr className="group cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : po.id)}>
                            <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                              <div className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button
                                  type="button"
                                  className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                    isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                  }`}
                                  aria-expanded={isExpanded}
                                  aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                                >
                                  <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                                <span className="text-sm font-bold text-[#1E88E5]">{po.poNumber}</span>
                              </div>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5 ${rowBorder}`}>
                              <p className="text-sm font-semibold text-[#2C3E50]">{po.vendorName || '—'}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{po.vendorEmail || '—'}</p>
                            </td>
                            <td className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5 ${rowBorder}`} title={po.prTitle}>
                              <p className="truncate text-sm font-semibold text-[#2C3E50]">{po.prNumber || '—'}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{po.prTitle || '—'}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right align-middle text-sm font-bold tabular-nums text-[#2C3E50] transition-[border-color] sm:py-5 ${rowBorder}`}>
                              {formatCurrency(Number(po.grandTotal) || 0)}
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm capitalize text-slate-600 transition-[border-color] sm:py-5 ${rowBorder}`}>
                              {po.vendorAcceptanceMode || '—'}
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5 ${rowBorder}`}>
                              <StatusBadge status={(po.vendorAcceptanceStatus as AcceptanceStatus) || 'pending'} />
                              {!pending && po.vendorAcceptanceFileName ? (
                                <p className="mt-1 max-w-[140px] truncate text-[10px] text-[#1565C0]" title={po.vendorAcceptanceFileName}>
                                  <i className="ri-attachment-2"></i> {po.vendorAcceptanceFileName}
                                </p>
                              ) : null}
                            </td>
                            <td
                              className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                {pending ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busyId === po.id}
                                      onClick={() => openSendMail(po)}
                                      title="Email requester to upload Vendor Signed PO"
                                      className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-50"
                                    >
                                      {busyId === po.id ? 'Sending…' : 'Send Mail'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openManual(po)}
                                      className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                    >
                                      Manual Entry
                                    </button>
                                  </>
                                ) : accepted ? (
                                  po.purchaseType === 'work_order' ? (
                                    <button
                                      type="button"
                                      onClick={() => navigate('/requester/vendor-invoice')}
                                      className="cursor-pointer whitespace-nowrap rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                                    >
                                      Upload invoice
                                    </button>
                                  ) : (
                                    <span className="text-xs font-semibold text-emerald-700">Accepted</span>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-500">Completed</span>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <POExpandedRow
                              po={po}
                              busy={busyId === po.id}
                              onSendMail={() => openSendMail(po)}
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
        </div>
      </div>

      {sendMailFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900">Send mail to requester</h3>
            <p className="text-sm text-gray-500 mt-1">
              {sendMailFor.poNumber} — ask requester to upload Vendor Signed PO
            </p>
            <p className="text-xs text-gray-500 mt-2">
              To: Requester · CC: L1 Manager, SCM Manager, user approvers (if any)
            </p>

            <label className="block mt-4 text-xs font-semibold text-gray-600 mb-1">
              SCM team comments (included in mail)
            </label>
            <textarea
              value={sendMailComments}
              onChange={(e) => setSendMailComments(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20"
              placeholder="Add instructions or notes for the requester…"
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSendMailFor(null);
                  setSendMailComments('');
                }}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === sendMailFor.id}
                onClick={() => void handleSendMail()}
                className="px-4 py-2 text-sm font-semibold bg-[#1E88E5] text-white rounded-lg disabled:opacity-50"
              >
                {busyId === sendMailFor.id ? 'Sending…' : 'Send Mail'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      ? 'bg-[#1E88E5] text-white'
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
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20"
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
                className="px-4 py-2 text-sm font-semibold bg-[#1E88E5] text-white rounded-lg disabled:opacity-50"
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
