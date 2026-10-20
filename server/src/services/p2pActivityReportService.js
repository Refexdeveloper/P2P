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

function statCell(label, value, note) {
  return `
    <td width="33%" style="padding:0 6px 12px 6px;vertical-align:top;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <tr>
          <td style="padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:700;margin-bottom:6px;">${escapeHtml(label)}</div>
            <div style="font-size:22px;color:#0f172a;font-weight:800;line-height:1.2;">${escapeHtml(value)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.4;">${escapeHtml(note)}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

function buyerRows(buyers) {
  if (!buyers.length) {
    return `<tr><td colspan="4" style="padding:14px 12px;font-size:13px;color:#64748b;">No SCM buyers.</td></tr>`;
  }
  return buyers
    .map(
      (buyer) => `<tr>
<td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;">
  <strong style="display:block;color:#111827;">${escapeHtml(buyer.name)}</strong>
  <span style="color:#6b7280;font-size:12px;">${escapeHtml(buyer.email)}</span>
</td>
<td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#111827;white-space:nowrap;">${escapeHtml(buyer.lastLogin)}</td>
<td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1d4ed8;font-weight:700;text-align:center;">${buyer.createdPos}</td>
<td style="padding:12px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#047857;font-weight:700;text-align:center;">${buyer.approvedPos}</td>
</tr>`
    )
    .join('');
}

export function buildP2pActivityReportEmail(report) {
  const subject = `RMC P2P Report — ${report.generatedAt}`;
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
              <div style="font-size:24px;color:#ffffff;font-weight:800;margin-top:8px;">RMC P2P Report</div>
              <div style="font-size:14px;color:#cbd5e1;margin-top:8px;line-height:1.5;">Main branch summary for ${escapeHtml(report.generatedAt)}. Draft and cancelled records are excluded.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 26px 8px 26px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${statCell('Total PRs', report.totalPrs, 'Draft and cancelled excluded')}
                  ${statCell('Total POs', report.totalPos, 'Cancelled POs excluded')}
                  ${statCell('Approved POs', report.approvedPos, 'Mounesh + Tarkesh signed')}
                </tr>
                <tr>
                  ${statCell(`${report.mouneshName} signed`, report.mouneshSigned, 'POs he has signed')}
                  ${statCell(`${report.tarkeshName} signed`, report.tarkeshSigned, 'POs he has signed')}
                  <td width="33%"></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px 32px;">
              <div style="font-size:13px;color:#0f172a;font-weight:700;margin-bottom:12px;">SCM buyer activity</div>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;border-radius:8px;border-collapse:collapse;overflow:hidden;background:#ffffff;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:left;">SCM Buyer</th>
                    <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:left;">Last signed in</th>
                    <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:center;">Created POs</th>
                    <th style="padding:12px 10px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e5e7eb;text-align:center;">Approved POs</th>
                  </tr>
                </thead>
                <tbody>
                  ${buyerRows(report.buyers)}
                </tbody>
              </table>
              <div style="font-size:12px;color:#64748b;margin-top:12px;line-height:1.5;">
                Approved POs are purchase orders signed by ${escapeHtml(report.mouneshName)} or ${escapeHtml(report.tarkeshName)}. Created POs and approved POs in the table are for each SCM buyer.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
              Thanks,<br/>
              <strong style="color:#0f172a;">P2P Procurement</strong>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
