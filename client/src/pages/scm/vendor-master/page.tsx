import { useState, useEffect, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import SoftInsightCard from '../../../components/base/SoftInsightCard';
import { PM_PAGE_BG } from '../../../constants/pmTheme';
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

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
    if (updated?.id) {
      // Prefer freshly loaded documents so View shows the latest uploads
      void vendorApi
        .get(updated.id)
        .then((res) => {
          setVendorDetails({ [updated.id]: res.data });
          setExpandedRow(updated.id);
        })
        .catch(() => {
          setVendorDetails({ [updated.id]: updated });
          setExpandedRow(updated.id);
        });
    } else {
      setVendorDetails({});
    }
    showToast('Vendor updated successfully', 'success');
    loadVendors();
  };

  const handleDelete = async (vendor: VendorRecord) => {
    const label = vendor.vendorCode || vendor.name || `#${vendor.id}`;
    if (
      !window.confirm(
        `Delete vendor ${label}?\n\nThis removes the vendor and uploaded KYC documents. Existing POs keep the vendor name/email already saved.`
      )
    ) {
      return;
    }
    setDeletingId(vendor.id);
    try {
      const res = await vendorApi.delete(vendor.id);
      if (expandedRow === vendor.id) setExpandedRow(null);
      setVendorDetails((prev) => {
        const next = { ...prev };
        delete next[vendor.id];
        return next;
      });
      showToast(res.message || 'Vendor deleted', 'success');
      await loadVendors();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete vendor', 'error');
    } finally {
      setDeletingId(null);
    }
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

  const COL_COUNT = 8;
  const rangeFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeTo = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <DashboardLayout>
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
      <div className="space-y-4 p-2 pb-6 sm:p-4 lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-0 sm:pb-4">
        <div>
          <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">Vendor Master</h1>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">Manage registered vendors for RFQ and PO workflows</p>
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
              className="flex items-center gap-2 px-5 py-2.5 bg-[#1E88E5] text-white text-sm font-semibold rounded-lg hover:bg-[#1565C0] transition-colors cursor-pointer shadow-sm"
            >
              <i className="ri-user-add-line"></i>
              Create Vendor
            </button>
          </div>
        )}
      </header>

      {showCreate ? (
        <CreateVendorForm onSuccess={handleCreated} onCancel={closeCreate} />
      ) : editingVendor ? (
        <CreateVendorForm vendor={editingVendor} onSuccess={handleUpdated} onCancel={closeEdit} />
      ) : (
        <>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3 sm:gap-4">
            <SoftInsightCard title="Total Vendors" value={stats.total} icon="ri-store-2-line" theme="blue" />
            <SoftInsightCard title="Companies" value={stats.company} icon="ri-building-line" theme="cyan" />
            <SoftInsightCard title="Individuals" value={stats.individual} icon="ri-user-line" theme="violet" />
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)' }} />
            <div className="relative z-[1]">
              <div className="relative min-w-[220px] max-w-md">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search vendor, email, code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="box-border h-11 w-full rounded-2xl border border-transparent bg-white pl-10 pr-4 text-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-x-clip rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)' }} />
            <div className="relative z-[1]">

            {loading ? (
              <p className="px-6 py-12 text-sm text-gray-500 text-center">Loading vendors...</p>
            ) : vendors.length === 0 ? (
              <div className="py-16 text-center">
                <i className="ri-store-2-line text-5xl text-gray-200 mb-4 block"></i>
                <p className="text-gray-500 text-sm font-medium">No vendors found</p>
                <button
                  onClick={openCreate}
                  className="mt-4 px-4 py-2 text-sm font-medium text-[#1E88E5] bg-[#E3F2FD] rounded-lg hover:bg-[#BBDEFB] cursor-pointer"
                >
                  Create your first vendor
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto px-0 pb-1 pt-1">
                <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor Code</th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor Name</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Type</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Email</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Phone</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Category</th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Created</th>
                      <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => {
                      const isExpanded = expandedRow === v.id;
                      const detail = vendorDetails[v.id] || v;
                      const rowBorder = isExpanded ? 'border-[#90CAF9]' : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = isExpanded ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]' : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';

                      return (
                        <Fragment key={v.id}>
                          <tr className="group cursor-pointer" onClick={() => toggleRow(v.id)}>
                            <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                              <div className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button type="button" className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl ${isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'}`} aria-expanded={isExpanded}>
                                  <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                                <span className="text-sm font-bold text-[#1E88E5]">{v.vendorCode}</span>
                              </div>
                            </td>
                            <td className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`} title={v.name}>
                              <p className="truncate text-sm font-semibold text-[#2C3E50]">{v.name}</p>
                            </td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 sm:py-5 ${rowBorder}`}>{v.vendorType}</td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 sm:py-5 ${rowBorder}`}>{v.email}</td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 sm:py-5 ${rowBorder}`}>{v.phone || '—'}</td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 sm:py-5 ${rowBorder}`}>{v.category || '—'}</td>
                            <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-500 sm:py-5 ${rowBorder}`}>{v.createdAt}</td>
                            <td className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]" onClick={(e) => e.stopPropagation()}>
                              <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button type="button" onClick={() => openEdit(v.id)} className="cursor-pointer whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white" title="Edit Vendor">
                                  Edit
                                </button>
                                <button type="button" onClick={() => void handleDelete(v)} disabled={deletingId === v.id} className="cursor-pointer whitespace-nowrap rounded-xl bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] disabled:opacity-50" title="Delete Vendor">
                                  {deletingId === v.id ? 'Deleting…' : 'Delete'}
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
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/20 focus:border-[#1E88E5]"
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
          </div>
        </>
      )}
      </div>
      </div>

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
