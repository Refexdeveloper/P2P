import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ApprovalHistoryPanel, {
  ManagerL2CommentsHighlight,
  type ApprovalHistoryEntry,
} from '../../../../components/feature/ApprovalHistoryPanel';
import { poApi, prApi, rfqApi, accountsApi, type VendorComparisonData } from '../../../../services/api';
import { allQuotationFilesForRound } from '../../../../utils/quotationFiles';

type TrackRowLite = {
  prId: number;
  poId: number | null;
  prNumber: string;
  poNumber: string | null;
  title: string;
  department: string;
  requester: string;
  vendorName: string;
  amount: number;
  statusLabel: string;
  purchaseType?: string;
  purchaseTypeLabel?: string;
  entityName?: string;
  requiredDate: string;
  createdAt: string;
};

type LineItem = {
  id?: number | string;
  itemName?: string;
  description?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  uom?: string;
  unitPrice?: number;
  unitCost?: number;
  discount?: number;
  taxPercentage?: number;
  total?: number;
};

type DocRow = {
  key: string;
  kind: string;
  name: string;
  vendor?: string;
  extra?: string;
  fileName: string;
  url: string;
};

type Props = {
  row: TrackRowLite;
  colSpan?: number;
  /** Full-page layout (Financial Insights PO detail) — no table row wrapper */
  standalone?: boolean;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function pickText(...vals: Array<unknown>): string {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function htmlToPlain(html: string): string {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Scope of Work from PR field or PO letterhead terms clause. */
function extractScopeOfWork(
  pr: Record<string, unknown> | null | undefined,
  po: Record<string, unknown> | null | undefined
): string {
  const fromPr = String(pr?.scopeOfWork || pr?.scope_of_work || '').trim();
  if (fromPr) return fromPr;
  const clauses = Array.isArray(po?.termsClauses) ? (po!.termsClauses as Array<Record<string, unknown>>) : [];
  for (const c of clauses) {
    const header = String(c.termsHeader || c.header || '').toLowerCase();
    if (!header.includes('scope of work') && !header.includes('scope ofwork')) continue;
    const body = htmlToPlain(String(c.termsDescription || c.description || ''));
    if (body) return body;
  }
  return '';
}

/** Payment terms from PO column, PO terms details, or PR. */
function extractPaymentTerms(
  pr: Record<string, unknown> | null | undefined,
  po: Record<string, unknown> | null | undefined
): string {
  const details = (po?.poTermsDetails as Record<string, unknown> | undefined) || {};
  return pickText(
    po?.paymentTerms,
    po?.payment_terms,
    details.paymentTermsText,
    details.paymentTerms,
    pr?.paymentTerms,
    pr?.payment_terms
  );
}

function formatPoContacts(terms: Record<string, unknown>): string {
  const name = pickText(terms.siteContactPerson);
  const phone = pickText(terms.siteContactPhone);
  const email = pickText(terms.siteContactEmail);
  return [name, [phone, email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
}

function normalizeHistory(raw: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      stage: String(r.stage || ''),
      approver: String(r.approver || r.user || 'System'),
      user: String(r.user || r.approver || 'System'),
      role: String(r.role || ''),
      action: String(r.action || r.status || 'Updated'),
      status: String(r.status || r.action || ''),
      date: String(r.date || ''),
      remarks: String(r.remarks || ''),
    };
  });
}

function isPoPastApproval(statusRaw: unknown, statusLabel: string): boolean {
  const raw = String(statusRaw || '').toLowerCase();
  const label = String(statusLabel || '').toLowerCase();
  if (
    [
      'approved',
      'sent_to_vendor',
      'awaiting_grn',
      'grn_completed',
      'invoice_entry',
      'pending_accounts_approval',
      'approved_for_payment',
      'paid',
    ].includes(raw)
  ) {
    return true;
  }
  return (
    label.includes('approved') ||
    label.includes('vendor accept') ||
    label.includes('grn') ||
    label.includes('invoice') ||
    label.includes('paid') ||
    label.includes('pending vendor')
  );
}

function isVendorAcceptanceFinished(po: Record<string, unknown> | null): boolean {
  if (!po) return false;
  const status = String(po.vendorAcceptanceStatus || '').toLowerCase();
  if (['accepted', 'rejected', 'partial'].includes(status)) return true;
  if (String(po.vendorAcceptedAt || '').trim()) return true;
  if (String(po.vendorAcceptanceFileName || '').trim()) return true;
  return false;
}

/** Show Vendor Acceptance tab while pending or after response (PO/WO tracker). */
function shouldShowVendorAcceptanceTab(
  po: Record<string, unknown> | null,
  statusRaw: unknown
): boolean {
  if (!po) return false;
  if (isVendorAcceptanceFinished(po)) return true;
  const va = String(po.vendorAcceptanceStatus || '').toLowerCase();
  if (va === 'pending') return true;
  return String(statusRaw || '').toLowerCase() === 'sent_to_vendor';
}

type FulfillmentGrn = {
  id: number;
  grnNumber?: string;
  status?: string;
  receivedDate?: string | null;
  receivedBy?: string;
  inspectedBy?: string;
  remarks?: string;
  receivedValue?: number;
  lineItems?: Array<{
    id?: string;
    description?: string;
    orderedQty?: number;
    receivedQty?: number;
    unitPrice?: number;
    total?: number;
    condition?: string;
    attachments?: Array<{
      id: number;
      fileName: string;
      size?: number;
      mimeType?: string | null;
    }>;
  }>;
};

type FulfillmentInvoice = {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  submittedDate?: string;
  vendor?: string;
  status?: string;
  invoiceGrandTotal?: number;
  invoiceSubtotal?: number;
  invoiceGST?: number;
  grnNumber?: string;
  invoiceFileName?: string | null;
  hasInvoiceFile?: boolean;
  vendorInvoiceMode?: string | null;
  accountsRemarks?: string;
};

const softDetailCard =
  'relative min-w-0 overflow-hidden rounded-2xl border border-transparent bg-white p-3.5 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:p-4';

const softDetailWash = {
  background:
    'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
} as const;

function SoftDetailField({ label, value }: { label: string; value?: string | number | null }) {
  const display = value == null || value === '' ? '—' : String(value);
  return (
    <div className={softDetailCard}>
      <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
      <div className="relative z-[1]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-1.5 break-words whitespace-pre-wrap text-sm font-semibold text-[#2C3E50]">{display}</div>
      </div>
    </div>
  );
}

function FieldCard({ label, value }: { label: string; value?: string | number | null }) {
  return <SoftDetailField label={label} value={value} />;
}

function asLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    const itemName = htmlToPlain(String(r.itemName || ''));
    const description = htmlToPlain(String(r.description || r.itemName || ''));
    return {
      id: (r.id as number | string) ?? undefined,
      itemName,
      description,
      category: String(r.category || ''),
      quantity: Number(r.quantity) || 0,
      unit: String(r.unit || r.uom || ''),
      uom: String(r.uom || r.unit || ''),
      unitPrice: Number(r.unitPrice ?? r.unitCost) || 0,
      unitCost: Number(r.unitCost ?? r.unitPrice) || 0,
      discount: Number(r.discount) || 0,
      taxPercentage: Number(r.taxPercentage) || 0,
      total: Number(r.total ?? Number(r.quantity || 0) * Number(r.unitPrice ?? r.unitCost ?? 0)) || 0,
    };
  });
}

type PreviewKind = 'pdf' | 'html' | 'image' | 'other';

type FilePreview = {
  url: string;
  fileName: string;
  kind: PreviewKind;
};

function sniffPreview(buffer: ArrayBuffer, contentType: string, fileName: string): { blob: Blob; kind: PreviewKind } {
  const bytes = new Uint8Array(buffer);
  const magic = String.fromCharCode(bytes[0] || 0, bytes[1] || 0, bytes[2] || 0, bytes[3] || 0, bytes[4] || 0);
  if (magic.startsWith('%PDF')) {
    return { blob: new Blob([buffer], { type: 'application/pdf' }), kind: 'pdf' };
  }
  const head = new TextDecoder().decode(bytes.slice(0, 240));
  if (/<!doctype html|<html/i.test(head) || contentType.includes('text/html')) {
    return { blob: new Blob([buffer], { type: 'text/html;charset=utf-8' }), kind: 'html' };
  }
  const imageType =
    contentType.startsWith('image/')
      ? contentType
      : /\.png$/i.test(fileName)
        ? 'image/png'
        : /\.jpe?g$/i.test(fileName)
          ? 'image/jpeg'
          : /\.gif$/i.test(fileName)
            ? 'image/gif'
            : /\.webp$/i.test(fileName)
              ? 'image/webp'
              : '';
  if (imageType || bytes[0] === 0x89 || bytes[0] === 0xff) {
    return { blob: new Blob([buffer], { type: imageType || contentType || 'image/jpeg' }), kind: 'image' };
  }
  if (/\.pdf$/i.test(fileName)) {
    return { blob: new Blob([buffer], { type: 'application/pdf' }), kind: 'pdf' };
  }
  return { blob: new Blob([buffer], { type: contentType || 'application/octet-stream' }), kind: 'other' };
}

async function loadAuthPreview(doc: DocRow, poId: number | null): Promise<FilePreview> {
  if ((doc.kind === 'PO PDF' || doc.kind === 'PO Template') && poId) {
    if (doc.kind === 'PO Template') {
      const token = localStorage.getItem('p2p_token');
      const res = await fetch(poApi.getDocumentUrl(poId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not open PO template');
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      return { url: URL.createObjectURL(blob), fileName: doc.fileName, kind: 'html' };
    }
    const { blob, isHtml } = await poApi.fetchPreviewBlob(poId);
    return {
      url: URL.createObjectURL(blob),
      fileName: doc.fileName,
      kind: isHtml ? 'html' : 'pdf',
    };
  }

  const token = localStorage.getItem('p2p_token');
  const res = await fetch(doc.url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `Could not open ${doc.fileName || 'file'}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed?.message) message = parsed.message;
    } catch {
      if (text.trim()) message = text.slice(0, 180);
    }
    throw new Error(message);
  }
  const buffer = await res.arrayBuffer();
  const sniffed = sniffPreview(buffer, res.headers.get('content-type') || '', doc.fileName);
  return { url: URL.createObjectURL(sniffed.blob), fileName: doc.fileName, kind: sniffed.kind };
}

export default function TrackPoExpandedRow({ row, colSpan = 10, standalone = false }: Props) {
  const expandWrapRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [tab, setTab] = useState<
    'details' | 'documents' | 'history' | 'acceptance' | 'grn' | 'invoice'
  >('details');
  const acceptanceTabAutoOpened = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pr, setPr] = useState<Record<string, unknown> | null>(null);
  const [po, setPo] = useState<Record<string, unknown> | null>(null);
  const [comparison, setComparison] = useState<VendorComparisonData | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [grn, setGrn] = useState<FulfillmentGrn | null>(null);
  const [invoice, setInvoice] = useState<FulfillmentInvoice | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [fileError, setFileError] = useState('');
  const [openingKey, setOpeningKey] = useState('');

  /** Keep expand panel pinned to the visible table viewport (no horizontal scroll of details). */
  useEffect(() => {
    if (standalone) return;
    const el = expandWrapRef.current;
    if (!el) return;
    const scrollParent =
      (el.closest('[data-po-tracker-scroll]') as HTMLElement | null) ||
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
  }, [standalone]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const tasks: Promise<unknown>[] = [];
        if (row.prId) tasks.push(prApi.get(row.prId));
        if (row.poId) tasks.push(poApi.get(row.poId));
        if (row.prId) tasks.push(rfqApi.getComparison(row.prId));
        else if (row.poId) tasks.push(poApi.getComparison(row.poId));
        if (row.poId) tasks.push(poApi.fulfillment(row.poId));

        const results = await Promise.allSettled(tasks);
        if (cancelled) return;

        let prData: Record<string, unknown> | null = null;
        let poData: Record<string, unknown> | null = null;
        let cmpData: VendorComparisonData | null = null;
        let fulfillment: { grn: FulfillmentGrn | null; invoice: FulfillmentInvoice | null } = {
          grn: null,
          invoice: null,
        };
        let idx = 0;

        if (row.prId) {
          const prRes = results[idx++];
          if (prRes.status === 'fulfilled') {
            prData = (prRes.value as { data: Record<string, unknown> }).data;
          }
        }
        if (row.poId) {
          const poRes = results[idx++];
          if (poRes.status === 'fulfilled') {
            poData = (poRes.value as { data: Record<string, unknown> }).data;
          }
        }
        if (row.prId || row.poId) {
          const cmpRes = results[idx++];
          if (cmpRes.status === 'fulfilled') {
            cmpData = (cmpRes.value as { data: VendorComparisonData }).data;
          }
        }
        if (row.poId) {
          const fulRes = results[idx++];
          if (fulRes.status === 'fulfilled') {
            const data = (fulRes.value as { data: typeof fulfillment }).data;
            fulfillment = {
              grn: (data?.grn as FulfillmentGrn | null) || null,
              invoice: (data?.invoice as FulfillmentInvoice | null) || null,
            };
          }
        }

        setPr(prData);
        setPo(poData);
        setComparison(cmpData);
        setGrn(fulfillment.grn);
        setInvoice(fulfillment.invoice);

        const poHist = normalizeHistory(poData?.approvalHistory);
        const prHist = normalizeHistory(prData?.approvalHistory);
        setHistory(poHist.length ? poHist : prHist);

        if (!prData && !poData) {
          setError('Could not load PR / PO details');
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
    };
  }, [row.prId, row.poId]);

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview]);

  const lineItems = useMemo(() => {
    const fromPo = asLineItems(po?.lineItems);
    if (fromPo.length) return fromPo;
    return asLineItems(pr?.lineItems);
  }, [po, pr]);

  const documents = useMemo<DocRow[]>(() => {
    const docs: DocRow[] = [];
    if (row.poId) {
      const poNumber = String(po?.poNumber || row.poNumber || `PO-${row.poId}`);
      docs.push({
        key: `po-pdf-${row.poId}`,
        kind: 'PO PDF',
        name: `${poNumber} PDF`,
        extra: String(po?.signedPdfPath || po?.pdfPath || ''),
        fileName: `${poNumber}.pdf`,
        url: poApi.getPdfUrl(row.poId),
      });
      docs.push({
        key: `po-html-${row.poId}`,
        kind: 'PO Template',
        name: `${poNumber} HTML template`,
        extra: 'Live PO document template',
        fileName: `${poNumber}.html`,
        url: poApi.getDocumentUrl(row.poId),
      });
      const acceptanceName = String(po?.vendorAcceptanceFileName || '').trim();
      if (acceptanceName) {
        docs.push({
          key: `po-accept-${row.poId}`,
          kind: 'Vendor Acceptance',
          name: acceptanceName,
          extra: String(po?.vendorAcceptanceFilePath || ''),
          fileName: acceptanceName,
          url: poApi.getVendorAcceptanceFileUrl(row.poId),
        });
      }
    }

    (comparison?.vendors || []).forEach((vendor) => {
      vendor.rounds.forEach((round) => {
        const files = allQuotationFilesForRound(round);
        const list =
          files.length > 0
            ? files
            : round.hasQuotationFile || round.quotationFileName
              ? [
                  {
                    fileName: round.quotationFileName || `quotation-r${round.round}.pdf`,
                    extraFileId: null,
                    submissionId: round.submissionId,
                  },
                ]
              : [];
        list.forEach((file, fileIdx) => {
          docs.push({
            key: `quote-${round.submissionId}-${file.extraFileId || 'primary'}-${fileIdx}`,
            kind: 'Vendor Quotation',
            name: file.fileName,
            vendor: vendor.name,
            extra: `Round ${round.round}${vendor.isRecommended ? ' · Recommended' : ''}`,
            fileName: file.fileName,
            url: file.extraFileId
              ? rfqApi.quotationExtraFileUrl(file.extraFileId)
              : rfqApi.quotationFileUrl(round.submissionId),
          });
        });
      });
    });

    const cancelFiles = Array.isArray(po?.cancellationAttachments)
      ? (po?.cancellationAttachments as Array<Record<string, unknown>>)
      : [];
    cancelFiles.forEach((file, idx) => {
      const fileName = String(file.fileName || file.filePath || `cancellation-${idx + 1}`);
      const storedPath = String(file.filePath || '');
      docs.push({
        key: `cancel-${idx}`,
        kind: 'Cancellation',
        name: fileName,
        extra: storedPath || 'Cancellation attachment',
        fileName,
        url: row.poId ? poApi.getCancellationFileUrl(row.poId, idx) : '',
      });
    });

    if (invoice?.hasInvoiceFile && invoice.id) {
      docs.push({
        key: `inv-${invoice.id}`,
        kind: 'Invoice',
        name: String(invoice.invoiceFileName || `Invoice-${invoice.id}`),
        extra: String(invoice.invoiceNumber || ''),
        fileName: String(invoice.invoiceFileName || `invoice-${invoice.id}.pdf`),
        url: accountsApi.invoiceFileUrl(invoice.id),
      });
    }

    return docs;
  }, [row.poId, row.poNumber, po, comparison, invoice]);

  const detailFields = [
    ['PR Number', String(pr?.prNumber || row.prNumber || '—')],
    ['PO / WO Number', String(po?.poNumber || row.poNumber || '—')],
    [
      'Entity',
      pickText(
        po?.entity,
        pr?.entityCode && pr?.entityName ? `${pr.entityCode} — ${pr.entityName}` : '',
        pr?.entityName,
        pr?.entityCode,
        row.entityName
      ) || '—',
    ],
    [
      'PO Type',
      String(
        po?.purchaseTypeLabel ||
          row.purchaseTypeLabel ||
          (String(po?.purchaseType || row.purchaseType) === 'work_order' ? 'Work Order' : 'Purchase Order')
      ),
    ],
    ['Department', String(po?.department || pr?.department || row.department || '—')],
    ['Requester', String(pr?.requester || row.requester || '—')],
    ['Vendor', String(po?.vendorName || row.vendorName || '—')],
    ['Vendor Email', String(po?.vendorEmail || '—')],
    ['Amount', formatCurrency(Number(po?.grandTotal ?? pr?.totalAmount ?? row.amount) || 0)],
    ['Currency', String(po?.currency || pr?.currency || 'INR')],
    ['Payment Terms', extractPaymentTerms(pr, po) || '—'],
    ['Incoterms', String(po?.incoterms || '—')],
    ['Mode of Shipment', String(po?.modeOfShipment || po?.poTermsDetails?.modeOfShipment || '—')],
    ['Required / Delivery', String(po?.expectedDeliveryDate || pr?.requiredDate || row.requiredDate || '—')],
    ['Created By', String(po?.createdBy || '—')],
    ['Created / Submitted', String(po?.createdAt || pr?.submittedDate || row.createdAt || '—')],
    ['Status', String(po?.status || pr?.statusUI || row.statusLabel || '—')],
  ];

  const scopeOfWorkText = extractScopeOfWork(pr, po);

  const poTerms = (po?.poTermsDetails as Record<string, unknown> | undefined) || {};
  const siteAddress = pickText(poTerms.siteAddress, po?.deliveryAddress, pr?.placeOfDelivery);
  const contactPersons = pickText(formatPoContacts(poTerms), pr?.deliveryPoc);
  const invoicingAddress = pickText(
    htmlToPlain(String(poTerms.invoicingAddress || '')),
    htmlToPlain(String(pr?.billingAddress || ''))
  );
  const gstin = pickText(poTerms.buyerGstNo, pr?.billingGstNo).toUpperCase();

  const showFulfillmentTabs =
    Boolean(row.poId) && isPoPastApproval(po?.statusRaw, row.statusLabel);
  const showAcceptanceTab =
    showFulfillmentTabs && shouldShowVendorAcceptanceTab(po, po?.statusRaw);
  const acceptanceFinished = isVendorAcceptanceFinished(po);
  const showGrnTab = showFulfillmentTabs && Boolean(grn);
  const showInvoiceTab = showFulfillmentTabs && Boolean(invoice);

  const tabs = [
    { key: 'details' as const, label: 'PO Details', icon: 'ri-information-line' },
    {
      key: 'documents' as const,
      label: `Documents${documents.length ? ` (${documents.length})` : ''}`,
      icon: 'ri-folder-2-line',
    },
    ...(showAcceptanceTab
      ? [{ key: 'acceptance' as const, label: 'Vendor Acceptance', icon: 'ri-checkbox-circle-line' }]
      : []),
    ...(showGrnTab ? [{ key: 'grn' as const, label: 'GRN', icon: 'ri-truck-line' }] : []),
    ...(showInvoiceTab
      ? [{ key: 'invoice' as const, label: 'Invoice', icon: 'ri-file-invoice-line' }]
      : []),
    {
      key: 'history' as const,
      label: `Approval History${history.length ? ` (${history.length})` : ''}`,
      icon: 'ri-history-line',
    },
  ];

  useEffect(() => {
    const keys = new Set(tabs.map((t) => t.key));
    if (!keys.has(tab)) setTab('details');
  }, [tab, showAcceptanceTab, showGrnTab, showInvoiceTab]);

  // When vendor acceptance is completed, open that tab once after load
  useEffect(() => {
    acceptanceTabAutoOpened.current = false;
  }, [row.poId, row.prId]);

  useEffect(() => {
    if (
      !loading &&
      showAcceptanceTab &&
      acceptanceFinished &&
      !acceptanceTabAutoOpened.current
    ) {
      acceptanceTabAutoOpened.current = true;
      setTab('acceptance');
    }
  }, [loading, showAcceptanceTab, acceptanceFinished]);

  const handleOpenFile = async (doc: DocRow) => {
    if (!doc.url) {
      setFileError('File URL is not available');
      return;
    }
    setFileError('');
    setOpeningKey(doc.key);
    try {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
      const opened = await loadAuthPreview(doc, row.poId);
      setFilePreview(opened);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : `Failed to open ${doc.fileName}`);
    } finally {
      setOpeningKey('');
    }
  };

  const handleDownloadFile = async (doc: DocRow) => {
    if (!doc.url) {
      setFileError('File URL is not available');
      return;
    }
    setFileError('');
    setOpeningKey(`dl-${doc.key}`);
    try {
      const opened = await loadAuthPreview(doc, row.poId);
      const a = document.createElement('a');
      a.href = opened.url;
      const rawName = String(doc.fileName || 'document').replace(/^.*[/\\]/, '');
      a.download = rawName || `${row.poNumber || 'PO'}.pdf`;
      a.click();
      URL.revokeObjectURL(opened.url);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : `Failed to download ${doc.fileName}`);
    } finally {
      setOpeningKey('');
    }
  };

  const exportHistory = () => {
    const header = ['Stage', 'Approver', 'Role', 'Action', 'Date', 'Remarks'];
    const lines = history.map((h) =>
      [h.stage, h.approver || h.user || '', h.role || '', h.action || h.status || '', h.date, h.remarks || '']
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `approval-history-${row.poNumber || row.prNumber || row.prId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const panel = (
    <div
      className={
        standalone
          ? 'relative overflow-visible rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]'
          : 'relative box-border w-full max-w-full overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]'
      }
    >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
            }}
          />
          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-r from-white to-[#E3F2FD]/40 px-4 py-3.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#2C3E50]">
                <span className="text-[#1E88E5]">
                  {row.prNumber || (row.prId ? `PR #${row.prId}` : 'Manual PO')}
                </span>
                {(po?.poNumber || row.poNumber) ? ` · ${po?.poNumber || row.poNumber}` : ''}
              </p>
              <p className="truncate text-xs text-slate-500">{row.title}</p>
            </div>
            <span className="whitespace-nowrap rounded-lg bg-[#E3F2FD] px-2.5 py-1 text-xs font-semibold text-[#1E88E5]">
              {row.statusLabel}
            </span>
          </div>

          <div className="relative z-[1] flex flex-wrap gap-x-1 border-b border-slate-100/80 px-2 sm:px-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors sm:px-4 ${
                  tab === t.key
                    ? 'border-[#1E88E5] text-[#1E88E5]'
                    : 'border-transparent text-slate-500 hover:text-[#2C3E50]'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
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
            {fileError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{fileError}</div>
            )}

            {!loading && !error && tab === 'details' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {detailFields.map(([label, value]) => (
                    <SoftDetailField key={label} label={label} value={value} />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <SoftDetailField label="Site Address" value={siteAddress} />
                  </div>
                  <SoftDetailField label="Contact Persons" value={contactPersons} />
                  <SoftDetailField label="GSTIN" value={gstin} />
                  <div className="lg:col-span-2">
                    <SoftDetailField label="Invoicing Address" value={invoicingAddress} />
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Scope of Work
                  </h4>
                  <div className={softDetailCard}>
                    <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                    <p className="relative z-[1] min-h-[80px] break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2C3E50]">
                      {scopeOfWorkText || '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Special Instructions / Justification
                  </h4>
                  <div className={softDetailCard}>
                    <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                    <p className="relative z-[1] min-h-[80px] break-words whitespace-pre-wrap text-sm leading-relaxed text-[#2C3E50]">
                      {String(po?.specialInstructions || pr?.justification || 'No justification provided.')}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Line Items ({lineItems.length})
                  </h4>
                  {lineItems.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No line items found</p>
                  ) : (
                    <div className="w-full min-w-0">
                      <table className="w-full table-fixed text-sm">
                        <thead className="border-b border-slate-100 bg-[#F8FBFF]">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-10">#</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Item / Description</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[140px]">Category</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-16">Qty</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-16">UOM</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Unit Price</th>
                            <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[110px]">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lineItems.map((item, idx) => (
                            <tr key={item.id ?? idx} className="hover:bg-[#E3F2FD]/35">
                              <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-medium text-[#2C3E50] break-words">
                                {item.itemName || item.description || '—'}
                                {item.itemName && item.description && item.itemName !== item.description ? (
                                  <span className="block text-xs font-normal text-slate-500 whitespace-pre-line">
                                    {item.description}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">{item.category || '—'}</td>
                              <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">{item.quantity ?? '—'}</td>
                              <td className="px-3 py-2.5 text-slate-700">{item.unit || item.uom || '—'}</td>
                              <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums whitespace-nowrap">
                                {formatCurrency(Number(item.unitPrice || 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-[#2C3E50] tabular-nums whitespace-nowrap">
                                {formatCurrency(Number(item.total || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Manager &amp; L2 Comments
                  </h4>
                  <ManagerL2CommentsHighlight history={history} />
                </div>
              </div>
            )}

            {!loading && !error && tab === 'documents' && (
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    No documents yet. Vendor quotations appear after RFQ, and PO files appear after the PO is created.
                  </p>
                ) : (
                  <div className="w-full min-w-0">
                    <table className="w-full table-fixed text-sm">
                      <thead className="border-b border-slate-100 bg-[#F8FBFF]">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[150px]">Type</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">File name</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Vendor / Notes</th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">File URL</th>
                          <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 w-[160px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {documents.map((doc) => (
                          <tr key={doc.key} className="hover:bg-[#E3F2FD]/35">
                            <td className="px-3 py-2.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                {doc.kind}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-[#2C3E50] break-words">{doc.fileName}</td>
                            <td className="px-3 py-2.5 text-slate-600 break-words">
                              {[doc.vendor, doc.extra].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              {doc.url ? (
                                <p className="text-xs text-[#1E88E5] break-all" title={doc.url}>
                                  {doc.url}
                                </p>
                              ) : (
                                <span className="text-xs text-gray-400">No URL</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={!doc.url || Boolean(openingKey)}
                                  onClick={() => handleOpenFile(doc)}
                                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium hover:bg-[#E3F2FD]/35 disabled:opacity-40"
                                >
                                  {openingKey === doc.key ? 'Opening…' : 'Open'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!doc.url || Boolean(openingKey)}
                                  onClick={() => handleDownloadFile(doc)}
                                  className="px-2.5 py-1.5 bg-[#1E88E5] text-white rounded-md text-xs font-semibold hover:bg-[#1565C0] disabled:opacity-40"
                                >
                                  {openingKey === `dl-${doc.key}` ? 'Saving…' : 'Download'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && tab === 'acceptance' && showAcceptanceTab && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                      String(po?.vendorAcceptanceStatus || '').toLowerCase() === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : acceptanceFinished
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {String(
                      po?.vendorAcceptanceStatus || (acceptanceFinished ? 'Recorded' : 'pending')
                    ).replace(/_/g, ' ')}
                  </span>
                  {po?.vendorAcceptanceMode ? (
                    <span className="text-xs text-slate-500">via {String(po.vendorAcceptanceMode)}</span>
                  ) : null}
                </div>
                {!acceptanceFinished ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Awaiting vendor acceptance. Record it from{' '}
                    <span className="font-semibold">Vendor PO Acceptance</span>. After accept:
                    GRN, then Invoice.
                  </div>
                ) : null}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <FieldCard label="Accepted / responded at" value={String(po?.vendorAcceptedAt || '—')} />
                  <FieldCard
                    label="Delivery confirmed date"
                    value={String(po?.vendorDeliveryConfirmedDate || '—')}
                  />
                  <FieldCard label="Mode" value={String(po?.vendorAcceptanceMode || '—')} />
                </div>
                <SoftDetailField
                  label="Vendor remarks"
                  value={String(po?.vendorAcceptanceRemarks || '—')}
                />
                <div className={`${softDetailCard} p-4`}>
                  <div className="pointer-events-none absolute inset-0" style={softDetailWash} />
                  <div className="relative z-[1]">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Vendor signed / acceptance file
                  </p>
                  {row.poId && String(po?.vendorAcceptanceFileName || '').trim() ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2C3E50] min-w-0">
                        <i className="ri-file-pdf-2-line text-[#1E88E5] shrink-0"></i>
                        <span className="truncate">{String(po?.vendorAcceptanceFileName)}</span>
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(openingKey)}
                        onClick={() =>
                          void handleOpenFile({
                            key: `accept-${row.poId}`,
                            kind: 'Vendor Acceptance',
                            name: String(po?.vendorAcceptanceFileName),
                            fileName: String(po?.vendorAcceptanceFileName),
                            url: poApi.getVendorAcceptanceFileUrl(row.poId!),
                          })
                        }
                        className="cursor-pointer rounded-xl border border-[#BBDEFB] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E88E5] hover:bg-[#E3F2FD] disabled:opacity-40"
                      >
                        {openingKey === `accept-${row.poId}` ? 'Opening…' : 'Open'}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(openingKey)}
                        onClick={() =>
                          void handleDownloadFile({
                            key: `accept-${row.poId}`,
                            kind: 'Vendor Acceptance',
                            name: String(po?.vendorAcceptanceFileName),
                            fileName: String(po?.vendorAcceptanceFileName),
                            url: poApi.getVendorAcceptanceFileUrl(row.poId!),
                          })
                        }
                        className="cursor-pointer rounded-xl bg-[#1E88E5] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1565C0] disabled:opacity-40"
                      >
                        {openingKey === `dl-accept-${row.poId}` ? 'Saving…' : 'Download'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {acceptanceFinished
                        ? 'No acceptance file uploaded for this PO / WO.'
                        : 'No acceptance file yet — upload when recording acceptance.'}
                    </p>
                  )}
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && tab === 'grn' && grn && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FieldCard label="GRN Number" value={grn.grnNumber} />
                  <FieldCard label="Status" value={grn.status} />
                  <FieldCard label="Received date" value={grn.receivedDate} />
                  <FieldCard
                    label="Received value"
                    value={formatCurrency(Number(grn.receivedValue || 0))}
                  />
                  <FieldCard label="Received by" value={grn.receivedBy} />
                  <FieldCard label="Inspected by" value={grn.inspectedBy} />
                </div>
                {grn.remarks ? <SoftDetailField label="Remarks" value={grn.remarks} /> : null}
                <div>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    GRN line items ({grn.lineItems?.length || 0})
                  </h4>
                  {(grn.lineItems || []).length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No GRN lines</p>
                  ) : (
                    <div className="w-full min-w-0">
                      <table className="w-full table-fixed text-sm">
                        <thead className="border-b border-slate-100 bg-[#F8FBFF]">
                          <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Item</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Ordered</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Received</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Condition</th>
                            <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Total</th>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Attachments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(grn.lineItems || []).map((li, idx) => (
                            <tr key={li.id || idx}>
                              <td className="px-3 py-2 text-[#2C3E50]">{li.description || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{li.orderedQty ?? '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{li.receivedQty ?? '—'}</td>
                              <td className="px-3 py-2">{li.condition || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCurrency(Number(li.total || 0))}
                              </td>
                              <td className="px-3 py-2">
                                {(li.attachments || []).length === 0 ? (
                                  <span className="text-xs text-gray-400">—</span>
                                ) : (
                                  <div className="flex flex-col gap-1.5">
                                    {(li.attachments || []).map((file) => (
                                      <button
                                        key={file.id}
                                        type="button"
                                        disabled={openingKey === `grn-att-${file.id}`}
                                        onClick={() =>
                                          void handleOpenFile({
                                            key: `grn-att-${file.id}`,
                                            kind: 'GRN Attachment',
                                            name: file.fileName,
                                            fileName: file.fileName,
                                            url: accountsApi.grnLineAttachmentUrl(file.id),
                                          })
                                        }
                                        className="text-left text-xs font-semibold text-[#1E88E5] hover:underline disabled:opacity-50 cursor-pointer"
                                      >
                                        {openingKey === `grn-att-${file.id}`
                                          ? 'Opening…'
                                          : file.fileName}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!loading && !error && tab === 'invoice' && invoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <FieldCard label="Invoice number" value={invoice.invoiceNumber} />
                  <FieldCard label="Status" value={invoice.status} />
                  <FieldCard label="Invoice date" value={invoice.invoiceDate} />
                  <FieldCard label="Submitted" value={invoice.submittedDate} />
                  <FieldCard label="Vendor" value={invoice.vendor} />
                  <FieldCard label="GRN" value={invoice.grnNumber} />
                  <FieldCard
                    label="Invoice total"
                    value={formatCurrency(Number(invoice.invoiceGrandTotal || 0))}
                  />
                  <FieldCard label="Entry mode" value={invoice.vendorInvoiceMode || '—'} />
                </div>
                {invoice.accountsRemarks ? (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-xs text-amber-700 mb-0.5">Accounts remarks</p>
                    <p className="text-sm text-amber-950 whitespace-pre-wrap">{invoice.accountsRemarks}</p>
                  </div>
                ) : null}
                {invoice.hasInvoiceFile && invoice.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleOpenFile({
                          key: `inv-${invoice.id}`,
                          kind: 'Invoice',
                          name: String(invoice.invoiceFileName || `Invoice-${invoice.id}`),
                          fileName: String(invoice.invoiceFileName || `invoice-${invoice.id}.pdf`),
                          url: accountsApi.invoiceFileUrl(invoice.id),
                        })
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-[#1E88E5] bg-[#E3F2FD] border border-[#BBDEFB] rounded-lg"
                    >
                      <i className="ri-file-invoice-line mr-1"></i>
                      View invoice file
                    </button>
                    <span className="text-xs text-slate-500">
                      {invoice.invoiceFileName || `Invoice #${invoice.id}`}
                    </span>
                  </div>
                ) : null}
              </div>
            )}

            {!loading && !error && tab === 'history' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={exportHistory}
                    disabled={!history.length}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <i className="ri-download-2-line"></i>
                    Export history
                  </button>
                </div>
                <ManagerL2CommentsHighlight history={history} />
                <ApprovalHistoryPanel history={history} />
              </div>
            )}
          </div>
    </div>
  );

  const previewModal =
    filePreview &&
    createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center gap-3">
            <span className="font-semibold text-[#2C3E50] truncate">{filePreview.fileName}</span>
            <div className="flex items-center gap-2">
              <a
                href={filePreview.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#E3F2FD]/35"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(filePreview.url);
                  setFilePreview(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E3F2FD] text-slate-500 text-xl cursor-pointer"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto bg-slate-50">
            {filePreview.kind === 'image' ? (
              <img src={filePreview.url} alt={filePreview.fileName} className="max-h-[75vh] mx-auto rounded-lg" />
            ) : (
              <iframe
                title="Document preview"
                src={filePreview.url}
                className="w-full h-[75vh] rounded-xl border border-transparent shadow-[0_8px_24px_-12px_rgba(15,23,42,0.10)] bg-white"
              />
            )}
          </div>
        </div>
      </div>,
      document.body
    );

  if (standalone) {
    return (
      <>
        {panel}
        {previewModal}
      </>
    );
  }

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
            {panel}
          </div>
          {previewModal}
        </div>
      </td>
    </tr>
  );
}
