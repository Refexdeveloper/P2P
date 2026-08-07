import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';

export function buildRfqSubmittedNotifyRequesterEmail({
  pr,
  vendorName,
  requesterName,
  submission,
  reviewUrl,
}) {
  const subject = `Vendor Quotation Submitted: ${pr.prNumber} — ${vendorName}`;

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:16px;border:1px solid #dbe3ee;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 32px;">
        <div style="font-size:11px;color:#ccfbf1;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">P2P Procurement</div>
        <div style="font-size:24px;color:#fff;font-weight:800;margin-top:8px;">Vendor Quotation Received</div>
        <div style="font-size:14px;color:#e6fffa;margin-top:8px;">Hello ${escapeHtml(requesterName || 'Requester')}, please review the submitted quotation.</div>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">PR Number</div>
        <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(pr.prNumber)}</div>
        <div style="font-size:16px;font-weight:600;color:#334155;margin-top:6px;">${escapeHtml(pr.title)}</div>
        <div style="font-size:13px;color:#475569;margin-top:8px;">Entity: <strong>${escapeHtml(formatEntity(pr))}</strong> · ${escapeHtml(pr.department || '')}</div>
        <div style="margin-top:20px;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
          <div style="font-size:13px;font-weight:700;color:#047857;">${escapeHtml(vendorName)} has submitted a quotation</div>
          <table width="100%" style="margin-top:12px;font-size:13px;">
            <tr><td style="padding:6px 0;color:#64748b;">Quoted Price</td><td style="padding:6px 0;text-align:right;font-weight:700;">${formatCurrency(submission.quotedPrice)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Lead Time</td><td style="padding:6px 0;text-align:right;">${submission.leadTime} days</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Payment Terms</td><td style="padding:6px 0;text-align:right;">${escapeHtml(submission.paymentTerms)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Warranty</td><td style="padding:6px 0;text-align:right;">${escapeHtml(submission.warranty || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Delivery Terms</td><td style="padding:6px 0;text-align:right;">${escapeHtml(submission.deliveryTerms || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;">Compliance</td><td style="padding:6px 0;text-align:right;">${submission.compliance ? 'Yes' : 'No'}</td></tr>
          </table>
        </div>
        <table cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px;"><tr><td>
          <a href="${reviewUrl}" style="display:inline-block;padding:16px 28px;background:#0f766e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;">Review Quotations →</a>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = [
    subject,
    '',
    `${vendorName} submitted a quotation for ${pr.prNumber}.`,
    `Price: ${formatCurrency(submission.quotedPrice)} | Lead: ${submission.leadTime} days`,
    `Review: ${reviewUrl}`,
  ].join('\n');

  return { subject, html, text };
}
