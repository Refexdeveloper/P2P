export function normalizeEmailCurrency(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'INR') return code;
  return 'INR';
}

export function formatCurrency(amount, currency = 'INR') {
  const code = normalizeEmailCurrency(currency);
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    const symbol = code === 'USD' ? '$' : code === 'EUR' ? '€' : '₹';
    return `${symbol}${n.toLocaleString(code === 'INR' ? 'en-IN' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
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
const MUGESH_EMAIL = 'mugesh.m@refex.co.in';

export function isMugeshActor(actorOrEmail) {
  if (!actorOrEmail) return false;
  if (typeof actorOrEmail === 'string') {
    const s = actorOrEmail.trim().toLowerCase();
    if (!s) return false;
    if (s === MUGESH_EMAIL || s.includes('mugesh.m@')) return true;
    if (s === 'mugesh' || s.startsWith('mugesh ') || s.startsWith('mugesh.')) return true;
    return false;
  }
  const email = String(actorOrEmail.email || '').trim().toLowerCase();
  const name = String(actorOrEmail.name || actorOrEmail.actorName || '').trim().toLowerCase();
  if (email && (email === MUGESH_EMAIL || email.includes('mugesh.m@'))) return true;
  if (name && (name === 'mugesh' || name.startsWith('mugesh ') || name.startsWith('mugesh.'))) return true;
  return false;
}

/**
 * Display label for a system role in emails.
 * Never print "CFO" — use Mugesh (or blank next to a person name).
 */
export function formatRoleDisplayName(role, actorOrEmail = null) {
  if (isMugeshActor(actorOrEmail)) return '';
  const raw = String(role || '').trim();
  if (!raw) return '';
  if (/^cfo$/i.test(raw)) return 'Mugesh';
  const map = {
    'HOD Approver': 'L1 Manager',
    'PR Manager': 'L2 Manager',
  };
  return map[raw] || raw;
}

/** "Name (Role)" for mail intros — never append CFO / Mugesh designation beside a person. */
export function formatActorWithRole(actorName, actorRole) {
  const name = String(actorName || '').trim();
  const roleRaw = String(actorRole || '').trim();
  if (/^cfo$/i.test(roleRaw) || isMugeshActor(name)) {
    return name || 'Mugesh';
  }
  const roleDisplay = formatRoleDisplayName(roleRaw, name || null);
  if (name && roleDisplay) return `${name} (${roleDisplay})`;
  if (name) return name;
  return roleDisplay || 'Approver';
}

/**
 * Strip every "CFO" / "Group CEO" mention from outbound email copy.
 * System role codes stay unchanged in auth/workflow — this is display-only.
 */
export function sanitizeEmailCfoMentions(value) {
  if (value == null || typeof value !== 'string' || !value) return value;
  return value
    // Drop designation in parentheses first: "mugesh.m (CFO)" → "mugesh.m"
    .replace(/\s*\(\s*Group\s*CEO\s*\)/gi, '')
    .replace(/\s*\(\s*CFO\s*\)/gi, '')
    // Remaining standalone labels: "CFO Approval" → "Mugesh Approval"
    .replace(/\bGroup\s*CEO\b/gi, 'Mugesh')
    .replace(/\bCFO\b/gi, 'Mugesh');
}


/** Display entity name (+ code) for email templates */
export function formatEntity(prOrPo) {
  const name = prOrPo?.entityName || prOrPo?.entity || '';
  const code = prOrPo?.entityCode || '';
  if (!name && !code) return '—';
  if (name && code) return `${name} (${code})`;
  return name || code;
}

/** Entity location / billing region for email subjects */
export function formatEntityLocation(prOrPo) {
  return String(
    prOrPo?.billingLocation ||
      prOrPo?.billing_location ||
      prOrPo?.entityLocation ||
      prOrPo?.entity_location ||
      ''
  ).trim();
}

/** SCM RFQ Entry subject: New PR request received - PR — Entity - Location */
export function formatScmRfqEntrySubject(pr) {
  const prNumber = String(pr?.prNumber || pr?.pr_number || '').trim() || 'PR';
  const entity =
    String(pr?.entityName || pr?.entity || '').trim() ||
    String(pr?.entityCode || '').trim() ||
    '—';
  const location = formatEntityLocation(pr);
  const entityPart = location ? `${entity} - ${location}` : entity;
  return `New PR request received - ${prNumber} — ${entityPart}`;
}
