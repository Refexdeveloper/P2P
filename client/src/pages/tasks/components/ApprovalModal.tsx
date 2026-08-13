import { useEffect, useState } from 'react';
import { prApi } from '../../../services/api';

interface ApprovalModalProps {
  isOpen: boolean;
  type: 'approve' | 'reject' | 'return';
  prNumber: string;
  prTitle: string;
  amount: number;
  prId?: number;
  onConfirm: (remarks: string, returnTo?: string) => void;
  onClose: () => void;
}

export default function ApprovalModal({
  isOpen,
  type,
  prNumber,
  prTitle,
  amount,
  prId,
  onConfirm,
  onClose,
}: ApprovalModalProps) {
  const [remarks, setRemarks] = useState('');
  const [returnTo, setReturnTo] = useState('');
  const [targets, setTargets] = useState<{ key: string; label: string }[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setRemarks('');
      setReturnTo('');
      setTargets([]);
      setError('');
      return;
    }
    if (type !== 'return' || !prId) return;

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
  }, [isOpen, type, prId]);

  if (!isOpen) return null;

  const config = {
    approve: {
      title: 'Approve Purchase Request',
      icon: 'ri-check-double-line',
      headerBg: 'bg-emerald-50',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      titleColor: 'text-emerald-900',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
      btnIcon: 'ri-check-double-line',
      btnText: 'Confirm Approve',
      placeholder: 'Enter approval remarks...',
      requireRemarks: true,
    },
    reject: {
      title: 'Reject Purchase Request',
      icon: 'ri-close-circle-line',
      headerBg: 'bg-red-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      titleColor: 'text-red-900',
      btnBg: 'bg-red-600 hover:bg-red-700',
      btnIcon: 'ri-close-circle-line',
      btnText: 'Confirm Reject',
      placeholder: 'Please provide reason for rejection...',
      requireRemarks: true,
    },
    return: {
      title: 'Send Back for Rework',
      icon: 'ri-arrow-go-back-line',
      headerBg: 'bg-orange-50',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      titleColor: 'text-orange-900',
      btnBg: 'bg-orange-600 hover:bg-orange-700',
      btnIcon: 'ri-arrow-go-back-line',
      btnText: 'Confirm Send Back',
      placeholder: 'Enter what needs to be reworked...',
      requireRemarks: true,
    },
  }[type];

  const handleSubmit = () => {
    if (config.requireRemarks && !remarks.trim()) {
      setError('Please enter remarks');
      return;
    }
    if (type === 'reject' && remarks.trim().length < 10) {
      setError('Please provide a reason for rejection (minimum 10 characters)');
      return;
    }
    // Prefer selected state; fall back to first loaded target (avoids empty value while dropdown shows a label)
    const selectedReturnTo = returnTo || targets[0]?.key || '';
    if (type === 'return' && prId && !selectedReturnTo) {
      setError('Select a previous stage to send back to');
      return;
    }
    onConfirm(remarks.trim(), type === 'return' ? selectedReturnTo : undefined);
    setRemarks('');
    setReturnTo('');
    setError('');
  };

  const handleClose = () => {
    setRemarks('');
    setReturnTo('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className={`px-6 py-4 ${config.headerBg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.iconBg}`}>
              <i className={`text-xl ${config.icon} ${config.iconColor}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${config.titleColor}`}>{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-gray-500">{prNumber}</span>
              <span className="text-sm font-bold text-gray-900">₹{Number(amount || 0).toLocaleString('en-IN')}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{prTitle}</p>
          </div>

          {type === 'return' && Boolean(prId) && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Send back to <span className="text-red-500">*</span>
              </label>
              <select
                value={returnTo}
                onChange={(e) => {
                  setReturnTo(e.target.value);
                  setError('');
                }}
                disabled={targetsLoading || !targets.length}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white"
              >
                {targetsLoading && <option value="">Loading previous stages...</option>}
                {!targetsLoading && !targets.length && <option value="">No previous stages</option>}
                {targets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">PR will return to the selected stage for action.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setError('');
              }}
              placeholder={config.placeholder}
              rows={3}
              maxLength={500}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                error
                  ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                  : 'border-gray-200 focus:ring-teal-500/20 focus:border-teal-400'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {error ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <i className="ri-error-warning-line" />
                  {error}
                </p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">{remarks.length}/500</span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm ${config.btnBg}`}
          >
            <i className={config.btnIcon} />
            {config.btnText}
          </button>
        </div>
      </div>
    </div>
  );
}
