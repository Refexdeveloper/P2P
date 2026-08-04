import React, { useState } from 'react';

interface PRItem {
  id: string;
  title: string;
  requester: string;
  department: string;
  amount: number;
  priority: string;
  status: string;
}

interface ApprovalModalProps {
  pr: PRItem | null;
  action: 'approve' | 'reject' | 'rework';
  onClose: () => void;
  onConfirm: (remarks: string) => Promise<void>;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ pr, action, onClose, onConfirm }) => {
  const [remarks, setRemarks] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!pr) return null;

  const getActionConfig = () => {
    switch (action) {
      case 'approve':
        return {
          title: 'Approve Purchase Request',
          icon: 'ri-checkbox-circle-fill',
          gradient: 'from-green-500 to-green-600',
          buttonText: 'Approve PR',
          successMessage: 'PR Approved Successfully!',
        };
      case 'reject':
        return {
          title: 'Reject Purchase Request',
          icon: 'ri-close-circle-fill',
          gradient: 'from-red-500 to-red-600',
          buttonText: 'Reject PR',
          successMessage: 'PR Rejected',
        };
      case 'rework':
        return {
          title: 'Return for Rework',
          icon: 'ri-arrow-go-back-fill',
          gradient: 'from-orange-500 to-orange-600',
          buttonText: 'Send Back',
          successMessage: 'PR Returned for Rework',
        };
      default:
        return {
          title: '',
          icon: '',
          gradient: 'from-gray-500 to-gray-600',
          buttonText: '',
          successMessage: '',
        };
    }
  };

  const config = getActionConfig();

  const handleConfirm = async () => {
    if (!remarks.trim()) {
      setError('Please enter remarks');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await onConfirm(remarks);
      setShowSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setRemarks('');
    setShowSuccess(false);
    onClose();
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white text-center`}>
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className={`${config.icon} text-4xl`}></i>
            </div>
            <h3 className="text-xl font-bold">{config.successMessage}</h3>
          </div>
          <div className="p-6 text-center">
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-900 mb-1">PR Number</div>
              <div className="text-lg font-bold text-teal-600">{pr.id}</div>
            </div>
            <div className="text-sm text-gray-600 mb-6">
              {action === 'approve' && 'The purchase request has been approved and forwarded to the next stage.'}
              {action === 'reject' && 'The purchase request has been rejected. The requester will be notified.'}
              {action === 'rework' && 'The purchase request has been returned to the requester for modifications.'}
            </div>
            <button
              onClick={handleCloseSuccess}
              className="w-full px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className={`bg-gradient-to-r ${config.gradient} p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <i className={`${config.icon} text-2xl`}></i>
              </div>
              <div>
                <h2 className="text-xl font-bold">{config.title}</h2>
                <p className="text-sm text-white/90 mt-0.5">Review and confirm your decision</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">PR Number</div>
                <div className="text-sm font-medium text-teal-600">{pr.id}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount</div>
                <div className="text-sm font-bold text-gray-900">₹{pr.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Requester</div>
                <div className="text-sm text-gray-900">{pr.requester}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Department</div>
                <div className="text-sm text-gray-900">{pr.department}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</div>
                <div className="text-sm font-medium text-gray-900">{pr.title}</div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setError('');
              }}
              placeholder={
                action === 'approve'
                  ? 'Enter approval remarks...'
                  : action === 'reject'
                  ? 'Enter reason for rejection...'
                  : 'Enter what needs to be reworked...'
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none text-sm"
              rows={4}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1 text-right">{remarks.length}/500</div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
              style={{
                backgroundColor: action === 'approve' ? '#16a34a' : action === 'reject' ? '#dc2626' : '#ea580c',
              }}
            >
              {isSubmitting ? 'Processing...' : config.buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
