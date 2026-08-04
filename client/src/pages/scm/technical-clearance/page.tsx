import { useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';

interface ApprovalHistory {
  id: string;
  action: string;
  by: string;
  role: string;
  date: string;
  remarks: string;
}

export default function TechnicalClearancePage() {
  const [clearanceDecision, setClearanceDecision] = useState<'cleared' | 'clarification'>('cleared');
  const [remarks, setRemarks] = useState('');
  const [clarificationFrom, setClarificationFrom] = useState('');
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [generatedPO, setGeneratedPO] = useState('');
  const [errors, setErrors] = useState<{ remarks?: string; clarificationFrom?: string }>({});

  // Mock PR/RFQ data
  const prData = {
    prNumber: 'PR-2024-0156',
    rfqNumber: 'RFQ-2024-0089',
    title: 'Enterprise Server Infrastructure Upgrade',
    department: 'IT Infrastructure',
    requestType: 'Capex',
    requester: 'Rajesh Kumar',
    totalAmount: '₹7,95,000',
    requiredDate: '2024-04-15',
    selectedVendor: 'Global IT Systems',
    quotedPrice: '₹7,95,000',
    leadTime: '30 days',
    overallScore: '90.4',
  };

  // Mock approval history
  const approvalHistory: ApprovalHistory[] = [
    {
      id: '1',
      action: 'PR Submitted',
      by: 'Rajesh Kumar',
      role: 'Requester',
      date: '2024-03-01 10:30 AM',
      remarks: 'Urgent requirement for Q1 infrastructure upgrade',
    },
    {
      id: '2',
      action: 'HOD Approved',
      by: 'Priya Sharma',
      role: 'HOD - IT',
      date: '2024-03-02 02:15 PM',
      remarks: 'Approved. Budget allocated for this quarter.',
    },
    {
      id: '3',
      action: 'CFO Approved',
      by: 'Amit Patel',
      role: 'CFO',
      date: '2024-03-03 11:45 AM',
      remarks: 'Financial approval granted. Proceed with vendor selection.',
    },
    {
      id: '4',
      action: 'Functional Evaluation Completed',
      by: 'Neha Gupta',
      role: 'Functional Team',
      date: '2024-03-04 04:20 PM',
      remarks: 'Technical requirements validated. Recommendation: Proceed',
    },
    {
      id: '5',
      action: 'RFQ Completed',
      by: 'Vikram Singh',
      role: 'SCM Team',
      date: '2024-03-06 03:30 PM',
      remarks: 'Vendor comparison completed. Global IT Systems recommended.',
    },
  ];

  const validateForm = () => {
    const newErrors: { remarks?: string; clarificationFrom?: string } = {};

    if (!remarks.trim()) {
      newErrors.remarks = 'Remarks are required';
    } else if (remarks.trim().length < 20) {
      newErrors.remarks = 'Remarks must be at least 20 characters';
    }

    if (clearanceDecision === 'clarification' && !clarificationFrom) {
      newErrors.clarificationFrom = 'Please select who clarification is required from';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendBack = () => {
    if (validateForm()) {
      setShowSendBackModal(true);
    }
  };

  const confirmSendBack = () => {
    setShowSendBackModal(false);
    // In real app, would send data to backend
    alert('PR sent back for clarification');
    window.REACT_APP_NAVIGATE('/dashboard');
  };

  const handleApprove = () => {
    if (validateForm()) {
      // Generate PO number
      const poNumber = `PO-2024-${Math.floor(Math.random() * 9000) + 1000}`;
      setGeneratedPO(poNumber);
      setShowSuccessModal(true);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    window.REACT_APP_NAVIGATE('/dashboard');
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Sticky Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-6 py-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">SCM Technical Clearance</h1>
              <p className="text-sm text-gray-600 mt-1">
                PR: <span className="font-medium text-blue-600">{prData.prNumber}</span> | RFQ: <span className="font-medium text-blue-600">{prData.rfqNumber}</span>
              </p>
            </div>
            <StatusBadge status="pending" />
          </div>
        </div>

        {/* PR/RFQ Details Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <i className="ri-file-list-3-line text-xl text-blue-600"></i>
            </div>
            <div className="ml-3">
              <h2 className="text-lg font-semibold text-gray-900">{prData.title}</h2>
              <p className="text-sm text-gray-600">{prData.department} • {prData.requestType}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-500 mb-1">Requester</p>
              <p className="text-sm font-medium text-gray-900">{prData.requester}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total Amount</p>
              <p className="text-sm font-semibold text-gray-900">{prData.totalAmount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Required Date</p>
              <p className="text-sm font-medium text-gray-900">{prData.requiredDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <StatusBadge status="pending" />
            </div>
          </div>

          {/* Selected Vendor Info */}
          <div className="mt-4 pt-4 border-t border-gray-200 bg-blue-50 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <i className="ri-award-line text-white"></i>
              </div>
              <h3 className="ml-2 text-sm font-semibold text-gray-900">Recommended Vendor</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Vendor Name</p>
                <p className="text-sm font-semibold text-gray-900">{prData.selectedVendor}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Quoted Price</p>
                <p className="text-sm font-semibold text-green-600">{prData.quotedPrice}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Lead Time</p>
                <p className="text-sm font-medium text-gray-900">{prData.leadTime}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Overall Score</p>
                <p className="text-sm font-semibold text-blue-600">{prData.overallScore}/100</p>
              </div>
            </div>
          </div>
        </div>

        {/* Clearance Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <i className="ri-checkbox-circle-line text-xl text-green-600"></i>
            </div>
            <h2 className="ml-3 text-lg font-semibold text-gray-900">Technical Clearance Decision</h2>
          </div>

          {/* Clearance Decision */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Clearance Decision <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="clearanceDecision"
                  value="cleared"
                  checked={clearanceDecision === 'cleared'}
                  onChange={(e) => {
                    setClearanceDecision(e.target.value as 'cleared' | 'clarification');
                    setClarificationFrom('');
                    setErrors({});
                  }}
                  className="w-4 h-4 text-green-600 focus:ring-green-500"
                />
                <span className="ml-2 text-sm text-gray-900">
                  <i className="ri-checkbox-circle-line text-green-600 mr-1"></i>
                  Cleared - Approve & Create PO
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="clearanceDecision"
                  value="clarification"
                  checked={clearanceDecision === 'clarification'}
                  onChange={(e) => {
                    setClearanceDecision(e.target.value as 'cleared' | 'clarification');
                    setErrors({});
                  }}
                  className="w-4 h-4 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="ml-2 text-sm text-gray-900">
                  <i className="ri-error-warning-line text-yellow-600 mr-1"></i>
                  Clarification Required
                </span>
              </label>
            </div>
          </div>

          {/* Conditional Clarification From Field */}
          {clearanceDecision === 'clarification' && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clarification Required From <span className="text-red-500">*</span>
              </label>
              <select
                value={clarificationFrom}
                onChange={(e) => {
                  setClarificationFrom(e.target.value);
                  setErrors({ ...errors, clarificationFrom: undefined });
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent ${
                  errors.clarificationFrom ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select who needs to provide clarification</option>
                <option value="requester">Requester</option>
                <option value="vendor">Vendor</option>
                <option value="functional">Functional Team</option>
              </select>
              {errors.clarificationFrom && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <i className="ri-error-warning-line mr-1"></i>
                  {errors.clarificationFrom}
                </p>
              )}
            </div>
          )}

          {/* Remarks */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                setErrors({ ...errors, remarks: undefined });
              }}
              rows={4}
              placeholder="Enter your remarks (minimum 20 characters)..."
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                errors.remarks ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.remarks ? (
                <p className="text-sm text-red-600 flex items-center">
                  <i className="ri-error-warning-line mr-1"></i>
                  {errors.remarks}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  {remarks.length}/20 characters minimum
                </p>
              )}
              <p className="text-xs text-gray-500">{remarks.length} characters</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            {clearanceDecision === 'clarification' ? (
              <button
                onClick={handleSendBack}
                className="flex-1 bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors font-medium whitespace-nowrap flex items-center justify-center"
              >
                <i className="ri-arrow-go-back-line mr-2"></i>
                Send Back for Clarification
              </button>
            ) : (
              <button
                onClick={handleApprove}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap flex items-center justify-center"
              >
                <i className="ri-checkbox-circle-line mr-2"></i>
                Approve & Create PO
              </button>
            )}
            <button
              onClick={() => window.REACT_APP_NAVIGATE('/dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Approval History Timeline */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <i className="ri-time-line text-xl text-purple-600"></i>
            </div>
            <h2 className="ml-3 text-lg font-semibold text-gray-900">Approval History</h2>
          </div>

          <div className="space-y-4">
            {approvalHistory.map((item, index) => (
              <div key={item.id} className="flex">
                <div className="flex flex-col items-center mr-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    index === approvalHistory.length - 1 ? 'bg-blue-600' : 'bg-green-600'
                  }`}>
                    {index === approvalHistory.length - 1 ? (
                      <i className="ri-time-line text-white"></i>
                    ) : (
                      <i className="ri-checkbox-circle-line text-white"></i>
                    )}
                  </div>
                  {index < approvalHistory.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-300 mt-2"></div>
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{item.action}</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          by <span className="font-medium">{item.by}</span> ({item.role})
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">{item.date}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">{item.remarks}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Send Back Confirmation Modal */}
      {showSendBackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <i className="ri-error-warning-line text-2xl text-yellow-600"></i>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">Confirm Send Back</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to send this PR back for clarification to <strong>{clarificationFrom === 'requester' ? 'Requester' : clarificationFrom === 'vendor' ? 'Vendor' : 'Functional Team'}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmSendBack}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors font-medium whitespace-nowrap"
              >
                Yes, Send Back
              </button>
              <button
                onClick={() => setShowSendBackModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-checkbox-circle-line text-2xl text-green-600"></i>
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900">PO Created Successfully!</h3>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-700 mb-2">Purchase Order has been generated:</p>
              <p className="text-xl font-bold text-green-600">{generatedPO}</p>
              <p className="text-xs text-gray-600 mt-2">Vendor: {prData.selectedVendor}</p>
              <p className="text-xs text-gray-600">Amount: {prData.quotedPrice}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeSuccessModal}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
              >
                Return to Dashboard
              </button>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium whitespace-nowrap"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
