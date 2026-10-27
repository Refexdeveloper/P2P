import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import VendorComparisonMatrix from '../../components/rfq/VendorComparisonMatrix';
import ManagerRfqQuoteSummary from '../../components/rfq/ManagerRfqQuoteSummary';
import PostRfqApprovalModal from './components/PostRfqApprovalModal';
import { rfqApi, VendorComparisonData } from '../../services/api';
import PrDocumentsPanel from '../../components/feature/PrDocumentsPanel';
import { useAuth } from '../../contexts/AuthContext';
import { isL1OrL2Manager } from '../../utils/roleDisplay';
import '../../styles/dashboard-fx.css';
import '../../styles/drawer-fx.css';

export default function RfqApprovalDetailPage() {
  const { prId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const deepLinkHandled = useRef(false);
  const pendingDeepLinkAction = useRef<string | null>(null);

  const [data, setData] = useState<VendorComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<{ open: boolean; action: 'approve' | 'reject' | 'rework' }>({
    open: false,
    action: 'approve',
  });
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const load = useCallback(async () => {
    if (!prId) return;
    setLoading(true);
    try {
      const res = await rfqApi.getComparison(Number(prId));
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [prId]);

  const fromParam = searchParams.get('from');
  const backPath =
    fromParam === 'tasks' || fromParam === '/tasks'
      ? '/tasks'
      : fromParam === 'rfq-approval' || fromParam === '/rfq-approval'
        ? '/rfq-approval'
        : fromParam === 'scm-rfq' || fromParam === '/scm/rfq-entry'
          ? '/scm/rfq-entry'
          : user?.role === 'HOD Approver' || user?.role === 'PR Manager' || user?.role === 'CFO'
            ? '/tasks'
            : user?.role === 'SCM Buyer'
              ? '/scm/rfq-entry'
              : '/rfq-approval';
  const backLabel =
    backPath === '/tasks'
      ? 'Back to My Tasks'
      : backPath === '/scm/rfq-entry'
        ? 'Back to RFQ Entry'
        : 'Back to queue';

  useEffect(() => {
    deepLinkHandled.current = false;
    pendingDeepLinkAction.current = null;
    load();
  }, [load]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action) {
      pendingDeepLinkAction.current = action;
      deepLinkHandled.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || deepLinkHandled.current || !data) return;
    const action = pendingDeepLinkAction.current || searchParams.get('action');
    if (!action) return;
    const actionMap: Record<string, 'approve' | 'reject' | 'rework'> = {
      approve: 'approve',
      reject: 'reject',
      return: 'rework',
      rework: 'rework',
    };
    const modalAction = actionMap[action];
    if (!modalAction) return;

    deepLinkHandled.current = true;
    pendingDeepLinkAction.current = null;

    if (
      modalAction === 'approve' &&
      (user?.role === 'SCM Buyer' || data.stageLabel === 'SCM PO Create')
    ) {
      const from = searchParams.get('from');
      setSearchParams({}, { replace: true });
      navigate(`/scm/create-po?prId=${prId}${from ? `&from=${encodeURIComponent(from)}` : ''}`);
      return;
    }

    if (!data.canApprove) {
      showToast('You cannot approve this RFQ at the current stage');
      const from = searchParams.get('from');
      setSearchParams(from ? { from } : {}, { replace: true });
      return;
    }

    setModal({ open: true, action: modalAction });
    const from = searchParams.get('from');
    setSearchParams(from ? { from } : {}, { replace: true });
  }, [loading, data, searchParams, setSearchParams, showToast, user?.role, navigate, prId]);

  const handleApprove = async (
    remarks: string,
    options?: { goToBusinessApproval?: boolean; returnTo?: string }
  ) => {
    const isBuyerCreatePo =
      user?.role === 'SCM Buyer' || data?.stageLabel === 'SCM PO Create';

    if (modal.action === 'approve' && isBuyerCreatePo) {
      navigate(`/scm/create-po?prId=${prId}${fromParam ? `&from=${encodeURIComponent(fromParam)}` : ''}`);
      return;
    }

    const actionMap = { approve: 'approve' as const, reject: 'reject' as const, rework: 'return' as const };
    await rfqApi.postApprove(Number(prId), actionMap[modal.action], remarks, options);
    const branchMsg =
      modal.action === 'approve' && typeof options?.goToBusinessApproval === 'boolean'
        ? options.goToBusinessApproval
          ? ' — sent to L2 → CFO → SCM Final'
          : ' — sent to L2 → SCM Final (skip CFO)'
        : modal.action === 'rework' && options?.returnTo
          ? ` — sent back to ${options.returnTo === 'SCM_RFQ' ? 'SCM RFQ Entry' : 'selected stage'}`
          : '';
    showToast(
      modal.action === 'rework'
        ? `Send back completed${branchMsg}`
        : `RFQ ${modal.action} completed successfully${branchMsg}`
    );
    if (user?.role === 'SCM Manager' && backPath !== '/tasks') {
      navigate('/rfq-approval');
    } else if (user?.role === 'SCM Buyer' && backPath !== '/tasks') {
      navigate('/scm/rfq-entry');
    } else {
      navigate(backPath);
    }
  };

  const handlePreviewFile = async (submissionId: number, _vendorName: string, fileName: string) => {
    try {
      const token = localStorage.getItem('p2p_token');
      const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load file');
      const blob = await res.blob();
      const typed =
        /\.pdf$/i.test(fileName) && !blob.type.includes('pdf')
          ? new Blob([blob], { type: 'application/pdf' })
          : blob;
      setFilePreview({ url: URL.createObjectURL(typed), fileName });
    } catch {
      showToast(`Failed to preview ${fileName}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="tasks-fx min-h-full p-6">
          <div className="tfx-panel rounded-2xl border border-white/70 bg-white/95 p-8 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#0f6b7a] border-t-transparent" />
              Loading vendor comparison…
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="tasks-fx min-h-full p-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error || 'Not found'}
          </div>
          <Link
            to={backPath}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0f6b7a] hover:text-[#0b5361]"
          >
            <i className="ri-arrow-left-line" /> {backLabel}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const stageText = data.stageLabel || data.pr.statusUI || 'RFQ Approval';
  const entityLine = [data.pr.entityName, data.pr.entityCode ? `(${data.pr.entityCode})` : '']
    .filter(Boolean)
    .join(' ');
  const vendorMeta = data.vendorCount
    ? `Requester stage complete · ${data.vendorCount} vendors quoted`
    : data.pr.prFlow === 'functional'
      ? 'Functional Flow · awaiting SCM RFQ'
      : 'RFQ quotation';

  return (
    <DashboardLayout>
      <div className="tasks-fx dfx-root min-h-full font-sans text-[#0F172A]">
        {toast ? (
          <div className="fixed top-4 right-4 z-50 rounded-xl bg-[#0c9f68] px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        ) : null}

        <section className="tfx-hero tfx-hero--plain">
          <div className="tfx-bubbles" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="tfx-hero-content !pb-10 !pr-6">
            <Link
              to={backPath}
              className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0f6b7a] hover:text-[#0b5361]"
            >
              <i className="ri-arrow-left-line" /> {backLabel}
            </Link>
            <div className="tfx-hi">RFQ Approval</div>
            <h1 className="!text-[1.55rem] sm:!text-[1.9rem] md:!text-[2.1rem]">
              <span className="tfx-shimmer block sm:inline">{data.pr.prNumber}</span>
              <span className="hidden sm:inline"> — </span>
              <span className="mt-1 block text-[1.05rem] font-semibold leading-snug text-[#0e1726] sm:mt-0 sm:inline sm:text-[1.35rem] md:text-[1.55rem]">
                {data.pr.title}
              </span>
            </h1>
            <p className="max-w-3xl">{vendorMeta}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                {stageText}
              </span>
              {entityLine ? (
                <span className="inline-flex items-center rounded-full border border-[#c5e6eb] bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#0f6b7a]">
                  Entity: {entityLine}
                </span>
              ) : null}
              {data.pr.department ? (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  Department: {data.pr.department}
                </span>
              ) : null}
              {data.recommendedVendorName ? (
                <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-900">
                  <i className="ri-award-fill" aria-hidden />
                  Recommended: {data.recommendedVendorName}
                </span>
              ) : null}
              {String(data.recommendationJustification || '').trim() ? (
                <span
                  className="inline-flex max-w-full truncate rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-950 sm:max-w-md"
                  title={String(data.recommendationJustification)}
                >
                  Justify: {String(data.recommendationJustification).trim()}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <div className="relative z-[4] mx-auto max-w-6xl space-y-4 px-4 pb-10 pt-0 sm:px-6" style={{ marginTop: '-48px' }}>
          {String(data.sendBackRemarks || '').trim() ? (
            <div
              className="dfx-alert"
              style={{ '--i': 0 } as CSSProperties}
            >
              <span className="dfx-alert-ic">
                <i className="ri-arrow-go-back-line" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-wide text-orange-800">
                  Sent back to this step
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-orange-950">
                  {String(data.sendBackRemarks).trim()}
                </p>
              </div>
            </div>
          ) : null}

          {data.canApprove ? (
            <div
              className="tfx-panel flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:p-4"
              style={{ animation: 'tfx-fadeUp .55s cubic-bezier(.2,.8,.2,1) both' }}
            >
              <button
                type="button"
                onClick={() => setModal({ open: true, action: 'approve' })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0c9f68] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(12,159,104,.8)] transition hover:-translate-y-0.5 hover:bg-[#0a8a5a] sm:w-auto"
              >
                <i className="ri-check-line text-base" />
                {user?.role === 'SCM Buyer' ? 'Create PO' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => setModal({ open: true, action: 'rework' })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f2761c] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(242,118,28,.75)] transition hover:-translate-y-0.5 hover:bg-[#db6814] sm:w-auto"
              >
                <i className="ri-arrow-go-back-line text-base" />
                Send Back
              </button>
              <button
                type="button"
                onClick={() => setModal({ open: true, action: 'reject' })}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#ef3b4b] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-12px_rgba(239,59,75,.75)] transition hover:-translate-y-0.5 hover:bg-[#d92f3e] sm:w-auto"
              >
                <i className="ri-close-line text-base" />
                Reject
              </button>
            </div>
          ) : null}

          {data.canApprove && user?.role === 'SCM Buyer' ? (
            <div className="dfx-note" style={{ '--i': 1 } as CSSProperties}>
              <p className="dfx-label">
                <i className="ri-information-line mr-1" /> Next step
              </p>
              <p className="mt-2 text-sm text-slate-700">
                After approval you will be redirected to <strong>Create PO</strong> for this purchase request.
              </p>
            </div>
          ) : null}

          {Number(prId) > 0 ? (
            <div
              className="tfx-panel overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:p-5"
              style={{ animation: 'tfx-fadeUp .6s cubic-bezier(.2,.8,.2,1) .08s both' }}
            >
              <PrDocumentsPanel prId={Number(prId)} compact />
            </div>
          ) : null}

          {!data.vendors?.length &&
          data.pr.prFlow === 'standard' &&
          data.pr.status === 'PENDING_BUSINESS_APPROVAL' ? (
            <div className="space-y-4">
              <section
                className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                style={{ animation: 'tfx-fadeUp .6s cubic-bezier(.2,.8,.2,1) .12s both' }}
              >
                <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-100/80 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <i className="ri-lightbulb-flash-line" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
                      Business Justification
                    </p>
                    <p className="mt-0.5 text-xs text-amber-800/90">Requester rationale for this purchase</p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap px-4 py-3.5 text-sm font-medium leading-relaxed text-amber-950">
                  {data.pr.justification || 'No business justification provided.'}
                </p>
              </section>
              <div
                className="tfx-panel rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                style={{ animation: 'tfx-fadeUp .6s cubic-bezier(.2,.8,.2,1) .16s both' }}
              >
                <h3 className="mb-2 text-base font-bold text-slate-900">PR Details</h3>
                <p className="text-sm text-slate-600">{data.pr.title || 'Awaiting RFQ quotations.'}</p>
              </div>
            </div>
          ) : isL1OrL2Manager(user?.role) ? (
            <div style={{ animation: 'tfx-fadeUp .65s cubic-bezier(.2,.8,.2,1) .1s both' }}>
              <ManagerRfqQuoteSummary data={data} onPreviewFile={handlePreviewFile} />
            </div>
          ) : (
            <div style={{ animation: 'tfx-fadeUp .65s cubic-bezier(.2,.8,.2,1) .1s both' }}>
              <VendorComparisonMatrix data={data} onPreviewFile={handlePreviewFile} />
            </div>
          )}

          {data.pr.approvalHistory?.length > 0 ? (
            <div
              className="tfx-panel overflow-hidden rounded-2xl border border-white/70 bg-white/95 p-5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:p-6"
              style={{ animation: 'tfx-fadeUp .65s cubic-bezier(.2,.8,.2,1) .18s both' }}
            >
              <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e6f6f8] text-[#0f6b7a]">
                  <i className="ri-history-line" aria-hidden />
                </span>
                Approval History
              </h3>
              <ul className="dfx-timeline">
                {data.pr.approvalHistory.map((h, i) => {
                  const tone =
                    h.status === 'Approve'
                      ? 'tone-green'
                      : h.status === 'Reject'
                        ? 'tone-red'
                        : 'tone-orange';
                  return (
                    <li key={i} className={`dfx-tl-item ${tone}`} style={{ '--i': i } as CSSProperties}>
                      <span className="dfx-tl-dot">
                        <i
                          className={
                            h.status === 'Approve'
                              ? 'ri-check-line'
                              : h.status === 'Reject'
                                ? 'ri-close-line'
                                : 'ri-arrow-go-back-line'
                          }
                          aria-hidden
                        />
                      </span>
                      <div className="dfx-tl-card min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{h.stage}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">{h.user}</span>
                              {h.role ? ` · ${h.role}` : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                h.status === 'Approve'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : h.status === 'Reject'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {h.status}
                            </span>
                            <span className="text-[11px] text-slate-400">{h.date}</span>
                          </div>
                        </div>
                        {h.remarks ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{h.remarks}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>

        <PostRfqApprovalModal
          isOpen={modal.open}
          action={modal.action}
          prNumber={data.pr.prNumber}
          title={data.pr.title}
          stageLabel={data.stageLabel || user?.role || 'Approval'}
          prId={Number(prId)}
          askBusinessApproval={Boolean(data.askBusinessApproval)}
          useAdminTargets={Boolean(
            user?.isSuperAdmin ||
              user?.role === 'Super Admin' ||
              user?.role === 'SCM Manager' ||
              user?.role === 'SCM Buyer'
          )}
          onClose={() => setModal((m) => ({ ...m, open: false }))}
          onConfirm={handleApprove}
        />

        {filePreview ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <span className="truncate font-semibold text-slate-800">{filePreview.fileName}</span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(filePreview.url);
                    setFilePreview(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <i className="ri-close-line text-lg" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-[#F8FAFC] p-4">
                {/\.pdf$/i.test(filePreview.fileName) ? (
                  <iframe
                    title="Quotation preview"
                    src={filePreview.url}
                    className="h-[70vh] w-full rounded-xl border-0 bg-white"
                  />
                ) : (
                  <img
                    src={filePreview.url}
                    alt={filePreview.fileName}
                    className="mx-auto max-h-[70vh] rounded-xl object-contain"
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
