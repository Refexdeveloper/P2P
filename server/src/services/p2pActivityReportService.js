import pool from '../config/db.js';
import { ensureUserActivityLogsTable } from './userActivityLogService.js';
import { sendMailToRecipients } from './emailService.js';
import {
  DEFAULT_SCM_MANAGER_EMAIL,
  DEFAULT_SCM_MANAGER_NAME,
  RGML_SCM_MANAGER_EMAIL,
  RGML_SCM_MANAGER_NAME,
} from '../utils/scmAssignee.js';
import { SASS_MUGESH_EMAIL } from './sassWorkflow.js';
import { getSlaWaitingDays, taskSlaBreachedSql } from '../utils/sla.js';

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

const LIVE_PR = `UPPER(TRIM(IFNULL(pr.status, ''))) NOT IN ('', 'DRAFT', 'CANCELLED')
  AND UPPER(IFNULL(pr.pr_number, '')) NOT LIKE 'DRAFT-%'`;
const NOT_DRAFT_PO = `LOWER(TRIM(IFNULL(po.status, ''))) <> 'draft'
  AND UPPER(IFNULL(po.po_number, '')) NOT LIKE 'DRAFT-%'
  AND IFNULL(po.po_number, '') NOT LIKE 'CS-%'
  AND (
    po.pr_id IS NULL
    OR EXISTS (
      SELECT 1 FROM purchase_requests pr_live
      WHERE pr_live.id = po.pr_id
        AND UPPER(TRIM(IFNULL(pr_live.status, ''))) NOT IN ('', 'DRAFT', 'CANCELLED')
        AND UPPER(IFNULL(pr_live.pr_number, '')) NOT LIKE 'DRAFT-%'
    )
  )`;
const PENDING_USER_TASK = `(
  (wt.task_type = 'PR_APPROVAL' AND wt.assigned_role IN ('HOD Approver', 'PR Manager'))
  OR wt.task_type = 'RFQ_ENTRY'
)`;
const NOT_RGML = `NOT (
  LOWER(IFNULL(po.entity, '')) LIKE '%rgml%'
  OR LOWER(IFNULL(po.entity, '')) LIKE '%green mobility%'
  OR EXISTS (
    SELECT 1 FROM entity_masters emx
    WHERE emx.id = po.entity_id
      AND (
        UPPER(IFNULL(emx.code, '')) = 'RGML'
        OR LOWER(IFNULL(emx.name, '')) LIKE '%green mobility%'
      )
  )
)`;

export async function loadP2pActivityReport(now = new Date()) {
  await ensureUserActivityLogsTable();
  const { start, end } = kolkataDayRange(now);

  const [[pr]] = await pool.query(
    `SELECT
       SUM(${LIVE_PR}) AS total_prs,
       SUM(${LIVE_PR} AND pr.created_at >= ? AND pr.created_at < ?) AS prs_today,
       COUNT(DISTINCT CASE WHEN ${LIVE_PR} THEN pr.requester_id END) AS requesters
     FROM purchase_requests pr`,
    [start, end]
  );

  const [[po]] = await pool.query(
    `SELECT
       SUM(${NOT_DRAFT_PO} AND LOWER(po.status) <> 'cancelled') AS total_pos,
       SUM(${NOT_DRAFT_PO} AND LOWER(po.status) <> 'cancelled' AND po.created_at >= ? AND po.created_at < ?) AS pos_today
     FROM purchase_orders po`,
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

  const [prEntityRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       COUNT(*) AS total_prs
     FROM purchase_requests pr
     LEFT JOIN entity_masters em ON em.id = pr.entity_id
     WHERE ${LIVE_PR}
     GROUP BY entity_id, entity_name, entity_code`
  );

  const [taskRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       COUNT(DISTINCT pr.id) AS pending_prs
     FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     LEFT JOIN entity_masters em ON em.id = pr.entity_id
     WHERE wt.status = 'pending'
       AND ${LIVE_PR}
       AND UPPER(TRIM(IFNULL(pr.status, ''))) <> 'REJECTED'
       AND (
         (wt.task_type = 'PR_APPROVAL' AND wt.assigned_role IN ('HOD Approver', 'PR Manager'))
         OR wt.task_type = 'RFQ_ENTRY'
       )
     GROUP BY entity_id, entity_name, entity_code`
  );

  const [[rajeevUser]] = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [DEFAULT_SCM_MANAGER_EMAIL]
  );
  const [[meetUser]] = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [RGML_SCM_MANAGER_EMAIL]
  );
  const [[mugeshUser]] = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [String(SASS_MUGESH_EMAIL).toLowerCase()]
  );
  const rajeevId = Number(rajeevUser?.id) || 0;
  const meetId = Number(meetUser?.id) || 0;
  const mugeshId = Number(mugeshUser?.id) || 0;

  const [poRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       SUM(
         po.po_number NOT LIKE 'CS-%'
         AND NOT EXISTS (
           SELECT 1 FROM purchase_requests pr_hide
           WHERE pr_hide.id = po.pr_id AND pr_hide.po_creation_by = 'requester'
         )
         AND (
           po.approval_manager_id = ?
           OR (po.approval_manager_id IS NULL AND ${NOT_RGML})
         )
         AND LOWER(po.status) NOT IN ('pending_approval', 'rejected')
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) IN (
           'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
           'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
         )
       ) AS rajeev_signed,
       SUM(
         (
           po.signer_id = ?
           OR LOWER(IFNULL(po.signature_name, '')) LIKE 'meet%'
         )
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
       ) AS meet_signed,
       SUM(
         (
           po.signer_id = ?
           OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mugesh%'
           OR (
             LOWER(IFNULL(po.po_sign_step, '')) = 'signed'
             AND LOWER(IFNULL(po.signature_name, '')) NOT LIKE 'meet%'
           )
         )
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
       ) AS mugesh_signed,
       SUM(u.role = 'SCM Buyer' AND ${NOT_DRAFT_PO} AND LOWER(po.status) NOT IN ('cancelled','rejected')) AS scm_buyer_pos
     FROM purchase_orders po
     LEFT JOIN users u ON u.id = po.created_by
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN entity_masters em ON em.id = COALESCE(po.entity_id, pr.entity_id)
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
     GROUP BY entity_id, entity_name, entity_code`,
    [rajeevId, meetId, mugeshId]
  );

  const [[rajeevCounts]] = await pool.query(
    `SELECT
       SUM(LOWER(po.status) = 'pending_approval') AS pending_pos,
       SUM(LOWER(po.status) NOT IN ('pending_approval', 'rejected')) AS approved_pos
     FROM purchase_orders po
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND po.po_number NOT LIKE 'CS-%'
       AND NOT EXISTS (
         SELECT 1 FROM purchase_requests pr_hide
         WHERE pr_hide.id = po.pr_id AND pr_hide.po_creation_by = 'requester'
       )
       AND (
         po.approval_manager_id = ?
         OR (po.approval_manager_id IS NULL AND ${NOT_RGML})
       )
       AND LOWER(po.status) IN (
         'pending_approval','pending_buyer_verify','approved','rejected',
         'sent_to_vendor','awaiting_grn','grn_completed','invoice_entry',
         'pending_accounts_approval','approved_for_payment','paid'
       )`,
    [rajeevId]
  );

  const entityMap = new Map();
  const entityKey = (row) => `${Number(row.entity_id) || 0}|${row.entity_name || 'Unassigned'}`;
  const blankEntity = (row) => ({
    name: row.entity_name || 'Unassigned',
    code: row.entity_code || '',
    totalPrs: 0,
    pendingPrs: 0,
    rajeevSigned: 0,
    meetSigned: 0,
    mugeshSigned: 0,
    scmBuyerPos: 0,
  });
  for (const row of [...prEntityRows, ...taskRows, ...poRows]) {
    const key = entityKey(row);
    if (!entityMap.has(key)) entityMap.set(key, blankEntity(row));
    const item = entityMap.get(key);
    if (row.total_prs != null) item.totalPrs = num(row.total_prs);
    if (row.pending_prs != null) item.pendingPrs = num(row.pending_prs);
    if (row.rajeev_signed != null) item.rajeevSigned = num(row.rajeev_signed);
    if (row.meet_signed != null) item.meetSigned = num(row.meet_signed);
    if (row.mugesh_signed != null) item.mugeshSigned = num(row.mugesh_signed);
    if (row.scm_buyer_pos != null) item.scmBuyerPos = num(row.scm_buyer_pos);
  }
  const entities = [...entityMap.values()]
    .map((row) => ({
      ...row,
      approvedPos: row.rajeevSigned + row.meetSigned + row.mugeshSigned,
    }))
    .filter(
      (row) =>
        row.totalPrs ||
        row.pendingPrs ||
        row.approvedPos ||
        row.scmBuyerPos
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (key) => entities.reduce((total, row) => total + row[key], 0);

  const slaSql = taskSlaBreachedSql('wt');
  const [activityRows] = await pool.query(
    `SELECT u.id, u.name, u.email,
            login.last_login,
            COUNT(DISTINCT CASE
              WHEN wt.status = 'pending' AND ${PENDING_USER_TASK} THEN pr.id
            END) AS pending_count,
            COUNT(DISTINCT CASE
              WHEN UPPER(pr.status) = 'APPROVED' THEN pr.id
            END) AS completed_count,
            COUNT(DISTINCT CASE
              WHEN wt.status = 'pending' AND ${PENDING_USER_TASK} AND ${slaSql} THEN pr.id
            END) AS sla_breached
     FROM users u
     JOIN purchase_requests pr ON pr.requester_id = u.id
       AND ${LIVE_PR}
     LEFT JOIN workflow_tasks wt ON wt.pr_id = pr.id
     LEFT JOIN (
       SELECT user_id, MAX(created_at) AS last_login
       FROM user_activity_logs
       WHERE action = 'login' AND user_id IS NOT NULL
       GROUP BY user_id
     ) login ON login.user_id = u.id
     GROUP BY u.id, u.name, u.email, login.last_login
     HAVING pending_count > 0 OR completed_count > 0
     ORDER BY pending_count DESC, completed_count DESC, u.name ASC
     LIMIT 40`
  );

  const [oldestRows] = await pool.query(
    `SELECT requester_id, created_at, holder
     FROM (
       SELECT pr.requester_id,
              wt.created_at,
              COALESCE(NULLIF(TRIM(au.name), ''), NULLIF(TRIM(wt.assigned_role), ''), 'Pending') AS holder,
              ROW_NUMBER() OVER (PARTITION BY pr.requester_id ORDER BY wt.created_at ASC, wt.id ASC) AS rn
       FROM workflow_tasks wt
       JOIN purchase_requests pr ON pr.id = wt.pr_id
       LEFT JOIN users au ON au.id = wt.assigned_user_id
       WHERE wt.status = 'pending'
         AND ${LIVE_PR}
         AND UPPER(TRIM(IFNULL(pr.status, ''))) <> 'REJECTED'
         AND ${PENDING_USER_TASK}
     ) ranked
     WHERE rn = 1`
  );
  const oldestByUser = new Map(
    oldestRows.map((row) => [Number(row.requester_id), row])
  );

  const activityUsers = activityRows.map((row) => {
    const oldest = oldestByUser.get(Number(row.id));
    const pending = num(row.pending_count);
    const days = oldest ? getSlaWaitingDays(oldest.created_at, now) : 0;
    const holder = oldest?.holder || '';
    return {
      name: row.name || row.email || 'User',
      email: row.email || '',
      lastLogin: formatActivityStamp(row.last_login),
      pending,
      completed: num(row.completed_count),
      pendingDuration: pending > 0 && holder ? `${days} days · ${holder}` : '—',
      slaBreached: num(row.sla_breached),
    };
  });

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    prsToday: num(pr?.prs_today),
    requesters: num(pr?.requesters),
    totalPos: num(po?.total_pos),
    posToday: num(po?.pos_today),
    totalUsers: num(users?.total_users),
    loggedToday: num(logins?.logged_today),
    pendingPrs: sum('pendingPrs'),
    approvedPos: sum('rajeevSigned') + sum('meetSigned') + sum('mugeshSigned'),
    scmBuyerPos: sum('scmBuyerPos'),
    rajeevName: rajeevUser?.name || DEFAULT_SCM_MANAGER_NAME,
    rajeevPending: num(rajeevCounts?.pending_pos),
    rajeevApproved: sum('rajeevSigned'),
    meetName: meetUser?.name || RGML_SCM_MANAGER_NAME,
    meetSigned: sum('meetSigned'),
    mugeshName: mugeshUser?.name || 'Mugesh M',
    mugeshSigned: sum('mugeshSigned'),
    entities,
    activityUsers,
  };
}

function formatActivityStamp(value) {
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

function activityRowsHtml(users) {
  if (!users.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">No user activity.</td></tr>`;
  }
  return users
    .map((user, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      const slaColor = user.slaBreached > 0 ? '#b42318' : '#1a1a1a';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 10px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(user.name)}</div>
<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(user.email)}</div>
</td>
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea; white-space:nowrap;">${escapeHtml(user.lastLogin)}</td>
<td style="padding:10px 8px; color:#9a7a3a; border-top:1px solid #ececea; font-weight:bold;" align="center">${user.pending}</td>
<td style="padding:10px 8px; color:#14503a; border-top:1px solid #ececea; font-weight:bold;" align="center">${user.completed}</td>
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(user.pendingDuration)}</td>
<td style="padding:10px 8px; color:${slaColor}; border-top:1px solid #ececea; font-weight:bold;" align="center">${user.slaBreached}</td>
</tr>`;
    })
    .join('');
}

function statCard({ width, value, label, sub, valueColor, labelColor, background, border }) {
  return `<td width="${width}" align="center" valign="top" style="background:${background} !important; border:1px solid ${border}; border-radius:8px; padding:14px 4px;">
<div style="font-size:18px; font-weight:bold; color:${valueColor} !important;">${escapeHtml(value)}</div>
<div style="font-size:10px; color:${labelColor} !important; margin-top:4px;">${escapeHtml(label)}</div>
<div style="font-size:9px; color:${labelColor} !important; margin-top:2px; line-height:1.25;">${sub || '&nbsp;'}</div>
</td>`;
}

function entityNameCell(row) {
  return `<td style="padding:10px 14px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(row.name)}</div>${
    row.code ? `<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(row.code)}</div>` : ''
  }</td>`;
}

function countCell(value, color) {
  return `<td style="padding:10px 8px; color:${color}; border-top:1px solid #ececea; font-weight:bold;" align="center">${value}</td>`;
}

function entityRows(entities) {
  const rows = entities.filter((row) => row.totalPrs || row.pendingPrs);
  if (!rows.length) {
    return `<tr><td colspan="3" style="padding:14px; color:#6b6b6b; background:#ffffff;">No entity activity.</td></tr>`;
  }
  return rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
${entityNameCell(row)}
${countCell(row.totalPrs, '#1a1a1a')}
${countCell(row.pendingPrs, '#9a7a3a')}
</tr>`;
    })
    .join('');
}

function poEntityRows(entities) {
  const rows = entities.filter(
    (row) => row.approvedPos || row.scmBuyerPos || row.rajeevSigned || row.meetSigned || row.mugeshSigned
  );
  if (!rows.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">No purchase orders.</td></tr>`;
  }
  return rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
${entityNameCell(row)}
${countCell(row.rajeevSigned, '#14503a')}
${countCell(row.meetSigned, '#14503a')}
${countCell(row.mugeshSigned, '#14503a')}
${countCell(row.approvedPos, '#14503a')}
${countCell(row.scmBuyerPos, '#3468a8')}
</tr>`;
    })
    .join('');
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
<table role="presentation" width="740" cellpadding="0" cellspacing="0" style="background-color:#ffffff !important; border-radius:10px; overflow:hidden;" bgcolor="#ffffff">

<tr><td style="background-color:#ffffff !important; padding:26px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="180" valign="middle">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refexone-logo.png" alt="refexOne" width="168" style="display:block; max-width:168px; height:auto;">
<img src="https://refexone.com/refexone-logo.png" alt="" width="1" height="1" style="display:none;max-height:0;overflow:hidden;">
</td>
<td valign="middle" style="padding-left:18px; border-left:1px solid #e5e5e0;">
<div style="font-size:18px; font-weight:bold; color:#1a1a1a !important;">P2P Procurement Report</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:4px;">Total PRs &middot; Pending PRs &middot; Signed POs</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:2px;">Generated ${escapeHtml(report.generatedAt)} &middot; Refex P2P only</div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:0; line-height:0;">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refex-shimmer-divider-green.gif" alt="" width="740" height="6" style="display:block; width:100%; height:6px; border:0;">
</td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Created today</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="48%" align="center" style="background:linear-gradient(180deg,#fffaf2 0%,#fdecd0 100%) !important; border:1px solid #f0d9a8; border-radius:10px; padding:26px 10px;">
<div style="font-size:30px; font-weight:bold; color:#9a7a3a !important;">${report.prsToday}</div>
<div style="font-size:12px; color:#9a7a3a !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">PRs Created Today</div></td>
<td width="4%"></td>
<td width="48%" align="center" style="background:linear-gradient(180deg,#f2f6fb 0%,#dfeafa 100%) !important; border:1px solid #bcd6f0; border-radius:10px; padding:26px 10px;">
<div style="font-size:30px; font-weight:bold; color:#3468a8 !important;">${report.posToday}</div>
<div style="font-size:12px; color:#3468a8 !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">POs Created Today</div></td>
</tr></table></td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Purchase requests</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.totalPrs,
  label: 'Total PRs',
  sub: 'Raised purchase requests',
  valueColor: '#1a1a1a',
  labelColor: '#5b7ba3',
  background: 'linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%)',
  border: '#dfe8f2',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.pendingPrs,
  label: 'Pending PRs',
  sub: 'L1, L2, and RFQ Entry',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
</tr></table></td></tr>

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Entity-wise count</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 14px; color:#ffffff !important; font-weight:bold;">Entity</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Total PRs</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Pending PRs</td>
</tr>
${entityRows(report.entities || [])}
</table></td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Purchase orders</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.approvedPos,
  label: 'Approved POs',
  sub: 'Rajeev + Meet + Mugesh',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.scmBuyerPos,
  label: 'SCM Buyer created',
  sub: 'Create PO by SCM Buyer',
  valueColor: '#3468a8',
  labelColor: '#5b7ba3',
  background: 'linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%)',
  border: '#dfe8f2',
})}
</tr></table></td></tr>

<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">PO count by entity</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 10px; color:#ffffff !important; font-weight:bold;">Entity</td>
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">Rajeev</td>
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">Meet</td>
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">Mugesh</td>
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">Approved</td>
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">SCM Buyer</td>
</tr>
${poEntityRows(report.entities || [])}
</table></td></tr>

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Signed POs</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.mugeshSigned,
  label: `${report.mugeshName} signed`,
  sub: 'POs he has signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.meetSigned,
  label: `${report.meetName} signed`,
  sub: 'POs he has signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
</tr></table></td></tr>

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">${escapeHtml(report.rajeevName)} — PO sign</td></tr>
<tr><td style="padding:10px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.rajeevPending,
  label: 'Pending',
  sub: 'Waiting for his sign',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.rajeevApproved,
  label: 'Approved',
  sub: 'Same as his sign page',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
</tr></table></td></tr>

<tr><td style="padding:26px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">User activity</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 10px; color:#ffffff !important; font-weight:bold;">User</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Last Signed In</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Pending</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Completed</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Pending Duration</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">SLA Breached</td>
</tr>
${activityRowsHtml(report.activityUsers || [])}
</table></td></tr>

<tr><td style="padding:4px 32px 24px 32px; font-size:11px; color:#a0a0a0 !important; line-height:1.6;" bgcolor="#ffffff">
Approved POs is Rajeev signed plus Meet signed plus Mugesh signed, and the entity table uses the same split. Created today is Asia/Kolkata. Pending on a user is their PRs waiting on L1 Manager, L2 Manager, or RFQ Entry.
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
    `PRs created today: ${report.prsToday}`,
    `POs created today: ${report.posToday}`,
    '',
    'User activity',
    ...(report.activityUsers || []).map(
      (user) =>
        `${user.name} | ${user.lastLogin} | pending ${user.pending} | completed ${user.completed} | ${user.pendingDuration} | SLA ${user.slaBreached}`
    ),
    '',
    `Total PRs: ${report.totalPrs}`,
    `Pending PRs: ${report.pendingPrs}`,
    `Approved POs: ${report.approvedPos}`,
    `SCM Buyer created POs: ${report.scmBuyerPos}`,
    `${report.mugeshName} signed POs: ${report.mugeshSigned}`,
    `${report.meetName} signed POs: ${report.meetSigned}`,
    `${report.rajeevName} pending POs: ${report.rajeevPending}`,
    `${report.rajeevName} approved POs: ${report.rajeevApproved}`,
    '',
    'Entity-wise',
    ...(report.entities || []).map(
      (row) =>
        `${row.name}${row.code ? ` (${row.code})` : ''}: PRs ${row.totalPrs}, pending PRs ${row.pendingPrs}, Rajeev ${row.rajeevSigned}, Meet ${row.meetSigned}, Mugesh ${row.mugeshSigned}, approved PO ${row.approvedPos}, SCM Buyer ${row.scmBuyerPos}`
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
      pendingPrs: report.pendingPrs,
      approvedPos: report.approvedPos,
      mugeshSigned: report.mugeshSigned,
      meetSigned: report.meetSigned,
      scmBuyerPos: report.scmBuyerPos,
      rajeevPending: report.rajeevPending,
      rajeevApproved: report.rajeevApproved,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
