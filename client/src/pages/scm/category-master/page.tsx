import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import MasterImportExport from '../../../components/feature/MasterImportExport';
import { masterApi, CategoryRecord } from '../../../services/api';

const REQUEST_TYPES = ['All', 'Capex', 'Opex', 'Service'] as const;

const emptyForm = {
  name: '',
  requestType: 'All' as string,
  description: '',
  status: 'active',
};

export default function CategoryMasterPage() {
  const [rows, setRows] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterApi.listCategories({ search: search || undefined });
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
    setError('');
    setShowForm(true);
  };

  const openEdit = (row: CategoryRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      requestType: row.requestType || 'All',
      description: row.description || '',
      status: row.status || 'active',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Category name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await masterApi.updateCategory(editing.id, form);
        setToast('Category updated');
      } else {
        await masterApi.createCategory(form);
        setToast('Category created');
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
      <div className="p-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Category Master</h1>
            <p className="text-sm text-gray-500 mt-1">Manage purchase request categories for Capex, Opex, and Service</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MasterImportExport
              onExport={() => masterApi.exportCategoriesCsv()}
              onDownloadTemplate={() => masterApi.downloadCategoryTemplate()}
              onImport={(csv) => masterApi.importCategoriesCsv(csv)}
              onImported={load}
            />
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line"></i> Add Category
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
                placeholder="Search categories..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <i className="ri-price-tag-3-line text-4xl text-gray-300"></i>
              <p className="mt-3 text-sm">No categories found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Name', 'Request Type', 'Description', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                        {row.requestType}
                      </span>
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
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Request Type</label>
                <select
                  value={form.requestType}
                  onChange={(e) => setForm({ ...form, requestType: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
                >
                  {REQUEST_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
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
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer">Cancel</button>
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
