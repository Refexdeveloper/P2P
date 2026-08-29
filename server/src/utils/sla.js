/** Default approval SLA per workflow stage (hours from task creation). */
export const APPROVAL_SLA_HOURS = Number(process.env.APPROVAL_SLA_HOURS) || 24;

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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
