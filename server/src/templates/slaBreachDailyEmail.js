import { escapeHtml } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

/**
 * Daily morning SLA-breach reminder for User / L1 / L2 approvals only.
 */
export function buildSlaBreachDailyEmail({
  pr,
  approverName,
  approvalType,
  startDate,
  slaDue,
  waitingDays,
  portalUrl = null,
  appBaseUrl = null,
}) {
  const name = String(approverName || 'Approver').trim() || 'Approver';
  const typeLabel = String(approvalType || 'Approval').trim() || 'Approval';
  const waitingLabel =
    Number(waitingDays) === 1 ? '1 day' : `${Math.max(0, Number(waitingDays) || 0)} days`;
  const prNumber = String(pr?.prNumber || pr?.pr_number || '').trim();
  const title = String(pr?.title || '').trim();
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const actionUrl = wrapPortalUrlWithSso(portalUrl || `${base}/tasks`);

  const subject = '[SLA Breached] Approval Pending - Action Required';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ee;">
        <tr>
          <td style="background:linear-gradient(135deg,#9a3412,#c2410c);padding:28px 32px;">
            <div style="font-size:11px;color:#ffedd5;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">SLA Breached</div>
            <div style="font-size:22px;color:#fff;font-weight:800;margin-top:8px;">Approval Pending — Action Required</div>
            <div style="font-size:14px;color:#ffedd5;margin-top:8px;">Hello ${escapeHtml(name)}, the following approval task has exceeded its SLA.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.55;">
              Hello ${escapeHtml(name)},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.55;">
              The following approval task has exceeded its SLA and is still awaiting your action.
            </p>
            ${
              prNumber
                ? `<div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">PR Number</div>
            <div style="font-size:20px;color:#0f172a;font-weight:800;margin:4px 0 4px;">${escapeHtml(prNumber)}</div>
            ${title ? `<div style="font-size:15px;color:#475569;margin-bottom:18px;font-weight:600;">${escapeHtml(title)}</div>` : '<div style="margin-bottom:18px;"></div>'}`
                : ''
            }
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #fed7aa;border-radius:12px;background:#fff7ed;overflow:hidden;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #ffedd5;">
                  <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Approval Type</div>
                  <div style="font-size:15px;color:#0f172a;font-weight:700;margin-top:4px;">${escapeHtml(typeLabel)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #ffedd5;">
                  <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Approver</div>
                  <div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:4px;">${escapeHtml(name)}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #ffedd5;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="50%" style="vertical-align:top;padding-right:8px;">
                      <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Start Date</div>
                      <div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:4px;">${escapeHtml(startDate || '—')}</div>
                    </td>
                    <td width="50%" style="vertical-align:top;padding-left:8px;">
                      <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">SLA Due</div>
                      <div style="font-size:15px;color:#0f172a;font-weight:600;margin-top:4px;">${escapeHtml(slaDue || '—')}</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #ffedd5;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="50%" style="vertical-align:top;padding-right:8px;">
                      <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Waiting</div>
                      <div style="font-size:15px;color:#0f172a;font-weight:700;margin-top:4px;">${escapeHtml(waitingLabel)}</div>
                    </td>
                    <td width="50%" style="vertical-align:top;padding-left:8px;">
                      <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Status</div>
                      <div style="font-size:15px;color:#c2410c;font-weight:800;margin-top:4px;">SLA Breached</div>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-size:15px;color:#9a3412;font-weight:700;">SLA exceeded — awaiting action.</div>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:15px;color:#334155;line-height:1.55;">
              Please review and take the required action.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 28px 32px;" align="center">
            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;">
              Open approval queue →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
            Thanks,<br/>
            <strong style="color:#0f172a;">P2P Procurement</strong>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

  const text = [
    `Hello ${name},`,
    '',
    'The following approval task has exceeded its SLA and is still awaiting your action.',
    '',
    prNumber ? `PR: ${prNumber}${title ? ` — ${title}` : ''}` : null,
    `Approval Type: ${typeLabel}`,
    `Approver: ${name}`,
    `Start Date: ${startDate || '—'}`,
    `SLA Due: ${slaDue || '—'}`,
    `Waiting: ${waitingLabel}`,
    'Status: SLA Breached',
    '',
    'SLA exceeded — awaiting action.',
    '',
    'Please review and take the required action.',
    '',
    `Open: ${actionUrl}`,
    '',
    'Thanks,',
    'P2P Procurement',
  ]
    .filter((line) => line != null)
    .join('\n');

  return { subject, html, text };
}
