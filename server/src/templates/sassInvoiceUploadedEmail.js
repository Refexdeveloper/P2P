import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

/**
 * FYI mail after Cloud Subscription invoice upload by Mugesh —
 * sent to Requester, L1 Manager, L2 (Srivaths), and itdev@refex.co.in.
 */
export function buildSassInvoiceUploadedEmail({
  pr,
  invoice,
  uploaderName = 'Mugesh',
  recipientName = 'Team',
  appBaseUrl = null,
}) {
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const trackUrl = wrapPortalUrlWithSso(`${base}/requester/track-pr`);
  const prNumber = pr?.prNumber || pr?.pr_number || '';
  const title = pr?.title || '';
  const entityLabel = formatEntity(pr);
  const invoiceNumber = invoice?.invoiceNumber || invoice?.invoice_number || '—';
  const fileName = invoice?.invoiceFileName || invoice?.invoice_file_name || invoice?.fileName || '—';
  const amount = Number(
    invoice?.invoiceGrandTotal ??
      invoice?.invoice_grand_total ??
      pr?.totalAmount ??
      pr?.total_amount ??
      0
  );
  const currency = pr?.currency || pr?.currency_code || 'INR';
  const vendorName = pr?.vendorName || pr?.vendor_name || '';
  const justification = pr?.justification || '';

  const subject = `Cloud Subscription — Completed · Invoice uploaded · ${prNumber}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 32px;">
        <div style="font-size:11px;color:#ccfbf1;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Cloud Subscription Request</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-top:8px;">Completed — Invoice uploaded</div>
        <div style="font-size:14px;color:#ecfdf5;margin-top:8px;">Mugesh approved and uploaded the invoice — routed to Accounts (SCM skipped).</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;">
        <p style="font-size:15px;color:#0f172a;margin:0 0 14px 0;">Hello <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 18px 0;">
          <strong>${escapeHtml(uploaderName)}</strong> completed Mugesh approval and uploaded the invoice for this Cloud Subscription purchase request.
          The invoice file is attached to this email and is with Accounts for verification.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:12px;color:#0f766e;font-weight:700;text-transform:uppercase;">PR details</div>
            <div style="font-size:18px;font-weight:800;color:#134e4a;margin-top:4px;">${escapeHtml(prNumber)}</div>
            <div style="font-size:14px;color:#334155;margin-top:6px;font-weight:600;">${escapeHtml(title)}</div>
            <div style="margin-top:14px;font-size:13px;color:#334155;line-height:1.75;">
              <div><strong>Entity:</strong> ${escapeHtml(entityLabel)}</div>
              ${vendorName ? `<div><strong>Vendor:</strong> ${escapeHtml(vendorName)}</div>` : ''}
              <div><strong>Invoice number:</strong> ${escapeHtml(String(invoiceNumber))}</div>
              <div><strong>Invoice file:</strong> ${escapeHtml(String(fileName))} (attached)</div>
              <div><strong>Amount:</strong> ${formatCurrency(amount, currency)}</div>
              <div><strong>Status:</strong> Completed — With Accounts</div>
              <div><strong>Uploaded by:</strong> ${escapeHtml(uploaderName)}</div>
              ${
                justification
                  ? `<div style="margin-top:8px;"><strong>Justification:</strong> ${escapeHtml(String(justification).slice(0, 500))}</div>`
                  : ''
              }
            </div>
          </td></tr>
        </table>
        <p style="text-align:center;margin:28px 0 0 0;">
          <a href="${trackUrl}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            View in portal →
          </a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 32px;background:#f8fafc;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        Procure to Pay — Cloud Subscription completion notice
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Cloud Subscription — Completed · Invoice uploaded · ${prNumber}`,
    '',
    `Hello ${recipientName},`,
    `${uploaderName} completed Mugesh approval and uploaded the invoice for this Cloud Subscription purchase request.`,
    'The invoice file is attached. Status: Completed — With Accounts (SCM skipped).',
    '',
    `PR: ${prNumber} — ${title}`,
    `Entity: ${entityLabel}`,
    vendorName ? `Vendor: ${vendorName}` : '',
    `Invoice number: ${invoiceNumber}`,
    `Invoice file: ${fileName}`,
    `Amount: ${formatCurrency(amount, currency)}`,
    `Uploaded by: ${uploaderName}`,
    justification ? `Justification: ${String(justification).slice(0, 500)}` : '',
    '',
    `View: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
