
import { useState } from 'react';

interface UploadPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    invoiceNumber: string;
    vendorName: string;
    invoiceAmount: number;
    dueDate: string;
  };
  onSubmit: (paymentData: PaymentData) => void;
}

export interface PaymentData {
  paymentDate: string;
  paymentMode: string;
  bankAccount: string;
  utrReference: string;
  amountPaid: number;
  remarks: string;
  receiptFile: File | null;
}

interface UploadPaymentModalPropsFixed extends Omit<UploadPaymentModalProps, 'onSubmit'> {
  onSubmit: (paymentData: PaymentData) => void | Promise<void>;
}

export default function UploadPaymentModal({ isOpen, onClose, invoice, onSubmit }: UploadPaymentModalPropsFixed) {
  const [formData, setFormData] = useState<PaymentData>({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMode: '',
    bankAccount: '',
    utrReference: '',
    amountPaid: invoice.invoiceAmount,
    remarks: '',
    receiptFile: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof PaymentData, value: string | number | File | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentMode) {
      newErrors.paymentMode = 'Payment mode is required';
    }

    if (!formData.bankAccount.trim()) {
      newErrors.bankAccount = 'Bank account is required';
    }

    if (!formData.utrReference.trim()) {
      newErrors.utrReference = 'UTR/Reference number is required';
    } else if (formData.utrReference.trim().length < 6) {
      newErrors.utrReference = 'UTR/Reference must be at least 6 characters';
    }

    if (!formData.amountPaid || formData.amountPaid <= 0) {
      newErrors.amountPaid = 'Amount paid is required';
    }

    if (!formData.receiptFile) {
      newErrors.receiptFile = 'Payment receipt/proof is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    try {
      await Promise.resolve(onSubmit(formData));
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        setFormData({
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: '',
          bankAccount: '',
          utrReference: '',
          amountPaid: invoice.invoiceAmount,
          remarks: '',
          receiptFile: null,
        });
      }, 1200);
    } catch {
      /* parent shows error toast */
    }
  };

  const handleFileSelect = (file: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
      setErrors(prev => ({ ...prev, receiptFile: 'Only PDF and image files are allowed' }));
      return;
    }

    if (file.size > maxSize) {
      setErrors(prev => ({ ...prev, receiptFile: 'File size must be less than 5MB' }));
      return;
    }

    handleInputChange('receiptFile', file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeFile = () => {
    handleInputChange('receiptFile', null);
    setErrors(prev => ({ ...prev, receiptFile: '' }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Upload Payment Details</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mx-6 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-green-100 rounded-full">
              <i className="ri-check-line text-green-600"></i>
            </div>
            <div>
              <p className="font-medium text-green-900">Payment Recorded Successfully!</p>
              <p className="text-sm text-green-700">Invoice has been marked as paid.</p>
            </div>
          </div>
        )}

        {/* Invoice Summary */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-semibold text-gray-900">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vendor</p>
              <p className="font-semibold text-gray-900">{invoice.vendorName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Invoice Amount</p>
              <p className="font-semibold text-teal-600 text-lg">₹{invoice.invoiceAmount.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Due Date</p>
              <p className="font-semibold text-gray-900">{invoice.dueDate}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.paymentDate}
              onChange={(e) => handleInputChange('paymentDate', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.paymentDate ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.paymentDate && (
              <p className="mt-1 text-sm text-red-600">{errors.paymentDate}</p>
            )}
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.paymentMode}
              onChange={(e) => handleInputChange('paymentMode', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.paymentMode ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">Select payment mode</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="IMPS">IMPS</option>
              <option value="Cheque">Cheque</option>
              <option value="DD">Demand Draft (DD)</option>
            </select>
            {errors.paymentMode && (
              <p className="mt-1 text-sm text-red-600">{errors.paymentMode}</p>
            )}
          </div>

          {/* Bank Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Bank Account <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.bankAccount}
              onChange={(e) => handleInputChange('bankAccount', e.target.value)}
              placeholder="Enter bank account number or name"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.bankAccount ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.bankAccount && (
              <p className="mt-1 text-sm text-red-600">{errors.bankAccount}</p>
            )}
          </div>

          {/* UTR/Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              UTR / Reference Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.utrReference}
              onChange={(e) => handleInputChange('utrReference', e.target.value)}
              placeholder="Enter UTR or transaction reference number"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                errors.utrReference ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.utrReference && (
              <p className="mt-1 text-sm text-red-600">{errors.utrReference}</p>
            )}
          </div>

          {/* Amount Paid */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Amount Paid <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                value={formData.amountPaid}
                onChange={(e) => handleInputChange('amountPaid', parseFloat(e.target.value) || 0)}
                step="0.01"
                min="0"
                className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  errors.amountPaid ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.amountPaid && (
              <p className={`mt-1 text-sm ${errors.amountPaid.includes('Warning') ? 'text-amber-600' : 'text-red-600'}`}>
                {errors.amountPaid}
              </p>
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks
            </label>
            <textarea
              value={formData.remarks}
              onChange={(e) => handleInputChange('remarks', e.target.value)}
              placeholder="Add any additional notes or comments"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Payment Receipt / Proof <span className="text-red-500">*</span>
            </label>
            
            {!formData.receiptFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-teal-500 bg-teal-50'
                    : errors.receiptFile
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center mx-auto mb-3 bg-gray-100 rounded-full">
                  <i className="ri-upload-cloud-2-line text-2xl text-gray-400"></i>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  Drag and drop your file here, or
                </p>
                <label className="inline-block px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap">
                  Browse Files
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: PDF, JPG, PNG (Max 5MB)
                </p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-lg">
                    <i className={`text-xl text-teal-600 ${
                      formData.receiptFile.type === 'application/pdf' ? 'ri-file-pdf-line' : 'ri-image-line'
                    }`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formData.receiptFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(formData.receiptFile.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            )}
            
            {errors.receiptFile && (
              <p className="mt-1 text-sm text-red-600">{errors.receiptFile}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              Submit Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
