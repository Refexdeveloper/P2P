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

export function numberToIndianWords(amount) {
  const num = Math.round(Number(amount || 0));
  if (!Number.isFinite(num) || num === 0) return 'Zero Rupees and Zero Paisa Only.';

  let n = num;
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

  return `${parts.join(' ')} Rupees and Zero Paisa Only.`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fmtMoney(amount) {
  return Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDateDisplay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
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

function logoHtml(po = {}) {
  const headerLogo = resolveBrandingValue(po, 'headerLogo', 'header_logo');
  if (headerLogo) {
    if (looksLikeHtml(headerLogo)) {
      return `<div class="header header-custom">${headerLogo}</div>`;
    }
    if (looksLikeImageSrc(headerLogo)) {
      return `<div class="header"><img class="header-logo-img" src="${safeImgSrc(headerLogo)}" alt="Header Logo" /></div>`;
    }
    return `<div class="header header-custom">${escapeHtml(headerLogo)}</div>`;
  }
  return `<div class="header"><div class="logo"><span class="r1">r</span><span class="e1">e</span><span class="f">f</span><span class="e2">e</span><span class="x">x</span></div></div>`;
}

function footerHtml(po = {}, pageLabel = '') {
  const footerLogo = resolveBrandingValue(po, 'footerLogo', 'footer_logo');
  const entity = resolveBrandingValue(po, 'entity', 'entity');
  const pageNum = pageLabel ? `<div class="pagenum">${escapeHtml(pageLabel)}</div>` : '';

  // Master footer set → show only master footer image/HTML (no entity brand text, no default footer)
  if (footerLogo) {
    if (looksLikeHtml(footerLogo)) {
      return `
  <div class="footer footer-custom">
    <div class="footer-master-content">${footerLogo}</div>
    ${pageNum}
  </div>`;
    }
    if (looksLikeImageSrc(footerLogo)) {
      return `
  <div class="footer footer-custom">
    <img class="footer-logo-img" src="${safeImgSrc(footerLogo)}" alt="Footer" />
    ${pageNum}
  </div>`;
    }
    return `
  <div class="footer footer-custom">
    <div class="footer-master-content">${escapeHtml(footerLogo)}</div>
    ${pageNum}
  </div>`;
  }

  // Default footer only when Letterhead Master has no footer logo
  const brandName = entity || 'Refex Green Mobility Limited';
  return `
  <div class="footer">
    <div class="brand">${escapeHtml(brandName)}</div>
    <div class="sub">(Wholly-Owned Subsidiary of Refex Industries Limited)</div>
    <hr>
    <div class="cin-bar">CIN:U74909TN2023PLC158849</div>
    <div class="reg"><strong>Registered Office:</strong> 2<sup>nd</sup> Floor, No.313, Refex Towers, Sterling Road, Valluvar Kottam High Road, Nungambakkam, Chennai, Tamil Nadu 600 034<br>
    P: 044 - 3504 0050 | E: info@refex.co.in | W: www.refex.co.in</div>
    ${pageNum}
  </div>`;
}

function lineItemsHtml(po) {
  const items = po.lineItems || [];
  const rows = items.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><div class="spec-block"><p>${escapeHtml(item.description)}</p>${item.category ? `<p><strong>Category:</strong> ${escapeHtml(item.category)}</p>` : ''}</div></td>
      <td class="center">${escapeHtml(item.uom || item.category || "No's")}</td>
      <td class="center">${escapeHtml(item.quantity)}</td>
      <td class="right">${fmtMoney(item.unitPrice)}</td>
      <td class="right">${fmtMoney(item.total)}</td>
    </tr>`).join('');

  return `
  <table class="price">
    <caption>PRICE SCHEDULE</caption>
    <tr>
      <th style="width:6%">SI.No</th>
      <th>Description Of Work</th>
      <th style="width:8%">UOM</th>
      <th style="width:6%">Qty</th>
      <th style="width:14%">Unit Rate Rs.</th>
      <th style="width:14%">TOTAL Amt Rs.</th>
    </tr>
    ${rows}
    <tr class="total"><td colspan="5">SubTotal</td><td class="right">${fmtMoney(po.subtotal)}</td></tr>
    <tr class="total"><td colspan="5">Add: GST@${escapeHtml(po.gstPercentage)}% Extra</td><td class="right">${fmtMoney(po.taxAmount)}</td></tr>
    <tr class="total"><td colspan="5">GrandTotal</td><td class="right">${fmtMoney(po.grandTotal)}</td></tr>
  </table>
  <div class="amount-words">
    <span class="label">Amount In Words:</span>
    <span class="value">${escapeHtml(numberToIndianWords(po.grandTotal))}</span>
  </div>`;
}

function termsSummaryHtml(po, terms) {
  if (!terms?.length) return '';
  const rows = terms.map((term) => `
    <tr>
      <th class="head-col">${escapeHtml(term.termsHeader || term.terms_header || 'Term')}</th>
      <td>${term.termsDescription || term.terms_description || ''}</td>
    </tr>`).join('');

  return `
  <div class="page">
    ${logoHtml(po)}
    <table class="terms">
      <caption>Terms and Conditions</caption>
      ${rows}
    </table>
    ${footerHtml(po, 'Terms')}
  </div>`;
}

function annexurePagesHtml(po, annexure, poTypeLabel) {
  if (!annexure?.length) return '';
  const chunks = chunkRows(annexure, 4);
  let startIndex = 0;

  return chunks.map((chunk, pageIndex) => {
    const rows = chunk.map((item, idx) => {
      const serial = startIndex + idx + 1;
      return `
      <tr>
        <td class="sno-col">${serial}.</td>
        <td><strong>${escapeHtml(item.termsHeader || item.terms_header || 'Header')}</strong></td>
        <td>${item.termsDescription || item.terms_description || ''}</td>
      </tr>`;
    }).join('');
    startIndex += chunk.length;

    const title = pageIndex === 0 ? 'ANNEXURE-I' : 'ANNEXURE-I (Cont.)';
    const subtitle = pageIndex === 0 ? 'COMMERCIAL TERMS AND CONDITIONS' : '';

    return `
    <div class="page">
      ${logoHtml(po)}
      <h2 class="annexure-title">${title}</h2>
      ${subtitle ? `<h3 class="annexure-sub">${subtitle}</h3>` : '<div style="height:8px"></div>'}
      <table class="terms">
        <tr><th class="sno-col">S.NO.</th><th style="width:14%">HEADERS</th><th>TERMS AND CONDITIONS</th></tr>
        ${rows}
      </table>
      ${footerHtml(po, `${poTypeLabel} Annexure ${pageIndex + 1}`)}
    </div>`;
  }).join('');
}

function specialNotesHtml(po, options = {}) {
  const signature = options.signature;
  const entityLabel = po.entity || 'Refex Group of Companies';
  return `
  <div class="page">
    ${logoHtml(po)}
    <div class="special-notes">
      <p><strong>SPECIAL NOTES (if any):</strong></p>
      ${po.deliveryAddress ? `<p><span class="lbl">Site Address:</span>${escapeHtml(po.deliveryAddress).replace(/\n/g, '<br>')}</p>` : ''}
      ${po.specialInstructions ? `<p><span class="lbl">Instructions:</span>${escapeHtml(po.specialInstructions).replace(/\n/g, '<br>')}</p>` : ''}
      <p><span class="lbl">PR Reference:</span> ${escapeHtml(po.prNumber)}</p>
      <p><span class="lbl">Department:</span> ${escapeHtml(po.department || '—')}</p>
      <p><span class="lbl">Requester:</span> ${escapeHtml(po.requester || '—')}</p>
      <p><span class="lbl">Payment Terms:</span> ${escapeHtml(po.paymentTerms || '—')}</p>
      <p><span class="lbl">Incoterms:</span> ${escapeHtml(po.incoterms || '—')}</p>
      <p><span class="lbl">Expected Delivery:</span> ${escapeHtml(po.expectedDeliveryDate || '—')}</p>
      ${signature ? `
      <p><strong>FOR ${escapeHtml(entityLabel)},</strong></p>
      <div class="sig-space">
        ${signature.imageDataUrl
          ? `<img class="sig-img" src="${signature.imageDataUrl}" alt="Authorized Signature" />`
          : ''}
      </div>
      <p>${escapeHtml(signature.date)}<br>
      <strong>Authorized Signatory</strong><br>
      Name: ${escapeHtml(signature.name)}<br>
      Designation: SCM Manager${signature.comments ? `<br>Comments: ${escapeHtml(signature.comments)}` : ''}</p>` : `
      <p><strong>FOR ${escapeHtml(entityLabel)},</strong></p>
      <div class="sig-space"></div>
      <p><strong>Authorized Signatory</strong><br>
      Name: ____________________<br>
      Designation: Head – SCM</p>`}
    </div>
    ${footerHtml(po, 'Special Notes')}
  </div>`;
}

function acknowledgmentHtml(po) {
  return `
  <div class="page">
    ${logoHtml(po)}
    <div class="ack-box">
      <p><strong>Acknowledgment and Acceptance by Seller/Supplier</strong></p>
      <p>We received, read, and understood the terms and conditions mentioned in this order. We hereby acknowledge, confirm and accept the above terms and conditions and the same shall be binding on us as &ldquo;Seller&rdquo;.</p>
      <p><strong>FOR ${escapeHtml(po.vendorName)},</strong></p>
      <div class="sig-gap"></div>
      <p><strong>Authorized Signatory</strong><br>
      <strong>Dated:</strong><br>
      <strong>Place:</strong></p>
    </div>
    ${footerHtml(po, 'Acknowledgment')}
  </div>`;
}

const PO_STYLES = `
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    color: #1a1a1a;
    max-width: 850px;
    margin: 0 auto;
    padding: 30px 25px;
    line-height: 1.4;
  }
  .page { padding-bottom: 40px; border-bottom: 1px dashed #ccc; margin-bottom: 40px; page-break-after: always; }
  .page:last-child { border-bottom: none; page-break-after: auto; }
  .header { display: flex; justify-content: flex-end; margin-bottom: 6px; }
  .header-logo-img { max-height: 56px; max-width: 220px; object-fit: contain; display: block; }
  .footer-custom { text-align: center; margin-top: 20px; padding-top: 8px; }
  .footer-custom .footer-master-content { width: 100%; }
  .footer-custom .footer-master-content img { max-width: 100%; height: auto; display: block; margin: 0 auto; }
  .footer-logo-img {
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: 140px;
    object-fit: contain;
    object-position: center;
    display: block;
    margin: 0 auto;
  }
  .footer-custom .pagenum { text-align: center; font-size: 11px; margin-top: 6px; color: #555; }
  .logo { font-size: 30px; font-weight: 800; font-style: italic; letter-spacing: -1px; }
  .logo .r1 { color: #2e3192; } .logo .e1 { color: #27aae1; } .logo .f { color: #39b54a; }
  .logo .e2 { color: #8dc63f; } .logo .x { color: #f7941d; }
  .title { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px; margin: 10px 0 14px 0; }
  .po-meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 13px; }
  .info-box { border: 1px solid #000; padding: 10px 14px; margin-bottom: 16px; }
  .info-box p { margin: 3px 0; }
  .info-box a { color: #1155cc; text-decoration: underline; }
  table.price { width: 100%; border-collapse: collapse; margin-bottom: 0; }
  table.price caption { border: 1px solid #000; border-bottom: none; padding: 5px; font-weight: bold; text-align: center; background: #f2f2f2; }
  table.price th, table.price td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; font-size: 12px; }
  table.price th { background: #f2f2f2; text-align: center; }
  table.price td.center { text-align: center; }
  table.price td.right { text-align: right; }
  table.price tr.total td { font-weight: bold; }
  table.price .spec-block p { margin: 6px 0; }
  .amount-words { border: 1px solid #000; border-top: none; padding: 8px 10px; display: flex; justify-content: space-between; font-size: 12.5px; }
  .amount-words .label { font-weight: bold; white-space: nowrap; margin-right: 10px; }
  .amount-words .value { font-weight: bold; text-align: right; }
  table.terms { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.terms caption { font-weight: bold; padding: 6px; border: 1px solid #000; border-bottom: none; background: #f2f2f2; }
  table.terms th, table.terms td { border: 1px solid #000; padding: 7px 9px; vertical-align: top; text-align: left; }
  table.terms th { background: #f2f2f2; }
  table.terms td.head-col, table.terms th.head-col { width: 15%; font-weight: bold; }
  table.terms td.sno-col, table.terms th.sno-col { width: 6%; text-align: center; }
  table.terms tr, table.price tr { page-break-inside: avoid; break-inside: avoid; }
  table.terms thead, table.price thead { display: table-header-group; }
  .footer { text-align: center; margin-top: 24px; padding-top: 10px; page-break-inside: avoid; break-inside: avoid; }
  .footer .brand { font-weight: bold; color: #2e3192; font-size: 14px; }
  .footer .sub { font-size: 11px; color: #333; margin-bottom: 6px; }
  .footer .cin-bar { display: inline-block; background: linear-gradient(90deg,#2e3192,#27aae1,#39b54a,#f7941d); color: #fff; padding: 3px 14px; border-radius: 12px; font-size: 11px; font-weight: bold; margin: 6px 0; }
  .footer .reg { font-size: 10.5px; color: #333; margin-top: 4px; }
  .footer .pagenum { text-align: center; font-size: 11px; margin-top: 8px; }
  .footer hr { border: none; border-top: 2px solid #27aae1; margin: 6px 0; }
  h2.annexure-title { text-align: center; margin: 0 0 4px 0; font-size: 15px; }
  h3.annexure-sub { text-align: center; margin: 0 0 14px 0; font-size: 13px; }
  .special-notes, .ack-box { border: 1px solid #000; padding: 12px 16px; }
  .special-notes p, .ack-box p { margin: 6px 0; }
  .special-notes .lbl { font-weight: bold; }
  .sig-space { min-height: 60px; margin: 8px 0 12px; }
  .sig-space .sig-img {
    max-height: 70px;
    max-width: 220px;
    object-fit: contain;
    display: block;
  }
  .ack-box .sig-gap { height: 70px; }
  .letterhead-block { margin-bottom: 10px; }
`;

export function buildPoDocumentHtml(po, options = {}) {
  const poTypeLabel = po.poType === 'long_po' ? 'Long PO' : 'Short PO';
  const poDate = fmtDateDisplay(po.createdAt || new Date());
  const vendorAddress = po.vendorAddress || 'Address not available';
  const vendorGst = po.vendorGst || '—';
  const vendorPan = po.vendorPan || '—';
  const vendorPhone = po.vendorPhone || '—';

  const page1 = `
  <div class="page">
    ${logoHtml(po)}
    <div class="title">PURCHASE ORDER</div>
    <div class="po-meta">
      <span>Purchase Order No. &nbsp;${escapeHtml(po.poNumber)}</span>
      <span>Date: ${poDate}</span>
    </div>
    ${po.letterheadHeader ? `<div class="letterhead-block">${po.letterheadHeader}</div>` : ''}
    <div class="info-box">
      <p><strong>To</strong></p>
      <p><strong>${escapeHtml(po.vendorName)},</strong></p>
      <p>${escapeHtml(vendorAddress).replace(/\n/g, '<br>')}</p>
      <p><strong>GST No:</strong>${escapeHtml(vendorGst)}</p>
      <p><strong>PAN No:</strong>${escapeHtml(vendorPan)}</p>
      <p><strong>Email:</strong> <a href="mailto:${escapeHtml(po.vendorEmail)}">${escapeHtml(po.vendorEmail)}</a></p>
      <p><strong>Phone:</strong> ${escapeHtml(vendorPhone)}</p>
      <p>&nbsp;</p>
      <p><strong>Ref.No/Date.</strong> PR: ${escapeHtml(po.prNumber)}, Date: ${poDate}</p>
      <p>&nbsp;</p>
      <p><strong>Subject:</strong> ${escapeHtml(po.prTitle || 'Purchase Order')}</p>
      <p>&nbsp;</p>
      <p><strong>PO Type:</strong> ${escapeHtml(poTypeLabel)}</p>
      ${po.entity ? `<p><strong>Entity:</strong> ${escapeHtml(po.entity)}</p>` : ''}
      <p><strong>Department:</strong> ${escapeHtml(po.department || '—')}</p>
      <p><strong>Requester:</strong> ${escapeHtml(po.requester || '—')}</p>
    </div>
    ${lineItemsHtml(po)}
    ${footerHtml(po, '1')}
  </div>`;

  const terms = po.termsClauses || [];
  const annexure = po.annexureClauses || [];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Purchase Order - ${escapeHtml(po.poNumber)}</title>
<style>${PO_STYLES}</style>
</head>
<body>
${page1}
${termsSummaryHtml(po, terms)}
${annexurePagesHtml(po, annexure, poTypeLabel)}
${specialNotesHtml(po, options)}
${acknowledgmentHtml(po)}
</body>
</html>`;
}
