import pool from '../config/db.js';

/** Default SCM Buyers for task assignment + mail (Gopi + Satish). */
export const DEFAULT_SCM_BUYER_EMAILS = [
  'gopikrishnan.p@refex.co.in',
  'satish.manickam@refex.co.in',
];

/** @deprecated use DEFAULT_SCM_BUYER_EMAILS / getPreferredScmBuyerEmails() */
export const DEFAULT_SCM_BUYER_EMAIL = DEFAULT_SCM_BUYER_EMAILS[0];

export function getPreferredScmBuyerEmails() {
  const fromEnv = String(process.env.SCM_BUYER_EMAILS || process.env.SCM_BUYER_EMAIL || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_SCM_BUYER_EMAILS, ...fromEnv])];
}

export function getPreferredScmBuyerEmail() {
  return getPreferredScmBuyerEmails()[0];
}

function mapBuyerRow(row) {
  return {
    id: row.id,
    userId: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

/**
 * Resolve all configured SCM Buyer users (active).
 */
export async function resolveScmBuyerUsers(conn = null) {
  const db = conn || pool;
  const emails = getPreferredScmBuyerEmails();
  if (!emails.length) return [];

  const placeholders = emails.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE LOWER(email) IN (${placeholders}) AND is_active = 1
     ORDER BY FIELD(LOWER(email), ${placeholders})`,
    [...emails, ...emails]
  );
  return (rows || []).map(mapBuyerRow);
}

/**
 * Resolve the primary SCM Buyer user (first configured email).
 * Prefers configured list, else first active SCM Buyer.
 */
export async function resolveScmBuyerUser(conn = null) {
  const users = await resolveScmBuyerUsers(conn);
  if (users[0]) return users[0];

  const db = conn || pool;
  const [fallbackRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE role = 'SCM Buyer' AND is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  if (!fallbackRows[0]) return null;
  return mapBuyerRow(fallbackRows[0]);
}

/** Emails to notify for every SCM Buyer step (configured list + matched users). */
export async function getScmBuyerNotifyEmails(conn = null) {
  const emails = new Set(getPreferredScmBuyerEmails());
  const users = await resolveScmBuyerUsers(conn);
  for (const u of users) {
    if (u.email) emails.add(String(u.email).trim().toLowerCase());
  }
  return [...emails];
}

/** Ensure all configured buyers have SCM Buyer role (idempotent). */
export async function ensurePreferredScmBuyerRole(conn = null) {
  const db = conn || pool;
  const emails = getPreferredScmBuyerEmails();
  if (!emails.length) return 0;
  const placeholders = emails.map(() => '?').join(', ');
  const [result] = await db.query(
    `UPDATE users
     SET role = 'SCM Buyer', is_active = 1
     WHERE LOWER(email) IN (${placeholders})
       AND (role <> 'SCM Buyer' OR is_active <> 1)`,
    emails
  );
  return result?.affectedRows || 0;
}

/**
 * Reassign pending SCM Buyer workflow tasks to role-queue (NULL user)
 * so every active SCM Buyer (Gopi + Satish) can act.
 */
export async function reassignPendingScmBuyerTasks(conn = null) {
  const buyers = await resolveScmBuyerUsers(conn);
  const db = conn || pool;
  const [result] = await db.query(
    `UPDATE workflow_tasks
     SET assigned_user_id = NULL
     WHERE assigned_role = 'SCM Buyer'
       AND status = 'pending'
       AND assigned_user_id IS NOT NULL`
  );

  return { buyers, buyer: buyers[0] || null, updated: result?.affectedRows || 0 };
}
