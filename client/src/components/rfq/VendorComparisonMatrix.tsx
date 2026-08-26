import { Fragment, useCallback, useState } from 'react';
import { rfqApi, type VendorComparisonData } from '../../services/api';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount || 0);

const formatNum = (amount: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount || 0);

const GST_RATE = 0.18;
const PRICE_PARAM_IDS = new Set(['quotedPrice']);
const SCORE_PARAM_IDS = new Set(['technicalScore', 'commercialScore', 'overallScore']);

function isMakeLikeParam(p: { id: string; label: string }) {
  return /make|brand/i.test(p.id) || /make|brand/i.test(p.label);
}

function isHdgParam(p: { id: string; label: string }) {
  return /^(hdg|hdg3)$/i.test(p.id) || /^hdg\b/i.test(p.label);
}

function isFreightParam(p: { id: string; label: string }) {
  return /freight/i.test(p.id) || /freight/i.test(p.label);
}

function paramKeys(p: { id: string; label: string }) {
  return [p.id, p.label, p.id.toLowerCase(), p.label.replace(/\s+/g, '')];
}

const VENDOR_THEMES = [
  { bar: 'bg-teal-600 text-white border-teal-700', soft: 'bg-teal-50/70', head: 'bg-teal-100 text-teal-950 border-teal-200', text: 'text-teal-950' },
  { bar: 'bg-violet-600 text-white border-violet-700', soft: 'bg-violet-50/70', head: 'bg-violet-100 text-violet-950 border-violet-200', text: 'text-violet-950' },
  { bar: 'bg-sky-600 text-white border-sky-700', soft: 'bg-sky-50/70', head: 'bg-sky-100 text-sky-950 border-sky-200', text: 'text-sky-950' },
  { bar: 'bg-rose-500 text-white border-rose-600', soft: 'bg-rose-50/70', head: 'bg-rose-100 text-rose-950 border-rose-200', text: 'text-rose-950' },
  { bar: 'bg-indigo-600 text-white border-indigo-700', soft: 'bg-indigo-50/70', head: 'bg-indigo-100 text-indigo-950 border-indigo-200', text: 'text-indigo-950' },
  { bar: 'bg-orange-500 text-white border-orange-600', soft: 'bg-orange-50/70', head: 'bg-orange-100 text-orange-950 border-orange-200', text: 'text-orange-950' },
];

function vendorTheme(index: number) {
  return VENDOR_THEMES[Math.abs(index) % VENDOR_THEMES.length];
}

function columnFill(isBest: boolean, isRec: boolean, themeSoft: string, extra = '') {
  if (isBest) return `bg-amber-50 border-amber-200 ${extra}`;
  if (isRec) return `bg-emerald-50/80 border-emerald-100 ${extra}`;
  return `${themeSoft} border-[#E5EAF0] ${extra}`;
}

type QuoteLine = {
  lineItemId?: string | number;
  description?: string;
  quantity?: number;
  quotedUnitPrice?: number;
  quotedTotal?: number;
  gstPercent?: number;
};

type RevColumn = {
  key: string;
  vendorId: number;
  vendorName: string;
  vendorIndex: number;
  round: number;
  revisionLabel: string;
  isRecommended: boolean;
  isLatest: boolean;
  values: Record<string, unknown>;
  submissionId?: number;
  quotationFileName?: string;
  hasQuotationFile?: boolean;
};

interface Props {
  data: VendorComparisonData;
  selectedVendorId?: number | null;
  onSelectVendor?: (id: number) => void;
  onPreviewFile?: (submissionId: number, vendorName: string, fileName: string) => void;
  compact?: boolean;
}

function revisionLabel(round: number) {
  return `Quote ${Math.max(1, round)}`;
}

function formatDisplayDate(raw?: string | null) {
  if (!raw) return '—';
  // already dd.mm.yyyy or dd/mm/yyyy
  if (/^\d{2}[.\/]\d{2}[.\/]\d{4}/.test(raw)) return raw.replace(/\//g, '.');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function money(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function exclusiveFromInclusive(inclusive: number, gstRate = GST_RATE) {
  const gross = Number(inclusive) || 0;
  if (gross <= 0 || gstRate <= 0) return { amount: money(gross), gst: 0 };
  const amount = money(gross / (1 + gstRate));
  return { amount, gst: money(gross - amount) };
}

function lineExGst(ql: QuoteLine, prQty: number) {
  const rate = Number(ql.quotedUnitPrice) || 0;
  const qty = Number(ql.quantity) || prQty || 0;
  const amount = money(rate * qty);
  const gstPercent =
    ql.gstPercent != null && String(ql.gstPercent) !== ''
      ? Math.max(0, Number(ql.gstPercent) || 0)
      : GST_RATE * 100;
  const gst = money(amount * (gstPercent / 100));
  return { rate, amount, qty, gst, gstPercent };
}

function findQuoteLine(values: Record<string, unknown>, lineId: string, description: string): QuoteLine | null {
  const lines = (Array.isArray(values.quoteLineItems) ? values.quoteLineItems : []) as QuoteLine[];
  if (!lines.length) return null;
  return (
    lines.find((l) => String(l.lineItemId) === String(lineId)) ||
    lines.find((l) => String(l.description || '').toLowerCase() === description.toLowerCase()) ||
    null
  );
}

function cellExtra(
  values: Record<string, unknown>,
  keys: string[]
): { kind: 'number' | 'text' | 'empty'; value: number | string } {
  for (const key of keys) {
    const raw = values[key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (typeof raw === 'number') return { kind: 'number', value: raw };
    const text = String(raw).trim();
    if (!text) continue;
    const asNum = Number(text.replace(/[,₹\s]/g, ''));
    if (!Number.isNaN(asNum) && /^-?\d/.test(text.replace(/[₹,\s]/g, ''))) {
      return { kind: 'number', value: asNum };
    }
    return { kind: 'text', value: text };
  }
  return { kind: 'empty', value: '' };
}

function statusValueDisplay(extra: { kind: 'number' | 'text' | 'empty'; value: number | string }) {
  if (extra.kind === 'empty') return { mode: 'empty' as const };
  if (extra.kind === 'number') {
    return { mode: 'number' as const, value: Number(extra.value) };
  }
  const text = String(extra.value);
  const lower = text.toLowerCase();
  if (lower.includes('include')) return { mode: 'included' as const, value: text };
  if (lower.includes('extra')) return { mode: 'extra' as const, value: text };
  return { mode: 'text' as const, value: text };
}

const cardClass =
  'bg-white rounded-2xl border border-[#E5EAF0] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden min-w-0 max-w-full';

const stickyEdge = 'md:shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)]';

/** Sticky helpers — mobile: Sr + Description only (~168px); desktop: all 4 (~320px) */
const stSr = `sticky left-0 z-30 w-11 min-w-[44px] md:w-12 md:min-w-[48px] bg-inherit align-middle ${stickyEdge}`;
const stDesc = `sticky left-11 md:left-12 z-30 w-[140px] min-w-[140px] md:w-[220px] md:min-w-[220px] bg-inherit align-middle ${stickyEdge}`;
const stQty = `hidden md:table-cell md:sticky md:left-[268px] md:z-30 md:w-14 md:min-w-[56px] bg-inherit align-middle`;
const stUom = `hidden md:table-cell md:sticky md:left-[324px] md:z-30 md:w-14 md:min-w-[56px] bg-inherit align-middle ${stickyEdge}`;

/** Unit price / Amount — fixed so Quote 1/2/3 stay aligned; leftover width goes to filler col */
const colUnit = 'w-[112px] min-w-[112px] max-w-[128px] align-middle';
const colAmount = 'w-[128px] min-w-[128px] max-w-[148px] align-middle';
/** Absorbs leftover viewport so 1–2 quote columns don’t stretch Unit/Amount apart */
const colFiller = 'border-b border-[#E5EAF0] bg-white p-0 w-full min-w-0';
/** Other-terms sticky label ≈ Sr+Desc+Qty+UOM */
const stOtherLabel = `sticky left-0 z-20 w-[324px] min-w-[324px] md:w-[380px] md:min-w-[380px] bg-inherit align-middle ${stickyEdge}`;
/** Match Unit+Amount pair width so Other terms lines up under price columns */
const colRev = 'w-[240px] min-w-[240px] max-w-[276px] align-middle';

async function fetchQuoteBlob(submissionId: number) {
  const token = localStorage.getItem('p2p_token');
  const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let message = 'Could not load quotation file';
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {
      /* keep */
    }
    throw new Error(message);
  }
  return res.blob();
}

function resolveQuoteFile(
  col: RevColumn | undefined,
  vendor: VendorComparisonData['vendors'][number]
) {
  const submissionId =
    Number(col?.submissionId || (col?.isLatest ? vendor.latestSubmissionId : 0)) || 0;
  const fileName = String(
    col?.quotationFileName || (col?.isLatest ? vendor.quotationFileName : '') || ''
  ).trim();
  const hasFile = Boolean(
    submissionId &&
      (fileName ||
        col?.hasQuotationFile ||
        (col?.isLatest && (vendor.hasQuotationFile || vendor.quotationFileName)))
  );
  return { submissionId, fileName: fileName || 'quotation.pdf', hasFile };
}

export default function VendorComparisonMatrix({
  data,
  selectedVendorId,
  onSelectVendor,
  onPreviewFile,
  compact = false,
}: Props) {
  const { pr, vendors, parameters, recommendedVendorId } = data;
  const activeVendorId = selectedVendorId ?? recommendedVendorId;
  const recommendationJustification = String(data.recommendationJustification || '').trim();
  const lineItems = pr.lineItems || [];
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');

  const openQuoteFile = useCallback(
    async (submissionId: number, vendorName: string, fileName: string, mode: 'view' | 'download') => {
      setFileError('');
      setFileBusy(`${submissionId}-${mode}`);
      try {
        if (mode === 'view' && onPreviewFile) {
          onPreviewFile(submissionId, vendorName, fileName);
          return;
        }
        const blob = await fetchQuoteBlob(submissionId);
        const url = URL.createObjectURL(blob);
        if (mode === 'download') {
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName || 'quotation.pdf';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 15000);
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        }
      } catch (err) {
        setFileError(err instanceof Error ? err.message : `Could not ${mode} quotation file`);
      } finally {
        setFileBusy(null);
      }
    },
    [onPreviewFile]
  );

  const totalRounds = Math.max(
    Number(data.totalRounds) || 0,
    ...vendors.map((v) => Math.max(Number(v.round) || 0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    1
  );

  const revColumns: RevColumn[] = [];
  vendors.forEach((vendor, vendorIndex) => {
    const rounds = [...(vendor.rounds || [])].sort((a, b) => a.round - b.round);
    const byRound = new Map<number, (typeof rounds)[number]>();
    for (const r of rounds) {
      byRound.set(Number(r.round) || 1, r);
    }
    if (byRound.size === 0 && vendor.latestSubmissionId) {
      const rnum = Number(vendor.round) || 1;
      byRound.set(rnum, {
        round: rnum,
        values: vendor.latest || {},
        submissionId: vendor.latestSubmissionId,
        quotationFileName: vendor.quotationFileName || '',
        hasQuotationFile: Boolean(vendor.hasQuotationFile || vendor.quotationFileName),
        submittedAt: '',
      });
    }
    if (byRound.size === 0) return;

    const latestRound = Math.max(...byRound.keys());
    // Only real quotation rounds for this vendor (e.g. Rev 00 + Rev 01 after Send Back)
    const vendorRoundNums = [...byRound.keys()].sort((a, b) => a - b);

    for (const roundNum of vendorRoundNums) {
      const r = byRound.get(roundNum)!;
      revColumns.push({
        key: `${vendor.id}-r${roundNum}`,
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorIndex,
        round: roundNum,
        revisionLabel: revisionLabel(roundNum),
        isRecommended: vendor.isRecommended,
        isLatest: roundNum === latestRound,
        values: (r.values || {}) as Record<string, unknown>,
        submissionId: r.submissionId,
        quotationFileName: r.quotationFileName || (roundNum === latestRound ? vendor.quotationFileName : '') || '',
        hasQuotationFile: Boolean(
          r.hasQuotationFile ||
            r.quotationFileName ||
            (roundNum === latestRound && (vendor.hasQuotationFile || vendor.quotationFileName))
        ),
      });
    }
  });

  const vendorGroups = vendors
    .map((v, vendorIndex) => ({
      vendor: v,
      vendorIndex,
      theme: vendorTheme(vendorIndex),
      cols: revColumns.filter((c) => c.vendorId === v.id),
    }))
    .filter((g) => g.cols.length > 0);

  const commercialParams = parameters.filter((p) => !PRICE_PARAM_IDS.has(p.id));
  const paramShowIn = (p: { id: string; label: string; showIn?: string }) =>
    p.showIn === 'commercial' || p.showIn === 'technical'
      ? p.showIn
      : isMakeLikeParam(p) || isHdgParam(p) || isFreightParam(p)
        ? 'commercial'
        : 'technical';

  /** RFQ fields assigned to Comparison Sheet (Commercial) */
  const commercialSheetParams = commercialParams.filter(
    (p) => !SCORE_PARAM_IDS.has(p.id) && paramShowIn(p) === 'commercial'
  );
  /** RFQ fields assigned to Technical Specification */
  const technicalSheetParams = commercialParams.filter(
    (p) => !SCORE_PARAM_IDS.has(p.id) && paramShowIn(p) === 'technical'
  );
  const dynamicRfqLabels = commercialSheetParams;
  const sheetMakeParams = commercialSheetParams.filter(
    (p) => isMakeLikeParam(p) || (!isHdgParam(p) && !isFreightParam(p))
  );
  const sheetCostParams = commercialSheetParams.filter((p) => isHdgParam(p) || isFreightParam(p));
  // Any commercial field that isn't make-like and isn't cost goes with make block (before GST)
  const hdgParam = commercialSheetParams.find(isHdgParam) || null;
  const freightParam = commercialSheetParams.find(isFreightParam) || null;

  const getLineRateAmount = (col: RevColumn, lineId: string, description: string, prQty: number) => {
    const ql = findQuoteLine(col.values, lineId, description);
    if (ql) return lineExGst(ql, prQty);
    if (lineItems.length === 1) {
      const inclusive = Number(col.values.quotedPrice) || 0;
      const qty = prQty || 1;
      const { amount, gst } = exclusiveFromInclusive(inclusive);
      return { rate: qty ? money(amount / qty) : amount, amount, qty, gst, gstPercent: GST_RATE * 100 };
    }
    return { rate: 0, amount: 0, qty: prQty, gst: 0, gstPercent: GST_RATE * 100 };
  };

  const colTotals = revColumns.map((col) => {
    let material = 0;
    let gst = 0;
    const gstPercents: number[] = [];
    if (lineItems.length) {
      for (const li of lineItems) {
        const row = getLineRateAmount(col, String(li.id), li.description, Number(li.quantity) || 0);
        material += row.amount;
        gst += row.gst;
        if (row.amount > 0) gstPercents.push(row.gstPercent);
      }
    } else {
      const stripped = exclusiveFromInclusive(Number(col.values.quotedPrice) || 0);
      material = stripped.amount;
      gst = stripped.gst;
      if (material > 0) gstPercents.push(GST_RATE * 100);
    }
    material = money(material);
    gst = money(gst);
    const hdg = hdgParam
      ? cellExtra(col.values, paramKeys(hdgParam))
      : ({ kind: 'empty', value: '' } as const);
    const freight = freightParam
      ? cellExtra(col.values, paramKeys(freightParam))
      : ({ kind: 'empty', value: '' } as const);
    const hdgNum = hdg.kind === 'number' ? Number(hdg.value) : 0;
    const freightNum = freight.kind === 'number' ? Number(freight.value) : 0;
    const landed = money(material + gst + hdgNum + freightNum);
    return { material, gst, hdg, freight, landed, gstPercents };
  });

  const gstRowLabel = (() => {
    const uniq = [...new Set(colTotals.flatMap((t) => t.gstPercents))];
    if (uniq.length === 1) return `Add: GST ${uniq[0]}%`;
    return 'Add: GST';
  })();

  const bestLanded = colTotals
    .map((t) => t.landed)
    .filter((n) => n > 0)
    .reduce((min, n) => (min === null || n < min ? n : min), null as number | null);

  const columnMeta = revColumns.map((col, i) => {
    const t = colTotals[i];
    const isBest = bestLanded != null && t.landed > 0 && t.landed === bestLanded;
    const isRecRev = Boolean(col.isRecommended && col.isLatest);
    const theme = vendorTheme(col.vendorIndex);
    return { col, t, isBest, isRecRev, theme };
  });
  const bestMeta = columnMeta.find((c) => c.isBest) || null;
  const needsSideScroll = columnMeta.length >= 3;

  const displayLines =
    lineItems.length > 0
      ? lineItems
      : [
          {
            id: 'total',
            description: 'Quoted total',
            category: '',
            quantity: 1,
            uom: 'Lot',
            unitCost: 0,
            total: 0,
          },
        ];

  const latestQuoteDate = vendors
    .flatMap((v) => v.rounds || [])
    .map((r) => r.submittedAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0];
  const historyDate =
    pr.approvalHistory?.[pr.approvalHistory.length - 1]?.date || pr.approvalHistory?.[0]?.date;
  const statementDate = formatDisplayDate(latestQuoteDate || historyDate || new Date().toISOString());
  const siteLabel = pr.entityName || pr.department || '—';
  const siteDate = formatDisplayDate(historyDate || latestQuoteDate || new Date().toISOString());

  const handlePrint = () => {
    window.print();
  };

  const renderFileActions = (
    col: RevColumn | undefined,
    vendor: VendorComparisonData['vendors'][number],
    size: 'sm' | 'md' = 'sm'
  ) => {
    const file = resolveQuoteFile(col, vendor);
    if (!file.hasFile) {
      return <span className="text-slate-300">—</span>;
    }
    const btn =
      size === 'md'
        ? 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer'
        : 'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] font-semibold cursor-pointer';
    return (
      <div className="flex flex-col items-center gap-1 min-w-0">
        <p className="text-[11px] text-slate-600 truncate max-w-[160px]" title={file.fileName}>
          {file.fileName}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-1 print:hidden">
          <button
            type="button"
            disabled={fileBusy === `${file.submissionId}-view`}
            onClick={() => void openQuoteFile(file.submissionId, vendor.name, file.fileName, 'view')}
            className={`${btn} border-teal-200 text-teal-700 hover:bg-teal-50 disabled:opacity-50`}
          >
            <i className="ri-eye-line"></i>
            View
          </button>
          <button
            type="button"
            disabled={fileBusy === `${file.submissionId}-download`}
            onClick={() => void openQuoteFile(file.submissionId, vendor.name, file.fileName, 'download')}
            className={`${btn} border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50`}
          >
            <i className="ri-download-line"></i>
            Download
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-w-0 w-full max-w-full overflow-hidden ${compact ? 'space-y-4' : 'space-y-5'} print:space-y-4`}>
      {/* Recommendation (existing) */}
      {(data.recommendedVendorName || recommendationJustification) && !compact && (
        <div className={`${cardClass} border-emerald-200`}>
          <div className="px-5 py-2.5 border-b border-emerald-100 bg-emerald-50/80 flex flex-wrap items-center gap-2">
            <i className="ri-award-line text-emerald-700"></i>
            <p className="text-sm font-bold text-[#12284A]">
              Recommended: {data.recommendedVendorName || '—'}
            </p>
          </div>
          {recommendationJustification ? (
            <p className="px-5 py-3 text-sm text-[#64748B] whitespace-pre-wrap">{recommendationJustification}</p>
          ) : null}
        </div>
      )}

      {/* ── HEADER ── */}
      {!compact && (
        <section className={`${cardClass} p-4 sm:p-6`}>
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-[22px] md:text-[28px] lg:text-[30px] font-bold text-[#12284A] tracking-tight leading-snug break-words">
                Comparative Statement for {pr.title || pr.prNumber}
              </h1>
              <p className="text-xs text-[#64748B] mt-1">
                PR: <span className="font-semibold text-[#12284A]">{pr.prNumber}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-stretch gap-2 sm:gap-3">
              <div className="min-w-[88px] flex-1 sm:flex-none rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] px-3 sm:px-4 py-3">
                <p className="text-[11px] font-medium text-[#64748B]">Latest quote</p>
                <p className="text-xl sm:text-2xl font-bold text-[#12284A] mt-0.5 leading-none">{revisionLabel(Math.max(1, totalRounds))}</p>
              </div>
              <div className="min-w-[100px] flex-1 sm:flex-none rounded-xl bg-[#E6F7F5] border border-[#C7EFE8] px-3 sm:px-4 py-3">
                <p className="text-[11px] font-medium text-[#64748B]">Date</p>
                <p className="text-base sm:text-lg font-bold text-[#12284A] mt-0.5 leading-tight">{statementDate}</p>
              </div>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#6C4CCF] text-[#6C4CCF] text-sm font-semibold hover:bg-[#F3F0FF] transition-colors print:hidden"
              >
                <i className="ri-file-pdf-2-line text-base"></i>
                Download PDF
              </button>
            </div>
          </div>

          {/* Site details bar */}
          <div className="mt-5 pt-4 border-t border-[#E5EAF0] flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#6C4CCF] flex items-center justify-center shrink-0">
                <i className="ri-map-pin-line"></i>
              </span>
              <p className="text-[#12284A]">
                <span className="font-bold">Site Details :</span>{' '}
                <span className="text-[#334155]">{siteLabel}</span>
              </p>
            </div>
            <div className="hidden sm:block w-px h-6 bg-[#E5EAF0]" />
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-[#E6F7F5] text-[#008F83] flex items-center justify-center shrink-0">
                <i className="ri-calendar-line"></i>
              </span>
              <p className="text-[#12284A]">
                <span className="font-bold">Date :</span>{' '}
                <span className="text-[#334155]">{siteDate.replace(/\./g, '/')}</span>
              </p>
            </div>
          </div>
        </section>
      )}

      {fileError && (
        <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 print:hidden">
          {fileError}
        </div>
      )}

      {vendorGroups.length > 0 && (
        <section className={`${cardClass} print:hidden`}>
          <div className="px-4 sm:px-5 py-3 border-b border-[#E5EAF0] bg-slate-50 flex items-center gap-2">
            <i className="ri-file-pdf-2-line text-teal-600"></i>
          <div>
              <h2 className="text-sm font-bold text-[#12284A]">Final quotation files</h2>
              <p className="text-xs text-slate-500">Latest quote from each vendor — view or download</p>
            </div>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {vendorGroups.map(({ vendor, cols }) => {
              const latestCol = [...cols].reverse().find((c) => c.isLatest) || cols[cols.length - 1];
              return (
                <div key={`final-file-${vendor.id}`} className="rounded-xl border border-[#E5EAF0] p-3 bg-white">
                  <p className="text-xs font-bold text-slate-800 truncate mb-2" title={vendor.name}>
                    {vendor.name}
                    {vendor.isRecommended ? (
                      <span className="ml-1 text-[10px] font-semibold text-emerald-700">Recommended</span>
                    ) : null}
                  </p>
                  {renderFileActions(latestCol, vendor, 'md')}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── COMMERCIAL COMPARISON ── */}
      <section className={cardClass} aria-label="Price comparison">
        <div className="px-4 sm:px-5 py-4 border-b border-[#E5EAF0]">
          <p className="text-sm font-semibold text-[#64748B]">Compare vendors</p>
          <h2 className="text-lg font-bold text-[#12284A] mt-0.5">Price comparison</h2>
          <p className="text-xs text-slate-500 mt-1">
            Each vendor has its own color. Gold column = lowest total. Green = vendor you chose.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black uppercase">
              <i className="ri-star-fill" /> Best price
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
              <i className="ri-checkbox-circle-fill" /> Recommended
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
              Each vendor = one color
            </span>
          </div>
          {bestMeta && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black uppercase">
                <i className="ri-star-fill" /> Best price
              </span>
              <p className="text-sm text-amber-950">
                <span className="font-bold">{bestMeta.col.vendorName}</span>
                <span className="text-amber-800"> · {bestMeta.col.revisionLabel} · </span>
                <span className="font-bold tabular-nums">₹{formatNum(bestMeta.t.landed)}</span>
              </p>
            </div>
          )}
          {dynamicRfqLabels.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Also in this table</p>
              <div className="flex flex-wrap gap-1.5">
                {dynamicRfqLabels.map((p) => (
                  <span
                    key={`lbl-${p.id}`}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      isMakeLikeParam(p)
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {revColumns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#6C4CCF] flex items-center justify-center mx-auto mb-3">
              <i className="ri-inbox-line text-2xl"></i>
            </div>
            <p className="text-sm font-semibold text-[#12284A]">No vendor quotations available</p>
            <p className="text-xs text-[#64748B] mt-1">Invite vendors and collect quotes to build this statement.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card layout (no table) */}
            <div className="md:hidden p-3 space-y-3">
              {columnMeta.map(({ col, t, isBest, isRecRev, theme }) => {
                return (
                  <article
                    key={`m-card-${col.key}`}
                    className={`rounded-xl border overflow-hidden ${
                      isBest
                        ? 'border-amber-400 ring-2 ring-amber-200'
                        : isRecRev
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-[#E5EAF0] bg-white'
                    }`}
                  >
                    <div
                      className={`px-3 py-2.5 flex flex-wrap items-start justify-between gap-2 ${
                        isBest
                          ? 'bg-amber-400 text-amber-950'
                          : isRecRev
                            ? 'bg-emerald-600 text-white'
                            : theme.bar
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">
                          {col.revisionLabel}
                        </p>
                        <p className="text-sm font-bold break-words leading-snug mt-0.5">{col.vendorName}</p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {isRecRev && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] font-bold">
                            <i className="ri-checkbox-circle-fill text-[10px]"></i>
                            Recommended
                          </span>
                        )}
                        {isBest && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 text-[10px] font-black uppercase">
                            <i className="ri-star-fill text-[10px]"></i>
                            Best price
                          </span>
                        )}
                      </div>
                    </div>

                    {onSelectVendor && (
                      <label className="flex items-center gap-2 px-3 py-2 border-b border-[#E5EAF0] text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="radio"
                          name="vendor-select-mobile"
                          checked={activeVendorId === col.vendorId}
                          onChange={() => onSelectVendor(col.vendorId)}
                          className="accent-emerald-600"
                        />
                        Select this vendor
                      </label>
                    )}

                    <div className="divide-y divide-[#E5EAF0]">
                      {displayLines.map((li, lineIdx) => {
                        const { rate, amount } =
                          String(li.id) === 'total'
                            ? (() => {
                                const stripped = exclusiveFromInclusive(Number(col.values.quotedPrice) || 0);
                                return { rate: stripped.amount, amount: stripped.amount };
                              })()
                            : getLineRateAmount(col, String(li.id), li.description, Number(li.quantity) || 0);
                        return (
                          <div key={`m-${col.key}-${li.id}`} className="px-3 py-3">
                            <p className="text-[11px] font-semibold text-slate-500 uppercase">
                              Item {lineIdx + 1}
                            </p>
                            <p className="text-sm font-bold text-[#12284A] leading-snug mt-0.5 break-words">
                              {li.description}
                            </p>
                            {li.category ? (
                              <p className="text-xs text-slate-500 mt-0.5">{li.category}</p>
                            ) : null}
                            <p className="text-xs text-slate-500 mt-1">
                              Qty {li.quantity} · {li.uom || 'Nos'}
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                                <p className="text-[10px] font-semibold uppercase text-slate-500">Unit price</p>
                                <p className="font-semibold tabular-nums text-[#334155]">
                                  {rate > 0 ? `₹${formatNum(rate)}` : '—'}
                                </p>
                              </div>
                              <div className="rounded-lg bg-slate-50 px-2.5 py-2 text-right">
                                <p className="text-[10px] font-semibold uppercase text-slate-500">Amount</p>
                                <p className="font-bold tabular-nums text-[#12284A]">
                                  {amount > 0 ? `₹${formatNum(amount)}` : '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {sheetMakeParams.map((param) => {
                        const raw =
                          col.values[param.id] ??
                          col.values[param.label] ??
                          col.values.make ??
                          col.values.Make ??
                          col.values.brand ??
                          col.values.Brand;
                        const display =
                          raw === undefined || raw === null || raw === ''
                            ? '—'
                            : param.type === 'boolean'
                              ? raw
                                ? 'Yes'
                                : 'No'
                              : String(raw);
                        return (
                          <div
                            key={`m-${col.key}-info-${param.id}`}
                            className="px-3 py-2.5 flex items-start justify-between gap-3"
                          >
                            <span className="text-xs font-semibold text-slate-600">{param.label}</span>
                            <span className="text-sm font-semibold text-[#12284A] text-right break-words">
                              {display}
                            </span>
                          </div>
                        );
                      })}

                      <div className="px-3 py-2.5 flex items-center justify-between gap-3 bg-slate-50">
                        <span className="text-xs font-bold text-slate-700">
                          {gstRowLabel}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-800">
                          {t.material > 0 ? `₹${formatNum(t.gst)}` : '—'}
                        </span>
                      </div>

                      {sheetCostParams.map((param) => {
                        const extra = cellExtra(col.values, paramKeys(param));
                        const d = statusValueDisplay(extra);
                        return (
                          <div
                            key={`m-${col.key}-cost-${param.id}`}
                            className="px-3 py-2.5 flex items-center justify-between gap-3"
                          >
                            <span className="text-xs font-semibold text-slate-600">{param.label}</span>
                            <span className="text-sm font-semibold text-[#12284A] text-right">
                              {d.mode === 'number'
                                ? `₹${formatNum(d.value)}`
                                : d.mode === 'included' || d.mode === 'extra' || d.mode === 'text'
                                  ? String(d.value)
                                  : '—'}
                            </span>
                          </div>
                        );
                      })}

                      <div
                        className={`px-3 py-3 flex items-center justify-between gap-3 ${
                          isBest ? 'bg-amber-100' : isRecRev ? 'bg-emerald-100/70' : 'bg-[#F8FAFC]'
                        }`}
                      >
                        <span className="text-sm font-bold text-[#12284A]">Total cost</span>
                        <span
                          className={`text-base font-bold tabular-nums ${
                            isBest ? 'text-amber-950' : isRecRev ? 'text-emerald-800' : 'text-[#12284A]'
                          }`}
                        >
                          {t.landed > 0 ? `₹${formatNum(t.landed)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop / tablet: horizontally scrollable table */}
            <div className="hidden md:block w-full min-w-0 max-w-full">
            {needsSideScroll && (
              <p className="px-4 py-2 text-xs text-slate-500 flex items-center gap-1.5 print:hidden border-b border-[#E5EAF0] bg-slate-50">
                <i className="ri-arrow-left-right-line"></i>
                Scroll sideways to see every quote round. Gold = lowest total.
              </p>
            )}
            <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
              <table className="border-separate border-spacing-0 text-sm w-full min-w-max">
                <thead>
                  {/* Row 1: revision labels */}
                  <tr>
                    <th
                      className={`${stSr} z-40 px-1 py-3 border-b border-[#E5EAF0] bg-slate-100 text-slate-700 text-center text-[10px] md:text-[12px] font-bold uppercase`}
                    >
                      Sr
                    </th>
                    <th
                      className={`${stDesc} z-40 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-slate-100 text-slate-700 text-left text-[10px] md:text-[12px] font-bold uppercase`}
                    >
                      Description
                    </th>
                    <th
                      className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-slate-100 text-slate-700 text-center text-[12px] font-bold uppercase`}
                    >
                      Qty
                    </th>
                    <th
                      className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-slate-100 text-slate-700 text-center text-[12px] font-bold uppercase`}
                    >
                      UOM
                    </th>
                    {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                      return (
                        <th
                          key={`${col.key}-rev`}
                          colSpan={2}
                          className={`px-2 py-2.5 border-b border-l text-center text-xs font-bold whitespace-nowrap align-middle ${
                            isBest
                              ? 'bg-amber-400 text-amber-950 border-amber-500'
                              : isRecRev
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : theme.bar
                          }`}
                        >
                          <span className="inline-flex flex-col items-center gap-1">
                            <span>{col.revisionLabel}</span>
                            {isBest && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-300 text-[10px] font-black uppercase tracking-wide">
                                <i className="ri-star-fill text-[10px]"></i>
                                Best price
                              </span>
                            )}
                            {isRecRev && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] font-bold uppercase tracking-wide">
                                <i className="ri-checkbox-circle-fill text-[10px]"></i>
                                Recommended
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                    <th className={`${colFiller} border-b bg-slate-50`} aria-hidden="true" />
                  </tr>
                  {/* Row 2: vendor names */}
                  <tr>
                    <th className={`${stSr} z-40 bg-slate-100 border-b border-[#E5EAF0]`} />
                    <th className={`${stDesc} z-40 bg-slate-100 border-b border-[#E5EAF0]`} />
                    <th className={`${stQty} bg-slate-100 border-b border-[#E5EAF0]`} />
                    <th className={`${stUom} bg-slate-100 border-b border-r border-[#E5EAF0]`} />
                    {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                      return (
                        <th
                          key={`${col.key}-vendor`}
                          colSpan={2}
                          className={`px-2 py-3 border-b border-l text-center text-xs sm:text-sm font-bold align-middle ${
                            isBest
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : isRecRev
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : theme.head
                          }`}
                        >
                          {onSelectVendor ? (
                            <label className="inline-flex items-center justify-center gap-1.5 cursor-pointer max-w-full">
                              <input
                                type="radio"
                                name="vendor-select"
                                checked={activeVendorId === col.vendorId}
                                onChange={() => onSelectVendor(col.vendorId)}
                                className="accent-emerald-600 shrink-0"
                              />
                              <span className="inline-block max-w-[160px] lg:max-w-[220px] leading-tight break-words" title={col.vendorName}>
                                {col.vendorName}
                              </span>
                            </label>
                          ) : (
                            <span className="inline-block max-w-[160px] lg:max-w-[220px] leading-tight break-words" title={col.vendorName}>
                              {col.vendorName}
                      </span>
                    )}
                  </th>
                      );
                    })}
                    <th className={`${colFiller} border-b bg-slate-50`} aria-hidden="true" />
                  </tr>
                  {/* Row 3: Rate / Amount */}
                  <tr>
                    <th className={`${stSr} z-40 bg-white border-b border-[#E5EAF0]`} />
                    <th className={`${stDesc} z-40 bg-white border-b border-[#E5EAF0]`} />
                    <th className={`${stQty} bg-white border-b border-[#E5EAF0]`} />
                    <th className={`${stUom} bg-white border-b border-r border-[#E5EAF0]`} />
                    {columnMeta.map(({ col, isBest, isRecRev, theme }) => (
                      <Fragment key={`${col.key}-ra`}>
                        <th className={`px-2 py-2 border-b border-l text-center text-[11px] font-bold uppercase ${colUnit} ${columnFill(isBest, isRecRev, theme.soft)} ${isBest ? 'text-amber-950' : 'text-[#12284A]'}`}>
                          Unit price
                        </th>
                        <th className={`px-2 py-2 border-b text-center text-[11px] font-bold uppercase ${colAmount} ${columnFill(isBest, isRecRev, theme.soft)} ${isBest ? 'text-amber-950' : 'text-[#12284A]'}`}>
                          Amount
                        </th>
                      </Fragment>
                ))}
                    <th className={colFiller} aria-hidden="true" />
              </tr>
            </thead>

            <tbody>
                  {displayLines.map((li, lineIdx) => (
                    <tr key={String(li.id)} className="hover:bg-[#F8FAFC]">
                      <td
                        className={`${stSr} z-10 px-1 py-3 border-b border-[#E5EAF0] bg-white text-center font-semibold text-[#12284A] text-xs md:text-sm`}
                      >
                        {lineIdx + 1}
                      </td>
                      <td className={`${stDesc} z-10 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-white`}>
                        <p className="font-bold text-[#12284A] text-[13px] md:text-[15px] leading-snug break-words">
                          {li.description}
                        </p>
                        {li.category ? (
                          <p className="text-[11px] md:text-xs text-[#64748B] mt-0.5 truncate">{li.category}</p>
                        ) : null}
                        <p className="md:hidden text-[11px] text-slate-500 mt-1 tabular-nums">
                          Qty {li.quantity} · {li.uom || 'Nos'}
                        </p>
                      </td>
                      <td
                        className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-white text-center font-semibold text-[#12284A]`}
                      >
                        {li.quantity}
                      </td>
                      <td
                        className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-white text-center text-xs font-medium text-[#64748B]`}
                      >
                        {li.uom || 'Nos'}
                      </td>
                      {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                        const { rate, amount } =
                          String(li.id) === 'total'
                            ? (() => {
                                const stripped = exclusiveFromInclusive(Number(col.values.quotedPrice) || 0);
                                return { rate: stripped.amount, amount: stripped.amount };
                              })()
                            : getLineRateAmount(col, String(li.id), li.description, Number(li.quantity) || 0);
                        return (
                          <Fragment key={`${col.key}-${li.id}`}>
                            <td className={`px-2 sm:px-3 py-3 border-b border-l text-right tabular-nums text-[#334155] text-xs sm:text-sm whitespace-nowrap ${colUnit} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              {rate > 0 ? `₹${formatNum(rate)}` : '—'}
                            </td>
                            <td className={`px-2 sm:px-3 py-3 border-b text-right font-semibold tabular-nums text-[#12284A] text-xs sm:text-sm whitespace-nowrap ${colAmount} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              {amount > 0 ? `₹${formatNum(amount)}` : '—'}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className={colFiller} aria-hidden="true" />
                    </tr>
                  ))}

                  {/* Dynamic Make (RFQ Entry) — above GST */}
                  {sheetMakeParams.map((param) => (
                    <tr key={`info-${param.id}`} className="hover:bg-[#F8FAFC]">
                      <td className={`${stSr} z-10 px-1 py-3 border-b border-[#E5EAF0] bg-white`} />
                      <td
                        className={`${stDesc} z-10 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-white font-semibold text-[#12284A] text-xs md:text-sm`}
                      >
                        {param.label}
                      </td>
                      <td className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-white`} />
                      <td className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-white`} />
                      {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                        const raw =
                          col.values[param.id] ??
                          col.values[param.label] ??
                          col.values.make ??
                          col.values.Make ??
                          col.values.brand ??
                          col.values.Brand;
                        const display =
                          raw === undefined || raw === null || raw === ''
                            ? '—'
                            : param.type === 'boolean'
                              ? raw
                                ? 'Yes'
                                : 'No'
                              : String(raw);
                return (
                          <Fragment key={`${col.key}-info-${param.id}`}>
                            <td className={`px-2 sm:px-3 py-3 border-b border-l text-right text-slate-300 tabular-nums ${colUnit} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              —
                            </td>
                            <td className={`px-2 sm:px-3 py-3 border-b text-right font-semibold text-[#12284A] text-xs sm:text-sm ${colAmount} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              {display}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className={colFiller} aria-hidden="true" />
                    </tr>
                  ))}

                  {/* GST */}
                  <tr className="bg-slate-50">
                    <td className={`${stSr} z-10 px-1 py-3 border-b border-[#E5EAF0] bg-slate-50`} />
                    <td
                      className={`${stDesc} z-10 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-slate-50 font-bold text-slate-800 text-xs md:text-sm`}
                    >
                      {gstRowLabel}
                    </td>
                    <td className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-slate-50`} />
                    <td className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-slate-50`} />
                    {columnMeta.map(({ t, isBest, isRecRev }, i) => (
                      <Fragment key={`gst-${i}`}>
                        <td className={`px-2 sm:px-3 py-3 border-b border-l text-right text-slate-300 tabular-nums ${colUnit} ${columnFill(isBest, isRecRev, 'bg-slate-50')}`}>
                          —
                        </td>
                        <td className={`px-2 sm:px-3 py-3 border-b text-right font-bold tabular-nums text-slate-800 text-xs sm:text-sm whitespace-nowrap ${colAmount} ${columnFill(isBest, isRecRev, 'bg-slate-50')}`}>
                          {t.material > 0 ? `₹${formatNum(t.gst)}` : '—'}
                        </td>
                      </Fragment>
                    ))}
                    <td className={`${colFiller} bg-slate-50`} aria-hidden="true" />
                  </tr>

                  {/* Dynamic HDG / Freight (RFQ Entry only) */}
                  {sheetCostParams.map((param) => (
                    <tr key={`cost-${param.id}`} className="hover:bg-[#F8FAFC]">
                      <td className={`${stSr} z-10 px-1 py-3 border-b border-[#E5EAF0] bg-white`} />
                      <td
                        className={`${stDesc} z-10 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-white font-semibold text-[#12284A] text-xs md:text-sm`}
                      >
                        {param.label}
                      </td>
                      <td className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-white`} />
                      <td className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-white`} />
                      {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                        const extra = cellExtra(col.values, paramKeys(param));
                        const d = statusValueDisplay(extra);
                        const isFreight = isFreightParam(param);
                        return (
                          <Fragment key={`${col.key}-cost-${param.id}`}>
                            <td className={`px-2 sm:px-3 py-3 border-b border-l text-right text-slate-300 tabular-nums ${colUnit} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              —
                            </td>
                            <td className={`px-2 sm:px-3 py-3 border-b text-right align-middle ${colAmount} ${columnFill(isBest, isRecRev, theme.soft)}`}>
                              {d.mode === 'number' ? (
                                isFreight ? (
                                  <span className="inline-flex flex-col items-end gap-0.5">
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-700">
                                      Extra
                                    </span>
                                    <span className="font-semibold tabular-nums text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                                      ₹{formatNum(d.value)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="font-semibold tabular-nums text-xs sm:text-sm whitespace-nowrap">
                                    ₹{formatNum(d.value)}
                                  </span>
                                )
                              ) : d.mode === 'included' || d.mode === 'extra' || d.mode === 'text' ? (
                                <span className="inline-flex max-w-full px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-slate-100 text-slate-700 truncate">
                                  {d.value}
                                </span>
                              ) : (
                                <span className="text-slate-300 tabular-nums">—</span>
                              )}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td className={colFiller} aria-hidden="true" />
                    </tr>
                  ))}

                  {/* Landed Cost */}
                  <tr>
                    <td className={`${stSr} z-10 px-1 py-3 border-b border-[#E5EAF0] bg-[#F8FAFC]`} />
                    <td className={`${stDesc} z-10 px-2 md:px-3 py-3 border-b border-[#E5EAF0] bg-[#F8FAFC]`}>
                      <span className="font-bold text-[#12284A] text-sm md:text-base">Total cost</span>
                      <span className="block md:inline md:ml-2 text-[10px] md:text-xs font-medium text-slate-500">
                        including GST
                      </span>
                    </td>
                    <td className={`${stQty} px-2 py-3 border-b border-[#E5EAF0] bg-[#F8FAFC]`} />
                    <td className={`${stUom} px-2 py-3 border-b border-r border-[#E5EAF0] bg-[#F8FAFC]`} />
                    {columnMeta.map(({ t, isBest, isRecRev }, i) => {
                      return (
                        <Fragment key={`landed-${i}`}>
                          <td
                            className={`px-2 sm:px-3 py-3 border-b border-l text-right text-slate-300 tabular-nums ${colUnit} ${
                              isBest
                                ? 'bg-amber-100 border-amber-300'
                                : isRecRev
                                  ? 'bg-emerald-50/80 border-emerald-100'
                                  : 'bg-[#F8FAFC] border-[#E5EAF0]'
                            }`}
                          >
                            —
                          </td>
                          <td
                            className={`px-2 sm:px-3 py-3 border-b text-right align-middle ${colAmount} ${
                              isBest
                                ? 'bg-amber-100 border-amber-300'
                                : isRecRev
                                  ? 'bg-emerald-50/80 border-emerald-100'
                                  : 'bg-[#F8FAFC] border-[#E5EAF0]'
                            }`}
                          >
                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`text-sm sm:text-base font-bold tabular-nums whitespace-nowrap leading-none ${
                                  isBest ? 'text-amber-950' : isRecRev ? 'text-emerald-800' : 'text-[#12284A]'
                                }`}
                              >
                                {t.landed > 0 ? `₹${formatNum(t.landed)}` : '—'}
                              </span>
                              {(isRecRev || isBest) && (
                                <div className="flex flex-wrap items-center justify-end gap-1">
                                  {isBest && (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-400 border border-amber-500 text-[10px] font-black uppercase text-amber-950 whitespace-nowrap">
                                      <i className="ri-star-fill text-[10px]"></i>
                                      Best price
                                    </span>
                                  )}
                                  {isRecRev && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-600 border border-emerald-700 text-[10px] font-bold text-white whitespace-nowrap">
                                      <i className="ri-checkbox-circle-fill text-[10px]"></i>
                                      Recommended
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                        </td>
                        </Fragment>
                      );
                    })}
                    <td className={`${colFiller} bg-[#F8FAFC]`} aria-hidden="true" />
                  </tr>
                </tbody>
              </table>
            </div>
            </div>
          </>
        )}
      </section>

      {/* ── TECHNICAL SPECIFICATION ── */}
      {vendorGroups.length > 0 && (
        <section className={cardClass} aria-label="Other terms comparison">
          <div className="px-4 sm:px-5 py-4 border-b border-[#E5EAF0]">
            <p className="text-sm font-semibold text-[#64748B]">Compare vendors</p>
            <h2 className="text-lg font-bold text-[#12284A] mt-0.5">Other terms</h2>
            <p className="text-xs text-slate-500 mt-1">Warranty, delivery, payment, and any extra questions you added.</p>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-3 space-y-3">
            {vendorGroups.map(({ vendor, cols, theme, vendorIndex }) => {
              const latestCol = [...cols].reverse().find((c) => c.isLatest) || cols[cols.length - 1];
              const isRec = Boolean(vendor.isRecommended);
              const tone = theme || vendorTheme(vendorIndex);
              return (
                <article
                  key={`tech-m-${vendor.id}`}
                  className={`rounded-xl border overflow-hidden ${
                    isRec ? 'border-emerald-300' : 'border-[#E5EAF0]'
                  }`}
                >
                  <div
                    className={`px-3 py-2.5 flex items-start justify-between gap-2 ${
                      isRec ? 'bg-emerald-600 text-white' : tone.bar
                    }`}
                  >
                    <p className="text-sm font-bold break-words leading-snug">{vendor.name}</p>
                    {isRec && (
                      <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-[#E5EAF0] bg-white">
                    {technicalSheetParams.map((param) => {
                      const raw =
                        latestCol?.values?.[param.id] ??
                        latestCol?.values?.[param.label] ??
                        (isMakeLikeParam(param)
                          ? latestCol?.values?.make ??
                            latestCol?.values?.Make ??
                            latestCol?.values?.brand ??
                            latestCol?.values?.Brand
                          : undefined);
                      const display =
                        raw === undefined || raw === null || raw === ''
                          ? '—'
                          : param.type === 'boolean'
                            ? raw
                              ? 'Yes'
                              : 'No'
                            : String(raw);
                      return (
                        <div
                          key={`tech-m-${vendor.id}-${param.id}`}
                          className="px-3 py-2.5 flex items-start justify-between gap-3"
                        >
                          <span className="text-xs font-semibold text-slate-600 shrink-0 max-w-[45%]">
                            {param.label}
                          </span>
                          <span className="text-sm text-[#12284A] text-right break-words font-medium">
                            {display}
                          </span>
                        </div>
                      );
                    })}
                    <div className="px-3 py-2.5 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-600">Quotation File</span>
                      {renderFileActions(latestCol, vendor, 'sm')}
                    </div>
                  </div>
                </article>
              );
            })}
                      </div>

          {/* Desktop table — same Quote 1 / 2 / 3 columns as price comparison */}
          <div className="hidden md:block w-full min-w-0 max-w-full">
          {needsSideScroll && (
            <p className="px-4 py-2 text-xs text-slate-500 flex items-center gap-1.5 print:hidden border-b border-[#E5EAF0] bg-slate-50">
              <i className="ri-arrow-left-right-line"></i>
              Scroll sideways to see every quote round
            </p>
          )}
          <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
            <table className="border-separate border-spacing-0 text-sm w-full min-w-max">
              <thead>
                <tr>
                  <th
                    className={`${stOtherLabel} z-20 px-2.5 md:px-4 py-3 border-b border-r border-[#E5EAF0] bg-slate-100 text-slate-700 text-left text-[10px] md:text-[12px] font-bold uppercase`}
                  >
                    Other terms
                  </th>
                  {columnMeta.map(({ col, isBest, isRecRev, theme }) => (
                    <th
                      key={`tech-h-${col.key}`}
                      className={`px-3 py-3 border-b border-l text-center text-xs font-bold ${colRev} ${
                        isBest
                          ? 'bg-amber-400 text-amber-950 border-amber-500'
                          : isRecRev
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : theme.bar
                      }`}
                    >
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className="truncate max-w-[200px]" title={col.vendorName}>
                          {col.vendorName}
                        </span>
                        <span className="text-[10px] font-semibold opacity-90">{col.revisionLabel}</span>
                      </span>
                    </th>
                  ))}
                  <th className={`${colFiller} border-b bg-slate-50`} aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {technicalSheetParams.map((param) => (
                  <tr key={param.id} className="hover:bg-[#F8FAFC]">
                    <td
                      className={`${stOtherLabel} z-10 px-2.5 md:px-4 py-3 border-b border-r border-[#E5EAF0] bg-white font-medium text-[#12284A] text-xs md:text-sm break-words`}
                    >
                      {param.label}
                    </td>
                    {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                      const raw =
                        col.values?.[param.id] ??
                        col.values?.[param.label] ??
                        (isMakeLikeParam(param)
                          ? col.values?.make ??
                            col.values?.Make ??
                            col.values?.brand ??
                            col.values?.Brand
                          : undefined);
                      const display =
                        raw === undefined || raw === null || raw === ''
                          ? '—'
                          : param.type === 'boolean'
                            ? raw
                              ? 'Yes'
                              : 'No'
                            : String(raw);
                      return (
                        <td
                          key={`${col.key}-${param.id}`}
                          className={`px-3 py-3 border-b border-l text-center text-[#334155] whitespace-pre-wrap ${colRev} ${columnFill(isBest, isRecRev, theme.soft)}`}
                        >
                          {isMakeLikeParam(param) ? (
                            <span className="font-bold text-slate-800">{display}</span>
                          ) : (
                            display
                          )}
                        </td>
                      );
                    })}
                    <td className={colFiller} aria-hidden="true" />
                  </tr>
                ))}

                <tr>
                  <td
                    className={`${stOtherLabel} z-10 px-2.5 md:px-4 py-3 border-b border-r border-[#E5EAF0] bg-white font-medium text-[#12284A] text-xs md:text-sm`}
                  >
                    Quotation File
                  </td>
                  {columnMeta.map(({ col, isBest, isRecRev, theme }) => {
                    const vendor = vendors.find((v) => Number(v.id) === Number(col.vendorId));
                    return (
                      <td
                        key={`file-${col.key}`}
                        className={`px-3 py-3 border-b border-l text-center ${colRev} ${columnFill(isBest, isRecRev, theme.soft)}`}
                      >
                        {vendor ? renderFileActions(col, vendor, 'sm') : '—'}
                      </td>
                    );
                  })}
                  <td className={colFiller} aria-hidden="true" />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </section>
      )}

      {/* ── NOTE ── */}
      {!compact && (
        <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-5 py-4 flex items-start gap-3">
          <span className="w-8 h-8 rounded-full bg-[#1769E0] text-white flex items-center justify-center shrink-0">
            <i className="ri-information-line"></i>
                        </span>
          <p className="text-sm text-[#334155] leading-relaxed">
            <span className="font-bold text-[#12284A]">How to read this:</span> Gold column is the lowest
            total. Green is the vendor you recommended. Each vendor keeps the same color across both tables.
          </p>
        </div>
      )}
    </div>
  );
}
