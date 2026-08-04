import { useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { techEvalRFQs } from '../../../mocks/tech-eval-data';
import type { TechEvalRFQ, TechEvalRound } from '../../../mocks/tech-eval-data';
import RFQEvalCard from './components/RFQEvalCard';
import RFQEvalDetailPanel from './components/RFQEvalDetailPanel';

type FilterStatus = 'All' | 'Pending Evaluation' | 'In Progress' | 'Completed';

export default function TechEvaluatorPage() {
  const [rfqs, setRfqs] = useState<TechEvalRFQ[]>(techEvalRFQs);
  const [selectedRFQ, setSelectedRFQ] = useState<TechEvalRFQ | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleUpdate = (rfqId: string, vendorId: string, roundIndex: number, data: Partial<TechEvalRound>) => {
    setRfqs(prev => prev.map(rfq => {
      if (rfq.id !== rfqId) return rfq;
      const updatedVendors = rfq.vendors.map(v => {
        if (v.id !== vendorId) return v;
        const updatedRounds = v.rounds.map((r, i) =>
          i === roundIndex ? { ...r, ...data } : r
        );
        return { ...v, rounds: updatedRounds };
      });
      const evaluatedCount = updatedVendors.filter(v =>
        v.rounds[v.rounds.length - 1]?.status === 'evaluated'
      ).length;
      const newStatus: TechEvalRFQ['status'] =
        evaluatedCount === rfq.totalVendors ? 'Completed' :
        evaluatedCount > 0 ? 'In Progress' : 'Pending Evaluation';
      return { ...rfq, vendors: updatedVendors, evaluatedVendors: evaluatedCount, status: newStatus };
    }));
    // Also update selectedRFQ if open
    setSelectedRFQ(prev => {
      if (!prev || prev.id !== rfqId) return prev;
      const updatedVendors = prev.vendors.map(v => {
        if (v.id !== vendorId) return v;
        const updatedRounds = v.rounds.map((r, i) =>
          i === roundIndex ? { ...r, ...data } : r
        );
        return { ...v, rounds: updatedRounds };
      });
      const evaluatedCount = updatedVendors.filter(v =>
        v.rounds[v.rounds.length - 1]?.status === 'evaluated'
      ).length;
      const newStatus: TechEvalRFQ['status'] =
        evaluatedCount === prev.totalVendors ? 'Completed' :
        evaluatedCount > 0 ? 'In Progress' : 'Pending Evaluation';
      return { ...prev, vendors: updatedVendors, evaluatedVendors: evaluatedCount, status: newStatus };
    });
  };

  const filtered = rfqs.filter(r => {
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchSearch = !searchQuery ||
      r.rfqRef.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.prTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const counts = {
    all: rfqs.length,
    pending: rfqs.filter(r => r.status === 'Pending Evaluation').length,
    inProgress: rfqs.filter(r => r.status === 'In Progress').length,
    completed: rfqs.filter(r => r.status === 'Completed').length,
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 pb-10">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Technical Evaluation</h1>
              <p className="text-sm text-gray-500 mt-0.5">Score vendor quotations — technical compliance, quality, delivery capability</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search RFQ, PR, department..."
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 w-64"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Assigned', value: counts.all, icon: 'ri-file-list-3-line', color: 'text-gray-700', bg: 'bg-gray-50' },
              { label: 'Pending Evaluation', value: counts.pending, icon: 'ri-time-line', color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'In Progress', value: counts.inProgress, icon: 'ri-loader-4-line', color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Completed', value: counts.completed, icon: 'ri-checkbox-circle-line', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(kpi => (
              <div key={kpi.label} className={`${kpi.bg} border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4`}>
                <div className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border border-gray-200">
                  <i className={`${kpi.icon} ${kpi.color} text-xl`}></i>
                </div>
                <div>
                  <p className="text-xs text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* P2P Flow Banner */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-4">
            <p className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">P2P Quotation Flow — Your Role</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-teal-700">
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-teal-200 opacity-50">
                <i className="ri-global-line"></i>Vendor Submits Quote
              </span>
              <i className="ri-arrow-right-line text-teal-400"></i>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-teal-200 opacity-50">
                <i className="ri-refresh-line"></i>SCM Multi-Round Negotiation
              </span>
              <i className="ri-arrow-right-line text-teal-400"></i>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg font-semibold">
                <i className="ri-star-line"></i>Technical Evaluation (You)
              </span>
              <i className="ri-arrow-right-line text-teal-400"></i>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-teal-200 opacity-50">
                <i className="ri-bar-chart-grouped-line"></i>Vendor Comparison
              </span>
              <i className="ri-arrow-right-line text-teal-400"></i>
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-teal-200 opacity-50">
                <i className="ri-file-text-line"></i>PO Creation
              </span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2">
            {(['All', 'Pending Evaluation', 'In Progress', 'Completed'] as FilterStatus[]).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  filterStatus === f
                    ? 'bg-teal-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f}
                {f === 'All' && <span className="ml-1.5 text-xs opacity-70">({counts.all})</span>}
                {f === 'Pending Evaluation' && counts.pending > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-xs">{counts.pending}</span>
                )}
              </button>
            ))}
          </div>

          {/* RFQ Cards Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <i className="ri-search-line text-4xl mb-3 block"></i>
              <p className="text-sm">No RFQs found matching your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(rfq => (
                <RFQEvalCard key={rfq.id} rfq={rfq} onOpen={setSelectedRFQ} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedRFQ && (
        <RFQEvalDetailPanel
          rfq={selectedRFQ}
          onClose={() => setSelectedRFQ(null)}
          onUpdate={handleUpdate}
        />
      )}
    </DashboardLayout>
  );
}
