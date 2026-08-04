import { useState } from 'react';
import type { VendorRFQItem, RFQLineItem } from '../../../../mocks/vendor-quotation-portal-data';

interface QuotedLine extends RFQLineItem {
  quotedUnitPrice: number;
  leadTimeDays: number;
  remarks: string;
}

interface Props {
  rfq: VendorRFQItem;
  onClose: () => void;
  onSubmit: (id: string, quotedLines: QuotedLine[], paymentTerms: string, notes: string) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function QuoteSubmitModal({ rfq, onClose, onSubmit }: Props) {
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [lines, setLines] = useState<QuotedLine[]>(
    rfq.lineItems.map(li => ({
      ...li,
      quotedUnitPrice: li.quotedUnitPrice || li.estimatedUnitPrice,
      leadTimeDays: li.leadTimeDays || 14,
      remarks: li.remarks || '',
    }))
  );

  const updateLine = (id: string, field: keyof QuotedLine, value: unknown) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const totalQuoted = lines.reduce((sum, l) => sum + l.quotedUnitPrice * l.quantity, 0);
  const gst = totalQuoted * 0.18;
  const grandTotal = totalQuoted + gst;

  const handleSubmit = () => {
    const errs: string[] = [];
    if (lines.some(l => !l.quotedUnitPrice || l.quotedUnitPrice <= 0)) errs.push('All line items must have a quoted unit price.');
    if (!paymentTerms.trim()) errs.push('Payment terms are required.');
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    onSubmit(rfq.id, lines, paymentTerms, notes);
  };

  const isReQuote = rfq.status === 'Re-quote Requested';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-teal-100 rounded-lg">
              <i className="ri-price-tag-3-line text-teal-600 text-xl"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isReQuote ? `Re-Submit Quotation — Round ${rfq.currentRound}` : 'Submit Quotation'}
              </h2>
              <p className="text-sm text-gray-500">{rfq.rfqNumber} · {rfq.prTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg cursor-pointer">
            <i className="ri-close-line text-gray-500 text-lg"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Re-quote notice */}
          {isReQuote && rfq.reQuoteReason && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
                <i className="ri-refresh-line"></i> Buyer&apos;s Re-quote Request
              </p>
              <p className="text-sm text-amber-800">{rfq.reQuoteReason}</p>
              {rfq.reQuoteFields && rfq.reQuoteFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {rfq.reQuoteFields.map(f => (
                    <span key={f} className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-semibold">{f}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* RFQ Summary */}
          <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-500">Buyer</p>
              <p className="text-sm font-semibold text-gray-900">{rfq.buyerName}</p>
              <p className="text-xs text-gray-500">{rfq.buyerDepartment}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Quote Due Date</p>
              <p className="text-sm font-semibold text-red-600">{rfq.dueDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Required Delivery</p>
              <p className="text-sm font-semibold text-gray-900">{rfq.requiredDeliveryDate}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <i className="ri-list-check-2 text-teal-600"></i>
              Line Items — Enter Your Prices
            </p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Est. Price</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-teal-600 uppercase">Your Unit Price*</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Lead Time (Days)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map(line => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{line.description}</p>
                        <p className="text-xs text-gray-400">{line.category} · {line.unit}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">{line.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{formatCurrency(line.estimatedUnitPrice)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          value={line.quotedUnitPrice || ''}
                          onChange={e => updateLine(line.id, 'quotedUnitPrice', parseFloat(e.target.value) || 0)}
                          className="w-32 mx-auto block border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={line.leadTimeDays || ''}
                          onChange={e => updateLine(line.id, 'leadTimeDays', parseInt(e.target.value) || 0)}
                          className="w-20 mx-auto block border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="14"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {line.quotedUnitPrice > 0 ? formatCurrency(line.quotedUnitPrice * line.quantity) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Terms & Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Terms *</label>
              <select
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
                <option>50% Advance, 50% on Delivery</option>
                <option>30% Advance, 70% on Delivery</option>
                <option>100% Advance</option>
                <option>LC at Sight</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Notes / Remarks</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Any special conditions, discounts, or remarks..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
          </div>

          {/* Billing Summary */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <p className="text-sm font-bold text-teal-800 mb-3 flex items-center gap-2">
              <i className="ri-calculator-line"></i> Quote Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal ({lines.length} items)</span>
                <span className="font-semibold text-gray-900">{formatCurrency(totalQuoted)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST @ 18%</span>
                <span className="font-semibold text-gray-900">{formatCurrency(gst)}</span>
              </div>
              <div className="border-t border-teal-300 pt-2 flex justify-between">
                <span className="font-bold text-teal-800">Grand Total (incl. GST)</span>
                <span className="font-bold text-teal-700 text-lg">{formatCurrency(grandTotal)}</span>
              </div>
              {rfq.estimatedValue > 0 && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-gray-500">Buyer&apos;s Budget Estimate</span>
                  <span className={`font-semibold ${totalQuoted <= rfq.estimatedValue ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatCurrency(rfq.estimatedValue)}
                    {totalQuoted <= rfq.estimatedValue
                      ? <span className="ml-1">(Within budget ✓)</span>
                      : <span className="ml-1">(Over by {formatCurrency(totalQuoted - rfq.estimatedValue)})</span>}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-red-700 flex items-center gap-2">
                  <i className="ri-error-warning-line"></i> {e}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-500">Round {rfq.currentRound} · {rfq.rfqNumber}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm whitespace-nowrap cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <i className="ri-send-plane-fill"></i>
              {isReQuote ? 'Re-Submit Quotation' : 'Submit Quotation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
