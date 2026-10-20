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
    `SELECT COUNT(*) AS total_prs
     FROM purchase_requests
     WHERE UPPER(TRIM(IFNULL(status, ''))) NOT IN ('', 'DRAFT', 'CANCELLED')
       AND UPPER(IFNULL(pr_number, '')) NOT LIKE 'DRAFT-%'`
  );

  const [[counts]] = await pool.query(
    `SELECT
       SUM(${LIVE_PO}) AS total_pos,
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
       ) AS tarkesh_signed
     FROM purchase_orders po`,
    [mounesh.id, tarkesh.id]
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
     WHERE u.is_active = 1 AND u.role = 'SCM Buyer'
     GROUP BY u.id, u.name, u.email, u.role, login.last_login
     ORDER BY created_pos DESC, u.name ASC`
  );

  const mouneshSigned = num(counts?.mounesh_signed);
  const tarkeshSigned = num(counts?.tarkesh_signed);

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    totalPos: num(counts?.total_pos),
    mouneshName: mounesh.name || DEFAULT_SCM_MANAGER_NAME,
    tarkeshName: tarkesh.name || DEFAULT_PO_APPROVER_NAME,
    mouneshSigned,
    tarkeshSigned,
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

function card(value, label, sub, color) {
  return `<td width="32%" align="center" valign="top" style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:16px 8px;">
<div style="font-size:26px; font-weight:bold; color:${color};">${escapeHtml(value)}</div>
<div style="font-size:12px; font-weight:bold; color:#1a1a1a; margin-top:6px;">${escapeHtml(label)}</div>
<div style="font-size:11px; color:#6b7280; margin-top:2px;">${escapeHtml(sub)}</div>
</td>`;
}

function buyerRows(buyers) {
  if (!buyers.length) {
    return `<tr><td colspan="4" style="padding:14px; color:#6b7280;">No SCM buyers.</td></tr>`;
  }
  return buyers
    .map((buyer, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 12px; border-top:1px solid #e5e7eb;">
<div style="font-weight:bold; color:#111827;">${escapeHtml(buyer.name)}</div>
<div style="font-size:11px; color:#6b7280;">${escapeHtml(buyer.email)}</div>
</td>
<td style="padding:10px 12px; border-top:1px solid #e5e7eb; color:#111827; white-space:nowrap;">${escapeHtml(buyer.lastLogin)}</td>
<td style="padding:10px 12px; border-top:1px solid #e5e7eb; font-weight:bold; color:#1d4ed8;" align="center">${buyer.createdPos}</td>
<td style="padding:10px 12px; border-top:1px solid #e5e7eb; font-weight:bold; color:#047857;" align="center">${buyer.approvedPos}</td>
</tr>`;
    })
    .join('');
}

export function buildP2pActivityReportEmail(report) {
  const subject = `P2P Report — ${report.generatedAt}`;
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>P2P Report</title></head>
<body style="margin:0; padding:0; background:#eef2f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px;">
<tr><td style="padding:24px 28px 8px 28px;">
<div style="font-size:20px; font-weight:bold; color:#111827;">P2P Procurement Report</div>
<div style="font-size:12px; color:#6b7280; margin-top:4px;">Main branch · Mounesh · Tarkesh · SCM Buyers</div>
<div style="font-size:12px; color:#6b7280; margin-top:2px;">${escapeHtml(report.generatedAt)}</div>
</td></tr>
<tr><td style="padding:16px 28px 8px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${card(report.totalPrs, 'Total PRs', 'Draft and cancelled excluded', '#111827')}
<td width="2%"></td>
${card(report.totalPos, 'Total POs', 'Cancelled POs excluded', '#1d4ed8')}
<td width="2%"></td>
${card(report.approvedPos, 'Approved POs', 'Mounesh + Tarkesh signed', '#047857')}
</tr></table>
</td></tr>
<tr><td style="padding:18px 28px 8px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${card(report.mouneshSigned, `${report.mouneshName} signed`, 'POs he has signed', '#047857')}
<td width="4%"></td>
${card(report.tarkeshSigned, `${report.tarkeshName} signed`, 'POs he has signed', '#047857')}
<td width="32%"></td>
</tr></table>
</td></tr>
<tr><td style="padding:22px 28px 8px 28px; font-size:15px; font-weight:bold; color:#111827;">SCM buyer activity</td></tr>
<tr><td style="padding:8px 28px 24px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px;">
<tr style="background:#14503a;" bgcolor="#14503a">
<td style="padding:10px 12px; color:#ffffff; font-weight:bold;">SCM Buyer</td>
<td style="padding:10px 12px; color:#ffffff; font-weight:bold;">Last signed in</td>
<td style="padding:10px 12px; color:#ffffff; font-weight:bold;" align="center">Created POs</td>
<td style="padding:10px 12px; color:#ffffff; font-weight:bold;" align="center">Approved POs</td>
</tr>
${buyerRows(report.buyers)}
</table>
<div style="font-size:11px; color:#9ca3af; margin-top:12px; line-height:1.5;">
Cancelled and draft purchase orders are not counted. Approved POs are purchase orders signed by ${escapeHtml(report.mouneshName)} or ${escapeHtml(report.tarkeshName)}. Created POs and approved POs in the table are for each SCM buyer.
</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    'P2P Procurement Report',
    report.generatedAt,
    `Total PRs: ${report.totalPrs}`,
    `Total POs: ${report.totalPos}`,
    `Approved POs: ${report.approvedPos}`,
    `${report.mouneshName} signed: ${report.mouneshSigned}`,
    `${report.tarkeshName} signed: ${report.tarkeshSigned}`,
    '',
    'SCM buyer activity',
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
    meta: {
      totalPrs: report.totalPrs,
      totalPos: report.totalPos,
      approvedPos: report.approvedPos,
      mouneshSigned: report.mouneshSigned,
      tarkeshSigned: report.tarkeshSigned,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
