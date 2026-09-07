import { escapeHtml, formatEntity } from './emailUtils.js';

const COPY = {
  EXPIRY_7_DAYS: {
    headline: 'Cloud Subscription expires in 7 days',
    body: 'The Cloud Subscription will expire in 7 days.',
    showRenew: false,
  },
  EXPIRY_3_DAYS: {
    headline: 'Cloud Subscription expires in 3 days',
    body: 'The Cloud Subscription will expire in 3 days.',
    showRenew: false,
  },
  EXPIRY_1_DAY: {
    headline: 'Cloud Subscription expires tomorrow',
    body: 'The Cloud Subscription will expire in 1 day.',
    showRenew: false,
  },
  POST_EXPIRY_DAY_1: {
    headline: 'Cloud Subscription has expired — renew?',
    body: 'The Cloud Subscription has expired. Do you want to renew this subscription?',
    showRenew: true,
  },
  POST_EXPIRY_DAY_2: {
    headline: 'Cloud Subscription expired — final renewal reminder',
    body: 'Your Cloud Subscription has expired. Please renew it if continued service is required.',
    showRenew: true,
  },
};

export function buildCloudSubscriptionReminderEmail({
  subscription,
  notificationType,
  requesterName = '',
  renewUrl = '',
}) {
  const copy = COPY[notificationType] || COPY.POST_EXPIRY_DAY_1;
  const subNo = subscription?.subscriptionNumber || '—';
  const title = subscription?.title || 'Cloud Subscription';
  const freq = String(subscription?.billingFrequency || '—');
  const expiry = subscription?.expiryDate || subscription?.expiryDateRaw || '—';
  const vendor = subscription?.vendorName || subscription?.cloudProvider || '—';

  const subject = `${copy.headline} — ${subNo}`;

  const renewBtn =
    copy.showRenew && renewUrl
      ? `<p style="margin:22px 0 0;text-align:center;">
          <a href="${renewUrl}" style="display:inline-block;padding:12px 28px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Renew Subscription
          </a>
        </p>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#0d9488);">
        <div style="color:#ccfbf1;font-size:12px;font-weight:700;letter-spacing:0.04em;">CLOUD SUBSCRIPTION</div>
        <div style="color:#fff;font-size:20px;font-weight:800;margin-top:8px;">${escapeHtml(copy.headline)}</div>
        <div style="color:#ccfbf1;font-size:14px;margin-top:8px;">Hello ${escapeHtml(requesterName || 'Requester')},</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.5;">${escapeHtml(copy.body)}</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;">
          <tr><td style="padding:14px 16px;">
            <div style="font-size:11px;color:#0f766e;text-transform:uppercase;font-weight:700;">Subscription</div>
            <div style="font-size:18px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(subNo)}</div>
            <div style="font-size:14px;color:#475569;margin-top:6px;">${escapeHtml(title)}</div>
          </td></tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;width:40%;">Vendor</td>
            <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(vendor)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;">Frequency</td>
            <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;text-transform:capitalize;">${escapeHtml(freq)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-size:13px;color:#64748b;">Expiry Date</td>
            <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:600;">${escapeHtml(expiry)}</td>
          </tr>
        </table>
        ${renewBtn}
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.headline,
    copy.body,
    `Subscription: ${subNo}`,
    `Title: ${title}`,
    `Vendor: ${vendor}`,
    `Frequency: ${freq}`,
    `Expiry: ${expiry}`,
    copy.showRenew && renewUrl ? `Renew: ${renewUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
