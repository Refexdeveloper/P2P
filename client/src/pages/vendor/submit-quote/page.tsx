import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = (import.meta.env.VITE_API_URL || 'https://p2p-backend-645830234926.asia-south1.run.app').replace(
  /\/$/,
  ''
);

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
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
      lineItems: { description: string; category: string; quantity: number; unitCost: number; total: number }[];
    };
    fieldDefinitions?: { id: string; label: string; type: string; core?: boolean }[];
    canSubmit: boolean;
  } | null>(null);

  const [customFields, setCustomFields] = useState<Record<string, string | number | boolean>>({});

  const [quotedPrice, setQuotedPrice] = useState('');
  const [leadTime, setLeadTime] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [warranty, setWarranty] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [compliance, setCompliance] = useState(true);
  const [vendorNotes, setVendorNotes] = useState('');
  const [quotationFile, setQuotationFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    fetch(`${API_URL}/api/rfq/quote/${token}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.message && !res.data) throw new Error(res.message);
        setRfqData(res.data);
      })
      .catch((err) => setError(err.message || 'Failed to load RFQ'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!quotationFile) {
      setError('Please upload your quotation document (PDF or image)');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      let quotationFileData: string | undefined;
      if (quotationFile) {
        quotationFileData = await readFileAsBase64(quotationFile);
      }
      const res = await fetch(`${API_URL}/api/rfq/quote/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotedPrice: Number(quotedPrice),
          leadTime: Number(leadTime) || 0,
          paymentTerms,
          warranty,
          deliveryTerms,
          compliance,
          vendorNotes,
          customFields,
          quotationFileName: quotationFile?.name,
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
        <p className="text-gray-500">Loading RFQ details...</p>
      </div>
    );
  }

  if (error && !rfqData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md text-center">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-3"></i>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-emerald-200 rounded-xl p-8 max-w-md text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-check-line text-3xl text-emerald-600"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Quotation Submitted</h1>
          <p className="text-sm text-gray-600">
            Your quote for <strong>{rfqData?.pr.prNumber}</strong> (Round {rfqData?.invitation.round}) has been received.
          </p>
        </div>
      </div>
    );
  }

  const { invitation, pr, canSubmit, fieldDefinitions = [] } = rfqData!;
  const extraVendorFields = fieldDefinitions.filter((f) => !f.core);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
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
              <span key={f} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">{f}</span>
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
            <div><span className="text-gray-500">Department</span><p className="font-semibold">{pr.department}</p></div>
            <div><span className="text-gray-500">Estimated Value</span><p className="font-bold text-teal-700">{formatCurrency(pr.totalAmount)}</p></div>
          </div>
          <div className="px-6 pb-6">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Line Items</p>
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Description</th>
                  <th className="text-center p-2">Qty</th>
                  <th className="text-right p-2">Unit</th>
                  <th className="text-right p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {pr.lineItems.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right">{formatCurrency(item.unitCost)}</td>
                    <td className="p-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-3"><strong>Justification:</strong> {pr.justification}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quoted Price (₹) *</label>
                <input type="number" required min="1" value={quotedPrice} onChange={(e) => setQuotedPrice(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="Enter total quoted amount" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Time (days)</label>
                <input type="number" min="0" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 21" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Advance 50%">Advance 50%</option>
                  <option value="On Delivery">On Delivery</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warranty</label>
                <input type="text" value={warranty} onChange={(e) => setWarranty(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g. 1 Year" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Terms</label>
                <input type="text" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" placeholder="e.g. FOB" />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="compliance" checked={compliance} onChange={(e) => setCompliance(e.target.checked)} className="accent-teal-600" />
                <label htmlFor="compliance" className="text-sm text-gray-700">Meets technical specifications</label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Comments</label>
              <textarea value={vendorNotes} onChange={(e) => setVendorNotes(e.target.value)} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm resize-none" placeholder="Additional comments for the buyer" />
            </div>
            {extraVendorFields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.type === 'boolean' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(customFields[field.id])}
                      onChange={(e) => setCustomFields((c) => ({ ...c, [field.id]: e.target.checked }))}
                      className="accent-teal-600"
                    />
                    Yes
                  </label>
                ) : (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={String(customFields[field.id] ?? '')}
                    onChange={(e) =>
                      setCustomFields((c) => ({
                        ...c,
                        [field.id]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                  />
                )}
              </div>
            ))}
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
            <button type="submit" disabled={submitting} className="w-full py-3 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Quotation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
