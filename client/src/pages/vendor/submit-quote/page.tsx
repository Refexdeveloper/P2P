import { useState, useEffect, FormEvent, ChangeEvent, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../../services/api';

type VendorField = { id: string; label: string; type: string; core?: boolean; required?: boolean };

type PrLineItem = {
  id?: number | string;
  description: string;
  category?: string;
  quantity: number;
  unitCost: number;
  total: number;
};

type QuoteLineDraft = {
  lineItemId: string;
  description: string;
  category: string;
  quantity: number | '';
  estimatedUnitCost: number;
  quotedUnitPrice: number | '';
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    n || 0
  );
}

export default function VendorSubmitQuotePage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [rfqData, setRfqData] = useState<{
    invitation: { vendorName: string; round: number; sendBackReason?: string; sendBackFields?: string[] };
    pr: {
      prNumber: string;
      title: string;
      department: string;
      totalAmount: number;
      justification: string;
      lineItems: PrLineItem[];
    };
    fieldDefinitions?: VendorField[];
    canSubmit: boolean;
  } | null>(null);

  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>({});
  const [quoteLines, setQuoteLines] = useState<QuoteLineDraft[]>([]);
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [zeroConfirm, setZeroConfirm] = useState(false);

  const quoteTotal = useMemo(
    () =>
      quoteLines.reduce((sum, line) => {
        const unit = Number(line.quotedUnitPrice) || 0;
        return sum + unit * (Number(line.quantity) || 0);
      }, 0),
    [quoteLines]
  );

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB');
      return;
    }
    setQuotationFile(file);
    setError('');
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/rfq/quote/${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.message && !res.data) throw new Error(res.message);
        setRfqData(res.data);
        const defs = (res.data?.fieldDefinitions || []) as VendorField[];
        const initial: Record<string, string | number | boolean> = {};
        for (const f of defs) {
          if (f.id === 'quotedPrice') initial[f.id] = '';
          else if (f.type === 'boolean') initial[f.id] = true;
          else if (f.id === 'paymentTerms') initial[f.id] = 'Net 30';
          else initial[f.id] = '';
        }
        if (!defs.some((f) => f.id === 'quotedPrice')) initial.quotedPrice = '';
        setFieldValues(initial);

        const lines: QuoteLineDraft[] = ((res.data?.pr?.lineItems || []) as PrLineItem[]).map((li, idx) => ({
          lineItemId: String(li.id ?? idx + 1),
          description: li.description,
          category: li.category || '',
          quantity: Number(li.quantity) || 0,
          estimatedUnitCost: Number(li.unitCost) || 0,
          quotedUnitPrice: '',
        }));
        setQuoteLines(lines);
      })
      .catch((err) => setError(err.message || 'Failed to load RFQ'))
      .finally(() => setLoading(false));
  }, [token]);

  const setField = (id: string, value: string | number | boolean) => {
    setFieldValues((prev) => ({ ...prev, [id]: value }));
  };

  const updateLineField = (lineItemId: string, field: 'quotedUnitPrice' | 'quantity', value: string) => {
    setQuoteLines((prev) =>
      prev.map((line) => {
        if (line.lineItemId !== lineItemId) return line;
        if (value === '') return { ...line, [field]: '' };
        const n = Number(value);
        if (field === 'quantity') return { ...line, quantity: Math.max(1, Number.isNaN(n) ? 1 : n) };
        return { ...line, quotedUnitPrice: Math.max(0, Number.isNaN(n) ? 0 : n) };
      })
    );
  };

  const handleSubmit = async (e: FormEvent, acceptZero = false) => {
    e.preventDefault();
    if (!token) return;
    if (quoteLines.some((l) => !l.quantity || Number(l.quantity) <= 0)) {
      setError('Enter quantity for every line item');
      return;
    }
    if (
      quoteLines.some((l) => {
        if (l.quotedUnitPrice === '' || l.quotedUnitPrice === null || l.quotedUnitPrice === undefined) return true;
        const n = Number(l.quotedUnitPrice);
        return Number.isNaN(n) || n < 0;
      })
    ) {
      setError('Enter quoted unit price for every line item (0 is allowed)');
      return;
    }
    if (!quotationFile) {
      setError('Please upload your quotation document (PDF or image)');
      return;
    }
    const zeroCount = quoteLines.filter((l) => Number(l.quotedUnitPrice) === 0).length;
    if ((zeroCount > 0 || quoteTotal === 0) && !acceptZero) {
      setZeroConfirm(true);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const quotationFileData = await readFileAsBase64(quotationFile);
      const customFields: Record<string, string | number | boolean> = {};
      for (const [key, val] of Object.entries(fieldValues)) {
        if (key === 'quotedPrice') continue;
        customFields[key] = val;
      }
      const quoteLineItems = quoteLines.map((line) => ({
        lineItemId: line.lineItemId,
        description: line.description,
        category: line.category,
        quantity: line.quantity,
        quotedUnitPrice: Number(line.quotedUnitPrice) || 0,
        quotedTotal: (Number(line.quotedUnitPrice) || 0) * (Number(line.quantity) || 0),
      }));
      const res = await fetch(`${API_BASE_URL}/api/rfq/quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedPrice: quoteTotal,
          quoteLineItems,
          leadTime: Number(fieldValues.leadTime) || 0,
          paymentTerms: String(fieldValues.paymentTerms || 'Net 30'),
          warranty: String(fieldValues.warranty || ''),
          deliveryTerms: String(fieldValues.deliveryTerms || ''),
          compliance: fieldValues.compliance !== undefined ? Boolean(fieldValues.compliance) : true,
          vendorNotes: String(fieldValues.vendorNotes || ''),
          customFields,
          quotationFileName: quotationFile.name,
          quotationFileData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submit failed');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading RFQ…</p>
      </div>
    );
  }

  if (error && !rfqData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-emerald-200 rounded-xl p-8 max-w-md text-center">
          <i className="ri-checkbox-circle-fill text-4xl text-emerald-500"></i>
          <h1 className="text-lg font-bold text-gray-900 mt-3">Quotation Submitted</h1>
          <p className="text-sm text-gray-500 mt-2">Thank you. The buyer has been notified.</p>
        </div>
      </div>
    );
  }

  const { invitation, pr, canSubmit, fieldDefinitions = [] } = rfqData!;
  const vendorFields = (() => {
    const defs = fieldDefinitions.filter(
      (f) => f.id !== 'quotationFile' && f.id !== 'quotation_file' && f.id !== 'quotedPrice'
    );
    return defs;
  })();

  const renderField = (field: VendorField) => {
    const value = fieldValues[field.id];
    if (field.type === 'boolean') {
      return (
        <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setField(field.id, e.target.checked)}
            className="accent-teal-600 w-4 h-4"
          />
          {Boolean(value) ? 'Yes' : 'No'}
        </label>
      );
    }
    if (field.id === 'paymentTerms') {
      return (
        <select
          value={String(value || 'Net 30')}
          onChange={(e) => setField(field.id, e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
        >
          {['Net 30', 'Net 45', 'Net 60', 'Advance 50%', 'On Delivery', 'Deviated'].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.id === 'vendorNotes' || field.type === 'textarea') {
      return (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => setField(field.id, e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none"
          placeholder={field.label}
        />
      );
    }
    const isNumber = field.type === 'number' || field.id === 'leadTime';
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        required={Boolean(field.required)}
        min={isNumber ? 0 : undefined}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) =>
          setField(field.id, isNumber ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)
        }
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
        placeholder={field.label}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-xs font-bold mb-3">
            Round {invitation.round}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Quotation</h1>
          <p className="text-sm text-gray-500 mt-1">Hello {invitation.vendorName}</p>
        </div>

        {invitation.sendBackReason && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-bold text-amber-800 mb-1">Revision Requested</p>
            {invitation.sendBackFields?.map((f) => (
              <span
                key={f}
                className="inline-block mr-2 mb-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full"
              >
                {f}
              </span>
            ))}
            <p className="text-sm text-amber-900 mt-2 whitespace-pre-wrap">{invitation.sendBackReason}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="bg-teal-700 px-6 py-4 text-white">
            <p className="text-xs opacity-80">Purchase Request</p>
            <p className="text-lg font-bold">{pr.prNumber}</p>
            <p className="text-sm opacity-90">{pr.title}</p>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Department</span>
              <p className="font-semibold">{pr.department}</p>
            </div>
            <div>
              <span className="text-gray-500">Estimated Value</span>
              <p className="font-bold text-teal-700">{formatCurrency(pr.totalAmount)}</p>
            </div>
          </div>
          <div className="px-6 pb-4">
            <p className="text-xs text-gray-500">
              <strong>Justification:</strong> {pr.justification}
            </p>
          </div>
        </div>

        {!canSubmit ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center text-sm text-blue-800">
            Your quotation has already been submitted. You will receive an email if a revision is requested.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="text-base font-bold text-gray-900">Your Quotation</h2>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

            <div>
              <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                <i className="ri-list-check-2 text-teal-600"></i>
                Line items — enter unit price for each
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">
                        Description
                      </th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-teal-700 uppercase">
                        Qty *
                      </th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">
                        Est. unit
                      </th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold text-teal-700 uppercase">
                        Your unit price *
                      </th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase">
                        Line total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteLines.map((line) => {
                      const lineTotal =
                        (Number(line.quotedUnitPrice) || 0) * (Number(line.quantity) || 0);
                      return (
                        <tr key={line.lineItemId} className="border-t border-gray-100">
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-gray-900">{line.description}</p>
                            {line.category ? (
                              <p className="text-xs text-gray-400">{line.category}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              step="any"
                              required
                              value={line.quantity === '' ? '' : String(line.quantity)}
                              onChange={(e) => updateLineField(line.lineItemId, 'quantity', e.target.value)}
                              className="w-20 mx-auto block border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder="1"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-400">
                            {formatCurrency(line.estimatedUnitCost)}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="number"
                              min={1}
                              required
                              value={line.quotedUnitPrice === '' ? '' : String(line.quotedUnitPrice)}
                              onChange={(e) => updateLineField(line.lineItemId, 'quotedUnitPrice', e.target.value)}
                              className="w-32 mx-auto block border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {lineTotal > 0 ? formatCurrency(lineTotal) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-teal-200 bg-teal-50">
                      <td colSpan={4} className="px-3 py-3 text-right text-sm font-bold text-teal-900">
                        Total quoted amount
                      </td>
                      <td className="px-3 py-3 text-right text-base font-bold text-teal-800">
                        {formatCurrency(quoteTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {vendorFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vendorFields.map((field) => (
                  <div
                    key={field.id}
                    className={field.id === 'vendorNotes' || field.type === 'textarea' ? 'md:col-span-2' : ''}
                  >
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && ' *'}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quotation File (PDF / Image) *</label>
              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-400 hover:bg-teal-50 transition-colors">
                <i className="ri-upload-cloud-2-line text-xl text-teal-600"></i>
                <div className="text-sm">
                  {quotationFile ? (
                    <span className="font-medium text-gray-900">{quotationFile.name}</span>
                  ) : (
                    <>
                      <span className="font-medium text-gray-700">Upload quotation document</span>
                      <span className="block text-xs text-gray-500">PDF, PNG, JPG — max 5MB</span>
                    </>
                  )}
                </div>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : `Submit Quotation · ${formatCurrency(quoteTotal)}`}
            </button>
          </form>
        )}
      </div>
      {zeroConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Submit quote with ₹0?</h3>
            </div>
            <div className="p-5 text-sm text-gray-700">
              <p>One or more line items have quoted unit ₹0. Submit this quotation anyway?</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setZeroConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  setZeroConfirm(false);
                  void handleSubmit(e as unknown as FormEvent, true);
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
