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
  hrName: string;
  reportingHead: string;
  reportingHeadUserId?: number | null;
  reportingHeadName?: string;
  reportingHeadEmail?: string;
  onRollsOrContract: string;
  emailRequired: string;
  deviceType: string;
};

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
  hrName: '',
  reportingHead: '',
  reportingHeadUserId: null,
  reportingHeadName: '',
  reportingHeadEmail: '',
  onRollsOrContract: 'On Rolls',
  emailRequired: 'Yes',
  deviceType: 'Laptop',
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
  const entityLabel = (ent: EntityRecord) =>
    formatEntityLabel
      ? formatEntityLabel(ent)
      : ent.code
        ? `${ent.code} — ${ent.name}`
        : ent.name;

  const updateCell = (index: number, key: keyof JoinerRow, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
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
    onChange([...rows, base]);
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
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '16rem' }}>
                Reporting Head Email ID
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '9rem' }}>
                Rolls / Contractor
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '6rem' }}>
                Email ID
              </th>
              <th className="whitespace-nowrap px-3 py-3 font-semibold" style={{ minWidth: '8rem' }}>
                Laptop / Desktop
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
                  <td className="px-2 py-2.5">
                    <select
                      className={inputClass}
                      value={row.deviceType}
                      onChange={(e) => updateCell(index, 'deviceType', e.target.value)}
                    >
                      <option value="Laptop">Laptop</option>
                      <option value="Desktop">Desktop</option>
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
