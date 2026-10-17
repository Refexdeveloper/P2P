import pool from '../config/db.js';
import { ensureUserActivityLogsTable } from './userActivityLogService.js';
import { sendMailToRecipients } from './emailService.js';

export const P2P_REPORT_TO = 'sathishkumar.r@refex.co.in';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function kolkataDayRange(now = new Date()) {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateStr, start, end };
}

function formatReportDate(now = new Date()) {
  const date = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  return `${date}, ${time} IST`;
}

function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

const PENDING_PR = `UPPER(pr.status) IN (
  'PENDING_HOD_APPROVAL','PENDING_PR_MANAGER_APPROVAL','PENDING_CFO_APPROVAL',
  'PENDING_RFQ_MANAGER_APPROVAL','PENDING_RFQ_L2_APPROVAL','PENDING_RFQ_CFO_APPROVAL',
  'PENDING_BUSINESS_APPROVAL','PENDING_SCM_PO','AWAITING_INVOICE','RETURNED'
)`;
const LIVE_PO = `LOWER(po.status) NOT IN ('draft','cancelled')`;
const APPROVED_PR = `UPPER(pr.status) = 'APPROVED'`;

export async function loadP2pActivityReport(now = new Date()) {
  await ensureUserActivityLogsTable();
  const { start, end } = kolkataDayRange(now);

  const [[pr]] = await pool.query(
    `SELECT
       SUM(UPPER(status) NOT IN ('DRAFT','CANCELLED')) AS total_prs,
       SUM(
         UPPER(status) NOT IN ('DRAFT','CANCELLED')
         AND created_at >= ? AND created_at < ?
       ) AS prs_today,
       COUNT(DISTINCT CASE
         WHEN UPPER(status) NOT IN ('DRAFT','CANCELLED') THEN requester_id
       END) AS requesters
     FROM purchase_requests`,
    [start, end]
  );

  const [[po]] = await pool.query(
    `SELECT
       SUM(LOWER(status) NOT IN ('draft','cancelled')) AS total_pos,
       SUM(
         LOWER(status) NOT IN ('draft','cancelled')
         AND created_at >= ? AND created_at < ?
       ) AS pos_today
     FROM purchase_orders`,
    [start, end]
  );

  const [[users]] = await pool.query(
    `SELECT COUNT(*) AS total_users FROM users WHERE is_active = 1`
  );

  const [[logins]] = await pool.query(
    `SELECT COUNT(DISTINCT user_id) AS logged_today
     FROM user_activity_logs
     WHERE action = 'login'
       AND user_id IS NOT NULL
       AND created_at >= ? AND created_at < ?`,
    [start, end]
  );

  const [entityPrRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       SUM(CASE WHEN ${PENDING_PR} THEN 1 ELSE 0 END) AS pending_count,
       SUM(CASE WHEN ${APPROVED_PR} THEN 1 ELSE 0 END) AS approved_count
     FROM purchase_requests pr
     LEFT JOIN entity_masters em ON em.id = pr.entity_id
     WHERE UPPER(pr.status) NOT IN ('DRAFT','CANCELLED','REJECTED')
     GROUP BY entity_id, entity_name, entity_code`
  );

  const [entityPoRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       COUNT(*) AS po_count
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN entity_masters em ON em.id = COALESCE(po.entity_id, pr.entity_id)
     WHERE ${LIVE_PO}
     GROUP BY entity_id, entity_name, entity_code`
  );

  const entityMap = new Map();
  const entityKey = (row) => `${Number(row.entity_id) || 0}|${row.entity_name || 'Unassigned'}`;
  for (const row of [...entityPrRows, ...entityPoRows]) {
    const key = entityKey(row);
    if (!entityMap.has(key)) {
      entityMap.set(key, {
        name: row.entity_name || 'Unassigned',
        code: row.entity_code || '',
        pending: 0,
        approved: 0,
        poCreated: 0,
      });
    }
    const item = entityMap.get(key);
    if (row.pending_count != null) item.pending = num(row.pending_count);
    if (row.approved_count != null) item.approved = num(row.approved_count);
    if (row.po_count != null) item.poCreated = num(row.po_count);
  }
  const entities = [...entityMap.values()]
    .filter((row) => row.pending || row.approved || row.poCreated)
    .sort((a, b) => a.name.localeCompare(b.name));

  const [people] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role,
            SUM(CASE WHEN ${PENDING_PR} THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN ${APPROVED_PR} THEN 1 ELSE 0 END) AS approved_count,
            (
              SELECT COUNT(*)
              FROM purchase_orders po
              JOIN purchase_requests prx ON prx.id = po.pr_id
              WHERE prx.requester_id = u.id
                AND ${LIVE_PO}
            ) AS po_count
     FROM users u
     JOIN purchase_requests pr ON pr.requester_id = u.id
     WHERE UPPER(pr.status) NOT IN ('DRAFT','CANCELLED','REJECTED')
     GROUP BY u.id, u.name, u.email, u.role
     HAVING pending_count > 0 OR approved_count > 0 OR po_count > 0
     ORDER BY pending_count DESC, approved_count DESC, po_count DESC
     LIMIT 60`
  );

  const pending = entities.reduce((sum, row) => sum + row.pending, 0);
  const approved = entities.reduce((sum, row) => sum + row.approved, 0);

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    prsToday: num(pr?.prs_today),
    requesters: num(pr?.requesters),
    totalPos: num(po?.total_pos),
    posToday: num(po?.pos_today),
    totalUsers: num(users?.total_users),
    loggedToday: num(logins?.logged_today),
    pending,
    approved,
    entities,
    users: people.map((row) => ({
      name: row.name || row.email || 'User',
      email: row.email || '',
      role: row.role || '',
      pending: num(row.pending_count),
      approved: num(row.approved_count),
      poCreated: num(row.po_count),
    })),
  };
}

function statCard({ width, value, label, sub, valueColor, labelColor, background, border }) {
  return `<td width="${width}" align="center" valign="top" style="background:${background} !important; border:1px solid ${border}; border-radius:8px; padding:14px 4px;">
<div style="font-size:18px; font-weight:bold; color:${valueColor} !important;">${escapeHtml(value)}</div>
<div style="font-size:10px; color:${labelColor} !important; margin-top:4px;">${escapeHtml(label)}</div>
<div style="font-size:9px; color:${labelColor} !important; margin-top:2px; line-height:1.25;">${sub || '&nbsp;'}</div>
</td>`;
}

function countRows(rows, emptyLabel, nameCell) {
  if (!rows.length) {
    return `<tr><td colspan="4" style="padding:14px; color:#6b6b6b; background:#ffffff;">${emptyLabel}</td></tr>`;
  }
  return rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 14px; color:#1a1a1a; border-top:1px solid #ececea;">${nameCell(row)}</td>
<td style="padding:10px 14px; color:#9a7a3a; border-top:1px solid #ececea; font-weight:bold;" align="center">${row.pending}</td>
<td style="padding:10px 14px; color:#14503a; border-top:1px solid #ececea; font-weight:bold;" align="center">${row.approved}</td>
<td style="padding:10px 14px; color:#3468a8; border-top:1px solid #ececea; font-weight:bold;" align="center">${row.poCreated}</td>
</tr>`;
    })
    .join('');
}

function entityRows(entities) {
  return countRows(
    entities,
    'No entity activity.',
    (row) =>
      `<div style="font-weight:bold;">${escapeHtml(row.name)}</div>${
        row.code ? `<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(row.code)}</div>` : ''
      }`
  );
}

function userRows(users) {
  return countRows(
    users,
    'No user activity.',
    (row) =>
      `<div style="font-weight:bold;">${escapeHtml(row.name)}</div>
<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(row.role || '—')} · ${escapeHtml(row.email)}</div>`
  );
}

export function buildP2pActivityReportEmail(report) {
  const subject = `P2P Procurement Report — ${report.generatedAt}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>P2P Procurement Report</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f2 !important;" bgcolor="#eef0f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f2 !important;" bgcolor="#eef0f2">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff !important; border-radius:10px; overflow:hidden;" bgcolor="#ffffff">

<tr><td style="background-color:#ffffff !important; padding:26px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="180" valign="middle">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refexone-logo.png" alt="refexOne" width="168" style="display:block; max-width:168px; height:auto;">
<img src="https://refexone.com/refexone-logo.png" alt="" width="1" height="1" style="display:none;max-height:0;overflow:hidden;">
</td>
<td valign="middle" style="padding-left:18px; border-left:1px solid #e5e5e0;">
<div style="font-size:18px; font-weight:bold; color:#1a1a1a !important;">P2P Procurement Report</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:4px;">Pending &middot; Approved &middot; PO Created</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:2px;">Generated ${escapeHtml(report.generatedAt)} &middot; Refex P2P only</div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:0; line-height:0;">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refex-shimmer-divider-green.gif" alt="" width="680" height="6" style="display:block; width:100%; height:6px; border:0;">
</td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Overall P2P Summary</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '32%',
  value: report.pending,
  label: 'Pending',
  sub: 'PRs in approval',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: report.approved,
  label: 'Approved',
  sub: 'PRs approved',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: report.totalPos,
  label: 'PO Created',
  sub: `${report.posToday} today`,
  valueColor: '#3468a8',
  labelColor: '#5b7ba3',
  background: 'linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%)',
  border: '#dfe8f2',
})}
</tr></table></td></tr>

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Entity-wise count</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;">Entity</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Pending</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Approved</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">PO Created</td>
</tr>
${entityRows(report.entities || [])}
</table></td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Today's P2P Activity</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48%" align="center" style="background:linear-gradient(180deg,#fffaf2 0%,#fdecd0 100%) !important; border:1px solid #f0d9a8; border-radius:10px; padding:26px 10px;">
<div style="font-size:30px; font-weight:bold; color:#9a7a3a !important;">${report.prsToday}</div>
<div style="font-size:12px; color:#9a7a3a !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">PRs Raised Today</div></td>
<td width="4%"></td>
<td width="48%" align="center" style="background:linear-gradient(180deg,#f2f6fb 0%,#dfeafa 100%) !important; border:1px solid #bcd6f0; border-radius:10px; padding:26px 10px;">
<div style="font-size:30px; font-weight:bold; color:#3468a8 !important;">${report.posToday}</div>
<div style="font-size:12px; color:#3468a8 !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">POs Created Today</div></td>
</tr></table></td></tr>

<tr><td style="padding:26px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">User activity</td></tr>
<tr><td style="padding:8px 32px 28px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;">User</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Pending</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Approved</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">PO Created</td>
</tr>
${userRows(report.users)}
</table></td></tr>

<tr><td style="padding:4px 32px 24px 32px; font-size:11px; color:#a0a0a0 !important; line-height:1.6;" bgcolor="#ffffff">
Pending is a PR still in approval. Approved is an approved PR. PO Created is a live purchase order. Draft, cancelled, and rejected records are excluded. ${report.loggedToday} of ${report.totalUsers} users logged in today.
</td></tr>

<tr><td style="background-color:#faf9f7 !important; padding:18px 32px; border-top:1px solid #ececea; font-size:11px; color:#a0a0a0 !important;" bgcolor="#faf9f7">
P2P Procurement Report &middot; Automated &middot; Do not reply to this email
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    'P2P Procurement Report',
    report.generatedAt,
    `Pending: ${report.pending}`,
    `Approved: ${report.approved}`,
    `PO Created: ${report.totalPos} (${report.posToday} today)`,
    `Logged in today: ${report.loggedToday} of ${report.totalUsers} users`,
    '',
    'Entity-wise',
    ...(report.entities || []).map(
      (row) => `${row.name}${row.code ? ` (${row.code})` : ''}: pending ${row.pending}, approved ${row.approved}, PO created ${row.poCreated}`
    ),
    '',
    'User activity',
    ...report.users.map(
      (user) => `${user.name} <${user.email}> pending ${user.pending}, approved ${user.approved}, PO created ${user.poCreated}`
    ),
  ].join('\n');

  return { subject, html, text };
}

export async function sendP2pActivityReport(to = P2P_REPORT_TO) {
  const recipient = String(to || P2P_REPORT_TO).trim() || P2P_REPORT_TO;
  const report = await loadP2pActivityReport();
  const built = buildP2pActivityReportEmail(report);
  await sendMailToRecipients([recipient], built.subject, built.html, built.text, [], {
    emailType: 'p2p_activity_report',
    skipLogo: true,
    meta: {
      pending: report.pending,
      approved: report.approved,
      totalPos: report.totalPos,
      entities: (report.entities || []).length,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
