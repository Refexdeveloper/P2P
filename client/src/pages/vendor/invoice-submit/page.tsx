import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { accountsApi } from '../../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    amount || 0
  );

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

type InvData = {
  invoiceId: number;
  invoiceNumber?: string;
  poNumber: string;
  grnNumber?: string;
  prNumber?: string;
  prTitle?: string;
  vendorName?: string;
  paymentTerms?: string;
  amount?: number;
  canSubmit?: boolean;
  alreadySubmitted?: boolean;
  status?: string;
};

export default function VendorInvoiceSubmitPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<InvData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await accountsApi.getVendorInvoiceByToken(token);
        if (!cancelled) {
          const d = res.data as InvData;
          setData(d);
          if (d.invoiceNumber) setInvoiceNumber(d.invoiceNumber);
        }
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
    if (!invoiceNumber.trim()) {
      setError('Invoice number is required');
      return;
    }
    if (!file) {
      setError('Please upload the invoice PDF / image');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fileData = await fileToBase64(file);
      await accountsApi.submitVendorInvoiceByToken(token, {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate: dueDate || null,
        remarks,
        fileName: file.name,
        fileData,
        invoiceGrandTotal: data?.amount || 0,
      });
      setDone('Invoice submitted successfully. Thank you.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-gray-500">
        Loading invoice request…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-red-200 rounded-xl p-6 max-w-md text-red-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-slate-100 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-amber-600 to-orange-500 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-90">Vendor Invoice</p>
          <h1 className="text-xl font-bold mt-1">Submit Invoice</h1>
          <p className="text-sm text-amber-50 mt-1">{data?.vendorName}</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">PO</span>
              <span className="font-semibold text-gray-900">{data?.poNumber}</span>
            </div>
            {data?.grnNumber ? (
              <div className="flex justify-between">
                <span className="text-gray-500">GRN</span>
                <span className="font-semibold text-gray-900">{data.grnNumber}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-amber-700">{formatCurrency(data?.amount || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Payment terms</span>
              <span className="font-medium text-gray-800">{data?.paymentTerms || '—'}</span>
            </div>
          </div>

          {done ? (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
              {done}
            </div>
          ) : !data?.canSubmit ? (
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg">
              This invoice link is no longer open for submission ({data?.status}).
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700">
                Invoice number *
                <input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="INV-…"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium text-gray-700">
                  Invoice date
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice file *
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Remarks
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </label>
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {error}
                </div>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="w-full py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Submitting…' : 'Submit Invoice'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
