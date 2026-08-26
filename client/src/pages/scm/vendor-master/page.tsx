import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import MasterImportExport from '../../../components/feature/MasterImportExport';
import { vendorApi, VendorRecord, VendorPagination, VendorListStats } from '../../../services/api';
import CreateVendorForm from './components/CreateVendorForm';
import VendorExpandedRow from './components/VendorExpandedRow';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function VendorMasterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<VendorPagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<VendorListStats>({ total: 0, company: 0, individual: 0 });
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1');
  const [editingVendor, setEditingVendor] = useState<VendorRecord | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [vendorDetails, setVendorDetails] = useState<Record<number, VendorRecord>>({});
  const [detailsLoading, setDetailsLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vendorApi.list({
        search: debouncedSearch || undefined,
        page,
        limit: pageSize,
      });
      setVendors(res.data);
      if (res.pagination) {
        setPagination(res.pagination);
        if (res.pagination.page !== page) setPage(res.pagination.page);
      }
      if (res.stats) setStats(res.stats);
    } catch {
      setVendors([]);
      setPagination({ page: 1, limit: pageSize, total: 0, totalPages: 1 });
      setStats({ total: 0, company: 0, individual: 0 });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    if (searchParams.get('create') === '1') setShowCreate(true);
    const editId = searchParams.get('edit');
    if (editId) {
      vendorApi.get(Number(editId)).then((res) => setEditingVendor(res.data)).catch(() => {});
    }
  }, [searchParams]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openCreate = () => {
    setEditingVendor(null);
    setShowCreate(true);
    setSearchParams({ create: '1' });
  };

  const closeCreate = () => {
    setShowCreate(false);
    setSearchParams({});
  };

  const openEdit = async (vendorId: number) => {
    try {
      const res = await vendorApi.get(vendorId);
      setEditingVendor(res.data);
      setExpandedRow(null);
      setSearchParams({ edit: String(vendorId) });
    } catch {
      showToast('Failed to load vendor for editing', 'error');
    }
  };

  const closeEdit = () => {
    setEditingVendor(null);
    setSearchParams({});
  };

  const handleCreated = (created?: VendorRecord) => {
    closeCreate();
    if (created) {
      setVendorDetails({ [created.id]: created });
      setExpandedRow(created.id);
    }
    showToast('Vendor created successfully', 'success');
    if (page === 1) loadVendors();
    else setPage(1);
  };

  const handleUpdated = (updated?: VendorRecord) => {
    closeEdit();
    if (updated) {
      setVendorDetails({ [updated.id]: updated });
      setExpandedRow(updated.id);
    } else {
      setVendorDetails({});
    }
    showToast('Vendor updated successfully', 'success');
    loadVendors();
  };

  const toggleRow = async (vendorId: number) => {
    if (expandedRow === vendorId) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(vendorId);
    setDetailsLoading(vendorId);
    try {
      const res = await vendorApi.get(vendorId);
      setVendorDetails((prev) => ({ ...prev, [vendorId]: res.data }));
    } catch {
      showToast('Failed to load vendor details', 'error');
      setExpandedRow(null);
    } finally {
      setDetailsLoading(null);
    }
  };

  const COL_COUNT = 9;
  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Master</h1>
          <p className="text-sm text-gray-500 mt-1">Manage registered vendors for RFQ and PO workflows</p>
        </div>
        {!showCreate && !editingVendor && (
          <div className="flex items-center gap-3 flex-wrap">
            <MasterImportExport
              onExport={() => vendorApi.exportCsv()}
              onDownloadTemplate={() => vendorApi.downloadImportTemplate()}
              onImport={(csv) => vendorApi.importCsv(csv)}
              onImported={() => {
                if (page === 1) loadVendors();
                else setPage(1);
              }}
            />
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors cursor-pointer shadow-sm"
            >
              <i className="ri-user-add-line"></i>
              Create Vendor
            </button>
          </div>
        )}
      </div>

      {showCreate ? (
        <CreateVendorForm onSuccess={handleCreated} onCancel={closeCreate} />
      ) : editingVendor ? (
        <CreateVendorForm vendor={editingVendor} onSuccess={handleUpdated} onCancel={closeEdit} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 mb-6">
            {[
              { label: 'Total Vendors', value: stats.total, icon: 'ri-store-2-line', color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Companies', value: stats.company, icon: 'ri-building-line', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Individuals', value: stats.individual, icon: 'ri-user-line', color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <i className={`${card.icon} text-2xl ${card.color}`}></i>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Vendor List</h2>
                <p className="text-xs text-gray-400 mt-1">Click any row to expand vendor details and documents</p>
              </div>
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search vendor, email, code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-full sm:w-72"
                />
              </div>
            </div>

            {loading ? (
              <p className="px-6 py-12 text-sm text-gray-500 text-center">Loading vendors...</p>
            ) : vendors.length === 0 ? (
              <div className="py-16 text-center">
                <i className="ri-store-2-line text-5xl text-gray-200 mb-4 block"></i>
                <p className="text-gray-500 text-sm font-medium">No vendors found</p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 cursor-pointer"
                >
                  Create your first vendor
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['', 'Vendor Code', 'Vendor Name', 'Type', 'Email', 'Phone', 'Category', 'Created', 'Actions'].map((h) => (
                        <th key={h || 'expand'} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => {
                      const isExpanded = expandedRow === v.id;
                      const detail = vendorDetails[v.id] || v;

                      return (
                        <Fragment key={v.id}>
                          <tr
                            onClick={() => toggleRow(v.id)}
                            className={`border-b transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-teal-50 border-teal-200'
                                : 'hover:bg-teal-50/40 border-gray-100'
                            }`}
                          >
                            <td className="px-4 py-4 w-8">
                              <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                                <i className={`text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-sm font-bold text-teal-600">{v.vendorCode}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <i className="ri-store-2-line text-gray-500 text-sm"></i>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{v.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">{v.vendorType}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{v.email}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{v.phone || '—'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{v.category || '—'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{v.createdAt}</td>
                            <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => toggleRow(v.id)}
                                  className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                                  title={isExpanded ? 'Collapse' : 'Expand Details'}
                                >
                                  <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEdit(v.id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Vendor"
                                >
                                  <i className="ri-edit-line text-sm"></i>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <VendorExpandedRow
                              vendor={detail}
                              loading={detailsLoading === v.id}
                              colSpan={COL_COUNT}
                              onEdit={() => openEdit(v.id)}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">
                    Showing <span className="font-semibold text-gray-700">{rangeFrom}</span>
                    {'–'}
                    <span className="font-semibold text-gray-700">{rangeTo}</span>
                    {' of '}
                    <span className="font-semibold text-gray-700">{pagination.total}</span> vendors
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      Rows
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setPage(1);
                          setExpandedRow(null);
                        }}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={pagination.page <= 1 || loading}
                        onClick={() => {
                          setPage((p) => Math.max(1, p - 1));
                          setExpandedRow(null);
                        }}
                        className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1.5 text-sm text-gray-600 whitespace-nowrap">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={pagination.page >= pagination.totalPages || loading}
                        onClick={() => {
                          setPage((p) => p + 1);
                          setExpandedRow(null);
                        }}
                        className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}>
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-close-circle-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
