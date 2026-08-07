import { useEffect, useState } from 'react';
import { prApi } from '../../../services/api';

interface Props {
  isOpen: boolean;
  action: 'approve' | 'reject' | 'rework';
  prNumber: string;
  title: string;
  stageLabel: string;
  prId?: number;
  /** Own-vendor HOD final: require Yes/No for Business/CFO path */
  askBusinessApproval?: boolean;
  onClose: () => void;
  onConfirm: (
    remarks: string,
    options?: { goToBusinessApproval?: boolean; returnTo?: string }
  ) => Promise<void>;
}

export default function PostRfqApprovalModal({
  isOpen,
  action,
  prNumber,
  title,
  stageLabel,
  prId,
  askBusinessApproval = false,
  onClose,
  onConfirm,
}: Props) {
  const [remarks, setRemarks] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [targets, setTargets] = useState<{ key: string; label: string }[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [goToBusinessApproval, setGoToBusinessApproval] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setRemarks('');
      setReturnTo('');
      setTargets([]);
      setGoToBusinessApproval(null);
      setError('');
      setLoading(false);
      return;
    }
    if (action !== 'rework' || !prId) return;

    let cancelled = false;
    setTargetsLoading(true);
    prApi
      .sendBackTargets(prId)
      .then((res) => {
        if (cancelled) return;
        const list = res.data || [];
        setTargets(list);
        setReturnTo(list[0]?.key || '');
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load previous stages');
        }
      })
      .finally(() => {
        if (!cancelled) setTargetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, action, prId]);

  if (!isOpen) return null;

  const config = {
    approve: { label: 'Approve', color: 'bg-emerald-600 hover:bg-emerald-700', icon: 'ri-check-line' },
    reject: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700', icon: 'ri-close-line' },
    rework: { label: 'Send Back', color: 'bg-orange-600 hover:bg-orange-700', icon: 'ri-arrow-go-back-line' },
  }[action];

  const needsBusinessChoice = action === 'approve' && askBusinessApproval;

  const handleSubmit = async () => {
    if (!remarks.trim()) {
      setError('Remarks are required');
      return;
    }
    if (needsBusinessChoice && goToBusinessApproval === null) {
      setError('Select Yes or No for Business / CFO Approval');
      return;
    }
    if (action === 'rework' && !returnTo) {
      setError('Select a previous stage to send back to');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const options: { goToBusinessApproval?: boolean; returnTo?: string } = {};
      if (needsBusinessChoice) options.goToBusinessApproval = Boolean(goToBusinessApproval);
      if (action === 'rework') options.returnTo = returnTo;
      await onConfirm(remarks, Object.keys(options).length ? options : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">{config.label} — {stageLabel}</h3>
          <p className="text-sm text-gray-600 mt-1">{prNumber} · {title}</p>
        </div>
        <div className="p-6 space-y-4">
          {needsBusinessChoice && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900 mb-1">Go to Business Approval?</p>
              <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                <strong>Yes</strong> → L2 Manager → CFO → SCM Final RFQ
                <br />
                <strong>No</strong> → L2 Manager → SCM Final RFQ (skip CFO)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGoToBusinessApproval(true)}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer text-center ${
                    goToBusinessApproval === true
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Yes — L2 → CFO
                </button>
                <button
                  type="button"
                  onClick={() => setGoToBusinessApproval(false)}
                  className={`flex-1 px-3 py-2.5 text-sm font-semibold rounded-lg border cursor-pointer text-center ${
                    goToBusinessApproval === false
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  No — L2 → SCM Final
                </button>
              </div>
            </div>
          )}

          {action === 'rework' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Send back to <span className="text-red-500">*</span>
              </label>
              <select
                value={returnTo}
                onChange={(e) => {
                  setReturnTo(e.target.value);
                  setError('');
                }}
                disabled={targetsLoading || !targets.length}
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              >
                {targetsLoading && <option value="">Loading previous stages...</option>}
                {!targetsLoading && !targets.length && <option value="">No previous stages</option>}
                {targets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">PR moves to the selected previous stage.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks *</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder={`Enter remarks for ${action}...`}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 cursor-pointer ${config.color}`}
          >
            <i className={config.icon}></i>
            {loading ? 'Processing...' : config.label}
          </button>
        </div>
      </div>
    </div>
  );
}
