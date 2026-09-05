import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatsCards from './components/StatsCards';
import PRTable from './components/PRTable';
import ActivityTimeline from './components/ActivityTimeline';
import HighValueAlerts from './components/HighValueAlerts';
import ApprovalActionModal from '../../tasks/components/ApprovalModal';
import { prApi } from '../../../services/api';

type PriorityFilter = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

type CfoEntity = {
  id: string;
  name: string;
  code: string;
  allocatedBudget: number;
  utilizedBudget: number;
  utilizationPercentage: number;
  pendingPRsCount: number;
  pendingAmount: number;
  approvedAmount: number;
  color: string;
};

type CfoStats = {
  totalPendingApprovals: number;
  highValuePRs: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  totalSpendAllEntities: number;
};

const EMPTY_STATS: CfoStats = {
  totalPendingApprovals: 0,
  highValuePRs: 0,
  approvedThisMonth: 0,
  rejectedThisMonth: 0,
  totalSpendAllEntities: 0,
};

function formatCr(amount: number) {
  return `₹${(Number(amount || 0) / 10000000).toFixed(2)}Cr`;
}

export default function CFODashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef(false);
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('All');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cfoPRList, setCfoPRList] = useState<Array<Record<string, unknown>>>([]);
  const [stats, setStats] = useState<CfoStats>(EMPTY_STATS);
  const [businessEntities, setBusinessEntities] = useState<CfoEntity[]>([]);
  const [highValueAlerts, setHighValueAlerts] = useState<
    Array<{
      id: string;
      prId: string;
      title: string;
      entity: string;
      amount: number;
      priority: string;
      daysWaiting: number;
    }>
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    Array<{
      id: string;
      type: string;
      prId: string;
      entity: string;
      amount: number;
      user: string;
      timestamp: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject';
    prId: number;
    prNumber: string;
    prTitle: string;
    amount: number;
    requireInvoiceUpload?: boolean;
  }>({ isOpen: false, type: 'approve', prId: 0, prNumber: '', prTitle: '', amount: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoadError(null);
      const [pendingRes, dashRes] = await Promise.all([
        prApi.listPending(),
        prApi.cfoDashboard(),
      ]);
      setCfoPRList(pendingRes.data as Array<Record<string, unknown>>);
      setStats(dashRes.data.stats || EMPTY_STATS);
      setBusinessEntities(dashRes.data.entities || []);
      setHighValueAlerts(dashRes.data.highValueAlerts || []);
      setRecentActivity(dashRes.data.recentActivity || []);
    } catch (err) {
      setCfoPRList([]);
      setStats(EMPTY_STATS);
      setBusinessEntities([]);
      setHighValueAlerts([]);
      setRecentActivity([]);
      setLoadError(err instanceof Error ? err.message : 'Failed to load CFO dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (loading || deepLinkHandled.current) return;
    const prId = Number(searchParams.get('prId'));
    const action = searchParams.get('action');
    if (!prId || !action) return;
    if (!['approve', 'reject'].includes(action)) return;

    const pr = cfoPRList.find((p) => Number(p.prId) === prId);
    if (!pr || (pr.status !== 'Pending CFO Approval' && pr.status !== 'Pending Mugesh Approval'))
      return;

    deepLinkHandled.current = true;
    setApprovalModal({
      isOpen: true,
      type: action as 'approve' | 'reject',
      prId,
      prNumber: String(pr.id),
      prTitle: String(pr.title),
      amount: Number(pr.amount),
      requireInvoiceUpload: Boolean(action === 'approve' && pr.requireInvoiceUpload),
    });
    setSearchParams({}, { replace: true });
  }, [loading, cfoPRList, searchParams, setSearchParams]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPRs = cfoPRList.filter((pr) => {
    const matchesEntity = selectedEntity === 'all' || pr.entity === selectedEntity;
    const matchesSearch =
      searchQuery === '' ||
      String(pr.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(pr.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(pr.requester).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(pr.department).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'All' || pr.priority === priorityFilter;
    return matchesEntity && matchesSearch && matchesPriority;
  }) as unknown as Parameters<typeof PRTable>[0]['prs'];

  const selectedEntityData =
    selectedEntity === 'all' ? null : businessEntities.find((e) => e.id === selectedEntity);

  const entityPRs =
    selectedEntity === 'all' ? cfoPRList : cfoPRList.filter((pr) => pr.entity === selectedEntity);

  const dropdownLabel = selectedEntityData ? selectedEntityData.name : 'All Entities';

  const totalUtilized = useMemo(
    () => businessEntities.reduce((s, e) => s + Number(e.utilizedBudget || 0), 0),
    [businessEntities]
  );

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <DashboardLayout>
      <div className="flex h-full">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CFO Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Entity-wise business approvals &amp; spend oversight
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-calendar-line"></i>
                <span>{monthLabel}</span>
              </div>
            </div>

            <StatsCards stats={stats} />
            {loadError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {loadError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {businessEntities.length === 0 && !loading && (
                <div className="col-span-full bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-500">
                  No active entities found. Pending CFO PRs still appear in the table below.
                </div>
              )}
              {businessEntities.map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => setSelectedEntity(entity.id === selectedEntity ? 'all' : entity.id)}
                  className={`bg-white rounded-lg p-5 border-2 cursor-pointer hover:shadow-md transition-all ${
                    selectedEntity === entity.id ? 'border-teal-500 shadow-md' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entity.color }}
                      ></div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {entity.code}
                      </span>
                    </div>
                    {entity.pendingPRsCount > 0 && (
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: entity.color }}
                      >
                        {entity.pendingPRsCount} pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-3 leading-tight">{entity.name}</p>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Spend share</span>
                      <span className="font-semibold text-gray-700">{entity.utilizationPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${entity.utilizationPercentage}%`,
                          backgroundColor: entity.color,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-400">Active spend</p>
                      <p className="text-sm font-bold text-gray-900">{formatCr(entity.utilizedBudget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Pending value</p>
                      <p className="text-sm font-bold text-gray-900">{formatCr(entity.pendingAmount)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-48">
                  <div className="relative">
                    <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input
                      type="text"
                      placeholder="Search PR ID, title, requester..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {selectedEntityData && (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: selectedEntityData.color }}
                      ></div>
                    )}
                    {!selectedEntityData && <i className="ri-building-4-line text-gray-500"></i>}
                    <span>{dropdownLabel}</span>
                    <i className={`ri-arrow-${dropdownOpen ? 'up' : 'down'}-s-line text-gray-400`}></i>
                  </button>

                  {dropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={() => {
                          setSelectedEntity('all');
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${selectedEntity === 'all' ? 'bg-teal-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                            <i className="ri-building-4-line text-gray-600 text-sm"></i>
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">All Entities</p>
                            <p className="text-xs text-gray-500">{cfoPRList.length} pending PRs</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{formatCr(totalUtilized)}</p>
                          <p className="text-xs text-gray-400">active spend</p>
                        </div>
                      </button>

                      <div className="border-t border-gray-100"></div>

                      {businessEntities.map((entity) => {
                        const entityPRCount = cfoPRList.filter((p) => p.entity === entity.id).length;
                        return (
                          <button
                            key={entity.id}
                            onClick={() => {
                              setSelectedEntity(entity.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${selectedEntity === entity.id ? 'bg-teal-50' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                style={{ backgroundColor: entity.color }}
                              >
                                {(entity.code || '?').slice(0, 2)}
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-gray-900">{entity.name}</p>
                                <p className="text-xs text-gray-500">
                                  {entityPRCount} PRs · {entity.pendingPRsCount} pending
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {formatCr(entity.utilizedBudget)}
                              </p>
                              <p className="text-xs text-gray-400">{entity.utilizationPercentage}% share</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {(['All', 'Critical', 'High', 'Medium', 'Low'] as PriorityFilter[]).map((priority) => (
                    <button
                      key={priority}
                      onClick={() => setPriorityFilter(priority)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        priorityFilter === priority
                          ? 'bg-teal-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-gray-500 ml-auto whitespace-nowrap">
                  {filteredPRs.length} of {entityPRs.length} PRs
                  {selectedEntityData && (
                    <span className="ml-1 font-semibold" style={{ color: selectedEntityData.color }}>
                      · {selectedEntityData.name}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {loading && <p className="text-sm text-gray-500 mb-4">Loading PRs...</p>}
            <PRTable prs={filteredPRs} entities={businessEntities} onRefresh={loadDashboard} />
          </div>
        </div>

        <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
          <div className="p-5">
            <HighValueAlerts alerts={highValueAlerts} />
            <ActivityTimeline activities={recentActivity} />
          </div>
        </div>
      </div>

      <ApprovalActionModal
        isOpen={approvalModal.isOpen}
        type={approvalModal.type}
        prNumber={approvalModal.prNumber}
        prTitle={approvalModal.prTitle}
        amount={approvalModal.amount}
        prId={approvalModal.prId}
        requireInvoiceUpload={Boolean(approvalModal.requireInvoiceUpload)}
        onClose={() => setApprovalModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={async (remarks, _returnTo, _goToBusiness, invoice) => {
          await prApi.approve(approvalModal.prId, approvalModal.type, remarks, {
            ...(invoice ? { invoice } : {}),
          });
          setApprovalModal((prev) => ({ ...prev, isOpen: false }));
          await loadDashboard();
        }}
      />
    </DashboardLayout>
  );
}
