import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatusBadge from '../../../../components/base/StatusBadge';
import PriorityBadge from '../../../../components/base/PriorityBadge';
import { prApi } from '../../../../services/api';
import { useAuth } from '../../../../contexts/AuthContext';
import PrVendorQuotationsPanel from '../../../../components/feature/PrVendorQuotationsPanel';
import { collapsePrAdminEditHistory } from '../../../../components/feature/ApprovalHistoryPanel';
import { formatPersonRoleSuffix } from '../../../../utils/roleDisplay';

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

const softCard =
  'relative overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:p-4';
const softLabel =
  'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400';
const softValue = 'mt-1.5 text-sm font-semibold text-[#2C3E50] break-words';
const softWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

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

export default function PRDetailDrawer({
  pr,
  loading,
  onClose,
  onDeleteDraft,
  deletingDraft = false,
}: PRDetailDrawerProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'quotes' | 'history'>('details');
  const [hasQuotes, setHasQuotes] = useState(false);

  useEffect(() => {
    setActiveTab('details');
    setHasQuotes(false);
  }, [pr?.id]);

  if (!pr && !loading) return null;

  const isAdminEditor = Boolean(user?.role && ADMIN_EDIT_ROLES.includes(user.role));
  const canEdit = Boolean(pr && (isAdminEditor || canRequesterEditPr(pr)));
  const isReturned =
    pr?.status === 'RETURNED' ||
    pr?.statusFrontend === 'returned' ||
    String(pr?.statusUI || '').toLowerCase().includes('return');
  const isDraft = pr?.status === 'DRAFT' || pr?.statusFrontend === 'draft';

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-xl flex-col overflow-hidden shadow-2xl shadow-slate-300/40"
        style={{ background: 'linear-gradient(180deg, #edf1ff 0%, #f6f8ff 45%, #f2ecff 100%)' }}
      >
        {/* Header */}
        <div className="relative sticky top-0 z-10 border-b border-white/60 bg-white/90 px-4 py-3 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.12)] backdrop-blur-md sm:px-6 sm:py-4">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.12) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          <div className="relative z-[1] flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {pr && (
                <>
                  <p className="break-all text-[11px] font-bold tracking-wide text-[#1E88E5]">
                    {pr.prNumber}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={pr.statusUI || pr.statusFrontend} size="sm" />
                    <PriorityBadge priority={pr.priority} size="sm" />
                  </div>
                  <h3 className="mt-2 break-words text-base font-semibold leading-snug text-slate-800">
                    {pr.title}
                  </h3>
                </>
              )}
              {loading && <p className="text-sm text-slate-500">Loading PR details...</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {isDraft && user?.role === 'Requester' && onDeleteDraft && pr && (
                <button
                  type="button"
                  disabled={deletingDraft}
                  onClick={() => void onDeleteDraft(pr.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#FFE4E6] px-2.5 text-sm font-semibold text-[#F43F5E] transition-colors hover:bg-[#FECDD3] disabled:opacity-50"
                  title={deletingDraft ? 'Deleting…' : 'Delete draft'}
                >
                  <i className="ri-delete-bin-line"></i>
                  <span className="hidden sm:inline">
                    {deletingDraft ? 'Deleting…' : 'Delete draft'}
                  </span>
                </button>
              )}
              {canEdit && pr && (
                <Link
                  to={`/requester/edit-pr/${pr.id}`}
                  onClick={onClose}
                  className="hidden h-9 items-center gap-1.5 rounded-xl bg-[#1E88E5] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#1565C0] sm:inline-flex"
                >
                  <i className="ri-edit-line"></i>
                  {isReturned ? 'Edit & Resubmit' : 'Edit PR'}
                </Link>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-transparent bg-white text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] transition-colors hover:border-[#90CAF9] hover:text-[#1E88E5]"
                aria-label="Close"
              >
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {pr && (
            <>
              {isReturned && (
                <div className="relative mx-4 mt-4 overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:mx-6 sm:rounded-[18px]">
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(120% 90% at 100% 0%, rgba(249, 115, 22, 0.14) 0%, rgba(255,255,255,0) 55%)',
                    }}
                  />
                  <div className="relative z-[1] flex items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <i className="ri-arrow-go-back-line text-lg"></i>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Returned for Rework</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Review the feedback in approval history, update if needed, then resubmit.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-4 pt-4 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  {(['details', 'items', 'quotes', 'history'] as const)
                    .filter((tab) => tab !== 'quotes' || hasQuotes)
                    .map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`h-10 cursor-pointer whitespace-nowrap rounded-2xl px-3.5 text-xs font-semibold transition-all duration-200 ${
                          activeTab === tab
                            ? 'bg-[#1E88E5] text-white shadow-sm hover:bg-[#1565C0]'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-[#1E88E5]/40 hover:bg-[#E3F2FD]'
                        }`}
                      >
                        {tab === 'items'
                          ? `Line Items (${pr.lineItems.length})`
                          : tab === 'history'
                            ? 'History'
                            : tab === 'quotes'
                              ? 'Quotations'
                              : 'Details'}
                      </button>
                    ))}
                </div>
              </div>

              <div className="space-y-3 px-4 py-5 sm:space-y-4 sm:px-6">
                {activeTab === 'details' && (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <SoftField label="Entity" className="sm:col-span-2">
                        {pr.entityName || '—'}
                        {pr.entityCode ? (
                          <span className="font-normal text-slate-500"> ({pr.entityCode})</span>
                        ) : null}
                        {pr.entityCostCenter ? (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            Cost Center: {pr.entityCostCenter}
                          </p>
                        ) : null}
                      </SoftField>
                      <SoftField label="Department">{pr.department}</SoftField>
                      <SoftField label="Request Type">{pr.requestType}</SoftField>
                      <SoftField label="Request Category">{pr.requestCategory || '—'}</SoftField>
                      <SoftField label="Project Detail" className="sm:col-span-2">
                        {pr.projectDetail || '—'}
                      </SoftField>
                      <SoftField label="Required Date">{pr.requiredDate || '—'}</SoftField>
                      <SoftField label="Expected Delivery Timeline">
                        {pr.expectedDeliveryTimeline || '—'}
                      </SoftField>
                      <SoftField label="Payment Terms">{pr.paymentTerms || '—'}</SoftField>
                      <SoftField label="Total Amount">
                        <span className="tabular-nums">
                          ₹{pr.totalAmount.toLocaleString('en-IN')}
                        </span>
                      </SoftField>

                      {pr.poDocumentAvailable && pr.poId ? (
                        <div className={`${softCard} sm:col-span-2`}>
                          <div
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.14) 0%, rgba(255,255,255,0) 55%)',
                            }}
                          />
                          <div className="relative z-[1] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className={softLabel}>Purchase Order</p>
                              <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">
                                {pr.poNumber || `PO #${pr.poId}`}
                                {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/requester/po-document?poId=${pr.poId}`)}
                              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1565C0] sm:w-auto"
                            >
                              <i className="ri-file-pdf-2-line" />
                              View PO Document
                            </button>
                          </div>
                        </div>
                      ) : pr.poId ? (
                        <SoftField label="Purchase Order" className="sm:col-span-2">
                          {pr.poNumber || `PO #${pr.poId}`}
                          {pr.statusUI ? ` · ${pr.statusUI}` : ''}
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            PO document will be available after SCM Buyer final verification.
                          </p>
                        </SoftField>
                      ) : null}

                      <SoftField label="Billing Region / GST" className="sm:col-span-2">
                        {pr.billingLocation || '—'}
                        {pr.billingGstNo ? (
                          <span className="mt-0.5 block font-mono text-xs font-normal text-slate-500">
                            {pr.billingGstNo}
                          </span>
                        ) : null}
                      </SoftField>
                      <SoftField label="Billing Address" className="sm:col-span-2">
                        <span className="whitespace-pre-wrap">{pr.billingAddress || '—'}</span>
                      </SoftField>
                      <SoftField label="POC for Delivery">
                        <span className="whitespace-pre-wrap">{pr.deliveryPoc || '—'}</span>
                        {pr.deliveryPocEmail || pr.deliveryPocPhone ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            {[pr.deliveryPocPhone, pr.deliveryPocEmail].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                      </SoftField>
                      <SoftField label="Project Manager at HO">
                        <span className="whitespace-pre-wrap">{pr.projectManagerHo || '—'}</span>
                        {pr.projectManagerEmail || pr.projectManagerContact ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-500">
                            {[pr.projectManagerContact, pr.projectManagerEmail]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        ) : null}
                      </SoftField>
                      <SoftField label="Place of Delivery">{pr.placeOfDelivery || '—'}</SoftField>
                      <SoftField label="Submitted Date">{pr.submittedDate || '—'}</SoftField>
                    </div>

                    <div>
                      <h4 className={`${softLabel} mb-2 px-0.5`}>Business Justification</h4>
                      <div className={softCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <p className="relative z-[1] break-words text-sm leading-relaxed text-slate-700">
                          {pr.justification || '—'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <h4 className={`${softLabel} mb-2 px-0.5`}>Special Notes</h4>
                      <div className={softCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <p className="relative z-[1] whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
                          {pr.specialNotes || '—'}
                        </p>
                      </div>
                    </div>

                    {pr.attachments && pr.attachments.length > 0 && (
                      <div>
                        <h4 className={`${softLabel} mb-2 px-0.5`}>Attachments</h4>
                        <div className="space-y-2">
                          {pr.attachments.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => prApi.downloadAttachment(pr.id, file.id, file.fileName)}
                              className="relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-2xl border border-transparent bg-white px-3 py-2.5 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                            >
                              <div
                                className="pointer-events-none absolute inset-0"
                                style={softWash}
                              />
                              <i className="ri-attachment-2 relative z-[1] text-[#1E88E5]" />
                              <span className="relative z-[1] truncate text-sm font-medium text-slate-800">
                                {file.fileName}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {hasQuotes && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('quotes')}
                        className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-3.5 text-left shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-[border-color] hover:border-[#90CAF9] sm:rounded-[18px]"
                      >
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <span className="relative z-[1]">
                          <span className="block text-sm font-semibold text-slate-800">
                            View vendor quotations
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            Prices, rounds, and quotation files on this PR
                          </span>
                        </span>
                        <i className="ri-arrow-right-s-line relative z-[1] text-lg text-[#1E88E5]" />
                      </button>
                    )}
                  </>
                )}

                {pr.id ? (
                  <div className={activeTab === 'quotes' ? '' : 'hidden'}>
                    <PrVendorQuotationsPanel prId={pr.id} onPresenceChange={setHasQuotes} />
                  </div>
                ) : null}

                {activeTab === 'items' && (
                  <>
                    <div className="space-y-3 md:hidden">
                      {pr.lineItems.map((item, i) => (
                        <div key={item.id ?? `line-card-${i}`} className={softCard}>
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1]">
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg bg-[#E3F2FD] px-1.5 text-[11px] font-bold text-[#1E88E5]">
                                  #{i + 1}
                                </span>
                                <p className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">
                                  {item.description}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-400">{item.category || '—'}</p>
                              </div>
                              <p className="shrink-0 text-sm font-bold tabular-nums text-[#2C3E50]">
                                ₹{item.total.toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className={softLabel}>Qty</p>
                                <p className="mt-0.5 text-sm text-slate-800">{item.quantity}</p>
                              </div>
                              <div>
                                <p className={softLabel}>Unit</p>
                                <p className="mt-0.5 text-sm text-slate-800">
                                  ₹{item.unitCost.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className={softCard}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <div className="relative z-[1] flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">Total</p>
                          <p className="text-sm font-bold tabular-nums text-[#2C3E50]">
                            ₹{pr.totalAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative hidden overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] md:block sm:rounded-[18px]">
                      <div className="pointer-events-none absolute inset-0" style={softWash} />
                      <table className="relative z-[1] w-full text-sm">
                        <thead>
                          <tr>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              #
                            </th>
                            <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Description
                            </th>
                            <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Qty
                            </th>
                            <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Unit
                            </th>
                            <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pr.lineItems.map((item, i) => (
                            <tr key={item.id ?? `line-${i}`} className="border-t border-slate-100/80">
                              <td className="px-3 py-3 text-slate-500">{i + 1}</td>
                              <td className="px-3 py-3">
                                <p className="font-semibold text-[#2C3E50]">{item.description}</p>
                                <p className="text-xs text-slate-400">{item.category}</p>
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                              <td className="px-3 py-3 text-right tabular-nums">
                                ₹{item.unitCost.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#2C3E50]">
                                ₹{item.total.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-100/80">
                            <td
                              colSpan={4}
                              className="px-3 py-3 text-right text-sm font-semibold text-slate-700"
                            >
                              Total
                            </td>
                            <td className="px-3 py-3 text-right text-sm font-bold tabular-nums text-[#2C3E50]">
                              ₹{pr.totalAmount.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}

                {activeTab === 'history' && (
                  <div className="space-y-3">
                    {pr.approvalHistory.length === 0 ? (
                      <div className={`${softCard} py-8 text-center`}>
                        <div className="pointer-events-none absolute inset-0" style={softWash} />
                        <p className="relative z-[1] text-sm text-slate-500">
                          No approval history yet
                        </p>
                      </div>
                    ) : (
                      collapsePrAdminEditHistory(
                        pr.approvalHistory.map((item) => ({
                          stage: item.stage,
                          user: item.user,
                          role: item.role,
                          date: item.date,
                          status: item.status,
                          remarks: item.remarks,
                        }))
                      ).map((item, index) => (
                        <div key={index} className={softCard}>
                          <div className="pointer-events-none absolute inset-0" style={softWash} />
                          <div className="relative z-[1] flex gap-3">
                            <div
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                                item.status === 'Completed' ||
                                item.status === 'Approved' ||
                                item.status === 'Approve'
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : item.status === 'Rejected' || item.status === 'Reject'
                                    ? 'bg-[#FFE4E6] text-[#F43F5E]'
                                    : item.status === 'Returned' ||
                                        item.status?.toLowerCase().includes('return')
                                      ? 'bg-orange-50 text-orange-600'
                                      : 'bg-[#E3F2FD] text-[#1E88E5]'
                              }`}
                            >
                              <i
                                className={`text-sm ${
                                  item.status === 'Rejected' || item.status === 'Reject'
                                    ? 'ri-close-circle-fill'
                                    : item.status === 'Returned'
                                      ? 'ri-arrow-go-back-fill'
                                      : 'ri-checkbox-circle-fill'
                                }`}
                              ></i>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-semibold text-[#2C3E50]">
                                    {item.stage}
                                  </p>
                                  <p className="break-words text-xs text-slate-500">
                                    {item.user}
                                    {formatPersonRoleSuffix(item.role, item.user)}
                                  </p>
                                </div>
                                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                                  {item.date}
                                </span>
                              </div>
                              {item.remarks && (
                                <p className="mt-2 break-words rounded-xl bg-[#F8FAFC] p-2.5 text-sm text-slate-700">
                                  {item.remarks}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {canEdit && pr && (
          <div className="shrink-0 border-t border-white/60 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
            <Link
              to={`/requester/edit-pr/${pr.id}`}
              onClick={onClose}
              className="flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#1E88E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1565C0] sm:ml-auto sm:w-auto"
            >
              <i
                className={`${isReturned ? 'ri-edit-line' : isDraft ? 'ri-send-plane-fill' : 'ri-edit-line'} mr-1.5`}
              ></i>
              {isReturned ? 'Edit & Resubmit' : isDraft ? 'Edit & Submit' : 'Edit PR'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
