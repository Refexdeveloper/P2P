import { buildPoDocumentHtml, buildPoPdfChromeTemplates } from '../src/templates/poDocumentTemplate.js';
import { htmlToPdf } from '../src/services/poPdfService.js';
import fs from 'fs';
import path from 'path';

// Tiny 1x1 PNG + a visible blue PNG header/footer to mimic uploaded letterhead images
const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// Larger-ish solid logo bars (still small) — proves data:image path works in fixed bands
const headerPng =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#2e3192"/><text x="80" y="26" fill="#fff" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">HEADER LOGO</text></svg>`
  ).toString('base64');
const footerPng =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="36"><rect width="280" height="36" fill="#27aae1"/><text x="140" y="24" fill="#fff" font-size="12" font-family="Arial" text-anchor="middle" font-weight="700">FOOTER LOGO</text></svg>`
  ).toString('base64');

const longTerms = Array.from({ length: 18 }, (_, i) => ({
  termsHeader: `Term ${i + 1}`,
  termsDescription: `<p>Clause ${i + 1}: ${'Work order commercial term text. '.repeat(8)}</p>`,
}));

const po = {
  purchaseType: 'work_order',
  poNumber: 'WO-FIX-1',
  poType: 'short_po',
  createdAt: new Date().toISOString(),
  vendorName: 'Acme',
  vendorAddress: 'Chennai',
  vendorEmail: 'a@b.com',
  vendorPhone: '1',
  vendorGst: '—',
  vendorPan: '—',
  prNumber: 'PR-1',
  department: 'IT',
  requester: 'Sathish',
  entity: 'Refex Holding Private Limited',
  currency: 'INR',
  headerLogo: headerPng,
  footerLogo: footerPng,
  lineItems: [
    {
      itemName: 'Laptop',
      description: `<p>14 inch business laptop ${tinyPng ? '' : ''}</p>`,
      quantity: 1,
      unitPrice: 50000,
      taxPercentage: 18,
      total: 50000,
      uom: "No's",
    },
  ],
  subtotal: 50000,
  taxAmount: 9000,
  grandTotal: 59000,
  termsClauses: longTerms,
  annexureClauses: [{ termsHeader: 'Parties', termsDescription: '<p>Parties clause</p>' }],
  poTermsDetails: { subject: 'Logo fix test' },
  paymentTerms: 'Net 30',
};

const html = buildPoDocumentHtml(po);
console.log('hasRunHeader', html.includes('pdf-run-header'));
console.log('hasRunFooter', html.includes('pdf-run-footer'));
console.log('hasHeaderImg', html.includes('run-header-img'));
console.log('hasFooterImg', html.includes('run-footer-img'));
console.log('printKeepsBands', !html.includes('.pdf-run-header,\n    .pdf-run-footer {\n      display: none'));
const chrome = buildPoPdfChromeTemplates(po);
console.log('chromeHasPage', chrome.footerTemplate.includes('pageNumber'));
console.log('chromeHasFooterLogo', chrome.footerTemplate.includes('FOOTER LOGO') || chrome.footerTemplate.includes('run-footer') || chrome.footerTemplate.includes('<img'));

const out = path.join('server/uploads/po', '_run_logo_test.pdf');
await htmlToPdf(html, out, buildPoPdfChromeTemplates(po));
console.log('pdfBytes', fs.statSync(out).size);
