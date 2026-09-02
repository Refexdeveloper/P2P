import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generatePoPdf, PO_UPLOAD_DIR } from '../src/services/poPdfService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const headerPng =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#2e3192"/><text x="80" y="26" fill="#fff" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">HEADER</text></svg>`
  ).toString('base64');

const footerHtml = `
<div style="text-align:center">
  <div style="font-weight:700;color:#2e3192;font-size:14px">Refex Holding Private Limited</div>
  <div style="font-size:10px;color:#666">(Formerly Sherisha Technologies Private Limited) A refex group company</div>
  <div style="display:inline-block;background:#2e3192;color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;margin:4px 0">CIN: U70200TN2010PTC074345</div>
  <div style="font-size:9px;color:#444;margin-top:4px">Registered Office · Corporate Office · Chennai</div>
</div>`;

function bullets(n, prefix) {
  return Array.from({ length: n }, (_, i) => `<li>${prefix} item ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</li>`).join('');
}

const longTermsHtml = `
<p><strong>Reporting and Communication:</strong></p>
<ul>${bullets(8, 'Reporting')}</ul>
<p><strong>Escalation and Backup Support:</strong></p>
<ul>${bullets(6, 'Escalation')}</ul>
<p><strong>Compliance and Standards:</strong></p>
<ul>${bullets(7, 'Compliance')}</ul>
<p><strong>Holiday Coverage:</strong></p>
<ul>${bullets(5, 'Holiday')}</ul>
<p><strong>Additional Support Options:</strong></p>
<ul>${bullets(9, 'Support')}</ul>
`;

const po = {
  purchaseType: 'purchase_order',
  poNumber: 'PO-TERMS-TEST',
  poType: 'short_po',
  createdAt: new Date().toISOString(),
  vendorName: 'Acme Supplies Pvt Ltd',
  vendorAddress: '123 Industrial Area, Chennai',
  vendorEmail: 'vendor@acme.com',
  vendorPhone: '9876543210',
  vendorGst: '33AAAAA0000A1Z5',
  vendorPan: 'AAAAA0000A',
  prNumber: 'PR-TEST-1',
  department: 'IT',
  requester: 'Test User',
  entity: 'Refex Holding Private Limited',
  currency: 'INR',
  headerLogo: headerPng,
  footerLogo: footerHtml,
  lineItems: [
    {
      itemName: 'Annual Maintenance',
      description: '<p>Comprehensive AMC for IT infrastructure</p>',
      quantity: 1,
      unitPrice: 250000,
      taxPercentage: 18,
      total: 250000,
      uom: "No's",
    },
  ],
  subtotal: 250000,
  taxAmount: 45000,
  grandTotal: 295000,
  termsClauses: [
    { termsHeader: 'Payment', termsDescription: '<p>Net 30 days from invoice date.</p>' },
    { termsHeader: 'Delivery', termsDescription: '<p>Within 15 working days.</p>' },
    {
      termsHeader: 'Service Level',
      termsDescription: longTermsHtml,
    },
  ],
  annexureClauses: [{ termsHeader: 'Parties', termsDescription: '<p>Standard parties clause for testing.</p>' }],
  poTermsDetails: { subject: 'Terms pagination validation PO' },
  paymentTerms: 'Net 30',
};

if (!fs.existsSync(PO_UPLOAD_DIR)) fs.mkdirSync(PO_UPLOAD_DIR, { recursive: true });

const result = await generatePoPdf(po, { fileName: '_terms_pagination_test.pdf' });
console.log('result', result);

if (result.htmlOnly) {
  console.error('PDF generation failed:', result.pdfError);
  process.exit(1);
}

const html = fs.readFileSync(result.htmlPath, 'utf8');
const pageCount = (html.match(/class="pdf-page"/g) || []).length;
console.log('pages in HTML:', pageCount);

const { default: puppeteer } = await import('puppeteer-core');
import os from 'os';

const CHROME_PATHS = {
  win32: [
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
      : null,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean),
};

const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  CHROME_PATHS[os.platform()]?.find((p) => p && fs.existsSync(p));

if (!executablePath) {
  console.log('Skip overflow check — Chrome not found');
  process.exit(0);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.emulateMediaType('print');

const report = await page.evaluate(() => {
  const pages = Array.from(document.querySelectorAll('.pdf-page'));
  return pages.map((pageEl, i) => {
    const content = pageEl.querySelector('.pdf-content');
    const footer = pageEl.querySelector('.pdf-footer');
    const overflow = content ? content.scrollHeight > content.clientHeight + 4 : false;
    const pageRect = pageEl.getBoundingClientRect();
    return {
      page: i + 1,
      pageHeight: Math.round(pageRect.height),
      contentScroll: content?.scrollHeight || 0,
      contentClient: content?.clientHeight || 0,
      overflow,
      footerTop: footer ? Math.round(footer.getBoundingClientRect().top) : 0,
      pageBottom: Math.round(pageRect.bottom),
    };
  });
});

await browser.close();

console.log('page report:', JSON.stringify(report, null, 2));
const bad = report.filter((p) => p.overflow);
if (bad.length) {
  console.error('OVERFLOW on pages:', bad.map((p) => p.page).join(', '));
  process.exit(1);
}
console.log('OK — no content overflow detected');
