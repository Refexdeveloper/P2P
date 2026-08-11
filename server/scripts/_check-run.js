import { buildPoDocumentHtml, buildPoPdfChromeTemplates } from '../src/templates/poDocumentTemplate.js';
import { htmlToPdf } from '../src/services/poPdfService.js';
import fs from 'fs';
import path from 'path';

const headerPng =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="#2e3192"/><text x="80" y="26" fill="#fff" font-size="16" font-family="Arial" text-anchor="middle" font-weight="700">HEADER LOGO</text></svg>`
  ).toString('base64');

// Realistic HTML footer like letterhead master (this was failing in Puppeteer chrome)
const footerHtml = `
<div style="text-align:center">
  <div style="font-weight:700;color:#2e3192;font-size:14px">Refex Holding Private Limited</div>
  <div style="font-size:10px;color:#666">(Formerly Sherisha Technologies Private Limited) A refex group company</div>
  <div style="display:inline-block;background:#2e3192;color:#fff;padding:2px 10px;border-radius:12px;font-size:10px;margin:4px 0">CIN: U70200TN2010PTC074345</div>
  <div style="font-size:9px;color:#444;margin-top:4px">Registered Office · Corporate Office · Chennai</div>
</div>`;

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
  footerLogo: footerHtml,
  lineItems: [
    {
      itemName: 'Laptop',
      description: '<p>14 inch business laptop</p>',
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
  termsClauses: [{ termsHeader: 'Pay', termsDescription: '<p>Net 30</p>' }],
  annexureClauses: [{ termsHeader: 'Parties', termsDescription: '<p>Parties clause</p>' }],
  poTermsDetails: { subject: 'Footer fix test' },
  paymentTerms: 'Net 30',
};

const html = buildPoDocumentHtml(po);
const chrome = buildPoPdfChromeTemplates(po);
console.log('hasTfoot', html.includes('<tfoot>'));
console.log('hasRunFooter', html.includes('pdf-run-footer'));
console.log('hasFooterCompany', html.includes('Refex Holding Private Limited'));
console.log('chromePageOnly', chrome.footerTemplate.includes('pageNumber') && !chrome.footerTemplate.includes('Refex Holding'));
console.log('printShowsFooter', !html.includes('.pdf-run-footer {\n      display: none'));

const out = path.join('server/uploads/po', '_run_logo_test.pdf');
await htmlToPdf(html, out, chrome);
console.log('pdfBytes', fs.statSync(out).size);
