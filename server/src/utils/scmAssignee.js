import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

/** Default SCM Buyer for task assignment + mail. */
export const DEFAULT_SCM_BUYER_EMAILS = ['deepa.murthy@refex.co.in'];
export const DEFAULT_SCM_BUYER_NAMES = {
  'deepa.murthy@refex.co.in': 'Deepa Murthy',
};
/** Local /admin/login password for designated SCM Buyer accounts. */
export const DEFAULT_SCM_BUYER_PASSWORD = String(
  process.env.SCM_BUYER_PASSWORD || 'Welcome@2026'
).trim();

/** Former designated buyers — never assign or notify, even if still in env. */
const REMOVED_SCM_BUYER_EMAILS = [
  'gopikrishnan.p@refex.co.in',
  'satish.manickam@refex.co.in',
  'rajeev.v@refex.co.in',
];

/** @deprecated use DEFAULT_SCM_BUYER_EMAILS / getPreferredScmBuyerEmails() */
export const DEFAULT_SCM_BUYER_EMAIL = DEFAULT_SCM_BUYER_EMAILS[0];

export function getPreferredScmBuyerEmails() {
  const fromEnv = String(process.env.SCM_BUYER_EMAILS || process.env.SCM_BUYER_EMAIL || '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_SCM_BUYER_EMAILS, ...fromEnv])].filter(
    (email) => !REMOVED_SCM_BUYER_EMAILS.includes(email)
  );
}

export function getPreferredScmBuyerEmail() {
  return getPreferredScmBuyerEmails()[0];
}

/** Designated SCM Buyers may edit any draft PO, not only ones they created. */
export function canEditAnyScmPurchaseOrder(user) {
  if (!user) return false;
  if (user.role === 'Super Admin' || user.role === 'SCM Manager') return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return false;
  return getPreferredScmBuyerEmails().includes(email);
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
  const removed = REMOVED_SCM_BUYER_EMAILS;
  const notRemoved = removed.length
    ? `AND LOWER(email) NOT IN (${removed.map(() => '?').join(', ')})`
    : '';
  const [fallbackRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE role = 'SCM Buyer' AND is_active = 1
       ${notRemoved}
     ORDER BY id ASC
     LIMIT 1`,
    removed
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

function buyerDisplayName(email) {
  return DEFAULT_SCM_BUYER_NAMES[email] || email.split('@')[0] || 'SCM Buyer';
}

/** Ensure configured buyers exist with SCM Buyer role; demote former designated buyers. */
export async function ensurePreferredScmBuyerRole(conn = null) {
  const db = conn || pool;
  const emails = getPreferredScmBuyerEmails();
  let updated = 0;

  const hash = await bcrypt.hash(DEFAULT_SCM_BUYER_PASSWORD, 10);
  for (const email of emails) {
    const [rows] = await db.query(`SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`, [email]);
    if (rows[0]) {
      const [result] = await db.query(
        `UPDATE users
         SET name = ?,
             role = 'SCM Buyer',
             is_active = 1,
             password_hash = ?
         WHERE id = ?`,
        [buyerDisplayName(email), hash, rows[0].id]
      );
      updated += result?.affectedRows || 0;
    } else {
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES (?, ?, ?, 'SCM Buyer', 1)`,
        [buyerDisplayName(email), email, hash]
      );
      updated += 1;
    }
  }

  const former = REMOVED_SCM_BUYER_EMAILS.filter((email) => !emails.includes(email));
  if (former.length) {
    const placeholders = former.map(() => '?').join(', ');
    await db.query(
      `UPDATE users
       SET role = 'Requester'
       WHERE LOWER(email) IN (${placeholders})
         AND role = 'SCM Buyer'`,
      former
    );
  }

  return updated;
}

/**
 * Reassign pending SCM Buyer workflow tasks to role-queue (NULL user)
 * so every active designated SCM Buyer can act.
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
export const DEFAULT_SCM_MANAGER_EMAIL = 'mounesh.r@refex.co.in';
export const DEFAULT_SCM_MANAGER_NAME = 'Mounesh Rathakar';
export const DEFAULT_SCM_MANAGER_DESIGNATION = 'Head Procurement';

const REMOVED_SCM_MANAGER_EMAILS = ['rajeev.v@refex.co.in'];

export function getPreferredScmManagerEmail() {
  const fromEnv = String(process.env.SCM_MANAGER_EMAIL || '')
    .trim()
    .toLowerCase();
  if (fromEnv && !REMOVED_SCM_MANAGER_EMAILS.includes(fromEnv)) return fromEnv;
  return DEFAULT_SCM_MANAGER_EMAIL;
}

export function getPreferredScmManagerName() {
  const fromEnv = String(process.env.SCM_MANAGER_NAME || '').trim();
  if (
    fromEnv &&
    !['rajeev v', 'mounesh r', 'mounesh.r', 'scm manager'].includes(fromEnv.toLowerCase())
  ) {
    return fromEnv;
  }
  return DEFAULT_SCM_MANAGER_NAME;
}

export function getPreferredScmManagerDesignation() {
  const fromEnv = String(process.env.SCM_MANAGER_DESIGNATION || '').trim();
  return fromEnv || DEFAULT_SCM_MANAGER_DESIGNATION;
}

function isPlaceholderScmManagerName(name) {
  const n = String(name || '').trim().toLowerCase();
  return (
    !n ||
    n === 'mounesh r' ||
    n === 'mounesh.r' ||
    n === 'mounesh' ||
    n === 'scm manager' ||
    n === 'vikram singh' ||
    n === 'rajeev v' ||
    n.startsWith('mounesh.r')
  );
}

/** Name printed on the signed PO — never the email local-part. */
export function resolveScmManagerSignName({ holderName, signatureName, user } = {}) {
  const preferred = getPreferredScmManagerName();
  const email = String(user?.email || '').trim().toLowerCase();
  const isDesignated =
    email === getPreferredScmManagerEmail() || email.includes('mounesh.r@');
  const holder = String(holderName || '').trim();
  if (holder && !isPlaceholderScmManagerName(holder)) return holder;
  const typed = String(signatureName || '').trim();
  if (isDesignated && isPlaceholderScmManagerName(typed || user?.name)) return preferred;
  return typed || String(user?.name || '').trim() || preferred;
}

/**
 * Resolve the preferred SCM Manager user (Mounesh), else first active SCM Manager.
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

  const removedMgr = REMOVED_SCM_MANAGER_EMAILS;
  const notRemovedMgr = removedMgr.length
    ? `AND LOWER(email) NOT IN (${removedMgr.map(() => '?').join(', ')})`
    : '';
  const [fallbackRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE role = 'SCM Manager' AND is_active = 1
       ${notRemovedMgr}
     ORDER BY id ASC
     LIMIT 1`,
    removedMgr
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
 * Ensure the designated SCM Manager login exists (converts Vikram Singh demo account when needed).
 * Does not rewrite another live manager's email (e.g. Rajeev) to the new assignee.
 */
export async function ensurePreferredScmManagerUser(conn = null) {
  const db = conn || pool;
  const email = getPreferredScmManagerEmail();
  const name = getPreferredScmManagerName();

  const [byEmail] = await db.query(
    `SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1`,
    [email]
  );
  let managerId = byEmail[0]?.id || null;
  if (managerId) {
    await db.query(
      `UPDATE users
       SET role = 'SCM Manager', is_active = 1
       WHERE id = ? AND (role <> 'SCM Manager' OR is_active <> 1)`,
      [managerId]
    );
    await db.query(`UPDATE users SET name = ? WHERE id = ?`, [name, managerId]);
  } else {
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
      managerId = demo[0].id;
    } else {
      const hash = await bcrypt.hash('demo1234', 10);
      const [result] = await db.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES (?, ?, ?, 'SCM Manager', 1)`,
        [name, email, hash]
      );
      managerId = result.insertId;
    }
  }

  await db.query(
    `UPDATE users
     SET is_active = 0
     WHERE role = 'SCM Manager'
       AND id <> ?
       AND (LOWER(email) = 'scmmanager@procure.com' OR name = 'Vikram Singh')`,
    [managerId]
  );

  const former = REMOVED_SCM_MANAGER_EMAILS.filter((e) => e !== email);
  if (former.length) {
    const placeholders = former.map(() => '?').join(', ');
    await db.query(
      `UPDATE users
       SET role = 'Requester'
       WHERE LOWER(email) IN (${placeholders})
         AND role = 'SCM Manager'
         AND id <> ?`,
      [...former, managerId]
    );
  }

  return managerId;
}

/** Point every pending SCM Manager workflow task at the designated manager. */
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

/**
 * Who should receive Buyer Final Verify (task + mail).
 * Prefer the PO creator when they are an active SCM Buyer; else designated buyer.
 */
export async function resolveBuyerVerifyAssignee(po, conn = null) {
  const db = conn || pool;
  const createdBy = Number(po?.createdByUserId || po?.created_by || 0);
  if (createdBy) {
    const [rows] = await db.query(
      `SELECT id, email, name, role
       FROM users
       WHERE id = ? AND is_active = 1 AND role = 'SCM Buyer'
       LIMIT 1`,
      [createdBy]
    );
    if (rows[0]) return mapBuyerRow(rows[0]);
  }
  return resolveScmBuyerUser(db);
}

export async function insertScmBuyerVerifyTask(db, prId, dueDateStr, assignedUserId = null) {
  const buyer = assignedUserId
    ? { id: assignedUserId }
    : await resolveScmBuyerUser(db);
  await db.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PO_BUYER_VERIFY', 'SCM Buyer', ?, 'pending', ?)`,
    [prId, buyer?.id || null, dueDateStr]
  );
  return buyer;
}
