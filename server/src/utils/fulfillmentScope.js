import pool from '../config/db.js';

/** Menu permissions that open the post-PO screens (Admin → User Permissions). */
export const VENDOR_ACCEPTANCE_PERMS = ['nav.requester_vendor_po_acceptance', 'nav.vendor_po_acceptance'];
export const GRN_PERMS = ['nav.grn'];
export const VENDOR_INVOICE_PERMS = ['nav.requester_vendor_invoice', 'nav.vendor_invoice'];

/** Post-PO work that can be assigned to a person. */
const FULFILLMENT_TASK_TYPES = ['PO_VENDOR_ACCEPTANCE', 'GRN_ENTRY', 'INVOICE_ENTRY', 'INVOICE_UPLOAD'];

/**
 * SQL filter for people who only see their own work (Requester, L1 Manager, …):
 * the PR they raised, or a post-PO task assigned to them. Two `?` → [userId, userId].
 */
export function ownFulfillmentSql(prAlias = 'pr', poAlias = 'po') {
  return ` AND (
    ${prAlias}.requester_id = ?
    OR EXISTS (
      SELECT 1 FROM workflow_tasks wt_own
      WHERE wt_own.pr_id = ${poAlias}.pr_id
        AND wt_own.assigned_user_id = ?
        AND wt_own.task_type IN (${FULFILLMENT_TASK_TYPES.map((t) => `'${t}'`).join(', ')})
    )
  )`;
}

/** True when this user raised the PO's PR or holds a post-PO task on it. */
export async function userOwnsFulfillment(user, poId) {
  if (!user?.id || !poId) return false;
  const [rows] = await pool.query(
    `SELECT 1
     FROM purchase_orders po
     JOIN purchase_requests pr ON pr.id = po.pr_id
     WHERE po.id = ? ${ownFulfillmentSql('pr', 'po')}
     LIMIT 1`,
    [poId, user.id, user.id]
  );
  return rows.length > 0;
}
