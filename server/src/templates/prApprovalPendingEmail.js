import { escapeHtml, formatCurrency, formatEntity, formatEntityLocation, formatRoleDisplayName, formatScmRfqEntrySubject } from './emailUtils.js';
import { wrapPortalUrlWithSso } from '../services/refexOneSamlService.js';

function money(amount, currencyOrPr) {
  const currency =
    typeof currencyOrPr === 'string'
      ? currencyOrPr
      : currencyOrPr?.currency || currencyOrPr?.currency_code || 'INR';
  return formatCurrency(amount, currency);
}

function isSassPrPayload(pr) {
  const raw = String(pr?.purchaseType || pr?.purchase_type || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return raw === 'sass' || raw === 'saas' || raw === 'cloud_subscription';
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

function listRoundQuotationFiles(round) {
  const files = [];
  const push = (name) => {
    const n = String(name || '').trim();
    if (n && !files.includes(n)) files.push(n);
  };
  push(round?.quotationFileName);
  for (const f of round?.quotationFiles || []) {
    push(f?.fileName || f?.quotationFileName);
  }
  return files;
}

function listVendorQuotationFiles(vendor) {
  const files = [];
  for (const round of vendor?.rounds || []) {
    for (const name of listRoundQuotationFiles(round)) {
      if (!files.includes(name)) files.push(name);
    }
  }
  const latest = String(vendor?.quotationFileName || '').trim();
  if (latest && !files.includes(latest)) files.push(latest);
  return files;
}

const ROLE_PORTAL_PATH = {
  'HOD Approver': '/tasks',
  'PR Manager': '/pr-manager/dashboard',
  CFO: '/cfo/dashboard',
  Requester: '/requester/rfq-entry',
  'SCM Buyer': '/scm/rfq-entry',
  'SCM Manager': '/scm/po-approval',
};

const POST_RFQ_PORTAL_PATH = {
  'HOD Approver': '/rfq-approval',
  'PR Manager': '/rfq-approval',
  'SCM Manager': '/rfq-approval',
  CFO: '/rfq-approval',
  'SCM Buyer': '/scm/create-po',
};

function getPortalPath(role, postRfq) {
  if (postRfq) return POST_RFQ_PORTAL_PATH[role] || '/rfq-approval';
  return ROLE_PORTAL_PATH[role] || '/tasks';
}

export function buildActionUrl(prId, action, role, postRfq = false, rfqEntry = false, createPo = false, baseUrl = null) {
  const base = (baseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (createPo || (postRfq && role === 'SCM Buyer')) {
    return `${base}/scm/create-po?prId=${prId}`;
  }
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
    if (path === '/scm/create-po') return `${base}${path}?prId=${prId}`;
    return `${base}${path}/${prId}?action=${actionParam}`;
  }
  return `${base}${path}/${prId}?action=${actionParam}`;
}

function actionButton(label, url, bgColor, textColor = '#ffffff') {
  const href = wrapPortalUrlWithSso(url);
  return `
    <td style="padding:0 6px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 20px;background:${bgColor};color:${textColor};text-decoration:none;font-size:13px;font-weight:700;border-radius:10px;min-width:110px;text-align:center;">
        ${escapeHtml(label)}
      </a>
    </td>`;
}

function buildRecommendationJustificationBlock(rfqSummary) {
  const vendor = rfqSummary?.recommendedVendor || '';
  const justification = String(rfqSummary?.recommendationJustification || '').trim();
  if (!vendor && !justification) return '';

  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #6ee7b7;border-radius:12px;overflow:hidden;background:linear-gradient(90deg,#ecfdf5,#f0fdfa);">
              <tr>
                <td style="padding:12px 16px;background:#d1fae5;border-bottom:1px solid #a7f3d0;">
                  <div style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#065f46;">
                    ★ Recommendation Justification
                  </div>
                  <div style="font-size:15px;font-weight:700;color:#064e3b;margin-top:4px;">
                    ${escapeHtml(vendor || 'Recommended vendor')}
                    <span style="font-size:12px;font-weight:600;color:#047857;"> · ${money(rfqSummary?.quotedPrice || 0, rfqSummary)}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:14px;color:#064e3b;line-height:1.55;white-space:pre-wrap;">
                    ${justification ? escapeHtml(justification) : '<em style="color:#047857;">No justification was provided with this recommendation.</em>'}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function buildPriceNegotiationTrendBlock(rfqSummary) {
  const vendors = rfqSummary?.vendors || [];
  if (!vendors.length) return '';

  const totalRounds = Math.max(
    Number(rfqSummary.totalRounds) || 1,
    ...vendors.map((v) => Math.max(0, ...(v.rounds || []).map((r) => Number(r.round) || 0))),
    1
  );
  const maxRoundsCap = Number(rfqSummary.maxRounds) || 0;
  const roundsLabel =
    maxRoundsCap > 0 ? `${totalRounds} of ${maxRoundsCap}` : String(totalRounds);

  const roundHeaders = Array.from({ length: totalRounds }, (_, i) => {
    return `<th style="padding:10px 8px;font-size:10px;color:#0f766e;text-align:center;border-bottom:1px solid #99f6e4;text-transform:uppercase;letter-spacing:0.04em;">Quotation Round ${i + 1}</th>`;
  }).join('');

  const vendorRows = vendors
    .map((vendor) => {
      const rounds = [...(vendor.rounds || [])].sort((a, b) => Number(a.round) - Number(b.round));
      const last = rounds[rounds.length - 1];
      const lastPrice = Number(last?.quotedPrice || last?.values?.quotedPrice || 0);
      const cells = Array.from({ length: totalRounds }, (_, i) => {
        const roundNum = i + 1;
        const use = rounds.find((r) => Number(r.round) === roundNum) || null;
        if (!use) {
          return `<td style="padding:12px 8px;text-align:center;font-size:13px;color:#cbd5e1;border-bottom:1px solid #f1f5f9;">—</td>`;
        }
        const price = Number(use.quotedPrice || use.values?.quotedPrice || 0);
        const prev = rounds.find((r) => Number(r.round) === roundNum - 1) || null;
        const prevPrice = prev ? Number(prev.quotedPrice || prev.values?.quotedPrice || 0) : 0;
        const change = prev && prevPrice ? price - prevPrice : 0;
        const changePct = prev && prevPrice ? ((change / prevPrice) * 100).toFixed(1) : null;
        const isLast = use === last;
        const changeHtml =
          changePct !== null
            ? `<div style="font-size:11px;font-weight:700;margin-top:2px;color:${change < 0 ? '#059669' : '#dc2626'};">${change < 0 ? '▼' : '▲'} ${Math.abs(Number(changePct))}%</div>`
            : '';
        const fileHtml = (() => {
          const names = listRoundQuotationFiles(use);
          if (!names.length) return '';
          return names
            .map(
              (name) =>
                `<div style="font-size:10px;color:#64748b;margin-top:4px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(name)}">${escapeHtml(name)}</div>`
            )
            .join('');
        })();
        return `
          <td style="padding:12px 8px;text-align:center;border-bottom:1px solid #f1f5f9;${isLast ? 'background:#f0fdfa;' : ''}">
            <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Price</div>
            <div style="font-size:13px;font-weight:800;color:${isLast ? '#0f766e' : '#0f172a'};margin-top:2px;">${price ? money(price, rfqSummary) : '—'}</div>
            ${changeHtml}
            ${fileHtml}
            ${use.submittedAt ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">${escapeHtml(String(use.submittedAt))}</div>` : ''}
          </td>`;
      }).join('');

      return `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top;${vendor.isRecommended ? 'background:#ecfdf5;' : ''}">
            <div style="font-size:13px;font-weight:700;color:#0f172a;">${escapeHtml(vendor.name)}</div>
            ${vendor.isRecommended ? '<div style="display:inline-block;margin-top:4px;padding:2px 8px;background:#d1fae5;color:#047857;font-size:10px;font-weight:700;border-radius:999px;">★ Recommended</div>' : ''}
            <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${rounds.length} round${rounds.length === 1 ? '' : 's'}</div>
            <div style="font-size:11px;color:#64748b;">Last: ${lastPrice ? money(lastPrice, rfqSummary) : '—'}</div>
          </td>
          ${cells}
        </tr>`;
    })
    .join('');

  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #99f6e4;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:14px 16px;background:#f0fdfa;border-bottom:1px solid #99f6e4;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td>
                      <div style="font-size:15px;font-weight:800;color:#134e4a;">Price Negotiation Trend</div>
                      <div style="font-size:12px;color:#0f766e;margin-top:2px;">How prices changed across quotation rounds</div>
                    </td>
                    <td align="right" style="white-space:nowrap;">
                      <span style="display:inline-block;padding:4px 10px;background:#ccfbf1;color:#0f766e;font-size:11px;font-weight:700;border-radius:999px;">Total Rounds: ${escapeHtml(roundsLabel)}</span>
                    </td>
                  </tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding:0;overflow-x:auto;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;min-width:480px;">
                    <thead>
                      <tr style="background:#f8fafc;">
                        <th style="padding:10px;font-size:10px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">Vendor</th>
                        ${roundHeaders}
                      </tr>
                    </thead>
                    <tbody>${vendorRows}</tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 16px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;">
                  Quotation PDF files for each round are attached to this email (when available).
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function buildVendorComparisonBlock(rfqSummary) {
  const vendors = rfqSummary?.vendors || [];
  const SCORE_IDS = new Set(['technicalScore', 'commercialScore', 'overallScore']);
  const rows = (rfqSummary?.comparisonRows || []).filter((row) => {
    if (!SCORE_IDS.has(row.id)) return true;
    // Defense in depth: hide score rows when every vendor is empty / 0 / —
    return vendors.some((v) => {
      const display = row.cells?.[v.id];
      if (display == null || display === '' || display === '—') return false;
      const n = Number(String(display).replace(/\/100$/, ''));
      return Number.isFinite(n) && n > 0;
    });
  });
  if (!vendors.length || !rows.length) return '';

  const vendorHeaders = vendors
    .map(
      (v) => `
        <th style="padding:10px 8px;font-size:12px;font-weight:700;color:#0f172a;text-align:center;border-bottom:1px solid #e2e8f0;${v.isRecommended ? 'background:#ecfdf5;' : 'background:#f8fafc;'}">
          ${escapeHtml(v.name)}
          ${v.isRecommended ? '<div style="margin-top:4px;font-size:10px;font-weight:700;color:#047857;">★ Recommended</div>' : ''}
        </th>`
    )
    .join('');

  const bodyRows = rows
    .map((row) => {
      const cells = vendors
        .map((v) => {
          const display = row.cells?.[v.id] ?? '—';
          const isBest = row.bestVendorId === v.id;
          return `<td style="padding:10px 8px;font-size:12px;text-align:center;border-bottom:1px solid #f1f5f9;${v.isRecommended ? 'background:#f0fdf4;' : ''}${isBest ? 'color:#047857;font-weight:700;' : 'color:#334155;'}">${escapeHtml(display)}</td>`;
        })
        .join('');
      return `
        <tr>
          <td style="padding:10px 10px;font-size:12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;background:#fff;">${escapeHtml(row.label)}</td>
          ${cells}
        </tr>`;
    })
    .join('');

  const fileRow = `
        <tr>
          <td style="padding:10px 10px;font-size:12px;font-weight:600;color:#475569;border-bottom:1px solid #f1f5f9;">Quotation File</td>
          ${vendors
            .map((v) => {
              const names = listVendorQuotationFiles(v);
              const label = names.length
                ? names.map((n) => escapeHtml(n)).join('<br/>')
                : '—';
              return `<td style="padding:10px 8px;font-size:11px;text-align:center;border-bottom:1px solid #f1f5f9;${v.isRecommended ? 'background:#f0fdf4;' : ''}color:#64748b;">${label}</td>`;
            })
            .join('')}
        </tr>`;

  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:14px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                  <div style="font-size:15px;font-weight:800;color:#0f172a;">Vendor Comparison</div>
                  <div style="font-size:12px;color:#64748b;margin-top:2px;">
                    ${rfqSummary.vendorCount || vendors.length} vendors · Recommended: <strong style="color:#047857;">${escapeHtml(rfqSummary.recommendedVendor || '—')}</strong>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0;overflow-x:auto;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;min-width:480px;">
                    <thead>
                      <tr>
                        <th style="padding:10px;font-size:10px;color:#64748b;text-align:left;border-bottom:1px solid #e2e8f0;background:#f8fafc;text-transform:uppercase;">Parameter</th>
                        ${vendorHeaders}
                      </tr>
                    </thead>
                    <tbody>
                      ${bodyRows}
                      ${fileRow}
                    </tbody>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function vendorLatestPrice(vendor) {
  const rounds = [...(vendor.rounds || [])].sort((a, b) => Number(a.round) - Number(b.round));
  const last = rounds[rounds.length - 1];
  return Number(last?.quotedPrice || last?.values?.quotedPrice || 0);
}

function bestQuotedFromSummary(rfqSummary) {
  const vendors = rfqSummary?.vendors || [];
  const recommended = vendors.find((v) => v.isRecommended);
  if (recommended) {
    const price = vendorLatestPrice(recommended) || Number(rfqSummary?.quotedPrice || 0);
    if (price > 0) return { vendor: recommended.name, price, recommended: true };
  }
  let best = null;
  for (const vendor of vendors) {
    const price = vendorLatestPrice(vendor);
    if (!(price > 0)) continue;
    if (!best || price < best.price) best = { vendor: vendor.name, price, recommended: false };
  }
  if (!best && Number(rfqSummary?.quotedPrice || 0) > 0) {
    return {
      vendor: rfqSummary.recommendedVendor || '',
      price: Number(rfqSummary.quotedPrice),
      recommended: Boolean(rfqSummary.recommendedVendor),
    };
  }
  return best;
}

function buildQuotedAmountBlock(pr, rfqSummary) {
  const best = bestQuotedFromSummary(rfqSummary);
  if (!best) return '';
  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700;">PR Estimated Amount</div>
                    <div style="font-size:18px;font-weight:800;color:#047857;margin-top:4px;">${money(pr.totalAmount, pr)}</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#0f766e;text-transform:uppercase;font-weight:700;">${best.recommended ? 'Recommended Quote' : 'Best Quoted Amount'}</div>
                    <div style="font-size:18px;font-weight:800;color:#0f766e;margin-top:4px;">${money(best.price, pr)}</div>
                    <div style="font-size:12px;color:#115e59;margin-top:4px;">${escapeHtml(best.vendor || 'Vendor')}</div>
                  </td></tr></table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function buildQuotationFilesBlock(rfqSummary) {
  const files = [];
  for (const vendor of rfqSummary?.vendors || []) {
    for (const round of vendor.rounds || []) {
      for (const name of listRoundQuotationFiles(round)) {
        files.push({
          vendor: vendor.name,
          round: round.round,
          name,
        });
      }
    }
  }
  if (!files.length) return '';
  const rows = files
    .map(
      (f) => `
        <tr>
          <td style="padding:8px 10px;font-size:12px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${escapeHtml(f.vendor)}</td>
          <td style="padding:8px 10px;font-size:12px;color:#0f766e;font-weight:700;text-align:center;border-bottom:1px solid #f1f5f9;">Q${escapeHtml(String(f.round))}</td>
          <td style="padding:8px 10px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${escapeHtml(f.name)}</td>
        </tr>`
    )
    .join('');
  return `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #c7d2fe;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:14px 16px;background:#eef2ff;border-bottom:1px solid #c7d2fe;">
                  <div style="font-size:15px;font-weight:800;color:#312e81;">Quotation Files</div>
                  <div style="font-size:12px;color:#4338ca;margin-top:2px;">PDFs / images for each round are attached to this email</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <thead>
                      <tr style="background:#f8fafc;">
                        <th style="padding:8px 10px;font-size:10px;color:#64748b;text-align:left;text-transform:uppercase;">Vendor</th>
                        <th style="padding:8px 10px;font-size:10px;color:#64748b;text-align:center;text-transform:uppercase;">Round</th>
                        <th style="padding:8px 10px;font-size:10px;color:#64748b;text-align:left;text-transform:uppercase;">File</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function buildRecommendedQuoteLineItemsBlock(rfqSummary) {
  let lines = Array.isArray(rfqSummary?.recommendedQuoteLineItems)
    ? rfqSummary.recommendedQuoteLineItems
    : [];
  if (!lines.length) {
    const recommended = (rfqSummary?.vendors || []).find((v) => v.isRecommended);
    const fromVendor =
      recommended?.quoteLineItems ||
      recommended?.rounds?.[recommended.rounds.length - 1]?.quoteLineItems ||
      recommended?.latest?.quoteLineItems ||
      [];
    if (Array.isArray(fromVendor) && fromVendor.length) lines = fromVendor;
  }
  if (!lines.length) return '';

  const vendor = escapeHtml(rfqSummary?.recommendedVendor || 'Recommended vendor');
  const roundLabel = rfqSummary?.recommendedRound
    ? ` · Quote ${rfqSummary.recommendedRound}`
    : '';
  const rows = lines
    .map((item, i) => {
      const desc = escapeHtml(
        String(item?.description || item?.itemName || item?.item_name || '—').trim() || '—'
      );
      const qty = Number(item?.quantity) || 0;
      const unit = Number(item?.quotedUnitPrice) || 0;
      const gst = item?.gstPercent != null ? Number(item.gstPercent) : null;
      const total =
        Number(item?.quotedTotal) ||
        Math.round(qty * unit * (1 + (Number(gst) || 0) / 100) * 100) / 100;
      return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;color:#64748b;">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#0f172a;">${desc}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${qty}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${money(unit, rfqSummary)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;color:#64748b;">${gst != null ? `${gst}%` : '—'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:700;color:#047857;">${money(total, rfqSummary)}</td>
      </tr>`;
    })
    .join('');

  const grand = lines.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const unit = Number(item?.quotedUnitPrice) || 0;
    const gst = Number(item?.gstPercent) || 0;
    return (
      sum +
      (Number(item?.quotedTotal) || Math.round(qty * unit * (1 + gst / 100) * 100) / 100)
    );
  }, 0);

  return `
        <div style="margin-top:16px;border:1px solid #a7f3d0;border-radius:12px;overflow:hidden;background:#ecfdf5;">
          <div style="padding:12px 14px;background:#059669;color:#fff;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Recommended quotation — line items</div>
            <div style="font-size:14px;font-weight:700;margin-top:4px;">${vendor}${roundLabel}</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#fff;">
            <thead>
              <tr style="background:#f0fdf4;">
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:center;">#</th>
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:left;">Description</th>
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:center;">Qty</th>
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:right;">Unit</th>
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:center;">GST</th>
                <th style="padding:8px 10px;font-size:10px;color:#047857;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="background:#ecfdf5;">
                <td colspan="5" style="padding:10px;font-size:12px;font-weight:700;color:#065f46;text-align:right;">Quoted total</td>
                <td style="padding:10px;font-size:14px;font-weight:800;color:#047857;text-align:right;">${money(Number(rfqSummary?.quotedPrice) || grand, rfqSummary)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
}

function buildNegotiationRoundsBlock(pr, rfqSummary) {
  if (!rfqSummary?.vendors?.length) return '';
  if (rfqSummary && !rfqSummary.currency) {
    rfqSummary = { ...rfqSummary, currency: pr?.currency || pr?.currency_code || 'INR' };
  }

  return `
        ${buildQuotedAmountBlock(pr, rfqSummary)}
        ${buildRecommendationJustificationBlock(rfqSummary)}
        ${buildRecommendedQuoteLineItemsBlock(rfqSummary)}
        ${buildPriceNegotiationTrendBlock(rfqSummary)}
        ${buildVendorComparisonBlock(rfqSummary)}
        ${buildQuotationFilesBlock(rfqSummary)}`;
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
  createPo = false,
  appBaseUrl = null,
  roleDisplayName: roleDisplayNameOverride = null,
}) {
  const currency = pr?.currency || pr?.currency_code || 'INR';
  if (rfqSummary && !rfqSummary.currency) {
    rfqSummary = { ...rfqSummary, currency };
  }
  const isRequesterStep = assignedRole === 'Requester';
  const isScmRfqEntry = rfqEntry || (assignedRole === 'SCM Buyer' && !postRfq);
  const isSassRequest = isSassPrPayload(pr);
  const stageLower = String(stageLabel || '').toLowerCase();
  const isUserApproval = stageLower.includes('user approval');
  const hasRfqVendors = Boolean(rfqSummary?.vendors?.length);
  const isCreatePoStep =
    createPo ||
    stageLower.includes('po create') ||
    stageLower.includes('create po') ||
    (postRfq && assignedRole === 'SCM Buyer' && !isScmRfqEntry);
  const isRfqEntryStep = (isRequesterStep || isScmRfqEntry) && !isCreatePoStep;
  const roleDisplayName = roleDisplayNameOverride || formatRoleDisplayName(assignedRole);
  const stageText =
    stageLabel ||
    (isCreatePoStep
      ? 'SCM Create PO'
      : postRfq
        ? 'Post-RFQ Review'
        : isRfqEntryStep
          ? 'RFQ Entry'
          : 'Purchase Request');
  const baseSubject = isCreatePoStep
    ? `Action Required: Create PO for ${pr.prNumber} — ${pr.title}`
    : isScmRfqEntry
      ? formatScmRfqEntrySubject(pr)
      : isRfqEntryStep
        ? `Action Required: RFQ Entry for ${pr.prNumber} — ${pr.title}`
        : isUserApproval && hasRfqVendors
          ? `Action Required: Approve PR ${pr.prNumber} — quotations & amount`
          : postRfq
            ? `RFQ Approval Required: ${pr.prNumber} — ${stageText}`
            : `Action Required: Approve PR ${pr.prNumber} — ${pr.title}`;
  const subject =
    isSassRequest && !isScmRfqEntry
      ? `Cloud Subscription Request — ${baseSubject}`
      : baseSubject;
  const base = (appBaseUrl || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const path = getPortalPath(assignedRole, postRfq && !isCreatePoStep);
  const portalUrl = wrapPortalUrlWithSso(
    isCreatePoStep
      ? `${base}/scm/create-po?prId=${pr.id}`
      : isRequesterStep
        ? `${base}/requester/rfq-entry/${pr.id}`
        : isScmRfqEntry
          ? `${base}/scm/rfq-entry/${pr.id}`
          : postRfq
            ? path === '/scm/create-po'
              ? `${base}${path}?prId=${pr.id}`
              : `${base}${path}/${pr.id}`
            : path === '/tasks'
              ? `${base}${path}?prId=${pr.id}`
              : `${base}${path}?prId=${pr.id}`
  );

  const approveUrl = buildActionUrl(
    pr.id,
    'approve',
    assignedRole,
    postRfq,
    isScmRfqEntry,
    isCreatePoStep,
    base
  );
  const returnUrl = buildActionUrl(
    pr.id,
    'return',
    assignedRole,
    postRfq,
    isScmRfqEntry,
    isCreatePoStep,
    base
  );
  const rejectUrl = buildActionUrl(
    pr.id,
    'reject',
    assignedRole,
    postRfq,
    isScmRfqEntry,
    isCreatePoStep,
    base
  );

  const showSendBack = assignedRole !== 'CFO' && !isRfqEntryStep && !isCreatePoStep;

  const rfqEntryHint = isScmRfqEntry
    ? stageLabel?.toLowerCase().includes('final')
      ? 'CFO approved vendor selection — complete SCM Final RFQ to continue to Create PO.'
      : 'CFO approved this PR — open SCM RFQ Entry to invite vendors and collect quotations.'
    : 'HOD approved your PR — enter vendor quotations to continue.';

  const actionButtons = isCreatePoStep
    ? `
    <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto 8px auto;">
      <tr>
        ${actionButton('Open Create PO →', portalUrl, '#0f766e')}
      </tr>
    </table>
    <p style="text-align:center;font-size:12px;color:#64748b;margin:12px 0 0 0;">
      Vendor approved — create the purchase order and send it for SCM Manager sign-off.
    </p>`
    : isRfqEntryStep
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

  const lineOwnVendor = isOwnVendorPr(pr) && !isSassRequest;
  const lineRows = (pr.lineItems || [])
    .map((item, i) => {
      if (lineOwnVendor) {
        const name = lineItemName(item);
        const desc = lineItemDescription(item);
        return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">
          <strong style="display:block;">${escapeHtml(name)}</strong>
          ${desc ? `<span style="color:#6b7280;font-size:12px;">${escapeHtml(desc)}</span>` : ''}
        </td>
      </tr>`;
      }
      const name = lineItemName(item);
      const desc = lineItemDescription(item);
      return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">
          <strong style="display:block;">${escapeHtml(name || item.description || '—')}</strong>
          ${desc ? `<span style="color:#6b7280;font-size:12px;">${escapeHtml(desc)}</span>` : ''}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">${item.quantity ?? item.qty ?? '—'}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${money(item.unitCost ?? item.unit_cost ?? 0, pr)}</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;font-weight:700;color:#047857;">${money(item.total ?? 0, pr)}</td>
      </tr>`;
    })
    .join('');

  const rfqBlock = hasRfqVendors
    ? buildNegotiationRoundsBlock(pr, rfqSummary)
    : rfqSummary
      ? `
        <tr>
          <td style="padding:0 32px 16px 32px;">
            <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:8px;">RFQ Summary</div>
            <table width="100%" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:14px;color:#14532d;line-height:1.6;">
              <strong>Recommended Vendor:</strong> ${escapeHtml(rfqSummary.recommendedVendor || '—')}<br/>
              <strong>Vendors Quoted:</strong> ${rfqSummary.vendorCount || 0}<br/>
              <strong>Quoted Price:</strong> ${money(rfqSummary.quotedPrice || 0, rfqSummary)}
              ${
                rfqSummary.recommendationJustification
                  ? `<br/><br/><strong>Justification:</strong> ${escapeHtml(rfqSummary.recommendationJustification)}`
                  : ''
              }
            </td></tr></table>
          </td>
        </tr>`
      : '';

  const entityLabel = formatEntity(pr);
  const entityLocationLabel = formatEntityLocation(pr);
  const headerEyebrow = isSassRequest
    ? 'Cloud Subscription Request'
    : isScmRfqEntry
      ? 'New PR Request Received'
      : isRfqEntryStep
        ? 'RFQ Entry Required'
        : isUserApproval
          ? 'User Approval Required'
          : postRfq
            ? 'RFQ Approval Required'
            : 'Approval Required';
  const headerTitle = isSassRequest
    ? isRfqEntryStep && !isScmRfqEntry
      ? escapeHtml(stageText)
      : 'Cloud Subscription purchase request needs your action'
    : isScmRfqEntry
      ? 'New PR request received'
      : isRfqEntryStep
        ? escapeHtml(stageText)
        : isUserApproval && hasRfqVendors
          ? 'Review quotations and approve this PR'
          : postRfq
            ? `${escapeHtml(stageText)} — Vendor Comparison`
            : isUserApproval
              ? 'Purchase Request Pending Your Action'
              : 'Purchase Request Pending Your Action';
  const headerSub =
    isScmRfqEntry && !isSassRequest
      ? `${escapeHtml(pr.prNumber || '')}${entityLabel && entityLabel !== '—' ? ` — ${escapeHtml(entityLabel)}` : ''}${entityLocationLabel ? ` - ${escapeHtml(entityLocationLabel)}` : ''}`
      : `Hello ${escapeHtml(approverName || 'Approver')}, a PR needs your review as <strong>${escapeHtml(roleDisplayName)}</strong>.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ee;">
        <tr>
          <td style="background:${isSassRequest ? 'linear-gradient(135deg,#0f766e,#0d9488)' : 'linear-gradient(135deg,#0c4a6e,#0369a1)'};padding:28px 32px;">
            <div style="font-size:11px;color:${isSassRequest ? '#ccfbf1' : '#bae6fd'};letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${headerEyebrow}</div>
            <div style="font-size:24px;color:#fff;font-weight:800;margin-top:8px;">${headerTitle}</div>
            <div style="font-size:14px;color:${isSassRequest ? '#ecfdf5' : '#e0f2fe'};margin-top:8px;">${headerSub}</div>
            ${
              isSassRequest
                ? `<div style="display:inline-block;margin-top:14px;padding:6px 12px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:999px;font-size:12px;font-weight:700;color:#fff;letter-spacing:0.04em;">CLOUD SUBSCRIPTION REQUEST</div>`
                : ''
            }
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 12px 32px;">
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700;">PR Number</div>
            <div style="font-size:22px;color:#0f172a;font-weight:800;margin-top:4px;">
              ${escapeHtml(pr.prNumber)}
              ${
                isSassRequest
                  ? `<span style="display:inline-block;margin-left:10px;vertical-align:middle;padding:3px 10px;border-radius:999px;background:#ccfbf1;color:#0f766e;font-size:11px;font-weight:800;letter-spacing:0.04em;">CLOUD SUBSCRIPTION</span>`
                  : ''
              }
            </div>
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
                    ${
                      entityLocationLabel
                        ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(entityLocationLabel)}</div>`
                        : ''
                    }
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
              ${
                hasRfqVendors && !isSassRequest
                  ? ''
                  : lineOwnVendor
                    ? `<tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700;">Vendor Path</div>
                    <div style="font-size:16px;font-weight:800;color:#047857;margin-top:4px;">Own Vendor</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;"></td>
              </tr>`
                    : `<tr>
                <td width="50%" style="padding:6px;">
                  <table width="100%" style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#047857;text-transform:uppercase;font-weight:700;">Total Amount</div>
                    <div style="font-size:18px;font-weight:800;color:#047857;margin-top:4px;">${money(pr.totalAmount, pr)}</div>
                  </td></tr></table>
                </td>
                <td width="50%" style="padding:6px;">${
                  isSassRequest
                    ? `<table width="100%" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;"><tr><td style="padding:12px 14px;">
                    <div style="font-size:10px;color:#0f766e;text-transform:uppercase;font-weight:700;">Purchase Type</div>
                    <div style="font-size:16px;font-weight:800;color:#0f766e;margin-top:4px;">Cloud Subscription</div>
                  </td></tr></table>`
                    : ''
                }</td>
              </tr>`
              }
            </table>
          </td>
        </tr>
        ${rfqBlock}
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
                ${
                  lineOwnVendor
                    ? `<th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:left;">Item Name / Description</th>`
                    : `<th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:left;">Description</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;">Qty</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Unit</th>
                <th style="padding:10px;font-size:10px;color:#64748b;border-bottom:1px solid #e5e7eb;text-align:right;">Total</th>`
                }
              </tr></thead>
              <tbody>${lineRows}</tbody>
            </table>
          </td>
        </tr>
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

  const bestQuote = bestQuotedFromSummary(rfqSummary);
  const text = [
    isSassRequest ? `CLOUD SUBSCRIPTION REQUEST — ${subject}` : isScmRfqEntry ? subject : `Action Required: PR ${pr.prNumber} — ${pr.title}`,
    `Entity: ${entityLabel}`,
    entityLocationLabel ? `Entity Location: ${entityLocationLabel}` : '',
    isSassRequest ? 'Purchase Type: Cloud Subscription' : '',
    `Role: ${roleDisplayName}`,
    `Stage: ${stageText}`,
    `Requester: ${requester?.name || pr.requester}`,
    lineOwnVendor ? 'Vendor Path: Own Vendor' : `PR Amount: ${money(pr.totalAmount, pr)}`,
    bestQuote ? `Quoted Amount: ${money(bestQuote.price, pr)} (${bestQuote.vendor})` : '',
    rfqSummary?.recommendedVendor
      ? `Recommended: ${rfqSummary.recommendedVendor} (${money(rfqSummary.quotedPrice || 0, rfqSummary)})`
      : '',
    rfqSummary?.recommendationJustification
      ? `Justification: ${rfqSummary.recommendationJustification}`
      : '',
    rfqSummary?.totalRounds ? `Total Rounds: ${rfqSummary.totalRounds}` : '',
    hasRfqVendors ? 'Quotation files for each round are attached.' : '',
    '',
    isCreatePoStep
      ? `Open Create PO: ${portalUrl}`
      : isRfqEntryStep
        ? `Open RFQ Entry: ${portalUrl}`
        : `Approve: ${approveUrl}`,
    !isRfqEntryStep && !isCreatePoStep && showSendBack ? `Send Back: ${returnUrl}` : '',
    !isRfqEntryStep && !isCreatePoStep ? `Reject: ${rejectUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
