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
const SRIVATHS_EMAIL = 'srivaths.varadharajan@refex.co.in';
const MEET_EMAIL = 'meet.g@refex.co.in';

function actorEmailAndName(actorOrEmail) {
  if (!actorOrEmail) return { email: '', name: '' };
  if (typeof actorOrEmail === 'string') {
    const s = actorOrEmail.trim().toLowerCase();
    return { email: s.includes('@') ? s : '', name: s };
  }
  return {
    email: String(actorOrEmail.email || '').trim().toLowerCase(),
    name: String(actorOrEmail.name || actorOrEmail.actorName || '').trim().toLowerCase(),
  };
}

export function isMugeshActor(actorOrEmail) {
  const { email, name } = actorEmailAndName(actorOrEmail);
  if (email && (email === MUGESH_EMAIL || email.includes('mugesh.m@'))) return true;
  if (name && (name === 'mugesh' || name.startsWith('mugesh ') || name.startsWith('mugesh.'))) return true;
  return false;
}

export function isMeetActor(actorOrEmail) {
  const { email, name } = actorEmailAndName(actorOrEmail);
  if (email === MEET_EMAIL || email.startsWith('meet.g@')) return true;
  if (name === 'meet' || name.startsWith('meet.') || name.startsWith('meet ')) return true;
  return false;
}

export function isSrivathsActor(actorOrEmail) {
  const { email, name } = actorEmailAndName(actorOrEmail);
  if (
    email &&
    (email === SRIVATHS_EMAIL ||
      email.includes('srivaths.varadharajan@') ||
      email.includes('srivath'))
  ) {
    return true;
  }
  if (
    name &&
    (name === 'srivaths' ||
      name.startsWith('srivaths ') ||
      name.startsWith('srivaths.') ||
      name.includes('srivath') ||
      name.includes('srivats'))
  ) {
    return true;
  }
  return false;
}

/**
 * Display label for a system role in emails.
 * Never print "CFO" — Mugesh has no designation; Srivaths is Group CTO.
 */
export function formatRoleDisplayName(role, actorOrEmail = null) {
  if (isMugeshActor(actorOrEmail)) return '';
  if (isMeetActor(actorOrEmail)) return 'COO-RGML';
  if (isSrivathsActor(actorOrEmail)) return 'Group CTO';
  const raw = String(role || '').trim();
  if (!raw) return '';
  if (/^cfo$/i.test(raw)) return 'Mugesh';
  const map = {
    'HOD Approver': 'L1 Manager',
    'PR Manager': 'L2 Manager',
  };
  return map[raw] || raw;
}

/** "Name (Role)" for mail intros — Srivaths is Group CTO; Mugesh has no designation. */
export function formatActorWithRole(actorName, actorRole) {
  const name = String(actorName || '').trim();
  if (isMeetActor(name)) return name ? `${name} (COO-RGML)` : 'COO-RGML';
  if (isSrivathsActor(name)) return name ? `${name} (Group CTO)` : 'Group CTO';
  if (isMugeshActor(name) || /^cfo$/i.test(String(actorRole || '').trim())) {
    return name || 'Mugesh';
  }
  const roleDisplay = formatRoleDisplayName(actorRole, name || null);
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
    .replace(/\b(srivaths[^(\n<]*)\s*\(\s*(?:CFO|Group\s*CEO|CTO)\s*\)/gi, '$1 (Group CTO)')
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

function isNewJoinersPurchaseType(pr) {
  const raw = String(pr?.purchaseType || pr?.purchase_type || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (
    raw === 'new_joiners_laptop' ||
    raw === 'new_joiner_laptop' ||
    raw === 'newjoinerslaptop' ||
    raw === 'njl' ||
    Boolean(pr?.isNewJoinersLaptop)
  );
}

function resolveJoinerRows(pr) {
  const raw = pr?.joinerDetails || pr?.joiner_details || pr?.joiners || [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row) =>
      String(row?.firstName || row?.first_name || '').trim() ||
      String(row?.lastName || row?.last_name || '').trim() ||
      String(row?.mobileNumber || row?.mobile_number || '').trim()
  );
}

/**
 * HTML + plain-text New Joiners roster for workflow emails (every step).
 * Returns empty strings when the PR is not New Joiners / has no roster.
 */
export function buildJoinerDetailsEmailSection(pr) {
  const rows = resolveJoinerRows(pr);
  if (!rows.length && !isNewJoinersPurchaseType(pr)) {
    return { html: '', text: '' };
  }
  if (!rows.length) {
    return {
      html: `
        <div style="margin:16px 0 0;padding:14px 16px;background:#ecfdf5;border:1px solid #bbf7d0;border-radius:10px;">
          <div style="font-size:12px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:0.04em;">New Joiners Laptop Purchase</div>
          <div style="font-size:13px;color:#047857;margin-top:6px;">No joiner roster rows on this PR yet.</div>
        </div>`,
      text: 'New Joiners Laptop Purchase — no joiner roster rows.',
    };
  }

  const field = (label, value) => {
    const v = String(value ?? '').trim() || '—';
    return `<td width="50%" style="padding:4px 6px 8px;vertical-align:top;">
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:0.04em;">${escapeHtml(label)}</div>
      <div style="font-size:13px;color:#0f172a;font-weight:600;margin-top:2px;line-height:1.35;">${escapeHtml(v)}</div>
    </td>`;
  };

  const cards = rows
    .map((row, index) => {
      const first = String(row.firstName || row.first_name || '').trim();
      const last = String(row.lastName || row.last_name || '').trim();
      const fullName = [first, last].filter(Boolean).join(' ') || `Joiner ${index + 1}`;
      const createdBy =
        String(row.createdByName || row.created_by_name || row.hrName || row.hr_name || '').trim() ||
        String(pr?.requesterName || pr?.requester || '').trim() ||
        '—';
      return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid #bbf7d0;border-radius:10px;background:#ffffff;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;background:#ecfdf5;border-bottom:1px solid #bbf7d0;">
            <div style="font-size:13px;font-weight:800;color:#065f46;">#${index + 1} · ${escapeHtml(fullName)}</div>
            <div style="font-size:11px;color:#047857;margin-top:2px;">Created by: ${escapeHtml(createdBy)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:10px 8px 4px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                ${field('Joining Date', row.joiningDate || row.joining_date)}
                ${field('Mobile Number', row.mobileNumber || row.mobile_number || row.mobile)}
              </tr>
              <tr>
                ${field('Designation', row.designation)}
                ${field('Department', row.department)}
              </tr>
              <tr>
                ${field('Company', row.company)}
                ${field('Location', row.location)}
              </tr>
              <tr>
                ${field('Reporting Head Email ID', row.reportingHead || row.reporting_head)}
                ${field('Rolls / Contractor', row.onRollsOrContract || row.on_rolls_or_contract)}
              </tr>
              <tr>
                ${field('Email ID', row.emailRequired || row.email_id || row.emailId)}
                ${field('Laptop / Desktop', row.deviceType || row.laptop_desktop)}
              </tr>
              ${
                row.inventoryStatus || row.remarks
                  ? `<tr>
                ${field('Inventory', row.inventoryStatus || row.inventory_status || '—')}
                ${field('Remarks', row.remarks || '—')}
              </tr>`
                  : ''
              }
            </table>
          </td>
        </tr>
      </table>`;
    })
    .join('');

  const html = `
    <div style="margin:16px 0 0;">
      <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">
        New Joiners Laptop Purchase · ${rows.length} joiner(s)
      </div>
      ${cards}
    </div>`;

  const textLines = [
    `New Joiners Laptop Purchase (${rows.length}):`,
    ...rows.map((row, index) => {
      const first = String(row.firstName || row.first_name || '').trim();
      const last = String(row.lastName || row.last_name || '').trim();
      const name = [first, last].filter(Boolean).join(' ') || `Joiner ${index + 1}`;
      const createdBy =
        String(row.createdByName || row.hrName || '').trim() ||
        String(pr?.requesterName || pr?.requester || '').trim() ||
        '—';
      return [
        `${index + 1}. ${name}`,
        `   Joining Date: ${row.joiningDate || row.joining_date || '—'}`,
        `   Mobile: ${row.mobileNumber || row.mobile_number || row.mobile || '—'}`,
        `   Designation: ${row.designation || '—'}`,
        `   Department: ${row.department || '—'}`,
        `   Company: ${row.company || '—'}`,
        `   Location: ${row.location || '—'}`,
        `   Reporting Head: ${row.reportingHead || row.reporting_head || '—'}`,
        `   Rolls/Contractor: ${row.onRollsOrContract || row.on_rolls_or_contract || '—'}`,
        `   Email ID: ${row.emailRequired || row.email_id || '—'}`,
        `   Laptop/Desktop: ${row.deviceType || row.laptop_desktop || '—'}`,
        `   Created by: ${createdBy}`,
        row.inventoryStatus ? `   Inventory: ${row.inventoryStatus}` : '',
        row.remarks ? `   Remarks: ${row.remarks}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }),
  ];

  return { html, text: textLines.join('\n') };
}

/** Convenience: HTML only (empty string when N/A). */
export function joinerDetailsEmailHtml(pr) {
  return buildJoinerDetailsEmailSection(pr).html;
}

/** Convenience: plain text only (empty string when N/A). */
export function joinerDetailsEmailText(pr) {
  return buildJoinerDetailsEmailSection(pr).text;
}
