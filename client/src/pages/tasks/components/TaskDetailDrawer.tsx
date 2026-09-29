import PriorityBadge from '../../../components/base/PriorityBadge';
import StatusBadge from '../../../components/base/StatusBadge';
import { formatDisplayDate, formatDisplayDateTime } from '../../../utils/formatDate';
import PrVendorQuotationsPanel from '../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../components/feature/ApprovalHistoryPanel';
import { formatMoney } from '../../../constants/currency';
import { PM_BTN_PRIMARY, PM_BTN_SECONDARY } from '../../../constants/pmTheme';
import { formatPersonRoleSuffix } from '../../../utils/roleDisplay';
import { useEffect, useState, type ReactNode } from 'react';

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
  totalAmount: number;
  currency: string;
  submittedDate: string;
  requiredDate: string;
  currentApprover: string;
  justification: string;
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

const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:p-4';
const softLabel = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';
const softValue = 'mt-1.5 text-sm font-semibold text-[#2C3E50] break-words';

function SoftField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${softCard} ${className}`}>
      <div className="pointer-events-none absolute inset-0" style={softWash} />
      <div className="relative z-[1]">
        <p className={softLabel}>{label}</p>
        <div className={softValue}>{children}</div>
      </div>
    </div>
  );
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
  const approvalHistory = collapsePrAdminEditHistory(
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
  const [hasQuotes, setHasQuotes] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'quotes' | 'history'>('details');
  const isOwnVendor = task.vendorSelection === 'own';

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
  }, [task.id]);

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

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-xl flex-col shadow-[0_24px_64px_-24px_rgba(15,23,42,0.35)] animate-slide-in-right"
        style={{
          background: 'linear-gradient(180deg, #edf1ff 0%, #f6f8ff 45%, #f2ecff 100%)',
        }}
      >
        {/* Header */}
        <div className="relative z-10 shrink-0 overflow-hidden border-b border-white/60 bg-gradient-to-b from-[#edf1ff]/95 to-[#eef2ff]/90 px-4 py-3 sm:px-6 sm:py-4">
          <div className="pointer-events-none absolute inset-0" style={softWash} />
          <div className="relative z-[1] flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
              <i className="ri-file-list-3-line text-lg"></i>
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-all text-[11px] font-bold tracking-wide text-[#1E88E5]">
                {task.prNumber}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {isOnlinePurchase && (
                  <span className="rounded-full bg-[#1E88E5] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    ONLINE PURCHASE
                  </span>
                )}
                {isSass && !isOnlinePurchase && (
                  <span className="rounded-full bg-[#1565C0] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
                    CLOUD SUBSCRIPTION
                  </span>
                )}
                <StatusBadge status={task.status} size="sm" />
                <PriorityBadge priority={(task.priority || 'medium').toLowerCase()} size="sm" />
              </div>
              <h3 className="mt-2 break-words text-base font-semibold leading-snug text-[#2C3E50]">
                {task.title}
              </h3>
              {isOnlinePurchase && (
                <p className="mt-1.5 break-words text-xs font-medium text-[#1565C0]">
                  Online Purchase path: User Approval → Mugesh L1 → Srivaths L2 → Mugesh Invoice Upload →
                  Completed (SCM skipped)
                </p>
              )}
              {isSass && !isOnlinePurchase && (
                <p className="mt-1.5 break-words text-xs font-medium text-[#1565C0]">
                  {String(task.requesterEmail || task.requester || '')
                    .toLowerCase()
                    .includes('mugesh')
                    ? 'Cloud Subscription path: L1 → Mugesh Invoice Upload → Accounts (Mugesh self-approval & Srivaths L2 skipped; SCM skipped)'
                    : 'Cloud Subscription path: L1 → Mugesh → Srivaths (L2; skipped if L1 was Srivaths) → Mugesh Invoice → Accounts (SCM skipped)'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-colors hover:border hover:border-[#90CAF9] hover:text-[#1E88E5]"
              aria-label="Close"
            >
              <i className="ri-close-line text-lg"></i>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 overflow-y-auto px-6 py-16 text-center text-slate-500">
            <i className="ri-loader-4-line animate-spin text-2xl text-[#1E88E5]"></i>
            <p className="mt-3 text-sm">Loading PR details…</p>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-4 pt-4 sm:px-6">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'details' as const, label: 'Details' },
                    ...(showItemsTab
                      ? [{ id: 'items' as const, label: `Line Items (${lineItems.length})` }]
                      : []),
                    ...(showQuotesTab ? [{ id: 'quotes' as const, label: 'Quotations' }] : []),
                    { id: 'history' as const, label: 'History' },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-10 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {activeTab === 'details' && (
                <>
                  <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-transparent bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                    <div className="pointer-events-none absolute inset-0" style={softWash} />
                    <div className="relative z-[1] flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E3F2FD] text-sm font-bold text-[#1E88E5]">
                      {task.requesterAvatar || 'R'}
                    </div>
                    <div className="relative z-[1] min-w-0">
                      <p className="break-words text-sm font-semibold text-[#2C3E50]">{task.requester}</p>
                      <p className="break-words text-xs text-slate-500">
                        {task.requesterRole} &middot; {task.department || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <SoftField label="Entity" className="sm:col-span-2">
                      {task.entityName || '—'}
                      {task.entityCode ? (
                        <span className="font-normal text-slate-500"> ({task.entityCode})</span>
                      ) : null}
                      {task.entityCostCenter ? (
                        <p className="mt-1 text-xs font-normal text-slate-500">
                          Cost Center: {task.entityCostCenter}
                        </p>
                      ) : null}
                    </SoftField>
                    <SoftField label="Department">{task.department || '—'}</SoftField>
                    <SoftField label="Request Type">{task.requestType || '—'}</SoftField>
                    <SoftField label="Request Category">
                      {task.requestCategory || task.category || '—'}
                    </SoftField>
                    <SoftField label="Project Detail" className="sm:col-span-2">
                      {task.projectDetail || '—'}
                    </SoftField>
                    <SoftField label="Required Date">{formatDate(task.requiredDate)}</SoftField>
                    <SoftField label="Expected Delivery Timeline">
                      {task.expectedDeliveryTimeline || '—'}
                    </SoftField>
                    <SoftField label="Payment Terms">{task.paymentTerms || '—'}</SoftField>
                    <SoftField label="Total Amount">
                      {hideLinePricing ? (
                        'Own Vendor'
                      ) : (
                        <span className="tabular-nums">
                          {formatMoney(Number(task.totalAmount || 0), task.currency, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                    </SoftField>
                    <SoftField label="Current Stage">{task.currentApprover || '—'}</SoftField>
                    <SoftField label="Submitted Date">{formatDate(task.submittedDate)}</SoftField>
                    <SoftField label="Billing Region / GST" className="sm:col-span-2">
                      {task.billingLocation || '—'}
                      {task.billingGstNo ? (
                        <span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">
                          {task.billingGstNo}
                        </span>
                      ) : null}
                    </SoftField>
                    <SoftField label="Billing Address" className="sm:col-span-2">
                      <span className="whitespace-pre-wrap">{task.billingAddress || '—'}</span>
                    </SoftField>
                    <SoftField label="Place of Delivery">{task.placeOfDelivery || '—'}</SoftField>
                    <SoftField label="POC for Delivery">{task.deliveryPoc || '—'}</SoftField>
                  </div>

                  <div>
                    <h4 className={`${softLabel} mb-2 px-0.5`}>Business Justification</h4>
                    <div className={softCard}>
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <p className="relative z-[1] whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {task.justification || '—'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className={`${softLabel} mb-2 px-0.5`}>Special Notes</h4>
                    <div className={softCard}>
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <p className="relative z-[1] whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                        {task.specialNotes || '—'}
                      </p>
                    </div>
                  </div>

                  {savedQuoteVendors.length > 0 && !hasQuotes && (
                    <div className="space-y-3">
                      <h4 className={`${softLabel} px-0.5`}>Vendor quotations</h4>
                      {savedQuoteVendors.map((vendor) => (
                        <div key={vendor.invitationId} className={softCard}>
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1] flex items-center justify-between gap-2 border-b border-slate-100/80 px-4 py-3">
                            <p className="min-w-0 truncate text-sm font-semibold text-[#2C3E50]">
                              {vendor.vendorName}
                            </p>
                            {vendor.isRecommended ? (
                              <span className="shrink-0 rounded-full bg-[#1E88E5] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                Recommended
                              </span>
                            ) : null}
                          </div>
                          <div className="relative z-[1] divide-y divide-slate-100/80">
                            {[...vendor.rounds]
                              .sort((a, b) => Number(a.round) - Number(b.round))
                              .map((quote, quoteIndex) => (
                                <div
                                  key={`${vendor.invitationId}-${quote.submissionId || quote.round}-${quoteIndex}`}
                                  className="flex items-start gap-3 px-4 py-3"
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E3F2FD] text-xs font-bold text-[#1E88E5]">
                                    Q{Number(quote.round) || 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
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
                                      <p className="mt-1 truncate text-xs font-medium text-[#1565C0]">
                                        {quote.quotationFileName}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {showQuotesTab && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('quotes')}
                      className="relative flex w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-3 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                    >
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <span className="relative z-[1]">
                        <span className="block text-sm font-semibold text-[#1565C0]">
                          View vendor quotations
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Prices, rounds, and quotation files on this PR
                        </span>
                      </span>
                      <i className="relative z-[1] ri-arrow-right-s-line text-lg text-[#1E88E5]" />
                    </button>
                  )}
                </>
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
                <>
                  <div className="space-y-3 md:hidden">
                    {lineItems.length === 0 ? (
                      <p className="rounded-2xl bg-white p-4 text-center text-sm text-slate-400 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)]">
                        No line items
                      </p>
                    ) : (
                      lineItems.map((item, idx) => {
                        const name = String(item.itemName || item.description || '—').trim() || '—';
                        const desc = String(item.description || '').trim();
                        const showDesc = desc && desc !== name;
                        return (
                          <div
                            key={idx}
                            className="relative overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]"
                          >
                            <div className="pointer-events-none absolute inset-0" style={softWash} />
                            <div className="relative z-[1] mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-[#E3F2FD] px-1.5 text-[11px] font-bold text-[#1E88E5]">
                                  #{idx + 1}
                                </span>
                                <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">
                                  {name}
                                </p>
                                {showDesc ? (
                                  <p className="mt-0.5 break-words text-xs text-slate-400">{desc}</p>
                                ) : null}
                              </div>
                              {!hideLinePricing && (
                                <p className="shrink-0 text-sm font-bold text-[#1E88E5]">
                                  {formatMoney(Number(item.total || 0), task.currency, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </p>
                              )}
                            </div>
                            <div
                              className={`relative z-[1] grid gap-3 ${hideLinePricing ? 'grid-cols-1' : 'grid-cols-2'}`}
                            >
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  Qty
                                </p>
                                <p className="mt-0.5 text-sm text-[#2C3E50]">
                                  {Number(item.qty) || 0}
                                  {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? (
                                    <span className="ml-1 text-xs text-slate-400">{item.unit}</span>
                                  ) : null}
                                </p>
                              </div>
                              {!hideLinePricing && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                    Unit Cost
                                  </p>
                                  <p className="mt-0.5 text-sm text-[#2C3E50]">
                                    {formatMoney(Number(item.unitCost || 0), task.currency, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    {!hideLinePricing && lineItems.length > 0 && (
                      <div className="flex items-center justify-between rounded-2xl border border-[#BBDEFB]/80 bg-[#E3F2FD]/40 px-4 py-3 sm:rounded-[18px]">
                        <p className="text-sm font-semibold text-slate-700">Grand Total</p>
                        <p className="text-sm font-bold text-[#1E88E5]">
                          {formatMoney(Number(task.totalAmount || 0), task.currency, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="hidden overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] md:block sm:rounded-[18px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F8FAFC]">
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            #
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Item Name
                          </th>
                          <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Description
                          </th>
                          <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Qty
                          </th>
                          {!hideLinePricing && (
                            <>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Unit Cost
                              </th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Total
                              </th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={hideLinePricing ? 4 : 6}
                              className="px-3 py-6 text-center text-sm text-slate-400"
                            >
                              No line items
                            </td>
                          </tr>
                        ) : (
                          lineItems.map((item, idx) => {
                            const name = String(item.itemName || item.description || '—').trim() || '—';
                            const desc = String(item.description || '').trim();
                            const showDesc = desc && desc !== name;
                            return (
                              <tr key={idx} className="border-t border-slate-100">
                                <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                                <td className="px-3 py-2 font-medium text-[#2C3E50]">{name}</td>
                                <td className="px-3 py-2 text-slate-600">{showDesc ? desc : '—'}</td>
                                <td className="px-3 py-2 text-center tabular-nums text-slate-700">
                                  {Number(item.qty) || 0}
                                  {item.unit && !/^\d+(\.\d+)?$/.test(String(item.unit).trim()) ? (
                                    <span className="ml-1 text-xs font-normal text-slate-400">
                                      {item.unit}
                                    </span>
                                  ) : null}
                                </td>
                                {!hideLinePricing && (
                                  <>
                                    <td className="px-3 py-2 text-right text-slate-700">
                                      {formatMoney(Number(item.unitCost || 0), task.currency, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-[#1E88E5]">
                                      {formatMoney(Number(item.total || 0), task.currency, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {!hideLinePricing && (
                        <tfoot>
                          <tr className="border-t-2 border-[#BBDEFB] bg-[#E3F2FD]/40">
                            <td
                              colSpan={5}
                              className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-700"
                            >
                              Grand Total
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-[#1E88E5]">
                              {formatMoney(Number(task.totalAmount || 0), task.currency, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              )}

              {activeTab === 'history' && (
                <div className="space-y-3">
                  {approvalHistory.length === 0 ? (
                    <div className={`${softCard} py-8 text-center`}>
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <p className="relative z-[1] text-sm text-slate-500">No approval history yet</p>
                    </div>
                  ) : (
                    approvalHistory.map((step, idx) => {
                      const stepStatus = String(step.status || '').toLowerCase();
                      const done =
                        stepStatus.includes('approv') ||
                        stepStatus.includes('complet') ||
                        stepStatus.includes('submit');
                      const rejected = stepStatus.includes('reject');
                      const returned =
                        stepStatus.includes('return') || stepStatus.includes('rework');
                      return (
                        <div key={`${step.stage}-${step.date}-${idx}`} className={softCard}>
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1] flex gap-3">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                                done
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : rejected
                                    ? 'bg-[#FFE4E6] text-[#F43F5E]'
                                    : returned
                                      ? 'bg-orange-50 text-orange-600'
                                      : 'bg-[#E3F2FD] text-[#1E88E5]'
                              }`}
                            >
                              <i
                                className={`text-sm ${
                                  rejected
                                    ? 'ri-close-circle-fill'
                                    : returned
                                      ? 'ri-arrow-go-back-fill'
                                      : 'ri-checkbox-circle-fill'
                                }`}
                              ></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold text-[#2C3E50]">
                                    {step.stage || step.step}
                                  </p>
                                  <p className="break-words text-xs text-slate-500">
                                    {step.approver}
                                    {formatPersonRoleSuffix(step.role, step.approver)}
                                  </p>
                                </div>
                                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                                  {formatDateTime(step.date)}
                                </span>
                              </div>
                              {step.remarks ? (
                                <p className="mt-2 break-words rounded-xl bg-[#F8FAFC] p-2.5 text-sm text-slate-700">
                                  {step.remarks}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer — pinned so L1/L2 always see Approve / Send Back / Reject */}
        {showActions && (
          <div className="relative shrink-0 border-t border-slate-100/80 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
            <div className="pointer-events-none absolute inset-0 opacity-60" style={softWash} />
            <div className="relative z-[1] flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => onApprove(task.id)}
                className={`${PM_BTN_PRIMARY} flex-1 disabled:opacity-50 ${
                  task.requireInvoiceUpload || task.isSassInvoiceUpload ? '' : ''
                }`}
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
                <div className="flex gap-2 sm:contents">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onReturn(task.id)}
                    className={`${PM_BTN_SECONDARY} flex-1 !text-orange-600 hover:!border-orange-200 disabled:opacity-50`}
                  >
                    <i className="ri-arrow-go-back-line"></i> Send Back
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => onReject(task.id)}
                    className={`${PM_BTN_SECONDARY} flex-1 !text-rose-600 hover:!border-rose-200 disabled:opacity-50`}
                  >
                    <i className="ri-close-circle-line"></i> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
