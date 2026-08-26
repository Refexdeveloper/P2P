import { escapeHtml, formatCurrency, formatEntity, formatRoleDisplayName } from './emailUtils.js';

const ACTION_META = {
  assign: {
    subjectPrefix: 'Action required',
    badge: 'Assigned for review',
    headerBg: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
    accent: '#0369a1',
  },
  sendback: {
    subjectPrefix: 'Sent back',
    badge: 'Sent back for correction',
    headerBg: 'linear-gradient(135deg,#c2410c,#ea580c)',
    accent: '#c2410c',
  },
  reject: {
    subjectPrefix: 'Rejected',
    badge: 'Rejected',
    headerBg: 'linear-gradient(135deg,#b91c1c,#dc2626)',
    accent: '#b91c1c',
  },
  verified: {
    subjectPrefix: 'PO final verified',
    badge: 'Final verified',
    headerBg: 'linear-gradient(135deg,#047857,#10b981)',
    accent: '#047857',
  },
};

/**
 * PO workflow email (manager approval / buyer final verify).
 * @param {'assign'|'sendback'|'reject'|'verified'} action
 */
export function buildPoWorkflowEmail({
  po,
  action,
  stageLabel,
  recipientName,
  actorName,
  actorRole,
  remarks,
  portalUrl,
  ctaLabel,
}) {
  const meta = ACTION_META[action] || ACTION_META.assign;
  const poNumber = po.poNumber || po.po_number || `PO-${po.id || ''}`;
  const prNumber = po.prNumber || po.pr_number || '';
  const title = po.prTitle || po.title || poNumber;
  const amount = po.grandTotal ?? po.totalAmount ?? 0;
  const roleDisplay = formatRoleDisplayName(actorRole || '');
  const stage = stageLabel || 'PO Workflow';

  const subject = `${meta.subjectPrefix}: ${poNumber} — ${stage}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:24px;background:#eef2f7;font-family:Arial,sans-serif;">
  <table width="640" align="center" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px;background:${meta.headerBg};">
        <div style="color:#fff;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">
          ${escapeHtml(meta.badge)}
        </div>
        <div style="color:#fff;font-size:22px;font-weight:800;margin-top:8px;">${escapeHtml(poNumber)}</div>
        <div style="color:#e0f2fe;font-size:14px;margin-top:8px;line-height:1.45;">
          Hello ${escapeHtml(recipientName || 'User')},
          ${
            action === 'assign'
              ? ` a purchase order needs your attention at <strong style="color:#fff;">${escapeHtml(stage)}</strong>.`
              : action === 'sendback'
                ? ` a purchase order was sent back by <strong style="color:#fff;">${escapeHtml(actorName || roleDisplay || 'Approver')}</strong>.`
                : action === 'verified'
                  ? ` the signed purchase order was final-verified by <strong style="color:#fff;">${escapeHtml(actorName || 'SCM Buyer')}</strong>. This mail goes to the requester, approvers, and SCM team only — the vendor is not emailed.`
                : ` a purchase order was rejected by <strong style="color:#fff;">${escapeHtml(actorName || roleDisplay || 'Approver')}</strong>.`
          }
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 28px;">
        <div style="font-size:17px;font-weight:700;color:#0f172a;">${escapeHtml(title)}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
          <tr><td style="padding:16px;">
            <div style="font-size:13px;color:#334155;line-height:1.7;">
              ${prNumber ? `<div><strong>PR:</strong> ${escapeHtml(prNumber)}</div>` : ''}
              <div><strong>Vendor:</strong> ${escapeHtml(po.vendorName || po.vendor_name || '—')}</div>
              <div><strong>Entity:</strong> ${escapeHtml(formatEntity(po))}</div>
              <div><strong>Amount:</strong> ${formatCurrency(amount)}</div>
              <div><strong>Stage:</strong> ${escapeHtml(stage)}</div>
              ${
                actorName || roleDisplay
                  ? `<div><strong>By:</strong> ${escapeHtml(actorName || '')}${roleDisplay ? ` (${escapeHtml(roleDisplay)})` : ''}</div>`
                  : ''
              }
              ${
                action === 'verified'
                  ? `<div style="margin-top:12px;font-size:13px;color:#047857;"><strong>Signed PO</strong> is attached for SCM team. Vendor is not copied on this mail.</div>`
                  : ''
              }
            </div>
          </td></tr>
        </table>
        ${
          remarks
            ? `<div style="margin-top:16px;padding:14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;">
          <div style="font-size:11px;color:#9a3412;text-transform:uppercase;font-weight:700;">Remarks</div>
          <div style="font-size:14px;color:#7c2d12;margin-top:6px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(remarks)}</div>
        </div>`
            : ''
        }
        ${
          portalUrl
            ? `<p style="text-align:center;margin:24px 0 8px 0;">
          <a href="${portalUrl}" target="_blank" style="display:inline-block;padding:13px 26px;background:${meta.accent};color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
            ${escapeHtml(ctaLabel || (action === 'assign' ? 'Open task' : action === 'sendback' ? 'Review &amp; re-sign' : action === 'verified' ? 'Track PO' : 'View status'))}
          </a>
        </p>`
            : ''
        }
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px;background:#f8fafc;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;">
        Procure to Pay — PO workflow notification
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${meta.subjectPrefix}: ${poNumber}`,
    `Stage: ${stage}`,
    prNumber ? `PR: ${prNumber}` : '',
    `Vendor: ${po.vendorName || po.vendor_name || '—'}`,
    `Amount: ${formatCurrency(amount)}`,
    actorName ? `By: ${actorName}` : '',
    remarks ? `Remarks: ${remarks}` : '',
    portalUrl ? `Open: ${portalUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
