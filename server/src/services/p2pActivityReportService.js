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
       SUM(${NOT_DRAFT_PO} AND LOWER(TRIM(IFNULL(po.status, ''))) <> 'cancelled') AS total_pos,
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
    totalPos: 0,
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
    if (row.total_pos != null) item.totalPos = num(row.total_pos);
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
        row.totalPos ||
        row.scmBuyerPos
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (key) => entities.reduce((total, row) => total + row[key], 0);

  const slaSql = taskSlaBreachedSql('wt');
  const [activityRows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role,
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
     JOIN (
       SELECT user_id, MAX(created_at) AS last_login
       FROM user_activity_logs
       WHERE action = 'login' AND user_id IS NOT NULL
       GROUP BY user_id
     ) login ON login.user_id = u.id
     LEFT JOIN purchase_requests pr ON pr.requester_id = u.id
       AND ${LIVE_PR}
     LEFT JOIN workflow_tasks wt ON wt.pr_id = pr.id
     WHERE u.is_active = 1
     GROUP BY u.id, u.name, u.email, u.role, login.last_login
     ORDER BY login.last_login DESC
     LIMIT 25`
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
      role: row.role || '',
      lastLogin: formatActivityStamp(row.last_login),
      pending,
      completed: num(row.completed_count),
      pendingDuration: pending > 0 && holder ? `${days} days · ${holder}` : '—',
      slaBreached: num(row.sla_breached),
    };
  });

  const [scmRows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role,
            login.last_login,
            SUM(
              ${NOT_DRAFT_PO}
              AND LOWER(po.status) = 'pending_approval'
            ) AS pending_count,
            SUM(
              ${NOT_DRAFT_PO}
              AND LOWER(po.status) IN (
                'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
                'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
              )
            ) AS completed_count,
            SUM(
              ${NOT_DRAFT_PO}
              AND LOWER(po.status) = 'pending_approval'
              AND DATE_ADD(po.created_at, INTERVAL 24 HOUR) < NOW()
            ) AS sla_breached
     FROM users u
     LEFT JOIN (
       SELECT user_id, MAX(created_at) AS last_login
       FROM user_activity_logs
       WHERE action = 'login' AND user_id IS NOT NULL
       GROUP BY user_id
     ) login ON login.user_id = u.id
     LEFT JOIN purchase_orders po ON po.created_by = u.id
       AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
     WHERE u.is_active = 1
       AND u.role IN ('SCM Buyer', 'SCM Manager')
     GROUP BY u.id, u.name, u.email, u.role, login.last_login
     ORDER BY login.last_login IS NULL, login.last_login DESC, u.name ASC`
  );

  const [scmOldestRows] = await pool.query(
    `SELECT created_by, created_at, holder
     FROM (
       SELECT po.created_by,
              po.created_at,
              COALESCE(NULLIF(TRIM(mgr.name), ''), 'SCM Manager') AS holder,
              ROW_NUMBER() OVER (PARTITION BY po.created_by ORDER BY po.created_at ASC, po.id ASC) AS rn
       FROM purchase_orders po
       LEFT JOIN users mgr ON mgr.id = po.approval_manager_id
       WHERE LOWER(po.status) = 'pending_approval'
         AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
     ) ranked
     WHERE rn = 1`
  );
  const oldestScmPo = new Map(scmOldestRows.map((row) => [Number(row.created_by), row]));

  const scmTeam = scmRows.map((row) => {
    const oldest = oldestScmPo.get(Number(row.id));
    const pending = num(row.pending_count);
    const days = oldest ? getSlaWaitingDays(oldest.created_at, now) : 0;
    const holder = oldest?.holder || '';
    return {
      name: row.name || row.email || 'User',
      email: row.email || '',
      role: row.role || '',
      lastLogin: formatActivityStamp(row.last_login),
      pending,
      completed: num(row.completed_count),
      pendingDuration: pending > 0 && holder ? `${days} days · ${holder}` : '—',
      slaBreached: num(row.sla_breached),
    };
  });

  const [vendorAcceptanceRows] = await pool.query(
    `SELECT po.po_number, po.vendor_name, po.purchase_type,
            COALESCE(po.vendor_notified_at, po.updated_at, po.created_at) AS waiting_since,
            COALESCE(pr.pr_number, '') AS pr_number,
            COALESCE(req.id, creator.id, 0) AS owner_id,
            COALESCE(NULLIF(TRIM(req.name), ''), NULLIF(TRIM(creator.name), ''), 'Unassigned') AS owner_name,
            COALESCE(NULLIF(TRIM(req.email), ''), NULLIF(TRIM(creator.email), ''), '') AS owner_email
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN users req ON req.id = pr.requester_id
     LEFT JOIN users creator ON creator.id = po.created_by
     WHERE COALESCE(po.vendor_acceptance_status, 'pending') = 'pending'
       AND (
         po.status = 'sent_to_vendor'
         OR (
           po.status = 'awaiting_grn'
           AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id)
         )
       )
       AND ${NOT_DRAFT_PO}
     ORDER BY waiting_since ASC, po.id ASC`
  );

  const [grnPendingRows] = await pool.query(
    `SELECT po.po_number, po.vendor_name,
            COALESCE(po.vendor_accepted_at, po.updated_at, po.created_at) AS waiting_since,
            COALESCE(pr.pr_number, '') AS pr_number,
            COALESCE(req.id, creator.id, 0) AS owner_id,
            COALESCE(NULLIF(TRIM(req.name), ''), NULLIF(TRIM(creator.name), ''), 'Unassigned') AS owner_name,
            COALESCE(NULLIF(TRIM(req.email), ''), NULLIF(TRIM(creator.email), ''), '') AS owner_email
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN users req ON req.id = pr.requester_id
     LEFT JOIN users creator ON creator.id = po.created_by
     LEFT JOIN grn_headers g ON g.po_id = po.id
     WHERE po.purchase_type = 'purchase_order'
       AND po.status = 'awaiting_grn'
       AND g.id IS NULL
       AND COALESCE(po.vendor_acceptance_status, '') = 'accepted'
       AND ${NOT_DRAFT_PO}
     ORDER BY waiting_since ASC, po.id ASC`
  );

  const [invoiceEntryRows] = await pool.query(
    `SELECT po.po_number, po.vendor_name, po.purchase_type,
            COALESCE(po.updated_at, po.created_at) AS waiting_since,
            COALESCE(pr.pr_number, '') AS pr_number,
            COALESCE(req.id, creator.id, 0) AS owner_id,
            COALESCE(NULLIF(TRIM(req.name), ''), NULLIF(TRIM(creator.name), ''), 'Unassigned') AS owner_name,
            COALESCE(NULLIF(TRIM(req.email), ''), NULLIF(TRIM(creator.email), ''), '') AS owner_email
     FROM purchase_orders po
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN users req ON req.id = pr.requester_id
     LEFT JOIN users creator ON creator.id = po.created_by
     WHERE LOWER(po.status) = 'invoice_entry'
       AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
     ORDER BY waiting_since ASC, po.id ASC`
  );

  const mapPendingTask = (row) => ({
    poNumber: row.po_number || '',
    prNumber: row.pr_number || '',
    vendor: row.vendor_name || '',
    docType: String(row.purchase_type || 'purchase_order') === 'work_order' ? 'WO' : 'PO',
    ownerName: row.owner_name || 'Unassigned',
    ownerEmail: row.owner_email || '',
    waiting: `${getSlaWaitingDays(row.waiting_since, now)} days`,
  });
  const vendorAcceptanceTasks = vendorAcceptanceRows.map(mapPendingTask);
  const grnPendingTasks = grnPendingRows.map((row) => mapPendingTask({ ...row, purchase_type: 'purchase_order' }));
  const invoiceEntryTasks = invoiceEntryRows.map(mapPendingTask);

  const ownerMap = new Map();
  const ownerKey = (row) => {
    const email = String(row.ownerEmail || '').trim().toLowerCase();
    return email || row.ownerName || 'Unassigned';
  };
  const touchOwner = (task) => {
    const key = ownerKey(task);
    if (!ownerMap.has(key)) {
      ownerMap.set(key, {
        name: task.ownerName || 'Unassigned',
        email: task.ownerEmail || '',
        vendorAcceptance: 0,
        grnPending: 0,
        invoiceEntry: 0,
      });
    }
    return ownerMap.get(key);
  };
  for (const task of vendorAcceptanceTasks) touchOwner(task).vendorAcceptance += 1;
  for (const task of grnPendingTasks) touchOwner(task).grnPending += 1;
  for (const task of invoiceEntryTasks) touchOwner(task).invoiceEntry += 1;
  const requesterPending = [...ownerMap.values()]
    .map((row) => ({
      ...row,
      total: row.vendorAcceptance + row.grnPending + row.invoiceEntry,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const [approvedStageRows] = await pool.query(
    `SELECT stage, SUM(in_card) AS in_card, SUM(card_slots) AS card_slots, SUM(on_acceptance_list) AS on_acceptance_list
     FROM (
       SELECT
         CASE
           WHEN LOWER(po.status) = 'pending_buyer_verify' THEN 'buyer_verify'
           WHEN LOWER(po.status) = 'approved' THEN 'pending_release'
           WHEN LOWER(po.status) = 'sent_to_vendor'
             AND COALESCE(po.vendor_acceptance_status, 'pending') = 'pending' THEN 'vendor_acceptance'
           WHEN LOWER(po.status) = 'sent_to_vendor' THEN 'vendor_closed'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL
             AND COALESCE(po.purchase_type, 'purchase_order') = 'purchase_order'
             AND COALESCE(po.vendor_acceptance_status, '') = 'accepted' THEN 'grn_pending'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL THEN 'vendor_acceptance'
           WHEN LOWER(po.status) IN (
             'awaiting_grn','grn_completed','invoice_entry',
             'pending_accounts_approval','approved_for_payment','paid'
           ) THEN 'after_grn'
           ELSE 'other'
         END AS stage,
         (
           (
             po.po_number NOT LIKE 'CS-%'
             AND NOT EXISTS (
               SELECT 1 FROM purchase_requests pr_hide
               WHERE pr_hide.id = po.pr_id AND pr_hide.po_creation_by = 'requester'
             )
             AND (
               po.approval_manager_id = ?
               OR (po.approval_manager_id IS NULL AND ${NOT_RGML})
             )
             AND LOWER(po.status) IN (
               'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
               'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
             )
           )
           OR (
             (po.signer_id = ? OR LOWER(IFNULL(po.signature_name, '')) LIKE 'meet%')
             AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
           )
           OR (
             (
               po.signer_id = ?
               OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mugesh%'
               OR (
                 LOWER(IFNULL(po.po_sign_step, '')) = 'signed'
                 AND LOWER(IFNULL(po.signature_name, '')) NOT LIKE 'meet%'
               )
             )
             AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
           )
         ) AS in_card,
         (
           (
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
             AND LOWER(po.status) IN (
               'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
               'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
             )
           )
           + (
             (po.signer_id = ? OR LOWER(IFNULL(po.signature_name, '')) LIKE 'meet%')
             AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
           )
           + (
             (
               po.signer_id = ?
               OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mugesh%'
               OR (
                 LOWER(IFNULL(po.po_sign_step, '')) = 'signed'
                 AND LOWER(IFNULL(po.signature_name, '')) NOT LIKE 'meet%'
               )
             )
             AND LOWER(po.status) NOT IN ('cancelled','rejected','pending_approval')
           )
         ) AS card_slots,
         (
           LOWER(po.status) = 'sent_to_vendor'
           AND COALESCE(po.vendor_acceptance_status, 'pending') = 'pending'
         ) AS on_acceptance_list
       FROM purchase_orders po
       LEFT JOIN grn_headers g ON g.po_id = po.id
       WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
         AND LOWER(TRIM(IFNULL(po.status, ''))) NOT IN ('draft', 'cancelled', 'rejected', 'pending_approval')
     ) staged
     GROUP BY stage`,
    [rajeevId, meetId, mugeshId, rajeevId, meetId, mugeshId]
  );

  const stageLabels = [
    ['buyer_verify', 'Buyer final verify — signed, not released'],
    ['pending_release', 'Approved — waiting for release'],
    ['vendor_acceptance', 'Vendor acceptance pending — released, next step'],
    ['vendor_closed', 'Released, acceptance already recorded'],
    ['grn_pending', 'GRN pending — acceptance done'],
    ['after_grn', 'GRN done, invoice, or payment'],
    ['other', 'Other signed status'],
  ];
  const stageByKey = new Map(approvedStageRows.map((row) => [row.stage, row]));
  const approvedStages = stageLabels
    .map(([key, label]) => ({
      key,
      label,
      count: num(stageByKey.get(key)?.in_card),
    }))
    .filter((row) => row.count > 0);
  const approvedUnique = approvedStages.reduce((total, row) => total + row.count, 0);
  const approvedCardSlots = approvedStageRows.reduce((total, row) => total + num(row.card_slots), 0);
  const vendorAcceptanceOnSigned = num(stageByKey.get('vendor_acceptance')?.in_card);
  const vendorAcceptanceAll = approvedStageRows.reduce((total, row) => total + num(row.on_acceptance_list), 0);

  const [poStageRows] = await pool.query(
    `SELECT stage, COUNT(*) AS pos
     FROM (
       SELECT
         CASE
           WHEN LOWER(po.status) = 'pending_buyer_verify' THEN 'buyer_verify'
           WHEN LOWER(po.status) = 'approved' THEN 'pending_release'
           WHEN LOWER(po.status) = 'sent_to_vendor'
             AND COALESCE(po.vendor_acceptance_status, 'pending') = 'pending' THEN 'vendor_acceptance'
           WHEN LOWER(po.status) = 'sent_to_vendor' THEN 'vendor_recorded'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL
             AND COALESCE(po.purchase_type, 'purchase_order') = 'purchase_order'
             AND COALESCE(po.vendor_acceptance_status, '') = 'accepted' THEN 'grn_pending'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL THEN 'vendor_acceptance'
           WHEN LOWER(po.status) = 'invoice_entry' THEN 'invoice_entry'
           WHEN LOWER(po.status) IN ('grn_completed', 'pending_accounts_approval', 'approved_for_payment')
             OR (LOWER(po.status) = 'awaiting_grn' AND g.id IS NOT NULL) THEN 'accounts'
           WHEN LOWER(po.status) = 'paid' THEN 'paid'
           ELSE 'other'
         END AS stage
       FROM purchase_orders po
       LEFT JOIN grn_headers g ON g.po_id = po.id
       WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) IN (
           'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
           'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
         )
     ) staged
     GROUP BY stage`
  );
  const poStageLabels = [
    ['buyer_verify', 'Buyer final verify'],
    ['pending_release', 'Waiting for release'],
    ['vendor_acceptance', 'Vendor PO acceptance'],
    ['vendor_recorded', 'Vendor acceptance recorded'],
    ['grn_pending', 'GRN'],
    ['invoice_entry', 'Invoice entry'],
    ['accounts', 'Accounts / payment'],
    ['paid', 'Paid'],
    ['other', 'Other'],
  ];
  const poStageByKey = new Map(poStageRows.map((row) => [row.stage, num(row.pos)]));
  const poStages = poStageLabels
    .map(([key, label]) => ({ key, label, count: poStageByKey.get(key) || 0 }))
    .filter((row) => row.count > 0);

  const [signerRows] = await pool.query(
    `SELECT po.po_number,
            COALESCE(NULLIF(TRIM(em.name), ''), NULLIF(TRIM(po.entity), ''), '') AS entity_name,
            COALESCE(NULLIF(TRIM(po.signature_name), ''), NULLIF(TRIM(signer.name), ''), 'Not signed yet') AS signer_label,
            (
              po.signer_id = ?
              OR LOWER(IFNULL(po.signature_name, '')) LIKE 'rajeev%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'rajeev%'
              OR LOWER(IFNULL(signer.name, '')) LIKE 'rajeev%'
            ) AS is_rajeev,
            (
              po.signer_id = ?
              OR LOWER(IFNULL(po.signature_name, '')) LIKE 'meet%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'meet.%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'meet@%'
              OR LOWER(IFNULL(signer.name, '')) LIKE 'meet%'
            ) AS is_meet,
            (
              po.signer_id = ?
              OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mugesh%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'mugesh%'
              OR LOWER(IFNULL(signer.name, '')) LIKE 'mugesh%'
            ) AS is_mugesh
     FROM purchase_orders po
     LEFT JOIN users signer ON signer.id = po.signer_id
     LEFT JOIN entity_masters em ON em.id = po.entity_id
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND LOWER(po.status) IN (
         'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
         'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
       )`,
    [rajeevId, meetId, mugeshId]
  );
  const signedBy = {
    rajeev: 0,
    mugesh: 0,
    meet: 0,
    overlap: 0,
    remaining: [],
  };
  for (const row of signerRows) {
    const flags = [row.is_rajeev, row.is_mugesh, row.is_meet].filter((flag) => Number(flag) === 1).length;
    if (Number(row.is_rajeev) === 1) signedBy.rajeev += 1;
    if (Number(row.is_mugesh) === 1) signedBy.mugesh += 1;
    if (Number(row.is_meet) === 1) signedBy.meet += 1;
    if (flags > 1) signedBy.overlap += 1;
    if (flags === 0) {
      signedBy.remaining.push({
        poNumber: row.po_number || '',
        signer: row.signer_label || 'Not signed yet',
        entity: row.entity_name || '',
      });
    }
  }
  signedBy.remaining.sort((a, b) => a.signer.localeCompare(b.signer) || a.poNumber.localeCompare(b.poNumber));

  const [[vendorScreen]] = await pool.query(
    `SELECT
       SUM(bucket = 'pending') AS pending_count,
       SUM(bucket = 'accepted') AS accepted_count,
       SUM(bucket = 'rejected') AS rejected_count,
       SUM(bucket = 'partial') AS partial_count,
       SUM(bucket = 'outside') AS outside_count
     FROM (
       SELECT
         CASE
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'accepted' THEN 'accepted'
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'rejected' THEN 'rejected'
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'partial' THEN 'partial'
           WHEN LOWER(po.status) = 'sent_to_vendor' THEN 'pending'
           WHEN LOWER(po.status) = 'awaiting_grn'
             AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id) THEN 'pending'
           ELSE 'outside'
         END AS bucket
       FROM purchase_orders po
       WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) IN (
           'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
           'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
         )
     ) buckets`
  );
  const [vendorOutsideRows] = await pool.query(
    `SELECT po.po_number,
       CASE
         WHEN LOWER(po.status) = 'pending_buyer_verify' THEN 'Buyer final verify — not sent to the vendor yet'
         WHEN LOWER(po.status) = 'approved' THEN 'Approved — waiting for release to the vendor'
         WHEN LOWER(po.status) = 'awaiting_grn' THEN 'Vendor acceptance pending'
         WHEN LOWER(po.status) = 'invoice_entry' THEN 'Invoice entry — vendor acceptance was not recorded'
         WHEN LOWER(po.status) IN ('grn_completed', 'pending_accounts_approval', 'approved_for_payment')
           THEN 'Accounts / payment — vendor acceptance was not recorded'
         WHEN LOWER(po.status) = 'paid' THEN 'Paid — vendor acceptance was not recorded'
         ELSE LOWER(po.status)
       END AS stage_label
     FROM purchase_orders po
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND LOWER(po.status) IN (
         'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed',
         'invoice_entry','pending_accounts_approval','approved_for_payment','paid'
       )
       AND COALESCE(po.vendor_acceptance_status, '') NOT IN ('accepted', 'rejected', 'partial')
       AND LOWER(po.status) <> 'sent_to_vendor'
       AND NOT (
         LOWER(po.status) = 'awaiting_grn'
         AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id)
       )
     ORDER BY stage_label, po.po_number`
  );

  return {
    generatedAt: formatReportDate(now),
    totalPrs: num(pr?.total_prs),
    prsToday: num(pr?.prs_today),
    requesters: num(pr?.requesters),
    posToday: num(po?.pos_today),
    totalUsers: num(users?.total_users),
    loggedToday: num(logins?.logged_today),
    pendingPrs: sum('pendingPrs'),
    totalPos: sum('totalPos'),
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
    scmTeam,
    vendorAcceptancePending: vendorAcceptanceTasks.length,
    grnPending: grnPendingTasks.length,
    invoiceEntryPending: invoiceEntryTasks.length,
    approvedStages,
    approvedUnique,
    approvedCardSlots,
    vendorAcceptanceOnSigned,
    vendorAcceptanceOutsideSigned: Math.max(0, vendorAcceptanceAll - vendorAcceptanceOnSigned),
    requesterPending,
    vendorAcceptanceTasks,
    grnPendingTasks,
    invoiceEntryTasks,
    poStages,
    signedBy,
    vendorScreen: {
      pending: num(vendorScreen?.pending_count),
      accepted: num(vendorScreen?.accepted_count),
      rejected: num(vendorScreen?.rejected_count),
      partial: num(vendorScreen?.partial_count),
      outside: num(vendorScreen?.outside_count),
      outsideOrders: vendorOutsideRows.map((row) => ({
        poNumber: row.po_number || '',
        stage: row.stage_label || '',
      })),
    },
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

function activityRowsHtml(users, emptyLabel = 'No recent logins.') {
  if (!users.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">${escapeHtml(emptyLabel)}</td></tr>`;
  }
  return users
    .map((user, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      const slaColor = user.slaBreached > 0 ? '#b42318' : '#1a1a1a';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 10px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(user.name)}</div>
<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(user.role || 'User')} · ${escapeHtml(user.email)}</div>
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
    (row) => row.totalPos || row.approvedPos || row.scmBuyerPos || row.rajeevSigned || row.meetSigned || row.mugeshSigned
  );
  if (!rows.length) {
    return `<tr><td colspan="7" style="padding:14px; color:#6b6b6b; background:#ffffff;">No purchase orders.</td></tr>`;
  }
  return rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
${entityNameCell(row)}
${countCell(row.rajeevSigned, '#14503a')}
${countCell(row.meetSigned, '#14503a')}
${countCell(row.mugeshSigned, '#14503a')}
${countCell(row.totalPos, '#1a1a1a')}
${countCell(row.approvedPos, '#14503a')}
${countCell(row.scmBuyerPos, '#3468a8')}
</tr>`;
    })
    .join('');
}

function approvedStageRowsHtml(stages) {
  if (!stages.length) {
    return `<tr><td colspan="2" style="padding:14px; color:#6b6b6b; background:#ffffff;">No signed purchase orders.</td></tr>`;
  }
  return stages
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      const color = row.key === 'vendor_acceptance' ? '#9a7a3a' : '#1a1a1a';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(row.label)}</td>
<td style="padding:10px 8px; color:${color}; border-top:1px solid #ececea; font-weight:bold;" align="center">${row.count}</td>
</tr>`;
    })
    .join('');
}

function pendingOwnerRows(owners) {
  if (!owners.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">No pending vendor acceptance, GRN, or invoice entry.</td></tr>`;
  }
  return owners
    .map((row, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 10px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(row.name)}</div>
</td>
<td style="padding:10px 8px; color:#5b5b5b; border-top:1px solid #ececea;">${escapeHtml(row.email || '—')}</td>
${countCell(row.vendorAcceptance, '#9a7a3a')}
${countCell(row.grnPending, '#3468a8')}
${countCell(row.invoiceEntry, '#6b4c9a')}
${countCell(row.total, '#1a1a1a')}
</tr>`;
    })
    .join('');
}

function pendingTaskRows(tasks, emptyLabel) {
  if (!tasks.length) {
    return `<tr><td colspan="6" style="padding:14px; color:#6b6b6b; background:#ffffff;">${escapeHtml(emptyLabel)}</td></tr>`;
  }
  const shown = tasks.slice(0, 40);
  const rows = shown
    .map((task, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea; font-weight:bold; white-space:nowrap;">${escapeHtml(task.poNumber)}</td>
<td style="padding:10px 8px; color:#5b5b5b; border-top:1px solid #ececea;">${escapeHtml(task.prNumber || '—')}</td>
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(task.vendor || '—')}</td>
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea;">
<div style="font-weight:bold;">${escapeHtml(task.ownerName)}</div>
<div style="font-size:11px; color:#8a8a8a;">${escapeHtml(task.ownerEmail || '—')}</div>
</td>
<td style="padding:10px 8px; color:#1a1a1a; border-top:1px solid #ececea;" align="center">${escapeHtml(task.docType || 'PO')}</td>
<td style="padding:10px 8px; color:#9a7a3a; border-top:1px solid #ececea; font-weight:bold; white-space:nowrap;">${escapeHtml(task.waiting)}</td>
</tr>`;
    })
    .join('');
  if (tasks.length <= shown.length) return rows;
  return `${rows}<tr><td colspan="6" style="padding:10px 8px; color:#6b6b6b; background:#ffffff;">Showing ${shown.length} of ${tasks.length}.</td></tr>`;
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
  value: report.totalPos,
  label: 'Total POs',
  sub: 'Cancelled POs excluded',
  valueColor: '#1a1a1a',
  labelColor: '#5b7ba3',
  background: 'linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%)',
  border: '#dfe8f2',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.approvedPos,
  label: 'Approved POs',
  sub: 'Every signed order, all later steps',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
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
<td style="padding:12px 6px; color:#ffffff !important; font-weight:bold;" align="center">Total POs</td>
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

<tr><td style="padding:26px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Requester pending tasks</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.vendorAcceptancePending || 0,
  label: 'Vendor PO acceptance pending',
  sub: 'Waiting for the requester',
  valueColor: '#9a7a3a',
  labelColor: '#9a7a3a',
  background: 'linear-gradient(180deg,#fffaf2 0%,#fef3e2 100%)',
  border: '#f2e2c4',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: report.grnPending || 0,
  label: 'GRN pending',
  sub: 'Accepted, goods receipt not entered',
  valueColor: '#3468a8',
  labelColor: '#3468a8',
  background: 'linear-gradient(180deg,#f2f6fb 0%,#dfeafa 100%)',
  border: '#bcd6f0',
})}
</tr></table></td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '48%',
  value: report.invoiceEntryPending || 0,
  label: 'Invoice entry pending',
  sub: 'GRN done, or WO accepted — invoice not entered',
  valueColor: '#6b4c9a',
  labelColor: '#6b4c9a',
  background: 'linear-gradient(180deg,#f7f4fb 0%,#ece4f6 100%)',
  border: '#ddd0ee',
})}
<td width="4%"></td>
${statCard({
  width: '48%',
  value: (report.vendorAcceptancePending || 0) + (report.grnPending || 0) + (report.invoiceEntryPending || 0),
  label: 'Current pending',
  sub: 'Acceptance + GRN + invoice entry',
  valueColor: '#1a1a1a',
  labelColor: '#5b7ba3',
  background: 'linear-gradient(180deg,#ffffff 0%,#f2f6fb 100%)',
  border: '#dfe8f2',
})}
</tr></table></td></tr>

<tr><td style="padding:16px 32px 4px 32px; font-size:13px; line-height:1.55; color:#3a3a3a !important;" bgcolor="#ffffff">
Approved POs is every signed order (Rajeev + Meet + Mugesh). Vendor acceptance is only the next step after buyer final verify, while acceptance is still open. Orders still with the buyer, and orders already in GRN, invoice, or payment, stay in Approved and are not in that pending count.
</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">Where the signed POs are now</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Count</td>
</tr>
${approvedStageRowsHtml(report.approvedStages || [])}
<tr style="background:#f4fbf5;" bgcolor="#f4fbf5">
<td style="padding:10px 12px; color:#14503a; border-top:1px solid #c7ead4; font-weight:bold;">Signed POs, each order once</td>
<td style="padding:10px 8px; color:#14503a; border-top:1px solid #c7ead4; font-weight:bold;" align="center">${report.approvedUnique || 0}</td>
</tr>
</table>
<div style="font-size:12px; color:#5b5b5b; margin-top:8px; line-height:1.5;">
Approved card is ${report.approvedPos}. Counted once, the same signed orders are ${report.approvedUnique || 0}. Vendor acceptance pending inside those signed orders is ${report.vendorAcceptanceOnSigned || 0}. The acceptance list below is ${report.vendorAcceptancePending || 0}${
    report.vendorAcceptanceOutsideSigned
      ? `, including ${report.vendorAcceptanceOutsideSigned} not in the Approved card`
      : ''
  }.
</div>
</td></tr>

<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Count by requester</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 10px; color:#ffffff !important; font-weight:bold;">Requester</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Email</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Vendor acceptance</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">GRN pending</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Invoice entry</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Total</td>
</tr>
${pendingOwnerRows(report.requesterPending || [])}
</table></td></tr>

<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Vendor PO acceptance pending</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">PO / WO</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">PR</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Vendor</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Requester</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Type</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Waiting</td>
</tr>
${pendingTaskRows(report.vendorAcceptanceTasks || [], 'No vendor PO acceptance is pending.')}
</table></td></tr>

<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">GRN pending</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">PO</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">PR</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Vendor</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Requester</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Type</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Waiting</td>
</tr>
${pendingTaskRows(report.grnPendingTasks || [], 'No GRN is pending.')}
</table></td></tr>

<tr><td style="padding:26px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Recent login</td></tr>
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

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">SCM team activity</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 10px; color:#ffffff !important; font-weight:bold;">SCM Buyer / Manager</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Last Signed In</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Pending</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Completed</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Pending Duration</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">SLA Breached</td>
</tr>
${activityRowsHtml(report.scmTeam || [], 'No SCM team activity.')}
</table></td></tr>

<tr><td style="padding:4px 32px 24px 32px; font-size:11px; color:#a0a0a0 !important; line-height:1.6;" bgcolor="#ffffff">
Total POs leaves out draft and cancelled purchase orders. Approved POs is Rajeev signed plus Meet signed plus Mugesh signed. Cancelled POs are not in either count.
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
    'Recent login',
    ...(report.activityUsers || []).map(
      (user) =>
        `${user.name} (${user.role}) | ${user.lastLogin} | pending ${user.pending} | completed ${user.completed} | ${user.pendingDuration} | SLA ${user.slaBreached}`
    ),
    '',
    'SCM team activity',
    ...(report.scmTeam || []).map(
      (user) =>
        `${user.name} (${user.role}) | ${user.lastLogin} | pending ${user.pending} | completed ${user.completed} | ${user.pendingDuration} | SLA ${user.slaBreached}`
    ),
    '',
    `Total PRs: ${report.totalPrs}`,
    `Pending PRs: ${report.pendingPrs}`,
    `Total POs: ${report.totalPos}`,
    `Approved POs: ${report.approvedPos}`,
    `SCM Buyer created POs: ${report.scmBuyerPos}`,
    `${report.mugeshName} signed POs: ${report.mugeshSigned}`,
    `${report.meetName} signed POs: ${report.meetSigned}`,
    `${report.rajeevName} pending POs: ${report.rajeevPending}`,
    `${report.rajeevName} approved POs: ${report.rajeevApproved}`,
    '',
    `Vendor PO acceptance pending: ${report.vendorAcceptancePending || 0}`,
    `GRN pending: ${report.grnPending || 0}`,
    `Invoice entry pending: ${report.invoiceEntryPending || 0}`,
    'Approved POs is every signed order. Vendor acceptance is only the step after buyer final verify.',
    ...(report.approvedStages || []).map((row) => `${row.label}: ${row.count}`),
    `Signed POs, each order once: ${report.approvedUnique || 0}`,
    `Approved card (Rajeev + Meet + Mugesh): ${report.approvedPos}`,
    `Vendor acceptance inside signed POs: ${report.vendorAcceptanceOnSigned || 0}`,
    '',
    'Count by requester',
    ...(report.requesterPending || []).map(
      (row) =>
        `${row.name} <${row.email || 'no email'}>: vendor acceptance ${row.vendorAcceptance}, GRN pending ${row.grnPending}, invoice entry ${row.invoiceEntry}, total ${row.total}`
    ),
    '',
    'Vendor PO acceptance pending list',
    ...(report.vendorAcceptanceTasks || []).map(
      (task) =>
        `${task.poNumber} | ${task.prNumber || '—'} | ${task.vendor || '—'} | ${task.ownerName} <${task.ownerEmail || 'no email'}> | ${task.waiting}`
    ),
    '',
    'GRN pending list',
    ...(report.grnPendingTasks || []).map(
      (task) =>
        `${task.poNumber} | ${task.prNumber || '—'} | ${task.vendor || '—'} | ${task.ownerName} <${task.ownerEmail || 'no email'}> | ${task.waiting}`
    ),
    '',
    'Entity-wise',
    ...(report.entities || []).map(
      (row) =>
        `${row.name}${row.code ? ` (${row.code})` : ''}: PRs ${row.totalPrs}, pending PRs ${row.pendingPrs}, total POs ${row.totalPos}, Rajeev ${row.rajeevSigned}, Meet ${row.meetSigned}, Mugesh ${row.mugeshSigned}, approved PO ${row.approvedPos}, SCM Buyer ${row.scmBuyerPos}`
    ),
  ].join('\n');

  return { subject, html, text };
}

function stageCount(stages, keys) {
  const wanted = new Set(keys);
  return stages.reduce((total, row) => total + (wanted.has(row.key) ? Number(row.count) || 0 : 0), 0);
}

function balanceRowsHtml(rows) {
  return rows
    .map((row, index) => {
      const bg = row.total ? '#f4fbf5' : index % 2 === 0 ? '#ffffff' : '#f7f8f6';
      const weight = row.total ? 'font-weight:bold;' : '';
      const color = row.total ? '#14503a' : '#1a1a1a';
      return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 12px; color:${color}; border-top:1px solid #ececea; ${weight}">${escapeHtml(row.label)}</td>
<td style="padding:10px 8px; color:${color}; border-top:1px solid #ececea; ${weight}" align="center">${row.count}</td>
</tr>`;
    })
    .join('');
}

function namedBalanceHtml(title, items) {
  const total = items.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  return `<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">${escapeHtml(title)}</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">${escapeHtml(title)}</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Count</td>
</tr>
${balanceRowsHtml([
  ...items,
  { label: 'Total', count: total, total: true },
])}
</table></td></tr>`;
}

function stepBalanceHtml(title, pending, completed, total, extraRows = []) {
  const left = Math.max(0, total - pending - completed);
  return `<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">${escapeHtml(title)}</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">${escapeHtml(title)}</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Count</td>
</tr>
${balanceRowsHtml([
  { label: 'Pending', count: pending },
  ...extraRows,
  { label: 'Completed', count: completed },
  { label: 'Remaining', count: left },
  { label: 'Total', count: total, total: true },
])}
</table></td></tr>`;
}

export function buildP2pPendingTasksEmail(report) {
  const stages = report.poStages || [];
  const stageTotal = stages.reduce((total, row) => total + row.count, 0);
  const signed = report.signedBy || { rajeev: 0, mugesh: 0, meet: 0, overlap: 0, remaining: [] };
  const remaining = signed.remaining || [];
  const signerSum = (signed.rajeev || 0) + (signed.mugesh || 0) + (signed.meet || 0) + remaining.length - (signed.overlap || 0);
  const screen = report.vendorScreen || { pending: 0, accepted: 0, rejected: 0, partial: 0, outside: 0 };
  const outsideOrders = screen.outsideOrders || [];
  const vendorRows = [
    { label: 'Pending — on the Vendor PO Acceptance screen', count: screen.pending || 0 },
    { label: 'Accepted — on the Vendor PO Acceptance screen', count: screen.accepted || 0 },
    ...(screen.rejected ? [{ label: 'Rejected — on the Vendor PO Acceptance screen', count: screen.rejected }] : []),
    ...(screen.partial ? [{ label: 'Partial — on the Vendor PO Acceptance screen', count: screen.partial }] : []),
    { label: 'Not on the Vendor PO Acceptance screen', count: screen.outside || 0 },
  ];
  const grnOnlyPending = stageCount(stages, ['grn_pending']);
  const grnCompleted = stageCount(stages, ['invoice_entry', 'accounts', 'paid']);
  const invoiceOnlyPending = stageCount(stages, ['invoice_entry']);
  const invoiceCompleted = stageCount(stages, ['accounts', 'paid']);
  const vendorAcceptancePending = screen.pending || 0;
  const grnPending = vendorAcceptancePending + grnOnlyPending;
  const invoicePending = vendorAcceptancePending + grnOnlyPending + invoiceOnlyPending;
  const scopeTitle = String(report.scopeTitle || '').trim();
  const subject = scopeTitle
    ? `P2P Pending Tasks — ${scopeTitle} — ${report.generatedAt}`
    : `P2P Pending Tasks — Approved POs and current stage — ${report.generatedAt}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>P2P Pending Tasks</title>
</head>
<body style="margin:0; padding:0; background-color:#eef0f2 !important;" bgcolor="#eef0f2">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef0f2 !important;" bgcolor="#eef0f2">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="740" cellpadding="0" cellspacing="0" style="background-color:#ffffff !important; border-radius:10px; overflow:hidden;" bgcolor="#ffffff">
<tr><td style="background-color:#ffffff !important; padding:26px 32px;" bgcolor="#ffffff">
<div style="font-size:18px; font-weight:bold; color:#1a1a1a !important;">P2P Pending Tasks</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:4px;">${escapeHtml(scopeTitle || 'Approved POs')} &middot; Current stage &middot; Requester-wise count</div>
<div style="font-size:12px; color:#6b6b6b !important; margin-top:2px;">Generated ${escapeHtml(report.generatedAt)}</div>
</td></tr>

<tr><td style="padding:22px 32px 6px 32px;" bgcolor="#ffffff">
<div style="font-size:12px; font-weight:bold; color:#8a8a8a !important; text-transform:uppercase; letter-spacing:0.5px;">Approved POs</div>
</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="background:linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%) !important; border:1px solid #c7ead4; border-radius:10px; padding:26px 10px;">
<div style="font-size:30px; font-weight:bold; color:#14503a !important;">${stageTotal}</div>
<div style="font-size:12px; color:#3f8f63 !important; margin-top:6px; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px;">Approved POs</div>
<div style="font-size:11px; color:#3f8f63 !important; margin-top:4px;">${escapeHtml(report.scopeNote || 'Signed orders only. Each order counted once.')}</div>
</td>
</tr></table></td></tr>
${scopeTitle ? '' : `
<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Signed by</td></tr>
<tr><td style="padding:10px 32px 4px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${statCard({
  width: '32%',
  value: signed.rajeev || 0,
  label: `${report.rajeevName || 'Rajeev'} signed`,
  sub: 'Includes RGML when he signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: signed.mugesh || 0,
  label: `${report.mugeshName || 'Mugesh'} signed`,
  sub: 'POs he has signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
<td width="2%"></td>
${statCard({
  width: '32%',
  value: signed.meet || 0,
  label: `${report.meetName || 'Meet'} signed`,
  sub: 'POs he has signed',
  valueColor: '#14503a',
  labelColor: '#3f8f63',
  background: 'linear-gradient(180deg,#f4fbf5 0%,#e0f5e8 100%)',
  border: '#c7ead4',
})}
</tr></table>
<div style="font-size:12px; color:#5b5b5b; margin-top:8px; line-height:1.5;">
Rajeev ${signed.rajeev || 0} + Mugesh ${signed.mugesh || 0} + Meet ${signed.meet || 0}${
    remaining.length ? ` + remaining ${remaining.length}` : ''
  }${
    signed.overlap ? ` − counted under more than one signer ${signed.overlap}` : ''
  } = ${signerSum}. Approved POs are ${stageTotal}.
</div>
</td></tr>
${
  remaining.length
    ? `<tr><td style="padding:18px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Remaining ${remaining.length}</td></tr>
<tr><td style="padding:4px 32px 0 32px; font-size:12px; color:#5b5b5b !important;" bgcolor="#ffffff">
These approved orders are not signed by Rajeev, Mugesh, or Meet.
</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">PO</td>
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">Entity</td>
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">Signed by</td>
</tr>
${remaining
  .map((row, index) => {
    const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
    return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea; font-weight:bold;">${escapeHtml(row.poNumber)}</td>
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(row.entity || '—')}</td>
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(row.signer)}</td>
</tr>`;
  })
  .join('')}
</table></td></tr>`
    : ''
}
`}
${namedBalanceHtml('Vendor acceptance', vendorRows)}
${
  outsideOrders.length
    ? `<tr><td style="padding:4px 32px 0 32px; font-size:12px; color:#5b5b5b !important; line-height:1.5;" bgcolor="#ffffff">
Not on the Vendor PO Acceptance screen means the order is approved, but vendor acceptance has not started, or the order moved ahead without an acceptance record. These orders are the gap between the approved total and the screen total.
</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12.5px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">PO</td>
<td style="padding:12px 12px; color:#ffffff !important; font-weight:bold;">Where it is now</td>
</tr>
${outsideOrders
  .map((row, index) => {
    const bg = index % 2 === 0 ? '#ffffff' : '#f7f8f6';
    return `<tr style="background:${bg};" bgcolor="${bg}">
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea; font-weight:bold;">${escapeHtml(row.poNumber)}</td>
<td style="padding:10px 12px; color:#1a1a1a; border-top:1px solid #ececea;">${escapeHtml(row.stage)}</td>
</tr>`;
  })
  .join('')}
</table></td></tr>`
    : ''
}
${stepBalanceHtml('GRN', grnPending, grnCompleted, stageTotal)}
${stepBalanceHtml('Invoice entry', invoicePending, invoiceCompleted, stageTotal)}

<tr><td style="padding:22px 32px 6px 32px; font-size:13.5px; font-weight:bold; color:#1a1a1a !important;" bgcolor="#ffffff">Requester-wise count</td></tr>
<tr><td style="padding:4px 32px 0 32px; font-size:12px; color:#5b5b5b !important;" bgcolor="#ffffff">
Open work only: vendor PO acceptance, GRN, and invoice entry. A manual PO with no requester is counted under the SCM user who created it.
</td></tr>
<tr><td style="padding:8px 32px 8px 32px;" bgcolor="#ffffff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:12px;">
<tr style="background-color:#14503a !important;" bgcolor="#14503a">
<td style="padding:12px 10px; color:#ffffff !important; font-weight:bold;">Requester</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;">Email</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Vendor acceptance</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">GRN</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Invoice entry</td>
<td style="padding:12px 8px; color:#ffffff !important; font-weight:bold;" align="center">Total</td>
</tr>
${pendingOwnerRows(report.requesterPending || [])}
</table></td></tr>

<tr><td style="background-color:#faf9f7 !important; padding:18px 32px; border-top:1px solid #ececea; font-size:11px; color:#a0a0a0 !important;" bgcolor="#faf9f7">
P2P Pending Tasks &middot; Automated &middot; Do not reply to this email
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    'P2P Pending Tasks',
    report.generatedAt,
    '',
    `Approved POs: ${stageTotal}`,
    ...(scopeTitle
      ? []
      : [
          `${report.rajeevName || 'Rajeev'} signed: ${signed.rajeev || 0}`,
          `${report.mugeshName || 'Mugesh'} signed: ${signed.mugesh || 0}`,
          `${report.meetName || 'Meet'} signed: ${signed.meet || 0}`,
          ...(remaining.length ? [`Remaining: ${remaining.length}`, ...remaining.map((row) => `${row.poNumber} | ${row.entity || '—'} | ${row.signer}`)] : []),
          ...(signed.overlap ? [`Counted under more than one signer: ${signed.overlap}`] : []),
          `Rajeev + Mugesh + Meet${remaining.length ? ' + remaining' : ''}${signed.overlap ? ' − overlap' : ''} = ${signerSum}`,
        ]),
    '',
    'Vendor PO acceptance',
    `Pending — on the Vendor PO Acceptance screen: ${screen.pending || 0}`,
    `Accepted — on the Vendor PO Acceptance screen: ${screen.accepted || 0}`,
    `Not on the Vendor PO Acceptance screen: ${screen.outside || 0}`,
    'These approved orders are not on that screen. Vendor acceptance has not started, or the order moved ahead without an acceptance record.',
    ...outsideOrders.map((row) => `${row.poNumber} | ${row.stage}`),
    `Total: ${(screen.pending || 0) + (screen.accepted || 0) + (screen.rejected || 0) + (screen.partial || 0) + (screen.outside || 0)}`,
    '',
    'GRN',
    `Pending: ${grnPending}`,
    `Completed: ${grnCompleted}`,
    `Remaining: ${Math.max(0, stageTotal - grnPending - grnCompleted)}`,
    `Total: ${stageTotal}`,
    '',
    'Invoice entry',
    `Pending: ${invoicePending}`,
    `Completed: ${invoiceCompleted}`,
    `Remaining: ${Math.max(0, stageTotal - invoicePending - invoiceCompleted)}`,
    `Total: ${stageTotal}`,
    '',
    'Requester-wise count',
    ...(report.requesterPending || []).map(
      (row) =>
        `${row.name} <${row.email || 'no email'}>: vendor acceptance ${row.vendorAcceptance}, GRN ${row.grnPending}, invoice entry ${row.invoiceEntry}, total ${row.total}`
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
      vendorAcceptancePending: report.vendorAcceptancePending,
      grnPending: report.grnPending,
      invoiceEntryPending: report.invoiceEntryPending,
      totalPos: report.totalPos,
    },
  });
  return { to: recipient, subject: built.subject, report };
}

const APPROVED_PO_STATUSES = `'pending_buyer_verify','approved','sent_to_vendor','awaiting_grn','grn_completed','invoice_entry','pending_accounts_approval','approved_for_payment','paid'`;

function rajeevSignedSql() {
  return `(
    po.signer_id = ?
    OR LOWER(IFNULL(po.signature_name, '')) LIKE 'rajeev%'
    OR LOWER(IFNULL(signer.email, '')) LIKE 'rajeev%'
    OR LOWER(IFNULL(signer.name, '')) LIKE 'rajeev%'
  )`;
}

/** Same approved POs as the Rajeev pending-tasks mail, one row per order. */
export async function listRajeevSignedPurchaseOrders() {
  const [[rajeevUser]] = await pool.query(
    `SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [DEFAULT_SCM_MANAGER_EMAIL]
  );
  const rajeevId = Number(rajeevUser?.id) || 0;
  const [rows] = await pool.query(
    `SELECT po.po_number,
            COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(creator_dept.name), ''), '') AS department,
            po.grand_total,
            COALESCE(NULLIF(TRIM(creator.name), ''), '') AS created_by_name,
            DATE_FORMAT(COALESCE(po.po_date, po.created_at), '%Y-%m-%d') AS po_date,
            COALESCE(NULLIF(TRIM(em.name), ''), NULLIF(TRIM(po.entity), ''), '') AS entity_name
     FROM purchase_orders po
     LEFT JOIN users signer ON signer.id = po.signer_id
     LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN departments dept ON dept.id = pr.department_id
     LEFT JOIN users creator ON creator.id = po.created_by
     LEFT JOIN departments creator_dept ON creator_dept.id = creator.department_id
     LEFT JOIN entity_masters em ON em.id = po.entity_id
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND LOWER(po.status) IN (${APPROVED_PO_STATUSES})
       AND ${rajeevSignedSql()}
     ORDER BY COALESCE(po.po_date, DATE(po.created_at)) DESC, po.po_number`,
    [rajeevId]
  );
  return rows.map((row) => ({
    poNumber: row.po_number || '',
    department: row.department || '',
    amount: Number(row.grand_total) || 0,
    createdBy: row.created_by_name || '',
    poDate: row.po_date || '',
    entity: row.entity_name || '',
  }));
}

/** Pending-tasks mail limited to POs Rajeev has signed. */
export async function loadRajeevSignedPendingReport() {
  const now = new Date();
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
  const signedSql = rajeevSignedSql();
  const signerJoin = 'LEFT JOIN users signer ON signer.id = po.signer_id';

  const [poStageRows] = await pool.query(
    `SELECT stage, COUNT(*) AS pos
     FROM (
       SELECT
         CASE
           WHEN LOWER(po.status) = 'pending_buyer_verify' THEN 'buyer_verify'
           WHEN LOWER(po.status) = 'approved' THEN 'pending_release'
           WHEN LOWER(po.status) = 'sent_to_vendor'
             AND COALESCE(po.vendor_acceptance_status, 'pending') = 'pending' THEN 'vendor_acceptance'
           WHEN LOWER(po.status) = 'sent_to_vendor' THEN 'vendor_recorded'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL
             AND COALESCE(po.purchase_type, 'purchase_order') = 'purchase_order'
             AND COALESCE(po.vendor_acceptance_status, '') = 'accepted' THEN 'grn_pending'
           WHEN LOWER(po.status) = 'awaiting_grn' AND g.id IS NULL THEN 'vendor_acceptance'
           WHEN LOWER(po.status) = 'invoice_entry' THEN 'invoice_entry'
           WHEN LOWER(po.status) IN ('grn_completed', 'pending_accounts_approval', 'approved_for_payment')
             OR (LOWER(po.status) = 'awaiting_grn' AND g.id IS NOT NULL) THEN 'accounts'
           WHEN LOWER(po.status) = 'paid' THEN 'paid'
           ELSE 'other'
         END AS stage
       FROM purchase_orders po
       LEFT JOIN grn_headers g ON g.po_id = po.id
       ${signerJoin}
       WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) IN (${APPROVED_PO_STATUSES})
         AND ${signedSql}
     ) staged
     GROUP BY stage`,
    [rajeevId]
  );
  const poStageLabels = [
    ['buyer_verify', 'Buyer final verify'],
    ['pending_release', 'Waiting for release'],
    ['vendor_acceptance', 'Vendor PO acceptance'],
    ['vendor_recorded', 'Vendor acceptance recorded'],
    ['grn_pending', 'GRN'],
    ['invoice_entry', 'Invoice entry'],
    ['accounts', 'Accounts / payment'],
    ['paid', 'Paid'],
    ['other', 'Other'],
  ];
  const poStageByKey = new Map(poStageRows.map((row) => [row.stage, num(row.pos)]));
  const poStages = poStageLabels
    .map(([key, label]) => ({ key, label, count: poStageByKey.get(key) || 0 }))
    .filter((row) => row.count > 0);

  const [signerRows] = await pool.query(
    `SELECT po.po_number,
            COALESCE(NULLIF(TRIM(em.name), ''), NULLIF(TRIM(po.entity), ''), '') AS entity_name,
            COALESCE(NULLIF(TRIM(po.signature_name), ''), NULLIF(TRIM(signer.name), ''), 'Not signed yet') AS signer_label,
            1 AS is_rajeev,
            (
              po.signer_id = ?
              OR LOWER(IFNULL(po.signature_name, '')) LIKE 'meet%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'meet.%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'meet@%'
              OR LOWER(IFNULL(signer.name, '')) LIKE 'meet%'
            ) AS is_meet,
            (
              po.signer_id = ?
              OR LOWER(IFNULL(po.signature_name, '')) LIKE 'mugesh%'
              OR LOWER(IFNULL(signer.email, '')) LIKE 'mugesh%'
              OR LOWER(IFNULL(signer.name, '')) LIKE 'mugesh%'
            ) AS is_mugesh
     FROM purchase_orders po
     ${signerJoin}
     LEFT JOIN entity_masters em ON em.id = po.entity_id
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND LOWER(po.status) IN (${APPROVED_PO_STATUSES})
       AND ${signedSql}`,
    [meetId, mugeshId, rajeevId]
  );
  const signedBy = { rajeev: 0, mugesh: 0, meet: 0, overlap: 0, remaining: [] };
  for (const row of signerRows) {
    const flags = [row.is_rajeev, row.is_mugesh, row.is_meet].filter((flag) => Number(flag) === 1).length;
    signedBy.rajeev += 1;
    if (Number(row.is_mugesh) === 1) signedBy.mugesh += 1;
    if (Number(row.is_meet) === 1) signedBy.meet += 1;
    if (flags > 1) signedBy.overlap += 1;
  }

  const [[vendorScreen]] = await pool.query(
    `SELECT
       SUM(bucket = 'pending') AS pending_count,
       SUM(bucket = 'accepted') AS accepted_count,
       SUM(bucket = 'rejected') AS rejected_count,
       SUM(bucket = 'partial') AS partial_count,
       SUM(bucket = 'outside') AS outside_count
     FROM (
       SELECT
         CASE
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'accepted' THEN 'accepted'
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'rejected' THEN 'rejected'
           WHEN COALESCE(po.vendor_acceptance_status, '') = 'partial' THEN 'partial'
           WHEN LOWER(po.status) = 'sent_to_vendor' THEN 'pending'
           WHEN LOWER(po.status) = 'awaiting_grn'
             AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id) THEN 'pending'
           ELSE 'outside'
         END AS bucket
       FROM purchase_orders po
       ${signerJoin}
       WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
         AND ${NOT_DRAFT_PO}
         AND LOWER(po.status) IN (${APPROVED_PO_STATUSES})
         AND ${signedSql}
     ) buckets`,
    [rajeevId]
  );
  const [vendorOutsideRows] = await pool.query(
    `SELECT po.po_number,
       CASE
         WHEN LOWER(po.status) = 'pending_buyer_verify' THEN 'Buyer final verify — not sent to the vendor yet'
         WHEN LOWER(po.status) = 'approved' THEN 'Approved — waiting for release to the vendor'
         WHEN LOWER(po.status) = 'awaiting_grn' THEN 'Vendor acceptance pending'
         WHEN LOWER(po.status) = 'invoice_entry' THEN 'Invoice entry — vendor acceptance was not recorded'
         WHEN LOWER(po.status) IN ('grn_completed', 'pending_accounts_approval', 'approved_for_payment')
           THEN 'Accounts / payment — vendor acceptance was not recorded'
         WHEN LOWER(po.status) = 'paid' THEN 'Paid — vendor acceptance was not recorded'
         ELSE LOWER(po.status)
       END AS stage_label
     FROM purchase_orders po
     ${signerJoin}
     WHERE COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND LOWER(po.status) IN (${APPROVED_PO_STATUSES})
       AND ${signedSql}
       AND COALESCE(po.vendor_acceptance_status, '') NOT IN ('accepted', 'rejected', 'partial')
       AND LOWER(po.status) <> 'sent_to_vendor'
       AND NOT (
         LOWER(po.status) = 'awaiting_grn'
         AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id)
       )
     ORDER BY stage_label, po.po_number`,
    [rajeevId]
  );

  const ownerMap = new Map();
  const touchOwner = (row) => {
    const email = String(row.owner_email || '').trim().toLowerCase();
    const key = email || row.owner_name || 'Unassigned';
    if (!ownerMap.has(key)) {
      ownerMap.set(key, {
        name: row.owner_name || 'Unassigned',
        email: row.owner_email || '',
        vendorAcceptance: 0,
        grnPending: 0,
        invoiceEntry: 0,
      });
    }
    return ownerMap.get(key);
  };
  const ownerSelect = `COALESCE(req.id, creator.id, 0) AS owner_id,
            COALESCE(NULLIF(TRIM(req.name), ''), NULLIF(TRIM(creator.name), ''), 'Unassigned') AS owner_name,
            COALESCE(NULLIF(TRIM(req.email), ''), NULLIF(TRIM(creator.email), ''), '') AS owner_email`;
  const ownerJoins = `LEFT JOIN purchase_requests pr ON pr.id = po.pr_id
     LEFT JOIN users req ON req.id = pr.requester_id
     LEFT JOIN users creator ON creator.id = po.created_by
     ${signerJoin}`;

  const [vendorAcceptanceRows] = await pool.query(
    `SELECT ${ownerSelect}
     FROM purchase_orders po
     ${ownerJoins}
     WHERE COALESCE(po.vendor_acceptance_status, 'pending') = 'pending'
       AND (
         po.status = 'sent_to_vendor'
         OR (
           po.status = 'awaiting_grn'
           AND NOT EXISTS (SELECT 1 FROM grn_headers g_acc WHERE g_acc.po_id = po.id)
         )
       )
       AND ${NOT_DRAFT_PO}
       AND ${signedSql}`,
    [rajeevId]
  );
  const [grnPendingRows] = await pool.query(
    `SELECT ${ownerSelect}
     FROM purchase_orders po
     ${ownerJoins}
     LEFT JOIN grn_headers g ON g.po_id = po.id
     WHERE po.purchase_type = 'purchase_order'
       AND po.status = 'awaiting_grn'
       AND g.id IS NULL
       AND COALESCE(po.vendor_acceptance_status, '') = 'accepted'
       AND ${NOT_DRAFT_PO}
       AND ${signedSql}`,
    [rajeevId]
  );
  const [invoiceEntryRows] = await pool.query(
    `SELECT ${ownerSelect}
     FROM purchase_orders po
     ${ownerJoins}
     WHERE LOWER(po.status) = 'invoice_entry'
       AND COALESCE(po.purchase_type, 'purchase_order') <> 'sass'
       AND ${NOT_DRAFT_PO}
       AND ${signedSql}`,
    [rajeevId]
  );
  for (const row of vendorAcceptanceRows) touchOwner(row).vendorAcceptance += 1;
  for (const row of grnPendingRows) touchOwner(row).grnPending += 1;
  for (const row of invoiceEntryRows) touchOwner(row).invoiceEntry += 1;
  const requesterPending = [...ownerMap.values()]
    .map((row) => ({ ...row, total: row.vendorAcceptance + row.grnPending + row.invoiceEntry }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const rajeevName = rajeevUser?.name || DEFAULT_SCM_MANAGER_NAME;
  return {
    generatedAt: formatReportDate(now),
    scopeTitle: `${rajeevName} signed POs`,
    scopeNote: `Only POs signed by ${rajeevName}. Each order counted once.`,
    rajeevName,
    meetName: meetUser?.name || RGML_SCM_MANAGER_NAME,
    mugeshName: mugeshUser?.name || 'Mugesh M',
    poStages,
    signedBy,
    requesterPending,
    vendorScreen: {
      pending: num(vendorScreen?.pending_count),
      accepted: num(vendorScreen?.accepted_count),
      rejected: num(vendorScreen?.rejected_count),
      partial: num(vendorScreen?.partial_count),
      outside: num(vendorScreen?.outside_count),
      outsideOrders: vendorOutsideRows.map((row) => ({
        poNumber: row.po_number || '',
        stage: row.stage_label || '',
      })),
    },
  };
}

export async function sendRajeevSignedPendingTasksReport(to = P2P_REPORT_TO) {
  const recipient = String(to || P2P_REPORT_TO).trim() || P2P_REPORT_TO;
  const report = await loadRajeevSignedPendingReport();
  const built = buildP2pPendingTasksEmail(report);
  const stageTotal = (report.poStages || []).reduce((total, row) => total + row.count, 0);
  await sendMailToRecipients([recipient], built.subject, built.html, built.text, [], {
    emailType: 'p2p_rajeev_pending_tasks',
    skipLogo: true,
    meta: {
      totalPos: stageTotal,
      vendorAcceptancePending: report.vendorScreen.pending,
      grnPending: (report.poStages || []).find((row) => row.key === 'grn_pending')?.count || 0,
      invoiceEntryPending: (report.poStages || []).find((row) => row.key === 'invoice_entry')?.count || 0,
    },
  });
  return { to: recipient, subject: built.subject, report: { ...report, totalPos: stageTotal } };
}

/** Separate mail: vendor acceptance, GRN, and invoice-entry pending counts and lists. */
export async function sendP2pPendingTasksReport(to = P2P_REPORT_TO) {
  const recipient = String(to || P2P_REPORT_TO).trim() || P2P_REPORT_TO;
  const report = await loadP2pActivityReport();
  const built = buildP2pPendingTasksEmail(report);
  await sendMailToRecipients([recipient], built.subject, built.html, built.text, [], {
    emailType: 'p2p_pending_tasks',
    skipLogo: true,
    meta: {
      totalPos: report.totalPos,
      vendorAcceptancePending: report.vendorAcceptancePending,
      grnPending: report.grnPending,
      invoiceEntryPending: report.invoiceEntryPending,
    },
  });
  return { to: recipient, subject: built.subject, report };
}
