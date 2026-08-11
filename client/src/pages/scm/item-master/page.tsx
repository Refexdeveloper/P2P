import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import MasterImportExport from '../../../components/feature/MasterImportExport';
import { masterApi, CategoryRecord, ItemRecord } from '../../../services/api';

const PAGE_SIZE = 10;

const emptyForm = {
  name: '',
  description: '',
  categoryId: '' as string | number,
  unit: 'Nos',
  hsnCode: '',
  gstPercentage: 18,
  status: 'active',
};

export default function ItemMasterPage() {
  const [rows, setRows] = useState<ItemRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ItemRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        masterApi.listItems({
          search: debouncedSearch || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        masterApi.listCategories({ status: 'active' }),
      ]);
      setRows(itemsRes.data);
      if (itemsRes.meta) setMeta(itemsRes.meta);
      setCategories(catsRes.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (row: ItemRecord) => {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description || '',
      categoryId: row.categoryId ?? '',
      unit: row.unit || 'Nos',
      hsnCode: row.hsnCode || '',
      gstPercentage: Number(row.gstPercentage ?? 18),
      status: row.status || 'active',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Item name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        description: form.description,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        unit: form.unit,
        hsnCode: form.hsnCode,
        gstPercentage: form.gstPercentage,
        status: form.status,
      };
      if (editing) {
        await masterApi.updateItem(editing.id, payload);
        setToast('Item updated');
      } else {
        await masterApi.createItem(payload);
        setToast('Item created');
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
            <h1 className="text-2xl font-bold text-gray-900">Item Master</h1>
            <p className="text-sm text-gray-500 mt-1">
              Maintain item name, description, HSN code, and GST for Create PR dropdowns
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MasterImportExport
              onExport={() => masterApi.exportItemsCsv()}
              onDownloadTemplate={() => masterApi.downloadItemTemplate()}
              onImport={(csv) => masterApi.importItemsCsv(csv)}
              onImported={load}
            />
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line"></i> Add Item
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
                placeholder="Search by code, name, or HSN..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-gray-500">Loading...</p>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <i className="ri-box-3-line text-4xl text-gray-300"></i>
              <p className="mt-3 text-sm">No items found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['Code', 'Item Name', 'Description', 'HSN', 'GST %', 'Category', 'Status', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-teal-600">{row.itemCode}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{row.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.hsnCode || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{Number(row.gstPercentage ?? 18)}%</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.categoryName || '—'}</td>
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

          {meta.total > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * meta.pageSize + 1}–{Math.min(page * meta.pageSize, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2 text-xs text-gray-600">
                  Page {page} of {meta.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= meta.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Item' : 'Add Item'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</p>}
              {editing && (
                <div className="text-xs text-gray-500">
                  Code: <span className="font-semibold text-teal-600">{editing.itemCode}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter item name"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Item Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Enter item description"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">HSN Code</label>
                  <input
                    value={form.hsnCode}
                    onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
                    placeholder="e.g. 8471"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">GST %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={form.gstPercentage}
                    onChange={(e) => setForm({ ...form, gstPercentage: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white cursor-pointer"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Unit</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 bg-white">
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
