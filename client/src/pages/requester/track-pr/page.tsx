import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import StatusBadge from '../../../components/base/StatusBadge';
import PriorityBadge from '../../../components/base/PriorityBadge';
import PrDocumentsPanel from '../../../components/feature/PrDocumentsPanel';
import { PM_BTN_PRIMARY, PM_PAGE_BG } from '../../../constants/pmTheme';
import { prApi, RequesterPrListMeta, accountsApi, type PrAttachmentRecord } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import CloudSubscriptionPanel from './CloudSubscriptionPanel';

const ADMIN_EDIT_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

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
  requestCategory?: string;
  projectDetail?: string;
  specialNotes?: string;
  department: string;
  amount: number;
  status: string;
  statusRaw: string;
  statusUI: string;
  submittedDate: string;
  priority: string;
  requiredDate: string;
  justification: string;
  lineItems: LineItem[];
  approvalHistory: TimelineStage[];
  returnReason?: string;
  poId?: number | null;
  poNumber?: string;
  poDocumentAvailable?: boolean;
  poSentBack?: boolean;
  purchaseType?: string;
  attachments: PrAttachmentRecord[];
  sassInvoice?: {
    id: number;
    invoiceNumber?: string | null;
    fileName?: string | null;
    hasFile: boolean;
    status?: string | null;
  } | null;
}

const SLA_DAYS = 1;

/** Never call String() on API objects — that throws "Cannot convert object to primitive value". */
function asText(value: unknown, fallback = ''): string {
  if (value == null || value === '') return fallback;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return String(value);
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }
  if (Array.isArray(value) || t !== 'object') return fallback;
  const o = value as Record<string, unknown>;
  const nested = o.name ?? o.email ?? o.label ?? o.title ?? o.message ?? o.code;
  if (nested != null && nested !== value) return asText(nested, fallback);
  return fallback;
}

function toDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return toDateOnly(o.date ?? o.value ?? o.submittedDate ?? o.requiredDate ?? null);
  }
  const raw = asText(value).trim();
  if (!raw) return null;
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  // en-IN datetime: "05/08/2026, 10:30:00 am" or "05/08/2026"
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

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
  const hours = Math.max(0, (new Date(end).getTime() - new Date(startDate).getTime()) / 3600000);

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

  // Instant stages (e.g. Submitted) complete the same day — treat as on time.
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

function resolveRawStatus(pr: Record<string, unknown>): string {
  const raw = asText(pr.statusRaw);
  if (raw && raw === raw.toUpperCase() && raw.includes('_')) return raw;
  const status = asText(pr.status);
  if (status && status === status.toUpperCase() && status.includes('_')) return status;
  // Map frontend / UI labels back when raw status was stripped
  const frontend = asText(pr.statusFrontend || pr.status).toLowerCase();
  const ui = asText(pr.statusUI).toLowerCase();
  if (frontend === 'draft' || status === 'draft') return 'DRAFT';
  if (frontend === 'returned' || ui.includes('return')) return 'RETURNED';
  if (frontend === 'rejected' || ui.includes('reject')) return 'REJECTED';
  if (frontend === 'approved' || ui === 'approved') return 'APPROVED';
  if (ui.includes('hod')) return 'PENDING_HOD_APPROVAL';
  if (ui.includes('l2') || ui.includes('pr manager') || ui.includes('manager review')) {
    return ui.includes('rfq') || ui.includes('vendor')
      ? 'PENDING_RFQ_L2_APPROVAL'
      : 'PENDING_PR_MANAGER_APPROVAL';
  }
  if (ui.includes('cfo')) {
    return ui.includes('rfq') ? 'PENDING_RFQ_CFO_APPROVAL' : 'PENDING_CFO_APPROVAL';
  }
  if (ui.includes('scm manager') || ui.includes('business')) return 'PENDING_BUSINESS_APPROVAL';
  if (ui.includes('scm po') || ui.includes('po creation')) return 'PENDING_SCM_PO';
  if (frontend === 'pending_approval' || ui.includes('pending')) return 'PENDING_HOD_APPROVAL';
  return status || 'PENDING_HOD_APPROVAL';
}

function mapTrackStatus(rawStatus: string, statusFrontend: string): string {
  if (statusFrontend === 'draft' || rawStatus === 'DRAFT') return 'draft';
  if (statusFrontend === 'returned' || rawStatus === 'RETURNED') return 'returned';
  if (statusFrontend === 'rejected' || rawStatus === 'REJECTED') return 'rejected';
  if (statusFrontend === 'po_issued') return 'po_issued';
  if (rawStatus === 'APPROVED' && statusFrontend === 'approved') return 'approved';
  if (rawStatus === 'APPROVED') return 'po_issued';
  if (statusFrontend === 'approved') return 'approved';
  return 'pending_approval';
}

function personName(person: unknown, fallback = ''): string {
  if (typeof person === 'string' || typeof person === 'number') {
    const s = String(person).trim();
    return s || fallback;
  }
  return asText(person, fallback).trim() || fallback;
}

function normalizeTimelineStageName(stageName: string): string {
  const raw = asText(stageName).replace(/_/g, ' ').trim();
  const s = raw.toLowerCase();
  if (!s) return 'Approval';
  if (s.includes('pr submitted') || s === 'submitted') return 'Submitted';
  if ((s.includes('hod') || s.includes('l1')) && !s.includes('vendor')) return 'L1 Manager Approval';
  if ((s.includes('pr manager') || s.includes('l2')) && !s.includes('vendor') && !s.includes('rfq')) {
    return 'L2 Manager Approval';
  }
  if (s.includes('mugesh') && s.includes('invoice')) return 'Mugesh Invoice Upload';
  if (s.includes('mugesh') || s.includes('cfo')) {
    if (s.includes('post') || s.includes('vendor') || s.includes('rfq')) return 'Mugesh Approval';
    return 'Mugesh Approval';
  }
  if (s.includes('vendor final') && (s.includes('hod') || s.includes('l1') || s.includes('manager'))) {
    return 'L1 Vendor Final';
  }
  if (s.includes('vendor final') && (s.includes('l2') || s.includes('pr manager'))) {
    return 'L2 Manager Approval';
  }
  if (
    s.includes('scm buyer vendor') ||
    s.includes('scm vendor selection') ||
    (s.includes('vendor selection') && s.includes('scm')) ||
    s.includes('rfq scm buyer')
  ) {
    return 'SCM Vendor Selection';
  }
  if (
    s.includes('scm manager') ||
    s.includes('business review') ||
    (s.includes('vendor approval') && s.includes('scm'))
  ) {
    return 'SCM Manager Approval';
  }
  if (
    s.includes('scm po') ||
    s.includes('create po') ||
    s.includes('po create') ||
    s.includes('po created')
  ) {
    return 'PO Create';
  }
  if (s.includes('po issued') || s.includes('po signed')) return 'PO Create';
  return raw;
}

function currentStageLabel(rawStatus: string, statusUI: string): string | null {
  if (rawStatus === 'PENDING_HOD_APPROVAL') return 'L1 Manager Approval';
  if (rawStatus === 'PENDING_PR_MANAGER_APPROVAL') return 'L2 Manager Approval';
  if (rawStatus === 'PENDING_CFO_APPROVAL') return 'Mugesh Approval';
  if (rawStatus === 'PENDING_RFQ_MANAGER_APPROVAL') return 'L1 Vendor Final';
  if (rawStatus === 'PENDING_RFQ_L2_APPROVAL') return 'L2 Manager Approval';
  if (rawStatus === 'PENDING_RFQ_CFO_APPROVAL') return 'Mugesh Approval';
  if (rawStatus === 'AWAITING_INVOICE') return 'Mugesh Invoice Upload';
  if (rawStatus === 'PENDING_SCM_PO') return 'PO Create';
  if (rawStatus === 'PENDING_BUSINESS_APPROVAL') return 'SCM Manager Approval';
  if (rawStatus === 'RETURNED') return 'Returned for Rework';
  if (rawStatus === 'REJECTED') return 'Rejected';
  if (rawStatus === 'APPROVED') return 'PO Create';
  if (rawStatus === 'DRAFT') return null;
  return statusUI ? normalizeTimelineStageName(statusUI) : null;
}

function approverForCurrentStage(pr: Record<string, unknown>, rawStatus: string): string {
  const current = personName(pr.currentApprover);
  if (current) return current;
  if (
    rawStatus === 'PENDING_HOD_APPROVAL' ||
    rawStatus === 'PENDING_RFQ_MANAGER_APPROVAL'
  ) {
    return personName(pr.l1Manager, 'L1 Manager');
  }
  if (rawStatus === 'PENDING_BUSINESS_APPROVAL') {
    return personName(pr.scmManager, 'SCM Manager');
  }
  if (rawStatus === 'PENDING_SCM_PO') {
    return personName(pr.scmBuyer, 'SCM Buyer');
  }
  return '—';
}

function stageNameMatches(stage: string, patterns: string[]): boolean {
  const s = stage.toLowerCase();
  return patterns.some((p) => s.includes(p));
}

function findTimelineStage(stages: TimelineStage[], patterns: string[]): TimelineStage | undefined {
  return [...stages].reverse().find((s) => stageNameMatches(s.stage, patterns));
}

/** Ensure SCM Vendor Selection → SCM Manager Approval → PO Create appear on the timeline. */
function ensureScmPipelineStages(
  stages: TimelineStage[],
  pr: Record<string, unknown>,
  rawStatus: string,
  prevDate: string | null
): TimelineStage[] {
  const purchaseType = asText(pr.purchaseType || pr.purchase_type, '').toLowerCase();
  // SASS never involves SCM / RFQ — vendor is set on Create PR
  if (purchaseType === 'sass' || purchaseType === 'saas' || purchaseType === 'cloud_subscription') {
    return stages;
  }
  const vendorSelection = asText(pr.vendorSelection, 'scm').toLowerCase();
  const scmBuyerName = personName(pr.scmBuyer, 'SCM Buyer');
  const scmManagerName = personName(pr.scmManager, 'SCM Manager');
  const hasPurchaseOrder = Boolean(pr.hasPurchaseOrder || pr.poNumber);
  const rfqFinalized =
    Boolean(pr.rfqFinalized) ||
    Boolean(
      findTimelineStage(stages, ['scm vendor selection', 'scm buyer vendor', 'vendor selection'])
    );
  const terminal = ['REJECTED', 'RETURNED', 'DRAFT'].includes(rawStatus);
  if (terminal) return stages;

  const inScmStatuses =
    rawStatus === 'PENDING_BUSINESS_APPROVAL' || rawStatus === 'PENDING_SCM_PO';
  const scmPathApprovedWaiting =
    rawStatus === 'APPROVED' && vendorSelection === 'scm';
  const ownPathAtPo =
    vendorSelection === 'own' && (rawStatus === 'PENDING_SCM_PO' || hasPurchaseOrder);
  const historyHasScm = stages.some((s) =>
    /scm|po create|vendor selection/i.test(s.stage)
  );

  if (!inScmStatuses && !scmPathApprovedWaiting && !ownPathAtPo && !historyHasScm && !hasPurchaseOrder) {
    return stages;
  }

  // Own path skips SCM Manager Approval unless history already has it
  const includeManagerApproval =
    vendorSelection !== 'own' ||
    Boolean(findTimelineStage(stages, ['scm manager'])) ||
    rawStatus === 'PENDING_BUSINESS_APPROVAL';

  type PipeStep = {
    name: string;
    patterns: string[];
    defaultApprover: string;
  };

  const pipeline: PipeStep[] = [
    {
      name: 'SCM Vendor Selection',
      patterns: ['scm vendor selection', 'scm buyer vendor', 'vendor selection'],
      defaultApprover: scmBuyerName,
    },
  ];
  if (includeManagerApproval) {
    pipeline.push({
      name: 'SCM Manager Approval',
      patterns: ['scm manager'],
      defaultApprover: scmManagerName,
    });
  }
  pipeline.push({
    name: 'PO Create',
    patterns: ['po create', 'scm po', 'po issued', 'po created'],
    defaultApprover: scmBuyerName,
  });

  /** Which step is current: index into pipeline, or -1 none, or pipeline.length all done */
  let currentIdx = -1;
  if (hasPurchaseOrder || (rawStatus === 'APPROVED' && rfqFinalized && hasPurchaseOrder)) {
    currentIdx = pipeline.length; // all completed
  } else if (hasPurchaseOrder) {
    currentIdx = pipeline.length;
  } else if (rawStatus === 'PENDING_SCM_PO') {
    currentIdx = pipeline.findIndex((s) => s.name === 'PO Create');
  } else if (rawStatus === 'PENDING_BUSINESS_APPROVAL') {
    currentIdx = pipeline.findIndex((s) => s.name === 'SCM Manager Approval');
  } else if (rawStatus === 'APPROVED' && vendorSelection === 'scm' && !rfqFinalized) {
    currentIdx = 0; // waiting for SCM Vendor Selection / RFQ
  } else if (rawStatus === 'APPROVED' && rfqFinalized && !hasPurchaseOrder) {
    currentIdx = pipeline.findIndex((s) => s.name === 'PO Create');
  } else if (hasPurchaseOrder) {
    currentIdx = pipeline.length;
  }

  // If PO exists but history never recorded SCM steps, still mark full pipeline complete
  if (hasPurchaseOrder) currentIdx = pipeline.length;

  let lastDate = prevDate;
  for (let i = 0; i < pipeline.length; i++) {
    const step = pipeline[i];
    const existing = findTimelineStage(stages, step.patterns);

    let status: StageStatus = 'pending';
    if (currentIdx >= pipeline.length || i < currentIdx) status = 'completed';
    else if (i === currentIdx) status = 'current';
    else status = 'pending';

    if (existing) {
      existing.stage = step.name;
      if (
        existing.status === 'rejected' ||
        existing.status === 'returned'
      ) {
        lastDate = existing.date || lastDate;
        continue;
      }
      // Prefer completed from history when already done
      if (existing.status === 'completed' && status === 'pending') {
        status = 'completed';
      }
      existing.status = status;
      if (!existing.approver || existing.approver === '—' || existing.approver === 'Approver') {
        existing.approver = step.defaultApprover;
      }
      existing.sla = computeSla(
        status === 'pending' ? null : lastDate || existing.date || null,
        status === 'completed' ? existing.date || lastDate : null,
        status
      );
      if (status === 'completed') lastDate = existing.date || lastDate;
      continue;
    }

    const date = status === 'completed' ? lastDate || toDateOnly(pr.submittedDate) || '' : '';
    stages.push({
      stage: step.name,
      date,
      approver: step.defaultApprover,
      status,
      sla: computeSla(
        status === 'pending' ? null : lastDate,
        status === 'completed' ? date || lastDate : null,
        status
      ),
    });
    if (status === 'completed') lastDate = date || lastDate;
  }

  // Drop legacy "PO Issued" and duplicate SCM pipeline labels
  const scmKeys = new Set([
    'scm vendor selection',
    'scm manager approval',
    'po create',
  ]);
  const seenScm = new Set<string>();
  return stages.filter((s) => {
    const key = s.stage.toLowerCase();
    if (key.includes('po issued')) return false;
    if (!scmKeys.has(key)) return true;
    if (seenScm.has(key)) return false;
    seenScm.add(key);
    return true;
  });
}

function buildTimeline(pr: Record<string, unknown>): TimelineStage[] {
  const stages: TimelineStage[] = [];
  const submittedDate =
    toDateOnly(pr.submittedDate) || toDateOnly(pr.date) || toDateOnly(pr.createdAt);
  const requester = asText(pr.requester, 'Requester');
  const rawStatus = resolveRawStatus(pr);
  const history = Array.isArray(pr.approvalHistory)
    ? (pr.approvalHistory as Array<Record<string, unknown>>)
    : [];

  const isDraft = rawStatus === 'DRAFT';
  stages.push({
    stage: 'Submitted',
    date: submittedDate || '',
    approver: requester,
    status: isDraft ? 'pending' : 'completed',
    sla: computeSla(
      submittedDate,
      submittedDate,
      isDraft ? 'pending' : 'completed'
    ),
  });

  let prevDate = submittedDate;
  for (const h of history) {
    const action = asText(h.status || h.action).toLowerCase();
    let stageName = normalizeTimelineStageName(asText(h.stage, 'Approval'));
    if (stageName === 'Submitted' && (action === 'completed' || action === 'submitted' || action === 'resubmitted')) {
      const histDate = toDateOnly(h.date || h.timestamp);
      if (histDate && stages[0]) {
        stages[0].date = histDate;
        stages[0].status = 'completed';
        stages[0].approver = asText(h.user || h.approver, requester);
        stages[0].sla = computeSla(histDate, histDate, 'completed');
        prevDate = histDate;
      }
      continue;
    }
    if (action === 'submitted' || action === 'resubmitted') continue;

    const dateOnly = toDateOnly(h.date || h.timestamp) || prevDate;
    let stageStatus: StageStatus = 'completed';
    if (action.includes('reject')) stageStatus = 'rejected';
    else if (action.includes('return') || action.includes('rework')) stageStatus = 'returned';

    // Avoid duplicate consecutive same stage labels
    const last = stages[stages.length - 1];
    if (
      last &&
      last.stage === stageName &&
      last.status === 'completed' &&
      stageStatus === 'completed'
    ) {
      last.date = dateOnly || last.date;
      last.approver = asText(h.user || h.approver, last.approver);
      if (h.remarks) last.remarks = asText(h.remarks);
      prevDate = dateOnly || prevDate;
      continue;
    }

    stages.push({
      stage: stageName,
      date: dateOnly || '',
      approver: asText(h.user || h.approver, 'Approver'),
      status: stageStatus,
      remarks: asText(h.remarks),
      sla: computeSla(prevDate || dateOnly, dateOnly, stageStatus),
    });
    prevDate = dateOnly || prevDate;
  }

  const currentLabel = currentStageLabel(rawStatus, asText(pr.statusUI));
  const terminal = ['APPROVED', 'REJECTED', 'RETURNED', 'DRAFT'].includes(rawStatus);
  const scmCurrent =
    rawStatus === 'PENDING_BUSINESS_APPROVAL' ||
    rawStatus === 'PENDING_SCM_PO';

  if (currentLabel && !terminal && !scmCurrent) {
    const already = stages.some(
      (s) =>
        s.stage.toLowerCase() === currentLabel.toLowerCase() &&
        (s.status === 'current' || s.status === 'completed')
    );
    const currentApprover = approverForCurrentStage(pr, rawStatus);
    if (!already) {
      stages.push({
        stage: currentLabel,
        date: '',
        approver: currentApprover,
        status: 'current',
        sla: computeSla(prevDate || submittedDate, null, 'current'),
      });
    } else {
      const match = [...stages].reverse().find(
        (s) => s.stage.toLowerCase() === currentLabel.toLowerCase() && s.status !== 'completed'
      );
      if (match && match.status !== 'current') {
        match.status = 'current';
        match.approver = currentApprover || match.approver;
        match.sla = computeSla(prevDate || submittedDate, null, 'current');
      }
    }
  }

  return ensureScmPipelineStages(stages, pr, rawStatus, prevDate || submittedDate);
}

function mapApiPr(pr: Record<string, unknown>): TrackPR {
  const lineItems = Array.isArray(pr.lineItems) ? pr.lineItems : [];
  const statusFrontend = asText(pr.statusFrontend || pr.status);
  const rawStatus = resolveRawStatus(pr);
  const history = Array.isArray(pr.approvalHistory) ? pr.approvalHistory : [];
  const returnEntry = history.find((h) => {
    const s = asText(
      (h as Record<string, unknown>).status || (h as Record<string, unknown>).action
    ).toLowerCase();
    return s.includes('return') || s.includes('reject') || s.includes('rework');
  }) as Record<string, unknown> | undefined;

  const submittedDate =
    toDateOnly(pr.submittedDate) || toDateOnly(pr.date) || toDateOnly(pr.createdAt) || '';
  const prId = Number(pr.prId ?? pr.id);
  const prNumber = asText(pr.prNumber) || (Number.isNaN(prId) ? asText(pr.id) : '') || asText(pr.id);
  const attachments = (Array.isArray(pr.attachments) ? pr.attachments : [])
    .map((raw) => {
      const a = raw as Record<string, unknown>;
      return {
        id: Number(a.id),
        prId: a.prId != null ? Number(a.prId) : prId,
        fileName: asText(a.fileName || a.file_name),
        size: Number(a.size || a.fileSize || 0),
        mimeType: asText(a.mimeType || a.mime_type) || undefined,
        uploadedAt: asText(a.uploadedAt || a.uploaded_at) || undefined,
      } as PrAttachmentRecord;
    })
    .filter((f) => f.id > 0 && f.fileName);

  const rawSassInvoice =
    pr.sassInvoice && typeof pr.sassInvoice === 'object'
      ? (pr.sassInvoice as Record<string, unknown>)
      : null;
  const sassInvoice = rawSassInvoice
    ? {
        id: Number(rawSassInvoice.id) || 0,
        invoiceNumber: asText(rawSassInvoice.invoiceNumber) || null,
        fileName: asText(rawSassInvoice.fileName) || null,
        hasFile: Boolean(rawSassInvoice.hasFile || rawSassInvoice.fileName),
        status: asText(rawSassInvoice.status) || null,
      }
    : null;

  return {
    key: Number.isNaN(prId) ? prNumber : String(prId),
    prId: Number.isNaN(prId) ? 0 : prId,
    id: prNumber,
    title: asText(pr.title),
    requestType: asText(pr.requestType),
    requestCategory: asText(pr.requestCategory),
    projectDetail: asText(pr.projectDetail),
    specialNotes: asText(pr.specialNotes),
    department: asText(pr.department),
    amount: Number(pr.totalAmount ?? pr.amount ?? 0),
    status: mapTrackStatus(rawStatus, statusFrontend),
    statusRaw: rawStatus,
    statusUI: asText(pr.statusUI, statusFrontend),
    submittedDate,
    priority: asText(pr.priorityLower || pr.priority, 'medium').toLowerCase(),
    requiredDate: asText(pr.requiredDate, '—'),
    justification: asText(pr.justification, 'No justification provided.'),
    lineItems: lineItems.map((li) => {
      const item = li as Record<string, unknown>;
      return {
        description: asText(item.description || item.item, '—'),
        category: asText(item.category, '—'),
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unitCost ?? item.unitPrice ?? 0),
        total: Number(item.total || 0),
      };
    }),
    approvalHistory: buildTimeline({ ...pr, statusRaw: rawStatus, submittedDate }),
    returnReason: returnEntry
      ? asText(returnEntry.remarks)
      : undefined,
    poId: pr.poId != null ? Number(pr.poId) : null,
    poNumber: asText(pr.poNumber),
    poDocumentAvailable: Boolean(pr.poDocumentAvailable),
    poSentBack: Boolean(pr.poSentBack),
    purchaseType: asText(pr.purchaseType || pr.purchase_type),
    attachments,
    sassInvoice: sassInvoice?.id ? sassInvoice : null,
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

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;
const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';
const softLabel = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';
const softInput =
  'h-11 w-full rounded-2xl border border-transparent bg-white px-3.5 text-sm text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] outline-none focus:border-[#90CAF9] focus:ring-2 focus:ring-[#1E88E5]/15';
const midCell =
  'border border-x-0 border-transparent bg-white px-3 py-4 align-middle transition-[border-color] sm:py-5';

export default function TrackPRPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const isSuperAdmin = Boolean(user?.isSuperAdmin || user?.role === 'Super Admin');
  const [rows, setRows] = useState<TrackPR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [requestTypeFilter, setRequestTypeFilter] = useState<RequestTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandTab, setExpandTab] = useState<'overview' | 'documents'>('overview');
  const [expandLoadingKey, setExpandLoadingKey] = useState<string | null>(null);
  const [detailedKeys, setDetailedKeys] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [meta, setMeta] = useState<RequesterPrListMeta>({
    page: 1,
    pageSize: itemsPerPage,
    total: 0,
    totalPages: 1,
  });
  const [sendBackModal, setSendBackModal] = useState<{
    prId: number;
    prNumber: string;
    title: string;
  } | null>(null);
  const [sendBackTargets, setSendBackTargets] = useState<{ key: string; label: string }[]>([]);
  const [sendBackReturnTo, setSendBackReturnTo] = useState('');
  const [sendBackRemarks, setSendBackRemarks] = useState('');
  const [sendBackLoading, setSendBackLoading] = useState(false);
  const [sendBackError, setSendBackError] = useState('');
  const [toast, setToast] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const openAdminSendBack = async (pr: TrackPR) => {
    setSendBackModal({ prId: pr.prId, prNumber: pr.id, title: pr.title });
    setSendBackRemarks('');
    setSendBackError('');
    setSendBackReturnTo('');
    setSendBackTargets([]);
    setSendBackLoading(true);
    try {
      const res = await prApi.sendBackTargets(pr.prId, { admin: true });
      const list = res.data || [];
      setSendBackTargets(list);
      setSendBackReturnTo(list[0]?.key || '');
    } catch (err) {
      setSendBackError(err instanceof Error ? err.message : 'Failed to load stages');
    } finally {
      setSendBackLoading(false);
    }
  };

  const confirmAdminSendBack = async () => {
    if (!sendBackModal) return;
    if (!sendBackReturnTo) {
      setSendBackError('Select a stage to send back to');
      return;
    }
    if (!sendBackRemarks.trim()) {
      setSendBackError('Remarks are required');
      return;
    }
    setSendBackLoading(true);
    setSendBackError('');
    try {
      const res = await prApi.adminSendBack(sendBackModal.prId, {
        returnTo: sendBackReturnTo,
        remarks: sendBackRemarks.trim(),
      });
      setToast(res.message || 'PR sent back successfully');
      setSendBackModal(null);
      await load();
      setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setSendBackError(err instanceof Error ? err.message : 'Send back failed');
    } finally {
      setSendBackLoading(false);
    }
  };

  const handleAdminDeletePr = async (pr: TrackPR) => {
    if (!isSuperAdmin || !pr.prId) return;
    const ok = window.confirm(
      `Delete ${pr.prNumber || 'this PR'}?\n\nThis permanently removes the purchase request, RFQ, quotes, and any linked POs. This cannot be undone.`
    );
    if (!ok) return;
    setDeletingId(pr.prId);
    setError('');
    try {
      const res = await prApi.adminDelete(pr.prId);
      setToast(res.message || `${pr.prNumber} deleted`);
      setTimeout(() => setToast(''), 3500);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete PR');
    } finally {
      setDeletingId(null);
    }
  };

  const isDraftTrackPr = (pr: TrackPR) =>
    pr.status === 'draft' || asText(pr.statusRaw).toUpperCase() === 'DRAFT';

  const handleDeleteDraft = async (pr: TrackPR) => {
    if (user?.role !== 'Requester' || !pr.prId || !isDraftTrackPr(pr)) return;
    const ok = window.confirm(
      `Delete draft ${pr.prNumber || pr.id}?\n\nThis permanently removes the draft. This cannot be undone.`
    );
    if (!ok) return;
    setDeletingId(pr.prId);
    setError('');
    try {
      const res = await prApi.deleteDraft(pr.prId);
      setToast(res.message || 'Draft deleted');
      setTimeout(() => setToast(''), 3500);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete draft');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, requestTypeFilter, debouncedSearch, dateFrom, dateTo]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await prApi.list({
        page: currentPage,
        pageSize: itemsPerPage,
        search: debouncedSearch || undefined,
        status: statusFilter,
        requestType: requestTypeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        scope: 'requester',
        involvedOnly: true,
      });
      const list = (res.data as Array<Record<string, unknown>>) || [];
      setRows(list.map(mapApiPr));
      setDetailedKeys(new Set());
      setExpandedRow(null);
      if (res.meta) setMeta(res.meta);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase requests');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, requestTypeFilter, debouncedSearch, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const paginatedData = rows;
  const totalPages = meta.totalPages || 1;

  const toggleRow = async (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(id);
    setExpandTab('overview');
    const row = rows.find((r) => r.key === id);
    if (!row?.prId || detailedKeys.has(id)) return;

    setExpandLoadingKey(id);
    try {
      const res = await prApi.get(row.prId);
      const detailed = mapApiPr(res.data as Record<string, unknown>);
      setRows((prev) => prev.map((r) => (r.key === id ? { ...detailed, key: r.key } : r)));
      setDetailedKeys((prev) => new Set(prev).add(id));
    } catch {
      // keep lean row if detail fails
    } finally {
      setExpandLoadingKey(null);
    }
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

  const statusChips: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'pending_approval', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'returned', label: 'Returned' },
    { id: 'po_issued', label: 'PO Issued' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <DashboardLayout>
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-xl bg-[#1E88E5] px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="space-y-5 p-2 pb-6 sm:p-4 lg:p-6">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-0 sm:pb-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">
              Track Purchase Requisitions
            </h1>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500 sm:text-sm">
              PRs you requested, approved, or were involved in — with SLA tracking (1 day per stage)
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/requester/create-pr?new=1')}
            className={PM_BTN_PRIMARY}
          >
            <i className="ri-add-line text-lg"></i>
            Create New PR
          </button>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</div>
        )}

        <div className={`${softCard} p-4 sm:p-5`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  type="text"
                  placeholder="Search by PR number or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${softInput} pl-10`}
                />
              </div>
              <select
                value={requestTypeFilter}
                onChange={(e) => setRequestTypeFilter(e.target.value as RequestTypeFilter)}
                className={`${softInput} w-auto min-w-[150px] cursor-pointer`}
              >
                <option value="all">All Types</option>
                <option value="Capex">Capex</option>
                <option value="Opex">Opex</option>
                <option value="Service">Service</option>
              </select>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                From
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={`${softInput} w-auto cursor-pointer`}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                To
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={`${softInput} w-auto cursor-pointer`}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setRequestTypeFilter('all');
                  setSearchQuery('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="h-11 cursor-pointer whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]"
              >
                Clear filters
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`h-10 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                    statusFilter === chip.id
                      ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100/80 pt-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-800">{meta.total}</span> results
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span> On Time
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500"></span> SLA Breached
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400"></span> In Progress
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-300"></span> Not Started
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={`${softCard} overflow-x-clip`}>
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          {loading ? (
            <div className="relative z-[1] px-6 py-12 text-center text-sm text-slate-500">
              <i className="ri-loader-4-line mr-2 animate-spin text-lg text-[#1E88E5]"></i>
              Loading your purchase requests...
            </div>
          ) : (
            <>
              <div className="relative z-[1] overflow-x-auto px-0 pb-3 pt-1">
                <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        PR Number
                      </th>
                      <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Title
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Type
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Amount
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Status
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        SLA
                      </th>
                      <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Submitted
                      </th>
                      <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((pr) => {
                      const { breached, onTime, currentBreach } = getSLASummary(pr.approvalHistory);
                      const totalActioned = breached + onTime;
                      const open = expandedRow === pr.key;
                      const rowBorder = open
                        ? 'border-[#90CAF9]'
                        : 'border-transparent group-hover:border-[#90CAF9]';
                      const rowShadow = open
                        ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
                        : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
                      return (
                        <Fragment key={pr.key}>
                          <tr className="group cursor-pointer" onClick={() => toggleRow(pr.key)}>
                            <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                              <div
                                className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}
                              >
                                <button
                                  type="button"
                                  className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                                    open
                                      ? 'bg-[#1E88E5] text-white'
                                      : 'bg-[#E3F2FD] text-[#1E88E5] hover:bg-[#BBDEFB]'
                                  }`}
                                  aria-expanded={open}
                                  aria-label={open ? 'Collapse details' : 'Expand details'}
                                >
                                  <i className={`ri-arrow-${open ? 'down' : 'right'}-s-line text-base`}></i>
                                </button>
                                <span className="text-sm font-bold text-[#1E88E5]">{pr.id}</span>
                              </div>
                            </td>
                            <td
                              className={`w-[240px] max-w-[240px] ${midCell} ${rowBorder}`}
                              title={pr.title}
                            >
                              <p className="truncate text-sm font-semibold text-[#2C3E50]">{pr.title}</p>
                              <div className="mt-0.5 flex min-w-0 items-center gap-2">
                                <p className="truncate text-xs text-slate-500">{pr.department}</p>
                                <PriorityBadge priority={pr.priority} />
                              </div>
                            </td>
                            <td className={`whitespace-nowrap ${midCell} ${rowBorder}`}>
                              <span className="inline-flex rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[11px] font-semibold text-[#1E88E5]">
                                {pr.requestType}
                              </span>
                            </td>
                            <td className={`whitespace-nowrap ${midCell} text-sm font-bold tabular-nums text-[#2C3E50] ${rowBorder}`}>
                              {formatCurrency(pr.amount)}
                            </td>
                            <td className={`whitespace-nowrap ${midCell} ${rowBorder}`}>
                              <StatusBadge status={pr.statusUI || pr.status} size="sm" />
                            </td>
                            <td className={`whitespace-nowrap ${midCell} ${rowBorder}`}>
                              {totalActioned === 0 && !currentBreach ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  {breached > 0 && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                      <i className="ri-alarm-warning-fill text-xs"></i> {breached} Breached
                                    </span>
                                  )}
                                  {currentBreach && breached === 0 && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                      <i className="ri-alarm-warning-fill text-xs"></i> Overdue
                                    </span>
                                  )}
                                  {breached === 0 && !currentBreach && onTime > 0 && (
                                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                      <i className="ri-checkbox-circle-fill text-xs"></i> On Track
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`whitespace-nowrap ${midCell} text-sm text-slate-500 ${rowBorder}`}>
                              {pr.submittedDate || '—'}
                            </td>
                            <td
                              className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 transition-[border-color,box-shadow] sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                                <button
                                  type="button"
                                  onClick={() => toggleRow(pr.key)}
                                  className="cursor-pointer rounded-xl bg-[#1E88E5] p-2 text-white transition-colors hover:bg-[#1565C0]"
                                  title={open ? 'Hide details' : 'View details'}
                                >
                                  <i className="ri-eye-line"></i>
                                </button>
                                {(isAdminEditor ||
                                  pr.status === 'draft' ||
                                  pr.status === 'returned' ||
                                  ['PENDING_HOD_APPROVAL', 'PENDING_PR_MANAGER_APPROVAL', 'PENDING_CFO_APPROVAL'].includes(
                                    asText(pr.statusRaw).toUpperCase()
                                  )) && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/requester/edit-pr/${pr.prId}`)}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                  >
                                    <i className="ri-edit-line"></i>
                                    Edit
                                  </button>
                                )}
                                {isAdminEditor && pr.status !== 'draft' && (
                                  <button
                                    type="button"
                                    onClick={() => void openAdminSendBack(pr)}
                                    className="cursor-pointer whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                                    title="Send PR back to any workflow step"
                                  >
                                    Send Back
                                  </button>
                                )}
                                {user?.role === 'Requester' && isDraftTrackPr(pr) && (
                                  <button
                                    type="button"
                                    disabled={deletingId === pr.prId}
                                    onClick={() => void handleDeleteDraft(pr)}
                                    className="cursor-pointer whitespace-nowrap rounded-xl bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] hover:bg-rose-100 disabled:opacity-50"
                                    title="Delete this draft"
                                  >
                                    {deletingId === pr.prId ? 'Deleting…' : 'Delete'}
                                  </button>
                                )}
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    disabled={deletingId === pr.prId}
                                    onClick={() => void handleAdminDeletePr(pr)}
                                    className="cursor-pointer whitespace-nowrap rounded-xl bg-[#FFE4E6] px-2.5 py-1.5 text-xs font-semibold text-[#F43F5E] hover:bg-rose-100 disabled:opacity-50"
                                    title="Permanently delete this purchase request"
                                  >
                                    {deletingId === pr.prId ? 'Deleting…' : 'Delete'}
                                  </button>
                                )}
                                {isAdminEditor &&
                                  pr.status !== 'draft' &&
                                  String(pr.purchaseType || '').toLowerCase() !== 'sass' &&
                                  String(pr.purchaseType || '').toLowerCase() !== 'saas' &&
                                  String(pr.purchaseType || '')
                                    .toLowerCase()
                                    .replace(/[\s-]+/g, '_') !== 'cloud_subscription' && (
                                  <button
                                    onClick={() =>
                                      navigate(
                                        user?.role === 'Requester'
                                          ? `/requester/rfq-entry/${pr.prId}`
                                          : `/scm/rfq-entry/${pr.prId}`
                                      )
                                    }
                                    className="cursor-pointer whitespace-nowrap rounded-xl border border-transparent bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E88E5] shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]"
                                    title="Edit RFQ amounts and quotation files"
                                  >
                                    Edit RFQ
                                  </button>
                                )}
                                {String(pr.purchaseType || '').toLowerCase() !== 'sass' &&
                                  String(pr.purchaseType || '').toLowerCase() !== 'saas' &&
                                  String(pr.purchaseType || '')
                                    .toLowerCase()
                                    .replace(/[\s-]+/g, '_') !== 'cloud_subscription' &&
                                  pr.poDocumentAvailable &&
                                  pr.poId ? (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/requester/po-document?poId=${pr.poId}`)}
                                    className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl bg-[#1E88E5] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                                    title={`View PO ${pr.poNumber || ''}`.trim()}
                                  >
                                    <i className="ri-file-pdf-2-line" />
                                    PO Document
                                  </button>
                                ) : String(pr.purchaseType || '').toLowerCase() !== 'sass' &&
                                  String(pr.purchaseType || '').toLowerCase() !== 'saas' &&
                                  String(pr.purchaseType || '')
                                    .toLowerCase()
                                    .replace(/[\s-]+/g, '_') !== 'cloud_subscription' &&
                                  pr.poId ? (
                                  <span
                                    className="whitespace-nowrap rounded-xl bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                                    title="PO document available after SCM Buyer final verification"
                                  >
                                    {pr.statusUI || 'PO in progress'}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>

                          {expandedRow === pr.key && (
                            <tr>
                              <td colSpan={8} className="max-w-0 bg-transparent p-0">
                                {expandLoadingKey === pr.key && (
                                  <div className="px-4 py-2 text-xs text-slate-500">Loading PR details…</div>
                                )}
                                <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
                                  <div className="relative z-[1]">
                                  {(() => {
                                    const prDocCount = pr.attachments?.length || 0;
                                    const hasSassInvoice = Boolean(pr.sassInvoice?.hasFile && pr.sassInvoice?.id);
                                    const docCount = prDocCount + (hasSassInvoice ? 1 : 0);
                                    const showDocumentsTab = docCount > 0;
                                    const activeTab =
                                      showDocumentsTab && expandTab === 'documents'
                                        ? 'documents'
                                        : 'overview';
                                    return (
                                      <>
                                        {showDocumentsTab ? (
                                          <div className="mb-4 flex flex-wrap gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setExpandTab('overview')}
                                              className={`h-10 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all ${
                                                activeTab === 'overview'
                                                  ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                                                  : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                                              }`}
                                            >
                                              <i className="ri-information-line mr-1"></i>
                                              Overview
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setExpandTab('documents')}
                                              className={`h-10 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all ${
                                                activeTab === 'documents'
                                                  ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                                                  : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                                              }`}
                                            >
                                              <i className="ri-file-list-3-line mr-1"></i>
                                              Documents ({docCount})
                                            </button>
                                          </div>
                                        ) : null}

                                        {activeTab === 'documents' && showDocumentsTab ? (
                                          <div className="space-y-4">
                                            {hasSassInvoice && pr.sassInvoice ? (
                                              <div className="bg-white rounded-lg border border-[#90CAF9] p-4">
                                                <div className="flex items-start gap-3 mb-3">
                                                  <div className="w-10 h-10 rounded-lg bg-[#E3F2FD] flex items-center justify-center shrink-0">
                                                    <i className="ri-file-invoice-line text-xl text-[#1E88E5]"></i>
                                                  </div>
                                                  <div className="min-w-0">
                                                    <h4 className="text-sm font-semibold text-gray-900">
                                                      Cloud Subscription Invoice
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                      Uploaded by Mugesh after L2 approval
                                                      {pr.sassInvoice.invoiceNumber
                                                        ? ` · ${pr.sassInvoice.invoiceNumber}`
                                                        : ''}
                                                    </p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                                                  <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                                                    <i className="ri-file-pdf-line text-[#1E88E5]"></i>
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                      {pr.sassInvoice.fileName || `Invoice-${pr.sassInvoice.id}`}
                                                    </p>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      void accountsApi
                                                        .downloadInvoiceFile(
                                                          pr.sassInvoice!.id,
                                                          pr.sassInvoice!.fileName || undefined
                                                        )
                                                        .catch((err) => {
                                                          setToast(
                                                            err instanceof Error
                                                              ? err.message
                                                              : 'Could not open invoice file'
                                                          );
                                                          window.setTimeout(() => setToast(''), 4000);
                                                        });
                                                    }}
                                                    className="px-3 py-1.5 border border-[#90CAF9] text-[#1565C0] bg-white rounded-lg text-xs font-semibold hover:bg-[#E3F2FD] whitespace-nowrap"
                                                  >
                                                    Open
                                                  </button>
                                                </div>
                                              </div>
                                            ) : null}
                                            {prDocCount > 0 ? (
                                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                <PrDocumentsPanel
                                                  prId={pr.prId}
                                                  attachments={pr.attachments}
                                                />
                                              </div>
                                            ) : null}
                                          </div>
                                        ) : (
                                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    <div className="lg:col-span-2 space-y-4">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {[
                                          ['PR Number', pr.id],
                                          ['Department', pr.department || '—'],
                                          ['Request Type', pr.requestType || '—'],
                                          ['Request Category', pr.requestCategory || '—'],
                                          ['Required Date', pr.requiredDate || '—'],
                                          ['Total Amount', formatCurrency(pr.amount)],
                                        ].map(([label, value]) => (
                                          <div key={label} className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                                            <div className="pointer-events-none absolute inset-0" style={softWash} />
                                            <div className="relative z-[1]">
                                              <p className={softLabel}>{label}</p>
                                              <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{value}</p>
                                            </div>
                                          </div>
                                        ))}
                                        <div className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:col-span-2">
                                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                                          <div className="relative z-[1]">
                                            <p className={softLabel}>Project Detail</p>
                                            <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{pr.projectDetail || '—'}</p>
                                          </div>
                                        </div>
                                        <div className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                                          <div className="relative z-[1]">
                                            <p className={softLabel}>Priority</p>
                                            <div className="mt-1.5"><PriorityBadge priority={pr.priority} /></div>
                                          </div>
                                        </div>
                                        <div className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:col-span-2">
                                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                                          <div className="relative z-[1]">
                                            <p className={softLabel}>Business Justification</p>
                                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{pr.justification || '—'}</p>
                                          </div>
                                        </div>
                                        <div className="relative overflow-hidden rounded-2xl bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:col-span-2">
                                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                                          <div className="relative z-[1]">
                                            <p className={softLabel}>Special Notes</p>
                                            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{pr.specialNotes || '—'}</p>
                                          </div>
                                        </div>
                                      </div>

                                      {(String(pr.purchaseType || '').toLowerCase() === 'sass' ||
                                        String(pr.purchaseType || '').toLowerCase() === 'saas' ||
                                        String(pr.purchaseType || '')
                                          .toLowerCase()
                                          .replace(/[\s-]+/g, '_') === 'cloud_subscription') &&
                                        pr.prId && (
                                          <CloudSubscriptionPanel
                                            prId={Number(pr.prId)}
                                            sassInvoice={pr.sassInvoice || null}
                                          />
                                        )}

                                      <div>
                                        <h3 className={`${softLabel} mb-2 px-0.5`}>
                                          Line Items ({pr.lineItems.length})
                                        </h3>
                                        {pr.lineItems.length === 0 ? (
                                          <p className="text-xs text-slate-500">No line items</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {pr.lineItems.map((item, idx) => (
                                              <div
                                                key={idx}
                                                className="relative flex items-start justify-between overflow-hidden rounded-2xl bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]"
                                              >
                                                <div className="pointer-events-none absolute inset-0" style={softWash} />
                                                <div className="relative z-[1] min-w-0 flex-1">
                                                  <p className="text-sm font-semibold text-[#2C3E50]">
                                                    {item.description}
                                                  </p>
                                                  <p className="mt-0.5 text-xs text-slate-500">
                                                    {item.category} · {item.quantity} units
                                                  </p>
                                                </div>
                                                <div className="relative z-[1] ml-3 text-right">
                                                  <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
                                                    {formatCurrency(item.total)}
                                                  </p>
                                                  <p className="text-xs text-slate-400">
                                                    @{formatCurrency(item.unitCost)}
                                                  </p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {(pr.status === 'returned' || pr.status === 'rejected' || pr.poSentBack) &&
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
                                      <div className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] sm:p-5">
                                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                                        <div className="relative z-[1] mb-5 flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <h3 className="text-sm font-semibold text-[#2C3E50]">
                                              Approval Workflow & SLA Tracking
                                            </h3>
                                            <p className="mt-0.5 text-xs text-slate-400">
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

                                        <div className="relative z-[1] space-y-0">
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
                                                    className={`rounded-2xl border p-3.5 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.12)] ${
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
                                                      </div>
                                                      <SLABadge status={sla.slaStatus} />
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                                      <div>
                                                        <p className="text-gray-400 mb-0.5">
                                                          Approver
                                                        </p>
                                                        <p
                                                          className={`font-medium ${
                                                            stage.status === 'pending' &&
                                                            (!stage.approver || stage.approver === '—')
                                                              ? 'text-gray-400'
                                                              : 'text-gray-700'
                                                          }`}
                                                        >
                                                          {stage.approver || '—'}
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
                                        )}
                                      </>
                                    );
                                  })()}
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
                <div className="relative z-[1] flex flex-col gap-3 border-t border-slate-100/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`flex h-8 min-w-[2rem] cursor-pointer items-center justify-center rounded-xl text-xs font-semibold ${
                          currentPage === page
                            ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                            : 'border border-transparent bg-white text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9]'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="cursor-pointer rounded-xl border border-transparent bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:border-[#90CAF9] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {!loading && paginatedData.length === 0 && (
                <div className="relative z-[1] px-6 py-12 text-center">
                  <i className="ri-file-list-3-line mb-4 text-5xl text-slate-200"></i>
                  <h3 className="mb-1 text-sm font-medium text-slate-800">
                    No purchase requisitions found for you
                  </h3>
                  <p className="text-sm text-slate-500">
                    Only PRs you requested, approved, or were involved in are shown here
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {sendBackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-arrow-go-back-line text-orange-600"></i>
              Admin Send Back
            </h3>
            <p className="text-sm text-gray-600 mt-1 break-words">
              <span className="font-semibold text-gray-900">{sendBackModal.prNumber}</span>
              {' — '}
              {sendBackModal.title}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Admin: send to any step — Edit PR, RFQ Entry, approvals, Requester Create PO, Mugesh Sign &amp; Upload, or Buyer Final Verify.
            </p>

            <label className="block text-xs font-semibold text-gray-700 mt-4 mb-1">
              Send back to
            </label>
            <select
              value={sendBackReturnTo}
              onChange={(e) => setSendBackReturnTo(e.target.value)}
              disabled={sendBackLoading || !sendBackTargets.length}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {!sendBackTargets.length && <option value="">No stages available</option>}
              {sendBackTargets.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="block text-xs font-semibold text-gray-700 mt-3 mb-1">
              Remarks <span className="text-red-500">*</span>
            </label>
            <textarea
              value={sendBackRemarks}
              onChange={(e) => setSendBackRemarks(e.target.value)}
              rows={3}
              placeholder="Why is this PR being sent back?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y"
            />

            {sendBackError && (
              <p className="mt-2 text-sm text-red-600">{sendBackError}</p>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSendBackModal(null)}
                disabled={sendBackLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmAdminSendBack()}
                disabled={sendBackLoading || !sendBackReturnTo}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                {sendBackLoading ? 'Sending…' : 'Confirm Send Back'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
