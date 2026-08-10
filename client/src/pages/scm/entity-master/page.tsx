import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import MasterImportExport from '../../../components/feature/MasterImportExport';
import { masterApi, EntityRecord, EntityLocationRecord } from '../../../services/api';

type LocationRow = EntityLocationRecord & { key: string };

const emptyForm = {
  name: '',
  code: '',
  costCenter: '',
  description: '',
  status: 'active',
};

function makeLocationKey() {
  return `loc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLocationRow(): LocationRow {
  return { key: makeLocationKey(), location: '', gstNo: '', footerLogo: '' };
}

function FooterLogoCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'url' | 'upload'>(
    value.startsWith('data:image/') ? 'upload' : 'url'
  );

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const preview =
    value.startsWith('data:image/') || /^https?:\/\//i.test(value.trim()) ? value.trim() : '';

  return (
    <div className="space-y-1.5 min-w-[180px]">
      <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md w-fit">
        <button
          type="button"
          onClick={() => {
            setMode('url');
            if (value.startsWith('data:')) onChange('');
          }}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
            mode === 'url' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
            mode === 'upload' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          Upload
        </button>
      </div>
      {mode === 'url' ? (
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…/footer.png"
          className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-2 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-md cursor-pointer"
          >
            <i className="ri-upload-2-line"></i> Image
          </button>
          {value.startsWith('data:image/') && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                if (fileRef.current) fileRef.current.value = '';
              }}
              className="text-xs text-red-600 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {preview && (
        <img src={preview} alt="Footer" className="max-h-8 max-w-[120px] object-contain border border-gray-100 rounded" />
      )}
    </div>
  );
}

export default function EntityMasterPage() {
  const [rows, setRows] = useState<EntityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EntityRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [selectedLocationKey, setSelectedLocationKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterApi.listEntities({ search: search || undefined });
      setRows(res.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setLocations([]);
    setSelectedLocationKey('');
    setError('');
    setShowForm(true);
  };

  const openEdit = (row: EntityRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      code: row.code || '',
      costCenter: row.costCenter || '',
      description: row.description || '',
      status: row.status || 'active',
    });
    const locs = (row.locations || []).map((l) => ({
      key: makeLocationKey(),
      id: l.id,
      location: l.location || '',
      gstNo: l.gstNo || '',
      footerLogo: l.footerLogo || '',
    }));
    setLocations(locs);
    setSelectedLocationKey(locs[0]?.key || '');
    setError('');
    setShowForm(true);
  };

  const addLocationRow = () => {
    const row = emptyLocationRow();
    setLocations((prev) => [...prev, row]);
    setSelectedLocationKey(row.key);
  };

  const updateLocation = (key: string, patch: Partial<LocationRow>) => {
    setLocations((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeLocation = (key: string) => {
    setLocations((prev) => {
      const next = prev.filter((r) => r.key !== key);
      if (selectedLocationKey === key) {
        setSelectedLocationKey(next[0]?.key || '');
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Entity name is required');
      return;
    }
    if (!form.code.trim()) {
      setError('Entity code is required (used in PR/PO numbers)');
      return;
    }
    if (!form.costCenter.trim()) {
      setError('Cost center is required');
      return;
    }
    const blankLoc = locations.find((l) => !l.location.trim() && (l.gstNo.trim() || l.footerLogo.trim()));
    if (blankLoc) {
      setError('Location name is required for each location row');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        locations: locations
          .filter((l) => l.location.trim())
          .map((l) => ({
            location: l.location.trim(),
            gstNo: l.gstNo.trim(),
            footerLogo: l.footerLogo.trim(),
          })),
      };
      if (editing) {
        await masterApi.updateEntity(editing.id, payload);
        setToast('Entity updated');
      } else {
        await masterApi.createEntity(payload);
        setToast('Entity created');
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

  return (
    <DashboardLayout>
      <>
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Entity Master</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage entity names, cost centers, and locations (GST / footer logo)
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MasterImportExport
              onExport={() => masterApi.exportEntitiesCsv()}
              onDownloadTemplate={() => masterApi.downloadEntityTemplate()}
              onImport={(csv) => masterApi.importEntitiesCsv(csv)}
              onImported={load}
            />
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line"></i> Add Entity
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <div className="relative flex-1 max-w-md">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search entities, cost centers, locations, GST..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <i className="ri-building-2-line text-4xl text-gray-300"></i>
              <p className="mt-3 text-sm">No entities found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Entity Name', 'Code', 'Cost Center', 'Locations', 'Description', 'Status', 'Action'].map(
                      (h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-800">{row.code || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.costCenter || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(row.locations || []).length > 0 ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700">
                              {(row.locations || []).length} location{(row.locations || []).length !== 1 ? 's' : ''}
                            </span>
                            <p className="text-xs text-gray-500 truncate max-w-[200px]" title={(row.locations || []).map((l) => l.location).join(', ')}>
                              {(row.locations || []).map((l) => l.location).join(', ')}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{row.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEdit(row)}
                          className="text-teal-600 text-sm font-semibold hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Entity' : 'Add Entity'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Entity Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Refex Green Mobility Limited"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Entity Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
                      })
                    }
                    placeholder="e.g. RGML"
                    maxLength={10}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Used in PR/PO numbers: PR-CODE-2025-26-0001</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Cost Center *</label>
                  <input
                    value={form.costCenter}
                    onChange={(e) => setForm({ ...form, costCenter: e.target.value })}
                    placeholder="e.g. CC-1001"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Locations: dropdown + Add → table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-end gap-3 justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <i className="ri-map-pin-line text-teal-600"></i>
                      Locations
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Add location rows with GST No and footer logo
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">
                        Location
                      </label>
                      <select
                        value={selectedLocationKey}
                        onChange={(e) => setSelectedLocationKey(e.target.value)}
                        className="min-w-[180px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                      >
                        <option value="">Select location…</option>
                        {locations.map((l, idx) => (
                          <option key={l.key} value={l.key}>
                            {l.location.trim() || `Location ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addLocationRow}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer"
                    >
                      <i className="ri-add-line"></i>
                      Add
                    </button>
                  </div>
                </div>

                {locations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    <i className="ri-map-pin-add-line text-3xl text-gray-300 block mb-2"></i>
                    No locations yet. Click <strong>Add</strong> to create a row.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b border-gray-100">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-10">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase min-w-[160px]">
                            Location
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase min-w-[140px]">
                            GST No
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase min-w-[200px]">
                            Footer Logo
                          </th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-16">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {locations.map((loc, idx) => {
                          const highlight = selectedLocationKey === loc.key;
                          return (
                            <tr
                              key={loc.key}
                              className={highlight ? 'bg-teal-50/60' : 'bg-white'}
                              onClick={() => setSelectedLocationKey(loc.key)}
                            >
                              <td className="px-3 py-3 text-gray-400">{idx + 1}</td>
                              <td className="px-3 py-3">
                                <input
                                  value={loc.location}
                                  onChange={(e) => updateLocation(loc.key, { location: e.target.value })}
                                  placeholder="e.g. Chennai / Vizag"
                                  className="w-full px-2.5 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </td>
                              <td className="px-3 py-3">
                                <input
                                  value={loc.gstNo}
                                  onChange={(e) =>
                                    updateLocation(loc.key, {
                                      gstNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
                                    })
                                  }
                                  placeholder="22AAAAA0000A1Z5"
                                  maxLength={15}
                                  className="w-full px-2.5 py-2 border border-gray-200 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                              </td>
                              <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                                <FooterLogoCell
                                  value={loc.footerLogo}
                                  onChange={(footerLogo) => updateLocation(loc.key, { footerLogo })}
                                />
                              </td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeLocation(loc.key);
                                  }}
                                  className="w-8 h-8 inline-flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                                  title="Remove row"
                                >
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {locations.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                      type="button"
                      onClick={addLocationRow}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      <i className="ri-add-line"></i>
                      Add row
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end flex-shrink-0">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer">
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
