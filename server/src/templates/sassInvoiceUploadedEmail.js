import { escapeHtml, formatCurrency, formatEntity } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

/**
 * FYI mail after Cloud Subscription invoice upload —
 * sent to L1 Manager, Srivaths, and Mugesh.
 */
export function buildSassInvoiceUploadedEmail({
  pr,
  invoice,
  uploaderName = 'Requester',
  recipientName = 'Approver',
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

  const subject = `Cloud Subscription — Invoice uploaded · ${prNumber}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f766e,#0d9488);padding:28px 32px;">
        <div style="font-size:11px;color:#ccfbf1;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Cloud Subscription Request</div>
        <div style="font-size:22px;font-weight:800;color:#fff;margin-top:8px;">Invoice file uploaded</div>
        <div style="font-size:14px;color:#ecfdf5;margin-top:8px;">Requester has submitted the invoice — routed to Accounts.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 32px;">
        <p style="font-size:15px;color:#0f172a;margin:0 0 14px 0;">Hello <strong>${escapeHtml(recipientName)}</strong>,</p>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 18px 0;">
          <strong>${escapeHtml(uploaderName)}</strong> uploaded the invoice for this Cloud Subscription purchase request.
          The file is with Accounts for verification (SCM skipped).
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:12px;color:#0f766e;font-weight:700;text-transform:uppercase;">PR</div>
            <div style="font-size:18px;font-weight:800;color:#134e4a;margin-top:4px;">${escapeHtml(prNumber)}</div>
            <div style="font-size:14px;color:#334155;margin-top:6px;font-weight:600;">${escapeHtml(title)}</div>
            <div style="margin-top:14px;font-size:13px;color:#334155;line-height:1.75;">
              <div><strong>Entity:</strong> ${escapeHtml(entityLabel)}</div>
              <div><strong>Invoice number:</strong> ${escapeHtml(String(invoiceNumber))}</div>
              <div><strong>Invoice file:</strong> ${escapeHtml(String(fileName))}</div>
              <div><strong>Amount:</strong> ${formatCurrency(amount, currency)}</div>
              <div><strong>Uploaded by:</strong> ${escapeHtml(uploaderName)}</div>
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
        Procure to Pay — Cloud Subscription invoice upload notice
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Cloud Subscription — Invoice uploaded · ${prNumber}`,
    '',
    `Hello ${recipientName},`,
    `${uploaderName} uploaded the invoice for this Cloud Subscription purchase request.`,
    '',
    `PR: ${prNumber} — ${title}`,
    `Entity: ${entityLabel}`,
    `Invoice number: ${invoiceNumber}`,
    `Invoice file: ${fileName}`,
    `Amount: ${formatCurrency(amount, currency)}`,
    `Uploaded by: ${uploaderName}`,
    '',
    `View: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
