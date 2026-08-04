import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface FormData {
  vendorName: string;
  vendorType: 'Company' | 'Individual';
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const CreateVendorPage = () => {
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    vendorName: '',
    vendorType: 'Company',
    gstNumber: '',
    panNumber: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branch: '',
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const [uploadedFiles, setUploadedFiles] = useState<{
    gst: UploadedFile | null;
    pan: UploadedFile | null;
    cheque: UploadedFile | null;
  }>({
    gst: null,
    pan: null,
    cheque: null,
  });

  const categories = [
    'IT Services',
    'Professional Services',
    'Raw Materials',
    'Office Supplies',
    'Consulting',
    'Equipment',
    'Maintenance',
    'Transportation',
  ];

  const validateGST = (gst: string): boolean => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst);
  };

  const validatePAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateIFSC = (ifsc: string): boolean => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
  };

  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'vendorName':
        return value.trim() === '' ? 'Vendor name is required' : '';
      case 'gstNumber':
        if (value.trim() === '') return 'GST number is required';
        return !validateGST(value) ? 'Invalid GST format (e.g., 22AAAAA0000A1Z5)' : '';
      case 'panNumber':
        if (value.trim() === '') return 'PAN number is required';
        return !validatePAN(value) ? 'Invalid PAN format (e.g., ABCDE1234F)' : '';
      case 'email':
        if (value.trim() === '') return 'Email is required';
        return !validateEmail(value) ? 'Invalid email format' : '';
      case 'phone':
        if (value.trim() === '') return 'Phone number is required';
        return !validatePhone(value) ? 'Invalid phone number (10 digits required)' : '';
      case 'address':
        return value.trim() === '' ? 'Address is required' : '';
      case 'category':
        return value === '' ? 'Category is required' : '';
      case 'accountNumber':
        return value.trim() === '' ? 'Account number is required' : '';
      case 'ifscCode':
        if (value.trim() === '') return 'IFSC code is required';
        return !validateIFSC(value) ? 'Invalid IFSC format (e.g., SBIN0001234)' : '';
      case 'bankName':
        return value.trim() === '' ? 'Bank name is required' : '';
      case 'branch':
        return value.trim() === '' ? 'Branch is required' : '';
      default:
        return '';
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleFileUpload = (type: 'gst' | 'pan' | 'cheque', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const uploadedFile: UploadedFile = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        type: file.type,
      };
      setUploadedFiles(prev => ({ ...prev, [type]: uploadedFile }));
    }
  };

  const handleRemoveFile = (type: 'gst' | 'pan' | 'cheque') => {
    setUploadedFiles(prev => ({ ...prev, [type]: null }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: ValidationErrors = {};
    const allFields = Object.keys(formData) as Array<keyof FormData>;
    
    allFields.forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });

    if (!uploadedFiles.gst) newErrors.gst = 'GST certificate is required';
    if (!uploadedFiles.pan) newErrors.pan = 'PAN card is required';
    if (!uploadedFiles.cheque) newErrors.cheque = 'Cancelled cheque is required';

    setErrors(newErrors);
    setTouched(
      allFields.reduce((acc, field) => ({ ...acc, [field]: true }), {})
    );

    if (Object.keys(newErrors).length === 0) {
      setShowSuccess(true);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(-1)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-arrow-left-line text-xl"></i>
                  <span className="font-medium">Back</span>
                </button>
                <div className="h-6 w-px bg-gray-300"></div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create Vendor Master</h1>
                  <p className="text-sm text-gray-500 mt-1">Add new vendor to the system</p>
                </div>
              </div>
              <button
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm whitespace-nowrap cursor-pointer"
              >
                <i className="ri-save-line"></i>
                Save Vendor
              </button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="ri-building-line text-blue-600 text-xl"></i>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vendor Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.vendorName && touched.vendorName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter vendor name"
                  />
                  {errors.vendorName && touched.vendorName && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.vendorName}
                    </p>
                  )}
                </div>

                {/* Vendor Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vendor Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-6 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="vendorType"
                        value="Company"
                        checked={formData.vendorType === 'Company'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">Company</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="vendorType"
                        value="Individual"
                        checked={formData.vendorType === 'Individual'}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">Individual</span>
                    </label>
                  </div>
                </div>

                {/* GST Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    maxLength={15}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm uppercase ${
                      errors.gstNumber && touched.gstNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="22AAAAA0000A1Z5"
                  />
                  {errors.gstNumber && touched.gstNumber && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.gstNumber}
                    </p>
                  )}
                  {!errors.gstNumber && touched.gstNumber && formData.gstNumber && (
                    <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                      <i className="ri-checkbox-circle-line"></i>
                      Valid GST format
                    </p>
                  )}
                </div>

                {/* PAN Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PAN Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    maxLength={10}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm uppercase ${
                      errors.panNumber && touched.panNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="ABCDE1234F"
                  />
                  {errors.panNumber && touched.panNumber && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.panNumber}
                    </p>
                  )}
                  {!errors.panNumber && touched.panNumber && formData.panNumber && (
                    <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                      <i className="ri-checkbox-circle-line"></i>
                      Valid PAN format
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.email && touched.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="vendor@example.com"
                  />
                  {errors.email && touched.email && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    maxLength={10}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.phone && touched.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="9876543210"
                  />
                  {errors.phone && touched.phone && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm cursor-pointer ${
                      errors.category && touched.category ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {errors.category && touched.category && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.category}
                    </p>
                  )}
                </div>

                {/* Address - Full Width */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    rows={3}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm resize-none ${
                      errors.address && touched.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter complete address with city, state, and pincode"
                  />
                  {errors.address && touched.address && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.address}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bank Account Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="ri-bank-line text-green-600 text-xl"></i>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Bank Account Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.accountNumber && touched.accountNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter account number"
                  />
                  {errors.accountNumber && touched.accountNumber && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.accountNumber}
                    </p>
                  )}
                </div>

                {/* IFSC Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IFSC Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ifscCode"
                    value={formData.ifscCode}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    maxLength={11}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm uppercase ${
                      errors.ifscCode && touched.ifscCode ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="SBIN0001234"
                  />
                  {errors.ifscCode && touched.ifscCode && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.ifscCode}
                    </p>
                  )}
                  {!errors.ifscCode && touched.ifscCode && formData.ifscCode && (
                    <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                      <i className="ri-checkbox-circle-line"></i>
                      Valid IFSC format
                    </p>
                  )}
                </div>

                {/* Bank Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.bankName && touched.bankName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter bank name"
                  />
                  {errors.bankName && touched.bankName && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.bankName}
                    </p>
                  )}
                </div>

                {/* Branch */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="branch"
                    value={formData.branch}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${
                      errors.branch && touched.branch ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter branch name"
                  />
                  {errors.branch && touched.branch && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.branch}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Documents */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="ri-file-upload-line text-purple-600 text-xl"></i>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Upload Documents</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* GST Certificate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Certificate <span className="text-red-500">*</span>
                  </label>
                  {!uploadedFiles.gst ? (
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      errors.gst ? 'border-red-500' : 'border-gray-300'
                    }`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <i className="ri-upload-cloud-2-line text-3xl text-gray-400 mb-2"></i>
                        <p className="text-xs text-gray-500 text-center px-2">Click to upload GST</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('gst', e)}
                      />
                    </label>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <i className="ri-file-text-line text-blue-600 text-xl flex-shrink-0 mt-0.5"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{uploadedFiles.gst.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(uploadedFiles.gst.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('gst')}
                          className="text-red-500 hover:text-red-700 cursor-pointer flex-shrink-0"
                        >
                          <i className="ri-close-line text-lg"></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {errors.gst && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.gst}
                    </p>
                  )}
                </div>

                {/* PAN Card */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PAN Card <span className="text-red-500">*</span>
                  </label>
                  {!uploadedFiles.pan ? (
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      errors.pan ? 'border-red-500' : 'border-gray-300'
                    }`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <i className="ri-upload-cloud-2-line text-3xl text-gray-400 mb-2"></i>
                        <p className="text-xs text-gray-500 text-center px-2">Click to upload PAN</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('pan', e)}
                      />
                    </label>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <i className="ri-file-text-line text-blue-600 text-xl flex-shrink-0 mt-0.5"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{uploadedFiles.pan.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(uploadedFiles.pan.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('pan')}
                          className="text-red-500 hover:text-red-700 cursor-pointer flex-shrink-0"
                        >
                          <i className="ri-close-line text-lg"></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {errors.pan && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.pan}
                    </p>
                  )}
                </div>

                {/* Cancelled Cheque */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cancelled Cheque <span className="text-red-500">*</span>
                  </label>
                  {!uploadedFiles.cheque ? (
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                      errors.cheque ? 'border-red-500' : 'border-gray-300'
                    }`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <i className="ri-upload-cloud-2-line text-3xl text-gray-400 mb-2"></i>
                        <p className="text-xs text-gray-500 text-center px-2">Click to upload Cheque</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileUpload('cheque', e)}
                      />
                    </label>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <i className="ri-file-text-line text-blue-600 text-xl flex-shrink-0 mt-0.5"></i>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{uploadedFiles.cheque.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(uploadedFiles.cheque.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile('cheque')}
                          className="text-red-500 hover:text-red-700 cursor-pointer flex-shrink-0"
                        >
                          <i className="ri-close-line text-lg"></i>
                        </button>
                      </div>
                    </div>
                  )}
                  {errors.cheque && (
                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i>
                      {errors.cheque}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-checkbox-circle-line text-green-600 text-4xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Vendor Created Successfully!</h3>
              <p className="text-gray-600 mb-6">
                Vendor <span className="font-semibold">{formData.vendorName}</span> has been added to the system.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CreateVendorPage;
