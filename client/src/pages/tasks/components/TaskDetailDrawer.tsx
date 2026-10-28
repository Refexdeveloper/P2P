import PriorityBadge from '../../../components/base/PriorityBadge';
import StatusBadge from '../../../components/base/StatusBadge';
import { formatDisplayDate, formatDisplayDateTime } from '../../../utils/formatDate';
import PrVendorQuotationsPanel from '../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../components/feature/ApprovalHistoryPanel';
import { formatMoney } from '../../../constants/currency';
import { formatPersonRoleSuffix } from '../../../utils/roleDisplay';
import { prApi } from '../../../services/api';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import '../../../styles/drawer-fx.css';

interface LineItem {
  itemName?: string;
  description: string;
  qty: number;
  unit: string;
  unitCost: number;
  total: number;
}

interface VendorQuoteRound {
  submissionId?: number;
  round: number;
  quotedPrice: number;
  leadTime?: number | null;
  paymentTerms?: string;
  quotationFileName?: string;
}

interface VendorQuoteVendor {
  invitationId: number;
  vendorName: string;
  isRecommended?: boolean;
  recommendationJustification?: string;
  rounds: VendorQuoteRound[];
}

interface ApprovalStep {
  step: string;
  approver: string;
  role: string;
  date: string;
  status: string;
  remarks: string;
}

interface PRTask {
  id: string;
  prId?: number;
  prNumber: string;
  title: string;
  requester: string;
  requesterEmail?: string;
  requesterRole: string;
  requesterAvatar: string;
  department: string;
  entityName?: string;
  entityCode?: string;
  entityCostCenter?: string;
  requestType: string;
  requestCategory?: string;
  projectDetail?: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  specialNotes?: string;
  category: string;
  priority: string;
  status: string;
  statusUI?: string;
  totalAmount: number;
  currency: string;
  submittedDate: string;
  requiredDate: string;
  currentApprover: string;
  /** Real pending-task owner (name + role), separate from stage label in currentApprover */
  currentStepOwner?: { name?: string; role?: string } | null;
  justification: string;
  sendBackRemarks?: string;
  vendorSelection?: 'own' | 'scm';
  purchaseType?: string;
  isSass?: boolean;
  requireInvoiceUpload?: boolean;
  isSassInvoiceUpload?: boolean;
  isMugeshSign?: boolean;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  placeOfDelivery?: string;
  deliveryPoc?: string;
  vendorQuoteRounds?: VendorQuoteVendor[];
  lineItems: LineItem[];
  attachments?: Array<{ id: number; fileName: string; size?: number }>;
  approvalHistory: ApprovalStep[];
  slaHours: number;
  slaRemaining: number;
  isOverdue: boolean;
}

interface TaskDetailDrawerProps {
  task: PRTask;
  loading?: boolean;
  /** When set, controls Approve / Send Back / Reject independently of PR/task status labels. */
  canAct?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReturn: (id: string) => void;
}

const CLOSED_STATUSES = new Set(['approved', 'rejected', 'returned']);

type DrawerTab = 'details' | 'items' | 'quotes' | 'history';

const TAB_ICON: Record<DrawerTab, string> = {
  details: 'ri-file-info-line',
  items: 'ri-list-check-3',
  quotes: 'ri-price-tag-3-line',
  history: 'ri-history-line',
};

/** Duration of the slide-out animation before the parent unmounts the drawer. */
const EXIT_MS = 280;

function Field({
  label,
  icon,
  index,
  wide = false,
  children,
}: {
  label: string;
  icon: string;
  index: number;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`dfx-field${wide ? ' sm:col-span-2' : ''}`}
      style={{ '--i': index } as CSSProperties}
    >
      <span className="dfx-field-ic">
        <i className={icon} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="dfx-label">{label}</p>
        <div className="dfx-value">{children}</div>
      </div>
    </div>
  );
}

function historyTone(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('current') || s === 'pending' || s.includes('await')) {
    return { tone: 'blue', icon: 'ri-user-follow-line' };
  }
  if (s.includes('reject')) return { tone: 'red', icon: 'ri-close-line' };
  if (s.includes('return') || s.includes('rework')) return { tone: 'orange', icon: 'ri-arrow-go-back-line' };
  if (s.includes('approv') || s.includes('complet') || s.includes('submit'))
    return { tone: 'green', icon: 'ri-check-line' };
  return { tone: 'teal', icon: 'ri-time-line' };
}

function canShowActions(status: string, canAct?: boolean) {
  if (typeof canAct === 'boolean') return canAct;
  const s = String(status || '').toLowerCase();
  if (CLOSED_STATUSES.has(s)) return false;
  if (s === 'pending_approval' || s === 'pending') return true;
  if (s.includes('pending')) return true;
  return !CLOSED_STATUSES.has(s);
}

export default function TaskDetailDrawer({
  task,
  loading = false,
  canAct,
  onClose,
  onApprove,
  onReject,
  onReturn,
}: TaskDetailDrawerProps) {
  const status = String(task.status || '').toLowerCase();
  const showActions = canShowActions(status, canAct);
  const lineItems = Array.isArray(task.lineItems) ? task.lineItems : [];
  const pastHistory = collapsePrAdminEditHistory(
    (Array.isArray(task.approvalHistory) ? task.approvalHistory : []).map((step) => ({
      stage: step.step,
      step: step.step,
      approver: step.approver,
      role: step.role,
      date: step.date,
      status: step.status,
      remarks: step.remarks,
    }))
  );
  const showCurrentStep =
    showActions ||
    String(task.status || '')
      .toLowerCase()
      .includes('pending');
  const stepLabel =
    String(task.statusUI || task.currentApprover || '').trim() ||
    String(task.status || 'Current step')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const ownerName = String(task.currentStepOwner?.name || '').trim();
  const ownerRole = String(task.currentStepOwner?.role || '').trim();
  const currentStepEntry = showCurrentStep
    ? {
        stage: stepLabel,
        step: stepLabel,
        approver: ownerName || 'Awaiting assignment',
        role: ownerRole,
        date: 'Now',
        status: 'current',
        remarks: String(task.sendBackRemarks || '').trim()
          ? String(task.sendBackRemarks).trim()
          : ownerName
            ? `Current step — waiting on ${ownerName}`
            : 'Current step — waiting for the assigned owner',
        isCurrent: true as const,
      }
    : null;
  const approvalHistory = currentStepEntry ? [currentStepEntry, ...pastHistory] : pastHistory;
  const [hasQuotes, setHasQuotes] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [filePreview, setFilePreview] = useState<{
    url: string;
    fileName: string;
    kind: 'pdf' | 'image' | 'other';
  } | null>(null);
  const [openingFileId, setOpeningFileId] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [attachments, setAttachments] = useState(
    () => (Array.isArray(task.attachments) ? task.attachments.filter((file) => file?.id && file.fileName) : [])
  );
  const [closing, setClosing] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);
  const isOwnVendor = task.vendorSelection === 'own';

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
    setPreviewError('');
    setFilePreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setAttachments(
      Array.isArray(task.attachments) ? task.attachments.filter((file) => file?.id && file.fileName) : []
    );
  }, [task.id, task.attachments]);

  // If the task payload had no FSD list yet, load it from the PR.
  useEffect(() => {
    const prId = Number(task.prId) || 0;
    if (!prId || attachments.length > 0) return;
    let cancelled = false;
    void prApi
      .get(prId)
      .then((res) => {
        if (cancelled) return;
        const list = (res.data as { attachments?: Array<{ id: number; fileName: string; size?: number }> })
          ?.attachments;
        if (!Array.isArray(list)) return;
        setAttachments(
          list.filter((file) => Number(file?.id) > 0 && String(file?.fileName || '').trim())
        );
      })
      .catch(() => {
        /* keep empty */
      });
    return () => {
      cancelled = true;
    };
  }, [task.prId, task.id, attachments.length]);

  const isSass =
    Boolean(task.isSass) ||
    ['sass', 'saas', 'cloud_subscription'].includes(
      String(task.purchaseType || '')
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
    );
  const isOnlinePurchase = ['online_purchase', 'onlinepurchase', 'op'].includes(
    String(task.purchaseType || '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );
  const isInvoiceFlow = isSass || isOnlinePurchase;
  /** Own Vendor / quoted PRs: show name, description, qty — hide unit cost & total.
   *  Cloud Subscription keeps full line pricing + quotation files. */
  const hideLinePricing = !isInvoiceFlow && (isOwnVendor || hasQuotes);

  const formatDate = (dateStr: string) => formatDisplayDate(dateStr);
  const formatDateTime = (dateStr: string) => formatDisplayDateTime(dateStr);

  const savedQuoteVendors = Array.isArray(task.vendorQuoteRounds) ? task.vendorQuoteRounds : [];
  const showQuotesTab = Boolean(task.prId) && (isSass || isOwnVendor || hasQuotes || savedQuoteVendors.length > 0);
  const showItemsTab = isInvoiceFlow || !hasQuotes;


  const tabs: { id: DrawerTab; label: string; count?: number }[] = [
    { id: 'details', label: 'Details' },
    ...(showItemsTab ? [{ id: 'items' as const, label: 'Line Items', count: lineItems.length }] : []),
    ...(showQuotesTab ? [{ id: 'quotes' as const, label: 'Quotations' }] : []),
    {
      id: 'history',
      label: 'History',
      count: approvalHistory.length > 0 ? approvalHistory.length : undefined,
    },
  ];
  const tabKey = tabs.map((t) => t.id).join('|');

  // Slide the active-tab pill under whichever tab is selected.
  useLayoutEffect(() => {
    const root = tabsRef.current;
    if (!root) return;
    const measure = () => {
      const btn = root.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
      if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [activeTab, tabKey, task.id, loading]);

  const money = (n: number) =>
    formatMoney(Number(n || 0), task.currency, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const openAttachment = async (file: { id: number; fileName: string }) => {
    const prId = Number(task.prId) || 0;
    if (!prId) return;
    setOpeningFileId(file.id);
    setPreviewError('');
    try {
      const token = localStorage.getItem('p2p_token');
      const res = await fetch(prApi.attachmentFileUrl(prId, file.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text();
        let message = `Could not open ${file.fileName}`;
        try {
          message = (JSON.parse(text) as { message?: string }).message || message;
        } catch {
          /* keep fallback */
        }
        throw new Error(message);
      }
      const raw = await res.blob();
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      const name = file.fileName.toLowerCase();
      const kind = raw.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)
        ? 'image'
        : raw.type.includes('pdf') || name.endsWith('.pdf')
          ? 'pdf'
          : 'other';
      // Chrome blanks iframe previews when the blob mime is octet-stream.
      const typed =
        kind === 'pdf' && !raw.type.includes('pdf')
          ? new Blob([raw], { type: 'application/pdf' })
          : kind === 'image' && !raw.type.startsWith('image/')
            ? new Blob([raw], {
                type: name.endsWith('.png')
                  ? 'image/png'
                  : name.endsWith('.webp')
                    ? 'image/webp'
                    : name.endsWith('.gif')
                      ? 'image/gif'
                      : 'image/jpeg',
              })
            : raw;
      setFilePreview({ url: URL.createObjectURL(typed), fileName: file.fileName, kind });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : `Could not open ${file.fileName}`);
    } finally {
      setOpeningFileId(null);
    }
  };

  return (
    <div className={`dfx-root fixed inset-0 z-40 flex justify-end${closing ? ' is-closing' : ''}`}>
      <div className="dfx-overlay absolute inset-0" onClick={requestClose} />
      <aside className="dfx-panel relative flex h-full w-full max-w-2xl flex-col overflow-hidden">
        {/* Hero header */}
        <header className="dfx-hero dfx-hero--plain relative shrink-0 px-3 pb-3 pt-3 sm:px-7 sm:pb-5 sm:pt-5">
          <div className="dfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <div className="relative z-[1] flex items-start gap-3">
            <div className="dfx-hero-ic">
              <i className="ri-file-list-3-line" aria-hidden />
            </div>
            <div className="dfx-hero-text min-w-0 flex-1">
              <span className="dfx-prno">{task.prNumber}</span>
              <h3 className="dfx-title is-clamp" title={task.title}>
                {task.title}
              </h3>
              <div className="dfx-badges mt-2 flex flex-wrap items-center gap-1.5">
                {isOnlinePurchase && <span className="dfx-pill">ONLINE PURCHASE</span>}
                {isSass && !isOnlinePurchase && <span className="dfx-pill">CLOUD SUBSCRIPTION</span>}
                {task.requestType ? <span className="dfx-pill">{task.requestType}</span> : null}
                <StatusBadge status={task.status} size="sm" />
                <PriorityBadge priority={(task.priority || 'medium').toLowerCase()} size="sm" />
              </div>
              {isOnlinePurchase && (
                <p className="dfx-path">
                  Online Purchase path: User Approval → Mugesh L1 → Srivaths L2 → Mugesh Invoice Upload →
                  Completed (SCM skipped)
                </p>
              )}
              {isSass && !isOnlinePurchase && (
                <p className="dfx-path">
                  {String(task.requesterEmail || task.requester || '')
                    .toLowerCase()
                    .includes('mugesh')
                    ? 'Cloud Subscription path: L1 → Mugesh Invoice Upload → Accounts (Mugesh self-approval & Srivaths L2 skipped; SCM skipped)'
                    : 'Cloud Subscription path: L1 → Mugesh → Srivaths (L2; skipped if L1 was Srivaths) → Mugesh Invoice → Accounts (SCM skipped)'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" onClick={requestClose} className="dfx-close" aria-label="Close">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>

          <div className="dfx-stats relative z-[1] mt-5 grid grid-cols-3 gap-2.5">
            <div className="dfx-stat" style={{ '--i': 0 } as CSSProperties}>
              <span className="dfx-stat-ic">
                <i className="ri-bank-card-line" aria-hidden />
              </span>
              <div className="min-w-0">
                <small>Total Amount</small>
                <b className="tabular-nums">{money(task.totalAmount)}</b>
              </div>
            </div>
            <div className="dfx-stat" style={{ '--i': 1 } as CSSProperties}>
              <span className="dfx-stat-ic">
                <i className="ri-box-3-line" aria-hidden />
              </span>
              <div className="min-w-0">
                <small>Line Items</small>
                <b>{lineItems.length}</b>
              </div>
            </div>
            <div className="dfx-stat" style={{ '--i': 2 } as CSSProperties}>
              <span className="dfx-stat-ic">
                <i className="ri-price-tag-3-line" aria-hidden />
              </span>
              <div className="min-w-0">
                <small>Request Type</small>
                <b className="truncate" title={task.requestType || undefined}>
                  {task.requestType || '—'}
                </b>
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="dfx-body min-h-0 flex-1 overflow-y-auto">
            <div className="dfx-loading">
              <i className="ri-loader-4-line animate-spin"></i>
              <p className="mt-3 text-sm">Loading PR details…</p>
            </div>
          </div>
        ) : (
          <>
            <div className="dfx-tabs-wrap shrink-0 px-2 sm:px-7">
              <div ref={tabsRef} className="dfx-tabs" role="tablist">
                <span
                  className="dfx-tab-ind"
                  style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
                />
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-tab={tab.id}
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`dfx-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  >
                    <i className={TAB_ICON[tab.id]} aria-hidden />
                    {tab.label}
                    {tab.count !== undefined && <span className="dfx-tab-cnt">{tab.count}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="dfx-body min-h-0 flex-1 overflow-y-auto">
              <div className="dfx-pane space-y-3 px-3 py-3 sm:space-y-4 sm:px-7 sm:py-5">
                {activeTab === 'details' && (
                  <div key="details" className="space-y-4">
                    {String(task.sendBackRemarks || '').trim() ? (
                      <div className="rounded-xl border-2 border-orange-400 bg-orange-50 px-4 py-3 ring-2 ring-orange-200/70">
                        <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-orange-800">
                          <i className="ri-arrow-go-back-line" aria-hidden />
                          Sent back to this step
                        </p>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-orange-950">
                          {String(task.sendBackRemarks).trim()}
                        </p>
                      </div>
                    ) : null}
                    <div className="dfx-field" style={{ '--i': 0 } as CSSProperties}>
                      <span className="dfx-avatar">{task.requesterAvatar || 'R'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="dfx-label">Requested By</p>
                        <div className="dfx-value">{task.requester}</div>
                        <p className="dfx-sub">
                          {task.requesterRole} &middot; {task.department || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="PR Title" icon="ri-text" index={1} wide>
                        {task.title || '—'}
                      </Field>
                      <Field label="Entity" icon="ri-building-2-line" index={1} wide>
                        {task.entityName || '—'}
                        {task.entityCode ? <span className="dfx-code ml-2">{task.entityCode}</span> : null}
                        {task.entityCostCenter ? (
                          <p className="dfx-sub">Cost Center: {task.entityCostCenter}</p>
                        ) : null}
                      </Field>
                      <Field label="Department" icon="ri-team-line" index={2}>
                        {task.department || '—'}
                      </Field>
                      <Field label="Request Type" icon="ri-price-tag-3-line" index={3}>
                        {task.requestType || '—'}
                      </Field>
                      <Field label="Request Category" icon="ri-folder-3-line" index={4}>
                        {task.requestCategory || task.category || '—'}
                      </Field>
                      <Field label="Payment Terms" icon="ri-bank-card-line" index={5}>
                        {task.paymentTerms || '—'}
                      </Field>
                      <Field label="Project Detail" icon="ri-briefcase-4-line" index={6} wide>
                        {task.projectDetail || '—'}
                      </Field>
                      <Field label="Required Date" icon="ri-calendar-event-line" index={7}>
                        {formatDate(task.requiredDate)}
                      </Field>
                      <Field label="Expected Delivery" icon="ri-truck-line" index={8}>
                        {task.expectedDeliveryTimeline || '—'}
                      </Field>
                      <Field label="Total Amount" icon="ri-money-rupee-circle-line" index={9}>
                        <span className="tabular-nums">{money(task.totalAmount)}</span>
                      </Field>
                      <Field label="Current Stage" icon="ri-flag-2-line" index={10}>
                        {task.currentApprover || '—'}
                      </Field>
                      <Field label="Submitted Date" icon="ri-send-plane-line" index={11}>
                        {formatDate(task.submittedDate)}
                      </Field>
                      <Field label="Place of Delivery" icon="ri-map-2-line" index={12}>
                        {task.placeOfDelivery || '—'}
                      </Field>
                      <Field label="Billing Region / GST" icon="ri-map-pin-line" index={13} wide>
                        {task.billingLocation || '—'}
                        {task.billingGstNo ? (
                          <span className="dfx-code ml-2 font-mono">{task.billingGstNo}</span>
                        ) : null}
                      </Field>
                      <Field label="Billing Address" icon="ri-home-office-line" index={14} wide>
                        <span className="whitespace-pre-wrap">{task.billingAddress || '—'}</span>
                      </Field>
                      <Field label="POC for Delivery" icon="ri-contacts-line" index={15} wide>
                        <span className="whitespace-pre-wrap">{task.deliveryPoc || '—'}</span>
                      </Field>
                    </div>

                    <div className="dfx-note" style={{ '--i': 16 } as CSSProperties}>
                      <p className="dfx-label">
                        <i className="ri-lightbulb-flash-line mr-1" /> Business Justification
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {task.justification || '—'}
                      </p>
                    </div>
                    <div className="dfx-note" style={{ '--i': 17 } as CSSProperties}>
                      <p className="dfx-label">
                        <i className="ri-sticky-note-line mr-1" /> Special Notes
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {task.specialNotes || '—'}
                      </p>
                    </div>

                    {(attachments.length > 0 || previewError) && (
                      <div>
                        <p className="dfx-label mb-2 px-0.5">FSD / PR documents</p>
                        {previewError ? (
                          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            {previewError}
                          </div>
                        ) : null}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {attachments.map((file, i) => (
                            <button
                              key={file.id}
                              type="button"
                              disabled={openingFileId === file.id}
                              onClick={() => void openAttachment(file)}
                              className="dfx-file"
                              style={{ '--i': 18 + i } as CSSProperties}
                            >
                              <span className="dfx-file-ic">
                                {(file.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800">
                                {openingFileId === file.id ? 'Opening…' : file.fileName}
                              </span>
                              <i className="ri-eye-line text-[#0f6b7a]" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {savedQuoteVendors.length > 0 && !hasQuotes && (
                      <div className="space-y-3">
                        <p className="dfx-label px-0.5">Vendor quotations</p>
                        {savedQuoteVendors.map((vendor, vi) => (
                          <div
                            key={vendor.invitationId}
                            className="dfx-quote"
                            style={{ '--i': 18 + vi } as CSSProperties}
                          >
                            <div className="dfx-quote-head">
                              <p className="min-w-0 truncate text-sm font-semibold text-slate-800">
                                {vendor.vendorName}
                              </p>
                              {vendor.isRecommended ? <span className="dfx-pill">RECOMMENDED</span> : null}
                            </div>
                            {[...vendor.rounds]
                              .sort((a, b) => Number(a.round) - Number(b.round))
                              .map((quote, quoteIndex) => (
                                <div
                                  key={`${vendor.invitationId}-${quote.submissionId || quote.round}-${quoteIndex}`}
                                  className="dfx-quote-row"
                                >
                                  <span className="dfx-item-no">Q{Number(quote.round) || 1}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold tabular-nums text-slate-900">
                                      {formatMoney(Number(quote.quotedPrice) || 0, task.currency)}
                                    </p>
                                    <p className="mt-0.5 text-xs text-slate-500">
                                      {[
                                        quote.leadTime != null ? `${quote.leadTime} days` : '',
                                        quote.paymentTerms || '',
                                      ]
                                        .filter(Boolean)
                                        .join(' · ') || 'Quoted'}
                                    </p>
                                    {quote.quotationFileName ? (
                                      <p className="mt-1 truncate text-xs font-medium text-[#0f6b7a]">
                                        {quote.quotationFileName}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {showQuotesTab && (
                      <button type="button" onClick={() => setActiveTab('quotes')} className="dfx-cta-card">
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            View vendor quotations
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Prices, rounds, and quotation files on this PR
                          </span>
                        </span>
                        <i className="ri-arrow-right-line text-lg text-[#0f6b7a]" />
                      </button>
                    )}
                  </div>
                )}

                {task.prId ? (
                  <div className={activeTab === 'quotes' || activeTab === 'details' ? 'mt-2' : 'hidden'}>
                    <PrVendorQuotationsPanel
                      prId={task.prId}
                      currency={task.currency}
                      onPresenceChange={setHasQuotes}
                    />
                  </div>
                ) : null}

                {activeTab === 'items' && showItemsTab && (
                  <div key="items" className="space-y-2.5">
                    {lineItems.length === 0 ? (
                      <div className="dfx-empty">
                        <i className="ri-list-check-3" />
                        <p>No line items</p>
                      </div>
                    ) : (
                      lineItems.map((item, idx) => {
                        const name = String(item.itemName || item.description || '—').trim() || '—';
                        const desc = String(item.description || '').trim();
                        const showDesc = desc && desc !== name;
                        const unitLabel =
                          item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? item.unit : '';
                        return (
                          <div key={idx} className="dfx-item" style={{ '--i': idx } as CSSProperties}>
                            <span className="dfx-item-no">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold text-slate-800">{name}</p>
                              {showDesc ? (
                                <p className="mt-0.5 break-words text-xs text-slate-500">{desc}</p>
                              ) : null}
                              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="dfx-code">
                                  Qty {Number(item.qty) || 0}
                                  {unitLabel ? ` ${unitLabel}` : ''}
                                </span>
                                {!hideLinePricing && <span>× {money(item.unitCost)}</span>}
                              </p>
                            </div>
                            {!hideLinePricing && (
                              <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                                {money(item.total)}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                    {!hideLinePricing && lineItems.length > 0 && (
                      <div className="dfx-total" style={{ '--i': lineItems.length } as CSSProperties}>
                        <span>Grand Total</span>
                        <b className="tabular-nums">{money(task.totalAmount)}</b>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'history' &&
                  (approvalHistory.length === 0 ? (
                    <div className="dfx-empty">
                      <i className="ri-history-line" />
                      <p>No approval history yet</p>
                    </div>
                  ) : (
                    <ol key="history" className="dfx-timeline">
                      {approvalHistory.map((step, idx) => {
                        const t = historyTone(step.status);
                        const isCurrent = Boolean(
                          (step as { isCurrent?: boolean }).isCurrent || step.status === 'current'
                        );
                        return (
                          <li
                            key={`${step.stage}-${step.date}-${idx}`}
                            className={`dfx-tl-item tone-${t.tone}${isCurrent ? ' is-current' : ''}`}
                            style={{ '--i': idx } as CSSProperties}
                          >
                            <span className="dfx-tl-dot">
                              <i className={t.icon} />
                            </span>
                            <div className="dfx-tl-card">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold text-slate-800">
                                    {step.stage || step.step}
                                    {isCurrent ? (
                                      <span className="ml-2 inline-flex align-middle rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1565C0]">
                                        Current
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="break-words text-xs text-slate-500">
                                    {isCurrent ? (
                                      <>
                                        <span className="font-semibold text-slate-700">Owner: </span>
                                        {step.approver}
                                        {formatPersonRoleSuffix(step.role, step.approver)}
                                      </>
                                    ) : (
                                      <>
                                        {step.approver}
                                        {formatPersonRoleSuffix(step.role, step.approver)}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <span className="dfx-tl-date">
                                  {isCurrent ? 'Now' : formatDateTime(step.date)}
                                </span>
                              </div>
                              {step.remarks ? (
                                <p
                                  className={`dfx-tl-remark${
                                    isCurrent && String(task.sendBackRemarks || '').trim()
                                      ? ' mt-2 rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-2 font-semibold text-orange-950'
                                      : ''
                                  }`}
                                >
                                  {step.remarks}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ))}
              </div>
            </div>
          </>
        )}

        {/* Footer — pinned so L1/L2 always see Approve / Send Back / Reject */}
        {showActions && (
          <footer className="dfx-foot is-actions shrink-0 px-3 py-2.5 sm:px-7 sm:py-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => onApprove(task.id)}
              className="dfx-btn primary"
            >
              <i
                className={
                  task.isMugeshSign || task.requireInvoiceUpload || task.isSassInvoiceUpload
                    ? 'ri-file-upload-line'
                    : 'ri-check-double-line'
                }
              ></i>
              {task.isMugeshSign
                ? 'Sign & Upload'
                : task.isSassInvoiceUpload || task.requireInvoiceUpload
                  ? 'Upload Invoice'
                  : 'Approve'}
            </button>
            {!task.isSassInvoiceUpload && !task.isMugeshSign && (
              <div className="dfx-actions">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onReturn(task.id)}
                  className="dfx-btn warn"
                >
                  <i className="ri-arrow-go-back-line"></i> Send Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onReject(task.id)}
                  className="dfx-btn danger"
                >
                  <i className="ri-close-circle-line"></i> Reject
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>
      {filePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <span className="truncate font-semibold text-slate-800">{filePreview.fileName}</span>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={filePreview.url}
                  download={filePreview.fileName}
                  className="flex h-9 items-center gap-1 rounded-xl px-2.5 text-sm font-semibold text-[#0f6b7a] hover:bg-[#e6f6f8]"
                >
                  <i className="ri-download-2-line" />
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(filePreview.url);
                    setFilePreview(null);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <i className="ri-close-line text-lg" />
                </button>
              </div>
            </div>
            {attachments.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-2">
                {attachments.map((file) => {
                  const active = file.fileName === filePreview.fileName;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        if (!active) void openAttachment(file);
                      }}
                      className={`max-w-[220px] shrink-0 truncate rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold ${
                        active ? 'bg-[#0f6b7a] text-white' : 'bg-[#e6f6f8] text-[#0f6b7a]'
                      }`}
                      title={file.fileName}
                    >
                      {file.fileName}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="flex-1 overflow-auto bg-[#F8FAFC] p-4">
              {filePreview.kind === 'image' ? (
                <img src={filePreview.url} alt="" className="mx-auto max-h-[70vh] max-w-full object-contain" />
              ) : filePreview.kind === 'pdf' ? (
                <iframe title={filePreview.fileName} src={filePreview.url} className="h-[70vh] w-full rounded-xl border-0 bg-white" />
              ) : (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-600">Preview is not available for this file type.</p>
                  <a
                    href={filePreview.url}
                    download={filePreview.fileName}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#e6f6f8] px-3 py-2 text-sm font-semibold text-[#0f6b7a]"
                  >
                    <i className="ri-download-2-line" />
                    Download {filePreview.fileName}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
