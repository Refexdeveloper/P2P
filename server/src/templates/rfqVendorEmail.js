import { escapeHtml, formatCurrency } from './emailUtils.js';

function buildLineItemsTable(lineItems = []) {
  const rows = lineItems
    .map(
      (item, i) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">${escapeHtml(item.description)}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.quantity}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${formatCurrency(item.unitCost)}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:700;color:#047857;">${formatCurrency(item.total)}</td>
      </tr>`
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-collapse:collapse;margin-top:12px;">
      <thead><tr style="background:#f8fafc;">
        <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;">#</th>
        <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:left;">Description</th>
        <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;">Qty</th>
        <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Unit</th>
        <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildRfqInvitationEmail({ pr, vendorName, submitUrl, round = 1 }) {
  const subject =
    round > 1
      ? `Re-Quote Requested (Round ${round}): ${pr.prNumber} — ${pr.title}`
      : `RFQ Invitation: ${pr.prNumber} — ${pr.title}`;

  const headline = round > 1 ? 'Re-Quote Requested' : 'Request for Quotation';
  const intro =
    round > 1
      ? `Please review the feedback and submit a revised quotation for Round ${round}.`
      : 'You have been invited to submit a quotation for the purchase request below.';

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:16px;border:1px solid #dbe3ee;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:28px 32px;">
        <div style="font-size:11px;color:#ccfbf1;letter-spacing:0.1em;text-transform:uppercase;font-weight:700;">P2P Procurement</div>
        <div style="font-size:24px;color:#fff;font-weight:800;margin-top:8px;">${headline}</div>
        <div style="font-size:14px;color:#e6fffa;margin-top:8px;">Hello ${escapeHtml(vendorName)}, ${intro}</div>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">PR Number</div>
        <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(pr.prNumber)}</div>
        <div style="font-size:16px;font-weight:600;color:#334155;margin-top:6px;">${escapeHtml(pr.title)}</div>
        <table width="100%" style="margin-top:16px;"><tr>
          <td width="50%" style="padding:6px;"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#64748b;font-weight:700;">DEPARTMENT</div>
            <div style="font-size:14px;font-weight:600;margin-top:4px;">${escapeHtml(pr.department)}</div>
          </div></td>
          <td width="50%" style="padding:6px;"><div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;padding:12px;">
            <div style="font-size:10px;color:#047857;font-weight:700;">ESTIMATED VALUE</div>
            <div style="font-size:18px;font-weight:800;color:#047857;margin-top:4px;">${formatCurrency(pr.totalAmount)}</div>
          </div></td>
        </tr></table>
        <div style="margin-top:16px;font-size:13px;font-weight:700;color:#0f172a;">Line Items</div>
        ${buildLineItemsTable(pr.lineItems)}
        <div style="margin-top:20px;font-size:13px;font-weight:700;">Business Justification</div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;font-size:14px;color:#78350f;margin-top:8px;">${escapeHtml(pr.justification || '—')}</div>
        <table cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px;"><tr><td>
          <a href="${submitUrl}" style="display:inline-block;padding:16px 28px;background:#0f766e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;">Submit Quotation →</a>
        </td></tr></table>
        <p style="text-align:center;font-size:12px;color:#64748b;">Round ${round} · Fill the form and upload your quotation PDF</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const text = [
    subject,
    `Vendor: ${vendorName}`,
    `PR: ${pr.prNumber} — ${pr.title}`,
    `Amount: ${formatCurrency(pr.totalAmount)}`,
    `Submit: ${submitUrl}`,
  ].join('\n');

  return { subject, html, text };
}

export function buildRfqSendBackEmail({ pr, vendorName, submitUrl, round, reason, fields = [] }) {
  const subject = `Re-Quote Required (Round ${round}): ${pr.prNumber}`;
  const fieldsList = fields.length
    ? `<ul style="margin:8px 0;padding-left:20px;">${fields.map((f) => `<li style="font-size:13px;color:#78350f;">${escapeHtml(f)}</li>`).join('')}</ul>`
    : '';

  const html = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;"><tr><td align="center">
    <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border-radius:16px;border:1px solid #fde68a;overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#b45309,#f59e0b);padding:28px 32px;">
        <div style="font-size:24px;color:#fff;font-weight:800;">Quotation Sent Back for Revision</div>
        <div style="font-size:14px;color:#fffbeb;margin-top:8px;">Hello ${escapeHtml(vendorName)}, please revise and resubmit your quote for Round ${round}.</div>
      </td></tr>
      <tr><td style="padding:28px 32px;">
        <div style="font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(pr.prNumber)} — ${escapeHtml(pr.title)}</div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-top:16px;">
          <div style="font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;">Feedback</div>
          ${fieldsList}
          <p style="font-size:14px;color:#78350f;margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(reason || 'Please revise your quotation.')}</p>
        </div>
        <table cellpadding="0" cellspacing="0" align="center" style="margin:24px auto;"><tr><td>
          <a href="${submitUrl}" style="display:inline-block;padding:16px 28px;background:#ea580c;color:#fff;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;">Submit Revised Quotation →</a>
        </td></tr></table>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return {
    subject,
    html,
    text: `${subject}\n${reason}\nSubmit: ${submitUrl}`,
  };
}
