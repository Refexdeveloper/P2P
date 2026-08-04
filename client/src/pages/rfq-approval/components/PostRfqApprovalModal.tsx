import { useState } from 'react';

interface Props {
  isOpen: boolean;
  action: 'approve' | 'reject' | 'rework';
  prNumber: string;
  title: string;
  stageLabel: string;
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
}

export default function PostRfqApprovalModal({
  isOpen,
  action,
  prNumber,
  title,
  stageLabel,
  onClose,
  onConfirm,
}: Props) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const config = {
    approve: { label: 'Approve', color: 'bg-emerald-600 hover:bg-emerald-700', icon: 'ri-check-line' },
    reject: { label: 'Reject', color: 'bg-red-600 hover:bg-red-700', icon: 'ri-close-line' },
    rework: { label: 'Send Back', color: 'bg-orange-600 hover:bg-orange-700', icon: 'ri-arrow-go-back-line' },
  }[action];

  const handleSubmit = async () => {
    if (!remarks.trim()) {
      setError('Remarks are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(remarks);
      setRemarks('');
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
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Remarks *</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            placeholder={`Enter remarks for ${action}...`}
          />
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
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
