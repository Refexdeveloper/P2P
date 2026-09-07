import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloudSubscriptionApi } from '../../../services/api';

type Sub = {
  id: number;
  subscriptionNumber: string;
  subscriptionType: string;
  billingFrequency: string;
  startDate: string;
  expiryDate: string;
  status: string;
  renewalStatus: string;
  renewalNumber: number;
  nextReminder?: string | null;
  canRenew?: boolean;
};

type Hist = {
  renewal: string;
  period: string;
  status: string;
  approval: string;
};

export default function CloudSubscriptionPanel({ prId }: { prId: number }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [history, setHistory] = useState<Hist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await cloudSubscriptionApi.byPr(prId);
        const data = (res.data as Sub) || null;
        if (cancelled) return;
        setSub(data);
        if (data?.id) {
          const hist = await cloudSubscriptionApi.history(data.id);
          if (!cancelled) {
            setHistory(((hist.data as { history?: Hist[] })?.history || []) as Hist[]);
          }
        }
      } catch {
        if (!cancelled) setSub(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prId]);

  if (loading) {
    return <p className="text-xs text-gray-500 px-1 py-2">Loading Cloud Subscription…</p>;
  }
  if (!sub) return null;

  const freq = String(sub.billingFrequency || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-white rounded-lg border border-teal-200 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-teal-900">Cloud Subscription</h3>
          <p className="text-xs text-teal-700 mt-0.5">{sub.subscriptionNumber}</p>
        </div>
        {sub.canRenew && (
          <Link
            to={`/requester/cloud-subscriptions/${sub.id}/renew`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-600 text-white"
          >
            Renew Subscription
          </Link>
        )}
        {(sub.status === 'RENEWAL_PENDING' || sub.renewalStatus === 'PENDING') && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900">
            L1 Approval Pending
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-400">Status</p>
          <p className="font-medium">{sub.status}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Subscription Type</p>
          <p className="font-medium capitalize">{sub.subscriptionType || 'recurring'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Frequency</p>
          <p className="font-medium">{freq || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Renewal Number</p>
          <p className="font-medium">{sub.renewalNumber}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Start Date</p>
          <p className="font-medium">{sub.startDate}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Expiry Date</p>
          <p className="font-medium">{sub.expiryDate}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Renewal Status</p>
          <p className="font-medium">{sub.renewalStatus}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Next Reminder</p>
          <p className="font-medium text-xs">{sub.nextReminder || '—'}</p>
        </div>
      </div>
      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-teal-100">
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Renewal History</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b">
                  <th className="py-1 pr-2">Renewal</th>
                  <th className="py-1 pr-2">Period</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1">Approval</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={`${row.renewal}-${i}`} className="border-b border-gray-50">
                    <td className="py-1.5 pr-2 font-medium">{row.renewal}</td>
                    <td className="py-1.5 pr-2">{row.period}</td>
                    <td className="py-1.5 pr-2">{row.status}</td>
                    <td className="py-1.5">{row.approval}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
