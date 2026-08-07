import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';

export function buildPoVendorEmail({ po, signerName, signerComments, portalUrl }) {
  const subject = `Purchase Order ${po.poNumber} — ${po.prTitle}`;
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#14b8a6);">
        <div style="color:#fff;font-size:22px;font-weight:800;">Purchase Order Issued</div>
        <div style="color:#ccfbf1;font-size:14px;margin-top:8px;">Please find the signed PO attached for your action.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="font-size:16px;color:#0f172a;margin:0 0 8px 0;">Dear <strong>${escapeHtml(po.vendorName)}</strong>,</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;">
          A purchase order has been approved and signed by our SCM Manager. Please review the attached PDF and confirm acceptance.
        </p>
        <table width="100%" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr><td style="padding:16px;">
            <div style="font-size:12px;color:#64748b;">PO Number</div>
            <div style="font-size:18px;font-weight:800;color:#0f766e;">${escapeHtml(po.poNumber)}</div>
            <div style="margin-top:12px;font-size:13px;color:#334155;">
              <strong>PR:</strong> ${escapeHtml(po.prNumber)} — ${escapeHtml(po.prTitle)}<br/>
              <strong>Entity:</strong> ${escapeHtml(formatEntity(po))}<br/>
              <strong>Amount:</strong> ${formatCurrency(po.grandTotal)}<br/>
              <strong>Payment Terms:</strong> ${escapeHtml(po.paymentTerms || '—')}<br/>
              <strong>Delivery:</strong> ${escapeHtml(po.expectedDeliveryDate || '—')}
            </div>
          </td></tr>
        </table>
        ${signerComments ? `<p style="font-size:13px;color:#334155;background:#ecfdf5;padding:12px;border-radius:8px;border:1px solid #bbf7d0;"><strong>SCM Manager Note:</strong> ${escapeHtml(signerComments)}</p>` : ''}
        <p style="text-align:center;margin-top:24px;">
          <a href="${portalUrl || `${base}/scm/vendor-po-acceptance`}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Review &amp; Accept PO
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;margin-top:20px;">Signed by: ${escapeHtml(signerName)} (SCM Manager)</p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        This email was sent to the vendor with all procurement participants in CC.
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Purchase Order ${po.poNumber}`,
    `Vendor: ${po.vendorName}`,
    `Amount: ${formatCurrency(po.grandTotal)}`,
    signerComments ? `Note: ${signerComments}` : '',
    `Signed by: ${signerName}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
