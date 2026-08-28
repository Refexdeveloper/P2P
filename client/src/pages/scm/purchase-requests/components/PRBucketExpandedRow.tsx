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
  showCreatePo?: boolean;
  onCreatePo?: () => void;
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
  const styles = {
    entity: {
      box: 'bg-gradient-to-br from-indigo-50 via-indigo-50 to-violet-100/80 border-indigo-200',
      icon: 'bg-indigo-600 text-white',
      label: 'text-indigo-700',
      value: 'text-indigo-950',
    },
    address: {
      box: 'bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50 border-teal-200',
      icon: 'bg-teal-600 text-white',
      label: 'text-teal-700',
      value: 'text-teal-950',
    },
    notes: {
      box: 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-amber-200',
      icon: 'bg-amber-500 text-white',
      label: 'text-amber-800',
      value: 'text-amber-950',
    },
  }[tone];

  return (
    <div className={`rounded-xl border p-4 min-h-[108px] flex gap-3 ${styles.box} ${className}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${styles.icon}`}>
        <i className={`${icon} text-lg`}></i>
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${styles.label}`}>{label}</p>
        <p className={`text-sm font-semibold leading-relaxed whitespace-pre-wrap break-words ${styles.value}`}>
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
  showCreatePo = false,
  onCreatePo,
}: Props) {
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
            const poRes = await poApi.get(poId);
            if (cancelled) return;
            applyPoPayload(poRes.data as Record<string, unknown>);
            await loadRelatedDocs(
              poId,
              String((poRes.data as Record<string, unknown>).referencePoNumber || ''),
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
    ...(!isManualDoc
      ? [{ key: 'vendors' as const, label: 'Vendor Comparison', icon: 'ri-table-line' }]
      : []),
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
      <td colSpan={colSpan} className="p-0 max-w-0 bg-slate-50 border-b border-teal-100">
        <div className="min-w-0 w-full max-w-full px-2 sm:px-4 py-4 box-border">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100 gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="ri-file-list-3-line text-teal-600"></i>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900 truncate" title={pr ? `${pr.prNumber} — ${pr.title}` : undefined}>
                    {poSummary?.poNumber || poNumber || pr?.prNumber || (prId > 0 ? `PR #${prId}` : 'Document')}
                    {pr?.title ? ` — ${pr.title}` : title ? ` — ${title}` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isManualDoc ? 'Expanded WO / PO view (no PR)' : 'Expanded PR view'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                {showCreatePo && (
                  <button
                    type="button"
                    onClick={onCreatePo}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold"
                  >
                    Create PO
                  </button>
                )}
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 whitespace-nowrap">
                  {pr?.statusUI || statusLabel}
                </span>
              </div>
            </div>

            <div className="flex border-b border-gray-100 px-2 sm:px-5 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0 ${
                    tab === t.key
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  <i className={t.icon}></i>
                  {t.label}
                  {t.key === 'items' && pr ? ` (${pr.lineItems.length})` : ''}
                  {t.key === 'vendors' && comparison ? ` (${comparison.vendorCount})` : ''}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5 overflow-x-auto">
              {loading && (
                <div className="py-8 text-center text-sm text-gray-500">
                  <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2"></i>
                  Loading details...
                </div>
              )}

              {!loading && error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              {!loading && !error && pr && tab === 'details' && (
                <div className="space-y-4">
                  {poSummary ? (
                    <HighlightInfoCard
                      label="Entity / Location"
                      value={poSummary.entity}
                      icon="ri-building-2-line"
                      tone="entity"
                    />
                  ) : null}
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
                      ['Department', pr.department],
                      ['Requester', pr.requester],
                      ['Request Type', pr.requestType],
                      ['Request Category', pr.requestCategory],
                      ['Project Detail', pr.projectDetail],
                      ['Priority', pr.priority],
                      ['Required Date', pr.requiredDate || '—'],
                      ['Submitted', pr.submittedDate || '—'],
                      ['Total Amount', formatCurrency(pr.totalAmount)],
                      ['Status', pr.statusUI],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-3 min-w-0">
                        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-gray-900 break-words" title={String(value || '')}>
                          {value || '—'}
                        </p>
                      </div>
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
                    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">POC for Delivery</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {addressInfo.contactPersons || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">Project Manager at HO</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {addressInfo.projectManagerHo || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">GSTIN</p>
                      <p className="text-sm font-medium text-gray-900 font-mono break-words">
                        {addressInfo.gstin || '—'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 min-w-0 lg:col-span-2">
                      <p className="text-xs text-gray-500 mb-0.5">Invoicing Address</p>
                      <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                        {addressInfo.invoicingAddress || '—'}
                      </p>
                    </div>
                  </div>
                  <HighlightInfoCard
                    label="Special Notes"
                    value={pr.specialNotes}
                    icon="ri-sticky-note-line"
                    tone="notes"
                    className="min-h-[120px]"
                  />
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Business Justification
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words">
                      {pr.justification || 'No justification provided.'}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Manager &amp; L2 Comments
                    </h4>
                    <ManagerL2CommentsHighlight history={pr.approvalHistory} />
                  </div>
                  {comparison?.recommendedVendorName && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 break-words">
                      <i className="ri-star-fill mr-1"></i>
                      Recommended vendor: <strong>{comparison.recommendedVendorName}</strong>
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
                <div className="overflow-x-auto -mx-1">
                  {pr.lineItems.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No line items found</p>
                  ) : (
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-10">#</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-[140px]">Category</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-16">Qty</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Unit Price</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pr.lineItems.map((item, idx) => (
                          <tr key={item.id ?? idx} className="hover:bg-gray-50">
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
                        <tr className="bg-gray-50 border-t border-gray-200">
                          <td colSpan={5} className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase">
                            Grand Total
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-bold text-teal-700 tabular-nums whitespace-nowrap">
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
                    No vendor comparison data available for this PR
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
                      className="w-full h-[640px] border border-gray-200 rounded-lg bg-white"
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
                          <div key={label} className="bg-gray-50 rounded-lg p-3 min-w-0">
                            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                            <p className="text-sm font-medium text-gray-900 break-words">{value || '—'}</p>
                          </div>
                        ))}
                      </div>

                      {referencePo?.lineItems?.length ? (
                        <div className="overflow-x-auto">
                          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Reference line items</p>
                          <table className="w-full min-w-[640px] text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-10">#</th>
                                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-16">Qty</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Unit Price</th>
                                <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Total</th>
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
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Reference PO PDF</p>
                        {referencePdfUrl ? (
                          <iframe
                            title="Reference PO PDF"
                            src={referencePdfUrl}
                            className="w-full h-[640px] border border-gray-200 rounded-lg bg-white"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Cancelled At</p>
                          <p className="text-sm text-gray-900">{cancellation.cancelledAt || '—'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Cancelled By</p>
                          <p className="text-sm text-gray-900">{cancellation.cancelledByName || '—'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Attachments</p>
                        {cancellation.attachments.length === 0 ? (
                          <p className="text-sm text-gray-500">No attachments uploaded.</p>
                        ) : (
                          <div className="space-y-2">
                            {cancellation.attachments.map((file, idx) => (
                              <div key={`${file.filePath || file.fileName || idx}`} className="text-sm bg-gray-50 rounded-lg px-3 py-2">
                                {file.fileName || file.filePath || `Attachment ${idx + 1}`}
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
      </td>
    </tr>
  );
}
