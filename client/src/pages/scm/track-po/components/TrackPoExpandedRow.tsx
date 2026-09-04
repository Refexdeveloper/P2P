import { useEffect, useMemo, useState } from 'react';
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
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
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

function FieldCard({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
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
  if (!res.ok) throw new Error(`Could not open ${doc.fileName || 'file'}`);
  const buffer = await res.arrayBuffer();
  const sniffed = sniffPreview(buffer, res.headers.get('content-type') || '', doc.fileName);
  return { url: URL.createObjectURL(sniffed.blob), fileName: doc.fileName, kind: sniffed.kind };
}

export default function TrackPoExpandedRow({ row, colSpan = 10, standalone = false }: Props) {
  const [tab, setTab] = useState<
    'details' | 'documents' | 'history' | 'acceptance' | 'grn' | 'invoice'
  >('details');
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
        if (row.prId) {
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

    return docs;
  }, [row.poId, row.poNumber, po, comparison]);

  const detailFields = [
    ['PR Number', String(pr?.prNumber || row.prNumber || '—')],
    ['PO / WO Number', String(po?.poNumber || row.poNumber || '—')],
    [
      'PO Type',
      String(
        po?.purchaseTypeLabel ||
          row.purchaseTypeLabel ||
          (String(po?.purchaseType || row.purchaseType) === 'work_order' ? 'Work Order' : 'Purchase Order')
      ),
    ],
    ['Entity', String(po?.entity || pr?.entityName || row.entityName || '—')],
    ['Department', String(po?.department || pr?.department || row.department || '—')],
    ['Requester', String(pr?.requester || row.requester || '—')],
    ['Vendor', String(po?.vendorName || row.vendorName || '—')],
    ['Vendor Email', String(po?.vendorEmail || '—')],
    ['Amount', formatCurrency(Number(po?.grandTotal ?? pr?.totalAmount ?? row.amount) || 0)],
    ['Currency', String(po?.currency || pr?.currency || 'INR')],
    ['Payment Terms', String(po?.paymentTerms || '—')],
    ['Incoterms', String(po?.incoterms || '—')],
    ['Required / Delivery', String(po?.expectedDeliveryDate || pr?.requiredDate || row.requiredDate || '—')],
    ['Created By', String(po?.createdBy || '—')],
    ['Created / Submitted', String(po?.createdAt || pr?.submittedDate || row.createdAt || '—')],
    ['Status', String(po?.status || pr?.statusUI || row.statusLabel || '—')],
  ];

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
  const showAcceptanceTab = showFulfillmentTabs && isVendorAcceptanceFinished(po);
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
          ? 'bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'
          : 'm-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'
      }
    >
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">
                {row.prNumber || (row.prId ? `PR #${row.prId}` : 'Manual PO')}
                {row.poNumber ? ` · ${row.poNumber}` : ''}
              </p>
              <p className="text-xs text-gray-500 truncate">{row.title}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
              {row.statusLabel}
            </span>
          </div>

          <div className="flex border-b border-gray-100 px-3 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={t.icon}></i>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {loading && (
              <div className="py-8 text-center text-sm text-gray-500">
                <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2"></i>
                Loading details...
              </div>
            )}

            {!loading && error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {!loading && !error && tab === 'details' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {detailFields.map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 min-w-0">
                      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-900 break-words" title={value}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 min-w-0 lg:col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Site Address</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                      {siteAddress || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">Contact Persons</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                      {contactPersons || '—'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 min-w-0">
                    <p className="text-xs text-gray-500 mb-0.5">GSTIN</p>
                    <p className="text-sm font-medium text-gray-900 font-mono break-words">{gstin || '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 min-w-0 lg:col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Invoicing Address</p>
                    <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words">
                      {invoicingAddress || '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Special Instructions / Justification
                  </h4>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 break-words">
                    {String(po?.specialInstructions || pr?.justification || 'No justification provided.')}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Line Items ({lineItems.length})
                  </h4>
                  {lineItems.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No line items found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-10">#</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Item / Description</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-[140px]">Category</th>
                            <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-16">Qty</th>
                            <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-16">UOM</th>
                            <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Unit Price</th>
                            <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[110px]">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {lineItems.map((item, idx) => (
                            <tr key={item.id ?? idx} className="hover:bg-gray-50">
                              <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-medium text-gray-900 break-words">
                                {item.itemName || item.description || '—'}
                                {item.itemName && item.description && item.itemName !== item.description ? (
                                  <span className="block text-xs font-normal text-gray-500 whitespace-pre-line">
                                    {item.description}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 text-gray-700">{item.category || '—'}</td>
                              <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{item.quantity ?? '—'}</td>
                              <td className="px-3 py-2.5 text-gray-700">{item.unit || item.uom || '—'}</td>
                              <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap">
                                {formatCurrency(Number(item.unitPrice || 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
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
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Manager &amp; L2 Comments
                  </h4>
                  <ManagerL2CommentsHighlight history={history} />
                </div>
              </div>
            )}

            {!loading && !error && tab === 'documents' && (
              <div className="space-y-3">
                {fileError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{fileError}</div>
                )}
                {documents.length === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    No documents yet. Vendor quotations appear after RFQ, and PO files appear after the PO is created.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase w-[150px]">Type</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">File name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">Vendor / Notes</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase">File URL</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase w-[160px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {documents.map((doc) => (
                          <tr key={doc.key} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                                {doc.kind}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-medium text-gray-900 break-words">{doc.fileName}</td>
                            <td className="px-3 py-2.5 text-gray-600 break-words">
                              {[doc.vendor, doc.extra].filter(Boolean).join(' · ') || '—'}
                            </td>
                            <td className="px-3 py-2.5">
                              {doc.url ? (
                                <p className="text-xs text-teal-700 break-all" title={doc.url}>
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
                                  className="px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-40"
                                >
                                  {openingKey === doc.key ? 'Opening…' : 'Open'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!doc.url || Boolean(openingKey)}
                                  onClick={() => handleDownloadFile(doc)}
                                  className="px-2.5 py-1.5 bg-teal-600 text-white rounded-md text-xs font-semibold hover:bg-teal-700 disabled:opacity-40"
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
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {String(po?.vendorAcceptanceStatus || 'Recorded').replace(/_/g, ' ')}
                  </span>
                  {po?.vendorAcceptanceMode ? (
                    <span className="text-xs text-gray-500">via {String(po.vendorAcceptanceMode)}</span>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <FieldCard label="Accepted / responded at" value={String(po?.vendorAcceptedAt || '—')} />
                  <FieldCard
                    label="Delivery confirmed date"
                    value={String(po?.vendorDeliveryConfirmedDate || '—')}
                  />
                  <FieldCard label="Mode" value={String(po?.vendorAcceptanceMode || '—')} />
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Vendor remarks</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {String(po?.vendorAcceptanceRemarks || '—')}
                  </p>
                </div>
                {row.poId && String(po?.vendorAcceptanceFileName || '').trim() ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void handleOpenFile({
                          key: `accept-${row.poId}`,
                          kind: 'Vendor Acceptance',
                          name: String(po?.vendorAcceptanceFileName),
                          fileName: String(po?.vendorAcceptanceFileName),
                          url: poApi.getVendorAcceptanceFileUrl(row.poId!),
                        })
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg"
                    >
                      <i className="ri-file-line mr-1"></i>
                      View acceptance file
                    </button>
                    <span className="text-xs text-gray-500">{String(po?.vendorAcceptanceFileName)}</span>
                  </div>
                ) : null}
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
                {grn.remarks ? (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Remarks</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{grn.remarks}</p>
                  </div>
                ) : null}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    GRN line items ({grn.lineItems?.length || 0})
                  </h4>
                  {(grn.lineItems || []).length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No GRN lines</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Item</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Ordered</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Received</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Condition</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(grn.lineItems || []).map((li, idx) => (
                            <tr key={li.id || idx}>
                              <td className="px-3 py-2 text-gray-900">{li.description || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{li.orderedQty ?? '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{li.receivedQty ?? '—'}</td>
                              <td className="px-3 py-2">{li.condition || '—'}</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {formatCurrency(Number(li.total || 0))}
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
                      className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg"
                    >
                      <i className="ri-file-invoice-line mr-1"></i>
                      View invoice file
                    </button>
                    <span className="text-xs text-gray-500">
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
          <div className="p-4 border-b border-gray-200 flex justify-between items-center gap-3">
            <span className="font-semibold text-gray-900 truncate">{filePreview.fileName}</span>
            <div className="flex items-center gap-2">
              <a
                href={filePreview.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Open in new tab
              </a>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(filePreview.url);
                  setFilePreview(null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 text-xl cursor-pointer"
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
                className="w-full h-[75vh] border border-gray-200 rounded-lg bg-white"
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
      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-teal-100">
        {panel}
        {previewModal}
      </td>
    </tr>
  );
}
