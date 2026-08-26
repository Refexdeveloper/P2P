import { PO_STYLES, PO_PDF_LAYOUT } from './poDocumentTemplate.styles.js';
import { parseAnnexureIi, annexureIiRowIsEmpty } from '../utils/annexureIi.js';

export { PO_PDF_LAYOUT };

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`.trim();
}

function threeDigits(n) {
  if (n < 100) return twoDigits(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${twoDigits(n % 100)}` : ''}`.trim();
}

function integerToWords(num) {
  if (!Number.isFinite(num) || num <= 0) return '';
  let n = Math.floor(num);
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;
  const parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ');
}

export function numberToIndianWords(amount) {
  const cents = Math.round((Number(amount) || 0) * 100);
  if (!Number.isFinite(cents) || cents === 0) return 'Zero Rupees Only.';

  const rupees = Math.floor(Math.abs(cents) / 100);
  const paisa = Math.abs(cents) % 100;
  const rupeeWords = rupees > 0 ? integerToWords(rupees) : 'Zero';
  if (paisa === 0) return `${rupeeWords} Rupees Only.`;
  return `${rupeeWords} Rupees and ${integerToWords(paisa)} Paisa Only.`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtMoney(amount, currency = 'INR') {
  const code = ['EUR', 'USD', 'INR'].includes(String(currency || '').toUpperCase())
    ? String(currency).toUpperCase()
    : 'INR';
  let formatted;
  try {
    formatted = new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    formatted = Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(formatted).replace(/\s/g, '\u00A0');
}

function amountCellHtml(amount, currency, extraClass = '') {
  return `<td class="right amount-cell ${extraClass}">${fmtMoney(amount, currency)}</td>`;
}

export function fmtDateDisplay(value) {
  if (!value) return '';
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return s;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function chunkRows(rows, size) {
  if (!rows.length) return [[]];
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

function looksLikeHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || '').trim());
}

function looksLikeImageSrc(value) {
  const v = String(value || '').trim();
  return /^data:image\//i.test(v) || /^https?:\/\//i.test(v) || /^\//.test(v);
}

function resolveBrandingValue(po = {}, camelKey, snakeKey) {
  return String(po[camelKey] || po[snakeKey] || '').trim();
}

function safeImgSrc(src) {
  // Preserve data URLs; only escape attribute-breaking characters
  return String(src || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function logoHtml(po = {}, opts = {}) {
  const cls = opts.running ? 'header header-custom doc-header running-header' : 'header header-custom doc-header';
  const headerLogo = resolveBrandingValue(po, 'headerLogo', 'header_logo');
  if (headerLogo) {
    if (looksLikeHtml(headerLogo)) {
      return `<div class="${cls}">${headerLogo}</div>`;
    }
    if (looksLikeImageSrc(headerLogo)) {
      return `<div class="header doc-header${opts.running ? ' running-header' : ''}"><img class="header-logo-img" src="${safeImgSrc(headerLogo)}" alt="Header Logo" /></div>`;
    }
    return `<div class="${cls}">${escapeHtml(headerLogo)}</div>`;
  }
  return `<div class="header doc-header${opts.running ? ' running-header' : ''}"><div class="logo"><span class="r1">r</span><span class="e1">e</span><span class="f">f</span><span class="e2">e</span><span class="x">x</span></div></div>`;
}

function footerHtml(po = {}, pageLabel = '', opts = {}) {
  const running = !!opts.running;
  const extra = running ? ' running-footer' : '';
  const footerLogo = resolveBrandingValue(po, 'footerLogo', 'footer_logo');
  const entity = resolveBrandingValue(po, 'entity', 'entity');
  // Section labels only on in-page footers (preview); running print footer stays clean
  const pageNum = !running && pageLabel ? `<div class="pagenum">${escapeHtml(pageLabel)}</div>` : '';

  // Master footer set → show only master footer image/HTML (no entity brand text, no default footer)
  if (footerLogo) {
    if (looksLikeHtml(footerLogo)) {
      return `
  <div class="footer footer-custom doc-footer${extra}">
    <div class="footer-master-content">${footerLogo}</div>
    ${pageNum}
  </div>`;
    }
    if (looksLikeImageSrc(footerLogo)) {
      return `
  <div class="footer footer-custom doc-footer${extra}">
    <img class="footer-logo-img" src="${safeImgSrc(footerLogo)}" alt="Footer" />
    ${pageNum}
  </div>`;
    }
    return `
  <div class="footer footer-custom doc-footer${extra}">
    <div class="footer-master-content">${escapeHtml(footerLogo)}</div>
    ${pageNum}
  </div>`;
  }

  // Default footer only when Letterhead Master has no footer logo
  const brandName = entity || 'Refex Green Mobility Limited';
  return `
  <div class="footer doc-footer${extra}">
    <div class="brand">${escapeHtml(brandName)}</div>
    <div class="sub">(Wholly-Owned Subsidiary of Refex Industries Limited)</div>
    <hr>
    <div class="cin-bar">CIN:U74909TN2023PLC158849</div>
    <div class="reg offices">
      <div class="office-col">
        <strong>Registered Office:</strong> 2<sup>nd</sup> Floor, No.313, Refex Towers, Sterling Road, Valluvar Kottam High Road, Nungambakkam, Chennai, Tamil Nadu 600 034<br>
        P: 044 - 3504 0050 | E: info@refex.co.in | W: www.refex.co.in
      </div>
    </div>
    ${pageNum}
  </div>`;
}

function resolveDocChromeMeta(po = {}) {
  const isWorkOrder =
    String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order';
  return {
    isWorkOrder,
    docTitle: isWorkOrder ? 'WORK ORDER' : 'PURCHASE ORDER',
    docLabel: isWorkOrder ? 'Work Order' : 'Purchase Order',
    poNumber: escapeHtml(po.poNumber || '—'),
    poDate: escapeHtml(fmtDateDisplay(po.poDate || po.createdAt || new Date()) || '—'),
    entity: escapeHtml(
      resolveBrandingValue(po, 'entity', 'entity') || 'Refex Green Mobility Limited'
    ),
  };
}

/** Limit images inside letterhead HTML for the repeating page bands */
function constrainLogoHtml(html, maxImgHeightPx, opts = {}) {
  let out = String(html || '')
    // Letterhead HTML sometimes embeds its own <hr> / divider lines — remove them
    .replace(/<hr\b[^>]*>/gi, '')
    .replace(/border-(?:bottom|top)\s*:\s*[^;]+;?/gi, '')
    .replace(/<div[^>]*(?:height\s*:\s*[12]px|border-top\s*:)[^>]*>\s*<\/div>/gi, '')
    .replace(/<div[^>]*class=["'][^"']*(?:divider|line|rule|separator)[^"']*["'][^>]*>\s*<\/div>/gi, '');

  if (opts.enlargeFooter) {
    // Bump tiny letterhead footer fonts so the block reads larger on the PDF
    out = out
      .replace(/font-size\s*:\s*\d+(?:\.\d+)?px/gi, (m) => {
        const n = parseFloat(m.replace(/[^0-9.]/g, ''));
        const next = Number.isFinite(n) ? Math.min(Math.round(n * 1.35), 16) : 11;
        return `font-size:${next}px`;
      })
      .replace(/font-size\s*:\s*\d+(?:\.\d+)?pt/gi, (m) => {
        const n = parseFloat(m.replace(/[^0-9.]/g, ''));
        const next = Number.isFinite(n) ? Math.min(Math.round(n * 1.35), 12) : 9;
        return `font-size:${next}pt`;
      })
      .replace(/max-height\s*:\s*\d+px/gi, `max-height:${maxImgHeightPx}px`)
      .replace(/height\s*:\s*\d+px/gi, (m) => {
        const n = parseInt(m.replace(/\D/g, ''), 10);
        if (!Number.isFinite(n) || n > 120) return m;
        return `height:${Math.min(Math.round(n * 1.35), maxImgHeightPx)}px`;
      });
  }

  return out.replace(/<img\b([^>]*)>/gi, (_m, attrs) => {
    let a = String(attrs || '').replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');
    const align = opts.enlargeFooter ? 'margin:0 auto;' : 'margin-left:auto;';
    return `<img${a} style="max-height:${maxImgHeightPx}px;max-width:100%;height:auto;width:auto;object-fit:contain;display:block;${align}" />`;
  });
}

/** Header logo band — repeated via doc-shell <thead> on every page */
function buildRunningHeader(po = {}) {
  const headerLogo = resolveBrandingValue(po, 'headerLogo', 'header_logo');
  let inner = '';
  if (headerLogo) {
    if (looksLikeHtml(headerLogo)) {
      inner = sanitizeChromeHtml(headerLogo);
    } else if (looksLikeImageSrc(headerLogo)) {
      inner = `<img class="run-header-img" src="${safeImgSrc(headerLogo)}" alt="Header Logo" />`;
    } else {
      inner = `<div class="run-header-text">${escapeHtml(headerLogo)}</div>`;
    }
  } else {
    inner = `<div class="logo"><span class="r1">r</span><span class="e1">e</span><span class="f">f</span><span class="e2">e</span><span class="x">x</span></div>`;
  }
  return `
  <div class="pdf-run-header">
    <div class="pdf-run-header-inner">${inner}</div>
  </div>`;
}

function letterheadFooterInner(po = {}) {
  const footerLogo = resolveBrandingValue(po, 'footerLogo', 'footer_logo');
  const entity = resolveBrandingValue(po, 'entity', 'entity') || 'Refex Green Mobility Limited';
  if (footerLogo) {
    if (looksLikeHtml(footerLogo)) {
      return `<div class="run-footer-html">${sanitizeChromeHtml(footerLogo)}</div>`;
    }
    if (looksLikeImageSrc(footerLogo)) {
      return `<img class="run-footer-img" src="${safeImgSrc(footerLogo)}" alt="Footer Logo" />`;
    }
    return `<div class="run-footer-text">${escapeHtml(footerLogo)}</div>`;
  }
  return `<div class="run-footer-text">${escapeHtml(entity)}</div>`;
}

/** Footer logo band — used in HTML preview page-sheets */
function buildRunningFooter(po = {}) {
  return `
  <div class="pdf-run-footer">
    <div class="pdf-run-footer-inner">${letterheadFooterInner(po)}</div>
  </div>`;
}

function sanitizeChromeHtml(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\{PAGENO\}(?:\s*[-–]\s*\{?nb\}?)?/gi, '')
    .replace(/\{nb\}/gi, '')
    .replace(/<p[^>]*>\s*<\/p>/gi, '');
}

/**
 * Puppeteer chrome — letterhead header + footer on EVERY page.
 * Templates do not inherit page CSS; font-size MUST be set on the root
 * (Chromium defaults chrome headers/footers to ~6px).
 * Images must be data URIs (inlined in poPdfService) or they will not render.
 */
export function buildPoPdfChromeTemplates(po = {}) {
  const side = PO_PDF_LAYOUT.side;
  const root =
    'width:100%;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;' +
    'font-size:13px;line-height:1.4;color:#222;' +
    '-webkit-print-color-adjust:exact;print-color-adjust:exact;';

  const headerLogo = resolveBrandingValue(po, 'headerLogo', 'header_logo');
  let headerInner = '';
  if (headerLogo) {
    if (looksLikeImageSrc(headerLogo) && !looksLikeHtml(headerLogo)) {
      headerInner =
        `<div style="width:100%;text-align:right;">` +
        `<img src="${safeImgSrc(headerLogo)}" style="max-height:40px;max-width:220px;height:auto;width:auto;object-fit:contain;display:inline-block;" alt="Header" />` +
        `</div>`;
    } else if (looksLikeHtml(headerLogo)) {
      headerInner =
        `<div style="width:100%;font-size:13px;text-align:right;">${sanitizeChromeHtml(headerLogo)}</div>`;
    } else {
      headerInner =
        `<div style="width:100%;text-align:right;font-size:14px;font-weight:700;">${escapeHtml(headerLogo)}</div>`;
    }
  } else {
    headerInner =
      `<div style="width:100%;text-align:right;font-size:22px;font-weight:800;font-style:italic;letter-spacing:-1px;">` +
      `<span style="color:#2e3192;">r</span><span style="color:#27aae1;">e</span><span style="color:#39b54a;">f</span>` +
      `<span style="color:#8dc63f;">e</span><span style="color:#f7941d;">x</span></div>`;
  }

  const footerInner = letterheadFooterInner(po);

  const headerTemplate =
    `<div style="${root}height:20mm;max-height:20mm;overflow:hidden;padding:2mm ${side} 0 ${side};box-sizing:border-box;">${headerInner}</div>`;

  const footerTemplate =
    `<div style="${root}height:68mm;max-height:68mm;overflow:hidden;padding:1mm ${side} 2mm ${side};text-align:center;box-sizing:border-box;">` +
    `<div style="width:122%;margin-left:-11%;transform:scale(0.82);transform-origin:top center;font-size:9px;line-height:1.2;text-align:center;">${footerInner}</div>` +
    `</div>`;

  return { headerTemplate, footerTemplate };
}

function wrapSheet(inner, extraClass, po, forPdf) {
  const cls = ['page', 'page-sheet', extraClass].filter(Boolean).join(' ');
  if (forPdf) {
    return `
  <div class="${cls}">
    <div class="page-body">
${inner}
    </div>
  </div>`;
  }
  return `
  <div class="${cls}">
    ${buildRunningHeader(po)}
    <div class="page-body">
${inner}
    </div>
    ${buildRunningFooter(po)}
  </div>`;
}

function pageFooter(po, pageLabel) {
  return footerHtml(po, pageLabel);
}

function tableCloseFoot(colSpan) {
  return `<tfoot class="tbl-end"><tr><td colspan="${colSpan}"></td></tr></tfoot>`;
}

function priceColgroupHtml() {
  return `<colgroup>
    <col class="col-sl" style="width:5%">
    <col class="col-description" style="width:40%">
    <col class="col-uom" style="width:8%">
    <col class="col-qty" style="width:6%">
    <col class="col-unit-rate" style="width:15%">
    <col class="col-tax" style="width:8%">
    <col class="col-total" style="width:18%">
  </colgroup>`;
}

function lineItemRowHtml(item, index, po) {
  return `
    <tr class="line-item po-line-item" data-block="item-${index}">
      <td class="center col-sl">${index + 1}</td>
      <td class="description col-description"><div class="spec-block">${item.itemName ? `<p><strong>${escapeHtml(item.itemName)}</strong></p>` : ''}${looksLikeHtml(item.description) ? item.description : item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}</div></td>
      <td class="center col-uom">${escapeHtml(item.unit || item.uom || 'Nos')}</td>
      <td class="center col-qty">${escapeHtml(item.quantity)}</td>
      ${amountCellHtml(item.unitPrice, po.currency, 'col-rate col-unit-rate unit-rate-cell')}
      <td class="center col-tax">${escapeHtml(item.taxPercentage ?? item.tax_percentage ?? 0)}%</td>
      ${amountCellHtml(item.total, po.currency, 'col-total total-amount-cell')}
    </tr>`;
}

function priceScheduleTheadHtml(continued = false) {
  const title = continued ? 'PRICE SCHEDULE — Continued' : 'PRICE SCHEDULE';
  return `
    ${priceColgroupHtml()}
    <thead>
    <tr>
      <th class="section-title" colspan="7">${title}</th>
    </tr>
    <tr class="col-heads">
      <th class="col-sl">SI.No</th>
      <th class="col-description">Description Of Work</th>
      <th class="col-uom"><span class="nowrap">UOM</span></th>
      <th class="col-qty">Qty</th>
      <th class="col-rate col-unit-rate">Unit Rate</th>
      <th class="col-tax"><span class="nowrap">GST</span></th>
      <th class="col-total"><span class="nowrap">TotalAmount</span></th>
    </tr>
    </thead>`;
}

function priceTotalsBodyHtml(po) {
  return `
    <tr class="total"><td colspan="6">SubTotal</td>${amountCellHtml(po.subtotal, po.currency, 'col-total total-amount-cell')}</tr>
    <tr class="total"><td colspan="6">Add: GST</td>${amountCellHtml(po.taxAmount, po.currency, 'col-total total-amount-cell')}</tr>
    <tr class="total"><td colspan="6">GrandTotal</td>${amountCellHtml(po.grandTotal, po.currency, 'col-total total-amount-cell')}</tr>
    <tr class="amount-words-row">
      <td colspan="7">
        <div class="amount-words-inner">
          <span class="label">Amount In Words:</span>
          <span class="value">${escapeHtml(numberToIndianWords(po.grandTotal))}</span>
        </div>
      </td>
    </tr>`;
}

function lineItemsHtml(po) {
  const items = po.lineItems || [];
  const rows = items.map((item, index) => lineItemRowHtml(item, index, po)).join('');

  return `
  <div class="table-frame">
  <table class="price">
    ${priceScheduleTheadHtml(false)}
    <tbody class="price-items">
    ${rows}
    </tbody>
    <tbody class="price-totals">
    ${priceTotalsBodyHtml(po)}
    </tbody>
    ${tableCloseFoot(7)}
  </table>
  </div>`;
}

function placeholderText(value, fallback = '—') {
  const text = String(value || '').trim();
  return escapeHtml(text || fallback).replace(/\n/g, '<br>');
}

function stripHtmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function isQuoteNoHeader(raw) {
  const text = stripHtmlToText(raw)
    .replace(/\//g, ' ')
    .replace(/\./g, '')
    .replace(/:/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!text) return false;
  if (
    /^(quote|quotation|rfq)\s*(no|number)(\s*(date|c))?$/.test(text) ||
    /^ref\s*no(\s*date)?$/.test(text)
  ) {
    return true;
  }
  return /^(quote|rfq|quotation)\s*(no|number)\b/.test(text) && text.length <= 48;
}

function blankQuotePlaceholders(html) {
  return String(html || '')
    .replace(/\$aos_quotes_quote_no_c/gi, '')
    .replace(/\$aos_quotes_number/gi, '')
    .replace(/\$aos_quotes_name/gi, '')
    .replace(/\$aos_quotes_rfq_no_c/gi, '');
}

/** Quote No is shown on the header line only — never as a Terms & Conditions row. */
function withoutQuoteNoTerms(terms) {
  return (terms || [])
    .filter((term) => !isQuoteNoHeader(term.termsHeader || term.terms_header || ''))
    .map((term) => ({
      ...term,
      termsDescription: blankQuotePlaceholders(term.termsDescription || term.terms_description || ''),
      terms_description: blankQuotePlaceholders(term.termsDescription || term.terms_description || ''),
    }));
}

/** Prefer dedicated quoteNo; else free text typed in a leftover Quote No / RFQ No terms row. */
function resolveQuoteNo(po) {
  const td = po.poTermsDetails || {};
  const direct = String(
    td.quoteNo || po.quoteNo || td.quote_no || po.quote_no || td.quotationNo || td.rfqNo || td.rfq_no || ''
  ).trim();
  if (direct) return direct;

  for (const term of po.termsClauses || []) {
    const header = term.termsHeader || term.terms_header || '';
    if (!isQuoteNoHeader(header)) continue;
    const desc = String(term.termsDescription || term.terms_description || '');
    const withoutPlaceholders = desc
      .replace(/\$aos_quotes_[a-z0-9_]+/gi, ' ')
      .replace(/\$[a-z0-9_]+/gi, ' ');
    const text = stripHtmlToText(withoutPlaceholders)
      .replace(/^[—–\-]+|[—–\-]+$/g, '')
      .trim();
    if (text) return text;
  }
  return '';
}

function withResolvedQuoteNo(po) {
  const quoteNo = resolveQuoteNo(po);
  const td = { ...(po.poTermsDetails || {}), quoteNo };
  return {
    ...po,
    quoteNo,
    poTermsDetails: td,
    termsClauses: withoutQuoteNoTerms(po.termsClauses),
  };
}

/** Replace clause placeholders with live PO entity + vendor + commercial fields */
function applyClausePlaceholders(html, po) {
  const company = escapeHtml(po.entity || po.entityName || 'Refex Group of Companies');
  const vendor = escapeHtml(po.vendorName || 'Vendor');
  const td = po.poTermsDetails || {};
  const deliveryDate = fmtDateDisplay(po.expectedDeliveryDate) || String(po.expectedDeliveryDate || '').trim();
  const isWorkOrder =
    String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order';
  let out = String(html || '')
    // Legacy SugarCRM / letterhead labels
    .replace(/RFQ\s*No\.?/gi, 'Quote No')
    .replace(/RFQ\s*Number/gi, 'Quote Number')
    .replace(/\[Company Name\]/gi, company)
    .replace(/\[Vendor Name\]/gi, vendor)
    .replace(/\$aos_quotes_company_name_c/gi, company)
    .replace(/\$accounts_aos_quotes_1_name_name/gi, vendor)
    .replace(/\$aos_quotes_number/gi, '')
    .replace(/\$aos_quotes_name/gi, '')
    .replace(/\$aos_quotes_quote_no_c/gi, '')
    .replace(/\$aos_quotes_rfq_no_c/gi, '')
    .replace(/\$aos_quotes_inco_terms_c/gi, placeholderText(po.incoterms))
    .replace(/\$aos_quotes_delivery_schedule_c/gi, placeholderText(deliveryDate))
    .replace(/\$aos_quotes_shipment_mode_c/gi, placeholderText(po.incoterms))
    .replace(
      /\$aos_quotes_payment_terms_c/gi,
      placeholderText(td.paymentTermsText || po.paymentTerms)
    )
    .replace(/\$aos_quotes_notes_c/gi, placeholderText(po.specialInstructions))
    .replace(
      /\$aos_quotes_site_address_c/gi,
      placeholderText(td.siteAddress || po.deliveryAddress)
    )
    .replace(/\$aos_quotes_contact_person_c/gi, placeholderText(td.siteContactPerson))
    .replace(/\$aos_quotes_site_contact_phone_c/gi, placeholderText(td.siteContactPhone))
    .replace(/\$aos_quotes_contact_person_mail_c/gi, placeholderText(td.siteContactEmail))
    .replace(/\$aos_quotes_project_manager_c/gi, placeholderText(td.projectManagerHo))
    .replace(
      /\$aos_quotes_projectmanagercontactnumber_c/gi,
      placeholderText(td.projectManagerContact)
    )
    .replace(/\$aos_quotes_pm_email_c/gi, placeholderText(td.projectManagerEmail))
    .replace(
      /\$aos_quotes_invoicing_address_c/gi,
      placeholderText(td.invoicingAddress || td.locationName)
    )
    .replace(/\$aos_quotes_original_address_c/gi, placeholderText(td.mailingAddress));
  if (isWorkOrder) {
    out = out
      .replace(/purchase\s+order\s*\/\s*work\s+order(?:\s*\/\s*service\s+order)?/gi, 'Work Order')
      .replace(/work\s+order\s*\/\s*purchase\s+order/gi, 'Work Order')
      .replace(/PURCHASE\s+ORDER/g, 'WORK ORDER')
      .replace(/Purchase\s+Order/g, 'Work Order')
      .replace(/purchase\s+order/gi, 'work order');
  }
  return out;
}

/** Header may be plain text or rich-text HTML from the editor */
function clauseHeaderHtml(raw, po, fallback = 'Term') {
  const value = String(raw || '').trim();
  if (!value) return escapeHtml(fallback);
  if (looksLikeHtml(value)) return applyClausePlaceholders(value, po);
  return escapeHtml(value);
}

function termsSectionTitle(po) {
  return String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order'
    ? 'Terms and Conditions — Work Order'
    : 'Terms and Conditions — Purchase Order';
}

function termsColgroupHtml() {
  return `<colgroup>
    <col class="col-head" style="width:24%">
    <col class="col-terms" style="width:76%">
  </colgroup>`;
}

function annexureColgroupHtml() {
  return `<colgroup>
    <col class="col-sno" style="width:8mm">
    <col class="col-head" style="width:22%">
    <col class="col-terms" style="width:auto">
  </colgroup>`;
}

function termsTheadHtml(po, continued = false) {
  const title = continued ? `${termsSectionTitle(po)} — Continued` : termsSectionTitle(po);
  return `
          ${termsColgroupHtml()}
          <thead>
            <tr>
              <th class="section-title" colspan="2">${escapeHtml(title)}</th>
            </tr>
            <tr class="col-heads">
              <th class="head-col">HEADERS</th>
              <th class="col-terms">TERMS AND CONDITIONS</th>
            </tr>
          </thead>`;
}

function termRowHtml(term, po, index) {
  const headerRaw = term.termsHeader || term.terms_header || '';
  if (isQuoteNoHeader(headerRaw)) return '';
  const headerHtml = clauseHeaderHtml(headerRaw, po, 'Term');
  const cellHtml = applyClausePlaceholders(term.termsDescription || term.terms_description || '', po);
  return `
    <tr class="terms-row" data-block="term-${index}">
      <th class="head-col">${headerHtml}</th>
      <td>${cellHtml}</td>
    </tr>`;
}

function annexureTheadHtml(docLabel, continued = false) {
  const title = `ANNEXURE-I — ${escapeHtml(docLabel).toUpperCase()} COMMERCIAL TERMS AND CONDITIONS${continued ? ' — Continued' : ''}`;
  return `
            ${annexureColgroupHtml()}
            <thead>
            <tr>
              <th class="section-title" colspan="3">${title}</th>
            </tr>
            <tr class="col-heads">
              <th class="sno-col">S.NO.</th>
              <th class="head-col">HEADERS</th>
              <th class="col-terms">TERMS AND CONDITIONS</th>
            </tr>
          </thead>`;
}

function annexureRowHtml(item, po, idx) {
  return `
      <tr class="terms-row" data-block="annexure-${idx}">
        <td class="sno-col">${idx + 1}.</td>
        <td class="head-col"><strong>${clauseHeaderHtml(item.termsHeader || item.terms_header, po, 'Header')}</strong></td>
        <td>${applyClausePlaceholders(item.termsDescription || item.terms_description || '', po)}</td>
      </tr>`;
}

function termsSummaryHtml(po, terms, forPdf) {
  const visible = withoutQuoteNoTerms(terms);
  if (!visible.length) return '';
  const rows = visible.map((term, index) => termRowHtml(term, po, index)).join('');

  return wrapSheet(
    `
      <div class="table-frame">
        <table class="terms terms-compact">
          ${termsTheadHtml(po, false)}
          <tbody>
            ${rows}
          </tbody>
          ${tableCloseFoot(2)}
        </table>
      </div>`,
    'page-terms',
    po,
    forPdf
  );
}

function sanitizeAnnexureHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function annexureHtmlIsEmpty(html) {
  return !sanitizeAnnexureHtml(html)
    .replace(/<img\b[^>]*>/gi, 'IMG')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function annexureIiItemHtml(row, idx, total, docLabel) {
  const headerHtml = sanitizeAnnexureHtml(row.header || '');
  const bodyHtml = sanitizeAnnexureHtml(row.description || '');
  const extraImages = (row.images || [])
    .map((img) => {
      const src = String(img.src || '').trim();
      if (!src) return '';
      const caption = String(img.caption || '').trim();
      return `<figure class="annexure-figure"><img src="${safeImgSrc(src)}" alt="" />${
        caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
      }</figure>`;
    })
    .join('');
  const comments = String(row.comments || '').trim();
  return `
      <div class="annexure-ii">
        <div class="annexure-ii-title">ANNEXURE-II — TECHNICAL DATA / SCOPE / SPECIFICATIONS (${escapeHtml(
          docLabel
        ).toUpperCase()})</div>
        <div class="annexure-ii-meta">Item ${idx + 1} of ${total}</div>
        ${
          headerHtml && !annexureHtmlIsEmpty(headerHtml)
            ? `<div class="annexure-ii-header">${headerHtml}</div>`
            : ''
        }
        <div class="annexure-ii-body">${bodyHtml}${extraImages}${
          comments ? `<p class="annexure-ii-comments"><strong>Comments:</strong> ${escapeHtml(comments)}</p>` : ''
        }</div>
      </div>`;
}

function annexureIiPagesHtml(po, docLabel = 'Purchase Order', forPdf) {
  const rows = parseAnnexureIi(po.annexureIiRows || po.annexureIiHtml || po.annexure_ii_html || '').filter(
    (row) => !annexureIiRowIsEmpty(row)
  );
  if (!rows.length) return '';

  const total = rows.length;
  return rows
    .map((row, idx) => wrapSheet(annexureIiItemHtml(row, idx, total, docLabel), 'page-annexure-ii', po, forPdf))
    .join('');
}

function annexurePagesHtml(po, annexure, _poTypeLabel, docLabel = 'Purchase Order', forPdf) {
  if (!annexure?.length) return '';

  const rows = annexure.map((item, idx) => annexureRowHtml(item, po, idx)).join('');

  return wrapSheet(
    `
      <div class="table-frame">
        <table class="terms terms-compact annexure-table">
          ${annexureTheadHtml(docLabel, false)}
          <tbody>
            ${rows}
          </tbody>
          ${tableCloseFoot(3)}
        </table>
      </div>`,
    'page-annexure',
    po,
    forPdf
  );
}

function specialNotesInnerHtml(po, options = {}) {
  const signature = options.signature;
  const entityLabel = po.entity || 'Refex Group of Companies';
  const td = po.poTermsDetails || {};
  const siteAddress = td.siteAddress || po.deliveryAddress || '';
  return `
    <div class="special-notes">
      <p><strong>SPECIAL NOTES (if any):</strong></p>
      ${siteAddress ? `<p><span class="lbl">Site Address:</span> ${escapeHtml(siteAddress).replace(/\n/g, '<br>')}</p>` : ''}
      ${td.siteContactPerson || td.siteContactPhone || td.siteContactEmail ? `<p><span class="lbl">Contact person at the site:</span> Name: ${escapeHtml(td.siteContactPerson || '—')}, Phone: ${escapeHtml(td.siteContactPhone || '—')}, Email: ${escapeHtml(td.siteContactEmail || '—')}</p>` : ''}
      ${td.projectManagerHo || td.projectManagerContact || td.projectManagerEmail ? `<p><span class="lbl">Project Manager at the head office:</span> ${escapeHtml(td.projectManagerHo || '—')}, Phone: ${escapeHtml(td.projectManagerContact || '—')}, Email: ${escapeHtml(td.projectManagerEmail || '—')}</p>` : ''}
      ${td.invoicingAddress || td.locationName || td.buyerGstNo ? `<div><p><span class="lbl">Invoicing address:</span></p><p><strong>${escapeHtml(entityLabel)},</strong></p> ${(() => {
        const raw = String(td.invoicingAddress || '').trim();
        if (looksLikeHtml(raw)) return `<div class="inv-addr-rich">${raw}</div>`;
        const lines = [
          raw,
          !raw.includes(String(td.locationName || '')) && td.locationName ? td.locationName : '',
          td.buyerGstNo && !raw.toUpperCase().includes('GSTIN') ? `GSTIN: ${td.buyerGstNo}` : '',
        ].filter(Boolean);
        if (!lines.length && (td.locationName || td.buyerGstNo)) {
          return `<div class="inv-addr-rich">${[
            td.locationName ? `<p><strong>${escapeHtml(td.locationName)}</strong></p>` : '',
            td.buyerGstNo ? `<p>GSTIN: ${escapeHtml(td.buyerGstNo)}</p>` : '',
          ].join('')}</div>`;
        }
        return escapeHtml(lines.join('\n')).replace(/\n/g, '<br>');
      })()}</div>` : ''}
      ${td.mailingAddress ? `<p><span class="lbl">Original invoice to be sent at:</span></p><p><strong>Refex Group of Companies,</strong></p><p>${escapeHtml(td.mailingAddress).replace(/\n/g, '<br>')}</p>` : ''}
      ${td.reasonForCancellation ? `<p><span class="lbl">Reason For Cancellation:</span> ${escapeHtml(td.reasonForCancellation).replace(/\n/g, '<br>')}</p>` : ''}
      ${po.specialInstructions ? `<p><span class="lbl">Note:</span> ${escapeHtml(po.specialInstructions).replace(/\n/g, '<br>')}</p>` : ''}
      ${signature ? `
      <p><strong>FOR ${escapeHtml(entityLabel)},</strong></p>
      <div class="sig-space">
        ${signature.imageDataUrl
          ? `<img class="sig-img${signature.dsc ? ' sig-dsc' : ''}" src="${signature.imageDataUrl}" alt="${signature.dsc ? 'Digital Signature Certificate' : 'Authorized Signature'}" />`
          : ''}
        ${signature.dsc && !signature.imageDataUrl ? `
        <div class="dsc-box">
          <div class="dsc-title">Digitally signed using DSC</div>
          <p>Signed by: <strong>${escapeHtml(signature.dsc.holderName || signature.name || '')}</strong></p>
          <p>Certificate serial: ${escapeHtml(signature.dsc.serial || '—')}</p>
          <p>Issued by: ${escapeHtml(signature.dsc.issuer || '—')}</p>
          <p>Valid till: ${escapeHtml(signature.dsc.validTill || '—')}</p>
          <p>Date / time: ${escapeHtml(signature.date || '')}</p>
        </div>` : ''}
      </div>
      <p>${escapeHtml(signature.date)}<br>
      <strong>Authorized Signatory${signature.dsc ? ' (DSC)' : ''}</strong><br>
      Name: ${escapeHtml(signature.name)}<br>
      Designation: SCM Manager${signature.comments ? `<br>Comments: ${escapeHtml(signature.comments)}` : ''}</p>` : `
      <p><strong>FOR ${escapeHtml(entityLabel)},</strong></p>
      <div class="sig-space"></div>
      <p><strong>Authorized Signatory</strong><br>
      Name: ____________________<br>
      Designation: Head – SCM</p>`}
    </div>`;
}

function specialNotesHtml(po, options = {}) {
  return wrapSheet(specialNotesInnerHtml(po, options), 'page-notes', po, options.forPdf === true);
}

function acknowledgmentInnerHtml(po) {
  return `
    <div class="ack-box">
      <p><strong>Acknowledgment and Acceptance by Seller/Supplier</strong></p>
      <p>We received, read, and understood the terms and conditions mentioned in this order. We hereby acknowledge, confirm and accept the above terms and conditions and the same shall be binding on us as &ldquo;Seller&rdquo;.</p>
      <p><strong>FOR ${escapeHtml(po.vendorName)},</strong></p>
      <div class="sig-gap"></div>
      <p><strong>Authorized Signatory</strong><br>
      <strong>Dated:</strong><br>
      <strong>Place:</strong></p>
    </div>`;
}

function acknowledgmentHtml(po, forPdf) {
  return wrapSheet(acknowledgmentInnerHtml(po), 'page-ack', po, forPdf);
}

/** Letterhead master often embeds a "PURCHASE ORDER" / "WORK ORDER" title — strip so it doesn't duplicate .title */
function adaptLetterheadHeader(html, isWorkOrder) {
  if (!html) return '';
  let out = String(html);
  const gap = '(?:\\s|&nbsp;|&#160;)*';
  const openInline = `(?:<(?:strong|b|span|em)[^>]*>${gap})*`;
  const closeInline = `(?:${gap}<\\/(?:strong|b|span|em)>)*`;
  const titleText = `(?:PURCHASE|WORK)${gap}ORDER(?:${gap}[-:]?${gap}\\d+)?`;
  const titleBlock = new RegExp(
    `<(p|h[1-6]|div)([^>]*)>${gap}${openInline}${titleText}${closeInline}${gap}<\\/\\1>`,
    'gi'
  );
  out = out.replace(titleBlock, '');
  out = out.replace(/RFQ\s*No\.?/gi, 'Quote No').replace(/RFQ\s*Number/gi, 'Quote Number');
  out = out.replace(/Ref\.?\s*No\s*\/?\s*Date\.?/gi, 'Quote No');
  if (isWorkOrder) {
    out = out
      .replace(/purchase\s+order\s*\/\s*work\s+order(?:\s*\/\s*service\s+order)?/gi, 'Work Order')
      .replace(/PURCHASE\s+ORDER/g, 'WORK ORDER')
      .replace(/Purchase\s+Order/g, 'Work Order')
      .replace(/purchase\s+order/gi, 'work order');
  }
  return out.trim();
}

function poIntroHtml(po) {
  const isWorkOrder =
    String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order';
  const docLabel = isWorkOrder ? 'Work Order' : 'Purchase Order';
  const docTitle = isWorkOrder ? 'WORK ORDER' : 'PURCHASE ORDER';
  const vendorAddress = po.vendorAddress || 'Address not available';
  const vendorGst = po.vendorGst || '—';
  const vendorPan = po.vendorPan || '—';
  const vendorPhone = po.vendorPhone || '—';
  const subjectFallback = (po.poTermsDetails && po.poTermsDetails.subject) || po.prTitle || docLabel;
  const letterheadHtml = adaptLetterheadHeader(po.letterheadHeader, isWorkOrder);
  const quoteNo = resolveQuoteNo(po);
  const quoteNoText = quoteNo || '—';
  const poDateText =
    fmtDateDisplay(po.poDate || po.createdAt || new Date()) ||
    String(po.poDate || '').trim() ||
    '—';
  return `
    <div class="title">${docTitle}</div>
    <div class="po-meta">
      <span>${escapeHtml(docLabel)} No. &nbsp;${escapeHtml(po.poNumber)}</span>
      <span>Date: ${escapeHtml(poDateText)}</span>
    </div>
    ${letterheadHtml ? `<div class="letterhead-block">${letterheadHtml}</div>` : ''}
    <div class="info-box">
      <p><strong>To</strong></p>
      <p><strong>${escapeHtml(po.vendorName)},</strong></p>
      <p>${escapeHtml(vendorAddress).replace(/\n/g, '<br>')}</p>
      <p><strong>GST No:</strong>${escapeHtml(vendorGst)}</p>
      <p><strong>PAN No:</strong>${escapeHtml(vendorPan)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(po.vendorEmail)}">${escapeHtml(po.vendorEmail)}</a></p>
      <p><strong>Phone:</strong> ${escapeHtml(vendorPhone)}</p>
      <p>&nbsp;</p>
      <p><strong>Quote No:</strong> ${escapeHtml(quoteNoText)}</p>
      <p>&nbsp;</p>
      <p><strong>Subject:</strong> ${escapeHtml(subjectFallback)}</p>
    </div>`;
}

export function buildPoDocumentHtml(poInput, options = {}) {
  const po = withResolvedQuoteNo(poInput || {});
  const isWorkOrder =
    String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order';
  const docLabel = isWorkOrder ? 'Work Order' : 'Purchase Order';
  const poTypeLabel =
    po.poType === 'long_wo'
      ? 'Long WO'
      : po.poType === 'short_wo'
        ? 'Short WO'
        : po.poType === 'long_po'
          ? 'Long PO'
          : isWorkOrder
            ? 'Short WO'
            : 'Short PO';
  const forPdf = options.forPdf === true;
  const bodyClass = forPdf ? 'po-document po-document-pdf' : 'po-document po-document-preview';

  const page1 = wrapSheet(
    `
    ${poIntroHtml(po)}
    ${lineItemsHtml(po)}`,
    '',
    po,
    forPdf
  );

  const terms = po.termsClauses || [];
  const annexure = po.annexureClauses || [];

  const content = `
${page1}
${termsSummaryHtml(po, terms, forPdf)}
${annexurePagesHtml(po, annexure, poTypeLabel, docLabel, forPdf)}
${annexureIiPagesHtml(po, docLabel, forPdf)}
${specialNotesHtml(po, { ...options, forPdf })}
${acknowledgmentHtml(po, forPdf)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(docLabel)} - ${escapeHtml(po.poNumber)}</title>
<style>${PO_STYLES}</style>
</head>
<body class="${bodyClass}">
${content}
</body>
</html>`;
}

/**
 * Structured fragments for JS page-packing (PDF only).
 * Preview continues to use buildPoDocumentHtml().
 */
export function buildPoPdfParts(poInput, options = {}) {
  const po = withResolvedQuoteNo(poInput || {});
  const isWorkOrder =
    String(po.purchaseType || '').toLowerCase().replace(/[\s-]+/g, '_') === 'work_order';
  const docLabel = isWorkOrder ? 'Work Order' : 'Purchase Order';
  const items = po.lineItems || [];
  const terms = withoutQuoteNoTerms(po.termsClauses || []);
  const annexure = po.annexureClauses || [];
  const annexureIi = parseAnnexureIi(po.annexureIiRows || po.annexureIiHtml || po.annexure_ii_html || '').filter(
    (row) => !annexureIiRowIsEmpty(row)
  );

  return {
    docLabel,
    poNumber: po.poNumber,
    headerHtml: buildRunningHeader(po),
    footerHtml: buildRunningFooter(po),
    detailsHtml: poIntroHtml(po),
    priceThead: priceScheduleTheadHtml(false),
    priceTheadContinued: priceScheduleTheadHtml(true),
    itemRows: items.map((item, index) => lineItemRowHtml(item, index, po)),
    totalsRows: priceTotalsBodyHtml(po),
    termsThead: terms.length ? termsTheadHtml(po, false) : '',
    termsTheadContinued: terms.length ? termsTheadHtml(po, true) : '',
    termRows: terms.map((term, index) => termRowHtml(term, po, index)).filter(Boolean),
    annexureThead: annexure.length ? annexureTheadHtml(docLabel, false) : '',
    annexureTheadContinued: annexure.length ? annexureTheadHtml(docLabel, true) : '',
    annexureRows: annexure.map((item, idx) => annexureRowHtml(item, po, idx)),
    annexureIiBlocks: annexureIi.map((row, idx) => annexureIiItemHtml(row, idx, annexureIi.length, docLabel)),
    notesHtml: specialNotesInnerHtml(po, options),
    ackHtml: acknowledgmentInnerHtml(po),
  };
}
