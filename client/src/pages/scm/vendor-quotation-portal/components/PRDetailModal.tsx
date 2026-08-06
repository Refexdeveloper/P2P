import { useState } from 'react';
import type { VendorRFQItem } from '../../../../mocks/vendor-quotation-portal-data';

interface Props {
  rfq: VendorRFQItem;
  onClose: () => void;
  onUploadQuotation: (rfq: VendorRFQItem) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const tabs = ['PR Details', 'Line Items', 'Terms & Docs', 'Quote History'] as const;
type Tab = typeof tabs[number];

export default function PRDetailModal({ rfq, onClose, onUploadQuotation }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('PR Details');

  const canSubmit = rfq.status === 'Pending Quote' || rfq.status === 'Re-quote Requested';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-7 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-teal-50 rounded-xl">
              <i className="ri-file-list-3-line text-teal-600 text-2xl"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-gray-900">{rfq.prTitle}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: rfq.status === 'Pending Quote' ? '#fef3c7' : rfq.status === 'Re-quote Requested' ? '#fee2e2' : rfq.status === 'Quote Accepted' ? '#d1fae5' : rfq.status === 'Quote Submitted' ? '#dbeafe' : '#f1f5f9',
                    color: rfq.status === 'Pending Quote' ? '#92400e' : rfq.status === 'Re-quote Requested' ? '#991b1b' : rfq.status === 'Quote Accepted' ? '#065f46' : rfq.status === 'Quote Submitted' ? '#1e40af' : '#475569',
                  }}
                >
                  {rfq.status}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: rfq.priority === 'High' ? '#fee2e2' : rfq.priority === 'Medium' ? '#fef3c7' : '#f1f5f9',
                    color: rfq.priority === 'High' ? '#991b1b' : rfq.priority === 'Medium' ? '#92400e' : '#475569',
                  }}
                >
                  {rfq.priority} Priority
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="font-semibold text-teal-600">{rfq.rfqNumber}</span>
                <span>·</span>
                <span>{rfq.prNumber}</span>
                <span>·</span>
                <span>Due: <strong className="text-red-600">{rfq.dueDate}</strong></span>
                <span>·</span>
                <span>Round Q{rfq.currentRound}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-xl cursor-pointer transition-colors mt-0.5"
          >
            <i className="ri-close-line text-gray-500 text-xl"></i>
          </button>
        </div>

        {/* Re-quote Banner */}
        {rfq.status === 'Re-quote Requested' && rfq.reQuoteReason && (
          <div className="mx-7 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="w-6 h-6 flex items-center justify-center mt-0.5">
              <i className="ri-refresh-line text-amber-600"></i>
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700 mb-1">Buyer Requested Re-quote — Please revise and resubmit</p>
              <p className="text-sm text-amber-800">{rfq.reQuoteReason}</p>
              {rfq.reQuoteFields && rfq.reQuoteFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {rfq.reQuoteFields.map(f => (
                    <span key={f} className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">{f}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-7 pt-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer whitespace-nowrap"
                style={{
                  background: activeTab === tab ? '#fff' : 'transparent',
                  color: activeTab === tab ? '#0f766e' : '#64748b',
                }}
              >
                {tab}
                {tab === 'Quote History' && rfq.quoteHistory.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-teal-600 text-white rounded-full text-xs">{rfq.quoteHistory.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-7 py-5">

          {/* PR Details */}
          {activeTab === 'PR Details' && (
            <div className="space-y-5">
              {/* Key Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Buyer Information</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-400">Buyer Name</p>
                      <p className="text-sm font-semibold text-gray-900">{rfq.buyerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Department</p>
                      <p className="text-sm font-semibold text-gray-900">{rfq.buyerDepartment}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Company</p>
                      <p className="text-sm font-semibold text-gray-900">{rfq.company}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key Dates</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">RFQ Issued</span>
                      <span className="text-sm font-semibold text-gray-900">{rfq.issuedDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Quote Due</span>
                      <span className="text-sm font-bold text-red-600">{rfq.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Delivery By</span>
                      <span className="text-sm font-semibold text-gray-900">{rfq.requiredDeliveryDate}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-teal-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-3">Financials</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-teal-600">Estimated Budget</p>
                      <p className="text-xl font-bold text-teal-700">{formatCurrency(rfq.estimatedValue)}</p>
                    </div>
                    {rfq.quotedValue && (
                      <div>
                        <p className="text-xs text-teal-600">Your Last Quote</p>
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(rfq.quotedValue)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-teal-600">Quote Round</p>
                      <p className="text-sm font-bold text-teal-700">Q{rfq.currentRound}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Summary */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-700">Line Items Summary</p>
                  <span className="text-xs text-gray-400">{rfq.lineItems.length} items</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                      <th className="px-5 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Est. Unit Price</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfq.lineItems.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-900">{item.description}</p>
                          <p className="text-xs text-gray-400">{item.category} · {item.unit}</p>
                        </td>
                        <td className="px-5 py-3 text-center font-bold text-gray-900">{item.quantity}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{formatCurrency(item.estimatedUnitPrice)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">{formatCurrency(item.estimatedUnitPrice * item.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f0fdfa' }}>
                      <td colSpan={3} className="px-5 py-3 text-right font-bold text-gray-800">Total Estimated Value</td>
                      <td className="px-5 py-3 text-right font-bold text-teal-700 text-base">{formatCurrency(rfq.estimatedValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Line Items Full Detail */}
          {activeTab === 'Line Items' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Specifications</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Qty / Unit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Est. Unit</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Est. Total</th>
                    {rfq.quotedValue && (
                      <>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-teal-600 uppercase">Quoted Unit</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-teal-600 uppercase">Quoted Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rfq.lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                      <td className="px-5 py-4 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{item.description}</p>
                        <p className="text-xs text-gray-400">{item.category}</p>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-500 max-w-xs leading-relaxed">{item.specifications}</td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-gray-900">{item.quantity}</span>
                        <span className="text-gray-400 text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600">{formatCurrency(item.estimatedUnitPrice)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-gray-900">{formatCurrency(item.estimatedUnitPrice * item.quantity)}</td>
                      {rfq.quotedValue && (
                        <>
                          <td className="px-5 py-4 text-right font-semibold text-teal-600">
                            {item.quotedUnitPrice ? formatCurrency(item.quotedUnitPrice) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-teal-700">
                            {item.quotedTotal ? formatCurrency(item.quotedTotal) : <span className="text-gray-300">—</span>}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f0fdfa' }}>
                    <td colSpan={rfq.quotedValue ? 5 : 4} className="px-5 py-3 text-right font-bold text-gray-800">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-teal-700">{formatCurrency(rfq.estimatedValue)}</td>
                    {rfq.quotedValue && (
                      <>
                        <td></td>
                        <td className="px-5 py-3 text-right font-bold text-teal-700">{formatCurrency(rfq.quotedValue)}</td>
                      </>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Terms & Docs */}
          {activeTab === 'Terms & Docs' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Terms</p>
                <p className="text-sm text-gray-800 leading-relaxed">{rfq.terms}</p>
              </div>
              {rfq.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <i className="ri-alert-line"></i> Special Instructions
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed">{rfq.specialInstructions}</p>
                </div>
              )}
              {rfq.attachments.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Buyer Attachments</p>
                  <div className="space-y-2">
                    {rfq.attachments.map(att => (
                      <div key={att} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center bg-red-100 rounded-lg">
                            <i className="ri-file-pdf-line text-red-600"></i>
                          </div>
                          <span className="text-sm font-medium text-gray-800">{att}</span>
                        </div>
                        <div className="w-7 h-7 flex items-center justify-center">
                          <i className="ri-download-line text-teal-600"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quote History */}
          {activeTab === 'Quote History' && (
            <div>
              {rfq.quoteHistory.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                  <div className="w-14 h-14 flex items-center justify-center bg-gray-200 rounded-full mx-auto mb-3">
                    <i className="ri-history-line text-gray-400 text-2xl"></i>
                  </div>
                  <p className="text-gray-500 font-medium">No quote history yet</p>
                  <p className="text-gray-400 text-sm mt-1">Submit your first quotation to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rfq.quoteHistory.map(h => (
                    <div key={h.round} className="bg-white border border-gray-200 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center rounded-full"
                            style={{ background: h.status === 'accepted' ? '#d1fae5' : h.status === 're-quote-requested' ? '#fef3c7' : '#fee2e2' }}
                          >
                            <i className={h.status === 'accepted' ? 'ri-check-line' : h.status === 're-quote-requested' ? 'ri-refresh-line' : 'ri-close-line'}
                              style={{ color: h.status === 'accepted' ? '#059669' : h.status === 're-quote-requested' ? '#d97706' : '#dc2626', fontSize: '18px' }}
                            ></i>
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">Round {h.round} — {formatCurrency(h.totalAmount)}</p>
                            <p className="text-xs text-gray-400">Submitted: {h.submittedDate} · Lead: {h.leadTimeDays} days · {h.paymentTerms}</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-bold"
                          style={{
                            background: h.status === 'accepted' ? '#d1fae5' : h.status === 're-quote-requested' ? '#fef3c7' : '#fee2e2',
                            color: h.status === 'accepted' ? '#065f46' : h.status === 're-quote-requested' ? '#92400e' : '#991b1b',
                          }}
                        >
                          {h.status === 'accepted' ? 'Accepted' : h.status === 're-quote-requested' ? 'Re-quote Requested' : 'Rejected'}
                        </span>
                      </div>
                      {(h.rejectionReason || (h.reQuoteFields && h.reQuoteFields.length > 0)) && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 mt-2">
                          {h.rejectionReason && <p className="text-sm text-amber-800"><strong>Reason:</strong> {h.rejectionReason}</p>}
                          {h.reQuoteFields && h.reQuoteFields.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {h.reQuoteFields.map(f => (
                                <span key={f} className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">{f}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">{rfq.lineItems.length} line items · Est. {formatCurrency(rfq.estimatedValue)}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm whitespace-nowrap cursor-pointer transition-colors"
            >
              Close
            </button>
            {canSubmit && (
              <button
                onClick={() => onUploadQuotation(rfq)}
                className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
              >
                <i className="ri-upload-cloud-2-line"></i>
                {rfq.status === 'Re-quote Requested' ? `Re-Submit Quotation (Round ${rfq.currentRound})` : 'Upload Quotation'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
