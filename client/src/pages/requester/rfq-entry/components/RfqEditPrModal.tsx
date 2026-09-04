import { useEffect, useMemo, useState } from 'react';
import {
  masterApi,
  prApi,
  type DepartmentRecord,
  type EntityRecord,
} from '../../../../services/api';
import {
  PR_PAYMENT_TERM_OPTIONS,
  PR_DELIVERY_TIMELINE_OPTIONS,
} from '../../../../constants/prRequisition';

type LineDraft = {
  key: string;
  itemName: string;
  category: string;
  description: string;
  quantity: number | '';
  unit: string;
  unitCost: number | '';
  gstPercentage: number | '';
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
  billingLocationId: number | '';
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  placeOfDelivery: string;
  expectedDeliveryTimeline: string;
  paymentTerms: string;
  lineItems: LineDraft[];
};

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
const CURRENCIES = ['INR', 'USD', 'EUR'];

function toInputDate(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function newLine(partial?: Partial<LineDraft>): LineDraft {
  return {
    key: `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemName: '',
    category: '',
    description: '',
    quantity: 1,
    unit: 'Nos',
    unitCost: 0,
    gstPercentage: 18,
    ...partial,
  };
}

const money = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);

function lineInclusive(qty: number, cost: number, gst: number) {
  return Math.round(qty * cost * (1 + (gst || 0) / 100) * 100) / 100;
}

interface Props {
  open: boolean;
  prId: number;
  onClose: () => void;
  onSaved?: () => void;
  onToast?: (msg: string) => void;
}

/** RFQ Entry popup — same save payload as Create / Edit PR (draft), without changing that page. */
export default function RfqEditPrModal({ open, prId, onClose, onSaved, onToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [prNumber, setPrNumber] = useState('');
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
          itemName: String(li.itemName || li.item || li.description || ''),
          category: String(li.category || ''),
          description: String(li.description || li.item || ''),
          quantity: Number(li.quantity) || 0,
          unit: String(li.unit || li.uom || 'Nos'),
          unitCost: Number(li.unitCost ?? li.unitPrice) || 0,
          gstPercentage:
            li.gstPercentage != null && String(li.gstPercentage) !== ''
              ? Number(li.gstPercentage)
              : 18,
        })
      );
      setPrNumber(String(pr.prNumber || ''));
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
        billingLocationId:
          pr.billingLocationId != null && pr.billingLocationId !== '' ? Number(pr.billingLocationId) : '',
        billingLocation: String(pr.billingLocation || ''),
        billingGstNo: String(pr.billingGstNo || ''),
        billingAddress: String(pr.billingAddress || ''),
        deliveryPoc: String(pr.deliveryPoc || ''),
        placeOfDelivery: String(pr.placeOfDelivery || ''),
        expectedDeliveryTimeline: String(pr.expectedDeliveryTimeline || ''),
        paymentTerms: String(pr.paymentTerms || ''),
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
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prId]);

  const lineTotal = useMemo(() => {
    if (!form) return 0;
    return form.lineItems.reduce((sum, li) => {
      const gst = li.gstPercentage === '' ? 18 : Number(li.gstPercentage) || 0;
      return sum + lineInclusive(Number(li.quantity) || 0, Number(li.unitCost) || 0, gst);
    }, 0);
  }, [form]);

  const setField = <K extends keyof PrForm>(key: K, value: PrForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setForm((prev) =>
      prev
        ? { ...prev, lineItems: prev.lineItems.map((li) => (li.key === key ? { ...li, ...patch } : li)) }
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
    if (form.lineItems.some((li) => !(li.itemName || li.description).trim() || !li.quantity || Number(li.quantity) <= 0)) {
      setError('Each line item needs an item name or description, and quantity > 0');
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
        billingLocationId: form.billingLocationId || null,
        billingLocation: form.billingLocation.trim() || null,
        billingGstNo: form.billingGstNo.trim() || null,
        billingAddress: form.billingAddress.trim() || null,
        deliveryPoc: form.deliveryPoc.trim() || null,
        placeOfDelivery: form.placeOfDelivery.trim() || null,
        expectedDeliveryTimeline: form.expectedDeliveryTimeline.trim() || null,
        paymentTerms: form.paymentTerms.trim() || null,
        lineItems: form.lineItems.map((li) => {
          const itemName = String(li.itemName || '').trim() || String(li.description || '').trim();
          const description = String(li.description || '').trim() || itemName;
          return {
            itemName,
            description,
            category: li.category,
            quantity: Number(li.quantity) || 0,
            unit: li.unit || 'Nos',
            unitCost: Number(li.unitCost) || 0,
            gstPercentage: li.gstPercentage === '' ? 18 : Number(li.gstPercentage) || 0,
          };
        }),
      });
      onToast?.('PR details saved');
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PR');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const requestTypes =
    form?.purchaseType === 'work_order' ? (['Capex', 'Opex', 'Service'] as const) : (['Capex', 'Opex'] as const);
  const billingLocations =
    !form || form.entityId === ''
      ? []
      : entities.find((e) => e.id === form.entityId)?.locations?.filter((loc) => loc.location) || [];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Edit PR details</p>
            <p className="text-xs text-gray-500 truncate">{prNumber || `PR #${prId}`}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {form ? (
              <span className="text-sm font-semibold text-teal-700">{money(lineTotal, form.currency)}</span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500 text-xl cursor-pointer"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-5">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading PR details…</p>
          ) : !form ? (
            <p className="text-sm text-red-700">{error || 'PR details unavailable'}</p>
          ) : (
            <>
              {error ? (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <label className="block text-sm md:col-span-2 xl:col-span-3">
                  <span className="text-xs font-semibold text-gray-600">Title *</span>
                  <input
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Purchase type *</span>
                  <select
                    value={form.purchaseType}
                    onChange={(e) => {
                      const pt = e.target.value;
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              purchaseType: pt,
                              requestType:
                                pt === 'purchase_order' && prev.requestType === 'Service' ? 'Opex' : prev.requestType,
                            }
                          : prev
                      );
                    }}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="purchase_order">Purchase Order (PO)</option>
                    <option value="work_order">Work Order (WO)</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Request type *</span>
                  <select
                    value={form.requestType}
                    onChange={(e) => setField('requestType', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
                    value={form.priority}
                    onChange={(e) => setField('priority', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
                    value={form.department}
                    onChange={(e) => setField('department', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
                    value={form.entityId === '' ? '' : String(form.entityId)}
                    onChange={(e) => {
                      const id = e.target.value === '' ? '' : Number(e.target.value);
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              entityId: id,
                              billingLocationId: '',
                              billingLocation: '',
                              billingGstNo: '',
                              billingAddress: '',
                            }
                          : prev
                      );
                    }}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
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
                  <span className="text-xs font-semibold text-gray-600">Billing region / GST</span>
                  {billingLocations.length > 0 ? (
                    <select
                      value={form.billingLocationId === '' ? '' : String(form.billingLocationId)}
                      onChange={(e) => {
                        const id = e.target.value === '' ? '' : Number(e.target.value);
                        const loc = billingLocations.find((row) => Number(row.id) === Number(id));
                        const nextBilling =
                          (loc?.billingAddress || '').trim() || loc?.location || '';
                        const nextSite = (loc?.siteAddress || '').trim();
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                billingLocationId: id,
                                billingLocation: loc?.location || '',
                                billingGstNo: (loc?.gstNo || '').toUpperCase(),
                                billingAddress: nextBilling,
                                ...(nextSite ? { placeOfDelivery: nextSite } : {}),
                              }
                            : prev
                        );
                      }}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">— Select region —</option>
                      {billingLocations.map((loc) => (
                        <option key={loc.id || loc.location} value={loc.id}>
                          {loc.location}
                          {loc.gstNo ? ` — ${loc.gstNo}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.billingLocation}
                      onChange={(e) => setField('billingLocation', e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  )}
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Billing GSTIN</span>
                  <input
                    value={form.billingGstNo}
                    onChange={(e) => setField('billingGstNo', e.target.value.toUpperCase().replace(/\s/g, ''))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    maxLength={15}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Billing address</span>
                  <textarea
                    value={form.billingAddress}
                    onChange={(e) => setField('billingAddress', e.target.value)}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">POC for delivery</span>
                  <input
                    value={form.deliveryPoc}
                    onChange={(e) => setField('deliveryPoc', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">Place of delivery</span>
                  <input
                    value={form.placeOfDelivery}
                    onChange={(e) => setField('placeOfDelivery', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Expected delivery timeline</span>
                  <input
                    list="rfq-edit-pr-delivery"
                    value={form.expectedDeliveryTimeline}
                    onChange={(e) => setField('expectedDeliveryTimeline', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <datalist id="rfq-edit-pr-delivery">
                    {PR_DELIVERY_TIMELINE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Payment terms</span>
                  <input
                    list="rfq-edit-pr-payment"
                    value={form.paymentTerms}
                    onChange={(e) => setField('paymentTerms', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <datalist id="rfq-edit-pr-payment">
                    {PR_PAYMENT_TERM_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Required date</span>
                  <input
                    type="date"
                    value={form.requiredDate}
                    onChange={(e) => setField('requiredDate', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs font-semibold text-gray-600">Currency</span>
                  <select
                    value={form.currency}
                    onChange={(e) => setField('currency', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm md:col-span-2 xl:col-span-3">
                  <span className="text-xs font-semibold text-gray-600">Business justification</span>
                  <textarea
                    rows={3}
                    value={form.justification}
                    onChange={(e) => setField('justification', e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Line items</p>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => (prev ? { ...prev, lineItems: [...prev.lineItems, newLine()] } : prev))
                    }
                    className="text-xs font-semibold text-teal-700 cursor-pointer"
                  >
                    + Add line
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Item name</th>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-left">UOM</th>
                        <th className="px-3 py-2 text-right">Unit cost</th>
                        <th className="px-3 py-2 text-right">GST %</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((li) => {
                        const gst = li.gstPercentage === '' ? 18 : Number(li.gstPercentage) || 0;
                        const total = lineInclusive(Number(li.quantity) || 0, Number(li.unitCost) || 0, gst);
                        return (
                          <tr key={li.key} className="border-t border-gray-100">
                            <td className="px-2 py-2">
                              <input
                                value={li.itemName}
                                onChange={(e) => updateLine(li.key, { itemName: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={li.description}
                                onChange={(e) => updateLine(li.key, { description: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={li.category}
                                onChange={(e) => updateLine(li.key, { category: e.target.value })}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={li.quantity === '' ? '' : String(li.quantity)}
                                onChange={(e) =>
                                  updateLine(li.key, { quantity: e.target.value === '' ? '' : Number(e.target.value) })
                                }
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                value={li.unit}
                                onChange={(e) => updateLine(li.key, { unit: e.target.value })}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                value={li.unitCost === '' ? '' : String(li.unitCost)}
                                onChange={(e) =>
                                  updateLine(li.key, { unitCost: e.target.value === '' ? '' : Number(e.target.value) })
                                }
                                className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={li.gstPercentage === '' ? '' : String(li.gstPercentage)}
                                onChange={(e) =>
                                  updateLine(li.key, {
                                    gstPercentage: e.target.value === '' ? '' : Number(e.target.value),
                                  })
                                }
                                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-teal-700 whitespace-nowrap">
                              {money(total, form.currency)}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {form.lineItems.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((prev) =>
                                      prev
                                        ? { ...prev, lineItems: prev.lineItems.filter((x) => x.key !== li.key) }
                                        : prev
                                    )
                                  }
                                  className="text-red-500 hover:text-red-700 cursor-pointer"
                                >
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-white flex justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || !form}
            onClick={() => void save()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving…' : 'Save PR'}
          </button>
        </div>
      </div>
    </div>
  );
}
