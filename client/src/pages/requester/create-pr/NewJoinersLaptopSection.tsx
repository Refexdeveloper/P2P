import { useMemo, useState } from 'react';
import type { DepartmentRecord, EntityRecord } from '../../../services/api';
import SearchCreateField from './SearchCreateField';

export type JoinerRow = {
  hrUpdatedDate: string;
  joiningDate: string;
  firstName: string;
  lastName: string;
  mobileNumber: string;
  designation: string;
  department: string;
  company: string;
  location: string;
  address: string;
  hrName: string;
  reportingHead: string;
  reportingHeadUserId?: number | null;
  reportingHeadName?: string;
  reportingHeadEmail?: string;
  onRollsOrContract: string;
  emailRequired: string;
  /** Multi-select: Laptop + Desktop → two RFQ line items */
  deviceTypes: string[];
  /** First selected device (compat) */
  deviceType: string;
  /** Optional tag only — RFQ Entry always goes to Reginold, not this user */
  linkedRequesterId?: number | null;
};

export const DEVICE_OPTIONS = ['Laptop', 'Desktop', 'Smartphone / Tab'] as const;

export const EMPTY_JOINER_ROW = (): JoinerRow => ({
  hrUpdatedDate: '',
  joiningDate: '',
  firstName: '',
  lastName: '',
  mobileNumber: '',
  designation: '',
  department: '',
  company: '',
  location: '',
  address: '',
  hrName: '',
  reportingHead: '',
  reportingHeadUserId: null,
  reportingHeadName: '',
  reportingHeadEmail: '',
  onRollsOrContract: 'On Rolls',
  emailRequired: 'Yes',
  deviceTypes: ['Laptop'],
  deviceType: 'Laptop',
  linkedRequesterId: null,
});

type ReportingUser = { id: number; name: string; email: string; role?: string; department?: string };

type Props = {
  rows: JoinerRow[];
  onChange: (rows: JoinerRow[]) => void;
  errors?: Record<string, string>;
  entities?: EntityRecord[];
  departments?: DepartmentRecord[];
  reportingUsers?: ReportingUser[];
  entityId?: number | '';
  onEntityIdChange?: (id: number | '') => void;
  formatEntityLabel?: (ent: EntityRecord) => string;
};

const inputClass =
  'box-border h-11 w-full min-w-[7rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25';

function entityCompanyValue(ent: EntityRecord) {
  return String(ent.code || ent.name || '').trim();
}

export default function NewJoinersLaptopSection({
  rows,
  onChange,
  errors = {},
  entities = [],
  departments = [],
  reportingUsers = [],
  entityId = '',
  onEntityIdChange,
  formatEntityLabel,
}: Props) {
  const [bulkFrom, setBulkFrom] = useState(1);
  const [bulkTo, setBulkTo] = useState(1);
  const [bulkRequesterId, setBulkRequesterId] = useState<number | ''>('');

  const entityLabel = (ent: EntityRecord) =>
    formatEntityLabel
      ? formatEntityLabel(ent)
      : ent.code
        ? `${ent.code} — ${ent.name}`
        : ent.name;

  const requesterOptions = useMemo(
    () => reportingUsers.filter((u) => u?.id && u?.name),
    [reportingUsers]
  );

  /** Live RFQ Entry sets — any split (3+7, 5+5, 2+4+4, …). */
  const rfqSets = useMemo(() => {
    const counts = new Map<number | 0, number>();
    for (const row of rows) {
      if (!String(row.firstName || '').trim() && !String(row.lastName || '').trim()) continue;
      const key = Number(row.linkedRequesterId || 0) || 0;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, qty]) => {
        const name =
          id === 0
            ? 'Default (Reginold)'
            : requesterOptions.find((u) => u.id === id)?.name || `Requester #${id}`;
        return { id, name, qty };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, requesterOptions]);

  const updateCell = (
    index: number,
    key: keyof JoinerRow,
    value: string | number | null | string[]
  ) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  };

  const toggleDevice = (index: number, device: string) => {
    const row = rows[index];
    const current = Array.isArray(row.deviceTypes) && row.deviceTypes.length
      ? [...row.deviceTypes]
      : row.deviceType
        ? [row.deviceType]
        : ['Laptop'];
    const exists = current.includes(device);
    const nextTypes = exists
      ? current.filter((d) => d !== device)
      : [...current, device];
    // Keep at least one device selected
    const deviceTypes = nextTypes.length ? nextTypes : [device];
    const next = rows.map((r, i) =>
      i === index
        ? {
            ...r,
            deviceTypes,
            deviceType: deviceTypes[0] || 'Laptop',
          }
        : r
    );
    onChange(next);
  };

  const applyBulkRequester = () => {
    const from = Math.max(1, Math.min(rows.length, Number(bulkFrom) || 1));
    const to = Math.max(from, Math.min(rows.length, Number(bulkTo) || from));
    const reqId = bulkRequesterId === '' ? null : Number(bulkRequesterId);
    const next = rows.map((row, i) => {
      const n = i + 1;
      if (n < from || n > to) return row;
      return { ...row, linkedRequesterId: reqId };
    });
    onChange(next);
  };

  const onSelectCompanyForRow = (index: number, rawId: string) => {
    const ent = entities.find((e) => String(e.id) === String(rawId));
    if (!ent) {
      const next = rows.map((row, i) => (i === index ? { ...row, company: '' } : row));
      onChange(next);
      if (index === 0) onEntityIdChange?.('');
      return;
    }
    const company = entityCompanyValue(ent);
    // Company = Entity Master — first row (or empty PR entity) sets PR entityId
    const next = rows.map((row, i) => (i === index ? { ...row, company } : row));
    onChange(next);
    if (!entityId || index === 0) onEntityIdChange?.(ent.id);
  };

  const addRow = () => {
    const ent = entityId ? entities.find((e) => e.id === entityId) || null : null;
    const base = EMPTY_JOINER_ROW();
    if (ent) base.company = entityCompanyValue(ent);
    const next = [...rows, base];
    onChange(next);
    setBulkTo(next.length);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      const ent = entityId ? entities.find((e) => e.id === entityId) || null : null;
      const base = EMPTY_JOINER_ROW();
      if (ent) base.company = entityCompanyValue(ent);
      onChange([base]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      {errors.entityId ? (
        <p className="text-sm text-red-600" data-field="entityId">
          {errors.entityId}
        </p>
      ) : null}
      {errors.joinerDetails ? (
        <p className="text-sm text-red-600">{errors.joinerDetails}</p>
      ) : null}
      {!entities.length ? (
        <p className="text-xs text-amber-700">
          No entities in Entity Master — Company dropdown will be empty until entities are added.
        </p>
      ) : null}

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 space-y-2">
        <p className="text-xs text-emerald-900">
          Optional tag for joiner groups (info only). After Mugesh approve,{' '}
          <strong>RFQ Entry is always assigned to Reginold only</strong> — not HR.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Rows from
            <input
              type="number"
              min={1}
              max={Math.max(1, rows.length)}
              className={`${inputClass} mt-1 w-20`}
              value={bulkFrom}
              onChange={(e) => setBulkFrom(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            to
            <input
              type="number"
              min={1}
              max={Math.max(1, rows.length)}
              className={`${inputClass} mt-1 w-20`}
              value={bulkTo}
              onChange={(e) => setBulkTo(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 min-w-[12rem] flex-1">
            Assign RFQ requester
            <select
              className={`${inputClass} mt-1`}
              value={bulkRequesterId}
              onChange={(e) =>
                setBulkRequesterId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Default (Reginold)</option>
              {requesterOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={applyBulkRequester}
            className="inline-flex h-11 items-center rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Apply to rows
          </button>
        </div>
        {rfqSets.length ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 self-center">
              RFQ sets
            </span>
            {rfqSets.map((s) => (
              <span
                key={String(s.id)}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-emerald-950 ring-1 ring-emerald-200"
              >
                {s.name}
                <span className="rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  ×{s.qty}
                </span>
              </span>
            ))}
            <span className="text-[11px] text-emerald-800/80 self-center">
              → RFQ Entry: Reginold only
            </span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="bg-emerald-100/90 text-emerald-950">
              <th className="sticky left-0 z-10 bg-emerald-100 px-3 py-3 font-semibold">#</th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '10rem' }}>
                Joining Date
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                First Name
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                Last Name
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                Mobile Number
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '12rem' }}>
                Designation
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '11rem' }}>
                Department
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '12rem' }}>
                Company <span className="text-red-500">*</span>
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                Location
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '14rem' }}>
                Address
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '16rem' }}>
                Reporting Head Email ID
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                Rolls / Contractor
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '6rem' }}>
                Email ID
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '12rem' }}>
                Device (multi) <span className="text-red-500">*</span>
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '12rem' }}>
                RFQ Requester
              </th>
              <th className="px-3 py-3 font-semibold"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const matchedEntity =
                entities.find((e) => entityCompanyValue(e) === row.company) ||
                entities.find((e) => e.name === row.company) ||
                (entityId ? entities.find((e) => e.id === entityId) : null);

              return (
                <tr key={index} className="border-t border-slate-100 align-middle">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2.5 tabular-nums text-slate-500">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="date"
                      className={inputClass}
                      value={row.joiningDate}
                      onChange={(e) => updateCell(index, 'joiningDate', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      className={inputClass}
                      value={row.firstName}
                      onChange={(e) => updateCell(index, 'firstName', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      className={inputClass}
                      value={row.lastName}
                      onChange={(e) => updateCell(index, 'lastName', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      className={inputClass}
                      value={row.mobileNumber}
                      onChange={(e) => updateCell(index, 'mobileNumber', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      className={inputClass}
                      value={row.designation}
                      onChange={(e) => updateCell(index, 'designation', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      className={inputClass}
                      value={row.department}
                      onChange={(e) => updateCell(index, 'department', e.target.value)}
                    >
                      <option value="">Select department…</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.code ? `${d.code} — ${d.name}` : d.name}
                        </option>
                      ))}
                      {row.department &&
                      !departments.some((d) => d.name === row.department) ? (
                        <option value={row.department}>{row.department}</option>
                      ) : null}
                    </select>
                  </td>
                  <td className="px-2 py-2.5" data-field={index === 0 ? 'entityId' : undefined}>
                    <select
                      className={`${inputClass} ${
                        errors.entityId && index === 0 && !matchedEntity
                          ? 'border-red-400 bg-red-50'
                          : ''
                      }`}
                      value={matchedEntity ? String(matchedEntity.id) : ''}
                      onChange={(e) => onSelectCompanyForRow(index, e.target.value)}
                      title="Company from Entity Master"
                    >
                      <option value="">Select company (Entity Master)…</option>
                      {entities.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {entityLabel(ent)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      className={inputClass}
                      value={row.location}
                      onChange={(e) => updateCell(index, 'location', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5" style={{ minWidth: '14rem' }}>
                    <textarea
                      rows={2}
                      className="box-border min-h-[2.75rem] w-full min-w-[12rem] resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                      value={row.address || ''}
                      placeholder="Full address…"
                      onChange={(e) => updateCell(index, 'address', e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2.5" style={{ minWidth: '16rem' }}>
                    <SearchCreateField
                      compact
                      options={reportingUsers.map((u) => ({
                        id: u.id,
                        label: u.email ? `${u.name} (${u.email})` : u.name,
                        subLabel: [u.role, u.department].filter(Boolean).join(' · ') || undefined,
                      }))}
                      displayValue={
                        row.reportingHeadName && row.reportingHeadEmail
                          ? `${row.reportingHeadName} (${row.reportingHeadEmail})`
                          : row.reportingHead || ''
                      }
                      selectedId={row.reportingHeadUserId || null}
                      placeholder="Search reporting head by name or email…"
                      addNoun="user"
                      emptyHint={
                        reportingUsers.length
                          ? undefined
                          : 'No users loaded — try again or ask admin.'
                      }
                      onSelect={(opt) => {
                        const u = reportingUsers.find((x) => x.id === Number(opt.id));
                        const next = rows.map((r, i) =>
                          i === index
                            ? {
                                ...r,
                                reportingHead: u?.email || u?.name || String(opt.label),
                                reportingHeadUserId: u?.id || Number(opt.id) || null,
                                reportingHeadName: u?.name || String(opt.label),
                                reportingHeadEmail: u?.email || '',
                              }
                            : r
                        );
                        onChange(next);
                      }}
                      onClear={() => {
                        const next = rows.map((r, i) =>
                          i === index
                            ? {
                                ...r,
                                reportingHead: '',
                                reportingHeadUserId: null,
                                reportingHeadName: '',
                                reportingHeadEmail: '',
                              }
                            : r
                        );
                        onChange(next);
                      }}
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      className={inputClass}
                      value={row.onRollsOrContract}
                      onChange={(e) => updateCell(index, 'onRollsOrContract', e.target.value)}
                    >
                      <option value="On Rolls">On Rolls</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      className={inputClass}
                      value={row.emailRequired}
                      onChange={(e) => updateCell(index, 'emailRequired', e.target.value)}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </td>
                  <td className="px-2 py-2.5" style={{ minWidth: '12rem' }}>
                    <div
                      className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                      title="Select one or more — each device adds a line item qty in RFQ Entry"
                    >
                      {DEVICE_OPTIONS.map((opt) => {
                        const selected =
                          (Array.isArray(row.deviceTypes) && row.deviceTypes.includes(opt)) ||
                          (!row.deviceTypes?.length && row.deviceType === opt);
                        return (
                          <label
                            key={opt}
                            className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-800"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-emerald-600"
                              checked={Boolean(selected)}
                              onChange={() => toggleDevice(index, opt)}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-2 py-2.5">
                    <select
                      className={inputClass}
                      value={row.linkedRequesterId || ''}
                      onChange={(e) =>
                        updateCell(
                          index,
                          'linkedRequesterId',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      title="Optional tag — RFQ Entry stays with Reginold"
                    >
                      <option value="">Default (Reginold)</option>
                      {requesterOptions.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeRow(index)}
                      title="Remove joiner"
                    >
                      <i className="ri-delete-bin-line text-lg" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          <i className="ri-add-line" />
          Add joiner
        </button>
      </div>
    </div>
  );
}
