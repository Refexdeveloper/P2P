import { escapeHtml, formatEntity } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

const ACTION_COPY = {
  approve: {
    headline: 'Request Approved Successfully',
    actionLabel: 'Approved',
    accent: '#059669',
    accentBg: '#ecfdf5',
    accentBorder: '#bbf7d0',
  },
  reject: {
    headline: 'Request Rejected Successfully',
    actionLabel: 'Rejected',
    accent: '#dc2626',
    accentBg: '#fef2f2',
    accentBorder: '#fecaca',
  },
  send_back: {
    headline: 'Request Sent Back Successfully',
    actionLabel: 'Sent Back',
    accent: '#ea580c',
    accentBg: '#fff7ed',
    accentBorder: '#fed7aa',
  },
};

/**
 * Confirmation email to the approver who just acted on a PR.
 */
export function buildPrApproverActionConfirmationEmail({
  pr,
  approverName = '',
  action = 'approve',
  remarks = '',
  appBaseUrl = null,
}) {
  const copy = ACTION_COPY[action] || ACTION_COPY.approve;
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const trackUrl = wrapPortalUrlWithSso(`${base}/requester/track-pr`);
  const requestId = pr?.prNumber || pr?.pr_number || (pr?.id || pr?.prId ? `#${pr.id || pr.prId}` : '—');
  const title = pr?.title || 'Purchase Request';
  const entityLabel = formatEntity(pr);

  const subject = `${copy.headline} — ${requestId}`;

  const remarksHtml = remarks
    ? `
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Your remarks</div>
          <div style="font-size:14px;color:#334155;margin-top:6px;line-height:1.5;">${escapeHtml(remarks)}</div>
        </div>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" cellpadding="0" cellspacing="0" border="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;background:linear-gradient(135deg,#0f766e,#0d9488);">
        <div style="color:#fff;font-size:20px;font-weight:800;">${escapeHtml(copy.headline)}</div>
        <div style="color:#ccfbf1;font-size:14px;margin-top:8px;line-height:1.45;">
          Hello ${escapeHtml(approverName || 'Approver')}, this confirms your action on the purchase request below.
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${copy.accentBg};border:1px solid ${copy.accentBorder};border-radius:10px;">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-size:11px;color:${copy.accent};text-transform:uppercase;font-weight:700;">Request ID</div>
              <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(requestId)}</div>
              <div style="font-size:14px;color:#475569;margin-top:8px;">${escapeHtml(title)}</div>
            </td>
            <td style="padding:16px 18px;text-align:right;vertical-align:top;">
              <div style="font-size:11px;color:${copy.accent};text-transform:uppercase;font-weight:700;">Action taken</div>
              <div style="display:inline-block;margin-top:6px;padding:8px 14px;background:#fff;border:1px solid ${copy.accentBorder};border-radius:999px;font-size:14px;font-weight:800;color:${copy.accent};">
                ${escapeHtml(copy.actionLabel)}
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:14px;font-size:14px;color:#475569;">Entity: <strong>${escapeHtml(entityLabel)}</strong></div>
        ${remarksHtml}
        <p style="margin:22px 0 0;text-align:center;">
          <a href="${trackUrl}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            View request →
          </a>
        </p>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
          This is a confirmation for your records. Workflow notifications to other parties are unchanged.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    copy.headline,
    `Request ID: ${requestId}`,
    `Title: ${title}`,
    `Action taken: ${copy.actionLabel}`,
    entityLabel !== '—' ? `Entity: ${entityLabel}` : '',
    remarks ? `Remarks: ${remarks}` : '',
    `View: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

export function normalizeApproverConfirmationAction(action) {
  const a = String(action || '').toLowerCase().trim();
  if (a === 'approve' || a === 'approved' || a === 'verified' || a === 'submitted') return 'approve';
  if (a === 'reject' || a === 'rejected') return 'reject';
  if (a === 'return' || a === 'rework' || a === 'sendback' || a === 'send_back') return 'send_back';
  return null;
}
