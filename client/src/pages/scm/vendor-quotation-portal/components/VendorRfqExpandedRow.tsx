import { useState } from 'react';
import type { VendorRFQItem } from '../../../../mocks/vendor-quotation-portal-data';

interface Props {
  rfq: VendorRFQItem;
  colSpan?: number;
  onQuote?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function VendorRfqExpandedRow({ rfq, colSpan = 11, onQuote }: Props) {
  const [tab, setTab] = useState<'details' | 'items' | 'history'>('details');
  const canSubmit = rfq.status === 'Pending Quote' || rfq.status === 'Re-quote Requested';

  const tabs = [
    { key: 'details' as const, label: 'PR Details', icon: 'ri-information-line' },
    { key: 'items' as const, label: `Line Items (${rfq.lineItems.length})`, icon: 'ri-list-check-2' },
    {
      key: 'history' as const,
      label: `Quote History${rfq.quoteHistory.length ? ` (${rfq.quoteHistory.length})` : ''}`,
      icon: 'ri-history-line',
    },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-teal-100">
        <div className="m-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {rfq.rfqNumber} · {rfq.prNumber} — {rfq.prTitle}
              </p>
              <p className="text-xs text-gray-500">Full PR / RFQ details for quotation submission</p>
            </div>
            <div className="flex items-center gap-2">
              {canSubmit && onQuote && (
                <button
                  type="button"
                  onClick={onQuote}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold cursor-pointer"
                >
                  Submit Quote
                </button>
              )}
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
                {rfq.status}
              </span>
            </div>
          </div>

          <div className="flex border-b border-gray-100 px-3 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    ['RFQ Number', rfq.rfqNumber],
                    ['PR Number', rfq.prNumber],
                    ['Buyer', rfq.buyerName],
                    ['Department', rfq.buyerDepartment],
                    ['Company', rfq.company],
                    ['Issued', rfq.issuedDate],
                    ['Quote Due', rfq.dueDate],
                    ['Delivery By', rfq.requiredDeliveryDate],
                    ['Priority', rfq.priority],
                    ['Round', `Q${rfq.currentRound}`],
                    ['Est. Value', formatCurrency(rfq.estimatedValue)],
                    ['Quoted', rfq.quotedValue ? formatCurrency(rfq.quotedValue) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
                    </div>
                  ))}
                </div>
                {rfq.specialInstructions && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-amber-700 uppercase mb-1">Special Instructions</p>
                    <p className="text-sm text-amber-900">{rfq.specialInstructions}</p>
                  </div>
                )}
                {rfq.terms && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Terms</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{rfq.terms}</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'items' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Specifications</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase">Qty</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Est. Unit</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rfq.lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-xs text-gray-400">{item.category}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-xs">{item.specifications}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          {item.quantity} <span className="text-gray-400 text-xs">{item.unit}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.estimatedUnitPrice)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatCurrency(item.estimatedUnitPrice * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-teal-50 border-t">
                      <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">
                        Estimated Total
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-bold text-teal-700">
                        {formatCurrency(rfq.estimatedValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3">
                {rfq.quoteHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-4 text-center">No quote history yet.</p>
                ) : (
                  rfq.quoteHistory.map((h) => (
                    <div key={h.round} className="bg-gray-50 border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold text-gray-900">Round Q{h.round}</p>
                        <span className="text-xs font-semibold text-teal-700 capitalize">{h.status.replace(/-/g, ' ')}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{h.submittedDate}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span>
                          Amount: <strong>{formatCurrency(h.totalAmount)}</strong>
                        </span>
                        <span>Lead time: {h.leadTimeDays} days</span>
                        <span>{h.paymentTerms}</span>
                      </div>
                      {h.rejectionReason && (
                        <p className="text-sm text-red-700 mt-2 bg-red-50 border border-red-100 rounded p-2">
                          {h.rejectionReason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
