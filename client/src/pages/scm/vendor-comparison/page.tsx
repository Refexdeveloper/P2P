import { useState, useMemo } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { vendorComparisonData } from '../../../mocks/vendor-comparison-data';
import type { QuotationFile } from '../../../mocks/vendor-comparison-data';
import { scmPurchaseRequests } from '../../../mocks/scm-purchase-requests';
import PRExpandedRow from './components/PRExpandedRow';
import SelectWinnerModal from './components/SelectWinnerModal';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    'Ready for PO': 'bg-teal-100 text-teal-700 border border-teal-200',
    'Pending Approval': 'bg-amber-100 text-amber-700 border border-amber-200',
    'PO Approved': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'PO Rejected': 'bg-red-100 text-red-700 border border-red-200',
  };
  const icon: Record<string, string> = {
    'Ready for PO': 'ri-checkbox-circle-line',
    'Pending Approval': 'ri-time-line',
    'PO Approved': 'ri-check-double-line',
    'PO Rejected': 'ri-close-circle-line',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      <i className={icon[status] || 'ri-question-line'}></i>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const map: Record<string, string> = {
    High: 'bg-red-50 text-red-600 border border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border border-amber-200',
    Low: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize whitespace-nowrap ${map[priority] || 'bg-gray-100 text-gray-500'}`}>
      <i className="ri-flag-line text-xs"></i>
      {priority}
    </span>
  );
};

type ViewMode = 'pr-list' | 'comparison';

export default function VendorComparisonPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('pr-list');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [winnerModal, setWinnerModal] = useState<{
    isOpen: boolean;
    prId: string;
    prTitle: string;
    recommendedVendor: string;
    overallScore: number;
    amount: number;
  }>({ isOpen: false, prId: '', prTitle: '', recommendedVendor: '', overallScore: 0, amount: 0 });
  const [completedPRs, setCompletedPRs] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // ── Comparison tab state ──
  const [selectedVendor, setSelectedVendor] = useState<string | null>(vendorComparisonData.recommendedVendorId);
  const [previewFile, setPreviewFile] = useState<{ file: QuotationFile; vendorName: string } | null>(null);
  const [showCompSuccessModal, setShowCompSuccessModal] = useState(false);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openWinnerModal = (pr: typeof scmPurchaseRequests[0]) => {
    setWinnerModal({
      isOpen: true,
      prId: pr.id,
      prTitle: pr.title,
      recommendedVendor: pr.recommendedVendor,
      overallScore: pr.overallScore,
      amount: pr.amount,
    });
  };

  const handleWinnerConfirm = (remarks: string) => {
    setCompletedPRs(prev => new Set([...prev, winnerModal.prId]));
    showToast(`Winner selected: ${winnerModal.recommendedVendor} for ${winnerModal.prId}`, 'success');
    setWinnerModal(prev => ({ ...prev, isOpen: false }));
    setExpandedRow(null);
  };

  const filteredPRs = useMemo(() => {
    let result = [...scmPurchaseRequests];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(pr =>
        pr.id.toLowerCase().includes(q) ||
        pr.title.toLowerCase().includes(q) ||
        pr.department.toLowerCase().includes(q) ||
        pr.requester.toLowerCase().includes(q) ||
        pr.recommendedVendor.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(pr => pr.status === statusFilter);
    }
    return result;
  }, [searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    readyForPO: scmPurchaseRequests.filter(p => p.status === 'Ready for PO').length,
    pending: scmPurchaseRequests.filter(p => p.status === 'Pending Approval').length,
    approved: scmPurchaseRequests.filter(p => p.status === 'PO Approved').length,
    rejected: scmPurchaseRequests.filter(p => p.status === 'PO Rejected').length,
    totalValue: scmPurchaseRequests.reduce((s, p) => s + p.amount, 0),
  }), []);

  // ── Comparison helpers ──
  const getFileIcon = (fileType: QuotationFile['fileType']) => {
    switch (fileType) {
      case 'pdf': return { icon: 'ri-file-pdf-2-line', color: 'text-red-500', bg: 'bg-red-50' };
      case 'xlsx': return { icon: 'ri-file-excel-2-line', color: 'text-green-600', bg: 'bg-green-50' };
      case 'docx': return { icon: 'ri-file-word-2-line', color: 'text-sky-600', bg: 'bg-sky-50' };
      case 'jpg': return { icon: 'ri-image-line', color: 'text-orange-500', bg: 'bg-orange-50' };
      default: return { icon: 'ri-file-line', color: 'text-gray-500', bg: 'bg-gray-50' };
    }
  };

  const getBestValueForRow = (paramKey: string): string | null => {
    const values = vendorComparisonData.vendors.map((v) => {
      const param = v.parameters.find((p) => p.key === paramKey);
      return param?.numericValue || 0;
    });
    if (paramKey === 'quotedPrice' || paramKey === 'leadTime') {
      const minValue = Math.min(...values);
      const vendor = vendorComparisonData.vendors.find((v) => {
        const param = v.parameters.find((p) => p.key === paramKey);
        return param?.numericValue === minValue;
      });
      return vendor?.id || null;
    } else if (['technicalScore', 'commercialScore', 'overallScore'].includes(paramKey)) {
      const maxValue = Math.max(...values);
      const vendor = vendorComparisonData.vendors.find((v) => {
        const param = v.parameters.find((p) => p.key === paramKey);
        return param?.numericValue === maxValue;
      });
      return vendor?.id || null;
    }
    return null;
  };

  const selectedVendorData = vendorComparisonData.vendors.find(v => v.id === selectedVendor);

  return (
    <DashboardLayout>
      <div className="max-w-full">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vendor Comparison</h1>
              <p className="text-sm text-gray-500 mt-1">Review PR vendor comparisons and select winning vendors to proceed to PO creation</p>
            </div>
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('pr-list')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'pr-list' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <i className="ri-list-check-2"></i> PR List
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${viewMode === 'comparison' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <i className="ri-bar-chart-grouped-line"></i> Comparison View
              </button>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            PR LIST VIEW
        ════════════════════════════════════════ */}
        {viewMode === 'pr-list' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: 'Ready for PO', value: stats.readyForPO, icon: 'ri-checkbox-circle-line', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-100' },
                { label: 'Pending Approval', value: stats.pending, icon: 'ri-time-line', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
                { label: 'PO Approved', value: stats.approved, icon: 'ri-check-double-line', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
                { label: 'PO Rejected', value: stats.rejected, icon: 'ri-close-circle-line', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
                { label: 'Total PRs', value: scmPurchaseRequests.length, icon: 'ri-file-list-3-line', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-100' },
              ].map((card) => (
                <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-4 flex items-center justify-between`}>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                    <i className={`${card.icon} text-xl ${card.text}`}></i>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Value Banner */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <i className="ri-money-rupee-circle-line text-white text-2xl"></i>
                </div>
                <div>
                  <p className="text-teal-100 text-sm">Total Procurement Value Under Comparison</p>
                  <p className="text-white text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-teal-100 text-xs">{stats.readyForPO} PR{stats.readyForPO !== 1 ? 's' : ''} ready for PO creation</p>
                <p className="text-white text-sm font-medium mt-0.5">Click any row to expand full details</p>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              {/* Filters */}
              <div className="px-6 py-5 border-b border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-gray-900">Purchase Requests — Vendor Comparison</h2>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input
                        type="text"
                        placeholder="Search PR, vendor, department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 w-64"
                      />
                    </div>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'Ready for PO', label: 'Ready for PO' },
                        { key: 'Pending Approval', label: 'Pending' },
                        { key: 'PO Approved', label: 'Approved' },
                        { key: 'PO Rejected', label: 'Rejected' },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setStatusFilter(tab.key)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${statusFilter === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Showing <strong className="text-gray-700">{filteredPRs.length}</strong> purchase request{filteredPRs.length !== 1 ? 's' : ''} · Click any row to expand details
                </p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['', 'PR Number', 'Title / Department', 'Requester', 'Vendors', 'Recommended Vendor', 'Score', 'Value', 'Priority', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPRs.map((pr) => {
                      const isExpanded = expandedRow === pr.id;
                      const isReady = pr.status === 'Ready for PO';
                      const isDone = completedPRs.has(pr.id);

                      return (
                        <>
                          <tr
                            key={pr.id}
                            onClick={() => setExpandedRow(prev => prev === pr.id ? null : pr.id)}
                            className={`border-b transition-colors cursor-pointer ${
                              isExpanded
                                ? 'bg-teal-50 border-teal-200'
                                : isReady
                                ? 'hover:bg-teal-50/30 border-gray-100'
                                : 'hover:bg-gray-50 border-gray-100'
                            }`}
                          >
                            {/* Expand */}
                            <td className="px-4 py-4 w-8">
                              <div className={`w-6 h-6 flex items-center justify-center rounded transition-all ${isExpanded ? 'bg-teal-100 text-teal-600' : 'text-gray-400'}`}>
                                <i className={`text-sm transition-transform duration-200 ${isExpanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`}></i>
                              </div>
                            </td>

                            {/* PR Number */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <p className="text-sm font-bold text-gray-900">{pr.id}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{pr.requestedDate}</p>
                            </td>

                            {/* Title / Dept */}
                            <td className="px-4 py-4">
                              <p className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{pr.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <i className="ri-building-line text-xs"></i>{pr.department}
                              </p>
                            </td>

                            {/* Requester */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-teal-700 text-xs font-bold">
                                    {pr.requester.split(' ').map(n => n[0]).join('')}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900">{pr.requester}</p>
                              </div>
                            </td>

                            {/* Vendors count */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                  <i className="ri-store-2-line text-gray-500 text-xs"></i>
                                </div>
                                <span className="text-sm font-semibold text-gray-800">{pr.vendorComparison.length}</span>
                                <span className="text-xs text-gray-400">vendors</span>
                              </div>
                            </td>

                            {/* Recommended Vendor */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-1.5">
                                <i className="ri-trophy-line text-emerald-500 text-sm flex-shrink-0"></i>
                                <p className="text-sm font-medium text-gray-900 max-w-[160px] truncate">{pr.recommendedVendor}</p>
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${pr.overallScore}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs font-semibold text-emerald-700">{pr.overallScore}</span>
                              </div>
                            </td>

                            {/* Value */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(pr.amount)}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{pr.requestType}</p>
                            </td>

                            {/* Priority */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              <PriorityBadge priority={pr.priority} />
                            </td>

                            {/* Status */}
                            <td className="px-4 py-4 whitespace-nowrap">
                              {isDone
                                ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-100 text-emerald-700 border border-emerald-200"><i className="ri-check-double-line"></i>Winner Selected</span>
                                : <StatusBadge status={pr.status} />
                              }
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setExpandedRow(prev => prev === pr.id ? null : pr.id)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                  title="Expand Details"
                                >
                                  <i className={`text-sm ${isExpanded ? 'ri-eye-off-line' : 'ri-eye-line'}`}></i>
                                </button>
                                {isReady && !isDone && (
                                  <button
                                    onClick={() => openWinnerModal(pr)}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                    title="Select Winner"
                                  >
                                    <i className="ri-trophy-line text-sm"></i>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Row */}
                          {isExpanded && (
                            <PRExpandedRow
                              pr={pr}
                              colSpan={11}
                              onSelectWinner={openWinnerModal}
                            />
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredPRs.length === 0 && (
                <div className="py-16 text-center">
                  <i className="ri-store-2-line text-5xl text-gray-200 mb-4 block"></i>
                  <p className="text-gray-500 text-sm font-medium">No purchase requests found</p>
                  {(searchTerm || statusFilter !== 'all') && (
                    <button
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                      className="mt-3 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            COMPARISON VIEW (original RFQ detail)
        ════════════════════════════════════════ */}
        {viewMode === 'comparison' && (
          <>
            {/* Sub-header */}
            <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  RFQ: <span className="text-teal-600">{vendorComparisonData.rfqReference}</span>
                  <span className="mx-2 text-gray-300">|</span>
                  PR: <span className="text-teal-600">{vendorComparisonData.prReference}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{vendorComparisonData.department} · {vendorComparisonData.requestType} · Budget: {vendorComparisonData.estimatedBudget}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCompSuccessModal(true)}
                  disabled={!selectedVendor}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap text-sm font-semibold"
                >
                  <i className="ri-trophy-line"></i>
                  Select Winner
                </button>
              </div>
            </div>

            {/* PR Details Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                  <i className="ri-file-list-3-line text-teal-600"></i>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Purchase Request Details</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Department</p>
                  <p className="text-sm font-medium text-gray-900">{vendorComparisonData.department}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Request Type</p>
                  <p className="text-sm font-medium text-gray-900">{vendorComparisonData.requestType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estimated Budget</p>
                  <p className="text-sm font-medium text-gray-900">{vendorComparisonData.estimatedBudget}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Total Vendors</p>
                  <p className="text-sm font-medium text-gray-900">{vendorComparisonData.vendors.length} vendors</p>
                </div>
              </div>
            </div>

            {/* Price Negotiation Trend — Round 1 / Round 2 price + file */}
            {(() => {
              const vendorsWithRounds = vendorComparisonData.vendors.filter(
                (v) => v.quoteRounds && v.quoteRounds.length > 0
              );
              const maxRounds = Math.max(
                ...vendorsWithRounds.map((v) => v.quoteRounds?.length || 0),
                1
              );
              if (!vendorsWithRounds.length) return null;
              return (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                    <i className="ri-line-chart-line text-teal-600"></i>
                    <p className="text-sm font-semibold text-gray-900">Price Negotiation Trend</p>
                    <span className="text-xs text-gray-400 ml-1">— how prices changed across rounds</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">
                            Vendor
                          </th>
                          {Array.from({ length: maxRounds }, (_, i) => (
                            <th
                              key={i}
                              className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[160px]"
                            >
                              Quotation Round {i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {vendorsWithRounds.map((vendor) => {
                          const rounds = vendor.quoteRounds || [];
                          const last = rounds[rounds.length - 1];
                          return (
                            <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-4 align-top">
                                <p className="text-sm font-semibold text-gray-900">{vendor.name}</p>
                                {vendor.id === vendorComparisonData.recommendedVendorId && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                                    <i className="ri-star-fill text-xs"></i> Recommended
                                  </span>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {rounds.length} round{rounds.length !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  Last quotation: {last?.quotedPrice ? formatCurrency(last.quotedPrice) : '—'}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]" title={last?.quotationFile}>
                                  Last file: {last?.quotationFile || '—'}
                                </p>
                              </td>
                              {Array.from({ length: maxRounds }, (_, i) => {
                                const round = rounds[i];
                                if (!round) {
                                  return (
                                    <td key={i} className="px-4 py-4 text-center text-gray-300 text-sm align-top">
                                      —
                                    </td>
                                  );
                                }
                                const prev = rounds[i - 1];
                                const change = prev ? round.quotedPrice - prev.quotedPrice : 0;
                                const changePct = prev?.quotedPrice
                                  ? ((change / prev.quotedPrice) * 100).toFixed(1)
                                  : null;
                                const isLast = i === rounds.length - 1;
                                const fileMeta = vendor.quotationFiles?.find((f) => f.fileName === round.quotationFile);
                                return (
                                  <td key={i} className={`px-4 py-4 text-center align-top ${isLast ? 'bg-teal-50/60' : ''}`}>
                                    <div className="inline-flex flex-col items-center gap-1.5 min-w-[120px]">
                                      <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Price</p>
                                        <p className={`text-sm font-bold ${isLast ? 'text-teal-700' : 'text-gray-900'}`}>
                                          {formatCurrency(round.quotedPrice)}
                                        </p>
                                        {changePct !== null && (
                                          <p className={`text-xs font-semibold mt-0.5 ${change < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {change < 0 ? '▼' : '▲'} {Math.abs(Number(changePct))}%
                                          </p>
                                        )}
                                      </div>
                                      <div className="w-full pt-1.5 border-t border-gray-100">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">File</p>
                                        {round.quotationFile ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (fileMeta) {
                                                setPreviewFile({ file: fileMeta, vendorName: vendor.name });
                                              } else {
                                                setPreviewFile({
                                                  file: {
                                                    id: `${vendor.id}-r${round.round}`,
                                                    fileName: round.quotationFile!,
                                                    fileType: 'pdf',
                                                    fileSize: '—',
                                                    uploadedBy: 'Vendor Portal',
                                                    uploadedAt: round.submittedDate,
                                                  },
                                                  vendorName: vendor.name,
                                                });
                                              }
                                            }}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 max-w-[150px] cursor-pointer"
                                            title={round.quotationFile}
                                          >
                                            <i className="ri-file-pdf-2-line text-red-500 text-sm flex-shrink-0"></i>
                                            <span className="text-xs font-medium text-teal-700 truncate">
                                              {round.quotationFile}
                                            </span>
                                            <i className="ri-eye-line text-teal-600 text-xs flex-shrink-0"></i>
                                          </button>
                                        ) : (
                                          <span className="text-xs text-gray-300">—</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Comparison Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="sticky left-0 bg-gray-50 px-6 py-4 text-left text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[200px]">
                        Parameters
                      </th>
                      {vendorComparisonData.vendors.map((vendor) => (
                        <th key={vendor.id} className="px-6 py-4 text-center text-sm font-semibold text-gray-900 border-r border-gray-200 min-w-[180px]">
                          <div className="flex flex-col items-center gap-2">
                            {vendor.id === vendorComparisonData.recommendedVendorId && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                <i className="ri-star-fill mr-1"></i>Recommended
                              </span>
                            )}
                            <span>{vendor.name}</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="selectedVendor"
                                checked={selectedVendor === vendor.id}
                                onChange={() => setSelectedVendor(vendor.id)}
                                className="w-4 h-4 cursor-pointer"
                              />
                              <span className="text-xs text-gray-600">Select</span>
                            </label>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {vendorComparisonData.parameterRows.map((row, rowIndex) => {
                      const bestVendorId = getBestValueForRow(row.key);
                      return (
                        <tr key={row.key} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="sticky left-0 px-6 py-4 text-sm font-medium text-gray-900 border-r border-gray-200 bg-inherit">
                            <div className="flex items-center gap-2">
                              <i className={`${row.icon} text-gray-400`}></i>
                              {row.label}
                            </div>
                          </td>
                          {vendorComparisonData.vendors.map((vendor) => {
                            const param = vendor.parameters.find((p) => p.key === row.key);
                            const isBest = bestVendorId === vendor.id;
                            return (
                              <td key={vendor.id} className={`px-6 py-4 text-sm text-center border-r border-gray-200 ${isBest ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-gray-900'}`}>
                                {param?.displayValue || '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quotation Files */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-lg">
                  <i className="ri-folder-open-line text-amber-600 text-base"></i>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Quotation Files</h2>
                  <p className="text-xs text-gray-500">Uploaded quote documents from each vendor</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="sticky left-0 bg-white px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 min-w-[200px]">Vendor</th>
                      {vendorComparisonData.vendors.map((vendor) => (
                        <th key={vendor.id} className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200 min-w-[180px]">
                          {vendor.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="sticky left-0 bg-white px-6 py-4 text-sm font-medium text-gray-700 border-r border-gray-200 align-top">
                        <div className="flex items-center gap-2">
                          <i className="ri-attachment-2 text-gray-400"></i>Attached Files
                        </div>
                      </td>
                      {vendorComparisonData.vendors.map((vendor) => (
                        <td key={vendor.id} className="px-4 py-4 border-r border-gray-200 align-top">
                          {vendor.quotationFiles && vendor.quotationFiles.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {vendor.quotationFiles.map((file) => {
                                const { icon, color, bg } = getFileIcon(file.fileType);
                                return (
                                  <div key={file.id} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all group">
                                    <div className={`w-8 h-8 flex items-center justify-center rounded-md flex-shrink-0 ${bg}`}>
                                      <i className={`${icon} ${color} text-base`}></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium text-gray-800 truncate leading-tight" title={file.fileName}>{file.fileName}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">{file.fileSize}</p>
                                      <p className="text-xs text-gray-400">{file.uploadedAt}</p>
                                    </div>
                                    <button
                                      onClick={() => setPreviewFile({ file, vendorName: vendor.name })}
                                      className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
                                      title="View file"
                                    >
                                      <i className="ri-eye-line text-sm"></i>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                              <i className="ri-file-unknow-line text-2xl mb-1"></i>
                              <p className="text-xs">No files</p>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex items-center gap-2">
                <i className="ri-information-line text-gray-400 text-sm"></i>
                <p className="text-xs text-gray-500">
                  Total files submitted: <span className="font-semibold text-gray-700">{vendorComparisonData.vendors.reduce((sum, v) => sum + (v.quotationFiles?.length || 0), 0)} files</span> across {vendorComparisonData.vendors.length} vendors.
                </p>
              </div>
            </div>

            {/* Summary Panel */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <i className="ri-trophy-line text-white text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm text-emerald-600 font-medium">Currently Selected Vendor</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{selectedVendorData?.name || 'No vendor selected'}</p>
                  </div>
                </div>
                {selectedVendorData && (
                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Quoted Price</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedVendorData.parameters.find(p => p.key === 'quotedPrice')?.displayValue}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Overall Score</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedVendorData.parameters.find(p => p.key === 'overallScore')?.displayValue}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Lead Time</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedVendorData.parameters.find(p => p.key === 'leadTime')?.displayValue}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Quotation Files</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedVendorData.quotationFiles?.length || 0} files</p>
                    </div>
                    <button
                      onClick={() => setShowCompSuccessModal(true)}
                      className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-semibold whitespace-nowrap cursor-pointer shadow-sm"
                    >
                      <i className="ri-check-double-line"></i> Confirm Winner
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Select Winner Modal (PR List) ── */}
      <SelectWinnerModal
        isOpen={winnerModal.isOpen}
        prId={winnerModal.prId}
        prTitle={winnerModal.prTitle}
        recommendedVendor={winnerModal.recommendedVendor}
        overallScore={winnerModal.overallScore}
        amount={winnerModal.amount}
        onConfirm={handleWinnerConfirm}
        onClose={() => setWinnerModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ── File Preview Modal (Comparison View) ── */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${getFileIcon(previewFile.file.fileType).bg}`}>
                  <i className={`${getFileIcon(previewFile.file.fileType).icon} ${getFileIcon(previewFile.file.fileType).color} text-lg`}></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">File Details</p>
                  <p className="text-xs text-gray-500">{previewFile.vendorName}</p>
                </div>
              </div>
              <button onClick={() => setPreviewFile(null)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${getFileIcon(previewFile.file.fileType).bg}`}>
                    <i className={`${getFileIcon(previewFile.file.fileType).icon} ${getFileIcon(previewFile.file.fileType).color} text-2xl`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 break-all">{previewFile.file.fileName}</p>
                    <p className="text-xs text-gray-500 mt-0.5 uppercase">{previewFile.file.fileType} Document</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">File Size</p>
                    <p className="text-sm font-semibold text-gray-900">{previewFile.file.fileSize}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Uploaded By</p>
                    <p className="text-sm font-semibold text-gray-900">{previewFile.file.uploadedBy}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-200 sm:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Uploaded At</p>
                    <p className="text-sm font-semibold text-gray-900">{previewFile.file.uploadedAt}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPreviewFile(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm whitespace-nowrap cursor-pointer">Close</button>
                <button onClick={() => setPreviewFile(null)} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer">
                  <i className="ri-download-line"></i>Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Comparison View Success Modal ── */}
      {showCompSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="ri-check-line text-emerald-600 text-3xl"></i>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">Vendor Selected Successfully</h3>
              <p className="text-sm text-gray-600 text-center mb-6">
                <span className="font-medium">{selectedVendorData?.name}</span> has been selected as the winning vendor. The procurement process will proceed to PO creation.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowCompSuccessModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap cursor-pointer text-sm">Close</button>
                <button
                  onClick={() => { setShowCompSuccessModal(false); window.REACT_APP_NAVIGATE('/scm/create-po'); }}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer text-sm font-semibold"
                >
                  Go to Create PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold ${toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}>
            <i className={toast.type === 'success' ? 'ri-check-double-line' : 'ri-close-circle-line'}></i>
            {toast.text}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
