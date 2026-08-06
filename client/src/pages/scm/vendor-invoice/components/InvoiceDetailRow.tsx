import { useState } from 'react';
import type { VendorInvoiceData, VendorInvoiceStatus } from '../../../../mocks/vendor-invoice-data';

interface InvoiceDetailRowProps {
  invoice: VendorInvoiceData;
  status: VendorInvoiceStatus;
  onSubmit: () => void;
  onResubmit: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function InvoiceDetailRow({ invoice, status, onSubmit, onResubmit }: InvoiceDetailRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'lineitems' | 'tracking'>('details');

  const tabs = [
    { key: 'details', label: 'Invoice Details', icon: 'ri-file-text-line' },
    { key: 'lineitems', label: 'Line Items', icon: 'ri-list-check-2' },
    { key: 'tracking', label: 'Status & Tracking', icon: 'ri-map-pin-time-line' },
  ];

  const trackingSteps: { label: string; done: boolean; date?: string; note?: string }[] = [
    { label: 'Invoice Created', done: true, date: invoice.invoiceDate, note: `Prepared by ${invoice.vendorContact}` },
    {
      label: 'Submitted to Accounts',
      done: status !== 'Draft',
      date: status !== 'Draft' ? invoice.submittedDate : undefined,
      note: status !== 'Draft' ? 'Submitted for 3-way match verification' : undefined,
    },
    {
      label: 'Under Verification',
      done: ['Under Verification', 'Approved for Payment', 'Paid', 'Discrepancy'].includes(status),
      note: 'Accounts team verifying PO, GRN & Invoice',
    },
    {
      label: status === 'Discrepancy' ? 'Discrepancy Raised' : 'Approved for Payment',
      done: ['Approved for Payment', 'Paid', 'Discrepancy'].includes(status),
      note: status === 'Discrepancy' ? invoice.discrepancyReason : 'Cleared for payment processing',
    },
    {
      label: 'Payment Processed',
      done: status === 'Paid',
      date: invoice.paymentDate,
      note: invoice.paymentRef ? `Ref: ${invoice.paymentRef}` : undefined,
    },
  ];

  return (
    <tr>
      <td colSpan={10} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                <i className="ri-file-invoice-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{invoice.invoiceNumber}</p>
                <p className="text-xs text-gray-500">{invoice.prTitle} · {invoice.vendorName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {status === 'Draft' && (
                <button
                  onClick={onSubmit}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-send-plane-line"></i> Submit Invoice
                </button>
              )}
              {status === 'Discrepancy' && (
                <button
                  onClick={onResubmit}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-refresh-line"></i> Re-submit Invoice
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-white">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'details' | 'lineitems' | 'tracking')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Details Tab */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Dates strip */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Invoice Date', value: invoice.invoiceDate, icon: 'ri-file-text-line' },
                    { label: 'Submitted Date', value: status !== 'Draft' ? invoice.submittedDate : '—', icon: 'ri-send-plane-line' },
                    { label: 'GRN Date', value: invoice.grnDate, icon: 'ri-truck-line' },
                    { label: 'Payment Due', value: invoice.dueDate, icon: 'ri-calendar-line' },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><i className={`${item.icon} text-xs text-teal-500`}></i>{item.label}</p>
                      <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Vendor & GRN info */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-store-2-line text-teal-500"></i> Vendor Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-gray-400 mb-0.5">Vendor Name</p><p className="text-sm font-semibold text-gray-900">{invoice.vendorName}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Vendor Code</p><p className="text-sm font-semibold text-teal-600">{invoice.vendorCode}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Contact Person</p><p className="text-sm font-medium text-gray-900">{invoice.vendorContact}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="text-sm font-medium text-gray-900">{invoice.vendorEmail}</p></div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-bank-card-line text-teal-500"></i> Bank & Payment Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-gray-400 mb-0.5">Bank Name</p><p className="text-sm font-semibold text-gray-900">{invoice.bankName}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Account No.</p><p className="text-sm font-semibold text-gray-900">{invoice.bankAccount}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">IFSC Code</p><p className="text-sm font-semibold text-gray-900">{invoice.ifscCode}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Payment Terms</p><p className="text-sm font-semibold text-gray-900">{invoice.paymentTerms}</p></div>
                    </div>
                    {status === 'Paid' && invoice.paymentRef && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <i className="ri-checkbox-circle-fill text-emerald-500"></i>
                          <span className="text-xs font-semibold text-emerald-700">Payment Completed</span>
                          <span className="text-xs text-gray-500">· {invoice.paymentDate} · {invoice.paymentRef}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GRN Info */}
                  <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-archive-line text-violet-500"></i> GRN Reference
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-gray-400 mb-0.5">GRN Number</p><p className="text-sm font-semibold text-violet-600">{invoice.grnNumber}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">GRN Date</p><p className="text-sm font-semibold text-gray-900">{invoice.grnDate}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">PO Reference</p><p className="text-sm font-semibold text-teal-600">{invoice.poNumber}</p></div>
                      <div><p className="text-xs text-gray-400 mb-0.5">Department</p><p className="text-sm font-medium text-gray-900">{invoice.department}</p></div>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <i className="ri-attachment-2 text-gray-400"></i> Attached Documents
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {invoice.attachments.map((att) => (
                        <div key={att} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                          <i className="ri-file-pdf-2-line text-red-500 text-xs"></i>
                          <span className="text-xs text-red-700 font-medium">{att}</span>
                          <i className="ri-download-line text-red-400 text-xs ml-1"></i>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl p-4 sticky top-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <i className="ri-receipt-line text-teal-500"></i> Invoice Summary
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Subtotal</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(invoice.subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">GST ({invoice.gstPercentage}%)</span>
                        <span className="text-sm font-medium text-gray-900">{formatCurrency(invoice.taxAmount)}</span>
                      </div>
                      <div className="pt-3 border-t-2 border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900">Total Amount</span>
                          <span className="text-xl font-bold text-teal-600">{formatCurrency(invoice.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {invoice.remarks && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 mb-1.5">Vendor Remarks</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{invoice.remarks}</p>
                      </div>
                    )}

                    {status === 'Discrepancy' && invoice.discrepancyReason && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1"><i className="ri-error-warning-line"></i> Discrepancy</p>
                        <p className="text-xs text-red-600 leading-relaxed">{invoice.discrepancyReason}</p>
                        <button
                          onClick={onResubmit}
                          className="mt-3 w-full py-2 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                        >
                          <i className="ri-refresh-line"></i> Re-submit
                        </button>
                      </div>
                    )}

                    {status === 'Draft' && (
                      <button
                        onClick={onSubmit}
                        className="mt-4 w-full py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                      >
                        <i className="ri-send-plane-line"></i> Submit Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Line Items Tab */}
            {activeTab === 'lineitems' && (
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Description', 'PO Ref', 'Unit', 'PO Qty', 'Delivered', 'Invoiced', 'Unit Price', 'Total'].map((h) => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap ${
                            ['#', 'PO Qty', 'Delivered', 'Invoiced'].includes(h) ? 'text-center' :
                            ['Unit Price', 'Total'].includes(h) ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoice.lineItems.map((item, idx) => {
                      const qtyMismatch = item.invoicedQty > item.deliveredQty;
                      return (
                        <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${qtyMismatch ? 'bg-red-50/40' : ''}`}>
                          <td className="px-4 py-3.5 text-center text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-semibold text-gray-900">{item.description}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs font-medium text-teal-600">{item.poLineRef}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-700">{item.unit}</td>
                          <td className="px-4 py-3.5 text-center text-sm text-gray-700">{item.poQty}</td>
                          <td className="px-4 py-3.5 text-center text-sm text-gray-700">{item.deliveredQty}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`text-sm font-semibold ${qtyMismatch ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.invoicedQty}
                              {qtyMismatch && <i className="ri-error-warning-line ml-1 text-xs"></i>}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm text-gray-700">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-gray-900">{formatCurrency(item.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Subtotal</td>
                      <td colSpan={2} className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(invoice.subtotal)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({invoice.gstPercentage}%)</td>
                      <td colSpan={2} className="px-4 py-2 text-sm text-right">{formatCurrency(invoice.taxAmount)}</td>
                    </tr>
                    <tr>
                      <td colSpan={7} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                      <td colSpan={2} className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(invoice.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Tracking Tab */}
            {activeTab === 'tracking' && (
              <div className="max-w-xl">
                <div className="space-y-0">
                  {trackingSteps.map((step, idx) => {
                    const isDiscrepancyStep = idx === 3 && status === 'Discrepancy';
                    const isLast = idx === trackingSteps.length - 1;
                    return (
                      <div key={idx} className="flex gap-4">
                        {/* Line + dot */}
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            step.done
                              ? isDiscrepancyStep
                                ? 'bg-red-100 border-2 border-red-400'
                                : 'bg-teal-100 border-2 border-teal-500'
                              : 'bg-gray-100 border-2 border-gray-300'
                          }`}>
                            {step.done ? (
                              <i className={`text-sm ${isDiscrepancyStep ? 'ri-error-warning-line text-red-600' : 'ri-check-line text-teal-600'}`}></i>
                            ) : (
                              <i className="ri-time-line text-gray-400 text-sm"></i>
                            )}
                          </div>
                          {!isLast && (
                            <div className={`w-0.5 flex-1 my-1 ${step.done && !isDiscrepancyStep ? 'bg-teal-300' : 'bg-gray-200'}`} style={{ minHeight: 28 }}></div>
                          )}
                        </div>

                        {/* Content */}
                        <div className={`pb-6 flex-1 ${isLast ? '' : ''}`}>
                          <p className={`text-sm font-semibold ${
                            step.done
                              ? isDiscrepancyStep ? 'text-red-700' : 'text-gray-900'
                              : 'text-gray-400'
                          }`}>
                            {step.label}
                          </p>
                          {step.date && (
                            <p className="text-xs text-gray-500 mt-0.5">{step.date}</p>
                          )}
                          {step.note && (
                            <p className={`text-xs mt-0.5 leading-relaxed ${isDiscrepancyStep ? 'text-red-500' : 'text-gray-500'}`}>{step.note}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
