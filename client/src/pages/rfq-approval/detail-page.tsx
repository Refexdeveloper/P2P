import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../components/feature/DashboardLayout';
import VendorComparisonMatrix from '../../components/rfq/VendorComparisonMatrix';
import PostRfqApprovalModal from './components/PostRfqApprovalModal';
import { rfqApi, VendorComparisonData } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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

    if (!data.canApprove) {
      showToast('You cannot approve this RFQ at the current stage');
      setSearchParams({}, { replace: true });
      return;
    }

    setModal({ open: true, action: modalAction });
    setSearchParams({}, { replace: true });
  }, [loading, data, searchParams, setSearchParams, showToast]);

  const handleApprove = async (remarks: string) => {
    const actionMap = { approve: 'approve' as const, reject: 'reject' as const, rework: 'return' as const };
    await rfqApi.postApprove(Number(prId), actionMap[modal.action], remarks);
    showToast(`RFQ ${modal.action} completed successfully`);
    if (modal.action === 'approve' && (user?.role === 'SCM Buyer' || data?.stageLabel === 'SCM PO Create')) {
      navigate(`/scm/create-po?prId=${prId}`);
    } else {
      // Manager / HOD L1 usually works from My Tasks
      navigate('/tasks');
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
      setFilePreview({ url: URL.createObjectURL(blob), fileName });
    } catch {
      showToast(`Failed to preview ${fileName}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-gray-500">Loading vendor comparison...</p>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error || 'Not found'}</div>
        <Link to="/rfq-approval" className="text-teal-600 text-sm mt-4 inline-block">← Back to queue</Link>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/rfq-approval" className="text-sm text-teal-600 hover:text-teal-800 mb-2 inline-flex items-center gap-1">
            <i className="ri-arrow-left-line"></i> Back to queue
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{data.pr.prNumber} — {data.pr.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-semibold text-xs">
              {data.stageLabel || data.pr.statusUI}
            </span>
            <span>Requester stage complete · {data.vendorCount} vendors quoted</span>
            {data.recommendedVendorName && (
              <span className="text-emerald-700 font-medium">⭐ Recommended: {data.recommendedVendorName}</span>
            )}
          </div>
        </div>

        {data.canApprove && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModal({ open: true, action: 'approve' })}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-check-line"></i>
              {user?.role === 'SCM Buyer' ? 'Approve & Create PO' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => setModal({ open: true, action: 'rework' })}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-arrow-go-back-line"></i> Send Back
            </button>
            <button
              type="button"
              onClick={() => setModal({ open: true, action: 'reject' })}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-close-line"></i> Reject
            </button>
          </div>
        )}
      </div>

      {data.canApprove && user?.role === 'SCM Buyer' && (
        <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm text-teal-800">
          <i className="ri-information-line mr-1"></i>
          After approval you will be redirected to <strong>Create PO</strong> for this purchase request.
        </div>
      )}

      {!data.showFullNegotiation && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <i className="ri-information-line mr-1"></i>
          Summary view for Manager Approval. SCM Buyer handles PO creation after manager approval.
        </div>
      )}

      <VendorComparisonMatrix data={data} onPreviewFile={handlePreviewFile} />

      {data.pr.approvalHistory?.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">Approval History</h3>
          <div className="space-y-3">
            {data.pr.approvalHistory.map((h, i) => (
              <div key={i} className="flex gap-4 text-sm border-b border-gray-100 pb-3">
                <div className="w-32 font-medium text-gray-700">{h.stage}</div>
                <div className="flex-1">
                  <span className="font-semibold">{h.user}</span>
                  <span className="text-gray-500"> · {h.role}</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                    h.status === 'Approve' ? 'bg-emerald-100 text-emerald-700' :
                    h.status === 'Reject' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                  }`}>{h.status}</span>
                  {h.remarks && <p className="text-gray-600 mt-1">{h.remarks}</p>}
                </div>
                <div className="text-gray-400 text-xs">{h.date}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <PostRfqApprovalModal
        isOpen={modal.open}
        action={modal.action}
        prNumber={data.pr.prNumber}
        title={data.pr.title}
        stageLabel={data.stageLabel || user?.role || 'Approval'}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onConfirm={handleApprove}
      />

      {filePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <span className="font-semibold text-gray-900">{filePreview.fileName}</span>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(filePreview.url);
                  setFilePreview(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              {/\.pdf$/i.test(filePreview.fileName) ? (
                <iframe title="Quotation preview" src={filePreview.url} className="w-full h-[70vh] border border-gray-200 rounded-lg" />
              ) : (
                <img src={filePreview.url} alt={filePreview.fileName} className="max-h-[70vh] mx-auto rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
