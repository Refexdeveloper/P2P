/**
 * Cloud Subscription recurring lifecycle:
 * One-Time → existing SASS PR flow only.
 * Recurring → activate after PR completes; reminders + renewals via scheduler.
 */
import pool from '../config/db.js';
import { formatDate, formatDateTime } from '../utils/constants.js';
import { buildActionUrl } from '../templates/prApprovalPendingEmail.js';
import {
  queuePrApprovalPendingNotification,
  queueApproverActionConfirmationForUser,
  queueCloudSubscriptionReminderNotification,
} from './emailService.js';
import { isSassMugeshRequester } from './sassWorkflow.js';

const NOTIFICATION_TYPES = {
  EXPIRY_7_DAYS: { daysBeforeExpiry: 7 },
  EXPIRY_3_DAYS: { daysBeforeExpiry: 3 },
  EXPIRY_1_DAY: { daysBeforeExpiry: 1 },
  POST_EXPIRY_DAY_1: { daysAfterExpiry: 1 },
  POST_EXPIRY_DAY_2: { daysAfterExpiry: 2 },
};

export function normalizeSubscriptionMode(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (raw === 'recurring' || raw === 'recurring_subscription') return 'recurring';
  if (raw === 'one_time' || raw === 'onetime' || raw === 'one-time') return 'one_time';
  return null;
}

export function normalizeBillingFrequency(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'monthly' || raw === 'month') return 'monthly';
  if (raw === 'quarterly' || raw === 'quarter') return 'quarterly';
  if (raw === 'yearly' || raw === 'annual' || raw === 'annually' || raw === 'year') return 'yearly';
  return null;
}

/** Calendar-aware expiry from start date + frequency. */
export function calculateExpiryDate(startDate, frequency) {
  const start = toDateOnly(startDate);
  if (!start) throw new Error('Start date is required');
  const freq = normalizeBillingFrequency(frequency);
  if (!freq) throw new Error('Billing frequency is required');

  const y = start.getUTCFullYear();
  const m = start.getUTCMonth();
  const d = start.getUTCDate();

  let targetY = y;
  let targetM = m;
  if (freq === 'monthly') targetM = m + 1;
  else if (freq === 'quarterly') targetM = m + 3;
  else if (freq === 'yearly') targetY = y + 1;

  // Handle month overflow
  while (targetM > 11) {
    targetM -= 12;
    targetY += 1;
  }

  // Clamp day for month-end (e.g. Jan 31 + 1 month → Feb 28/29)
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return new Date(Date.UTC(targetY, targetM, day));
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function ymd(date) {
  const d = toDateOnly(date);
  if (!d) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const d = toDateOnly(date);
  if (!d) return null;
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function daysBetween(from, to) {
  const a = toDateOnly(from);
  const b = toDateOnly(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function nextSubscriptionNumber(conn) {
  const [rows] = await conn.query(
    `SELECT subscription_number FROM cloud_subscriptions
     WHERE subscription_number LIKE 'SUB-%'
     ORDER BY id DESC LIMIT 1`
  );
  const last = String(rows[0]?.subscription_number || '');
  const n = Number((/^SUB-(\d+)$/i.exec(last) || [])[1]) || 0;
  return `SUB-${String(n + 1).padStart(5, '0')}`;
}

/** Persist recurring draft row at PR create/submit (pending activation until PR completes). */
export async function upsertPendingCloudSubscription(conn, pr, fields = {}) {
  const mode = normalizeSubscriptionMode(fields.subscriptionMode || fields.sass_subscription_mode);
  if (mode !== 'recurring') return null;

  const frequency = normalizeBillingFrequency(fields.billingFrequency || fields.sass_billing_frequency);
  const startDate = toDateOnly(fields.subscriptionStartDate || fields.sass_subscription_start_date);
  if (!frequency) throw new Error('Subscription frequency is required for recurring Cloud Subscription');
  if (!startDate) throw new Error('Subscription start date is required for recurring Cloud Subscription');

  const expiryDate = calculateExpiryDate(startDate, frequency);
  const prId = Number(pr.id || pr.prId);
  const [existing] = await conn.query(
    `SELECT id FROM cloud_subscriptions WHERE purchase_request_id = ? LIMIT 1`,
    [prId]
  );

  const title = pr.title || fields.title || 'Cloud Subscription';
  const vendorName = pr.vendor_name || pr.vendorName || fields.vendorName || '';
  const vendorId = pr.vendor_id || pr.vendorId || fields.vendorId || null;
  const cloudProvider = fields.cloudProvider || vendorName || '';
  const plan = fields.subscriptionPlan || title;

  if (existing[0]?.id) {
    await conn.query(
      `UPDATE cloud_subscriptions SET
         billing_frequency = ?, start_date = ?, expiry_date = ?,
         vendor_id = ?, vendor_name = ?, cloud_provider = ?, subscription_plan = ?,
         title = ?, subscription_type = 'recurring', updated_at = NOW()
       WHERE id = ? AND status IN ('PENDING_ACTIVATION','ACTIVE','EXPIRED','EXPIRING_SOON','RENEWAL_PENDING')`,
      [
        frequency,
        ymd(startDate),
        ymd(expiryDate),
        vendorId,
        vendorName,
        cloudProvider,
        plan,
        title,
        existing[0].id,
      ]
    );
    return existing[0].id;
  }

  const subNumber = await nextSubscriptionNumber(conn);
  const [ins] = await conn.query(
    `INSERT INTO cloud_subscriptions
     (subscription_number, purchase_request_id, requester_id, vendor_id, vendor_name,
      cloud_provider, subscription_plan, subscription_type, billing_frequency,
      start_date, expiry_date, status, renewal_status, renewal_number, title)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'recurring', ?, ?, ?, 'PENDING_ACTIVATION', 'NOT_REQUIRED', 0, ?)`,
    [
      subNumber,
      prId,
      pr.requester_id || pr.requesterId,
      vendorId,
      vendorName,
      cloudProvider,
      plan,
      frequency,
      ymd(startDate),
      ymd(expiryDate),
      title,
    ]
  );
  return ins.insertId;
}

/** Activate recurring subscription when SASS PR is fully completed (invoice uploaded). */
export async function activateCloudSubscriptionForPr(prId) {
  const id = Number(prId);
  if (!id) return null;
  const [rows] = await pool.query(
    `SELECT cs.*, pr.sass_subscription_mode, pr.sass_billing_frequency, pr.sass_subscription_start_date,
            pr.title, pr.vendor_name, pr.vendor_id, pr.requester_id
     FROM purchase_requests pr
     LEFT JOIN cloud_subscriptions cs ON cs.purchase_request_id = pr.id
     WHERE pr.id = ? LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;

  const mode = normalizeSubscriptionMode(row.sass_subscription_mode || row.subscription_type);
  if (mode !== 'recurring') return null;

  if (row.id && row.status !== 'PENDING_ACTIVATION') {
    return mapSubscription(row);
  }

  if (!row.id) {
    const frequency = normalizeBillingFrequency(row.sass_billing_frequency);
    const startDate = toDateOnly(row.sass_subscription_start_date) || todayUtc();
    if (!frequency) return null;
    const expiryDate = calculateExpiryDate(startDate, frequency);
    const subNumber = await nextSubscriptionNumber(pool);
    const [ins] = await pool.query(
      `INSERT INTO cloud_subscriptions
       (subscription_number, purchase_request_id, requester_id, vendor_id, vendor_name,
        cloud_provider, subscription_plan, subscription_type, billing_frequency,
        start_date, expiry_date, status, renewal_status, renewal_number, title)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'recurring', ?, ?, ?, 'ACTIVE', 'NOT_REQUIRED', 0, ?)`,
      [
        subNumber,
        id,
        row.requester_id,
        row.vendor_id,
        row.vendor_name || '',
        row.vendor_name || '',
        row.title || 'Cloud Subscription',
        frequency,
        ymd(startDate),
        ymd(expiryDate),
        row.title || 'Cloud Subscription',
      ]
    );
    return getCloudSubscriptionById(ins.insertId);
  }

  await pool.query(
    `UPDATE cloud_subscriptions
     SET status = 'ACTIVE', renewal_status = 'NOT_REQUIRED', updated_at = NOW()
     WHERE id = ?`,
    [row.id]
  );
  return getCloudSubscriptionById(row.id);
}

function mapSubscription(row) {
  if (!row) return null;
  const expiry = toDateOnly(row.expiry_date);
  const today = todayUtc();
  const daysToExpiry = expiry ? daysBetween(today, expiry) : null;
  let nextReminder = null;
  if (row.status === 'ACTIVE' || row.status === 'EXPIRING_SOON') {
    if (daysToExpiry != null) {
      if (daysToExpiry > 7) nextReminder = `EXPIRY_7_DAYS on ${ymd(addDays(expiry, -7))}`;
      else if (daysToExpiry > 3) nextReminder = `EXPIRY_3_DAYS on ${ymd(addDays(expiry, -3))}`;
      else if (daysToExpiry > 1) nextReminder = `EXPIRY_1_DAY on ${ymd(addDays(expiry, -1))}`;
      else if (daysToExpiry === 1) nextReminder = 'EXPIRY_1_DAY today';
      else if (daysToExpiry === 0) nextReminder = 'Expires today (no email)';
    }
  } else if (row.status === 'EXPIRED') {
    const daysAfter = expiry ? daysBetween(expiry, today) : null;
    if (daysAfter === 0) nextReminder = 'POST_EXPIRY_DAY_1 tomorrow';
    else if (daysAfter === 1) nextReminder = 'POST_EXPIRY_DAY_2 tomorrow';
    else if (daysAfter != null && daysAfter >= 2) nextReminder = 'No further automatic emails';
  }

  return {
    id: row.id,
    subscriptionNumber: row.subscription_number,
    purchaseRequestId: row.purchase_request_id,
    requesterId: row.requester_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name || '',
    cloudProvider: row.cloud_provider || '',
    subscriptionPlan: row.subscription_plan || '',
    subscriptionType: row.subscription_type,
    billingFrequency: row.billing_frequency,
    startDate: formatDate(row.start_date) || ymd(row.start_date),
    expiryDate: formatDate(row.expiry_date) || ymd(row.expiry_date),
    startDateRaw: ymd(row.start_date),
    expiryDateRaw: ymd(row.expiry_date),
    status: row.status,
    renewalStatus: row.renewal_status,
    renewalNumber: Number(row.renewal_number) || 0,
    title: row.title || '',
    nextReminder,
    daysToExpiry,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    canRenew: ['EXPIRED', 'EXPIRING_SOON'].includes(row.status) && row.renewal_status !== 'PENDING',
  };
}

export async function getCloudSubscriptionById(id) {
  const [rows] = await pool.query(`SELECT * FROM cloud_subscriptions WHERE id = ? LIMIT 1`, [Number(id)]);
  return mapSubscription(rows[0]);
}

export async function getCloudSubscriptionByPrId(prId) {
  const [rows] = await pool.query(
    `SELECT * FROM cloud_subscriptions WHERE purchase_request_id = ? LIMIT 1`,
    [Number(prId)]
  );
  return mapSubscription(rows[0]);
}

export async function listCloudSubscriptionsForUser(user, { status } = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (user?.role === 'Requester' || !['Super Admin', 'CFO', 'PR Manager', 'HOD Approver'].includes(user?.role)) {
    where += ' AND cs.requester_id = ?';
    params.push(user.id);
  }
  if (status) {
    where += ' AND cs.status = ?';
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT cs.* FROM cloud_subscriptions cs ${where} ORDER BY cs.expiry_date ASC, cs.id DESC`,
    params
  );
  return rows.map(mapSubscription);
}

export async function getRenewalHistory(subscriptionId) {
  const sub = await getCloudSubscriptionById(subscriptionId);
  if (!sub) throw new Error('Subscription not found');
  const [rows] = await pool.query(
    `SELECT * FROM subscription_renewals WHERE subscription_id = ? ORDER BY renewal_number ASC`,
    [Number(subscriptionId)]
  );
  const originalPeriodStart = rows[0]
    ? ymd(rows[0].previous_start_date)
    : sub.startDateRaw;
  const originalPeriodEnd = rows[0]
    ? ymd(rows[0].previous_expiry_date)
    : sub.expiryDateRaw;
  const original = {
    renewal: 'Original',
    renewalNumber: 0,
    period: `${originalPeriodStart} → ${originalPeriodEnd}`,
    previousStartDate: formatDate(rows[0]?.previous_start_date) || sub.startDate,
    previousExpiryDate: formatDate(rows[0]?.previous_expiry_date) || sub.expiryDate,
    newStartDate: formatDate(rows[0]?.previous_start_date) || sub.startDate,
    newExpiryDate: formatDate(rows[0]?.previous_expiry_date) || sub.expiryDate,
    status: 'Completed',
    approval: 'Completed',
  };
  const renewals = rows.map((r) => ({
    id: r.id,
    renewal: `#${r.renewal_number}`,
    renewalNumber: r.renewal_number,
    renewalNumberLabel: r.renewal_number_label || `REN-${String(r.renewal_number).padStart(4, '0')}`,
    period: `${ymd(r.new_start_date)} → ${ymd(r.new_expiry_date)}`,
    previousStartDate: formatDate(r.previous_start_date),
    previousExpiryDate: formatDate(r.previous_expiry_date),
    newStartDate: formatDate(r.new_start_date),
    newExpiryDate: formatDate(r.new_expiry_date),
    status: r.status,
    approval: r.status,
    submittedAt: formatDateTime(r.submitted_at),
    completedAt: formatDateTime(r.completed_at),
  }));
  return { subscription: sub, history: [original, ...renewals] };
}

async function assertCanAccessSubscription(user, subRow) {
  if (!subRow) throw new Error('Subscription not found');
  if (user.role === 'Super Admin') return;
  if (Number(subRow.requester_id) === Number(user.id)) return;
  if (['CFO', 'PR Manager', 'HOD Approver', 'Accounts Payable', 'Accounts Manager'].includes(user.role)) {
    return;
  }
  throw new Error('Unauthorized');
}

/** Create renewal request — NO new PR. Goes directly to L1. */
export async function createSubscriptionRenewal(user, subscriptionId) {
  const [rows] = await pool.query(`SELECT * FROM cloud_subscriptions WHERE id = ? LIMIT 1`, [
    Number(subscriptionId),
  ]);
  const sub = rows[0];
  await assertCanAccessSubscription(user, sub);
  if (sub.subscription_type !== 'recurring') {
    throw new Error('Only recurring Cloud Subscriptions can be renewed');
  }
  if (!['EXPIRED', 'EXPIRING_SOON'].includes(sub.status)) {
    throw new Error(`Subscription cannot be renewed in status ${sub.status}`);
  }

  const [pending] = await pool.query(
    `SELECT id FROM subscription_renewals
     WHERE subscription_id = ?
       AND status IN ('RENEWAL_PENDING','L1_APPROVAL_PENDING','APPROVAL_IN_PROGRESS')
     LIMIT 1`,
    [sub.id]
  );
  if (pending.length) {
    throw new Error('A renewal request is already pending for this subscription');
  }

  // One renewal per current period (keyed by previous_expiry_date + next number)
  const nextRenewalNumber = Number(sub.renewal_number || 0) + 1;
  const [samePeriod] = await pool.query(
    `SELECT id FROM subscription_renewals
     WHERE subscription_id = ? AND previous_expiry_date = ? AND status = 'RENEWAL_COMPLETED'
     LIMIT 1`,
    [sub.id, ymd(sub.expiry_date)]
  );
  if (samePeriod.length) {
    throw new Error('This subscription period has already been renewed');
  }

  const [prRows] = await pool.query(
    `SELECT id, approval_user_id, approval_user_ids, department_id, requester_id, title, pr_number
     FROM purchase_requests WHERE id = ? LIMIT 1`,
    [sub.purchase_request_id]
  );
  const pr = prRows[0];
  if (!pr) throw new Error('Original purchase request not found');

  let l1Id = Number(pr.approval_user_id) || 0;
  if (!l1Id && pr.approval_user_ids) {
    try {
      const ids = typeof pr.approval_user_ids === 'string'
        ? JSON.parse(pr.approval_user_ids)
        : pr.approval_user_ids;
      l1Id = Number(Array.isArray(ids) ? ids[0] : 0) || 0;
    } catch {
      l1Id = 0;
    }
  }
  if (!l1Id) throw new Error('Original L1 approver is missing — cannot route renewal');

  const prevStart = toDateOnly(sub.start_date);
  const prevExpiry = toDateOnly(sub.expiry_date);
  const newStart = prevExpiry;
  const newExpiry = calculateExpiryDate(newStart, sub.billing_frequency);
  const label = `REN-${String(nextRenewalNumber).padStart(4, '0')}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT INTO subscription_renewals
       (renewal_number_label, subscription_id, original_purchase_request_id, renewal_number,
        requester_id, previous_start_date, previous_expiry_date, new_start_date, new_expiry_date,
        billing_frequency, status, current_stage, approval_user_id, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'L1_APPROVAL_PENDING', 'HOD_REVIEW', ?, NOW())`,
      [
        label,
        sub.id,
        sub.purchase_request_id,
        nextRenewalNumber,
        user.id,
        ymd(prevStart),
        ymd(prevExpiry),
        ymd(newStart),
        ymd(newExpiry),
        sub.billing_frequency,
        l1Id,
      ]
    );
    const renewalId = ins.insertId;

    const due = new Date();
    due.setDate(due.getDate() + 1);
    await conn.query(
      `INSERT INTO workflow_tasks
       (pr_id, task_type, assigned_role, assigned_user_id, status, due_date, subscription_renewal_id)
       VALUES (?, 'SUBSCRIPTION_RENEWAL', 'HOD Approver', ?, 'pending', ?, ?)`,
      [sub.purchase_request_id, l1Id, due.toISOString().slice(0, 10), renewalId]
    );

    await conn.query(
      `UPDATE cloud_subscriptions
       SET status = 'RENEWAL_PENDING', renewal_status = 'PENDING', updated_at = NOW()
       WHERE id = ?`,
      [sub.id]
    );

    await conn.commit();

    // Notify L1
    try {
      const [l1Rows] = await pool.query(`SELECT id, name, email FROM users WHERE id = ? LIMIT 1`, [l1Id]);
      const l1 = l1Rows[0];
      if (l1?.email) {
        queuePrApprovalPendingNotification(
          {
            id: pr.id,
            prNumber: `${pr.pr_number} · ${label}`,
            title: `Renew Cloud Subscription — ${sub.title || pr.title}`,
            totalAmount: 0,
            departmentId: pr.department_id,
            requester: user.name,
            purchaseType: 'sass',
          },
          'HOD Approver',
          { name: user.name, email: user.email },
          pr.department_id,
          {
            approverEmails: [l1.email],
            approverName: l1.name,
            stageLabel: 'Cloud Subscription Renewal — L1 Approval',
            roleDisplayName: 'L1 Manager',
          }
        );
      }
    } catch (err) {
      console.warn('Renewal L1 mail skipped:', err.message);
    }

    return getRenewalById(renewalId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getRenewalById(id) {
  const [rows] = await pool.query(`SELECT * FROM subscription_renewals WHERE id = ? LIMIT 1`, [Number(id)]);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    renewalNumberLabel: r.renewal_number_label,
    subscriptionId: r.subscription_id,
    originalPurchaseRequestId: r.original_purchase_request_id,
    renewalNumber: r.renewal_number,
    requesterId: r.requester_id,
    previousStartDate: formatDate(r.previous_start_date),
    previousExpiryDate: formatDate(r.previous_expiry_date),
    newStartDate: formatDate(r.new_start_date),
    newExpiryDate: formatDate(r.new_expiry_date),
    previousStartDateRaw: ymd(r.previous_start_date),
    previousExpiryDateRaw: ymd(r.previous_expiry_date),
    newStartDateRaw: ymd(r.new_start_date),
    newExpiryDateRaw: ymd(r.new_expiry_date),
    billingFrequency: r.billing_frequency,
    status: r.status,
    currentStage: r.current_stage,
    approvalUserId: r.approval_user_id,
    submittedAt: formatDateTime(r.submitted_at),
    completedAt: formatDateTime(r.completed_at),
  };
}

/**
 * Process renewal approval (L1 → Mugesh → Srivaths → complete).
 * Does not create a new PR.
 */
export async function processSubscriptionRenewalApproval(user, renewalId, action, remarks) {
  if (!remarks?.trim()) throw new Error('Remarks are required');
  const [rows] = await pool.query(`SELECT * FROM subscription_renewals WHERE id = ? LIMIT 1`, [
    Number(renewalId),
  ]);
  const renewal = rows[0];
  if (!renewal) throw new Error('Renewal not found');
  if (['RENEWAL_COMPLETED', 'REJECTED', 'RENEWAL_CANCELLED'].includes(renewal.status)) {
    throw new Error(`Renewal is already ${renewal.status}`);
  }

  const [taskRows] = await pool.query(
    `SELECT wt.*, u.email AS assigned_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.subscription_renewal_id = ? AND wt.status = 'pending'
     ORDER BY wt.id DESC LIMIT 1`,
    [renewal.id]
  );
  const task = taskRows[0];
  if (!task) throw new Error('No pending renewal approval task');

  const userEmail = String(user.email || '').toLowerCase().trim();
  const assignedEmail = String(task.assigned_email || '').toLowerCase().trim();
  const isAssignee =
    Number(task.assigned_user_id) === Number(user.id) ||
    (assignedEmail && userEmail && assignedEmail === userEmail) ||
    user.role === 'Super Admin';
  if (!isAssignee) throw new Error('This renewal is assigned to another approver');

  const stage = String(task.assigned_role || '');
  const [subRows] = await pool.query(`SELECT * FROM cloud_subscriptions WHERE id = ?`, [
    renewal.subscription_id,
  ]);
  const sub = subRows[0];
  const [prRows] = await pool.query(`SELECT * FROM purchase_requests WHERE id = ?`, [
    renewal.original_purchase_request_id,
  ]);
  const pr = prRows[0];

  if (action === 'reject') {
    await pool.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [task.id]
    );
    await pool.query(
      `UPDATE subscription_renewals SET status = 'REJECTED', updated_at = NOW() WHERE id = ?`,
      [renewal.id]
    );
    await pool.query(
      `UPDATE cloud_subscriptions
       SET status = 'EXPIRED', renewal_status = 'AVAILABLE', updated_at = NOW()
       WHERE id = ?`,
      [sub.id]
    );
    queueApproverActionConfirmationForUser(
      { prNumber: `${pr.pr_number} · ${renewal.renewal_number_label}`, title: sub.title, purchaseType: 'sass' },
      user,
      'reject',
      { remarks, approverRole: stage }
    );
    return getRenewalById(renewal.id);
  }

  if (action !== 'approve') throw new Error('Invalid action');

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW() WHERE id = ?`,
    [task.id]
  );

  const due = new Date();
  due.setDate(due.getDate() + 1);
  const dueStr = due.toISOString().slice(0, 10);

  if (stage === 'HOD Approver') {
    const [reqUser] = await pool.query(`SELECT email, name FROM users WHERE id = ? LIMIT 1`, [
      sub.requester_id,
    ]);
    const mugeshIsRequester = isSassMugeshRequester({
      requester_email: reqUser[0]?.email,
      requester_name: reqUser[0]?.name,
    });

    if (mugeshIsRequester) {
      const { resolveSassL2Assignment } = await import('./sassWorkflow.js');
      const a = await resolveSassL2Assignment(pr.department_id);
      await pool.query(
        `INSERT INTO workflow_tasks
         (pr_id, task_type, assigned_role, assigned_user_id, status, due_date, subscription_renewal_id)
         VALUES (?, 'SUBSCRIPTION_RENEWAL', 'PR Manager', ?, 'pending', ?, ?)`,
        [renewal.original_purchase_request_id, a.userId, dueStr, renewal.id]
      );
      await pool.query(
        `UPDATE subscription_renewals
         SET status = 'APPROVAL_IN_PROGRESS', current_stage = 'PR_MANAGER_REVIEW', updated_at = NOW()
         WHERE id = ?`,
        [renewal.id]
      );
    } else {
      const { resolveSassMugeshAssignment } = await import('./sassWorkflow.js');
      const a = await resolveSassMugeshAssignment(pr.department_id);
      await pool.query(
        `INSERT INTO workflow_tasks
         (pr_id, task_type, assigned_role, assigned_user_id, status, due_date, subscription_renewal_id)
         VALUES (?, 'SUBSCRIPTION_RENEWAL', 'CFO', ?, 'pending', ?, ?)`,
        [renewal.original_purchase_request_id, a.userId, dueStr, renewal.id]
      );
      await pool.query(
        `UPDATE subscription_renewals
         SET status = 'APPROVAL_IN_PROGRESS', current_stage = 'CFO_REVIEW', updated_at = NOW()
         WHERE id = ?`,
        [renewal.id]
      );
    }
  } else if (stage === 'CFO') {
    const { resolveSassL2Assignment } = await import('./sassWorkflow.js');
    const a = await resolveSassL2Assignment(pr.department_id);
    await pool.query(
      `INSERT INTO workflow_tasks
       (pr_id, task_type, assigned_role, assigned_user_id, status, due_date, subscription_renewal_id)
       VALUES (?, 'SUBSCRIPTION_RENEWAL', 'PR Manager', ?, 'pending', ?, ?)`,
      [renewal.original_purchase_request_id, a.userId, dueStr, renewal.id]
    );
    await pool.query(
      `UPDATE subscription_renewals
       SET status = 'APPROVAL_IN_PROGRESS', current_stage = 'PR_MANAGER_REVIEW', updated_at = NOW()
       WHERE id = ?`,
      [renewal.id]
    );
  } else if (stage === 'PR Manager') {
    await completeSubscriptionRenewal(renewal.id);
  } else {
    throw new Error(`Unexpected renewal stage: ${stage}`);
  }

  queueApproverActionConfirmationForUser(
    { prNumber: `${pr.pr_number} · ${renewal.renewal_number_label}`, title: sub.title, purchaseType: 'sass' },
    user,
    'approve',
    { remarks, approverRole: stage }
  );
  return getRenewalById(renewal.id);
}

async function completeSubscriptionRenewal(renewalId) {
  const [rows] = await pool.query(`SELECT * FROM subscription_renewals WHERE id = ? FOR UPDATE`, [
    Number(renewalId),
  ]).catch(async () => pool.query(`SELECT * FROM subscription_renewals WHERE id = ?`, [Number(renewalId)]));
  const renewal = rows[0];
  if (!renewal) throw new Error('Renewal not found');

  await pool.query(
    `UPDATE subscription_renewals
     SET status = 'RENEWAL_COMPLETED', current_stage = NULL, completed_at = NOW(), updated_at = NOW()
     WHERE id = ?`,
    [renewal.id]
  );
  await pool.query(
    `UPDATE cloud_subscriptions SET
       start_date = ?,
       expiry_date = ?,
       status = 'ACTIVE',
       renewal_status = 'RENEWED',
       renewal_number = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [ymd(renewal.new_start_date), ymd(renewal.new_expiry_date), renewal.renewal_number, renewal.subscription_id]
  );
  // Notification cycle resets automatically: new expiry_date + renewal_number in dedupe keys
}

async function recordAndSendNotification(sub, type, periodExpiryYmd) {
  const dedupeKey = `${sub.id}:${sub.renewal_number || 0}:${periodExpiryYmd}:${type}`;
  try {
    await pool.query(
      `INSERT INTO subscription_notifications
       (subscription_id, renewal_number, notification_type, period_expiry_date, dedupe_key, scheduled_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [sub.id, sub.renewal_number || 0, type, periodExpiryYmd, dedupeKey, ymd(todayUtc())]
    );
  } catch (err) {
    if (String(err.message || '').includes('Duplicate') || err.code === 'ER_DUP_ENTRY') {
      return { skipped: true, reason: 'already_sent' };
    }
    throw err;
  }

  const [reqRows] = await pool.query(`SELECT id, name, email FROM users WHERE id = ? LIMIT 1`, [
    sub.requester_id,
  ]);
  const requester = reqRows[0];
  if (!requester?.email) {
    await pool.query(
      `UPDATE subscription_notifications SET status = 'skipped', error_message = 'No requester email', sent_at = NOW()
       WHERE dedupe_key = ?`,
      [dedupeKey]
    );
    return { skipped: true, reason: 'no_email' };
  }

  const renewUrl = buildActionUrl(`/requester/cloud-subscriptions/${sub.id}/renew`);

  try {
    await queueCloudSubscriptionReminderNotification({
      toEmail: requester.email,
      subscription: mapSubscription(sub),
      notificationType: type,
      requesterName: requester.name,
      renewUrl,
      prId: sub.purchase_request_id,
    });
    await pool.query(
      `UPDATE subscription_notifications SET status = 'sent', sent_at = NOW() WHERE dedupe_key = ?`,
      [dedupeKey]
    );
    return { sent: true };
  } catch (err) {
    await pool.query(
      `UPDATE subscription_notifications SET status = 'failed', error_message = ? WHERE dedupe_key = ?`,
      [String(err.message || 'send failed').slice(0, 500), dedupeKey]
    );
    return { failed: true, error: err.message };
  }
}

/** Daily/ periodic processor — idempotent. */
export async function processCloudSubscriptionNotifications() {
  const today = todayUtc();
  const todayStr = ymd(today);
  let markedExpired = 0;
  let sent = 0;
  let skipped = 0;

  // Mark expired (Day 0) — no email
  const [toExpire] = await pool.query(
    `SELECT * FROM cloud_subscriptions
     WHERE subscription_type = 'recurring'
       AND status IN ('ACTIVE', 'EXPIRING_SOON')
       AND expiry_date <= ?`,
    [todayStr]
  );
  for (const sub of toExpire) {
    await pool.query(
      `UPDATE cloud_subscriptions
       SET status = 'EXPIRED', renewal_status = 'AVAILABLE', updated_at = NOW()
       WHERE id = ? AND status IN ('ACTIVE','EXPIRING_SOON')`,
      [sub.id]
    );
    markedExpired += 1;
  }

  // Expiring soon flag (within 7 days)
  await pool.query(
    `UPDATE cloud_subscriptions
     SET status = 'EXPIRING_SOON', updated_at = NOW()
     WHERE subscription_type = 'recurring'
       AND status = 'ACTIVE'
       AND expiry_date > ?
       AND expiry_date <= ?`,
    [todayStr, ymd(addDays(today, 7))]
  );

  const [activeLike] = await pool.query(
    `SELECT * FROM cloud_subscriptions
     WHERE subscription_type = 'recurring'
       AND status IN ('ACTIVE', 'EXPIRING_SOON', 'EXPIRED')
       AND renewal_status <> 'PENDING'`
  );

  for (const sub of activeLike) {
    const expiry = toDateOnly(sub.expiry_date);
    if (!expiry) continue;
    const expiryStr = ymd(expiry);
    const delta = daysBetween(today, expiry); // positive = before expiry

    const trySend = async (type) => {
      const result = await recordAndSendNotification(sub, type, expiryStr);
      if (result.sent) sent += 1;
      else skipped += 1;
    };

    if (sub.status === 'ACTIVE' || sub.status === 'EXPIRING_SOON') {
      if (delta === 7) await trySend('EXPIRY_7_DAYS');
      else if (delta === 3) await trySend('EXPIRY_3_DAYS');
      else if (delta === 1) await trySend('EXPIRY_1_DAY');
      // delta === 0 → expired handled above / no email
    } else if (sub.status === 'EXPIRED') {
      const after = daysBetween(expiry, today);
      if (after === 1) await trySend('POST_EXPIRY_DAY_1');
      else if (after === 2) await trySend('POST_EXPIRY_DAY_2');
    }
  }

  return { markedExpired, sent, skipped, checked: activeLike.length };
}

let subSchedulerStarted = false;
let subSchedulerRunning = false;

export function startCloudSubscriptionScheduler() {
  if (subSchedulerStarted) return;
  subSchedulerStarted = true;
  const intervalMs = Number(process.env.CLOUD_SUB_CHECK_INTERVAL_MS) || 60 * 60 * 1000;
  const run = async () => {
    if (subSchedulerRunning) return;
    subSchedulerRunning = true;
    try {
      const result = await processCloudSubscriptionNotifications();
      if (result.sent || result.markedExpired) {
        console.log(
          `Cloud subscription scheduler: expired=${result.markedExpired}, sent=${result.sent}, skipped=${result.skipped}`
        );
      }
    } catch (err) {
      console.error('Cloud subscription scheduler failed:', err.message);
    } finally {
      subSchedulerRunning = false;
    }
  };
  setTimeout(run, 20_000);
  setInterval(run, intervalMs);
  console.log(
    `Cloud subscription scheduler started (every ${Math.round(intervalMs / 60000)} min)`
  );
}

// Re-export date helpers for tests
export const __test = {
  calculateExpiryDate,
  ymd,
  addDays,
  daysBetween,
  toDateOnly,
  NOTIFICATION_TYPES,
};
