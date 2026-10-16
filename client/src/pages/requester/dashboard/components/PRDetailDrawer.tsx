import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../../../../components/base/StatusBadge';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import { prApi } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PrVendorQuotationsPanel from '../../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../../components/feature/ApprovalHistoryPanel';
import { formatPersonRoleSuffix } from '../../../../utils/roleDisplay';
import '../../../../styles/drawer-fx.css';

const ADMIN_EDIT_ROLES = [
  'Super Admin',
  'SCM Manager',
  'SCM Buyer',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

const REQUESTER_EDITABLE_STATUSES = new Set([
  'DRAFT',
  'RETURNED',
  'PENDING_HOD_APPROVAL',
  'PENDING_PR_MANAGER_APPROVAL',
  'PENDING_CFO_APPROVAL',
]);

function canRequesterEditPr(pr: { status?: string; statusFrontend?: string } | null) {
  if (!pr) return false;
  const raw = String(pr.status || '').toUpperCase();
  const front = String(pr.statusFrontend || pr.status || '').toLowerCase();
  return REQUESTER_EDITABLE_STATUSES.has(raw) || front === 'draft' || front === 'returned';
}

interface LineItem {
  id?: number;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface ApprovalHistoryItem {
  stage: string;
  user: string;
  role: string;
  date: string;
  status: string;
  remarks: string;
}

export interface PRDetail {
  id: number;
  prNumber: string;
  title: string;
  requestType: string;
  requestCategory?: string;
  projectDetail?: string;
  specialNotes?: string;
  department: string;
  entityId?: number | null;
  entityName?: string;
  entityCode?: string;
  entityCostCenter?: string;
  priority: string;
  justification: string;
  sendBackRemarks?: string;
  billingLocation?: string;
  billingGstNo?: string;
  billingAddress?: string;
  deliveryPoc?: string;
  deliveryPocEmail?: string;
  deliveryPocPhone?: string;
  projectManagerHo?: string;
  projectManagerContact?: string;
  projectManagerEmail?: string;
  placeOfDelivery?: string;
  expectedDeliveryTimeline?: string;
  paymentTerms?: string;
  requiredDate: string;
  totalAmount: number;
  status: string;
  statusFrontend: string;
  statusUI?: string;
  submittedDate: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryItem[];
  currentApprover?: { name?: string; email?: string; role?: string | null } | null;
  currentStage?: string | null;
  attachments?: { id: number; fileName: string; size: number }[];
  poId?: number | null;
  poNumber?: string;
  poDocumentAvailable?: boolean;
}

interface PRDetailDrawerProps {
  pr: PRDetail | null;
  loading: boolean;
  onClose: () => void;
  onDeleteDraft?: (prId: number) => Promise<void>;
  deletingDraft?: boolean;
}


type DrawerTab = 'details' | 'items' | 'quotes' | 'history';

const TAB_META: Record<DrawerTab, { label: string; icon: string }> = {
  details: { label: 'Details', icon: 'ri-file-info-line' },
  items: { label: 'Line Items', icon: 'ri-list-check-3' },
  quotes: { label: 'Quotations', icon: 'ri-price-tag-3-line' },
  history: { label: 'History', icon: 'ri-history-line' },
};

/** Duration of the slide-out animation before the parent unmounts the drawer. */
const EXIT_MS = 280;

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
  if (s.includes('return')) return { tone: 'orange', icon: 'ri-arrow-go-back-line' };
  if (s.includes('approv') || s.includes('complet')) return { tone: 'green', icon: 'ri-check-line' };
  return { tone: 'teal', icon: 'ri-time-line' };
}

const CLOSED_PR_STATUSES = new Set([
  'DRAFT',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'PO_ISSUED',
]);

function isPrAwaitingAction(pr: PRDetail) {
  const raw = String(pr.status || '').toUpperCase();
  if (CLOSED_PR_STATUSES.has(raw) && raw !== 'APPROVED') return false;
  // Approved can still have Create PO / sign tasks — show current if owner known or statusUI pending-like
  const ui = String(pr.statusUI || pr.statusFrontend || '').toLowerCase();
  if (ui.includes('pending') || ui.includes('await') || raw.startsWith('PENDING_')) return true;
  if (raw === 'RETURNED') return true;
  if (raw === 'APPROVED' && pr.currentApprover?.name) return true;
  return Boolean(pr.currentApprover?.name);
}

export default function PRDetailDrawer({
  pr,
  loading,
  onClose,
  onDeleteDraft,
  deletingDraft = false,
}: PRDetailDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DrawerTab>('details');
  const [hasQuotes, setHasQuotes] = useState(false);
  const [closing, setClosing] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
  }, [pr?.id]);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const visibleTabs = (['details', 'items', 'quotes', 'history'] as const).filter(
    (tab) => tab !== 'quotes' || hasQuotes
  );

  // Slide the active-tab pill under whichever tab is selected.
  useLayoutEffect(() => {
    const root = tabsRef.current;
    const btn = root?.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    if (root && btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [activeTab, hasQuotes, pr?.id, loading]);

  if (!pr && !loading) return null;

  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const canEdit = Boolean(pr && (isAdminEditor || canRequesterEditPr(pr)));
  const isReturned =
    pr?.status === 'RETURNED' ||
    pr?.statusFrontend === 'returned' ||
    String(pr?.statusUI || '').toLowerCase().includes('return');
  const isDraft = pr?.status === 'DRAFT' || pr?.statusFrontend === 'draft';

  const pastHistory = pr
    ? collapsePrAdminEditHistory(
        pr.approvalHistory.map((item) => ({
          stage: item.stage,
          user: item.user,
          role: item.role,
          date: item.date,
          status: item.status,
          remarks: item.remarks,
        }))
      )
    : [];

  const currentStepEntry =
    pr && isPrAwaitingAction(pr)
      ? {
          stage: String(pr.statusUI || pr.statusFrontend || pr.currentStage || 'Current step').trim(),
          user: String(pr.currentApprover?.name || pr.currentApprover?.role || 'Awaiting assignment').trim(),
          role: String(pr.currentApprover?.role || '').trim(),
          date: 'Now',
          status: 'current',
          remarks: String(pr.sendBackRemarks || '').trim()
            ? String(pr.sendBackRemarks).trim()
            : pr.currentApprover?.name
              ? `Current step — waiting on ${pr.currentApprover.name}`
              : 'Current step — waiting for the assigned owner',
          isCurrent: true as const,
        }
      : null;

  const history = currentStepEntry ? [currentStepEntry, ...pastHistory] : pastHistory;

  return (
    <div className={`dfx-root fixed inset-0 z-[60] flex justify-end${closing ? ' is-closing' : ''}`}>
      <div className="dfx-overlay absolute inset-0" onClick={requestClose} />
      <aside className="dfx-panel relative flex h-full w-full max-w-2xl flex-col overflow-hidden">
        {/* Hero header */}
        <header className="dfx-hero relative shrink-0 px-5 pb-5 pt-5 sm:px-7">
          <div className="dfx-art" aria-hidden="true" />
          <div className="dfx-bubbles" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <div className="relative z-[1] flex items-start gap-3">
            <div className="dfx-hero-ic">
              <i className="ri-file-list-3-line" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              {pr ? (
                <>
                  <span className="dfx-prno">{pr.prNumber}</span>
                  <h3 className="dfx-title">{pr.title}</h3>
                  <div className="dfx-badges mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={pr.statusUI || pr.statusFrontend} size="sm" />
                    <PriorityBadge priority={pr.priority} size="sm" />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="dfx-skel h-4 w-40" />
                  <div className="dfx-skel h-6 w-64" />
                  <div className="dfx-skel h-5 w-32" />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isDraft && user?.role === 'Requester' && onDeleteDraft && pr && (
                <button
                  type="button"
                  disabled={deletingDraft}
                  onClick={() => void onDeleteDraft(pr.id)}
                  className="dfx-hbtn danger"
                  title={deletingDraft ? 'Deleting…' : 'Delete draft'}
                >
                  <i className="ri-delete-bin-line"></i>
                  <span className="hidden sm:inline">{deletingDraft ? 'Deleting…' : 'Delete'}</span>
                </button>
              )}
              <button type="button" onClick={requestClose} className="dfx-close" aria-label="Close">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
          </div>

          {pr && (
            <div className="dfx-stats relative z-[1] mt-5 grid grid-cols-3 gap-2.5">
              <div className="dfx-stat" style={{ '--i': 0 } as CSSProperties}>
                <span className="dfx-stat-ic">
                  <i className="ri-bank-card-line" aria-hidden />
                </span>
                <div className="min-w-0">
                <small>Total Amount</small>
                <b className="tabular-nums">{inr(pr.totalAmount)}</b>
              </div>
              </div>
              <div className="dfx-stat" style={{ '--i': 1 } as CSSProperties}>
                <span className="dfx-stat-ic">
                  <i className="ri-box-3-line" aria-hidden />
                </span>
                <div className="min-w-0">
                <small>Line Items</small>
                <b>{pr.lineItems.length}</b>
              </div>
              </div>
              <div className="dfx-stat" style={{ '--i': 2 } as CSSProperties}>
                <span className="dfx-stat-ic">
                  <i className="ri-price-tag-3-line" aria-hidden />
                </span>
                <div className="min-w-0">
                <small>Request Type</small>
                <b className="truncate" title={pr.requestType || undefined}>
                  {pr.requestType || '—'}
                </b>
              </div>
              </div>
            </div>
          )}
        </header>

        {pr && (
          <div className="dfx-tabs-wrap shrink-0 px-5 sm:px-7">
            <div ref={tabsRef} className="dfx-tabs" role="tablist">
              <span
                className="dfx-tab-ind"
                style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
              />
              {visibleTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  data-tab={tab}
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`dfx-tab${activeTab === tab ? ' is-active' : ''}`}
                >
                  <i className={TAB_META[tab].icon} aria-hidden />
                  {TAB_META[tab].label}
                  {tab === 'items' && <span className="dfx-tab-cnt">{pr.lineItems.length}</span>}
                  {tab === 'history' && history.length > 0 && (
                    <span className="dfx-tab-cnt">{history.length}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="dfx-body min-h-0 flex-1 overflow-y-auto">
          {!pr && loading && (
            <div className="space-y-3 p-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="dfx-skel h-16 w-full rounded-2xl" />
              ))}
            </div>
          )}

          {pr && (
            <div key={activeTab} className="dfx-pane space-y-4 px-5 py-5 sm:px-7">
              {String(pr.sendBackRemarks || '').trim() ? (
                <div className="rounded-xl border-2 border-orange-400 bg-orange-50 px-4 py-3 ring-2 ring-orange-200/70">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-orange-800">
                    <i className="ri-arrow-go-back-line" aria-hidden />
                    Sent back to this step
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm font-medium leading-relaxed text-orange-950">
                    {String(pr.sendBackRemarks).trim()}
                  </p>
                </div>
              ) : null}
              {isReturned && activeTab === 'details' && (
                <div className="dfx-alert">
                  <span className="dfx-alert-ic">
                    <i className="ri-arrow-go-back-line" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Returned for Rework</p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Review the feedback in approval history, update if needed, then resubmit.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'details' && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Entity" icon="ri-building-2-line" index={0} wide>
                      {pr.entityName || '—'}
                      {pr.entityCode ? <span className="dfx-code ml-2">{pr.entityCode}</span> : null}
                      {pr.entityCostCenter ? (
                        <p className="dfx-sub">Cost Center: {pr.entityCostCenter}</p>
                      ) : null}
                    </Field>
                    <Field label="Department" icon="ri-team-line" index={1}>
                      {pr.department}
                    </Field>
                    <Field label="Request Type" icon="ri-price-tag-3-line" index={2}>
                      {pr.requestType}
                    </Field>
                    <Field label="Request Category" icon="ri-folder-3-line" index={3}>
                      {pr.requestCategory || '—'}
                    </Field>
                    <Field label="Payment Terms" icon="ri-bank-card-line" index={4}>
                      {pr.paymentTerms || '—'}
                    </Field>
                    <Field label="Project Detail" icon="ri-briefcase-4-line" index={5} wide>
                      {pr.projectDetail || '—'}
                    </Field>
                    <Field label="Required Date" icon="ri-calendar-event-line" index={6}>
                      {pr.requiredDate || '—'}
                    </Field>
                    <Field label="Expected Delivery" icon="ri-truck-line" index={7}>
                      {pr.expectedDeliveryTimeline || '—'}
                    </Field>

                    {pr.poDocumentAvailable && pr.poId ? (
                      <div className="dfx-po sm:col-span-2" style={{ '--i': 8 } as CSSProperties}>
                        <div className="min-w-0">
                          <p className="dfx-label !text-white/70">Purchase Order</p>
                          <p className="mt-1 break-words text-sm font-semibold text-white">
                            {pr.poNumber || `PO #${pr.poId}`}
                            {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate(`/requester/po-document?poId=${pr.poId}`)}
                          className="dfx-po-btn"
                        >
                          <i className="ri-file-pdf-2-line" />
                          View PO Document
                        </button>
                      </div>
                    ) : pr.poId ? (
                      <Field label="Purchase Order" icon="ri-file-paper-2-line" index={8} wide>
                        {pr.poNumber || `PO #${pr.poId}`}
                        {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                        <p className="dfx-sub">
                          PO document will be available after SCM Buyer final verification.
                        </p>
                      </Field>
                    ) : null}

                    <Field label="Billing Region / GST" icon="ri-map-pin-line" index={9} wide>
                      {pr.billingLocation || '—'}
                      {pr.billingGstNo ? <span className="dfx-code ml-2 font-mono">{pr.billingGstNo}</span> : null}
                    </Field>
                    <Field label="Billing Address" icon="ri-home-office-line" index={10} wide>
                      <span className="whitespace-pre-wrap">{pr.billingAddress || '—'}</span>
                    </Field>
                    <Field label="POC for Delivery" icon="ri-contacts-line" index={11}>
                      <span className="whitespace-pre-wrap">{pr.deliveryPoc || '—'}</span>
                      {pr.deliveryPocEmail || pr.deliveryPocPhone ? (
                        <p className="dfx-sub">
                          {[pr.deliveryPocPhone, pr.deliveryPocEmail].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                    </Field>
                    <Field label="Project Manager at HO" icon="ri-user-star-line" index={12}>
                      <span className="whitespace-pre-wrap">{pr.projectManagerHo || '—'}</span>
                      {pr.projectManagerEmail || pr.projectManagerContact ? (
                        <p className="dfx-sub">
                          {[pr.projectManagerContact, pr.projectManagerEmail].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                    </Field>
                    <Field label="Place of Delivery" icon="ri-map-2-line" index={13}>
                      {pr.placeOfDelivery || '—'}
                    </Field>
                    <Field label="Submitted Date" icon="ri-send-plane-line" index={14}>
                      {pr.submittedDate || '—'}
                    </Field>
                  </div>

                  <div className="dfx-note" style={{ '--i': 15 } as CSSProperties}>
                    <p className="dfx-label">
                      <i className="ri-lightbulb-flash-line mr-1" /> Business Justification
                    </p>
                    <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
                      {pr.justification || '—'}
                    </p>
                  </div>
                  <div className="dfx-note" style={{ '--i': 16 } as CSSProperties}>
                    <p className="dfx-label">
                      <i className="ri-sticky-note-line mr-1" /> Special Notes
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                      {pr.specialNotes || '—'}
                    </p>
                  </div>

                  {pr.attachments && pr.attachments.length > 0 && (
                    <div>
                      <p className="dfx-label mb-2 px-0.5">Attachments</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {pr.attachments.map((file, i) => (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => prApi.downloadAttachment(pr.id, file.id, file.fileName)}
                            className="dfx-file"
                            style={{ '--i': 17 + i } as CSSProperties}
                          >
                            <span className="dfx-file-ic">
                              {(file.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                              {file.fileName}
                            </span>
                            <i className="ri-download-2-line text-[#0f6b7a]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {hasQuotes && (
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
                </>
              )}

              {activeTab === 'items' && (
                <div className="space-y-2.5">
                  {pr.lineItems.map((item, i) => (
                    <div
                      key={item.id ?? `line-${i}`}
                      className="dfx-item"
                      style={{ '--i': i } as CSSProperties}
                    >
                      <span className="dfx-item-no">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold text-slate-800">
                          {item.description}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {item.category ? <span className="dfx-code">{item.category}</span> : null}
                          <span>
                            {item.quantity} × {inr(item.unitCost)}
                          </span>
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                        {inr(item.total)}
                      </p>
                    </div>
                  ))}
                  <div className="dfx-total" style={{ '--i': pr.lineItems.length } as CSSProperties}>
                    <span>Grand Total</span>
                    <b className="tabular-nums">{inr(pr.totalAmount)}</b>
                  </div>
                </div>
              )}

              {pr.id ? (
                <div className={activeTab === 'quotes' ? '' : 'hidden'}>
                  <PrVendorQuotationsPanel prId={pr.id} onPresenceChange={setHasQuotes} />
                </div>
              ) : null}

              {activeTab === 'history' &&
                (history.length === 0 ? (
                  <div className="dfx-empty">
                    <i className="ri-history-line" />
                    <p>No approval history yet</p>
                  </div>
                ) : (
                  <ol className="dfx-timeline">
                    {history.map((item, index) => {
                      const t = historyTone(item.status);
                      const isCurrent = Boolean(
                        (item as { isCurrent?: boolean }).isCurrent || item.status === 'current'
                      );
                      return (
                        <li
                          key={index}
                          className={`dfx-tl-item tone-${t.tone}${isCurrent ? ' is-current' : ''}`}
                          style={{ '--i': index } as CSSProperties}
                        >
                          <span className="dfx-tl-dot">
                            <i className={t.icon} />
                          </span>
                          <div className="dfx-tl-card">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold text-slate-800">
                                  {item.stage}
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
                                      {item.user}
                                      {formatPersonRoleSuffix(item.role, item.user)}
                                    </>
                                  ) : (
                                    <>
                                      {item.user}
                                      {formatPersonRoleSuffix(item.role, item.user)}
                                    </>
                                  )}
                                </p>
                              </div>
                              <span className="dfx-tl-date">{item.date}</span>
                            </div>
                            {item.remarks && (
                              <p
                                className={`dfx-tl-remark${
                                  isCurrent && String(pr?.sendBackRemarks || '').trim()
                                    ? ' mt-2 rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-2 font-semibold text-orange-950'
                                    : ''
                                }`}
                              >
                                {item.remarks}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ))}
            </div>
          )}
        </div>

        {canEdit && pr && (
          <footer className="dfx-foot shrink-0 px-5 py-4 sm:px-7">
            <button type="button" onClick={requestClose} className="dfx-btn ghost">
              Close
            </button>
            <Link to={`/requester/edit-pr/${pr.id}`} onClick={onClose} className="dfx-btn primary">
              <i className={isDraft && !isReturned ? 'ri-send-plane-fill' : 'ri-edit-line'}></i>
              {isReturned ? 'Edit & Resubmit' : isDraft ? 'Edit & Submit' : 'Edit PR'}
            </Link>
          </footer>
        )}
      </aside>
    </div>
  );
}
