import { useEffect, useMemo, useState } from 'react';
import { prApi } from '../../../services/api';

export type JoinerDetail = {
  hrUpdatedDate?: string;
  joiningDate?: string;
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
  designation?: string;
  department?: string;
  company?: string;
  location?: string;
  hrName?: string;
  reportingHead?: string;
  onRollsOrContract?: string;
  emailRequired?: string;
  deviceType?: string;
  inventoryStatus?: string;
  remarks?: string;
  linkedRequesterId?: number | null;
};

type RequesterOption = { id: number; name: string; email: string };

type Props = {
  prId: number;
  joiners: JoinerDetail[];
  onSaved?: (payload: {
    joinerDetails: JoinerDetail[];
    lineItems?: unknown[];
    newPurchaseCount?: number;
    inventoryCount?: number;
  }) => void;
  readOnly?: boolean;
};

const INVENTORY_OPTIONS = [
  { value: 'new_purchase', label: 'New purchase (add laptop line item)' },
  { value: 'from_inventory', label: 'Give from inventory (existing laptop)' },
];

function joinerName(row: JoinerDetail, index: number) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || `Joiner ${index + 1}`;
}

export default function NewJoinersRfqPanel({ prId, joiners, onSaved, readOnly }: Props) {
  const [rows, setRows] = useState<JoinerDetail[]>(
    (joiners || []).map((r) => ({
      ...r,
      inventoryStatus: r.inventoryStatus || 'new_purchase',
    }))
  );
  const [requesters, setRequesters] = useState<RequesterOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setRows(
      (joiners || []).map((r) => ({
        ...r,
        inventoryStatus: r.inventoryStatus || 'new_purchase',
      }))
    );
  }, [joiners]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await prApi.listApprovalUsers();
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) {
          setRequesters(
            list
              .filter((u) => u?.id && u?.name)
              .map((u) => ({ id: u.id, name: u.name, email: u.email }))
          );
        }
      } catch {
        if (!cancelled) setRequesters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const fromInv = rows.filter((r) => r.inventoryStatus === 'from_inventory').length;
    const buyNew = rows.filter((r) => r.inventoryStatus !== 'from_inventory').length;
    return { fromInv, buyNew, total: rows.length };
  }, [rows]);

  const purchaseTasks = useMemo(
    () =>
      rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row.inventoryStatus !== 'from_inventory'),
    [rows]
  );

  const updateRow = (index: number, patch: Partial<JoinerDetail>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await prApi.updateJoinerDetails(prId, rows);
      const data = (res as {
        data?: {
          joinerDetails?: JoinerDetail[];
          lineItems?: unknown[];
          newPurchaseCount?: number;
          inventoryCount?: number;
        };
      })?.data;
      const next = data?.joinerDetails || rows;
      setRows(
        next.map((r) => ({
          ...r,
          inventoryStatus: r.inventoryStatus || 'new_purchase',
        }))
      );
      const buy = data?.newPurchaseCount ?? next.filter((r) => r.inventoryStatus !== 'from_inventory').length;
      const inv = data?.inventoryCount ?? next.filter((r) => r.inventoryStatus === 'from_inventory').length;
      onSaved?.({
        joinerDetails: next,
        lineItems: data?.lineItems,
        newPurchaseCount: buy,
        inventoryCount: inv,
      });
      setMessage(
        `Saved · ${inv} inventory · ${buy} laptop line item(s) — upload quotes & compare below`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save joiner remarks');
    } finally {
      setSaving(false);
    }
  };

  if (!rows.length) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-3">
        <h3 className="text-sm font-semibold text-emerald-950">New Joiners Laptop — RFQ allocation</h3>
        <p className="mt-1 text-xs text-emerald-800/90">
          Mark inventory vs new purchase — each new purchase adds one laptop line item on this RFQ.
          After save, use the same RFQ Entry flow below: add vendors, upload quotation files, fill
          line-item prices, then Compare prices.
        </p>
        <p className="mt-2 text-xs font-medium text-emerald-900">
          {summary.total} joiners · {summary.fromInv} inventory · {summary.buyNew} new laptop
          purchase task(s)
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Joiner</th>
              <th className="px-3 py-2 font-semibold">Dept / Location</th>
              <th className="px-3 py-2 font-semibold">Device</th>
              <th className="px-3 py-2 font-semibold">Link requester</th>
              <th className="px-3 py-2 font-semibold">Inventory / New</th>
              <th className="px-3 py-2 font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const name = joinerName(row, index);
              return (
                <tr key={index} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{name}</div>
                    <div className="text-slate-500">{row.designation || '—'}</div>
                    <div className="text-slate-400">{row.joiningDate || ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.department || '—'}</div>
                    <div className="text-slate-500">{row.location || ''}</div>
                    <div className="text-slate-400">{row.company || ''}</div>
                  </td>
                  <td className="px-3 py-2">{row.deviceType || 'Laptop'}</td>
                  <td className="px-3 py-2 min-w-[10rem]">
                    <select
                      disabled={readOnly}
                      className="w-full rounded-md border border-slate-200 px-1.5 py-1"
                      value={row.linkedRequesterId || ''}
                      onChange={(e) =>
                        updateRow(index, {
                          linkedRequesterId: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {requesters.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[12rem]">
                    <select
                      disabled={readOnly}
                      className="w-full rounded-md border border-slate-200 px-1.5 py-1"
                      value={row.inventoryStatus || 'new_purchase'}
                      onChange={(e) => updateRow(index, { inventoryStatus: e.target.value })}
                    >
                      {INVENTORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 min-w-[12rem]">
                    <input
                      disabled={readOnly}
                      className="w-full rounded-md border border-slate-200 px-1.5 py-1"
                      value={row.remarks || ''}
                      placeholder="e.g. stock asset tag / buy new"
                      onChange={(e) => updateRow(index, { remarks: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {purchaseTasks.length ? (
        <div className="border-t border-emerald-100 bg-white px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">
            New purchase laptop tasks ({purchaseTasks.length})
          </p>
          <ul className="space-y-1.5">
            {purchaseTasks.map(({ row, index }) => (
              <li
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-slate-800"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-700 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <i className="ri-macbook-line text-emerald-700" aria-hidden />
                <span className="font-semibold">
                  {row.deviceType || 'Laptop'} — {joinerName(row, index)}
                </span>
                {row.department ? <span className="text-slate-500">· {row.department}</span> : null}
                {row.linkedRequesterId ? (
                  <span className="text-slate-500">
                    · requester{' '}
                    {requesters.find((u) => u.id === row.linkedRequesterId)?.name ||
                      `#${row.linkedRequesterId}`}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save & add laptop purchase tasks'}
          </button>
          {message ? <span className="text-xs text-slate-600">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
