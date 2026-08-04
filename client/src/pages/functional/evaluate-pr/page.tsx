
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';

interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
}

export default function EvaluatePRPage() {
  const navigate = useNavigate();
  const [prReference] = useState('PR-2024-0156');
  const [prDetails] = useState({
    title: 'Cloud Infrastructure Upgrade',
    department: 'IT',
    amount: '₹12,50,000',
    requester: 'Rajesh Kumar',
    submittedDate: '2024-01-15',
  });

  const [evaluationType, setEvaluationType] = useState({
    technical: false,
    commercial: false,
    functional: false,
  });
  const [evaluationNotes, setEvaluationNotes] = useState('');
  const [complianceStatus, setComplianceStatus] = useState('');
  const [riskNotes, setRiskNotes] = useState('');
  const [recommendation, setRecommendation] = useState('');
  // Fixed generic type syntax – no HTML escaping
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles: FileUpload[] = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (
      !evaluationType.technical &&
      !evaluationType.commercial &&
      !evaluationType.functional
    ) {
      newErrors.evaluationType = 'Please select at least one evaluation type';
    }

    if (!evaluationNotes.trim()) {
      newErrors.evaluationNotes = 'Evaluation notes are required';
    } else if (evaluationNotes.trim().length < 20) {
      newErrors.evaluationNotes =
        'Evaluation notes must be at least 20 characters';
    }

    if (!complianceStatus) {
      newErrors.complianceStatus = 'Compliance status is required';
    }

    if (!recommendation) {
      newErrors.recommendation = 'Recommendation is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveDraft = () => {
    try {
      // Placeholder for real draft‑saving logic (e.g., API call)
      console.log('Draft saved');
      alert('Draft saved successfully!');
    } catch (err) {
      console.error('Error saving draft:', err);
      alert('Failed to save draft. Please try again.');
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // In a real app you would submit data to a backend here.
      setShowSuccessModal(true);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    navigate('/dashboard');
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <i className="ri-arrow-left-line text-xl"></i>
                  <span className="text-sm font-medium">Back</span>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className="ri-file-list-3-line text-xl text-blue-600"></i>
                    </div>
                    <div>
                      <h1 className="text-xl font-semibold text-gray-900">
                        Functional Evaluation
                      </h1>
                      <p className="text-sm text-gray-500">
                        PR Reference:{' '}
                        <span className="font-medium text-blue-600">
                          {prReference}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm whitespace-nowrap"
                >
                  <i className="ri-save-line mr-2"></i>
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm whitespace-nowrap"
                >
                  <i className="ri-send-plane-line mr-2"></i>
                  Submit Evaluation
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6 max-w-7xl mx-auto">
          {/* PR Details Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="grid grid-cols-5 gap-6">
              <div>
                <p className="text-xs text-gray-600 mb-1">PR Title</p>
                <p className="text-sm font-semibold text-gray-900">
                  {prDetails.title}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Department</p>
                <p className="text-sm font-semibold text-gray-900">
                  {prDetails.department}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Amount</p>
                <p className="text-sm font-semibold text-gray-900">
                  {prDetails.amount}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Requester</p>
                <p className="text-sm font-semibold text-gray-900">
                  {prDetails.requester}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Submitted Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {prDetails.submittedDate}
                </p>
              </div>
            </div>
          </div>

          {/* Evaluation Type Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <i className="ri-checkbox-multiple-line text-xl text-purple-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Evaluation Type
                </h2>
                <p className="text-sm text-gray-500">
                  Select all applicable evaluation types
                </p>
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={evaluationType.technical}
                  onChange={(e) =>
                    setEvaluationType({
                      ...evaluationType,
                      technical: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Technical
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={evaluationType.commercial}
                  onChange={(e) =>
                    setEvaluationType({
                      ...evaluationType,
                      commercial: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Commercial
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={evaluationType.functional}
                  onChange={(e) =>
                    setEvaluationType({
                      ...evaluationType,
                      functional: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Functional
                </span>
              </label>
            </div>
            {errors.evaluationType && (
              <p className="text-sm text-red-600 mt-2">
                <i className="ri-error-warning-line mr-1"></i>
                {errors.evaluationType}
              </p>
            )}
          </div>

          {/* Evaluation Notes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <i className="ri-file-text-line text-xl text-green-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Evaluation Notes
                </h2>
                <p className="text-sm text-gray-500">
                  Provide detailed evaluation findings
                </p>
              </div>
            </div>
            <textarea
              value={evaluationNotes}
              onChange={(e) => setEvaluationNotes(e.target.value)}
              rows={6}
              placeholder="Enter detailed evaluation notes including technical specifications, functional requirements, and any observations..."
              className={`w-full px-4 py-3 border ${
                errors.evaluationNotes ? 'border-red-300' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm`}
            />
            <div className="flex items-center justify-between mt-2">
              {errors.evaluationNotes ? (
                <p className="text-sm text-red-600">
                  <i className="ri-error-warning-line mr-1"></i>
                  {errors.evaluationNotes}
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Minimum 20 characters required
                </p>
              )}
              <p className="text-xs text-gray-500">
                {evaluationNotes.length} characters
              </p>
            </div>
          </div>

          {/* Compliance and Recommendation Section */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Compliance Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="ri-shield-check-line text-xl text-orange-600"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Compliance Status
                  </h2>
                  <p className="text-sm text-gray-500">
                    Regulatory compliance check
                  </p>
                </div>
              </div>
              <select
                value={complianceStatus}
                onChange={(e) => setComplianceStatus(e.target.value)}
                className={`w-full px-4 py-3 border ${
                  errors.complianceStatus ? 'border-red-300' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer`}
              >
                <option value="">Select compliance status</option>
                <option value="compliant">Compliant</option>
                <option value="non-compliant">Non-Compliant</option>
              </select>
              {errors.complianceStatus && (
                <p className="text-sm text-red-600 mt-2">
                  <i className="ri-error-warning-line mr-1"></i>
                  {errors.complianceStatus}
                </p>
              )}
            </div>

            {/* Recommendation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="ri-thumb-up-line text-xl text-blue-600"></i>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recommendation
                  </h2>
                  <p className="text-sm text-gray-500">Final recommendation</p>
                </div>
              </div>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value)}
                className={`w-full px-4 py-3 border ${
                  errors.recommendation ? 'border-red-300' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm cursor-pointer`}
              >
                <option value="">Select recommendation</option>
                <option value="proceed">Proceed</option>
                <option value="rework">Rework Required</option>
                <option value="drop">Drop Request</option>
              </select>
              {errors.recommendation && (
                <p className="text-sm text-red-600 mt-2">
                  <i className="ri-error-warning-line mr-1"></i>
                  {errors.recommendation}
                </p>
              )}
            </div>
          </div>

          {/* Risk / Dependency Notes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <i className="ri-alert-line text-xl text-red-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Risk / Dependency Notes
                </h2>
                <p className="text-sm text-gray-500">
                  Identify potential risks and dependencies
                </p>
              </div>
            </div>
            <textarea
              value={riskNotes}
              onChange={(e) => setRiskNotes(e.target.value)}
              rows={5}
              placeholder="Document any risks, dependencies, or concerns related to this procurement request..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">Optional field</p>
          </div>

          {/* FSD Document Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <i className="ri-attachment-2 text-xl text-indigo-600"></i>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  FSD Document (Functional Specification Document)
                </h2>
                <p className="text-sm text-gray-500">
                  Upload FSD / functional specification documents
                </p>
              </div>
            </div>

            {/* Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="ri-upload-cloud-2-line text-3xl text-gray-400"></i>
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOC, XLS, JPG, PNG (max 10MB each)
                </p>
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Uploaded Files ({uploadedFiles.length})
                </h3>
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i className="ri-file-text-line text-lg text-blue-600"></i>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <i className="ri-delete-bin-line text-lg"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-3xl text-green-600"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Evaluation Submitted Successfully
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Your functional evaluation for{' '}
                <strong>{prReference}</strong> has been submitted and forwarded
                to the SCM team for vendor selection.
              </p>
              <button
                onClick={handleModalClose}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
