import { useEffect, useMemo, useState } from 'react';
import {
  masterApi,
  prApi,
  type DepartmentRecord,
  type EntityRecord,
} from '../../../services/api';

type LineDraft = {
  key: string;
  id?: number | string;
  category: string;
  description: string;
  quantity: number | '';
  unitCost: number | '';
};

type PrForm = {
  title: string;
  requestType: string;
  purchaseType: string;
  department: string;
  entityId: number | '';
  priority: string;
  currency: string;
  requiredDate: string;
  vendorSelection: 'own' | 'scm';
  justification: string;
  lineItems: LineDraft[];
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CURRENCIES = ['INR', 'USD', 'EUR'];

function toInputDate(value?: string) {
  if (!value) return '';
  // already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: '',
    description: '',
    quantity: 1,
    unitCost: 0,
    ...partial,
  };
}

const formatCurrency = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

interface Props {
  prId: number;
  canEdit: boolean;
  onSaved?: () => void;
  onToast?: (msg: string) => void;
}

export default function PrDetailsEditor({ prId, canEdit, onSaved, onToast }: Props) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [meta, setMeta] = useState<{
    prNumber: string;
    requester: string;
    statusUI: string;
    totalAmount: number;
  } | null>(null);
  const [form, setForm] = useState<PrForm | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [prRes, deptRes, entRes] = await Promise.all([
        prApi.get(prId),
        masterApi.listDepartments({ status: 'active' }),
        masterApi.listEntities({ status: 'active' }),
      ]);
      const pr = prRes.data as Record<string, unknown>;
      const lines = ((pr.lineItems as Array<Record<string, unknown>>) || []).map((li) =>
        newLine({
          id: li.id as number | string,
          category: String(li.category || ''),
          description: String(li.description || li.item || ''),
          quantity: Number(li.quantity) || 0,
          unitCost: Number(li.unitCost ?? li.unitPrice) || 0,
        })
      );
      setMeta({
        prNumber: String(pr.prNumber || ''),
        requester: String(pr.requester || ''),
        statusUI: String(pr.statusUI || pr.status || ''),
        totalAmount: Number(pr.totalAmount) || 0,
      });
      setForm({
        title: String(pr.title || ''),
        requestType: String(pr.requestType || 'Opex'),
        purchaseType:
          pr.purchaseType === 'work_order' || pr.purchaseType === 'Work Order'
            ? 'work_order'
            : 'purchase_order',
        department: String(pr.department || ''),
        entityId: pr.entityId != null && pr.entityId !== '' ? Number(pr.entityId) : '',
        priority: String(pr.priority || 'Medium'),
        currency: String(pr.currency || 'INR'),
        requiredDate: toInputDate(String(pr.requiredDate || '')),
        vendorSelection: pr.vendorSelection === 'own' ? 'own' : 'scm',
        justification: String(pr.justification || ''),
        lineItems: lines.length ? lines : [newLine()],
      });
      setDepartments(deptRes.data || []);
      setEntities(entRes.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PR details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prId]);

  const lineTotal = useMemo(() => {
    if (!form) return 0;
    return form.lineItems.reduce(
      (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitCost) || 0),
      0
    );
  }, [form]);

  const setField = <K extends keyof PrForm>(key: K, value: PrForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            lineItems: prev.lineItems.map((li) => (li.key === key ? { ...li, ...patch } : li)),
          }
        : prev
    );
  };

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.department) {
      setError('Department is required');
      return;
    }
    if (form.lineItems.some((li) => !li.description.trim() || !li.quantity || Number(li.quantity) <= 0)) {
      setError('Each line item needs description and quantity > 0');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await prApi.adminUpdate(prId, {
        title: form.title.trim(),
        requestType: form.requestType,
        purchaseType: form.purchaseType,
        department: form.department,
        entityId: form.entityId === '' ? null : form.entityId,
        priority: form.priority,
        currency: form.currency,
        requiredDate: form.requiredDate || null,
        vendorSelection: form.vendorSelection,
        justification: form.justification,
        lineItems: form.lineItems.map((li) => ({
          category: li.category,
          description: li.description.trim(),
          quantity: Number(li.quantity) || 0,
          unitCost: Number(li.unitCost) || 0,
        })),
      });
      setEditing(false);
      onToast?.('PR details updated');
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PR');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-500 mb-5">
        Loading PR details…
      </div>
    );
  }

  if (!form) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-5">
        {error || 'PR details unavailable'}
      </div>
    );
  }

  const requestTypes =
    form.purchaseType === 'work_order' ? (['Capex', 'Opex', 'Service'] as const) : (['Capex', 'Opex'] as const);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
            <i className="ri-file-info-line"></i>
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">PR Details</p>
            <p className="text-xs text-gray-500">
              {meta?.prNumber} · {meta?.requester || '—'} · {meta?.statusUI || '—'}
            </p>
          </div>
          <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-gray-400 ml-1`}></i>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-teal-700">
            {formatCurrency(editing ? lineTotal : meta?.totalAmount || lineTotal, form.currency)}
          </span>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setEditing(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 text-white hover:bg-teal-700 cursor-pointer"
            >
              <i className="ri-edit-line mr-1"></i>
              Edit PR
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  load();
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving…' : 'Save PR'}
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="p-5 space-y-5">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <label className="block text-sm md:col-span-2 xl:col-span-3">
              <span className="text-xs font-semibold text-gray-600">Title *</span>
              <input
                disabled={!editing}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Purchase type *</span>
              <select
                disabled={!editing}
                value={form.purchaseType}
                onChange={(e) => {
                  const pt = e.target.value;
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          purchaseType: pt,
                          requestType:
                            pt === 'purchase_order' && prev.requestType === 'Service'
                              ? 'Opex'
                              : prev.requestType,
                        }
                      : prev
                  );
                }}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="purchase_order">Purchase Order (PO)</option>
                <option value="work_order">Work Order (WO)</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Request type *</span>
              <select
                disabled={!editing}
                value={form.requestType}
                onChange={(e) => setField('requestType', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                {requestTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Priority</span>
              <select
                disabled={!editing}
                value={form.priority}
                onChange={(e) => setField('priority', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Department *</span>
              <select
                disabled={!editing}
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="">— Select —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Entity</span>
              <select
                disabled={!editing}
                value={form.entityId === '' ? '' : String(form.entityId)}
                onChange={(e) =>
                  setField('entityId', e.target.value === '' ? '' : Number(e.target.value))
                }
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="">— Select —</option>
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name}
                    {ent.code ? ` (${ent.code})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Required date</span>
              <input
                type="date"
                disabled={!editing}
                value={form.requiredDate}
                onChange={(e) => setField('requiredDate', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              />
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Currency</span>
              <select
                disabled={!editing}
                value={form.currency}
                onChange={(e) => setField('currency', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="text-xs font-semibold text-gray-600">Vendor selection</span>
              <select
                disabled={!editing}
                value={form.vendorSelection}
                onChange={(e) => setField('vendorSelection', e.target.value as 'own' | 'scm')}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="scm">SCM selects vendor</option>
                <option value="own">Own vendor</option>
              </select>
            </label>

            <label className="block text-sm md:col-span-2 xl:col-span-3">
              <span className="text-xs font-semibold text-gray-600">Business justification</span>
              <textarea
                disabled={!editing}
                rows={3}
                value={form.justification}
                onChange={(e) => setField('justification', e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 resize-none"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Line items</p>
              {editing && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) =>
                      prev ? { ...prev, lineItems: [...prev.lineItems, newLine()] } : prev
                    )
                  }
                  className="text-xs font-semibold text-teal-700 cursor-pointer"
                >
                  + Add line
                </button>
              )}
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit cost</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    {editing && <th className="px-3 py-2 w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {form.lineItems.map((li) => {
                    const total = (Number(li.quantity) || 0) * (Number(li.unitCost) || 0);
                    return (
                      <tr key={li.key} className="border-t border-gray-100">
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              value={li.description}
                              onChange={(e) => updateLine(li.key, { description: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{li.description || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {editing ? (
                            <input
                              value={li.category}
                              onChange={(e) => updateLine(li.key, { category: e.target.value })}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                            />
                          ) : (
                            <span className="text-gray-600">{li.category || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              value={li.quantity === '' ? '' : String(li.quantity)}
                              onChange={(e) =>
                                updateLine(li.key, {
                                  quantity: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              className="w-24 ml-auto block border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                            />
                          ) : (
                            <span className="font-semibold">{li.quantity}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              value={li.unitCost === '' ? '' : String(li.unitCost)}
                              onChange={(e) =>
                                updateLine(li.key, {
                                  unitCost: e.target.value === '' ? '' : Number(e.target.value),
                                })
                              }
                              className="w-28 ml-auto block border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                            />
                          ) : (
                            formatCurrency(Number(li.unitCost) || 0, form.currency)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-teal-700">
                          {formatCurrency(total, form.currency)}
                        </td>
                        {editing && (
                          <td className="px-2 py-2 text-center">
                            {form.lineItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          lineItems: prev.lineItems.filter((x) => x.key !== li.key),
                                        }
                                      : prev
                                  )
                                }
                                className="text-red-500 hover:text-red-700 cursor-pointer"
                                title="Remove line"
                              >
                                <i className="ri-delete-bin-line"></i>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-teal-200 bg-teal-50">
                    <td
                      colSpan={editing ? 4 : 4}
                      className="px-3 py-2 text-right text-xs font-bold text-teal-900 uppercase"
                    >
                      PR total
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-teal-800">
                      {formatCurrency(lineTotal, form.currency)}
                    </td>
                    {editing && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs text-gray-400">
              View only — you do not have permission to edit PR details at this stage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
