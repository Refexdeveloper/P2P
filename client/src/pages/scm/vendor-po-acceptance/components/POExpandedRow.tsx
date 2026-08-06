import { useState } from 'react';
import type { VendorPOData, VendorPOAcceptanceStatus } from '../../../../mocks/vendor-po-acceptance-data';
import PODocumentView from './PODocumentView';

interface POExpandedRowProps {
  po: VendorPOData;
  onAccept: () => void;
  onReject: () => void;
  onPartial: () => void;
  status: VendorPOAcceptanceStatus;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function POExpandedRow({ po, onAccept, onReject, onPartial, status }: POExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'response' | 'document'>('details');
  const isPending = status === 'Pending Acceptance';

  return (
    <tr>
      <td colSpan={9} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <i className="ri-file-text-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{po.poNumber}</p>
                <p className="text-xs text-gray-500">{po.prTitle} · Issued by {po.issuedBy}</p>
              </div>
            </div>
            {isPending && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onPartial}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-git-commit-line"></i> Partial Accept
                </button>
                <button
                  onClick={onReject}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-close-circle-line"></i> Reject PO
                </button>
                <button
                  onClick={onAccept}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                >
                  <i className="ri-check-double-line"></i> Accept PO
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-white">
            {[
              { key: 'details', label: 'PO Details', icon: 'ri-information-line' },
              { key: 'items', label: 'Line Items', icon: 'ri-list-check-2' },
              { key: 'response', label: 'Vendor Response', icon: 'ri-reply-line' },
              { key: 'document', label: 'PO Document', icon: 'ri-file-pdf-line' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'details' | 'items' | 'response' | 'document')}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? tab.key === 'document'
                      ? 'border-red-500 text-red-600'
                      : 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab !== 'document' && (
            <div className="p-6">
              {/* Details Tab */}
              {activeTab === 'details' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Summary Row */}
                  <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'PO Number', value: po.poNumber, icon: 'ri-file-text-line' },
                      { label: 'Issued Date', value: po.issuedDate, icon: 'ri-calendar-line' },
                      { label: 'Acceptance Due', value: po.acceptanceDueDate, icon: 'ri-time-line' },
                      { label: 'Expected Delivery', value: po.expectedDeliveryDate, icon: 'ri-truck-line' },
                    ].map((item) => (
                      <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                          <i className={`${item.icon} text-xs`}></i>{item.label}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Left - 2 cols */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <i className="ri-store-2-line text-teal-500"></i> Vendor Details
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Vendor Name</p>
                          <p className="text-sm font-semibold text-gray-900">{po.vendorName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Vendor Code</p>
                          <p className="text-sm font-semibold text-teal-600">{po.vendorCode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Contact Person</p>
                          <p className="text-sm font-medium text-gray-900">{po.vendorContact}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Email</p>
                          <p className="text-sm font-medium text-gray-900">{po.vendorEmail}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                        <i className="ri-map-pin-line text-teal-500"></i> Delivery Information
                      </h4>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                          <p className="text-sm font-semibold text-gray-900">{po.paymentTerms}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Department</p>
                          <p className="text-sm font-medium text-gray-900">{po.department}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Delivery Address</p>
                        <p className="text-sm text-gray-800 leading-relaxed">{po.deliveryAddress}</p>
                      </div>
                    </div>

                    {po.specialInstructions && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <i className="ri-alert-line"></i> Special Instructions
                        </h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{po.specialInstructions}</p>
                      </div>
                    )}
                  </div>

                  {/* Right - Billing */}
                  <div className="lg:col-span-1">
                    <div className="bg-gray-50 rounded-lg p-4 sticky top-4">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                        <i className="ri-receipt-line text-teal-500"></i> Billing Summary
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Subtotal</span>
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(po.subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">GST ({po.gstPercentage}%)</span>
                          <span className="text-sm font-medium text-gray-900">{formatCurrency(po.taxAmount)}</span>
                        </div>
                        <div className="pt-3 border-t-2 border-gray-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-900">Grand Total</span>
                            <span className="text-xl font-bold text-teal-600">{formatCurrency(po.grandTotal)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Issued By</p>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-teal-700 text-xs font-bold">
                              {po.issuedBy.split(' ').map((n) => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{po.issuedBy}</p>
                            <p className="text-xs text-gray-500">{po.issuedByRole}</p>
                          </div>
                        </div>
                      </div>

                      {isPending && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                          <button
                            onClick={onAccept}
                            className="w-full py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                          >
                            <i className="ri-check-double-line"></i> Accept PO
                          </button>
                          <button
                            onClick={onReject}
                            className="w-full py-2 text-xs font-semibold text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                          >
                            <i className="ri-close-circle-line"></i> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Items Tab */}
              {activeTab === 'items' && (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['#', 'Item Description', 'Specifications', 'Unit', 'Qty', 'Unit Price', 'Total'].map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide ${
                              h === '#' || h === 'Qty' ? 'text-center' :
                              h === 'Unit Price' || h === 'Total' ? 'text-right' : 'text-left'
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {po.lineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 text-sm text-gray-500 text-center">{idx + 1}</td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-gray-900">{item.description}</p>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-xs text-gray-500 max-w-[220px]">{item.specifications || '—'}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">{item.unit}</td>
                          <td className="px-4 py-4 text-sm text-gray-700 text-center font-medium">{item.quantity}</td>
                          <td className="px-4 py-4 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-4 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Subtotal</td>
                        <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(po.subtotal)}</td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="px-4 py-2 text-sm text-gray-600 text-right">GST ({po.gstPercentage}%)</td>
                        <td colSpan={2} className="px-4 py-2 text-sm text-gray-700 text-right">{formatCurrency(po.taxAmount)}</td>
                      </tr>
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-base font-bold text-gray-900 text-right">Grand Total</td>
                        <td colSpan={2} className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(po.grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Response Tab */}
              {activeTab === 'response' && (
                <div className="max-w-2xl">
                  {status === 'Pending Acceptance' ? (
                    <div className="text-center py-10">
                      <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="ri-time-line text-amber-500 text-2xl"></i>
                      </div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Awaiting Vendor Response</p>
                      <p className="text-xs text-gray-500 mb-5">Acceptance due by <span className="font-semibold text-gray-700">{po.acceptanceDueDate}</span></p>
                      <div className="flex justify-center gap-3">
                        <button onClick={onAccept} className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                          <i className="ri-check-double-line"></i> Accept PO
                        </button>
                        <button onClick={onPartial} className="px-5 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                          <i className="ri-git-commit-line"></i> Partial Accept
                        </button>
                        <button onClick={onReject} className="px-5 py-2 text-xs font-semibold text-red-600 border border-red-300 rounded-lg hover:bg-red-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                          <i className="ri-close-circle-line"></i> Reject
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Response Status Banner */}
                      <div className={`rounded-xl border p-5 ${
                        status === 'Accepted' ? 'bg-emerald-50 border-emerald-200' :
                        status === 'Rejected' ? 'bg-red-50 border-red-200' :
                        'bg-amber-50 border-amber-200'
                      }`}>
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            status === 'Accepted' ? 'bg-emerald-100' :
                            status === 'Rejected' ? 'bg-red-100' : 'bg-amber-100'
                          }`}>
                            <i className={`text-lg ${
                              status === 'Accepted' ? 'ri-check-double-line text-emerald-600' :
                              status === 'Rejected' ? 'ri-close-circle-line text-red-600' :
                              'ri-git-commit-line text-amber-600'
                            }`}></i>
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${
                              status === 'Accepted' ? 'text-emerald-800' :
                              status === 'Rejected' ? 'text-red-800' : 'text-amber-800'
                            }`}>
                              {status === 'Accepted' ? 'PO Accepted' : status === 'Rejected' ? 'PO Rejected' : 'Partially Accepted'}
                            </p>
                            {po.acceptanceDate && (
                              <p className="text-xs text-gray-500 mt-0.5">Responded on {po.acceptanceDate}</p>
                            )}
                          </div>
                        </div>

                        {(po.acceptanceRemarks || po.rejectionReason) && (
                          <div className="bg-white/70 rounded-lg p-4">
                            <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                              {status === 'Rejected' ? 'Rejection Reason' : 'Vendor Remarks'}
                            </p>
                            <p className="text-sm text-gray-800 leading-relaxed">
                              {po.rejectionReason || po.acceptanceRemarks}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Delivery Confirmation */}
                      {po.deliveryConfirmedDate && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                          <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ri-truck-line text-teal-600"></i>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Confirmed Delivery Date</p>
                            <p className="text-sm font-bold text-gray-900">{po.deliveryConfirmedDate}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PO Document Tab */}
          {activeTab === 'document' && (
            <PODocumentView
              po={po}
              isPending={isPending}
              onAccept={onAccept}
              onReject={onReject}
              onPartial={onPartial}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
