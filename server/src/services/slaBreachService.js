import pool from '../config/db.js';
import { formatRoleDisplayName } from '../templates/emailUtils.js';
import {
  queueSlaBreachNotification,
} from './emailService.js';
import { getRecommendedQuotedAmounts, getPurchaseRequestById } from './prService.js';
import { getScmBuyerNotifyEmails } from '../utils/scmAssignee.js';
import { APPROVAL_SLA_HOURS, taskSlaBreachedSql, taskSlaBreachedBeforeCompleteSql } from '../utils/sla.js';

const SLA_CHECK_INTERVAL_MS = Number(process.env.SLA_CHECK_INTERVAL_MS) || 15 * 60 * 1000;

let started = false;
let running = false;

/**
 * Pending approval tasks past SLA for the current stage only.
 * SLA clock starts at workflow_tasks.created_at (new task = new SLA on stage change).
 * Also notifies completed/cancelled tasks that breached while pending but were never emailed.
 * Notifies assignee once per task via email + WhatsApp (sla_notified_at).
 */
export async function processSlaBreaches() {
  if (running) return { skipped: true };
  running = true;
  try {
    const breachSql = taskSlaBreachedSql('wt', APPROVAL_SLA_HOURS);
    const breachedBeforeCompleteSql = taskSlaBreachedBeforeCompleteSql('wt', APPROVAL_SLA_HOURS);
    const [rows] = await pool.query(
      `SELECT wt.id AS task_id, wt.pr_id, wt.task_type, wt.assigned_role, wt.assigned_user_id,
              wt.due_date, wt.created_at AS task_created_at,
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
       WHERE wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL', 'PO_APPROVAL', 'PO_BUYER_VERIFY', 'PO_REVISION')
         AND wt.sla_notified_at IS NULL
         AND (
           (wt.status = 'pending' AND ${breachSql})
           OR (
             wt.status IN ('completed', 'cancelled')
             AND wt.completed_at IS NOT NULL
             AND ${breachedBeforeCompleteSql}
           )
         )
       ORDER BY wt.id ASC
       LIMIT 50`
    );

    if (!rows.length) return { checked: 0, notified: 0 };

    const quoteMap = await getRecommendedQuotedAmounts(rows.map((r) => r.pr_id));
    let notified = 0;

    for (const row of rows) {
      try {
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

export function startSlaBreachScheduler() {
  if (started) return;
  started = true;

  const run = () => {
    processSlaBreaches().catch((err) => {
      console.error('SLA breach check failed:', err.message);
    });
  };

  setTimeout(run, 20_000);
  setInterval(run, SLA_CHECK_INTERVAL_MS);
  console.log(
    `SLA breach scheduler started (every ${Math.round(SLA_CHECK_INTERVAL_MS / 60000)} min, per-stage SLA=${APPROVAL_SLA_HOURS}h from task start)`
  );
}
