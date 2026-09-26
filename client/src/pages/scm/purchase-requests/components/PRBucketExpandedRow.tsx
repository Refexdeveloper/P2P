import { useEffect, useRef, useState } from 'react';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from '../../../../components/feature/ApprovalHistoryPanel';
import VendorComparisonMatrix from '../../../../components/rfq/VendorComparisonMatrix';
import { poApi, prApi, rfqApi, VendorComparisonData } from '../../../../services/api';

interface LineItem {
  id?: number;
  description?: string;
  category?: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
}

interface PRDetail {
  id: number;
  prNumber: string;
  title: string;
  department: string;
  requester: string;
  requestType: string;
  requestCategory?: string;
  projectDetail?: string;
  specialNotes?: string;
  scopeOfWork?: string;
  paymentTerms?: string;
  entityName?: string;
  entityCode?: string;
  priority: string;
  requiredDate: string;
  submittedDate: string;
  totalAmount: number;
  justification: string;
  statusUI: string;
  lineItems: LineItem[];
  approvalHistory: ApprovalHistoryEntry[];
}

interface Props {
  prId: number;
  poId?: number | null;
  poNumber?: string | null;
  title?: string;
  colSpan: number;
  statusLabel: string;
  statusRaw?: string;
  showCreatePo?: boolean;
  onCreatePo?: () => void;
  onEditPo?: () => void;
}

interface CancellationAttachment {
  fileName?: string;
  filePath?: string;
  uploadedAt?: string;
}

interface CancellationInfo {
  reason: string;
  cancelledAt: string;
  cancelledByName: string;
  attachments: CancellationAttachment[];
}

interface PoSummary {
  poNumber: string;
  vendorName: string;
  vendorEmail: string;
  entity: string;
  purchaseTypeLabel: string;
  poType: string;
  createdBy: string;
  referencePoNumber: string;
}

interface AddressContactInfo {
  siteAddress: string;
  contactPersons: string;
  projectManagerHo: string;
  invoicingAddress: string;
  gstin: string;
}

interface ReferencePoInfo {
  id: number;
  poNumber: string;
  vendorName: string;
  vendorEmail: string;
  entity: string;
  purchaseTypeLabel: string;
  status: string;
  grandTotal: number;
  expectedDeliveryDate: string;
  createdAt: string;
  lineItems: LineItem[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const EMPTY_ADDRESS: AddressContactInfo = {
  siteAddress: '',
  contactPersons: '',
  projectManagerHo: '',
  invoicingAddress: '',
  gstin: '',
};

function pickText(...vals: Array<unknown>): string {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function htmlToPlain(html: string): string {
  if (!html) return '';
  if (!/[<>]/.test(html)) return html.trim();
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractScopeOfWorkFromPo(po: Record<string, unknown> | null | undefined): string {
  if (!po) return '';
  const clauses = Array.isArray(po.termsClauses) ? (po.termsClauses as Array<Record<string, unknown>>) : [];
  for (const c of clauses) {
    const header = String(c.termsHeader || c.header || '').toLowerCase();
    if (!header.includes('scope of work') && !header.includes('scope ofwork')) continue;
    const body = htmlToPlain(String(c.termsDescription || c.description || ''));
    if (body) return body;
  }
  return '';
}

function extractPaymentTermsFromPo(po: Record<string, unknown> | null | undefined): string {
  if (!po) return '';
  const terms = (po.poTermsDetails as Record<string, unknown> | undefined) || {};
  return (
    String(po.paymentTerms || terms.paymentTermsText || terms.paymentTerms || '').trim()
  );
}

const softDetailCard =
  'relative min-w-0 overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:p-4';

const softDetailWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

function SoftDetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className={softDetailCard}>
      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
      <div className="relative z-[1]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-1.5 break-words text-sm font-semibold text-[#2C3E50]">{value?.trim() ? value : '—'}</div>
      </div>
    </div>
  );
}

function HighlightInfoCard({
  label,
  value,
  icon,
  tone,
  className = '',
}: {
  label: string;
  value?: string | null;
  icon: string;
  tone: 'entity' | 'address' | 'notes';
  className?: string;
}) {
  const iconStyles =
    tone === 'address' || tone === 'entity'
      ? 'bg-[#E3F2FD] text-[#1E88E5]'
      : 'bg-amber-50 text-amber-600';

  return (
    <div className={`${softDetailCard} flex min-h-[120px] gap-3 ${className}`}>
      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
      <div className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconStyles}`}>
        <i className={`${icon} text-lg`}></i>
      </div>
      <div className="relative z-[1] min-w-0 flex-1">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="break-words text-sm font-semibold leading-relaxed whitespace-pre-wrap text-[#2C3E50]">
          {value?.trim() ? value : '—'}
        </p>
      </div>
    </div>
  );
}

function formatPoContacts(terms: Record<string, unknown>): string {
  const name = pickText(terms.siteContactPerson);
  const phone = pickText(terms.siteContactPhone);
  const email = pickText(terms.siteContactEmail);
  return [name, [phone, email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
}

function addressFromPr(d: Record<string, unknown>): AddressContactInfo {
  const poc = [
    pickText(d.deliveryPoc),
    [pickText(d.deliveryPocPhone), pickText(d.deliveryPocEmail)].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
  const pm = [
    pickText(d.projectManagerHo),
    [pickText(d.projectManagerContact), pickText(d.projectManagerEmail)].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
  return {
    siteAddress: pickText(d.placeOfDelivery),
    contactPersons: poc,
    projectManagerHo: pm,
    invoicingAddress: htmlToPlain(pickText(d.billingAddress)),
    gstin: pickText(d.billingGstNo).toUpperCase(),
  };
}

function addressFromPo(po: Record<string, unknown>, fallback: AddressContactInfo = EMPTY_ADDRESS): AddressContactInfo {
  const terms = (po.poTermsDetails as Record<string, unknown> | undefined) || {};
  const pm = [
    pickText(terms.projectManagerHo),
    [pickText(terms.projectManagerContact), pickText(terms.projectManagerEmail)].filter(Boolean).join(' · '),
  ]
    .filter(Boolean)
    .join('\n');
  return {
    siteAddress: pickText(terms.siteAddress, po.deliveryAddress, fallback.siteAddress),
    contactPersons: pickText(formatPoContacts(terms), fallback.contactPersons),
    projectManagerHo: pickText(pm, fallback.projectManagerHo),
    invoicingAddress: pickText(htmlToPlain(String(terms.invoicingAddress || '')), fallback.invoicingAddress),
    gstin: pickText(terms.buyerGstNo, fallback.gstin).toUpperCase(),
  };
}

export default function PRBucketExpandedRow({
  prId,
  poId = null,
  poNumber = null,
  title = '',
  colSpan,
  statusLabel,
  statusRaw = '',
  showCreatePo = false,
  onCreatePo,
  onEditPo,
}: Props) {
  const expandWrapRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [tab, setTab] = useState<
    'details' | 'items' | 'vendors' | 'history' | 'cancellation' | 'pdf' | 'reference'
  >('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<PRDetail | null>(null);
  const [comparison, setComparison] = useState<VendorComparisonData | null>(null);
  const [cancellation, setCancellation] = useState<CancellationInfo | null>(null);
  const [poSummary, setPoSummary] = useState<PoSummary | null>(null);
  const [addressInfo, setAddressInfo] = useState<AddressContactInfo>(EMPTY_ADDRESS);
  const [referencePo, setReferencePo] = useState<ReferencePoInfo | null>(null);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [referencePdfUrl, setReferencePdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const currentPdfUrlRef = useRef<string | null>(null);
  const referencePdfUrlRef = useRef<string | null>(null);
  const isManualDoc = !(prId > 0);

  /** Keep expand panel pinned to the visible table viewport (no horizontal scroll of details). */
  useEffect(() => {
    const el = expandWrapRef.current;
    if (!el) return;
    const scrollParent =
      (el.closest('[data-po-workspace-scroll]') as HTMLElement | null) ||
      (el.closest('.overflow-x-auto') as HTMLElement | null);

    const update = () => {
      const w = scrollParent?.clientWidth ?? el.parentElement?.clientWidth ?? 0;
      if (w > 0) setPanelWidth(w);
    };
    update();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (scrollParent && ro) ro.observe(scrollParent);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const revokePdfUrl = (ref: { current: string | null }) => {
    if (ref.current) {
      URL.revokeObjectURL(ref.current);
      ref.current = null;
    }
  };

  const mapHistory = (historyRaw: unknown[]): ApprovalHistoryEntry[] =>
    historyRaw.map((item) => {
      const h = item as Record<string, unknown>;
      return {
        stage: String(h.stage || ''),
        approver: String(h.approver || h.user || 'System'),
        user: String(h.user || h.approver || 'System'),
        role: String(h.role || ''),
        action: String(h.action || h.status || 'Updated'),
        status: String(h.status || h.action || ''),
        date: String(h.date || ''),
        remarks: String(h.remarks || ''),
      };
    });

  const mapReferencePo = (po: Record<string, unknown>): ReferencePoInfo => {
    const items = Array.isArray(po.lineItems) ? (po.lineItems as LineItem[]) : [];
    return {
      id: Number(po.id) || 0,
      poNumber: String(po.poNumber || ''),
      vendorName: String(po.vendorName || ''),
      vendorEmail: String(po.vendorEmail || ''),
      entity: String(po.entity || ''),
      purchaseTypeLabel: String(
        po.purchaseTypeLabel || (po.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')
      ),
      status: String(po.status || po.statusRaw || ''),
      grandTotal: Number(po.grandTotal || 0),
      expectedDeliveryDate: String(po.expectedDeliveryDate || ''),
      createdAt: String(po.createdAt || ''),
      lineItems: items.map((item) => ({
        ...item,
        description: item.description || (item as { itemName?: string }).itemName || '',
      })),
    };
  };

  const loadRelatedDocs = async (
    currentPoId: number | null,
    referenceNumber: string,
    cancelled: () => boolean
  ) => {
    setPdfError('');
    setReferencePo(null);
    revokePdfUrl(currentPdfUrlRef);
    revokePdfUrl(referencePdfUrlRef);
    setCurrentPdfUrl(null);
    setReferencePdfUrl(null);

    const resolvedPoId = Number(currentPoId) || 0;
    if (resolvedPoId) {
      setPdfLoading(true);
      try {
        const { blob } = await poApi.fetchPreviewBlob(resolvedPoId);
        if (cancelled()) return;
        const url = URL.createObjectURL(blob);
        currentPdfUrlRef.current = url;
        setCurrentPdfUrl(url);
      } catch {
        if (!cancelled()) setPdfError('Could not load document PDF');
      } finally {
        if (!cancelled()) setPdfLoading(false);
      }
    }

    const refNo = String(referenceNumber || '').trim();
    if (!refNo) return;
    try {
      const refRes = await poApi.getByNumber(refNo);
      if (cancelled()) return;
      const refPo = refRes.data as Record<string, unknown>;
      setReferencePo(mapReferencePo(refPo));
      const refId = Number(refPo.id);
      if (refId) {
        const { blob } = await poApi.fetchPreviewBlob(refId);
        if (cancelled()) return;
        const url = URL.createObjectURL(blob);
        referencePdfUrlRef.current = url;
        setReferencePdfUrl(url);
      }
    } catch {
      if (!cancelled()) {
        setReferencePo({
          id: 0,
          poNumber: refNo,
          vendorName: '',
          vendorEmail: '',
          entity: '',
          purchaseTypeLabel: '',
          status: '',
          grandTotal: 0,
          expectedDeliveryDate: '',
          createdAt: '',
          lineItems: [],
        });
      }
    }
  };

  const applyPoPayload = (po: Record<string, unknown>) => {
    const terms = (po.poTermsDetails as Record<string, unknown> | undefined) || {};
    const items = Array.isArray(po.lineItems) ? (po.lineItems as LineItem[]) : [];
    const historyRaw = Array.isArray(po.approvalHistory) ? po.approvalHistory : [];
    const poNo = String(po.poNumber || poNumber || '');
    const poTitle =
      String(terms.subject || po.prTitle || title || '').trim() ||
      (String(po.purchaseType) === 'work_order' ? 'Manual Work Order' : 'Manual Purchase Order');
    setPoSummary({
      poNumber: poNo,
      vendorName: String(po.vendorName || ''),
      vendorEmail: String(po.vendorEmail || ''),
      entity: String(po.entity || ''),
      purchaseTypeLabel: String(po.purchaseTypeLabel || (po.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')),
      poType: String(po.poType || ''),
      createdBy: String(po.createdBy || ''),
      referencePoNumber: String(po.referencePoNumber || '').trim(),
    });
    setAddressInfo(addressFromPo(po));
    setPr({
      id: Number(po.id) || 0,
      prNumber: String(po.prNumber || '') || 'None (Manual)',
      title: poTitle,
      department: String(po.department || po.entity || ''),
      requester: String(po.requester || po.createdBy || ''),
      requestType: String(po.purchaseTypeLabel || ''),
      priority: String(po.poType || ''),
      requiredDate: String(po.expectedDeliveryDate || ''),
      submittedDate: String(po.createdAt || ''),
      totalAmount: Number(po.grandTotal || po.totalAmount || 0),
      justification: String(po.specialInstructions || 'Manual document — no PR reference.'),
      paymentTerms: extractPaymentTermsFromPo(po) || '—',
      scopeOfWork: extractScopeOfWorkFromPo(po) || '',
      specialNotes: String(po.specialInstructions || ''),
      entityName: String(po.entity || po.entityName || ''),
      entityCode: String(po.entityCode || ''),
      statusUI: String(po.status || statusLabel),
      lineItems: items.map((item) => ({
        ...item,
        description: item.description || (item as { itemName?: string }).itemName || '',
      })),
      approvalHistory: mapHistory(historyRaw),
    });
    const reason = String(po.cancellationReason || '').trim();
    const attachments = Array.isArray(po.cancellationAttachments)
      ? (po.cancellationAttachments as CancellationAttachment[])
      : [];
    if (reason || attachments.length) {
      setCancellation({
        reason,
        cancelledAt: String(po.cancelledAt || ''),
        cancelledByName: String(po.cancelledByName || po.cancelledBy || ''),
        attachments,
      });
    } else {
      setCancellation(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      setAddressInfo(EMPTY_ADDRESS);
      setReferencePo(null);
      revokePdfUrl(currentPdfUrlRef);
      revokePdfUrl(referencePdfUrlRef);
      setCurrentPdfUrl(null);
      setReferencePdfUrl(null);
      try {
        if (prId > 0) {
          const [prRes, cmpRes, poRes] = await Promise.allSettled([
            prApi.get(prId),
            rfqApi.getComparison(prId),
            poId ? poApi.get(poId) : Promise.resolve({ data: {} }),
          ]);

          if (cancelled) return;

          if (prRes.status === 'fulfilled') {
            const d = prRes.value.data as Record<string, unknown>;
            const items = Array.isArray(d.lineItems) ? (d.lineItems as LineItem[]) : [];
            const historyRaw = Array.isArray(d.approvalHistory) ? d.approvalHistory : [];
            setPr({
              id: Number(d.id),
              prNumber: String(d.prNumber || ''),
              title: String(d.title || ''),
              department: String(d.department || ''),
              requester: String(d.requester || ''),
              requestType: String(d.requestType || ''),
              requestCategory: String(d.requestCategory || ''),
              projectDetail: String(d.projectDetail || ''),
              specialNotes: String(d.specialNotes || ''),
              scopeOfWork: String(d.scopeOfWork || ''),
              paymentTerms: String(d.paymentTerms || ''),
              entityName: String(d.entityName || ''),
              entityCode: String(d.entityCode || ''),
              priority: String(d.priority || d.priorityLower || ''),
              requiredDate: String(d.requiredDate || ''),
              submittedDate: String(d.submittedDate || ''),
              totalAmount: Number(d.totalAmount || 0),
              justification: String(d.justification || ''),
              statusUI: String(d.statusUI || statusLabel),
              lineItems: items,
              approvalHistory: mapHistory(historyRaw),
            });
            setAddressInfo(addressFromPr(d));
          } else {
            throw prRes.reason instanceof Error ? prRes.reason : new Error('Failed to load PR');
          }

          if (cmpRes.status === 'fulfilled') {
            setComparison(cmpRes.value.data);
          } else {
            setComparison(null);
          }

          if (poId && poRes.status === 'fulfilled') {
            const po = poRes.value.data as Record<string, unknown>;
            const reason = String(po.cancellationReason || '').trim();
            const attachments = Array.isArray(po.cancellationAttachments)
              ? (po.cancellationAttachments as CancellationAttachment[])
              : [];
            if (reason || attachments.length) {
              setCancellation({
                reason,
                cancelledAt: String(po.cancelledAt || ''),
                cancelledByName: String(po.cancelledByName || po.cancelledBy || ''),
                attachments,
              });
            } else {
              setCancellation(null);
            }
            setPoSummary({
              poNumber: String(po.poNumber || poNumber || ''),
              vendorName: String(po.vendorName || ''),
              vendorEmail: String(po.vendorEmail || ''),
              entity: String(po.entity || ''),
              purchaseTypeLabel: String(
                po.purchaseTypeLabel || (po.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order')
              ),
              poType: String(po.poType || ''),
              createdBy: String(po.createdBy || ''),
              referencePoNumber: String(po.referencePoNumber || '').trim(),
            });
            setAddressInfo((prev) => addressFromPo(po, prev));
            // Fill payment terms / scope of work from PO when PR fields are empty
            setPr((prev) => {
              if (!prev) return prev;
              const poPay = extractPaymentTermsFromPo(po);
              const poSow = extractScopeOfWorkFromPo(po);
              return {
                ...prev,
                paymentTerms: prev.paymentTerms?.trim() ? prev.paymentTerms : poPay || prev.paymentTerms,
                scopeOfWork: prev.scopeOfWork?.trim() ? prev.scopeOfWork : poSow || prev.scopeOfWork,
              };
            });
          } else {
            setCancellation(null);
          }
          if (poId) {
            const refNo =
              poRes.status === 'fulfilled'
                ? String((poRes.value.data as Record<string, unknown>).referencePoNumber || '')
                : '';
            await loadRelatedDocs(poId, refNo, () => cancelled);
          }
        } else if (poId) {
          setComparison(null);
          try {
            const [poRes, cmpRes] = await Promise.allSettled([
              poApi.get(poId),
              poApi.getComparison(poId),
            ]);
            if (cancelled) return;
            if (poRes.status !== 'fulfilled') {
              throw poRes.reason instanceof Error ? poRes.reason : new Error('Failed to load PO');
            }
            applyPoPayload(poRes.value.data as Record<string, unknown>);
            if (cmpRes.status === 'fulfilled') {
              setComparison(cmpRes.value.data);
            }
            await loadRelatedDocs(
              poId,
              String((poRes.value.data as Record<string, unknown>).referencePoNumber || ''),
              () => cancelled
            );
          } catch (poErr) {
            if (cancelled) return;
            await loadRelatedDocs(poId, '', () => cancelled);
            throw poErr;
          }
        } else {
          throw new Error('No PR or PO details available');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load details');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      revokePdfUrl(currentPdfUrlRef);
      revokePdfUrl(referencePdfUrlRef);
    };
  }, [prId, poId, poNumber, title, statusLabel]);

  const tabs = [
    { key: 'details' as const, label: isManualDoc ? 'WO / PO Details' : 'PR Details', icon: 'ri-information-line' },
    { key: 'items' as const, label: 'Line Items', icon: 'ri-list-check-2' },
    { key: 'vendors' as const, label: 'Vendor Comparison', icon: 'ri-table-line' },
    {
      key: 'history' as const,
      label: `Approval History${pr?.approvalHistory?.length ? ` (${pr.approvalHistory.length})` : ''}`,
      icon: 'ri-history-line',
    },
    ...(poId
      ? [{ key: 'pdf' as const, label: 'PDF', icon: 'ri-file-pdf-line' }]
      : []),
    ...(poSummary?.referencePoNumber
      ? [{ key: 'reference' as const, label: `Reference PO (${poSummary.referencePoNumber})`, icon: 'ri-links-line' }]
      : []),
    ...(cancellation || statusLabel === 'Cancelled'
      ? [{ key: 'cancellation' as const, label: 'Cancellation', icon: 'ri-close-circle-line' }]
      : []),
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="max-w-0 bg-transparent p-0 align-top">
        <div
          ref={expandWrapRef}
          className="sticky left-0 z-[5] box-border min-w-0"
          style={{
            width: panelWidth ? `${panelWidth}px` : '100%',
            maxWidth: panelWidth ? `${panelWidth}px` : undefined,
          }}
        >
          <div className="box-border w-full max-w-full overflow-x-hidden px-2 py-2 sm:px-3 sm:py-3">
            <div className="relative box-border w-full max-w-full overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#2C3E50]" title={pr ? `${pr.prNumber} — ${pr.title}` : undefined}>
                <span className="text-[#1E88E5]">
                  {poSummary?.poNumber || poNumber || pr?.prNumber || (prId > 0 ? `PR #${prId}` : 'Document')}
                </span>
                {pr?.title ? ` — ${pr.title}` : title ? ` — ${title}` : ''}
              </p>
              <p className="text-xs text-slate-500">
                {isManualDoc ? 'Expanded WO / PO view (no PR)' : 'Expanded PR view'}
              </p>
            </div>
            <div className="flex max-w-full flex-shrink-0 flex-wrap items-center gap-2">
              {showCreatePo && (
                <button
                  type="button"
                  onClick={onCreatePo}
                  className="cursor-pointer rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0]"
                >
                  Create PO
                </button>
              )}
              {onEditPo && poId ? (
                <button
                  type="button"
                  onClick={onEditPo}
                  className="cursor-pointer rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {String(statusRaw).toLowerCase() === 'draft' ||
                  String(statusLabel).toLowerCase() === 'draft'
                    ? 'Edit Draft'
                    : 'Edit'}
                </button>
              ) : null}
              <span className="whitespace-nowrap rounded-lg bg-[#E3F2FD] px-2.5 py-1 text-xs font-semibold text-[#1E88E5]">
                {pr?.statusUI || statusLabel}
              </span>
            </div>
          </div>

          <div className="relative z-[1] flex flex-wrap gap-x-1 border-b border-slate-100/80 px-2 sm:px-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${
                  tab === t.key
                    ? 'border-[#1E88E5] text-[#1E88E5]'
                    : 'border-transparent text-slate-500 hover:text-[#2C3E50]'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
                {t.key === 'items' && pr ? ` (${pr.lineItems.length})` : ''}
                {t.key === 'vendors' && comparison ? ` (${comparison.vendorCount})` : ''}
              </button>
            ))}
          </div>

          <div
            className={`relative z-[1] max-w-full overflow-visible p-4 sm:p-5 ${
              tab === 'details' ? 'bg-[#F5F7FA]' : ''
            }`}
          >
            {loading && (
              <div className="py-8 text-center text-sm text-slate-500">
                <i className="ri-loader-4-line mr-2 animate-spin text-lg text-[#1E88E5]"></i>
                Loading details...
              </div>
            )}

              {!loading && error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              {!loading && !error && pr && tab === 'details' && (
                <div className="space-y-4">
                  {(() => {
                    const prEntity =
                      pr.entityCode && pr.entityName
                        ? `${pr.entityCode} — ${pr.entityName}`
                        : pr.entityName || pr.entityCode || '';
                    const entityValue = poSummary?.entity?.trim() || prEntity || '';
                    return entityValue ? (
                      <HighlightInfoCard
                        label={poSummary?.entity?.trim() ? 'Entity / Location' : 'PR Entity'}
                        value={entityValue}
                        icon="ri-building-2-line"
                        tone="entity"
                      />
                    ) : null;
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      ...(poSummary
                        ? [
                            ['Document No', poSummary.poNumber],
                            ['Document Type', poSummary.purchaseTypeLabel],
                            ['Template', poSummary.poType],
                            ['Vendor', poSummary.vendorName],
                            ['Vendor Email', poSummary.vendorEmail],
                            ['Created By', poSummary.createdBy],
                            ...(poSummary.referencePoNumber
                              ? [['Reference PO', poSummary.referencePoNumber] as [string, string]]
                              : []),
                          ]
                        : []),
                      [
                        'PR Entity',
                        pr.entityCode && pr.entityName
                          ? `${pr.entityCode} — ${pr.entityName}`
                          : pr.entityName || pr.entityCode || '—',
                      ],
                      ['Department', pr.department],
                      ['Requester', pr.requester],
                      ['Request Type', pr.requestType],
                      ['Request Category', pr.requestCategory],
                      ['Project Detail', pr.projectDetail],
                      ['Priority', pr.priority],
                      ['Required Date', pr.requiredDate || '—'],
                      ['Payment Terms', pr.paymentTerms || '—'],
                      ['Submitted', pr.submittedDate || '—'],
                      ['Total Amount', formatCurrency(pr.totalAmount)],
                      ['Status', pr.statusUI],
                    ].map(([label, value]) => (
                      <SoftDetailField key={label} label={label} value={value} />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <HighlightInfoCard
                      label="Site Address"
                      value={addressInfo.siteAddress}
                      icon="ri-map-pin-line"
                      tone="address"
                      className="lg:col-span-2 min-h-[120px]"
                    />
                    <SoftDetailField label="POC for Delivery" value={addressInfo.contactPersons} />
                    <SoftDetailField label="Project Manager at HO" value={addressInfo.projectManagerHo} />
                    <SoftDetailField label="GSTIN" value={addressInfo.gstin} />
                    <div className="lg:col-span-2">
                      <SoftDetailField label="Invoicing Address" value={addressInfo.invoicingAddress} />
                    </div>
                  </div>
                  <HighlightInfoCard
                    label="Scope of Work"
                    value={pr.scopeOfWork}
                    icon="ri-file-list-3-line"
                    tone="notes"
                    className="min-h-[120px]"
                  />
                  <HighlightInfoCard
                    label="Special Notes"
                    value={pr.specialNotes}
                    icon="ri-sticky-note-line"
                    tone="notes"
                    className="min-h-[120px]"
                  />
                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Business Justification
                    </h4>
                    <div className={softDetailCard}>
                      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                      <p className="relative z-[1] min-h-[80px] break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2C3E50]">
                        {pr.justification || 'No justification provided.'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Manager &amp; L2 Comments
                    </h4>
                    <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                  </div>
                  {comparison?.recommendedVendorName && (
                    <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
                      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                      <p className="relative z-[1] break-words text-sm text-[#2C3E50]">
                        <i className="ri-star-fill mr-1 text-[#1E88E5]"></i>
                        Recommended vendor: <strong>{comparison.recommendedVendorName}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && pr && tab === 'history' && (
                <div className="space-y-4">
                  <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                  <ApprovalHistoryPanel history={pr.approvalHistory} />
                </div>
              )}

              {!loading && !error && pr && tab === 'items' && (
                <div className="w-full min-w-0">
                  {pr.lineItems.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No line items found</p>
                  ) : (
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="border-b border-slate-100 bg-[#F8FBFF]">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-10">#</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Description</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[140px]">Category</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-16">Qty</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Unit Price</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pr.lineItems.map((item, idx) => (
                          <tr key={item.id ?? idx} className="hover:bg-[#E3F2FD]/35">
                            <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 break-words">{item.description || '—'}</td>
                            <td className="px-3 py-2.5 text-gray-700 truncate" title={item.category || undefined}>
                              {item.category || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{item.quantity ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                              {formatCurrency(Number(item.unitPrice || 0))}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                              {formatCurrency(Number(item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-100 bg-[#F8FBFF]">
                          <td colSpan={5} className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Grand Total
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-bold text-[#1E88E5] tabular-nums whitespace-nowrap">
                            {formatCurrency(pr.totalAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              )}

              {!loading && !error && tab === 'vendors' && (
                comparison ? (
                  <div className="min-w-0 w-full max-w-full">
                    <VendorComparisonMatrix data={comparison} compact />
                  </div>
                ) : (
                  <div className="py-8 text-center text-sm text-gray-500">
                    <i className="ri-store-2-line text-2xl text-gray-300 mb-2 block"></i>
                    {isManualDoc
                      ? 'No vendor comparison for this manual PO / WO'
                      : 'No vendor comparison data available for this PR'}
                  </div>
                )
              )}

              {!loading && !error && tab === 'pdf' && (
                <div className="space-y-3">
                  {pdfLoading && !currentPdfUrl ? (
                    <p className="text-sm text-gray-500 py-8 text-center">Loading document…</p>
                  ) : pdfError && !currentPdfUrl ? (
                    <p className="text-sm text-red-600 py-8 text-center">{pdfError}</p>
                  ) : currentPdfUrl ? (
                    <iframe
                      title="Document PDF"
                      src={currentPdfUrl}
                      className="w-full h-[640px] rounded-xl border border-transparent shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] bg-white"
                    />
                  ) : (
                    <p className="text-sm text-gray-500 py-8 text-center">PDF is not available for this document.</p>
                  )}
                </div>
              )}

              {!loading && !error && tab === 'reference' && (
                <div className="space-y-4">
                  {!poSummary?.referencePoNumber ? (
                    <p className="text-sm text-gray-500 py-8 text-center">No reference PO on this document.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          ['Reference PO No', referencePo?.poNumber || poSummary.referencePoNumber],
                          ['Document Type', referencePo?.purchaseTypeLabel],
                          ['Vendor', referencePo?.vendorName],
                          ['Vendor Email', referencePo?.vendorEmail],
                          ['Entity', referencePo?.entity],
                          ['Status', referencePo?.status],
                          ['Amount', referencePo ? formatCurrency(referencePo.grandTotal) : '—'],
                          ['Delivery Date', referencePo?.expectedDeliveryDate],
                        ].map(([label, value]) => (
                          <SoftDetailField key={label} label={String(label)} value={value ? String(value) : '—'} />
                        ))}
                      </div>

                      {referencePo?.lineItems?.length ? (
                        <div className="w-full min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">Reference line items</p>
                          <table className="w-full min-w-[640px] text-sm">
                            <thead className="border-b border-slate-100 bg-[#F8FBFF]">
                              <tr>
                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-10">#</th>
                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Description</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-16">Qty</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Unit Price</th>
                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {referencePo.lineItems.map((item, idx) => (
                                <tr key={item.id ?? idx}>
                                  <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                                  <td className="px-3 py-2.5 font-medium text-gray-900">{item.description || '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity ?? '—'}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(Number(item.unitPrice || 0))}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                                    {formatCurrency(Number(item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">Reference PO PDF</p>
                        {referencePdfUrl ? (
                          <iframe
                            title="Reference PO PDF"
                            src={referencePdfUrl}
                            className="w-full h-[640px] rounded-xl border border-transparent shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] bg-white"
                          />
                        ) : (
                          <p className="text-sm text-gray-500">Could not load the reference PO PDF.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!loading && !error && tab === 'cancellation' && (
                <div className="space-y-3">
                  {cancellation ? (
                    <>
                      <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                        <p className="text-xs text-rose-600 mb-1">Reason</p>
                        <p className="text-sm text-rose-900">{cancellation.reason}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SoftDetailField label="Cancelled At" value={cancellation.cancelledAt} />
                        <SoftDetailField label="Cancelled By" value={cancellation.cancelledByName} />
                      </div>
                      <div>
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Attachments</p>
                        {cancellation.attachments.length === 0 ? (
                          <p className="text-sm text-slate-500">No attachments uploaded.</p>
                        ) : (
                          <div className="space-y-2">
                            {cancellation.attachments.map((file, idx) => (
                              <div
                                key={`${file.filePath || file.fileName || idx}`}
                                className={`${softDetailCard} px-3 py-2 text-sm font-medium text-[#2C3E50]`}
                              >
                                <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                                <span className="relative z-[1]">
                                  {file.fileName || file.filePath || `Attachment ${idx + 1}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No cancellation details available.</p>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
