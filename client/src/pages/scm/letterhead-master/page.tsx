import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { letterheadMasterApi, LetterheadMasterRecord } from '../../../services/api';

type MediaMode = 'url' | 'upload' | 'html';

function detectMediaMode(value: string): MediaMode {
  const v = (value || '').trim();
  if (!v) return 'url';
  if (v.startsWith('data:image/')) return 'upload';
  if (/<[a-z][\s\S]*>/i.test(v)) return 'html';
  return 'url';
}

function MediaField({
  label,
  value,
  onChange,
  fieldKey,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  fieldKey: string;
}) {
  const [mode, setMode] = useState<MediaMode>(() => detectMediaMode(value));
  const [modeLocked, setModeLocked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setMode(detectMediaMode(value));
    setModeLocked(false);
    setUploadError('');
  }, [fieldKey]);

  useEffect(() => {
    if (modeLocked) return;
    if (!value.trim()) return;
    setMode(detectMediaMode(value));
  }, [value, modeLocked]);

  const switchMode = (next: MediaMode) => {
    setMode(next);
    setModeLocked(true);
    setUploadError('');
    if (next !== detectMediaMode(value)) onChange('');
  };

  const handleFile = (file: File | null) => {
    setUploadError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload an image file (PNG, JPG, SVG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.onerror = () => setUploadError('Could not read the selected file.');
    reader.readAsDataURL(file);
  };

  const previewSrc =
    mode !== 'html' && (value.startsWith('data:image/') || /^https?:\/\//i.test(value.trim()))
      ? value.trim()
      : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-gray-600">{label}</label>
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          {(
            [
              { id: 'url', label: 'URL' },
              { id: 'upload', label: 'Upload' },
              { id: 'html', label: 'HTML' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchMode(tab.id)}
              className={`px-2 py-0.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                mode === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'url' && (
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      )}

      {mode === 'upload' && (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
            >
              <i className="ri-upload-2-line"></i>
              Choose image
            </button>
            {value.startsWith('data:image/') && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
        </div>
      )}

      {mode === 'html' && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          placeholder={'<div class="logo">Your HTML…</div>'}
          className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      )}

      {previewSrc && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 inline-flex">
          <img src={previewSrc} alt={`${label} preview`} className="max-h-12 max-w-[160px] object-contain" />
        </div>
      )}

      {mode === 'html' && value.trim() && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
          <div dangerouslySetInnerHTML={{ __html: value }} />
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  name: '',
  entity: '',
  headerLogo: '',
  footerLogo: '',
  status: 'active' as 'active' | 'inactive',
};

function logoPreview(value: string) {
  if (!value?.trim()) return null;
  if (value.startsWith('data:image/') || /^https?:\/\//i.test(value.trim())) {
    return <img src={value.trim()} alt="" className="h-8 max-w-[80px] object-contain" />;
  }
  if (/<[a-z]/i.test(value)) {
    return <span className="text-xs text-gray-500">HTML</span>;
  }
  return <span className="text-xs text-gray-400 truncate max-w-[100px] block">{value}</span>;
}

export default function LetterheadMasterPage() {
  const [rows, setRows] = useState<LetterheadMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LetterheadMasterRecord | null>(null);
  const [viewing, setViewing] = useState<LetterheadMasterRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await letterheadMasterApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (row: LetterheadMasterRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      entity: row.entity || '',
      headerLogo: row.headerLogo || '',
      footerLogo: row.footerLogo || '',
      status: row.status || 'active',
    });
    setError('');
    setShowForm(true);
  };

  const openView = (row: LetterheadMasterRecord) => {
    setViewing(row);
  };

  const openEditFromView = () => {
    if (!viewing) return;
    const row = viewing;
    setViewing(null);
    openEdit(row);
  };

  const renderLogoDetail = (label: string, value: string) => {
    const trimmed = (value || '').trim();
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {!trimmed ? (
          <p className="text-sm text-gray-400">Not set</p>
        ) : trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed) ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 inline-flex">
            <img src={trimmed} alt={label} className="max-h-20 max-w-[220px] object-contain" />
          </div>
        ) : /<[a-z]/i.test(trimmed) ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
            <div dangerouslySetInnerHTML={{ __html: trimmed }} />
          </div>
        ) : (
          <p className="text-sm text-gray-700 break-all">{trimmed}</p>
        )}
      </div>
    );
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Letterhead name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await letterheadMasterApi.update(editing.id, form);
        setToast('Letterhead updated');
      } else {
        await letterheadMasterApi.create(form);
        setToast('Letterhead created');
      }
      setShowForm(false);
      load();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row: LetterheadMasterRecord) => {
    const next = row.status === 'active' ? 'inactive' : 'active';
    try {
      await letterheadMasterApi.update(row.id, {
        name: row.name,
        entity: row.entity,
        headerLogo: row.headerLogo,
        footerLogo: row.footerLogo,
        status: next,
      });
      setToast(`Letterhead marked ${next}`);
      load();
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Update failed');
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <DashboardLayout>
      <>
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Letterhead Master</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage company letterheads — entity, header logo, and footer logo
            </p>
          </div>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer flex items-center gap-2"
          >
            <i className="ri-add-line"></i> Add Letterhead
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search letterheads..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <i className="ri-layout-top-2-line text-4xl text-gray-300"></i>
              <p className="mt-3 text-sm">No letterheads found</p>
              <button
                onClick={openCreate}
                className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer"
              >
                Add Letterhead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Name', 'Entity', 'Header Logo', 'Footer Logo', 'Status', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        <button
                          type="button"
                          onClick={() => openView(row)}
                          className="hover:text-teal-700 hover:underline cursor-pointer text-left"
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.entity || '—'}</td>
                      <td className="px-4 py-3">{logoPreview(row.headerLogo) || <span className="text-xs text-gray-400">—</span>}</td>
                      <td className="px-4 py-3">{logoPreview(row.footerLogo) || <span className="text-xs text-gray-400">—</span>}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openView(row)}
                            className="text-slate-700 text-sm font-semibold hover:underline cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openEdit(row)}
                            className="text-teal-600 text-sm font-semibold hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStatus(row)}
                            className="text-sm font-semibold hover:underline cursor-pointer text-gray-600"
                          >
                            {row.status === 'active' ? 'Inactive' : 'Active'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">View Letterhead</h2>
              <button
                onClick={() => setViewing(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</p>
                  <p className="text-sm font-semibold text-gray-900">{viewing.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      viewing.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {viewing.status}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Entity</p>
                <p className="text-sm text-gray-800">{viewing.entity || '—'}</p>
              </div>
              {renderLogoDetail('Header Logo', viewing.headerLogo)}
              {renderLogoDetail('Footer Logo', viewing.footerLogo)}
              {viewing.updatedAt && (
                <p className="text-xs text-gray-400">
                  Last updated: {new Date(viewing.updatedAt).toLocaleString('en-IN')}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setViewing(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={openEditFromView}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Letterhead' : 'Add Letterhead'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Letterhead Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Refex Default Letterhead"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Entity</label>
                <input
                  value={form.entity}
                  onChange={(e) => setForm({ ...form, entity: e.target.value })}
                  placeholder="e.g. Refex Green Mobility Limited"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <MediaField
                label="Header Logo"
                fieldKey={`hdr-${editing?.id || 'new'}`}
                value={form.headerLogo}
                onChange={(headerLogo) => setForm({ ...form, headerLogo })}
              />
              <MediaField
                label="Footer Logo"
                fieldKey={`ftr-${editing?.id || 'new'}`}
                value={form.footerLogo}
                onChange={(footerLogo) => setForm({ ...form, footerLogo })}
              />
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as 'active' | 'inactive' })
                  }
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 bg-white">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
