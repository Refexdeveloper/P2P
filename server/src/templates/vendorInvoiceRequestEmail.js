import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';

export function buildVendorInvoiceRequestEmail({ invoice, po, portalUrl }) {
  const poNumber = po.poNumber || po.po_number || '';
  const vendorName = po.vendorName || po.vendor_name || invoice.vendor_name || 'Vendor';
  const grnNumber = invoice.grnNumber || invoice.grn_number || '';
  const amount = Number(invoice.po_grand_total || po.grandTotal || 0);
  const subject = `Invoice request — ${poNumber}${grnNumber ? ` / ${grnNumber}` : ''}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#b45309,#f59e0b);">
        <div style="color:#fff;font-size:22px;font-weight:800;">Invoice Submission Request</div>
        <div style="color:#fff7ed;font-size:14px;margin-top:8px;">Goods received — please submit your tax invoice.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="font-size:16px;color:#0f172a;margin:0 0 8px 0;">Dear <strong>${escapeHtml(vendorName)}</strong>,</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;">
          We have recorded goods receipt against your purchase order. Please submit the invoice using the link below.
        </p>
        <table width="100%" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr><td style="padding:16px;">
            <div style="font-size:12px;color:#64748b;">PO Number</div>
            <div style="font-size:18px;font-weight:800;color:#b45309;">${escapeHtml(poNumber)}</div>
            <div style="margin-top:12px;font-size:13px;color:#334155;line-height:1.7;">
              ${grnNumber ? `<div><strong>GRN:</strong> ${escapeHtml(grnNumber)}</div>` : ''}
              <div><strong>PR:</strong> ${escapeHtml(po.prNumber || po.pr_number || '')} — ${escapeHtml(po.prTitle || po.title || '')}</div>
              <div><strong>Entity:</strong> ${escapeHtml(formatEntity(po))}</div>
              <div><strong>Amount:</strong> ${formatCurrency(amount)}</div>
              <div><strong>Payment Terms:</strong> ${escapeHtml(po.paymentTerms || po.payment_terms || '—')}</div>
            </div>
          </td></tr>
        </table>
        <p style="text-align:center;margin-top:24px;">
          <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#b45309;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Submit Invoice
          </a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        Procure to Pay — vendor invoice request
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Invoice request for ${poNumber}`,
    grnNumber ? `GRN: ${grnNumber}` : '',
    `Amount: ${formatCurrency(amount)}`,
    `Submit: ${portalUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
