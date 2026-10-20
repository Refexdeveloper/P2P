import pool from '../config/db.js';
import { ensureUserActivityLogsTable } from './userActivityLogService.js';
import { sendMailToRecipients } from './emailService.js';
import {
  DEFAULT_PO_APPROVER_EMAIL,
  DEFAULT_PO_APPROVER_NAME,
  DEFAULT_SCM_MANAGER_EMAIL,
  DEFAULT_SCM_MANAGER_NAME,
} from '../utils/scmAssignee.js';

export const P2P_REPORT_TO = 'sathishkumar.r@refex.co.in';

const SIGNED_PO = `LOWER(TRIM(IFNULL(po.status, ''))) IN (
  'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
  'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
)`;
const LIVE_PO = `LOWER(TRIM(IFNULL(po.status, ''))) NOT IN ('', 'draft', 'cancelled')
  AND UPPER(IFNULL(po.po_number, '')) NOT LIKE 'DRAFT-%'
  AND IFNULL(po.po_number, '') NOT LIKE 'CS-%'
  AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass'`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
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

function formatStamp(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

async function userIdByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [String(email || '').trim().toLowerCase()]
  );
  return { id: Number(rows[0]?.id) || 0, name: rows[0]?.name || '' };
}

export async function loadP2pActivityReport(now = new Date()) {
  await ensureUserActivityLogsTable();
  const mounesh = await userIdByEmail(DEFAULT_SCM_MANAGER_EMAIL);
  const tarkesh = await userIdByEmail(DEFAULT_PO_APPROVER_EMAIL);

  const [[pr]] = await pool.query(
    `SELECT
       COUNT(*) AS total_prs,
       SUM(DATE(created_at) = CURDATE()) AS prs_today
     FROM purchase_requests
     WHERE UPPER(TRIM(IFNULL(status, ''))) NOT IN ('', 'DRAFT', 'CANCELLED')
       AND UPPER(IFNULL(pr_number, '')) NOT LIKE 'DRAFT-%'`
  );

  const [[counts]] = await pool.query(
    `SELECT
       SUM(${LIVE_PO}) AS total_pos,
       SUM(${LIVE_PO} AND DATE(po.created_at) = CURDATE()) AS pos_today,
       SUM(
         ${LIVE_PO}
         AND ${SIGNED_PO}
         AND (
           po.signer_id = ?
           OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mounesh%'
         )
       ) AS mounesh_signed,
       SUM(
         ${LIVE_PO}
         AND ${SIGNED_PO}
         AND (
           po.signer_id = ?
           OR LOWER(IFNULL(po.signature_name, '')) LIKE 'tarkesh%'
         )
       ) AS tarkesh_signed,
       SUM(
         ${LIVE_PO}
         AND LOWER(TRIM(IFNULL(po.status, ''))) = 'pending_approval'
         AND NOT EXISTS (
           SELECT 1 FROM users creator
           WHERE creator.id = po.created_by
             AND (
               LOWER(creator.email) = ?
               OR LOWER(creator.email) LIKE 'mounesh.r@%'
             )
         )
       ) AS mounesh_pending,
       SUM(
         ${LIVE_PO}
         AND LOWER(TRIM(IFNULL(po.status, ''))) = 'pending_approval'
         AND EXISTS (
           SELECT 1 FROM users creator
           WHERE creator.id = po.created_by
             AND (
               LOWER(creator.email) = ?
               OR LOWER(creator.email) LIKE 'mounesh.r@%'
             )
         )
       ) AS tarkesh_pending
     FROM purchase_orders po`,
    [mounesh.id, tarkesh.id, DEFAULT_SCM_MANAGER_EMAIL, DEFAULT_SCM_MANAGER_EMAIL]
  );

  const [buyers] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role,
            login.last_login,
            SUM(${LIVE_PO}) AS created_pos,
            SUM(${LIVE_PO} AND ${SIGNED_PO}) AS approved_pos
     FROM users u
     LEFT JOIN (
       SELECT user_id, MAX(created_at) AS last_login
       FROM user_activity_logs
       WHERE action = 'login' AND user_id IS NOT NULL
       GROUP BY user_id
     ) login ON login.user_id = u.id
     LEFT JOIN purchase_orders po ON po.created_by = u.id
     WHERE u.is_active = 1
       AND (u.role = 'SCM Buyer' OR LOWER(u.email) = ?)
     GROUP BY u.id, u.name, u.email, u.role, login.last_login
     ORDER BY CASE WHEN LOWER(u.email) = ? THEN 0 ELSE 1 END, created_pos DESC, u.name ASC`,
    [DEFAULT_SCM_MANAGER_EMAIL, DEFAULT_SCM_MANAGER_EMAIL]
  );

  const mouneshSigned = num(counts?.mounesh_signed);
  const tarkeshSigned = num(counts?.tarkesh_signed);

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    prsToday: num(pr?.prs_today),
    totalPos: num(counts?.total_pos),
    posToday: num(counts?.pos_today),
    mouneshName: mounesh.name || DEFAULT_SCM_MANAGER_NAME,
    tarkeshName: tarkesh.name || DEFAULT_PO_APPROVER_NAME,
    mouneshSigned,
    tarkeshSigned,
    mouneshPending: num(counts?.mounesh_pending),
    tarkeshPending: num(counts?.tarkesh_pending),
    approvedPos: mouneshSigned + tarkeshSigned,
    buyers: buyers.map((row) => ({
      name: row.name || row.email || 'SCM Buyer',
      email: row.email || '',
      role: row.role || 'SCM Buyer',
      lastLogin: formatStamp(row.last_login),
      createdPos: num(row.created_pos),
      approvedPos: num(row.approved_pos),
    })),
  };
}

function summaryCard(width, value, label, note, boxStyle, valueColor, labelColor) {
  return `<td width="${width}" align="center" valign="top" style="${boxStyle}">
<div style="font-size:18px; font-weight:bold; color:${valueColor} !important;">${escapeHtml(value)}</div>
<div style="font-size:10px; color:${labelColor} !important; margin-top:4px;">${escapeHtml(label)}</div>
<div style="font-size:9px; color:${labelColor} !important; margin-top:2px; line-height:1.25;">${note ? escapeHtml(note) : '&nbsp;'}</div>
</td>`;
}

function activityRows(users) {
  if (!users.length) {
    return `<tr><td colspan="4" style="padding:14px; color:#6b6b6b;">No user activity.</td></tr>`;
  }
  return users
    .map((user, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f7f6';
      return `<tr style="background-color:${bg} !important;" bgcolor="${bg}">
<td style="padding:12px 14px; border-top:1px solid #ececea; color:#1a1a1a !important;">
<div style="font-weight:bold; color:#1a1a1a !important;">${escapeHtml(user.name)}</div>
<div style="font-size:11px; color:#6b6b6b !important;">${escapeHtml(user.role)}${user.email ? ` · ${escapeHtml(user.email)}` : ''}</div>
</td>
<td style="padding:12px 14px; border-top:1px solid #ececea; color:#1a1a1a !important; white-space:nowrap;">${escapeHtml(user.lastLogin)}</td>
<td style="padding:12px 14px; border-top:1px solid #ececea; font-weight:bold; color:#3468a8 !important;" align="center">${user.createdPos}</td>
<td style="padding:12px 14px; border-top:1px solid #ececea; font-weight:bold; color:#14503a !important;" align="center">${user.approvedPos}</td>
</tr>`;
    })
    .join('');
}

export function buildP2pActivityReportEmail(report) {
  const subject = `RMC P2P Report — ${report.generatedAt}`;
  const blue = 'background:linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%) !important; border:1px solid #dfe8f2; border-radius:8px; padding:14px 4px; box-shadow:0 2px 6px rgba(30,80,160,0.06);';
  const amber = 'background:linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%) !important; border:1px solid #f2e2c4; border-radius:8px; padding:14px 4px; box-shadow:0 2px 6px rgba(180,120,20,0.07);';
  const green = 'background:linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%) !important; border:1px solid #c7ead4; border-radius:8px; padding:14px 4px; box-shadow:0 2px 6px rgba(26,140,92,0.08);';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f2 !important; font-family:Arial,Helvetica,sans-serif;" bgcolor="#eef0f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f2 !important;" bgcolor="#eef0f2">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff !important; border-radius:10px; overflow:hidden; box-shadow:0 4px 18px rgba(0,0,0,0.10);" bgcolor="#ffffff">

<tr><td style="background:linear-gradient(180deg,#ffffff 0%,#f7f7f6 100%) !important; padding:26px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="180" valign="middle">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refexone-logo.png" alt="refexOne" width="168" style="display:block; max-width:168px; height:auto;">
</td>
<td valign="middle" style="padding-left:18px; border-left:1px solid #e5e5e0;">
<div style="font-size:18px; font-weight:bold; color:#1a1a1a !important;">RMC P2P Report</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:4px;">Purchase requests and purchase orders</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:2px;">Generated ${escapeHtml(report.generatedAt)}</div>
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
${summaryCard('32%', report.totalPrs, 'Total PRs', '', blue, '#1a1a1a', '#5b7ba3')}
<td width="2%"></td>
${summaryCard('32%', report.totalPos, 'Total POs', '', amber, '#1a1a1a', '#9a7a3a')}
<td width="2%"></td>
${summaryCard('32%', report.approvedPos, 'Approved POs', '', green, '#1a1a1a', '#3f8f63')}
</tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr>
${summaryCard('23%', report.mouneshSigned, 'Mounesh signed', '', green, '#14503a', '#3f8f63')}
<td width="2%"></td>
${summaryCard('23%', report.mouneshPending, 'Mounesh pending', '', amber, '#1a1a1a', '#9a7a3a')}
<td width="2%"></td>
${summaryCard('23%', report.tarkeshSigned, 'Tarkesh signed', '', 'background:linear-gradient(180deg,#f0fbf4 0%,#e0f5e8 100%) !important; border:1px solid #c7ead4; border-radius:8px; padding:14px 4px; box-shadow:0 2px 6px rgba(26,140,92,0.08);', '#14503a', '#3f8f63')}
<td width="2%"></td>
${summaryCard('23%', report.tarkeshPending, 'Tarkesh pending', '', 'background:linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%) !important; border:1px solid #f2e2c4; border-radius:8px; padding:14px 4px; box-shadow:0 2px 6px rgba(180,120,20,0.07);', '#1a1a1a', '#9a7a3a')}
</tr></table></td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Today's activity</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48%" align="center" style="background:linear-gradient(180deg,#fffaf2 0%,#fdecd0 100%) !important; border:1px solid #f0d9a8; border-radius:10px; padding:26px 10px; box-shadow:0 3px 10px rgba(180,120,20,0.10);">
<div style="font-size:30px; font-weight:bold; color:#9a7a3a !important;">${report.prsToday}</div>
<div style="font-size:12px; color:#9a7a3a !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">PRs created today</div></td>
<td width="4%"></td>
<td width="48%" align="center" style="background:linear-gradient(180deg,#f2f6fb 0%,#dfeafa 100%) !important; border:1px solid #bcd6f0; border-radius:10px; padding:26px 10px; box-shadow:0 3px 10px rgba(30,80,160,0.10);">
<div style="font-size:30px; font-weight:bold; color:#3468a8 !important;">${report.posToday}</div>
<div style="font-size:12px; color:#3468a8 !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">POs created today</div></td>
</tr></table></td></tr>

<tr><td style="padding:26px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">User activity</td></tr>
<tr><td style="padding:8px 32px 28px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
<tr style="background:linear-gradient(90deg,#14503a 0%,#1a8c5c 100%) !important;" bgcolor="#14503a">
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;">User</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;">Last Signed In</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Created POs</td>
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;" align="center">Approved POs</td>
</tr>
${activityRows(report.buyers)}
</table></td></tr>

<tr><td style="background-color:#faf9f7 !important; padding:18px 32px; border-top:1px solid #ececea; font-size:11px; color:#a0a0a0 !important;" bgcolor="#faf9f7">
RMC P2P Report &middot; Automated &middot; Do not reply to this email
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    'RMC P2P Report',
    report.generatedAt,
    `Total PRs: ${report.totalPrs}`,
    `Total POs: ${report.totalPos}`,
    `Approved POs: ${report.approvedPos}`,
    `${report.mouneshName} signed: ${report.mouneshSigned}`,
    `${report.mouneshName} pending: ${report.mouneshPending}`,
    `${report.tarkeshName} signed: ${report.tarkeshSigned}`,
    `${report.tarkeshName} pending: ${report.tarkeshPending}`,
    '',
    'User activity',
    ...report.buyers.map(
      (buyer) =>
        `${buyer.name} <${buyer.email}> last login ${buyer.lastLogin} created ${buyer.createdPos} approved ${buyer.approvedPos}`
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
      totalPrs: report.totalPrs,
      totalPos: report.totalPos,
      approvedPos: report.approvedPos,
      mouneshSigned: report.mouneshSigned,
      mouneshPending: report.mouneshPending,
      tarkeshSigned: report.tarkeshSigned,
      tarkeshPending: report.tarkeshPending,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
