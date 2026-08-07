import pool from '../config/db.js';

/** Default SCM Buyer for all SCM Buyer task assignment + mail */
export const DEFAULT_SCM_BUYER_EMAIL = 'gopikrishnan.p@refex.co.in';

export function getPreferredScmBuyerEmail() {
  return String(process.env.SCM_BUYER_EMAIL || DEFAULT_SCM_BUYER_EMAIL)
    .trim()
    .toLowerCase();
}

/**
 * Resolve the SCM Buyer user for task assignment / step mail.
 * Prefers SCM_BUYER_EMAIL (default: gopikrishnan.p@refex.co.in), else first active SCM Buyer.
 */
export async function resolveScmBuyerUser(conn = null) {
  const db = conn || pool;
  const preferred = getPreferredScmBuyerEmail();

  const [preferredRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE LOWER(email) = ? AND is_active = 1
     LIMIT 1`,
    [preferred]
  );
  if (preferredRows[0]) {
    return {
      id: preferredRows[0].id,
      userId: preferredRows[0].id,
      email: preferredRows[0].email,
      name: preferredRows[0].name,
      role: preferredRows[0].role,
    };
  }

  const [fallbackRows] = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE role = 'SCM Buyer' AND is_active = 1
     ORDER BY id ASC
     LIMIT 1`
  );
  if (!fallbackRows[0]) return null;

  return {
    id: fallbackRows[0].id,
    userId: fallbackRows[0].id,
    email: fallbackRows[0].email,
    name: fallbackRows[0].name,
    role: fallbackRows[0].role,
  };
}

/** Ensure preferred user has SCM Buyer role (idempotent). */
export async function ensurePreferredScmBuyerRole(conn = null) {
  const db = conn || pool;
  const preferred = getPreferredScmBuyerEmail();
  const [result] = await db.query(
    `UPDATE users
     SET role = 'SCM Buyer', is_active = 1
     WHERE LOWER(email) = ? AND (role <> 'SCM Buyer' OR is_active <> 1)`,
    [preferred]
  );
  return result?.affectedRows || 0;
}

/** Reassign all pending SCM Buyer workflow tasks to the preferred buyer. */
export async function reassignPendingScmBuyerTasks(conn = null) {
  const buyer = await resolveScmBuyerUser(conn);
  if (!buyer?.id) return { buyer: null, updated: 0 };

  const db = conn || pool;
  const [result] = await db.query(
    `UPDATE workflow_tasks
     SET assigned_user_id = ?
     WHERE assigned_role = 'SCM Buyer'
       AND status = 'pending'
       AND (assigned_user_id IS NULL OR assigned_user_id <> ?)`,
    [buyer.id, buyer.id]
  );

  return { buyer, updated: result?.affectedRows || 0 };
}
