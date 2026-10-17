import pool from '../config/db.js';
import { ensureUserActivityLogsTable } from './userActivityLogService.js';
import { sendMailToRecipients } from './emailService.js';
import { DEFAULT_SCM_MANAGER_EMAIL, DEFAULT_SCM_MANAGER_NAME } from '../utils/scmAssignee.js';

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

const APPROVED_PO = `LOWER(po.status) IN (
  'approved','sent_to_vendor','awaiting_grn','grn_completed','invoice_entry',
  'pending_accounts_approval','approved_for_payment','paid'
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

  const [taskRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       SUM(wt.task_type = 'PR_APPROVAL' AND wt.assigned_role = 'HOD Approver') AS l1_count,
       SUM(wt.task_type = 'PR_APPROVAL' AND wt.assigned_role = 'PR Manager') AS l2_count,
       SUM(wt.task_type = 'RFQ_ENTRY') AS rfq_count
     FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     LEFT JOIN entity_masters em ON em.id = pr.entity_id
     WHERE wt.status = 'pending'
       AND UPPER(pr.status) NOT IN ('DRAFT','CANCELLED','REJECTED')
       AND (
         (wt.task_type = 'PR_APPROVAL' AND wt.assigned_role IN ('HOD Approver', 'PR Manager'))
         OR wt.task_type = 'RFQ_ENTRY'
       )
     GROUP BY entity_id, entity_name, entity_code`
  );

  const [poRows] = await pool.query(
    `SELECT
       COALESCE(em.id, 0) AS entity_id,
       COALESCE(NULLIF(TRIM(em.name), ''), 'Unassigned') AS entity_name,
       COALESCE(em.code, '') AS entity_code,
       SUM(${APPROVED_PO}) AS approved_pos,
       SUM(u.role = 'SCM Buyer' AND LOWER(po.status) NOT IN ('draft','cancelled','rejected')) AS scm_buyer_pos
     FROM purchase_orders po
     LEFT JOIN users u ON u.id = po.created_by
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN entity_masters em ON em.id = COALESCE(po.entity_id, pr.entity_id)
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
     GROUP BY entity_id, entity_name, entity_code`
  );

  const [[rajeevUser]] = await pool.query(
    `SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [DEFAULT_SCM_MANAGER_EMAIL]
  );
  const rajeevId = Number(rajeevUser?.id) || 0;

  const [[rajeevCounts]] = await pool.query(
    `SELECT
       SUM(
         LOWER(po.status) = 'pending_approval'
         AND NOT EXISTS (
           SELECT 1 FROM purchase_requests pr_own
           WHERE pr_own.id = po.pr_id AND pr_own.po_creation_by = 'requester'
         )
         AND (
           po.approval_manager_id = ?
           OR (po.approval_manager_id IS NULL AND ${NOT_RGML})
         )
       ) AS pending_pos,
       SUM(
         po.signer_id = ?
         AND LOWER(po.status) NOT IN ('draft','cancelled','rejected','pending_approval')
       ) AS approved_pos
     FROM purchase_orders po
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'`,
    [rajeevId, rajeevId]
  );

  const entityMap = new Map();
  const entityKey = (row) => `${Number(row.entity_id) || 0}|${row.entity_name || 'Unassigned'}`;
  const blankEntity = (row) => ({
    name: row.entity_name || 'Unassigned',
    code: row.entity_code || '',
    l1: 0,
    l2: 0,
    rfqEntry: 0,
    approvedPos: 0,
    scmBuyerPos: 0,
  });
  for (const row of [...taskRows, ...poRows]) {
    const key = entityKey(row);
    if (!entityMap.has(key)) entityMap.set(key, blankEntity(row));
    const item = entityMap.get(key);
    if (row.l1_count != null) item.l1 = num(row.l1_count);
    if (row.l2_count != null) item.l2 = num(row.l2_count);
    if (row.rfq_count != null) item.rfqEntry = num(row.rfq_count);
    if (row.approved_pos != null) item.approvedPos = num(row.approved_pos);
    if (row.scm_buyer_pos != null) item.scmBuyerPos = num(row.scm_buyer_pos);
  }
  const entities = [...entityMap.values()]
    .filter((row) => row.l1 || row.l2 || row.rfqEntry || row.approvedPos || row.scmBuyerPos)
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (key) => entities.reduce((total, row) => total + row[key], 0);

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    prsToday: num(pr?.prs_today),
    requesters: num(pr?.requesters),
    totalPos: num(po?.total_pos),
    posToday: num(po?.pos_today),
    totalUsers: num(users?.total_users),
    loggedToday: num(logins?.logged_today),
    l1: sum('l1'),
    l2: sum('l2'),
    rfqEntry: sum('rfqEntry'),
    approvedPos: sum('approvedPos'),
    scmBuyerPos: sum('scmBuyerPos'),
    rajeevName: rajeevUser?.name || DEFAULT_SCM_MANAGER_NAME,
    rajeevPending: num(rajeevCounts?.pending_pos),
    rajeevApproved: num(rajeevCounts?.approved_pos),
    entities,
  };
}

function statCard({ width, value, label, sub, valueColor, labelColor, background, border }) {
  return `<td width="${width}" align="center" valign="top" style="background:${background} !important; border:1px solid ${border}; border-radius:8px; padding:14px 4px;">
<div style="font-size:18px; font-weight:bold; color:${valueColor} !important;">${escapeHtml(value)}</div>
<div style="font-size:10px; color:${labelColor} !important; margin-top:4px;">${escapeHtml(label)}</div>
<div style="font-size:9px; color:${labelColor} !important; margin-top:2px; line-height:1.25;">${sub || '&nbsp;'}</div>
</td>`;
}

function entityRows(entities) {
  if (!entities.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">No entity activity.</td></tr>`;
  }
  const cell = (value, color) =>
    `<td style="padding:10px 8px; color:${color}; border-top:1px solid #ececea; font-weight:bold;" align="center">${value}</td>`;
  return entities
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 14px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(row.name)}</div>${
        row.code ? `<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(row.code)}</div>` : ''
      }</td>
${cell(row.l1, '#9a7a3a')}
${cell(row.l2, '#9a7a3a')}
${cell(row.rfqEntry, '#3468a8')}
${cell(row.approvedPos, '#14503a')}
${cell(row.scmBuyerPos, '#14503a')}
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
<table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background-color:#ffffff !important; border-radius:10px; overflow:hidden;" bgcolor="#ffffff">

<tr><td style="background-color:#ffffff !important; padding:26px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td width="180" valign="middle">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refexone-logo.png" alt="refexOne" width="168" style="display:block; max-width:168px; height:auto;">
<img src="https://refexone.com/refexone-logo.png" alt="" width="1" height="1" style="display:none;max-height:0;overflow:hidden;">
</td>
<td valign="middle" style="padding-left:18px; border-left:1px solid #e5e5e0;">
<div style="font-size:18px; font-weight:bold; color:#1a1a1a !important;">P2P Procurement Report</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:4px;">L1 &middot; L2 &middot; RFQ Entry &middot; Purchase Order</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:2px;">Generated ${escapeHtml(report.generatedAt)} &middot; Refex P2P only</div>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:0; line-height:0;">
<img src="https://storage.googleapis.com/aasik-refex-report-assets/refex-shimmer-divider-green.gif" alt="" width="680" height="6" style="display:block; width:100%; height:6px; border:0;">
</td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">PR approval tasks</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '32%',
  value: report.l1,
  label: 'L1 Manager',
  sub: 'Pending approval tasks',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: report.l2,
  label: 'L2 Manager',
  sub: 'Pending approval tasks',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: report.rfqEntry,
  label: 'RFQ Entry',
  sub: 'Pending RFQ tasks',
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
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">L1</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">L2</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">RFQ Entry</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Approved PO</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">SCM Buyer PO</td>
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
  sub: 'Signed and approved',
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
  sub: 'POs he has signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
</tr></table></td></tr>

<tr><td style="padding:4px 32px 24px 32px; font-size:11px; color:#a0a0a0 !important; line-height:1.6;" bgcolor="#ffffff">
PR counts are open tasks only: L1 Manager, L2 Manager, and RFQ Entry. Approved POs are purchase orders already approved. SCM Buyer created is a PO raised from Create PO by an SCM Buyer. ${escapeHtml(report.rajeevName)} pending is a PO waiting for his sign. His approved count is a PO he has signed.
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
    `L1 Manager: ${report.l1}`,
    `L2 Manager: ${report.l2}`,
    `RFQ Entry: ${report.rfqEntry}`,
    `Approved POs: ${report.approvedPos}`,
    `SCM Buyer created POs: ${report.scmBuyerPos}`,
    `${report.rajeevName} pending POs: ${report.rajeevPending}`,
    `${report.rajeevName} approved POs: ${report.rajeevApproved}`,
    '',
    'Entity-wise',
    ...(report.entities || []).map(
      (row) =>
        `${row.name}${row.code ? ` (${row.code})` : ''}: L1 ${row.l1}, L2 ${row.l2}, RFQ Entry ${row.rfqEntry}, approved PO ${row.approvedPos}, SCM Buyer PO ${row.scmBuyerPos}`
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
      l1: report.l1,
      l2: report.l2,
      rfqEntry: report.rfqEntry,
      approvedPos: report.approvedPos,
      scmBuyerPos: report.scmBuyerPos,
      rajeevPending: report.rajeevPending,
      rajeevApproved: report.rajeevApproved,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
