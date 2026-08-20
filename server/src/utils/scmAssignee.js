import bcrypt from 'bcryptjs';
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

/** Default SCM Manager for login, task assignment, and mail. */
export const DEFAULT_SCM_MANAGER_EMAIL = 'rajeev.v@refex.co.in';
export const DEFAULT_SCM_MANAGER_NAME = 'Rajeev V';

export function getPreferredScmManagerEmail() {
  return String(process.env.SCM_MANAGER_EMAIL || DEFAULT_SCM_MANAGER_EMAIL)
    .trim()
    .toLowerCase();
}

export function getPreferredScmManagerName() {
  return String(process.env.SCM_MANAGER_NAME || DEFAULT_SCM_MANAGER_NAME).trim() || DEFAULT_SCM_MANAGER_NAME;
}

/**
 * Resolve the preferred SCM Manager user (Rajeev), else first active SCM Manager.
 */
export async function resolveScmManagerUser(conn = null) {
  const db = conn || pool;
  const email = getPreferredScmManagerEmail();
  const [rows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE LOWER(email) = ? AND is_active = 1
     LIMIT 1`,
    [email]
  );
  if (rows[0]) return mapBuyerRow(rows[0]);

  const [fallbackRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE role = 'SCM Manager' AND is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  return fallbackRows[0] ? mapBuyerRow(fallbackRows[0]) : null;
}

export async function getScmManagerNotifyEmails(conn = null) {
  const emails = new Set([getPreferredScmManagerEmail()]);
  const user = await resolveScmManagerUser(conn);
  if (user?.email) emails.add(String(user.email).trim().toLowerCase());
  return [...emails];
}

/**
 * Ensure Rajeev is the SCM Manager login (converts Vikram Singh demo account when needed).
 */
export async function ensurePreferredScmManagerUser(conn = null) {
  const db = conn || pool;
  const email = getPreferredScmManagerEmail();
  const name = getPreferredScmManagerName();

  const [byEmail] = await db.query(
    `SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [email]
  );
  if (byEmail[0]) {
    await db.query(
      `UPDATE users
       SET role = 'SCM Manager', is_active = 1
       WHERE id = ? AND (role <> 'SCM Manager' OR is_active <> 1)`,
      [byEmail[0].id]
    );
    await db.query(
      `UPDATE users SET name = ? WHERE id = ? AND (name = 'Vikram Singh' OR name = '' OR name IS NULL)`,
      [name, byEmail[0].id]
    );
    await db.query(
      `UPDATE users
       SET is_active = 0
       WHERE role = 'SCM Manager'
         AND id <> ?
         AND (LOWER(email) = 'scmmanager@procure.com' OR name = 'Vikram Singh')`,
      [byEmail[0].id]
    );
    return byEmail[0].id;
  }

  const [demo] = await db.query(
    `SELECT id FROM users
     WHERE LOWER(email) = 'scmmanager@procure.com'
        OR (role = 'SCM Manager' AND name = 'Vikram Singh')
     ORDER BY CASE WHEN LOWER(email) = 'scmmanager@procure.com' THEN 0 ELSE 1 END, id ASC
     LIMIT 1`
  );
  if (demo[0]) {
    await db.query(
      `UPDATE users SET email = ?, name = ?, role = 'SCM Manager', is_active = 1 WHERE id = ?`,
      [email, name, demo[0].id]
    );
    return demo[0].id;
  }

  const [anyMgr] = await db.query(
    `SELECT id FROM users WHERE role = 'SCM Manager' ORDER BY id ASC LIMIT 1`
  );
  if (anyMgr[0]) {
    await db.query(
      `UPDATE users SET email = ?, name = ?, is_active = 1 WHERE id = ?`,
      [email, name, anyMgr[0].id]
    );
    return anyMgr[0].id;
  }

  const hash = await bcrypt.hash('demo1234', 10);
  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, 'SCM Manager', 1)`,
    [name, email, hash]
  );
  return result.insertId;
}

/** Point every pending SCM Manager workflow task at Rajeev's user id. */
export async function reassignPendingScmManagerTasks(conn = null) {
  const manager = await resolveScmManagerUser(conn);
  if (!manager?.id) return { manager: null, updated: 0 };
  const db = conn || pool;
  const [result] = await db.query(
    `UPDATE workflow_tasks
     SET assigned_user_id = ?
     WHERE assigned_role = 'SCM Manager'
       AND status = 'pending'`,
    [manager.id]
  );
  return { manager, updated: result?.affectedRows || 0 };
}

export async function insertScmManagerPoApprovalTask(db, prId, dueDateStr) {
  const manager = await resolveScmManagerUser(db);
  await db.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PO_APPROVAL', 'SCM Manager', ?, 'pending', ?)`,
    [prId, manager?.id || null, dueDateStr]
  );
  return manager;
}
