import { useState } from 'react';
import { InvoiceData } from '../../../../mocks/invoice-data';

interface PaymentExpandedRowProps {
  invoice: InvoiceData;
  onUploadPayment: (invoice: InvoiceData) => void;
}

export default function PaymentExpandedRow({ invoice, onUploadPayment }: PaymentExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'payment'>('summary');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-6 space-y-4">
      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-white rounded-lg p-1 border border-gray-200 w-fit">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'summary'
              ? 'bg-teal-50 text-teal-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Invoice Summary
        </button>
        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'payment'
              ? 'bg-teal-50 text-teal-700'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Payment Details
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Invoice Details */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-file-text-line text-teal-600"></i>
              </div>
              <span>Invoice Details</span>
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Number:</span>
                <span className="font-medium text-gray-900">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice Date:</span>
                <span className="text-gray-900">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Due Date:</span>
                <span className="text-gray-900">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Terms:</span>
                <span className="text-gray-900">{invoice.paymentTerms}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-gray-500">PO Reference:</span>
                <span className="font-medium text-gray-900">{invoice.poNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">GRN Reference:</span>
                <span className="font-medium text-gray-900">{invoice.grnNumber}</span>
              </div>
            </div>
          </div>

          {/* Vendor & Department */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-building-line text-teal-600"></i>
              </div>
              <span>Vendor & Department</span>
            </h4>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-gray-500 text-xs mb-0.5">Vendor:</div>
                <div className="font-medium text-gray-900">{invoice.vendor}</div>
                <div className="text-xs text-gray-500">{invoice.vendorGSTIN}</div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-500 text-xs mb-0.5">Department:</div>
                <div className="font-medium text-gray-900">{invoice.department}</div>
                <div className="text-xs text-gray-500">Requester: {invoice.requester}</div>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-500 text-xs mb-0.5">PR Title:</div>
                <div className="text-gray-900">{invoice.prTitle}</div>
              </div>
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 lg:col-span-2">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <i className="ri-calculator-line text-teal-600"></i>
              </div>
              <span>Billing Summary</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="text-gray-900">{formatCurrency(invoice.invoiceSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST (18%):</span>
                  <span className="text-gray-900">{formatCurrency(invoice.invoiceGST)}</span>
                </div>
              </div>
              <div className="md:col-span-2 flex items-center justify-end">
                <div className="bg-teal-50 rounded-lg px-6 py-3 border border-teal-200">
                  <div className="text-xs text-teal-600 font-medium mb-0.5">Grand Total</div>
                  <div className="text-2xl font-bold text-teal-700">
                    {formatCurrency(invoice.invoiceGrandTotal)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div className="space-y-4">
          {invoice.paymentDetails ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Information */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-bank-card-line text-emerald-600"></i>
                  </div>
                  <span>Payment Information</span>
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Date:</span>
                    <span className="font-medium text-gray-900">{formatDate(invoice.paymentDetails.paymentDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payment Mode:</span>
                    <span className="text-gray-900">{invoice.paymentDetails.paymentMode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bank Account:</span>
                    <span className="text-gray-900">{invoice.paymentDetails.bankAccount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">UTR / Reference:</span>
                    <span className="font-mono text-gray-900 text-xs">{invoice.paymentDetails.utrReference}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-gray-500">Amount Paid:</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(invoice.paymentDetails.amountPaid)}</span>
                  </div>
                </div>
              </div>

              {/* Upload Details */}
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center space-x-2">
                  <div className="w-5 h-5 flex items-center justify-center">
                    <i className="ri-file-upload-line text-emerald-600"></i>
                  </div>
                  <span>Upload Details</span>
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Uploaded By:</span>
                    <span className="font-medium text-gray-900">{invoice.paymentDetails.uploadedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Upload Date:</span>
                    <span className="text-gray-900">{invoice.paymentDetails.uploadedDate}</span>
                  </div>
                  {invoice.paymentDetails.receiptFileName && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="text-gray-500 text-xs mb-1">Payment Receipt:</div>
                      <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
                        <div className="w-8 h-8 flex items-center justify-center bg-emerald-100 rounded">
                          <i className="ri-file-pdf-line text-emerald-600"></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {invoice.paymentDetails.receiptFileName}
                          </div>
                          <div className="text-xs text-gray-500">{invoice.paymentDetails.receiptFileSize}</div>
                        </div>
                        <button className="text-teal-600 hover:text-teal-700 cursor-pointer">
                          <i className="ri-download-line"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {invoice.paymentDetails.remarks && (
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2 lg:col-span-2">
                  <h4 className="text-sm font-semibold text-gray-900">Remarks</h4>
                  <p className="text-sm text-gray-600">{invoice.paymentDetails.remarks}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-6 text-center">
              <div className="w-12 h-12 flex items-center justify-center bg-amber-100 rounded-full mx-auto mb-3">
                <i className="ri-alert-line text-amber-600 text-xl"></i>
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">Payment Not Yet Uploaded</h4>
              <p className="text-sm text-gray-600 mb-4">
                Upload payment details to complete the payment process for this invoice.
              </p>
              <button
                onClick={() => onUploadPayment(invoice)}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-upload-line mr-1.5"></i>
                Upload Payment Details
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}