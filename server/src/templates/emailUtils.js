export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** RefexOne logo shown at the top of all outbound HTML emails */
export const REFEXONE_EMAIL_LOGO_URL = 'https://refexone.com/refexone-logo.png';

function buildEmailLogoRow() {
  return `<tr>
      <td colspan="99" style="padding:18px 28px 14px;text-align:center;background:#ffffff;">
        <img src="${REFEXONE_EMAIL_LOGO_URL}" alt="RefexOne" width="180" style="max-width:180px;width:180px;height:auto;display:inline-block;border:0;outline:none;text-decoration:none;" />
      </td>
    </tr>`;
}

function buildEmailLogoBlock() {
  return `<div style="text-align:center;padding:18px 20px 14px;background:#ffffff;">
    <img src="${REFEXONE_EMAIL_LOGO_URL}" alt="RefexOne" width="180" style="max-width:180px;width:180px;height:auto;display:inline-block;border:0;" />
  </div>`;
}

/** Inject RefexOne logo at the top of an HTML email body (idempotent). */
export function withEmailLogo(html) {
  const raw = String(html || '');
  if (!raw.trim()) return raw;
  if (raw.includes(REFEXONE_EMAIL_LOGO_URL)) return raw;

  const logoRow = buildEmailLogoRow();
  const firstTable = raw.match(/<table\b[^>]*>/i);
  if (firstTable) {
    const insertAt = raw.indexOf(firstTable[0]) + firstTable[0].length;
    return `${raw.slice(0, insertAt)}${logoRow}${raw.slice(insertAt)}`;
  }

  const logoBlock = buildEmailLogoBlock();
  if (/<body\b[^>]*>/i.test(raw)) {
    return raw.replace(/<body(\b[^>]*)>/i, `<body$1>${logoBlock}`);
  }
  return `${logoBlock}${raw}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Friendly role labels for emails (keep system role codes unchanged) */
export function formatRoleDisplayName(role) {
  const map = {
    'HOD Approver': 'L1 Manager',
    'PR Manager': 'L2 Manager',
  };
  return map[role] || role || 'Approver';
}

/** Display entity name (+ code) for email templates */
export function formatEntity(prOrPo) {
  const name = prOrPo?.entityName || prOrPo?.entity || '';
  const code = prOrPo?.entityCode || '';
  if (!name && !code) return '—';
  if (name && code) return `${name} (${code})`;
  return name || code;
}
