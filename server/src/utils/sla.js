/** Default approval SLA per workflow stage (hours from task creation). */
export const APPROVAL_SLA_HOURS = Number(process.env.APPROVAL_SLA_HOURS) || 24;

/** Roles that receive repeated morning/evening SLA-breach reminders (User / L1 / L2). */
export const DAILY_SLA_REMINDER_ROLES = new Set(['HOD Approver', 'PR Manager']);

/**
 * SCM Buyer keeps one-time SLA mail only.
 * SCM Manager PO Sign & Approval (PO_APPROVAL) also gets morning/evening repeats until done.
 */
export const SCM_SLA_ONE_TIME_ROLES = new Set(['SCM Buyer', 'SCM Manager']);

/** Twice-daily reminder slots (Asia/Kolkata morning + evening by default). */
export const SLA_REMINDER_SLOTS = Object.freeze({
  MORNING: 'MORNING',
  EVENING: 'EVENING',
});

export function normalizeSlaReminderSlot(slot) {
  const raw = String(slot || '').trim().toUpperCase();
  if (raw === SLA_REMINDER_SLOTS.EVENING) return SLA_REMINDER_SLOTS.EVENING;
  return SLA_REMINDER_SLOTS.MORNING;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatSlaDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole calendar days since task start (for "X days waiting"). */
export function getSlaWaitingDays(createdAt, now = new Date()) {
  const start = toDate(createdAt);
  if (!start) return 0;
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/**
 * Display label for daily SLA emails:
 * User Approval | L1 Manager Approval | L2 Manager Approval | PO Sign & Approval
 */
export function getDailySlaApprovalTypeLabel(assignedRole, prFlow = 'standard', taskType = '') {
  const role = String(assignedRole || '').trim();
  const type = String(taskType || '').trim();
  if (role === 'SCM Manager' && (type === 'PO_APPROVAL' || !type)) {
    return 'PO Sign & Approval';
  }
  if (role === 'PR Manager') return 'L2 Manager Approval';
  if (role === 'HOD Approver') {
    return String(prFlow || '').toLowerCase() === 'functional'
      ? 'User Approval'
      : 'L1 Manager Approval';
  }
  return role || 'Approval';
}

export function isDailySlaReminderRole(assignedRole) {
  return DAILY_SLA_REMINDER_ROLES.has(String(assignedRole || '').trim());
}

/**
 * Who gets morning/evening SLA repeats while the task stays pending past 24h.
 * - HOD Approver / PR Manager: PR approval stages
 * - SCM Manager: PO Sign & Approval (PO_APPROVAL) only
 */
export function shouldReceiveDailySlaReminder(assignedRole, taskType = '') {
  const role = String(assignedRole || '').trim();
  const type = String(taskType || '').trim();
  if (DAILY_SLA_REMINDER_ROLES.has(role)) return true;
  if (role === 'SCM Manager' && type === 'PO_APPROVAL') return true;
  return false;
}

/** Whole hours since the pending task started (for "pending X hours" in SLA mail). */
export function getSlaPendingHours(createdAt, now = new Date()) {
  const start = toDate(createdAt);
  if (!start) return 0;
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 3600000));
}

/** Hours past the SLA deadline (0 if not yet breached). */
export function getSlaOverdueHours(createdAt, dueDate = null, slaHours = APPROVAL_SLA_HOURS, now = new Date()) {
  const deadline = getTaskSlaDeadlineMs(createdAt, dueDate, slaHours);
  return Math.max(0, Math.floor((now.getTime() - deadline) / 3600000));
}

/** SLA deadline for a pending workflow task (stage start = task created_at). */
export function getTaskSlaDeadlineMs(createdAt, dueDate = null, slaHours = APPROVAL_SLA_HOURS) {
  const started = toDate(createdAt) || new Date();
  const hourDeadline = started.getTime() + slaHours * 3600000;

  const due = toDate(dueDate);
  if (!due) return hourDeadline;

  const dueEnd = new Date(due);
  dueEnd.setHours(23, 59, 59, 999);
  return Math.min(hourDeadline, dueEnd.getTime());
}

export function getTaskSlaHoursRemaining(createdAt, dueDate = null, slaHours = APPROVAL_SLA_HOURS) {
  const deadline = getTaskSlaDeadlineMs(createdAt, dueDate, slaHours);
  return Math.max(0, Math.round((deadline - Date.now()) / 3600000));
}

export function isTaskSlaBreached(createdAt, dueDate = null, slaHours = APPROVAL_SLA_HOURS) {
  return Date.now() > getTaskSlaDeadlineMs(createdAt, dueDate, slaHours);
}

/** SQL fragment params: use task created_at + optional due_date only (never PR submit time). */
export function taskSlaBreachedSql(alias = 'wt', slaHours = APPROVAL_SLA_HOURS) {
  return `(
    DATE_ADD(${alias}.created_at, INTERVAL ${Number(slaHours)} HOUR) < NOW()
    OR (${alias}.due_date IS NOT NULL AND ${alias}.due_date < CURDATE())
  )`;
}

/** Task breached before it was completed/cancelled (for late breach mail after stage change). */
export function taskSlaBreachedBeforeCompleteSql(alias = 'wt', slaHours = APPROVAL_SLA_HOURS) {
  return `(
    DATE_ADD(${alias}.created_at, INTERVAL ${Number(slaHours)} HOUR) < ${alias}.completed_at
    OR (${alias}.due_date IS NOT NULL AND ${alias}.due_date < DATE(${alias}.completed_at))
  )`;
}
