import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { poApi } from '../../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

type AcceptData = {
  poNumber: string;
  prNumber?: string;
  prTitle?: string;
  vendorName?: string;
  grandTotal?: number;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  vendorAcceptanceStatus?: string;
  canRespond?: boolean;
  hasSignedPdf?: boolean;
};

export default function VendorPoAcceptPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<AcceptData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'accept' | 'reject' | 'partial'>('accept');
  const [remarks, setRemarks] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await poApi.getVendorAcceptanceByToken(token);
        if (!cancelled) setData(res.data as AcceptData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid link');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!remarks.trim()) {
      setError('Remarks are required');
      return;
    }
    if (action !== 'reject' && !file) {
      setError('Please upload the signed / acceptance document');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fileData = file ? await fileToBase64(file) : undefined;
      const res = await poApi.submitVendorAcceptanceByToken(token, {
        action,
        remarks: remarks.trim(),
        deliveryDate: deliveryDate || undefined,
        fileName: file?.name,
        fileData,
      });
      setData(res.data as AcceptData);
      setDone(res.message || 'Response recorded. Thank you.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-gray-500">
        Loading purchase order…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-100 rounded-xl p-8 max-w-md text-center">
          <h1 className="text-lg font-bold text-gray-900">Link unavailable</h1>
          <p className="text-sm text-red-600 mt-2">{error || 'Invalid or expired link'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-5 text-white">
          <p className="text-teal-100 text-sm">Vendor PO Acceptance</p>
          <h1 className="text-xl font-bold mt-1">{data.poNumber}</h1>
          <p className="text-sm text-teal-50 mt-1">{data.prTitle || data.prNumber}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Vendor</p>
              <p className="font-semibold text-gray-900">{data.vendorName}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Amount</p>
              <p className="font-semibold text-gray-900">{formatCurrency(Number(data.grandTotal) || 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Delivery</p>
              <p className="font-semibold text-gray-900">{data.expectedDeliveryDate || '—'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Payment terms</p>
              <p className="font-semibold text-gray-900">{data.paymentTerms || '—'}</p>
            </div>
          </div>

          {data.hasSignedPdf && (
            <a
              href={poApi.getVendorAcceptancePdfUrl(token)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-800 rounded-lg text-sm font-semibold border border-teal-100"
            >
              <i className="ri-file-pdf-line"></i> Download signed PO PDF
            </a>
          )}

          {done || !data.canRespond ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-sm text-emerald-800">
              {done || `Already recorded as ${data.vendorAcceptanceStatus}.`}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {(['accept', 'partial', 'reject'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAction(a)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize ${
                      action === a ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Remarks *</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Confirmation or rejection notes"
                />
              </div>

              {action !== 'reject' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Confirmed delivery date</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Upload signed / acceptance document *
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="mt-1 w-full text-sm"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="w-full py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Submitting…' : 'Submit response'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
