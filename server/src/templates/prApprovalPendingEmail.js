import { escapeHtml, formatCurrency, formatEntity, formatRoleDisplayName } from './emailUtils.js';

const ROLE_PORTAL_PATH = {
  'HOD Approver': '/tasks',
  'PR Manager': '/pr-manager/dashboard',
  CFO: '/cfo/dashboard',
  Requester: '/requester/rfq-entry',
  'SCM Buyer': '/scm/rfq-entry',
};

const POST_RFQ_PORTAL_PATH = {
  'HOD Approver': '/rfq-approval',
  'PR Manager': '/rfq-approval',
  'SCM Manager': '/rfq-approval',
  CFO: '/rfq-approval',
  'SCM Buyer': '/rfq-approval',
};

function getPortalPath(role, postRfq) {
  if (postRfq) return POST_RFQ_PORTAL_PATH[role] || '/rfq-approval';
  return ROLE_PORTAL_PATH[role] || '/tasks';
}

function buildActionUrl(prId, action, role, postRfq = false, rfqEntry = false) {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (role === 'Requester') {
    return `${base}/requester/rfq-entry/${prId}`;
  }
  if (rfqEntry || (role === 'SCM Buyer' && !postRfq)) {
    return `${base}/scm/rfq-entry/${prId}`;
  }
  const path = getPortalPath(role, postRfq);
  const actionParam = role === 'PR Manager' && action === 'return' && !postRfq ? 'rework' : action;
  // Post-RFQ and most portals use /path/:prId?action=
  if (postRfq || path.includes('rfq-approval') || path.includes('dashboard') || path === '/tasks') {
    if (path === '/tasks') return `${base}${path}?prId=${prId}&action=${actionParam}`;
    if (path.includes('dashboard')) return `${base}${path}?prId=${prId}&action=${actionParam}`;
    return `${base}${path}/${prId}?action=${actionParam}`;
  }
  return `${base}${path}/${prId}?action=${actionParam}`;
}

function actionButton(label, url, bgColor, textColor = '#ffffff') {
  return `
    <td style="padding:0 6px;">
      <a href="${url}" target="_blank" style="display:inline-block;padding:14px 20px;background:${bgColor};color:${textColor};text-decoration:none;font-size:13px;font-weight:700;border-radius:10px;min-width:110px;text-align:center;">
        ${escapeHtml(label)}
      </a>
    </td>`;
}

function buildNegotiationRoundsBlock(rfqSummary) {
  if (!rfqSummary?.vendors?.length) return '';

  const vendorSections = rfqSummary.vendors
    .map((vendor) => {
      const rounds = (vendor.rounds || []).slice(0, 3);
      if (!rounds.length) {
        return `
          <div style="margin-bottom:12px;padding:12px 14px;background:#fff;border:1px solid #bbf7d0;border-radius:8px;">
            <div style="font-size:13px;font-weight:700;color:#14532d;">
              ${escapeHtml(vendor.name)}${vendor.isRecommended ? ' ★ Recommended' : ''}
            </div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">No submitted quotation rounds yet</div>
          </div>`;
      }

      const roundRows = rounds
        .map(
          (r) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #dcfce7;font-size:12px;font-weight:700;color:#166534;">R${r.round}</td>
            <td style="padding:8px;border-bottom:1px solid #dcfce7;font-size:12px;text-align:right;font-weight:700;">${formatCurrency(r.quotedPrice)}</td>
            <td style="padding:8px;border-bottom:1px solid #dcfce7;font-size:12px;text-align:center;">${r.leadTime ?? '—'}d</td>
            <td style="padding:8px;border-bottom:1px solid #dcfce7;font-size:12px;">${escapeHtml(r.paymentTerms || '—')}</td>
            <td style="padding:8px;border-bottom:1px solid #dcfce7;font-size:12px;">${escapeHtml(r.quotationFileName || '—')}</td>
          </tr>`
        )
        .join('');

      return `
        <div style="margin-bottom:14px;">
          <div style="font-size:13px;font-weight:700;color:#14532d;margin-bottom:6px;">
            ${escapeHtml(vendor.name)}${vendor.isRecommended ? ' ★ Recommended' : ''}
            <span style="font-weight:500;color:#64748b;font-size:11px;"> · ${rounds.length} round(s)</span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #bbf7d0;border-collapse:collapse;background:#fff;border-radius:8px;">
            <thead><tr style="background:#ecfdf5;">
              <th style="padding:8px;font-size:10px;color:#047857;text-align:left;">Round</th>
              <th style="padding:8px;font-size:10px;color:#047857;text-align:right;">Price</th>
              <th style="padding:8px;font-size:10px;color:#047857;text-align:center;">Lead</th>
              <th style="padding:8px;font-size:10px;color:#047857;text-align:left;">Payment</th>
              <th style="padding:8px;font-size:10px;color:#047857;text-align:left;">Quotation File</th>
            </tr></thead>
            <tbody>${roundRows}</tbody>
          </table>
        </div>`;
    })
    .join('');

  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">
              Vendor Quotations &amp; Negotiation Rounds (up to 3)
            </div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;">
              <div style="font-size:13px;color:#14532d;margin-bottom:12px;line-height:1.5;">
                <strong>Recommended Vendor:</strong> ${escapeHtml(rfqSummary.recommendedVendor || '—')}<br/>
                <strong>Vendors Quoted:</strong> ${rfqSummary.vendorCount || 0}<br/>
                <strong>Recommended Price:</strong> ${formatCurrency(rfqSummary.quotedPrice || 0)}
              </div>
              ${vendorSections}
              <p style="font-size:11px;color:#64748b;margin:8px 0 0 0;">
                Quotation PDF files for each round are attached to this email (when available).
              </p>
            </div>
          </td>
        </tr>`;
}

export function buildPrApprovalPendingEmail({
  pr,
  requester,
  assignedRole,
  approverName,
  postRfq = false,
  stageLabel = null,
  rfqSummary = null,
  rfqEntry = false,
}) {
  const isRequesterStep = assignedRole === 'Requester';
  const isScmRfqEntry = rfqEntry || (assignedRole === 'SCM Buyer' && !postRfq);
  const isRfqEntryStep = isRequesterStep || isScmRfqEntry;
  const roleDisplayName = formatRoleDisplayName(assignedRole);
  const stageText = stageLabel || (postRfq ? 'Post-RFQ Review' : isRfqEntryStep ? 'RFQ Entry' : 'Purchase Request');
  const subject = isRfqEntryStep
    ? `Action Required: RFQ Entry for ${pr.prNumber} — ${pr.title}`
    : postRfq
      ? `RFQ Approval Required: ${pr.prNumber} — ${stageText}`
      : `Action Required: Approve PR ${pr.prNumber} — ${pr.title}`;
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const path = getPortalPath(assignedRole, postRfq);
  const portalUrl = isRequesterStep
    ? `${base}/requester/rfq-entry/${pr.id}`
    : isScmRfqEntry
      ? `${base}/scm/rfq-entry/${pr.id}`
      : postRfq
        ? `${base}${path}/${pr.id}`
        : path === '/tasks'
          ? `${base}${path}?prId=${pr.id}`
          : `${base}${path}?prId=${pr.id}`;

  const approveUrl = buildActionUrl(pr.id, 'approve', assignedRole, postRfq, isScmRfqEntry);
  const returnUrl = buildActionUrl(pr.id, 'return', assignedRole, postRfq, isScmRfqEntry);
  const rejectUrl = buildActionUrl(pr.id, 'reject', assignedRole, postRfq, isScmRfqEntry);

  const showSendBack = assignedRole !== 'CFO' && !isRfqEntryStep;

  const rfqEntryHint = isScmRfqEntry
    ? stageLabel?.toLowerCase().includes('final')
      ? 'CFO approved vendor selection — complete SCM Final RFQ to continue to Create PO.'
      : 'CFO approved this PR — open SCM RFQ Entry to invite vendors and collect quotations.'
    : 'HOD approved your PR — enter vendor quotations to continue.';

  const actionButtons = isRfqEntryStep
    ? `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 8px auto;">
      <tr>
        ${actionButton('Open RFQ Entry →', portalUrl, '#0f766e')}
      </tr>
    </table>
    <p style="text-align:center;font-size:12px;color:#64748b;margin:12px 0 0 0;">
      ${escapeHtml(rfqEntryHint)}
    </p>`
    : `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 8px auto;">
      <tr>
        ${actionButton('✓ Approve', approveUrl, '#059669')}
        ${showSendBack ? actionButton('↩ Send Back', returnUrl, '#ea580c') : ''}
        ${actionButton('✕ Reject', rejectUrl, '#dc2626')}
      </tr>
    </table>
    <p style="text-align:center;font-size:12px;color:#64748b;margin:12px 0 0 0;">
      Click a button to open the portal — the approval popup will open automatically.
    </p>`;

  const lineRows = (pr.lineItems || [])
    .map(
      (item, i) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${escapeHtml(item.description)}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.quantity}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${formatCurrency(item.unitCost)}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:700;color:#047857;">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join('');

  const rfqBlock = postRfq || (isScmRfqEntry && rfqSummary?.vendors?.length)
    ? buildNegotiationRoundsBlock(rfqSummary)
    : rfqSummary
      ? `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">RFQ Summary</div>
            <table width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:14px;color:#14532d;line-height:1.6;">
              <strong>Recommended Vendor:</strong> ${escapeHtml(rfqSummary.recommendedVendor || '—')}<br/>
              <strong>Vendors Quoted:</strong> ${rfqSummary.vendorCount || 0}<br/>
              <strong>Quoted Price:</strong> ${formatCurrency(rfqSummary.quotedPrice || 0)}
            </td></tr></table>
          </td>
        </tr>`
      : '';

  const entityLabel = formatEntity(pr);
  const headerEyebrow = isRfqEntryStep
    ? 'RFQ Entry Required'
    : postRfq
      ? 'RFQ Approval Required'
      : 'Approval Required';
  const headerTitle = isRfqEntryStep
    ? escapeHtml(stageText)
    : postRfq
      ? `${escapeHtml(stageText)} — Vendor Comparison`
      : 'Purchase Request Pending Your Action';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ee;">
        <tr>
          <td style="background:linear-gradient(135deg,#0c4a6e,#0369a1);padding:28px 32px;">
            <div style="font-size:11px;color:#bae6fd;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${headerEyebrow}</div>
            <div style="font-size:24px;color:#fff;font-weight:800;margin-top:8px;">${headerTitle}</div>
            <div style="font-size:14px;color:#e0f2fe;margin-top:8px;">Hello ${escapeHtml(approverName || 'Approver')}, a PR needs your review as <strong>${escapeHtml(roleDisplayName)}</strong>.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 12px 32px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">PR Number</div>
            <div style="font-size:22px;color:#0f172a;font-weight:800;margin-top:4px;">${escapeHtml(pr.prNumber)}</div>
            <div style="font-size:16px;color:#334155;margin-top:6px;font-weight:600;">${escapeHtml(pr.title)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Entity</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">${escapeHtml(entityLabel)}</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Department</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">${escapeHtml(pr.department)}</div>
                  </td></tr></table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Requester</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">${escapeHtml(requester?.name || pr.requester)}</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;">Type / Priority</div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:4px;">${escapeHtml(pr.requestType)} · ${escapeHtml(pr.priority)}</div>
                  </td></tr></table>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700;">Total Amount</div>
                    <div style="font-size:18px;font-weight:800;color:#047857;margin-top:4px;">${formatCurrency(pr.totalAmount)}</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;"></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">Business Justification</div>
            <table width="100%" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:14px;color:#78350f;line-height:1.6;">${escapeHtml(pr.justification || 'Not provided')}</td></tr></table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:10px;">Line Items</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-collapse:collapse;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;">#</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:left;">Description</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Unit</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Total</th>
              </tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
          </td>
        </tr>
        ${rfqBlock}
        <tr>
          <td style="padding:8px 32px 28px 32px;">
            ${actionButtons}
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:16px;">
              <tr><td>
                <a href="${portalUrl}" style="font-size:13px;color:#0369a1;font-weight:600;">Open PR in Portal →</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;font-size:12px;color:#64748b;">
            Automated notification from P2P Procurement System. Sign in may be required.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Action Required: PR ${pr.prNumber} — ${pr.title}`,
    `Entity: ${entityLabel}`,
    `Role: ${roleDisplayName}`,
    `Stage: ${stageText}`,
    `Requester: ${requester?.name || pr.requester}`,
    `Amount: ${formatCurrency(pr.totalAmount)}`,
    rfqSummary?.recommendedVendor
      ? `Recommended: ${rfqSummary.recommendedVendor} (${formatCurrency(rfqSummary.quotedPrice || 0)})`
      : '',
    '',
    isRfqEntryStep ? `Open RFQ Entry: ${portalUrl}` : `Approve: ${approveUrl}`,
    !isRfqEntryStep && showSendBack ? `Send Back: ${returnUrl}` : '',
    !isRfqEntryStep ? `Reject: ${rejectUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
