import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';
import PriorityBadge from '../../../components/base/PriorityBadge';
import { prApi } from '../../../services/api';

type StatusFilter = 'all' | 'draft' | 'pending_approval' | 'approved' | 'returned' | 'rejected' | 'po_issued';
type RequestTypeFilter = 'all' | 'Capex' | 'Opex' | 'Service';
type SLAStatus = 'on_time' | 'breached' | 'in_progress' | 'not_started';
type StageStatus = 'completed' | 'current' | 'pending' | 'returned' | 'rejected';

interface StageSla {
  slaDays: number;
  startDate: string | null;
  dueDate: string | null;
  actualDays: number | null;
  slaStatus: SLAStatus;
  hoursAtStage: string | null;
}

interface TimelineStage {
  stage: string;
  date: string;
  approver: string;
  status: StageStatus;
  sla: StageSla;
  remarks?: string;
}

interface LineItem {
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface TrackPR {
  key: string;
  prId: number;
  id: string;
  title: string;
  requestType: string;
  department: string;
  amount: number;
  status: string;
  statusUI: string;
  submittedDate: string;
  priority: string;
  requiredDate: string;
  justification: string;
  lineItems: LineItem[];
  approvalHistory: TimelineStage[];
  returnReason?: string;
}

const SLA_DAYS = 1;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function daysBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function formatHoursLabel(hours: number): string {
  if (hours < 1) return '< 1 hr';
  if (hours < 48) return `${Math.round(hours)} hrs`;
  return `${Math.round(hours / 24)} days`;
}

function computeSla(startDate: string | null, endDate: string | null, stageStatus: StageStatus): StageSla {
  if (!startDate) {
    return {
      slaDays: SLA_DAYS,
      startDate: null,
      dueDate: null,
      actualDays: null,
      slaStatus: 'not_started',
      hoursAtStage: null,
    };
  }
  const dueDate = addDays(startDate, SLA_DAYS);
  const end = endDate || new Date().toISOString().split('T')[0];
  const actualDays = daysBetween(startDate, end);
  const hours = (new Date(end).getTime() - new Date(startDate).getTime()) / 3600000;

  if (stageStatus === 'pending') {
    return {
      slaDays: SLA_DAYS,
      startDate: null,
      dueDate: null,
      actualDays: null,
      slaStatus: 'not_started',
      hoursAtStage: null,
    };
  }

  if (stageStatus === 'current') {
    const breached = actualDays > SLA_DAYS;
    return {
      slaDays: SLA_DAYS,
      startDate,
      dueDate,
      actualDays: null,
      slaStatus: breached ? 'breached' : 'in_progress',
      hoursAtStage: breached
        ? `${formatHoursLabel(hours)} waiting`
        : `${formatHoursLabel(hours)} elapsed`,
    };
  }

  const breached = actualDays > SLA_DAYS;
  return {
    slaDays: SLA_DAYS,
    startDate,
    dueDate,
    actualDays,
    slaStatus: breached ? 'breached' : 'on_time',
    hoursAtStage: breached
      ? `${formatHoursLabel(hours)} (SLA: 24 hrs)`
      : formatHoursLabel(hours),
  };
}

function mapTrackStatus(rawStatus: string, statusFrontend: string): string {
  if (statusFrontend === 'draft' || rawStatus === 'DRAFT') return 'draft';
  if (statusFrontend === 'returned' || rawStatus === 'RETURNED') return 'returned';
  if (statusFrontend === 'rejected' || rawStatus === 'REJECTED') return 'rejected';
  if (rawStatus === 'APPROVED') return 'po_issued';
  if (statusFrontend === 'approved') return 'approved';
  return 'pending_approval';
}

function currentStageLabel(rawStatus: string, statusUI: string): string | null {
  if (rawStatus === 'PENDING_HOD_APPROVAL') return 'HOD Review';
  if (rawStatus === 'PENDING_PR_MANAGER_APPROVAL') return 'Manager Review';
  if (rawStatus === 'PENDING_CFO_APPROVAL') return 'CFO Review';
  if (rawStatus === 'PENDING_RFQ_MANAGER_APPROVAL') return 'Manager Approval (Post-RFQ)';
  if (rawStatus === 'PENDING_RFQ_L2_APPROVAL') return 'L2 Manager Approval';
  if (rawStatus === 'PENDING_RFQ_CFO_APPROVAL') return 'CFO Approval (Post-RFQ)';
  if (rawStatus === 'PENDING_SCM_PO') return 'SCM PO Creation';
  if (rawStatus === 'PENDING_BUSINESS_APPROVAL') return 'Business Approval';
  if (rawStatus === 'RETURNED') return 'Returned for Rework';
  if (rawStatus === 'REJECTED') return 'Rejected';
  if (rawStatus === 'APPROVED') return 'PO Issued';
  if (rawStatus === 'DRAFT') return null;
  return statusUI || null;
}

function buildTimeline(pr: Record<string, unknown>): TimelineStage[] {
  const stages: TimelineStage[] = [];
  const submittedDate = String(pr.submittedDate || pr.createdAt || '');
  const requester = String(pr.requester || 'Requester');
  const rawStatus = String(pr.status || '');
  const history = Array.isArray(pr.approvalHistory)
    ? (pr.approvalHistory as Array<Record<string, unknown>>)
    : [];

  stages.push({
    stage: 'Submitted',
    date: submittedDate,
    approver: requester,
    status: rawStatus === 'DRAFT' ? 'pending' : 'completed',
    sla: computeSla(submittedDate, submittedDate, rawStatus === 'DRAFT' ? 'pending' : 'completed'),
  });

  let prevDate = submittedDate;
  for (const h of history) {
    const action = String(h.status || h.action || '').toLowerCase();
    const stageName = String(h.stage || 'Approval');
    if (action === 'completed' && stageName.toLowerCase().includes('submit')) continue;
    if (action === 'submitted') continue;

    const date = String(h.date || '').split(',')[0] || String(h.date || '');
    // Try ISO-like first 10 chars
    const dateOnly = date.match(/\d{4}-\d{2}-\d{2}/)?.[0] || prevDate;
    let stageStatus: StageStatus = 'completed';
    if (action.includes('reject')) stageStatus = 'rejected';
    else if (action.includes('return') || action.includes('rework')) stageStatus = 'returned';

    stages.push({
      stage: stageName.replace(/_/g, ' '),
      date: dateOnly,
      approver: String(h.user || h.approver || 'Approver'),
      status: stageStatus,
      remarks: String(h.remarks || ''),
      sla: computeSla(prevDate || dateOnly, dateOnly, stageStatus),
    });
    prevDate = dateOnly || prevDate;
  }

  const currentLabel = currentStageLabel(rawStatus, String(pr.statusUI || ''));
  const terminal = ['APPROVED', 'REJECTED', 'RETURNED', 'DRAFT'].includes(rawStatus);
  if (currentLabel && !terminal) {
    const already = stages.some(
      (s) => s.stage.toLowerCase() === currentLabel.toLowerCase() && s.status === 'current'
    );
    if (!already) {
      stages.push({
        stage: currentLabel,
        date: '',
        approver: 'Pending',
        status: 'current',
        sla: computeSla(prevDate || submittedDate, null, 'current'),
      });
    }
  }

  if (rawStatus === 'APPROVED') {
    const hasPo = stages.some((s) => s.stage.toLowerCase().includes('po'));
    if (!hasPo) {
      stages.push({
        stage: 'PO Issued',
        date: prevDate,
        approver: 'SCM',
        status: 'completed',
        sla: computeSla(prevDate, prevDate, 'completed'),
      });
    }
  } else if (!terminal && rawStatus !== 'PENDING_SCM_PO') {
    stages.push({
      stage: 'SCM / PO',
      date: '',
      approver: 'Pending',
      status: 'pending',
      sla: computeSla(null, null, 'pending'),
    });
  }

  return stages;
}

function mapApiPr(pr: Record<string, unknown>): TrackPR {
  const lineItems = Array.isArray(pr.lineItems) ? pr.lineItems : [];
  const statusFrontend = String(pr.statusFrontend || '');
  const rawStatus = String(pr.status || '');
  const history = Array.isArray(pr.approvalHistory) ? pr.approvalHistory : [];
  const returnEntry = history.find((h) => {
    const s = String((h as Record<string, unknown>).status || '').toLowerCase();
    return s.includes('return') || s.includes('reject') || s.includes('rework');
  }) as Record<string, unknown> | undefined;

  return {
    key: String(pr.id),
    prId: Number(pr.id),
    id: String(pr.prNumber || pr.id),
    title: String(pr.title || ''),
    requestType: String(pr.requestType || ''),
    department: String(pr.department || ''),
    amount: Number(pr.totalAmount || 0),
    status: mapTrackStatus(rawStatus, statusFrontend),
    statusUI: String(pr.statusUI || statusFrontend),
    submittedDate: String(pr.submittedDate || pr.createdAt || ''),
    priority: String(pr.priorityLower || pr.priority || 'medium').toLowerCase(),
    requiredDate: String(pr.requiredDate || '—'),
    justification: String(pr.justification || 'No justification provided.'),
    lineItems: lineItems.map((li) => {
      const item = li as Record<string, unknown>;
      return {
        description: String(item.description || item.item || '—'),
        category: String(item.category || '—'),
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unitCost ?? item.unitPrice ?? 0),
        total: Number(item.total || 0),
      };
    }),
    approvalHistory: buildTimeline(pr),
    returnReason: returnEntry ? String(returnEntry.remarks || '') : undefined,
  };
}

function SLABadge({ status }: { status: SLAStatus }) {
  if (status === 'on_time') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <i className="ri-checkbox-circle-fill text-xs"></i> On Time
      </span>
    );
  }
  if (status === 'breached') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <i className="ri-alarm-warning-fill text-xs"></i> SLA Breached
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <i className="ri-time-fill text-xs"></i> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400 border border-gray-200">
      <i className="ri-circle-line text-xs"></i> Not Started
    </span>
  );
}

function getStageIcon(status: string, slaStatus: SLAStatus) {
  if (status === 'completed') {
    if (slaStatus === 'breached') {
      return (
        <div className="w-8 h-8 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center">
          <i className="ri-checkbox-circle-fill text-red-500 text-sm"></i>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center">
        <i className="ri-checkbox-circle-fill text-emerald-600 text-sm"></i>
      </div>
    );
  }
  if (status === 'current') {
    if (slaStatus === 'breached') {
      return (
        <div className="w-8 h-8 rounded-full bg-red-100 border-2 border-red-500 flex items-center justify-center">
          <i className="ri-alarm-warning-fill text-red-600 text-sm"></i>
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-500 flex items-center justify-center">
        <i className="ri-time-fill text-amber-600 text-sm"></i>
      </div>
    );
  }
  if (status === 'returned') {
    return (
      <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center">
        <i className="ri-arrow-go-back-fill text-orange-600 text-sm"></i>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 border-2 border-red-400 flex items-center justify-center">
        <i className="ri-close-circle-fill text-red-600 text-sm"></i>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
      <i className="ri-circle-line text-gray-300 text-sm"></i>
    </div>
  );
}

function getConnectorColor(status: string, slaStatus: SLAStatus) {
  if (status === 'completed') return slaStatus === 'breached' ? 'bg-red-200' : 'bg-emerald-200';
  return 'bg-gray-200';
}

function getSLAStageLabel(status: string) {
  if (status === 'completed') return 'Completed';
  if (status === 'current' || status === 'returned' || status === 'rejected') return 'Active';
  return 'Pending';
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function TrackPRPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TrackPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await prApi.list();
      const list = (res.data as Array<Record<string, unknown>>) || [];
      setRows(list.map(mapApiPr));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredData = useMemo(() => {
    return rows.filter((pr) => {
      const matchesStatus = statusFilter === 'all' || pr.status === statusFilter;
      const matchesRequestType = requestTypeFilter === 'all' || pr.requestType === requestTypeFilter;
      const matchesSearch =
        searchQuery === '' ||
        pr.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDateFrom = dateFrom === '' || new Date(pr.submittedDate) >= new Date(dateFrom);
      const matchesDateTo = dateTo === '' || new Date(pr.submittedDate) <= new Date(dateTo);
      return matchesStatus && matchesRequestType && matchesSearch && matchesDateFrom && matchesDateTo;
    });
  }, [rows, statusFilter, requestTypeFilter, searchQuery, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, requestTypeFilter, searchQuery, dateFrom, dateTo]);

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const getSLASummary = (approvalHistory: TimelineStage[]) => {
    const completed = approvalHistory.filter(
      (s) => s.status === 'completed' || s.status === 'returned' || s.status === 'rejected'
    );
    const breached = completed.filter((s) => s.sla.slaStatus === 'breached').length;
    const onTime = completed.filter((s) => s.sla.slaStatus === 'on_time').length;
    const currentBreach = approvalHistory.find(
      (s) => s.status === 'current' && s.sla.slaStatus === 'breached'
    );
    return { breached, onTime, currentBreach };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Track Purchase Requisitions</h1>
            <p className="text-sm text-gray-600 mt-1">
              Monitor your PR submissions with SLA tracking — 1 day per approval stage
            </p>
          </div>
          <button
            onClick={() => navigate('/requester/create-pr')}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <i className="ri-add-line text-lg"></i>
            Create New PR
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">Search PR</label>
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="text"
                  placeholder="Search by PR number or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="returned">Returned</option>
                <option value="po_issued">PO Issued</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Request Type</label>
              <select
                value={requestTypeFilter}
                onChange={(e) => setRequestTypeFilter(e.target.value as RequestTypeFilter)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
              >
                <option value="all">All Types</option>
                <option value="Capex">Capex</option>
                <option value="Opex">Opex</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setRequestTypeFilter('all');
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredData.length}</span> results
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> On Time
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> SLA Breached
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> In Progress
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span> Not Started
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2"></i>
              Loading your purchase requests...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        PR Number
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        SLA
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginatedData.map((pr) => {
                      const { breached, onTime, currentBreach } = getSLASummary(pr.approvalHistory);
                      const totalActioned = breached + onTime;
                      return (
                        <Fragment key={pr.key}>
                          <tr
                            className={`hover:bg-gray-50 transition-colors ${
                              expandedRow === pr.key ? 'bg-gray-50' : ''
                            }`}
                          >
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleRow(pr.key)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  <i
                                    className={`ri-arrow-${
                                      expandedRow === pr.key ? 'down' : 'right'
                                    }-s-line text-lg`}
                                  ></i>
                                </button>
                                <span className="text-sm font-semibold text-gray-900">{pr.id}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900">{pr.title}</span>
                                <PriorityBadge priority={pr.priority} />
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{pr.department}</p>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                                {pr.requestType}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(pr.amount)}
                              </span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <StatusBadge status={pr.statusUI || pr.status} />
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              {totalActioned === 0 && !currentBreach ? (
                                <span className="text-xs text-gray-400">—</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {breached > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                                      <i className="ri-alarm-warning-fill text-xs"></i> {breached}{' '}
                                      Breached
                                    </span>
                                  )}
                                  {currentBreach && breached === 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">
                                      <i className="ri-alarm-warning-fill text-xs"></i> Overdue
                                    </span>
                                  )}
                                  {breached === 0 && !currentBreach && onTime > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                                      <i className="ri-checkbox-circle-fill text-xs"></i> On Track
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-700">{pr.submittedDate || '—'}</span>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleRow(pr.key)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors whitespace-nowrap"
                                >
                                  {expandedRow === pr.key ? 'Hide' : 'View Details'}
                                </button>
                                {(pr.status === 'draft' || pr.status === 'returned') && (
                                  <button
                                    onClick={() => navigate(`/requester/edit-pr/${pr.prId}`)}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {expandedRow === pr.key && (
                            <tr>
                              <td colSpan={8} className="bg-gray-50 border-b border-gray-200">
                                <div className="px-6 py-6">
                                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    <div className="lg:col-span-2 space-y-4">
                                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                          PR Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">PR Number</p>
                                            <p className="text-sm font-medium text-gray-900">
                                              {pr.id}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">
                                              Department
                                            </p>
                                            <p className="text-sm font-medium text-gray-900">
                                              {pr.department}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">
                                              Request Type
                                            </p>
                                            <p className="text-sm font-medium text-gray-900">
                                              {pr.requestType}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">
                                              Required Date
                                            </p>
                                            <p className="text-sm font-medium text-gray-900">
                                              {pr.requiredDate}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">
                                              Total Amount
                                            </p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {formatCurrency(pr.amount)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-400 mb-0.5">Priority</p>
                                            <PriorityBadge priority={pr.priority} />
                                          </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                          <p className="text-xs text-gray-400 mb-1">
                                            Business Justification
                                          </p>
                                          <p className="text-xs text-gray-700 leading-relaxed">
                                            {pr.justification}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="bg-white rounded-lg border border-gray-200 p-4">
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">
                                          Line Items ({pr.lineItems.length})
                                        </h3>
                                        {pr.lineItems.length === 0 ? (
                                          <p className="text-xs text-gray-500">No line items</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {pr.lineItems.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-start justify-between p-2.5 bg-gray-50 rounded-lg"
                                              >
                                                <div className="flex-1">
                                                  <p className="text-xs font-medium text-gray-900">
                                                    {item.description}
                                                  </p>
                                                  <p className="text-xs text-gray-400 mt-0.5">
                                                    {item.category} · {item.quantity} units
                                                  </p>
                                                </div>
                                                <div className="text-right ml-3">
                                                  <p className="text-xs font-semibold text-gray-900">
                                                    {formatCurrency(item.total)}
                                                  </p>
                                                  <p className="text-xs text-gray-400">
                                                    @{formatCurrency(item.unitCost)}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {(pr.status === 'returned' || pr.status === 'rejected') &&
                                        pr.returnReason && (
                                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <div className="flex items-start gap-2">
                                              <i className="ri-error-warning-fill text-red-600 mt-0.5"></i>
                                              <div>
                                                <h3 className="text-xs font-semibold text-red-900 mb-1">
                                                  {pr.status === 'rejected'
                                                    ? 'Rejection Reason'
                                                    : 'Return Reason'}
                                                </h3>
                                                <p className="text-xs text-red-800">
                                                  {pr.returnReason}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                    </div>

                                    <div className="lg:col-span-3">
                                      <div className="bg-white rounded-lg border border-gray-200 p-5">
                                        <div className="flex items-center justify-between mb-5">
                                          <div>
                                            <h3 className="text-sm font-semibold text-gray-900">
                                              Approval Workflow & SLA Tracking
                                            </h3>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                              SLA Target: 1 business day per approval stage
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {(() => {
                                              const { breached: b, onTime: ot } = getSLASummary(
                                                pr.approvalHistory
                                              );
                                              return (
                                                <>
                                                  {ot > 0 && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                                                      {ot} On Time
                                                    </span>
                                                  )}
                                                  {b > 0 && (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium border border-red-200">
                                                      {b} Breached
                                                    </span>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        </div>

                                        <div className="space-y-0">
                                          {pr.approvalHistory.map((stage, idx) => {
                                            const isLast = idx === pr.approvalHistory.length - 1;
                                            const sla = stage.sla;
                                            return (
                                              <div key={idx} className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                  {getStageIcon(stage.status, sla.slaStatus)}
                                                  {!isLast && (
                                                    <div
                                                      className={`w-0.5 flex-1 min-h-8 ${getConnectorColor(
                                                        stage.status,
                                                        sla.slaStatus
                                                      )} my-1`}
                                                    ></div>
                                                  )}
                                                </div>

                                                <div
                                                  className={`flex-1 pb-5 ${isLast ? 'pb-0' : ''}`}
                                                >
                                                  <div
                                                    className={`rounded-lg border p-3.5 ${
                                                      stage.status === 'current' &&
                                                      sla.slaStatus === 'breached'
                                                        ? 'border-red-200 bg-red-50'
                                                        : stage.status === 'current'
                                                          ? 'border-amber-200 bg-amber-50'
                                                          : stage.status === 'completed' &&
                                                              sla.slaStatus === 'breached'
                                                            ? 'border-red-100 bg-white'
                                                            : stage.status === 'completed'
                                                              ? 'border-emerald-100 bg-white'
                                                              : stage.status === 'returned' ||
                                                                  stage.status === 'rejected'
                                                                ? 'border-orange-200 bg-orange-50'
                                                                : 'border-gray-100 bg-gray-50'
                                                    }`}
                                                  >
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                      <div className="flex items-center gap-2">
                                                        <span
                                                          className={`text-sm font-semibold ${
                                                            stage.status === 'current'
                                                              ? 'text-gray-900'
                                                              : stage.status === 'completed'
                                                                ? 'text-gray-800'
                                                                : stage.status === 'returned'
                                                                  ? 'text-orange-800'
                                                                  : stage.status === 'rejected'
                                                                    ? 'text-red-800'
                                                                    : 'text-gray-400'
                                                          }`}
                                                        >
                                                          {stage.stage}
                                                        </span>
                                                        {stage.status === 'current' && (
                                                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                                            Current
                                                          </span>
                                                        )}
                                                      </div>
                                                      <SLABadge status={sla.slaStatus} />
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                      <div>
                                                        <p className="text-gray-400 mb-0.5">
                                                          Approver
                                                        </p>
                                                        <p
                                                          className={`font-medium ${
                                                            stage.status === 'pending'
                                                              ? 'text-gray-400'
                                                              : 'text-gray-700'
                                                          }`}
                                                        >
                                                          {stage.approver}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-gray-400 mb-0.5">
                                                          Start Date
                                                        </p>
                                                        <p
                                                          className={`font-medium ${
                                                            sla.startDate
                                                              ? 'text-gray-700'
                                                              : 'text-gray-400'
                                                          }`}
                                                        >
                                                          {sla.startDate || '—'}
                                                        </p>
                                                      </div>
                                                      <div>
                                                        <p className="text-gray-400 mb-0.5">
                                                          SLA Due
                                                        </p>
                                                        <p
                                                          className={`font-medium ${
                                                            sla.dueDate
                                                              ? sla.slaStatus === 'breached'
                                                                ? 'text-red-600'
                                                                : 'text-gray-700'
                                                              : 'text-gray-400'
                                                          }`}
                                                        >
                                                          {sla.dueDate || '—'}
                                                        </p>
                                                      </div>
                                                    </div>

                                                    {stage.remarks && (
                                                      <p className="mt-2 text-xs text-gray-600 bg-white/60 rounded p-2">
                                                        {stage.remarks}
                                                      </p>
                                                    )}

                                                    {sla.hoursAtStage && (
                                                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                          <i
                                                            className={`ri-timer-line ${
                                                              sla.slaStatus === 'breached'
                                                                ? 'text-red-500'
                                                                : sla.slaStatus === 'on_time'
                                                                  ? 'text-emerald-500'
                                                                  : 'text-amber-500'
                                                            }`}
                                                          ></i>
                                                          <span
                                                            className={`font-medium ${
                                                              sla.slaStatus === 'breached'
                                                                ? 'text-red-700'
                                                                : sla.slaStatus === 'on_time'
                                                                  ? 'text-emerald-700'
                                                                  : 'text-amber-700'
                                                            }`}
                                                          >
                                                            {sla.hoursAtStage}
                                                          </span>
                                                        </div>
                                                        {stage.date && (
                                                          <span className="text-xs text-gray-400">
                                                            {getSLAStageLabel(stage.status)}:{' '}
                                                            {stage.date}
                                                          </span>
                                                        )}
                                                      </div>
                                                    )}
                                                    {sla.slaStatus === 'breached' &&
                                                      stage.status === 'current' && (
                                                        <div className="mt-2 pt-2 border-t border-red-100 flex items-center gap-1.5 text-xs text-red-700 font-medium">
                                                          <i className="ri-alarm-warning-line"></i>
                                                          SLA exceeded — awaiting action
                                                        </div>
                                                      )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                          currentPage === page
                            ? 'bg-gray-900 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {filteredData.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <i className="ri-file-list-3-line text-5xl text-gray-300 mb-4"></i>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">
                    No purchase requisitions found
                  </h3>
                  <p className="text-sm text-gray-500">
                    Try adjusting your filters or create a new PR
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
