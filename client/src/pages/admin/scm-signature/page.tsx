import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { adminApi } from '../../../services/api';

type SignatureInfo = {
  fileName: string;
  label: string;
  managerName: string;
  managerEmail: string;
  imageDataUrl: string | null;
  updatedAt: string | null;
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

export default function AdminScmSignaturePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [applyToSignedPos, setApplyToSignedPos] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getScmManagerSignature();
      setInfo(res.data);
      setPreview(res.data.imageDataUrl);
      setPendingImage(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load signature', 'error');
      setInfo(null);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      showToast('Use PNG or JPG (or WebP) for the signature image', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2 MB', 'error');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingImage(dataUrl);
      setPreview(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read file', 'error');
    }
  };

  const onSave = async () => {
    if (!pendingImage) {
      showToast('Choose a new signature image first', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.updateScmManagerSignature(pendingImage, applyToSignedPos);
      setInfo(res.data);
      setPreview(res.data.imageDataUrl);
      setPendingImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(res.message || 'Default signature updated', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update signature', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onCancelPending = () => {
    setPendingImage(null);
    setPreview(info?.imageDataUrl || null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">SCM Manager Signature</h1>
          <p className="mt-1 text-sm text-slate-600">
            Default signature used on PO approvals and PDF documents when the SCM Manager does not
            draw or upload a new one.
          </p>
        </div>

        {toast && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.text}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading current signature…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <div className="text-slate-500">Manager</div>
                  <div className="font-medium text-slate-900">{info?.managerName || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Email</div>
                  <div className="font-medium text-slate-900">{info?.managerEmail || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">File</div>
                  <div className="font-medium text-slate-900">{info?.fileName || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Last updated</div>
                  <div className="font-medium text-slate-900">{formatWhen(info?.updatedAt)}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-2">
                  {pendingImage ? 'New signature preview' : 'Current default signature'}
                </div>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center min-h-[160px] p-4">
                  {preview ? (
                    <img
                      src={preview}
                      alt="SCM Manager default signature"
                      className="max-h-40 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-slate-500">No signature on file</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">
                  Upload new signature (PNG / JPG)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
                  onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                />
                <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300"
                    checked={applyToSignedPos}
                    onChange={(e) => setApplyToSignedPos(e.target.checked)}
                  />
                  <span>
                    Also apply to already signed POs (clears cached PDFs so the next view uses the
                    new signature)
                  </span>
                </label>
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  disabled={!pendingImage || saving}
                  onClick={onSave}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-slate-800"
                >
                  {saving ? 'Saving…' : 'Save as default'}
                </button>
                {pendingImage && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onCancelPending}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={saving || loading}
                  onClick={load}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
