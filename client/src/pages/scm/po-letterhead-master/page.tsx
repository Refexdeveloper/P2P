import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RichTextEditor from '../../../components/base/RichTextEditor';
import {
  poLetterheadApi,
  PoLetterheadClause,
  PoLetterheadConfig,
  PoType,
  PO_TYPE_LABELS,
} from '../../../services/api';

type DocGroup = 'purchase_order' | 'work_order';

const DOC_GROUPS: { id: DocGroup; label: string }[] = [
  { id: 'purchase_order', label: 'Purchase Order' },
  { id: 'work_order', label: 'Work Order' },
];

const TEMPLATES_BY_GROUP: Record<DocGroup, { id: PoType; label: string }[]> = {
  purchase_order: [
    { id: 'short_po', label: 'Short PO' },
    { id: 'long_po', label: 'Long PO' },
  ],
  work_order: [
    { id: 'short_wo', label: 'Short WO' },
    { id: 'long_wo', label: 'Long WO' },
  ],
};

const ALL_PO_TYPES: PoType[] = ['short_po', 'long_po', 'short_wo', 'long_wo'];

function emptyConfigs(): Record<PoType, PoLetterheadConfig | null> {
  return { short_po: null, long_po: null, short_wo: null, long_wo: null };
}

function emptySnapshots(): Record<PoType, string> {
  return { short_po: '', long_po: '', short_wo: '', long_wo: '' };
}

type EditableClause = PoLetterheadClause & { clientKey: string };

function makeClientKey() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyRow(): EditableClause {
  return { clientKey: makeClientKey(), termsHeader: '', termsDescription: '', sortOrder: 0 };
}

function toEditableClauses(clauses: PoLetterheadClause[]): EditableClause[] {
  if (!clauses.length) return [emptyRow()];
  return clauses.map((clause) => ({
    ...clause,
    clientKey: clause.id ? `db-${clause.id}` : makeClientKey(),
  }));
}

function fromEditableClauses(clauses: EditableClause[]): PoLetterheadClause[] {
  return clauses.map(({ clientKey: _key, ...clause }) => clause);
}

function createEmptyConfig(poType: PoType): PoLetterheadConfig {
  return {
    poType,
    poTypeLabel: PO_TYPE_LABELS[poType],
    title: PO_TYPE_LABELS[poType],
    letterheadHeader: '',
    terms: [emptyRow()],
    annexure: [emptyRow()],
  };
}

function normalizeConfig(config: PoLetterheadConfig): PoLetterheadConfig {
  return {
    ...config,
    terms: toEditableClauses(config.terms),
    annexure: toEditableClauses(config.annexure),
  } as PoLetterheadConfig & { terms: EditableClause[]; annexure: EditableClause[] };
}

function ClauseTable({
  title,
  headerColumnLabel = 'Header',
  descriptionColumnLabel = 'Description',
  descriptionFieldLabel = 'Description',
  headerPlaceholder = 'e.g. Payment Terms',
  descriptionPlaceholder = 'Enter description...',
  rows,
  onChange,
}: {
  title: string;
  headerColumnLabel?: string;
  descriptionColumnLabel?: string;
  descriptionFieldLabel?: string;
  headerPlaceholder?: string;
  descriptionPlaceholder?: string;
  rows: EditableClause[];
  onChange: (rows: EditableClause[]) => void;
}) {
  const updateRow = (index: number, patch: Partial<EditableClause>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => onChange([...rows, emptyRow()]);

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      onChange([emptyRow()]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-200 rounded-full text-gray-500">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
        >
          <i className="ri-add-line"></i>
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-white border-b border-gray-100">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3 w-[280px]">{headerColumnLabel}</th>
              <th className="px-5 py-3">{descriptionColumnLabel}</th>
              <th className="px-5 py-3 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.clientKey} className="border-b border-gray-50 align-top hover:bg-gray-50/40">
                <td className="px-5 py-4 text-sm text-gray-400">{index + 1}</td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">Header</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-header`}
                    value={row.termsHeader}
                    onChange={(html) => updateRow(index, { termsHeader: html })}
                    placeholder={headerPlaceholder}
                    minHeight={72}
                    advanced
                  />
                </td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">{descriptionFieldLabel}</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-desc`}
                    value={row.termsDescription}
                    onChange={(html) => updateRow(index, { termsDescription: html })}
                    placeholder={descriptionPlaceholder}
                    minHeight={120}
                    advanced
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-1 pt-5">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <i className="ri-arrow-up-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <i className="ri-arrow-down-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      title="Remove row"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function serializeConfig(config: PoLetterheadConfig | null) {
  if (!config) return '';
  return JSON.stringify({
    title: config.title,
    letterheadHeader: config.letterheadHeader,
    terms: fromEditableClauses(config.terms as EditableClause[]),
    annexure: fromEditableClauses(config.annexure as EditableClause[]),
  });
}

export default function PoTypeMasterPage() {
  const [activeGroup, setActiveGroup] = useState<DocGroup>('purchase_order');
  const [activeType, setActiveType] = useState<PoType>('short_po');
  const [configs, setConfigs] = useState<Record<PoType, PoLetterheadConfig | null>>(emptyConfigs);
  const [savedSnapshots, setSavedSnapshots] = useState<Record<PoType, string>>(emptySnapshots);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const groupTemplates = TEMPLATES_BY_GROUP[activeGroup];

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await poLetterheadApi.list();
      const map = emptyConfigs();
      const snapshots = emptySnapshots();

      for (const item of res.data) {
        if (!ALL_PO_TYPES.includes(item.poType)) continue;
        const normalized = normalizeConfig(item);
        map[item.poType] = normalized;
        snapshots[item.poType] = serializeConfig(normalized);
      }

      for (const type of ALL_PO_TYPES) {
        if (!map[type]) {
          const empty = normalizeConfig(createEmptyConfig(type));
          map[type] = empty;
          snapshots[type] = serializeConfig(empty);
        }
      }

      setConfigs(map);
      setSavedSnapshots(snapshots);
    } catch {
      const fallback = emptyConfigs();
      const snapshots = emptySnapshots();
      for (const type of ALL_PO_TYPES) {
        fallback[type] = normalizeConfig(createEmptyConfig(type));
        snapshots[type] = serializeConfig(fallback[type]!);
      }
      setConfigs(fallback);
      setSavedSnapshots(snapshots);
      showToast('Could not load saved data. You can add and save a new template.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const current = configs[activeType];

  const isDirty = useMemo(() => {
    if (!current) return false;
    return serializeConfig(current) !== savedSnapshots[activeType];
  }, [current, savedSnapshots, activeType]);

  const dirtyTypes = useMemo(() => {
    return ALL_PO_TYPES.filter((type) => {
      const config = configs[type];
      if (!config) return false;
      return serializeConfig(config) !== savedSnapshots[type];
    }).map((t) => PO_TYPE_LABELS[t]);
  }, [configs, savedSnapshots]);

  const updateCurrent = (patch: Partial<PoLetterheadConfig>) => {
    if (!current) return;
    setConfigs((prev) => ({
      ...prev,
      [activeType]: { ...current, ...patch },
    }));
  };

  const switchPoType = (nextType: PoType) => {
    if (nextType === activeType) return;
    if (isDirty) {
      const ok = window.confirm(
        `You have unsaved changes in ${PO_TYPE_LABELS[activeType]}. Switch without saving?`
      );
      if (!ok) return;
    }
    setActiveType(nextType);
  };

  const switchGroup = (nextGroup: DocGroup) => {
    if (nextGroup === activeGroup) return;
    const nextType = TEMPLATES_BY_GROUP[nextGroup][0].id;
    if (isDirty) {
      const ok = window.confirm(
        `You have unsaved changes in ${PO_TYPE_LABELS[activeType]}. Switch without saving?`
      );
      if (!ok) return;
    }
    setActiveGroup(nextGroup);
    setActiveType(nextType);
  };

  const handleSave = async () => {
    if (!current) return;

    const terms = fromEditableClauses(current.terms as EditableClause[]);
    const annexure = fromEditableClauses(current.annexure as EditableClause[]);

    const plain = (html: string) =>
      String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const hasContent =
      current.title?.trim() ||
      current.letterheadHeader?.trim() ||
      terms.some((r) => plain(r.termsHeader) || plain(r.termsDescription)) ||
      annexure.some((r) => plain(r.termsHeader) || plain(r.termsDescription));

    if (!hasContent) {
      showToast('Add at least one header or description before saving', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await poLetterheadApi.save(activeType, {
        title: current.title,
        letterheadHeader: current.letterheadHeader,
        terms,
        annexure,
      });
      const normalized = normalizeConfig(res.data);
      setConfigs((prev) => ({ ...prev, [activeType]: normalized }));
      setSavedSnapshots((prev) => ({
        ...prev,
        [activeType]: serializeConfig(normalized),
      }));
      showToast(`${normalized.poTypeLabel} saved successfully`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = () => {
    const empty = normalizeConfig(createEmptyConfig(activeType));
    setConfigs((prev) => ({ ...prev, [activeType]: empty }));
    showToast(`Started editing ${empty.poTypeLabel}. Add content and click Save.`, 'success');
  };

  const termsRows = (current?.terms as EditableClause[]) || [emptyRow()];
  const annexureRows = (current?.annexure as EditableClause[]) || [emptyRow()];
  const activeLabel = PO_TYPE_LABELS[activeType];
  const titleFieldLabel = activeGroup === 'work_order' ? 'WO Title' : 'PO Title';
  const headerFieldLabel = activeGroup === 'work_order' ? 'WO Header' : 'PO Header';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PO Type Master</h1>
            <p className="text-sm text-gray-500 mt-1">
              Purchase Order and Work Order each have Short and Long templates — header, terms, and annexure.
            </p>
            {dirtyTypes.length > 0 && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <i className="ri-error-warning-line"></i>
                Unsaved changes: {dirtyTypes.join(', ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !current || !isDirty}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
            Save {activeLabel}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
            {DOC_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => switchGroup(group.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-colors ${
                  activeGroup === group.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
            {groupTemplates.map((type) => {
              const typeDirty =
                configs[type.id] && serializeConfig(configs[type.id]!) !== savedSnapshots[type.id];
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => switchPoType(type.id)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                    activeType === type.id
                      ? 'bg-white text-teal-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {type.label}
                  {typeDirty && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <i className="ri-loader-4-line animate-spin text-2xl mr-2"></i>
            Loading...
          </div>
        ) : !current ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 mb-4">No template configured for this type yet.</p>
            <button
              type="button"
              onClick={handleInitialize}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer text-sm font-medium"
            >
              <i className="ri-add-line"></i>
              Create {activeLabel}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-800">{titleFieldLabel}</h3>
                {current.updatedAt && (
                  <span className="text-xs text-gray-400">
                    Last saved: {new Date(current.updatedAt).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={current.title}
                onChange={(e) => updateCurrent({ title: e.target.value })}
                placeholder={`e.g. ${current.poTypeLabel}`}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-base font-semibold text-gray-800">{headerFieldLabel}</h3>
              <RichTextEditor
                editorKey={`${activeType}-header`}
                value={current.letterheadHeader}
                onChange={(html) => updateCurrent({ letterheadHeader: html })}
                placeholder="Company name, address, document title..."
                minHeight={80}
              />
            </div>

            <ClauseTable
              title="Terms & Conditions"
              headerColumnLabel="Terms Header"
              descriptionColumnLabel="Terms & Conditions"
              descriptionFieldLabel="Terms & Conditions"
              headerPlaceholder="e.g. Payment Terms"
              descriptionPlaceholder="Enter terms & conditions..."
              rows={termsRows}
              onChange={(terms) => updateCurrent({ terms: terms as unknown as PoLetterheadClause[] })}
            />

            <ClauseTable
              title="Annexure"
              headerColumnLabel="Annexure Header"
              descriptionColumnLabel="Annexure Description"
              descriptionFieldLabel="Annexure Description"
              headerPlaceholder="e.g. Scope of Work"
              descriptionPlaceholder="Enter annexure description..."
              rows={annexureRows}
              onChange={(annexure) => updateCurrent({ annexure: annexure as unknown as PoLetterheadClause[] })}
            />
          </div>
        )}
      </div>

      {!loading && current && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Editing <span className="font-semibold text-gray-900">{current.poTypeLabel}</span>
              {isDirty ? (
                <span className="ml-2 text-amber-600 font-medium">• Unsaved changes</span>
              ) : (
                <span className="ml-2 text-emerald-600 font-medium">• All changes saved</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {saving ? <i className="ri-loader-4-line animate-spin"></i> : <i className="ri-save-line"></i>}
              Save Changes
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </DashboardLayout>
  );
}
