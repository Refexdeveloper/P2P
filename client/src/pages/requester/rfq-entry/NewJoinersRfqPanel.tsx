import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  address?: string;
  hrName?: string;
  reportingHead?: string;
  reportingHeadName?: string;
  reportingHeadEmail?: string;
  onRollsOrContract?: string;
  emailRequired?: string;
  deviceType?: string;
  deviceTypes?: string[];
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
  /** L1/L2 RFQ approval — show full joiner roster (read-only) */
  approvalView?: boolean;
};

const INVENTORY_OPTIONS = [
  { value: 'new_purchase', label: 'New purchase (counts toward device qty)' },
  { value: 'from_inventory', label: 'Give from inventory (existing device)' },
];

function normalizeDeviceLabel(raw?: string) {
  const device = String(raw || 'Laptop').trim() || 'Laptop';
  if (/desk\s*top|desktop/i.test(device)) return 'Desktop';
  if (/smart\s*phone|smartphone|mobile\s*phone|\btab\b|tablet/i.test(device)) {
    return 'Smartphone / Tab';
  }
  if (/laptop/i.test(device)) return 'Laptop';
  return device;
}

function devicesForRow(row: JoinerDetail): string[] {
  if (Array.isArray(row.deviceTypes) && row.deviceTypes.length) {
    return [...new Set(row.deviceTypes.map((d) => normalizeDeviceLabel(String(d))))];
  }
  if (row.deviceType) return [normalizeDeviceLabel(row.deviceType)];
  return ['Laptop'];
}

function joinerName(row: JoinerDetail, index: number) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || `Joiner ${index + 1}`;
}

function inventoryLabel(status?: string) {
  const s = String(status || 'new_purchase');
  return INVENTORY_OPTIONS.find((o) => o.value === s)?.label || s;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === '' || children === '—') return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 break-words text-sm text-slate-800">{children}</div>
    </div>
  );
}

export default function NewJoinersRfqPanel({ prId, joiners, onSaved, readOnly, approvalView }: Props) {
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

  const deviceLineSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.inventoryStatus === 'from_inventory') continue;
      for (const key of devicesForRow(row)) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()].map(([device, qty]) => ({ device, qty }));
  }, [rows]);

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
          laptopQty?: number;
          rfqEntryTasksCreated?: number;
        };
      })?.data;
      const next = data?.joinerDetails || rows;
      setRows(
        next.map((r) => ({
          ...r,
          inventoryStatus: r.inventoryStatus || 'new_purchase',
        }))
      );
      const buy =
        data?.newPurchaseCount ??
        next.filter((r) => r.inventoryStatus !== 'from_inventory').length;
      const inv =
        data?.inventoryCount ??
        next.filter((r) => r.inventoryStatus === 'from_inventory').length;
      const deviceQty = data?.laptopQty ?? buy;
      onSaved?.({
        joinerDetails: next,
        lineItems: data?.lineItems,
        newPurchaseCount: buy,
        inventoryCount: inv,
      });
      const tasksCreated = data?.rfqEntryTasksCreated || 0;
      setMessage(
        `Saved · ${inv} inventory · ${buy} new purchase → device qty ${deviceQty}` +
          (tasksCreated ? ` · ${tasksCreated} RFQ Entry task(s) added` : '')
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save joiner remarks');
    } finally {
      setSaving(false);
    }
  };

  if (!rows.length) return null;

  const linkedRequesterName = (id?: number | null) => {
    if (!id) return '—';
    return requesters.find((u) => Number(u.id) === Number(id))?.name || `User #${id}`;
  };

  const renderMobileCards = () => (
    <div className="space-y-3 p-3 md:hidden">
      {rows.map((row, index) => {
        const name = joinerName(row, index);
        const reporting =
          row.reportingHeadName || row.reportingHead || row.reportingHeadEmail || '';
        return (
          <article
            key={index}
            className="rounded-xl border border-emerald-100 bg-white p-3.5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Joiner {index + 1}
                </p>
                <h4 className="mt-0.5 text-base font-semibold text-slate-900 break-words">{name}</h4>
                {row.designation ? (
                  <p className="text-xs text-slate-500 break-words">{row.designation}</p>
                ) : null}
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 text-right">
                {devicesForRow(row).join(' · ')}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <MetaRow label="Joining">{row.joiningDate || '—'}</MetaRow>
              <MetaRow label="Mobile">
                {row.mobileNumber ? (
                  <a href={`tel:${row.mobileNumber}`} className="text-[#0f6b7a] underline-offset-2">
                    {row.mobileNumber}
                  </a>
                ) : (
                  '—'
                )}
              </MetaRow>
              <MetaRow label="Department">{row.department || '—'}</MetaRow>
              <MetaRow label="Location">{row.location || '—'}</MetaRow>
              <MetaRow label="Address">
                {row.address ? (
                  <span className="whitespace-pre-wrap">{row.address}</span>
                ) : (
                  '—'
                )}
              </MetaRow>
              <MetaRow label="Company">{row.company || ''}</MetaRow>
              {approvalView ? (
                <>
                  <MetaRow label="Email">{row.emailRequired || '—'}</MetaRow>
                  <MetaRow label="Employment">{row.onRollsOrContract || ''}</MetaRow>
                  <MetaRow label="Reporting head">
                    <div>
                      <div>{reporting || '—'}</div>
                      {row.reportingHeadEmail && row.reportingHeadName ? (
                        <div className="text-xs text-slate-400 break-all">{row.reportingHeadEmail}</div>
                      ) : null}
                    </div>
                  </MetaRow>
                  <MetaRow label="Inventory / New">{inventoryLabel(row.inventoryStatus)}</MetaRow>
                  <MetaRow label="Remarks">{row.remarks || ''}</MetaRow>
                </>
              ) : (
                <>
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Link requester
                    </p>
                    <select
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
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
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Inventory / New
                    </p>
                    <select
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                      value={row.inventoryStatus || 'new_purchase'}
                      onChange={(e) => updateRow(index, { inventoryStatus: e.target.value })}
                    >
                      {INVENTORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Remarks
                    </p>
                    <input
                      disabled={readOnly}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                      value={row.remarks || ''}
                      placeholder="e.g. stock asset tag / buy new"
                      onChange={(e) => updateRow(index, { remarks: e.target.value })}
                    />
                  </div>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  const renderDesktopTable = () => (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Joiner</th>
            <th className="px-3 py-2 font-semibold">Dept / Location</th>
            <th className="px-3 py-2 font-semibold">Address</th>
            <th className="px-3 py-2 font-semibold">Device</th>
            {approvalView ? (
              <>
                <th className="px-3 py-2 font-semibold">Mobile</th>
                <th className="px-3 py-2 font-semibold">Email / Type</th>
                <th className="px-3 py-2 font-semibold">Reporting head</th>
                <th className="px-3 py-2 font-semibold">Inventory / New</th>
                <th className="px-3 py-2 font-semibold">Remarks</th>
              </>
            ) : (
              <>
                <th className="px-3 py-2 font-semibold">Link requester</th>
                <th className="px-3 py-2 font-semibold">Inventory / New</th>
                <th className="px-3 py-2 font-semibold">Remarks</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const name = joinerName(row, index);
            const reporting =
              row.reportingHeadName || row.reportingHead || row.reportingHeadEmail || '—';
            return (
              <tr key={index} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{name}</div>
                  <div className="text-slate-500">{row.designation || '—'}</div>
                  <div className="text-slate-400">
                    {row.joiningDate ? `Joining ${row.joiningDate}` : ''}
                    {row.hrUpdatedDate ? ` · HR ${row.hrUpdatedDate}` : ''}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div>{row.department || '—'}</div>
                  <div className="text-slate-500">{row.location || ''}</div>
                  <div className="text-slate-400">{row.company || ''}</div>
                </td>
                <td className="max-w-[14rem] px-3 py-2 whitespace-pre-wrap text-slate-700">
                  {row.address || '—'}
                </td>
                <td className="px-3 py-2">{devicesForRow(row).join(', ')}</td>
                {approvalView ? (
                  <>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                      {row.mobileNumber || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="break-all">{row.emailRequired || '—'}</div>
                      <div className="text-slate-500">{row.onRollsOrContract || ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{reporting}</div>
                      {row.reportingHeadEmail && row.reportingHeadName ? (
                        <div className="break-all text-slate-400">{row.reportingHeadEmail}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{inventoryLabel(row.inventoryStatus)}</td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-slate-600">
                      {row.remarks || '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 min-w-[10rem]">
                      {readOnly ? (
                        <span>{linkedRequesterName(row.linkedRequesterId)}</span>
                      ) : (
                        <select
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
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      {readOnly ? (
                        <span>{inventoryLabel(row.inventoryStatus)}</span>
                      ) : (
                        <select
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
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      {readOnly ? (
                        <span className="whitespace-pre-wrap">{row.remarks || '—'}</span>
                      ) : (
                        <input
                          className="w-full rounded-md border border-slate-200 px-1.5 py-1"
                          value={row.remarks || ''}
                          placeholder="e.g. stock asset tag / buy new"
                          onChange={(e) => updateRow(index, { remarks: e.target.value })}
                        />
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-50/80 px-3 py-3 sm:px-4">
        <h3 className="text-sm font-semibold text-emerald-950">
          {approvalView ? 'New Joiners — person list' : 'New Joiners Laptop — RFQ allocation'}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800/90">
          {approvalView ? (
            'Full roster for this New Joiners Laptop purchase. Review names, joining dates, and inventory vs new purchase before approving the recommended vendor.'
          ) : (
            <>
              Mark inventory vs new purchase. RFQ Entry stays with <strong>Reginold</strong> only —
              linked requester is optional tagging. Same device type → one line (qty = new purchases).
            </>
          )}
        </p>
        <p className="mt-2 text-xs font-medium text-emerald-900">
          {summary.total} joiners · {summary.fromInv} inventory · {summary.buyNew} new purchase
          {deviceLineSummary.length
            ? ` → ${deviceLineSummary.map((d) => `${d.device} ×${d.qty}`).join(' · ')}`
            : ''}
        </p>
      </div>

      {renderMobileCards()}
      {renderDesktopTable()}

      {deviceLineSummary.length ? (
        <div className="border-t border-emerald-100 bg-white px-3 py-3 sm:px-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">
            RFQ line items
          </p>
          <div className="flex flex-col gap-2">
            {deviceLineSummary.map(({ device, qty }) => (
              <div
                key={device}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-xs text-slate-800"
              >
                <i
                  className={
                    /phone|tab/i.test(device)
                      ? 'ri-smartphone-line text-emerald-700'
                      : /desktop/i.test(device)
                        ? 'ri-computer-line text-emerald-700'
                        : 'ri-macbook-line text-emerald-700'
                  }
                  aria-hidden
                />
                <span className="font-semibold">{device}</span>
                <span className="rounded-md bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">
                  Qty {qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="w-full rounded-lg bg-emerald-700 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:py-1.5"
          >
            {saving ? 'Saving…' : 'Save & sync device qty'}
          </button>
          {message ? <span className="text-xs text-slate-600 break-words">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
