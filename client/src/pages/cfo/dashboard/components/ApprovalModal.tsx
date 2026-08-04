import { useState } from 'react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  pr: {
    id: string;
    title: string;
    entity: string;
    department: string;
    requester: string;
    amount: number;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    justification: string;
  };
  onApprove: (remarks: string) => void;
  onReject: (remarks: string) => void;
}

export default function ApprovalModal({ isOpen, onClose, pr, onApprove, onReject }: ApprovalModalProps) {
  const [remarks, setRemarks] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');

  if (!isOpen) return null;

  const entityColors: Record<string, string> = {
    'Entity A': 'from-blue-500 to-blue-600',
    'Entity B': 'from-emerald-500 to-emerald-600',
    'Entity C': 'from-amber-500 to-amber-600',
    'Holding Co.': 'from-violet-500 to-violet-600',
  };

  const priorityColors: Record<string, string> = {
    Critical: 'bg-red-100 text-red-700',
    High: 'bg-orange-100 text-orange-700',
    Medium: 'bg-blue-100 text-blue-700',
    Low: 'bg-gray-100 text-gray-700',
  };

  const handleApprove = () => {
    setActionType('approve');
    setShowSuccess(true);
    setTimeout(() => {
      onApprove(remarks);
      handleClose();
    }, 2000);
  };

  const handleReject = () => {
    if (!remarks.trim()) {
      alert('Please provide remarks for rejection');
      return;
    }
    setActionType('reject');
    setShowSuccess(true);
    setTimeout(() => {
      onReject(remarks);
      handleClose();
    }, 2000);
  };

  const handleClose = () => {
    setRemarks('');
    setShowSuccess(false);
    onClose();
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-scale-in">
          <div className={`bg-gradient-to-r ${actionType === 'approve' ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} p-6 rounded-t-xl`}>
            <div className="flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mx-auto mb-4">
              <i className={`${actionType === 'approve' ? 'ri-check-line' : 'ri-close-line'} text-4xl text-white`}></i>
            </div>
            <h3 className="text-2xl font-bold text-white text-center">
              {actionType === 'approve' ? 'PR Approved!' : 'PR Rejected'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">PR Number</span>
                <span className="font-semibold text-gray-900">{pr.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Entity</span>
                <span className="font-semibold text-gray-900">{pr.entity}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Amount</span>
                <span className="font-bold text-lg text-gray-900">₹{pr.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${actionType === 'approve' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {actionType === 'approve' ? 'CFO Approved' : 'CFO Rejected'}
                </span>
              </div>
            </div>

            {actionType === 'approve' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <i className="ri-information-line text-xl text-blue-600 mt-0.5"></i>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Next Step</p>
                    <p className="text-sm text-blue-700 mt-1">PR forwarded to SCM for vendor selection and PO creation</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
        <div className={`bg-gradient-to-r ${entityColors[pr.entity] || 'from-gray-500 to-gray-600'} p-6 rounded-t-xl`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">CFO Approval Required</h2>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <i className="ri-close-line text-xl text-white"></i>
            </button>
          </div>
          <p className="text-white/90 text-sm">Review and approve this purchase request</p>
        </div>

        <div className="p-6 space-y-6">
          {/* PR Summary Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-5 border border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">PR Number</p>
                <p className="font-bold text-gray-900">{pr.id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Entity</p>
                <p className="font-semibold text-gray-900">{pr.entity}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Department</p>
                <p className="font-semibold text-gray-900">{pr.department}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Requester</p>
                <p className="font-semibold text-gray-900">{pr.requester}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Amount</p>
                <p className="font-bold text-xl text-gray-900">₹{pr.amount.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Priority</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${priorityColors[pr.priority]}`}>
                  {pr.priority}
                </span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300">
              <p className="text-xs text-gray-600 mb-2">Business Justification</p>
              <p className="text-sm text-gray-800 leading-relaxed">{pr.justification}</p>
            </div>
          </div>

          {/* CFO Checklist */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <i className="ri-checkbox-circle-line text-lg text-emerald-600"></i>
              CFO Verification Checklist
            </h3>
            <div className="space-y-2">
              {[
                'Budget availability confirmed',
                'Business justification reviewed',
                'Compliance check passed',
                'Financial impact assessed'
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <div className="w-5 h-5 flex items-center justify-center bg-emerald-600 rounded">
                    <i className="ri-check-line text-xs text-white"></i>
                  </div>
                  <span className="text-sm text-gray-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Remarks {remarks.trim() === '' && <span className="text-red-500">(Required for rejection)</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add your comments or reasons for approval/rejection..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm"
              rows={4}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleReject}
              className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ri-close-circle-line text-lg"></i>
              Reject PR
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <i className="ri-check-circle-line text-lg"></i>
              Approve PR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}