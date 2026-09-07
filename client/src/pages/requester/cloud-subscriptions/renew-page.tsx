import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { cloudSubscriptionApi } from '../../../services/api';

type Subscription = {
  id: number;
  subscriptionNumber: string;
  purchaseRequestId: number;
  vendorName: string;
  cloudProvider: string;
  subscriptionPlan: string;
  subscriptionType: string;
  billingFrequency: string;
  startDate: string;
  expiryDate: string;
  status: string;
  renewalStatus: string;
  renewalNumber: number;
  title: string;
  nextReminder?: string | null;
  canRenew?: boolean;
};

type HistoryRow = {
  renewal: string;
  renewalNumber: number;
  period: string;
  status: string;
  approval: string;
};

export default function RenewCloudSubscriptionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const subscriptionId = Number(id);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [detail, hist] = await Promise.all([
          cloudSubscriptionApi.get(subscriptionId),
          cloudSubscriptionApi.history(subscriptionId),
        ]);
        if (cancelled) return;
        setSub((detail.data as Subscription) || null);
        setHistory(((hist.data as { history?: HistoryRow[] })?.history || []) as HistoryRow[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load subscription');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  const continueRenewal = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await cloudSubscriptionApi.renew(subscriptionId);
      setMessage(res.message || 'Renewal request submitted to L1 Manager');
      setConfirming(false);
      setTimeout(() => navigate('/requester/track-pr'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Renewal failed');
    } finally {
      setSubmitting(false);
    }
  };

  const freqLabel = String(sub?.billingFrequency || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/requester/track-pr" className="text-sm text-teal-700 font-medium hover:underline">
            ← Back to Track PR
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Renew Cloud Subscription</h1>
          <p className="text-sm text-gray-500 mt-1">
            Creates a Renewal Request linked to the original Purchase Request — not a new PR.
          </p>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading subscription…</p>}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {message}
          </div>
        )}

        {sub && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Subscription details</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Original Purchase Request</p>
                  <p className="font-medium">PR #{sub.purchaseRequestId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Subscription ID</p>
                  <p className="font-medium">{sub.subscriptionNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Vendor</p>
                  <p className="font-medium">{sub.vendorName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Cloud Provider</p>
                  <p className="font-medium">{sub.cloudProvider || sub.vendorName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Subscription Plan</p>
                  <p className="font-medium">{sub.subscriptionPlan || sub.title || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Current Frequency</p>
                  <p className="font-medium">{freqLabel || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Current Start Date</p>
                  <p className="font-medium">{sub.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Current Expiry Date</p>
                  <p className="font-medium">{sub.expiryDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Renewal Number</p>
                  <p className="font-medium">{sub.renewalNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Status</p>
                  <p className="font-medium">{sub.status}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-400">New Subscription Period</p>
                  <p className="font-medium text-teal-800">
                    Continues from current expiry for one {freqLabel.toLowerCase() || 'billing'} period
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Renewal History</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="py-2 pr-3">Renewal</th>
                      <th className="py-2 pr-3">Period</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Approval</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row, idx) => (
                      <tr key={`${row.renewal}-${idx}`} className="border-b border-gray-50">
                        <td className="py-2 pr-3 font-medium">{row.renewal}</td>
                        <td className="py-2 pr-3">{row.period}</td>
                        <td className="py-2 pr-3">{row.status}</td>
                        <td className="py-2">{row.approval}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {sub.status === 'RENEWAL_PENDING' || sub.renewalStatus === 'PENDING' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                L1 Approval Pending — another renewal cannot be started.
              </div>
            ) : sub.canRenew ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/requester/track-pr')}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold"
                >
                  Renew Subscription
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Renewal is not available for the current subscription status.</p>
            )}
          </div>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
            <h3 className="text-lg font-bold text-gray-900">Do you want to renew this Cloud Subscription?</h3>
            <p className="text-sm text-gray-600 mt-2">
              This creates a Renewal Request and sends it directly to your L1 Manager. No new Purchase Request
              will be created.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirming(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void continueRenewal()}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Continue Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
