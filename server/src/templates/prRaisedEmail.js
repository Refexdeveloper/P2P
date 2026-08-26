function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isOwnVendorPr(pr) {
  return pr?.vendorSelection === 'own' || pr?.vendor_selection === 'own';
}

function lineItemName(item) {
  return String(item?.itemName || item?.item_name || item?.item || item?.description || '').trim() || '—';
}

function lineItemDescription(item) {
  const name = lineItemName(item);
  const desc = String(item?.description || '').trim();
  if (!desc || desc === name) return '';
  return desc;
}

function buildLineItemsTable(lineItems = [], { ownVendor = false } = {}) {
  if (ownVendor) {
    const rows = lineItems
      .map((item, index) => {
        const name = lineItemName(item);
        const desc = lineItemDescription(item);
        return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${index + 1}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">
            <strong style="display:block;color:#111827;">${escapeHtml(name)}</strong>
            ${desc ? `<span style="color:#6b7280;font-size:12px;">${escapeHtml(desc)}</span>` : ''}
          </td>
        </tr>`;
      })
      .join('');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;background:#ffffff;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:center;">#</th>
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:left;">Item Name / Description</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
  }

  const rows = lineItems
    .map(
      (item, index) => `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${index + 1}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">
            <strong style="display:block;color:#111827;">${escapeHtml(lineItemName(item))}</strong>
            <span style="color:#6b7280;font-size:12px;">${escapeHtml(item.category || '—')}</span>
          </td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:center;">${item.quantity}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;text-align:right;">${formatCurrency(item.unitCost)}</td>
          <td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#047857;text-align:right;font-weight:700;">${formatCurrency(item.total)}</td>
        </tr>`
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;background:#ffffff;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:center;">#</th>
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:left;">Description</th>
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:center;">Qty</th>
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:right;">Unit Cost</th>
          <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr style="background:#ecfdf5;">
          <td colspan="4" style="padding:14px 10px;font-size:13px;color:#065f46;text-align:right;font-weight:700;border-top:1px solid #bbf7d0;">Grand Total</td>
          <td style="padding:14px 10px;font-size:15px;color:#047857;text-align:right;font-weight:800;border-top:1px solid #bbf7d0;">${formatCurrency(lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0))}</td>
        </tr>
      </tfoot>
    </table>`;
}

function infoCell(label, value) {
  return `
    <td width="50%" style="padding:0 8px 16px 8px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;margin-bottom:6px;">${escapeHtml(label)}</div>
            <div style="font-size:14px;color:#0f172a;font-weight:600;line-height:1.4;">${escapeHtml(value || '—')}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

export function buildPrRaisedEmail({ pr, requester, isResubmit = false }) {
  const subject = isResubmit
    ? `PR Resubmitted: ${pr.prNumber} — ${pr.title}`
    : `New Purchase Request Raised: ${pr.prNumber} — ${pr.title}`;

  const headline = isResubmit ? 'Purchase Request Resubmitted' : 'Purchase Request Raised';
  const intro = isResubmit
    ? 'A purchase request has been updated and resubmitted for approval workflow.'
    : 'A new purchase request has been raised and submitted for approval.';
  const ownVendor = isOwnVendorPr(pr);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ee;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;">
              <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#94a3b8;font-weight:700;">P2P Procurement</div>
              <div style="font-size:24px;color:#ffffff;font-weight:800;margin-top:8px;">${headline}</div>
              <div style="font-size:14px;color:#cbd5e1;margin-top:8px;line-height:1.5;">${intro}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">PR Number</div>
                    <div style="font-size:22px;color:#0f172a;font-weight:800;margin-top:4px;">${escapeHtml(pr.prNumber)}</div>
                    <div style="font-size:15px;color:#334155;margin-top:6px;font-weight:600;">${escapeHtml(pr.title)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 24px 8px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${infoCell('Requester', requester?.name || pr.requester)}
                  ${infoCell('Requester Email', requester?.email || '—')}
                </tr>
                <tr>
                  ${infoCell('Entity', pr.entityName ? `${pr.entityName}${pr.entityCode ? ` (${pr.entityCode})` : ''}` : '—')}
                  ${infoCell('Department', pr.department)}
                </tr>
                <tr>
                  ${infoCell('Request Type', pr.requestType)}
                  ${infoCell('Priority', pr.priority)}
                </tr>
                <tr>
                  ${infoCell('Required Date', pr.requiredDate || '—')}
                  ${infoCell('Submitted On', pr.submittedDate || pr.createdAt)}
                </tr>
                <tr>
                  ${
                    ownVendor
                      ? infoCell('Vendor Path', 'Own Vendor')
                      : infoCell('Total Amount', formatCurrency(pr.totalAmount))
                  }
                  ${infoCell('Entity Cost Center', pr.entityCostCenter || '—')}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 20px 32px;">
              <div style="font-size:13px;color:#0f172a;font-weight:700;margin-bottom:10px;">Business Justification</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
                <tr>
                  <td style="padding:16px 18px;font-size:14px;color:#78350f;line-height:1.6;">${escapeHtml(pr.justification || 'Not provided')}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="font-size:13px;color:#0f172a;font-weight:700;margin-bottom:12px;">Line Items</div>
              ${buildLineItemsTable(pr.lineItems, { ownVendor })}
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px 32px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#0f172a;border-radius:10px;">
                    <a href="${escapeHtml(process.env.APP_URL || 'http://localhost:3000')}/requester/dashboard" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                      View in P2P Portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 32px;">
              <div style="font-size:12px;color:#64748b;line-height:1.6;">
                This is an automated notification from the P2P Procurement System.<br />
                Please review the purchase request in the approval workflow.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    headline,
    '',
    `PR Number: ${pr.prNumber}`,
    `Title: ${pr.title}`,
    `Requester: ${requester?.name || pr.requester} (${requester?.email || '—'})`,
    `Department: ${pr.department}`,
    `Type: ${pr.requestType}`,
    `Priority: ${pr.priority}`,
    `Required Date: ${pr.requiredDate || '—'}`,
    ownVendor ? 'Vendor Path: Own Vendor' : `Total Amount: ${formatCurrency(pr.totalAmount)}`,
    '',
    'Business Justification:',
    pr.justification || 'Not provided',
    '',
    'Line Items:',
    ...(pr.lineItems || []).map((item, i) => {
      const name = lineItemName(item);
      const desc = lineItemDescription(item);
      if (ownVendor) {
        return desc ? `${i + 1}. ${name} — ${desc}` : `${i + 1}. ${name}`;
      }
      return `${i + 1}. ${item.description} | ${item.category} | Qty: ${item.quantity} | Unit: ${formatCurrency(item.unitCost)} | Total: ${formatCurrency(item.total)}`;
    }),
  ].join('\n');

  return { subject, html, text };
}
