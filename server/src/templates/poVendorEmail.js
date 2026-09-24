import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';

/**
 * Mail to Requester: upload Vendor Signed PO (not sent to the vendor).
 * CC typically includes L1 Manager, SCM Manager, and user approvers.
 */
export function buildPoVendorEmail({
  po,
  signerName,
  signerComments,
  scmComments,
  portalUrl,
  recipientName,
}) {
  const greetingName = recipientName || po.requester || 'Requester';
  const subject = `Action required: Upload Vendor Signed PO — ${po.poNumber}`;
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const actionUrl = portalUrl || `${base}/requester/vendor-po-acceptance`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#14b8a6);">
        <div style="color:#fff;font-size:22px;font-weight:800;">Upload Vendor Signed PO</div>
        <div style="color:#ccfbf1;font-size:14px;margin-top:8px;">Please obtain the vendor-signed copy and upload it for this purchase order.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="font-size:16px;color:#0f172a;margin:0 0 8px 0;">Dear <strong>${escapeHtml(greetingName)}</strong>,</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;">
          Purchase order <strong>${escapeHtml(po.poNumber)}</strong> has been signed by SCM Manager.
          Please share the PO with the vendor, collect the <strong>Vendor Signed PO</strong>, and upload it on Vendor PO Acceptance (Manual Entry).
        </p>
        <table width="100%" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr><td style="padding:16px;">
            <div style="font-size:12px;color:#64748b;">PO Number</div>
            <div style="font-size:18px;font-weight:800;color:#0f766e;">${escapeHtml(po.poNumber)}</div>
            <div style="margin-top:12px;font-size:13px;color:#334155;">
              <strong>PR:</strong> ${escapeHtml(po.prNumber || '—')} — ${escapeHtml(po.prTitle || '')}<br/>
              <strong>Vendor:</strong> ${escapeHtml(po.vendorName || '—')}<br/>
              <strong>Entity:</strong> ${escapeHtml(formatEntity(po))}<br/>
              <strong>Amount:</strong> ${formatCurrency(po.grandTotal)}<br/>
              <strong>Payment Terms:</strong> ${escapeHtml(po.paymentTerms || '—')}<br/>
              <strong>Delivery:</strong> ${escapeHtml(po.expectedDeliveryDate || '—')}
            </div>
          </td></tr>
        </table>
        ${scmComments ? `<p style="font-size:13px;color:#334155;background:#fff7ed;padding:12px;border-radius:8px;border:1px solid #fed7aa;margin:16px 0 0 0;"><strong>SCM Team Comments:</strong><br/>${escapeHtml(scmComments).replace(/\n/g, '<br/>')}</p>` : ''}
        ${signerComments ? `<p style="font-size:13px;color:#334155;background:#ecfdf5;padding:12px;border-radius:8px;border:1px solid #bbf7d0;margin:16px 0 0 0;"><strong>SCM Manager Note:</strong> ${escapeHtml(signerComments)}</p>` : ''}
        <p style="text-align:center;margin-top:24px;">
          <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Open Vendor PO Acceptance
          </a>
        </p>
        <p style="font-size:12px;color:#64748b;margin-top:20px;">
          Signed company PO PDF is attached for your reference. Signed by: ${escapeHtml(signerName || 'SCM Manager')} (SCM Manager).
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        This email is sent to the Requester. L1 Manager, SCM Manager, and user approvers (if any) are in CC. The vendor is not copied.
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Action required: Upload Vendor Signed PO — ${po.poNumber}`,
    `Dear ${greetingName},`,
    `Please collect the Vendor Signed PO from ${po.vendorName || 'the vendor'} and upload it on Vendor PO Acceptance.`,
    `PR: ${po.prNumber || '—'} — ${po.prTitle || ''}`,
    `Amount: ${formatCurrency(po.grandTotal)}`,
    signerComments ? `SCM Manager Note: ${signerComments}` : '',
    scmComments ? `SCM Team Comments: ${scmComments}` : '',
    `Open: ${actionUrl}`,
    `Signed by: ${signerName || 'SCM Manager'}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
