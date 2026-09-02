import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { generatePoPdf, PO_UPLOAD_DIR } from '../src/services/poPdfService.js';

const footerHtml = `
<div style="text-align:center">
  <div style="font-weight:700;color:#2e3192;font-size:14px">Refex Holding Private Limited</div>
  <div style="font-size:10px;color:#666">(Formerly Sherisha Technologies Private Limited) A refex group company</div>
  <div style="display:inline-block;background:#2e3192;color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;margin:4px 0">CIN: U70200TN2010PTC074345</div>
  <div style="font-size:9px;color:#444;margin-top:4px">Registered Office · Corporate Office · Chennai</div>
</div>`;

const headerPng =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#2e3192"/><text x="80" y="26" fill="#fff" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">HEADER</text></svg>`
  ).toString('base64');

function bullets(n, prefix) {
  return Array.from(
    { length: n },
    (_, i) =>
      `<li>${prefix} item ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</li>`
  ).join('');
}

function longTermsHtml() {
  return `
<p><strong>Reporting and Communication:</strong></p>
<ul>${bullets(8, 'Reporting')}</ul>
<p><strong>Escalation and Backup Support:</strong></p>
<ul>${bullets(6, 'Escalation')}</ul>
<p><strong>Compliance and Standards:</strong></p>
<ul>${bullets(7, 'Compliance')}</ul>
<p><strong>Holiday Coverage:</strong></p>
<ul>${bullets(5, 'Holiday')}</ul>
<p><strong>Additional Support Options:</strong></p>
<ul>${bullets(9, 'Support')}</ul>`;
}

function longAnnexureHtml() {
  return `
<p><strong>Scope of Work:</strong></p>
<ul>${bullets(10, 'Scope')}</ul>
<p><strong>Deliverables:</strong></p>
<ul>${bullets(8, 'Deliverable')}</ul>
<p><strong>Acceptance Criteria:</strong></p>
<ul>${bullets(7, 'Acceptance')}</ul>`;
}

function basePo(overrides = {}) {
  return {
    purchaseType: 'purchase_order',
    poNumber: 'PO-PDF-TEST',
    poType: 'short_po',
    createdAt: new Date().toISOString(),
    vendorName: 'Acme Supplies Pvt Ltd',
    vendorAddress: 'Chennai',
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
        description: '<p>Comprehensive AMC</p>',
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
    termsClauses: [{ termsHeader: 'Payment', termsDescription: '<p>Net 30 days.</p>' }],
    annexureClauses: [{ termsHeader: 'Parties', termsDescription: '<p>Standard parties clause.</p>' }],
    poTermsDetails: { subject: 'PDF pagination test' },
    paymentTerms: 'Net 30',
    ...overrides,
  };
}

const CASES = [
  { name: 'short', po: basePo() },
  {
    name: 'medium-terms',
    po: basePo({
      termsClauses: [
        { termsHeader: 'Payment', termsDescription: '<p>Net 30.</p>' },
        { termsHeader: 'Delivery', termsDescription: `<p>On schedule.</p><ul>${bullets(3, 'Del')}</ul>` },
      ],
    }),
  },
  {
    name: 'long-terms',
    po: basePo({
      termsClauses: [
        { termsHeader: 'Payment', termsDescription: '<p>Net 30.</p>' },
        { termsHeader: 'Service Level', termsDescription: longTermsHtml() },
      ],
    }),
  },
  {
    name: 'long-annexure',
    po: basePo({
      annexureClauses: [
        { termsHeader: 'Parties', termsDescription: '<p>Parties clause.</p>' },
        { termsHeader: 'Scope', termsDescription: longAnnexureHtml() },
      ],
    }),
  },
  {
    name: 'long-both',
    po: basePo({
      termsClauses: [
        { termsHeader: 'Payment', termsDescription: '<p>Net 30.</p>' },
        { termsHeader: 'Service Level', termsDescription: longTermsHtml() },
      ],
      annexureClauses: [
        { termsHeader: 'Parties', termsDescription: '<p>Parties clause.</p>' },
        { termsHeader: 'Scope', termsDescription: longAnnexureHtml() },
      ],
    }),
  },
];

if (!fs.existsSync(PO_UPLOAD_DIR)) fs.mkdirSync(PO_UPLOAD_DIR, { recursive: true });

const CHROME_PATHS = {
  win32: [
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
      : null,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean),
};

const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  CHROME_PATHS[os.platform()]?.find((p) => p && fs.existsSync(p));

const { default: puppeteer } = executablePath ? await import('puppeteer-core') : { default: null };

async function inspectHtml(html) {
  if (!puppeteer || !executablePath) {
    return { skipped: true };
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMediaType('print');

  const report = await page.evaluate(() => {
    const tolerance = 3;
    return Array.from(document.querySelectorAll('.pdf-page')).map((pageEl, i) => {
      const content = pageEl.querySelector('.pdf-content');
      const footer = pageEl.querySelector('.pdf-footer');
      const pageRect = pageEl.getBoundingClientRect();
      const footerTop = footer?.getBoundingClientRect().top || 0;
      let overlap = false;
      content?.querySelectorAll('tbody tr[data-block], .table-frame, .annexure-ii').forEach((el) => {
        if (el.getBoundingClientRect().bottom > footerTop + tolerance) overlap = true;
      });
      return {
        page: i + 1,
        pageHeight: Math.round(pageRect.height),
        overlap,
        contentOverflow: content ? content.scrollHeight > content.clientHeight + tolerance : false,
      };
    });
  });
  await browser.close();
  return report;
}

let failed = false;
for (const testCase of CASES) {
  const fileName = `_pdf_test_${testCase.name}.pdf`;
  const result = await generatePoPdf(testCase.po, { fileName });
  if (result.htmlOnly) {
    console.error(`FAIL ${testCase.name}:`, result.pdfError);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(result.htmlPath, 'utf8');
  const pages = (html.match(/class="pdf-page"/g) || []).length;
  const report = await inspectHtml(html);
  const bad = (report || []).filter((p) => p.overlap || p.contentOverflow || Math.abs(p.pageHeight - 1123) > 8);
  console.log(`${testCase.name}: pages=${pages}`, bad.length ? `FAIL ${JSON.stringify(bad)}` : 'OK');
  if (bad.length) failed = true;
}

process.exit(failed ? 1 : 0);
