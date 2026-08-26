import { escapeHtml, formatCurrency, formatEntity, formatRoleDisplayName } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

export function buildPostRfqActionEmail({
  pr,
  action,
  remarks,
  approverRole,
  requesterName,
  editPr = false,
  appBaseUrl = null,
}) {
  const isReject = action === 'reject';
  const actionLabel = isReject ? 'Rejected' : 'Sent Back for Rework';
  const subject = `PR ${pr.prNumber} ${actionLabel} — ${pr.title}`;
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const portalUrl = wrapPortalUrlWithSso(
    isReject
      ? `${base}/requester/track-pr`
      : editPr
        ? `${base}/requester/edit-pr/${pr.id}`
        : `${base}/requester/rfq-entry/${pr.id}`
  );
  const entityLabel = formatEntity(pr);
  const roleDisplayName = formatRoleDisplayName(approverRole);
  const ctaLabel = isReject
    ? 'View PR Status'
    : editPr
      ? 'Edit PR & Resubmit'
      : 'Revise RFQ & Resubmit';
  const headerTitle = isReject ? `PR ${actionLabel}` : editPr ? `PR ${actionLabel}` : `RFQ ${actionLabel}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr>
      <td style="padding:24px 28px;background:${isReject ? '#dc2626' : '#ea580c'};">
        <div style="color:#fff;font-size:20px;font-weight:800;">${escapeHtml(headerTitle)}</div>
        <div style="color:#fff;font-size:14px;margin-top:6px;opacity:0.9;">Hello ${escapeHtml(requesterName || 'Requester')}, your request was reviewed by ${escapeHtml(roleDisplayName)}.</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(pr.prNumber)} — ${escapeHtml(pr.title)}</div>
        <div style="margin-top:12px;font-size:14px;color:#475569;">Entity: <strong>${escapeHtml(entityLabel)}</strong></div>
        <div style="margin-top:8px;font-size:14px;color:#475569;">Amount: <strong>${formatCurrency(pr.totalAmount)}</strong></div>
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Remarks</div>
          <div style="font-size:14px;color:#334155;margin-top:6px;line-height:1.5;">${escapeHtml(remarks)}</div>
        </div>
        <p style="margin-top:20px;text-align:center;">
          <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#0369a1;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;">
            ${escapeHtml(ctaLabel)}
          </a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `PR ${pr.prNumber} ${actionLabel}`,
    `Role: ${roleDisplayName}`,
    `Remarks: ${remarks}`,
    `${ctaLabel}: ${portalUrl}`,
  ].join('\n');

  return { subject, html, text };
}
