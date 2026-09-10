import pool from '../config/db.js';
import { formatRoleDisplayName } from '../templates/emailUtils.js';
import {
  queueSlaBreachNotification,
  queueSlaBreachDailyReminder,
} from './emailService.js';
import { getRecommendedQuotedAmounts, getPurchaseRequestById } from './prService.js';
import { getScmBuyerNotifyEmails } from '../utils/scmAssignee.js';
import {
  APPROVAL_SLA_HOURS,
  taskSlaBreachedSql,
  isDailySlaReminderRole,
  SCM_SLA_ONE_TIME_ROLES,
  DAILY_SLA_REMINDER_ROLES,
  SLA_REMINDER_SLOTS,
  normalizeSlaReminderSlot,
  formatSlaDate,
  getSlaWaitingDays,
  getDailySlaApprovalTypeLabel,
  getTaskSlaDeadlineMs,
} from '../utils/sla.js';

const SLA_CHECK_INTERVAL_MS = Number(process.env.SLA_CHECK_INTERVAL_MS) || 15 * 60 * 1000;
/** Local morning hour (0–23) when User/L1/L2 morning SLA reminders are sent. */
const SLA_DAILY_HOUR = Number(process.env.SLA_DAILY_HOUR ?? 8);
/** Local evening hour (0–23) when User/L1/L2 evening SLA reminders are sent. */
const SLA_EVENING_HOUR = Number(process.env.SLA_EVENING_HOUR ?? 18);
const SLA_DAILY_TZ = String(process.env.SLA_DAILY_TZ || process.env.TZ || 'Asia/Kolkata').trim();
const SLOT_WINDOW_HOURS = 2;

let started = false;
let running = false;
let dailyRunning = false;
/** YYYY-MM-DD keys of last successful slot runs in SLA_DAILY_TZ. */
const lastSlotRunDate = {
  [SLA_REMINDER_SLOTS.MORNING]: null,
  [SLA_REMINDER_SLOTS.EVENING]: null,
};

/** Column that stores last send date for a given reminder slot. */
function slotNotifiedColumn(slot) {
  return normalizeSlaReminderSlot(slot) === SLA_REMINDER_SLOTS.EVENING
    ? 'sla_evening_notified_on'
    : 'sla_daily_notified_on';
}

const PR_PAST_RFQ_ENTRY = new Set([
  'PENDING_SCM_PO',
  'APPROVED',
  'REJECTED',
  'AWAITING_INVOICE',
]);

function calendarDateInTz(date = new Date(), timeZone = SLA_DAILY_TZ) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function hourInTz(date = new Date(), timeZone = SLA_DAILY_TZ) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    return Number(hour);
  } catch {
    return date.getHours();
  }
}

function slotHour(slot) {
  return normalizeSlaReminderSlot(slot) === SLA_REMINDER_SLOTS.EVENING
    ? SLA_EVENING_HOUR
    : SLA_DAILY_HOUR;
}

/**
 * True when the scheduler should fire this slot (once per calendar day per slot).
 * Morning and evening are independent — both can run on the same day.
 */
function shouldRunReminderSlotNow(slot, now = new Date()) {
  const normalized = normalizeSlaReminderSlot(slot);
  const today = calendarDateInTz(now);
  if (lastSlotRunDate[normalized] === today) return false;
  if (String(process.env.SLA_DAILY_FORCE || '').trim() === '1') return true;
  const hour = hourInTz(now);
  const start = slotHour(normalized);
  return hour >= start && hour < start + SLOT_WINDOW_HOURS;
}

/** @deprecated use shouldRunReminderSlotNow(MORNING) */
function shouldRunDailyRemindersNow(now = new Date()) {
  return shouldRunReminderSlotNow(SLA_REMINDER_SLOTS.MORNING, now);
}

/** True when this pending task should not get SLA mail because the stage is already done. */
async function slaWorkAlreadyFinished(row) {
  const prStatus = String(row.pr_status || '').toUpperCase();
  const taskType = String(row.task_type || '');

  if (['REJECTED', 'RETURNED', 'CANCELLED', 'CANCELED'].includes(prStatus)) return true;

  if (taskType === 'RFQ_ENTRY') {
    if (PR_PAST_RFQ_ENTRY.has(prStatus)) return true;
  }

  if (taskType === 'RFQ_ENTRY' || (taskType === 'RFQ_POST_APPROVAL' && row.assigned_role === 'SCM Buyer')) {
    const [pos] = await pool.query(
      `SELECT id FROM purchase_orders
       WHERE pr_id = ?
         AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'rejected', 'draft')
       LIMIT 1`,
      [row.pr_id]
    );
    if (pos.length) return true;
  }

  return false;
}

/**
 * Pending approval tasks past SLA for the current stage only.
 * SLA clock starts at workflow_tasks.created_at (new task = new SLA on stage change).
 * Notifies the current assignee once per pending task (sla_notified_at).
 * Includes SCM Buyer / SCM Manager (one-time only — never daily repeats).
 */
export async function processSlaBreaches() {
  if (running) return { skipped: true };
  running = true;
  try {
    const breachSql = taskSlaBreachedSql('wt', APPROVAL_SLA_HOURS);
    const [rows] = await pool.query(
      `SELECT wt.id AS task_id, wt.pr_id, wt.task_type, wt.assigned_role, wt.assigned_user_id,
              wt.due_date, wt.created_at AS task_created_at, wt.status AS task_status,
              pr.pr_number, pr.title, pr.total_amount, pr.priority, pr.status AS pr_status,
              pr.department_id,
              d.name AS department_name,
              req.name AS requester_name, req.email AS requester_email,
              asg.name AS assignee_name, asg.email AS assignee_email
       FROM workflow_tasks wt
       JOIN purchase_requests pr ON pr.id = wt.pr_id
       JOIN departments d ON d.id = pr.department_id
       JOIN users req ON req.id = pr.requester_id
       LEFT JOIN users asg ON asg.id = wt.assigned_user_id
       WHERE wt.task_type IN (
              'PR_APPROVAL', 'RFQ_ENTRY', 'RFQ_POST_APPROVAL',
              'PO_APPROVAL', 'PO_BUYER_VERIFY', 'PO_REVISION'
            )
         AND wt.status = 'pending'
         AND wt.sla_notified_at IS NULL
         AND ${breachSql}
       ORDER BY wt.id ASC
       LIMIT 50`
    );

    if (!rows.length) return { checked: 0, notified: 0 };

    const quoteMap = await getRecommendedQuotedAmounts(rows.map((r) => r.pr_id));
    let notified = 0;

    for (const row of rows) {
      try {
        const finished = await slaWorkAlreadyFinished(row);
        if (finished) {
          await pool.query(
            `UPDATE workflow_tasks
             SET sla_notified_at = NOW(),
                 status = CASE WHEN status = 'pending' THEN 'completed' ELSE status END,
                 completed_at = CASE
                   WHEN status = 'pending' THEN COALESCE(completed_at, NOW())
                   ELSE completed_at
                 END
             WHERE id = ? AND sla_notified_at IS NULL`,
            [row.task_id]
          );
          console.log(
            `SLA skip (work already finished): ${row.pr_number} task=${row.task_id} type=${row.task_type}`
          );
          continue;
        }

        const isPostRfq = row.task_type === 'RFQ_POST_APPROVAL';
        const quote = quoteMap.get(Number(row.pr_id));
        const amount =
          quote != null && quote > 0 ? quote : Number(row.total_amount) || 0;

        let fullPr = null;
        try {
          fullPr = await getPurchaseRequestById(row.pr_id);
        } catch { /* fallback below */ }

        const pr = fullPr
          ? {
              id: fullPr.id,
              prId: fullPr.id,
              prNumber: fullPr.prNumber,
              title: fullPr.title,
              totalAmount: amount,
              priority: fullPr.priority || fullPr.priorityLower || row.priority,
              department: fullPr.department || row.department_name,
              requester: fullPr.requester || row.requester_name,
              requestType: fullPr.requestType || '',
              justification: fullPr.justification || '',
              entityName: fullPr.entityName || '',
              entityCode: fullPr.entityCode || '',
              entityId: fullPr.entityId || null,
              lineItems: (fullPr.lineItems || []).map((item) => ({
                description: item.description || item.itemName || '',
                category: item.category || '',
                quantity: item.quantity || 0,
                unitCost: item.unitCost || item.unitPrice || 0,
                total: item.total || (item.quantity || 0) * (item.unitCost || item.unitPrice || 0),
              })),
            }
          : {
              id: row.pr_id,
              prId: row.pr_id,
              prNumber: row.pr_number,
              title: row.title,
              totalAmount: amount,
              priority: row.priority,
              department: row.department_name,
              requester: row.requester_name,
              requestType: '',
              justification: '',
              entityName: '',
              entityCode: '',
              lineItems: [],
            };
        const requester = {
          name: row.requester_name,
          email: row.requester_email,
        };

        let approverEmails = [];
        let approverName = row.assignee_name || null;

        if (row.assignee_email) {
          approverEmails = [row.assignee_email];
        } else if (row.assigned_role === 'SCM Buyer') {
          approverEmails = await getScmBuyerNotifyEmails();
          approverName = approverName || 'SCM Buyer';
        } else if (row.assigned_role) {
          const [roleUsers] = await pool.query(
            `SELECT name, email FROM users
             WHERE role = ? AND COALESCE(is_active, 1) = 1 AND email IS NOT NULL AND email <> ''
             LIMIT 10`,
            [row.assigned_role]
          );
          approverEmails = roleUsers.map((u) => u.email).filter(Boolean);
          approverName = approverName || roleUsers[0]?.name || formatRoleDisplayName(row.assigned_role);
        }

        if (!approverEmails.length) {
          console.warn(
            `SLA breach skip: no recipient for task ${row.task_id} (${row.pr_number}) role=${row.assigned_role}`
          );
          await pool.query(
            `UPDATE workflow_tasks SET sla_notified_at = NOW() WHERE id = ? AND sla_notified_at IS NULL`,
            [row.task_id]
          );
          continue;
        }

        const roleLabel = formatRoleDisplayName(row.assigned_role);
        const stageLabel = `SLA Breached — ${roleLabel} action required`;

        queueSlaBreachNotification(pr, row.assigned_role, requester, row.department_id, {
          approverEmails,
          approverName: approverName || roleLabel,
          postRfq: isPostRfq,
          rfqEntry: row.task_type === 'RFQ_ENTRY',
          createPo: isPostRfq && row.assigned_role === 'SCM Buyer',
          slaBreach: true,
          stageLabel,
          taskId: row.task_id,
        });

        await pool.query(
          `UPDATE workflow_tasks SET sla_notified_at = NOW() WHERE id = ? AND sla_notified_at IS NULL`,
          [row.task_id]
        );
        notified += 1;
        console.log(
          `SLA breach notified: ${row.pr_number} task=${row.task_id} stage=${row.assigned_role} → ${approverEmails.join(', ')}`
        );
      } catch (err) {
        console.error(`SLA breach notify failed for task ${row.task_id}:`, err.message);
      }
    }

    return { checked: rows.length, notified };
  } finally {
    running = false;
  }
}

/**
 * Morning / evening SLA-breach reminders for User Approval / L1 / L2 only.
 * Excludes SCM Buyer and SCM Manager (they keep one-time SLA mail only).
 *
 * Dedupes by (task, calendar day, slot):
 * - MORNING → workflow_tasks.sla_daily_notified_on
 * - EVENING → workflow_tasks.sla_evening_notified_on
 *
 * Re-checks status=pending at claim time so a task completed after morning
 * does not receive the evening mail.
 *
 * @param {{ force?: boolean, slot?: 'MORNING'|'EVENING' }} options
 */
export async function processDailySlaBreachReminders({ force = false, slot = SLA_REMINDER_SLOTS.MORNING } = {}) {
  const notificationType = normalizeSlaReminderSlot(slot);
  const notifiedCol = slotNotifiedColumn(notificationType);

  if (dailyRunning) return { skipped: true, reason: 'already_running', notificationType };
  if (!force && !shouldRunReminderSlotNow(notificationType)) {
    return { skipped: true, reason: 'outside_slot_window', notificationType };
  }

  dailyRunning = true;
  const runDate = calendarDateInTz();
  try {
    const breachSql = taskSlaBreachedSql('wt', APPROVAL_SLA_HOURS);
    const dailyRoles = [...DAILY_SLA_REMINDER_ROLES];

    const [rows] = await pool.query(
      `SELECT wt.id AS task_id, wt.pr_id, wt.task_type, wt.assigned_role, wt.assigned_user_id,
              wt.due_date, wt.created_at AS task_created_at, wt.status AS task_status,
              wt.sla_daily_notified_on, wt.sla_evening_notified_on,
              pr.pr_number, pr.title, pr.status AS pr_status, pr.pr_flow, pr.department_id,
              asg.name AS assignee_name, asg.email AS assignee_email
       FROM workflow_tasks wt
       JOIN purchase_requests pr ON pr.id = wt.pr_id
       LEFT JOIN users asg ON asg.id = wt.assigned_user_id
       WHERE wt.status = 'pending'
         AND wt.assigned_role IN (?, ?)
         AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
         AND ${breachSql}
         AND (wt.${notifiedCol} IS NULL OR wt.${notifiedCol} < CURDATE())
       ORDER BY wt.id ASC
       LIMIT 200`,
      dailyRoles
    );

    if (!rows.length) {
      lastSlotRunDate[notificationType] = runDate;
      console.log(`SLA ${notificationType} reminders: none pending (${runDate})`);
      return { checked: 0, notified: 0, skippedScm: 0, runDate, notificationType };
    }

    let notified = 0;
    let skipped = 0;
    let skippedScm = 0;

    for (const row of rows) {
      try {
        const role = String(row.assigned_role || '').trim();

        // Hard exclude SCM — should never appear due to IN clause, but guard anyway
        if (SCM_SLA_ONE_TIME_ROLES.has(role) || !isDailySlaReminderRole(role)) {
          skippedScm += 1;
          continue;
        }

        if (String(row.task_status || '').toLowerCase() !== 'pending') {
          skipped += 1;
          continue;
        }

        const finished = await slaWorkAlreadyFinished(row);
        if (finished) {
          await pool.query(
            `UPDATE workflow_tasks
             SET ${notifiedCol} = CURDATE(),
                 status = CASE WHEN status = 'pending' THEN 'completed' ELSE status END,
                 completed_at = CASE
                   WHEN status = 'pending' THEN COALESCE(completed_at, NOW())
                   ELSE completed_at
                 END
             WHERE id = ? AND status = 'pending'`,
            [row.task_id]
          );
          console.log(
            `SLA ${notificationType} skip (work finished): ${row.pr_number} task=${row.task_id} role=${role}`
          );
          skipped += 1;
          continue;
        }

        // Claim this (date, slot) before send — prevents duplicate mails in the same run.
        // Also requires status still pending so evening is skipped if approved after morning.
        const [claim] = await pool.query(
          `UPDATE workflow_tasks
           SET ${notifiedCol} = CURDATE()
           WHERE id = ?
             AND status = 'pending'
             AND (${notifiedCol} IS NULL OR ${notifiedCol} < CURDATE())`,
          [row.task_id]
        );
        if (!claim?.affectedRows) {
          skipped += 1;
          continue;
        }

        let approverEmail = row.assignee_email || null;
        let approverName = row.assignee_name || null;

        if (!approverEmail && row.assigned_user_id) {
          const [u] = await pool.query(
            `SELECT name, email FROM users WHERE id = ? LIMIT 1`,
            [row.assigned_user_id]
          );
          approverEmail = u[0]?.email || null;
          approverName = approverName || u[0]?.name || null;
        }

        if (!approverEmail) {
          const [roleUsers] = await pool.query(
            `SELECT name, email FROM users
             WHERE role = ? AND COALESCE(is_active, 1) = 1 AND email IS NOT NULL AND email <> ''
             LIMIT 1`,
            [role]
          );
          approverEmail = roleUsers[0]?.email || null;
          approverName = approverName || roleUsers[0]?.name || formatRoleDisplayName(role);
        }

        if (!approverEmail) {
          console.warn(
            `SLA ${notificationType} skip: no recipient for task ${row.task_id} (${row.pr_number}) role=${role}`
          );
          skipped += 1;
          continue;
        }

        const approvalType = getDailySlaApprovalTypeLabel(role, row.pr_flow);
        const startDate = formatSlaDate(row.task_created_at);
        const slaDueMs = getTaskSlaDeadlineMs(row.task_created_at, row.due_date, APPROVAL_SLA_HOURS);
        const slaDue = formatSlaDate(slaDueMs);
        const waitingDays = getSlaWaitingDays(row.task_created_at);

        const pr = {
          id: row.pr_id,
          prId: row.pr_id,
          prNumber: row.pr_number,
          title: row.title,
        };

        queueSlaBreachDailyReminder({
          pr,
          approverEmail,
          approverName: approverName || formatRoleDisplayName(role),
          approvalType,
          startDate,
          slaDue,
          waitingDays,
          assignedRole: role,
          taskId: row.task_id,
          notificationType,
        });

        notified += 1;
        console.log(
          `SLA ${notificationType} reminder sent: ${row.pr_number} task=${row.task_id} type="${approvalType}" ` +
            `approver=${approverName || approverEmail} waiting=${waitingDays}d → ${approverEmail}`
        );
      } catch (err) {
        console.error(
          `SLA ${notificationType} reminder failed for task ${row.task_id}:`,
          err.message
        );
      }
    }

    lastSlotRunDate[notificationType] = runDate;
    console.log(
      `SLA ${notificationType} reminders done (${runDate}): checked=${rows.length} notified=${notified} skipped=${skipped} skippedScm=${skippedScm}`
    );
    return { checked: rows.length, notified, skipped, skippedScm, runDate, notificationType };
  } finally {
    dailyRunning = false;
  }
}

/** Run morning and/or evening slots that are due (or both when forced). */
export async function processDueSlaBreachReminderSlots({ force = false } = {}) {
  const results = {};
  if (force || shouldRunReminderSlotNow(SLA_REMINDER_SLOTS.MORNING)) {
    results.morning = await processDailySlaBreachReminders({
      force,
      slot: SLA_REMINDER_SLOTS.MORNING,
    });
  } else {
    results.morning = { skipped: true, reason: 'outside_slot_window', notificationType: 'MORNING' };
  }
  if (force || shouldRunReminderSlotNow(SLA_REMINDER_SLOTS.EVENING)) {
    results.evening = await processDailySlaBreachReminders({
      force,
      slot: SLA_REMINDER_SLOTS.EVENING,
    });
  } else {
    results.evening = { skipped: true, reason: 'outside_slot_window', notificationType: 'EVENING' };
  }
  return results;
}

export function startSlaBreachScheduler() {
  if (started) return;
  started = true;

  const runOnce = () => {
    processSlaBreaches().catch((err) => {
      console.error('SLA breach check failed:', err.message);
    });
    processDueSlaBreachReminderSlots().catch((err) => {
      console.error('SLA morning/evening reminder check failed:', err.message);
    });
  };

  setTimeout(runOnce, 20_000);
  setInterval(runOnce, SLA_CHECK_INTERVAL_MS);
  console.log(
    `SLA breach scheduler started (every ${Math.round(SLA_CHECK_INTERVAL_MS / 60000)} min, ` +
      `per-stage SLA=${APPROVAL_SLA_HOURS}h; User/L1/L2 reminders ` +
      `morning ${SLA_DAILY_HOUR}:00 + evening ${SLA_EVENING_HOUR}:00 ${SLA_DAILY_TZ})`
  );
}

/** Test helpers — role gates and label mapping without DB. */
export const __test = {
  isDailySlaReminderRole,
  SCM_SLA_ONE_TIME_ROLES,
  DAILY_SLA_REMINDER_ROLES,
  SLA_REMINDER_SLOTS,
  normalizeSlaReminderSlot,
  getDailySlaApprovalTypeLabel,
  shouldRunDailyRemindersNow,
  shouldRunReminderSlotNow,
  slotNotifiedColumn,
  calendarDateInTz,
  hourInTz,
  SLA_DAILY_HOUR,
  SLA_EVENING_HOUR,
  SLA_DAILY_TZ,
  resetDailyRunDate() {
    lastSlotRunDate[SLA_REMINDER_SLOTS.MORNING] = null;
    lastSlotRunDate[SLA_REMINDER_SLOTS.EVENING] = null;
  },
};
