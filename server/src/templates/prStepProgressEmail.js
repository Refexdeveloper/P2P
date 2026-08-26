import {
  escapeHtml,
  formatCurrency,
  formatEntity,
  formatRoleDisplayName,
} from './emailUtils.js';

/**
 * Requester FYI mail — every workflow step move (approved / submitted / next step).
 */
export function buildPrStepProgressEmail({
  pr,
  requesterName,
  action = 'approve',
  actorRole = '',
  actorName = '',
  completedStepLabel = '',
  nextStepLabel = '',
  remarks = '',
  appBaseUrl = null,
}) {
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const trackUrl = `${base}/requester/track-pr`;
  const entityLabel = formatEntity(pr);
  const roleDisplay = formatRoleDisplayName(actorRole) || actorRole || 'Approver';
  const actorLine = actorName ? `${actorName} (${roleDisplay})` : roleDisplay;

  const isSubmit = action === 'submit' || action === 'submitted' || action === 'raised';
  const isApprove = action === 'approve' || action === 'approved';

  const headline = isSubmit
    ? 'Your PR was submitted'
    : isApprove
      ? 'Step approved — workflow moved'
      : 'PR workflow update';

  const subject = nextStepLabel
    ? `${pr.prNumber}: ${isSubmit ? 'Submitted' : 'Approved'} → next: ${nextStepLabel}`
    : `${pr.prNumber}: ${isSubmit ? 'Submitted' : 'Approved'} — ${pr.title}`;

  const intro = isSubmit
    ? `Hello ${escapeHtml(requesterName || 'Requester')}, your purchase request was raised successfully and moved to the next step.`
    : `Hello ${escapeHtml(requesterName || 'Requester')}, <strong>${escapeHtml(actorLine)}</strong> approved your request. The workflow has moved to the next step.`;

  const completedBlock = completedStepLabel
    ? `
        <tr>
          <td width="50%" style="padding:6px;">
            <table width="100%" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700;">Completed step</div>
              <div style="font-size:15px;font-weight:800;color:#047857;margin-top:4px;">${escapeHtml(completedStepLabel)}</div>
              <div style="font-size:12px;color:#065f46;margin-top:4px;">by ${escapeHtml(actorLine)}</div>
            </td></tr></table>
          </td>
          <td width="50%" style="padding:6px;">
            <table width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-size:10px;color:#1d4ed8;text-transform:uppercase;font-weight:700;">Next step</div>
              <div style="font-size:15px;font-weight:800;color:#1e40af;margin-top:4px;">${escapeHtml(nextStepLabel || 'In progress')}</div>
              <div style="font-size:12px;color:#1e3a8a;margin-top:4px;">Action required by next owner</div>
            </td></tr></table>
          </td>
        </tr>`
    : `
        <tr>
          <td style="padding:6px;">
            <table width="100%" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"><tr><td style="padding:12px 14px;">
              <div style="font-size:10px;color:#1d4ed8;text-transform:uppercase;font-weight:700;">Next step</div>
              <div style="font-size:15px;font-weight:800;color:#1e40af;margin-top:4px;">${escapeHtml(nextStepLabel || 'In progress')}</div>
            </td></tr></table>
          </td>
        </tr>`;

  const remarksHtml = remarks
    ? `
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Remarks</div>
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
        <div style="color:#fff;font-size:20px;font-weight:800;">${escapeHtml(headline)}</div>
        <div style="color:#ccfbf1;font-size:14px;margin-top:8px;line-height:1.45;">${intro}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(pr.prNumber)} — ${escapeHtml(pr.title)}</div>
        <div style="margin-top:10px;font-size:14px;color:#475569;">Entity: <strong>${escapeHtml(entityLabel)}</strong></div>
        <div style="margin-top:6px;font-size:14px;color:#475569;">Amount: <strong>${formatCurrency(pr.totalAmount)}</strong></div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;">
          ${completedBlock}
        </table>
        ${remarksHtml}
        <p style="margin:22px 0 0;text-align:center;">
          <a href="${trackUrl}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            Track PR status →
          </a>
        </p>
        <p style="margin:14px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
          You will get another update whenever this PR moves to the next step.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    headline,
    `${pr.prNumber} — ${pr.title}`,
    completedStepLabel ? `Completed: ${completedStepLabel} by ${actorLine}` : '',
    nextStepLabel ? `Next step: ${nextStepLabel}` : '',
    remarks ? `Remarks: ${remarks}` : '',
    `Track: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
