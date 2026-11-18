import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { adminApi } from '../../../services/api';

type PoMatrixRow = {
  id: number;
  categoryCode: string;
  levelNo: number;
  amountMin: number;
  amountMax: number | null;
  approverEmails: string[];
  isActive: boolean;
};

type Category = { code: string; label: string; hint?: string };

const emptyForm = {
  id: 0,
  categoryCode: 'RAW_MATERIALS',
  levelNo: 1,
  amountMin: 0,
  amountMax: '' as number | '' | null,
  approverEmails: '',
  isActive: true,
};

function formatLakh(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return 'Open';
  const v = Number(n);
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}

export default function ApprovalMatrixPage() {
  const [tab, setTab] = useState<'po' | 'pr'>('po');
  const [rows, setRows] = useState<PoMatrixRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [prRows, setPrRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [preview, setPreview] = useState<{
    categoryCode: string;
    amount: string;
    result: string;
  }>({ categoryCode: 'RAW_MATERIALS', amount: '2500000', result: '' });

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, prRes] = await Promise.all([
        adminApi.listPoValueMatrix(),
        adminApi.listPrApprovalMatrix().catch(() => ({ data: [] })),
      ]);
      setRows(poRes.data || []);
      setCategories(poRes.categories || []);
      setPrRows(prRes.data || []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load matrix', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PoMatrixRow[]>();
    for (const row of rows.filter((r) => r.isActive)) {
      const list = map.get(row.categoryCode) || [];
      list.push(row);
      map.set(row.categoryCode, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.levelNo - b.levelNo);
    }
    return map;
  }, [rows]);

  const saveRow = async () => {
    setSaving(true);
    try {
      await adminApi.savePoValueMatrixRow({
        id: form.id || undefined,
        categoryCode: form.categoryCode,
        levelNo: Number(form.levelNo),
        amountMin: Number(form.amountMin) || 0,
        amountMax: form.amountMax === '' || form.amountMax == null ? null : Number(form.amountMax),
        approverEmails: form.approverEmails
          .split(/[,;/|]+/)
          .map((e) => e.trim())
          .filter(Boolean),
        isActive: form.isActive,
      });
      showToast(form.id ? 'Matrix row updated' : 'Matrix row added', 'success');
      setForm({ ...emptyForm });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: number) => {
    if (!confirm('Deactivate this matrix row?')) return;
    try {
      await adminApi.deactivatePoValueMatrixRow(id);
      showToast('Row deactivated', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error');
    }
  };

  const runPreview = async () => {
    try {
      const res = await adminApi.previewPoValueRouting({
        categoryCode: preview.categoryCode,
        amountExGst: Number(preview.amount) || 0,
      });
      const d = res.data;
      const after = (d.levelsAfterSkip || [])
        .map((l: { level: number; emails: string[] }) => `L${l.level}: ${l.emails.join(' / ')}`)
        .join(' → ');
      setPreview((p) => ({
        ...p,
        result: d.goesStraightToScmSign
          ? 'No value approval — goes straight to SCM sign (Mounesh/Tarkesh)'
          : `Value chain: ${after || '—'} → then SCM sign`,
      }));
    } catch (err) {
      setPreview((p) => ({
        ...p,
        result: err instanceof Error ? err.message : 'Preview failed',
      }));
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Approval Matrix</h1>
          <p className="mt-1 text-sm text-slate-600">
            RMC company-wide rules. PO value matrix is live; PR matrix is ready for your later upload
            (plant / category / requester).
          </p>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-200">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'po' ? 'border-b-2 border-teal-600 text-teal-700' : 'text-slate-500'
            }`}
            onClick={() => setTab('po')}
          >
            PO Value Matrix
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium ${
              tab === 'pr' ? 'border-b-2 border-teal-600 text-teal-700' : 'text-slate-500'
            }`}
            onClick={() => setTab('pr')}
          >
            PR Approval Matrix
          </button>
        </div>

        {toast && (
          <div
            className={`mb-4 rounded-md px-3 py-2 text-sm ${
              toast.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
            }`}
          >
            {toast.text}
          </div>
        )}

        {tab === 'po' && (
          <>
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Preview routing</h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-600">
                  Category
                  <select
                    className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={preview.categoryCode}
                    onChange={(e) => setPreview((p) => ({ ...p, categoryCode: e.target.value }))}
                  >
                    {(categories.length
                      ? categories
                      : [{ code: 'RAW_MATERIALS', label: 'Raw Materials' }]
                    ).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  PO amount ex-GST (₹)
                  <input
                    className="mt-1 block w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={preview.amount}
                    onChange={(e) => setPreview((p) => ({ ...p, amount: e.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  onClick={runPreview}
                  className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white"
                >
                  Preview
                </button>
              </div>
              {preview.result && (
                <p className="mt-3 text-sm text-slate-700">{preview.result}</p>
              )}
            </div>

            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="space-y-6">
                {[...grouped.entries()].map(([code, list]) => {
                  const label =
                    categories.find((c) => c.code === code)?.label || code.replace(/_/g, ' ');
                  return (
                    <div key={code} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold">
                        {label}
                      </div>
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Level</th>
                            <th className="px-4 py-2">Amount band</th>
                            <th className="px-4 py-2">Approvers (any one)</th>
                            <th className="px-4 py-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((row) => (
                            <tr key={row.id} className="border-t border-slate-100">
                              <td className="px-4 py-2">L{row.levelNo}</td>
                              <td className="px-4 py-2">
                                {formatLakh(row.amountMin)} – {formatLakh(row.amountMax)}
                              </td>
                              <td className="px-4 py-2">{row.approverEmails.join(' / ')}</td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  className="mr-2 text-teal-700 hover:underline"
                                  onClick={() =>
                                    setForm({
                                      id: row.id,
                                      categoryCode: row.categoryCode,
                                      levelNo: row.levelNo,
                                      amountMin: row.amountMin,
                                      amountMax: row.amountMax ?? '',
                                      approverEmails: row.approverEmails.join(', '),
                                      isActive: row.isActive,
                                    })
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="text-red-600 hover:underline"
                                  onClick={() => deactivate(row.id)}
                                >
                                  Deactivate
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">
                {form.id ? `Edit row #${form.id}` : 'Add matrix row'}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-slate-600">
                  Category
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={form.categoryCode}
                    onChange={(e) => setForm((f) => ({ ...f, categoryCode: e.target.value }))}
                  >
                    {(categories.length
                      ? categories
                      : [
                          { code: 'RAW_MATERIALS', label: 'Raw Materials' },
                          { code: 'CAPEX', label: 'CAPEX' },
                        ]
                    ).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Level
                  <select
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={form.levelNo}
                    onChange={(e) => setForm((f) => ({ ...f, levelNo: Number(e.target.value) }))}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Amount max (₹, blank = open)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={form.amountMax ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        amountMax: e.target.value === '' ? '' : Number(e.target.value),
                      }))
                    }
                    placeholder="e.g. 2000000"
                  />
                </label>
                <label className="text-xs text-slate-600 sm:col-span-2">
                  Approver emails (comma / slash = any one)
                  <input
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    value={form.approverEmails}
                    onChange={(e) => setForm((f) => ({ ...f, approverEmails: e.target.value }))}
                    placeholder="lalitha.u@refex.co.in"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={saveRow}
                  className="rounded bg-teal-700 px-4 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  {saving ? 'Saving…' : form.id ? 'Update' : 'Add'}
                </button>
                {form.id ? (
                  <button
                    type="button"
                    className="rounded border border-slate-300 px-4 py-1.5 text-sm"
                    onClick={() => setForm({ ...emptyForm })}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}

        {tab === 'pr' && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-800">PR Approval Matrix</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Upload later from Admin. Recommended dimensions: Plant + Category + optional
              Requester/Department. On Create PR, requester chooses{' '}
              <strong>Use Matrix</strong> or <strong>Manual select</strong> approvers. Until rows
              exist, PR flow keeps current Refex L1/L2 (+ manual for functional/online).
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Rows loaded: {Array.isArray(prRows) ? prRows.length : 0} (empty until you upload)
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
