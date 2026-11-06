import pool from '../config/db.js';
import { isSuperAdmin } from './permissionService.js';

/**
 * Cross-app search for the top-bar "What are you looking for today?" box.
 * Returns PRs and POs the caller is allowed to see.
 */
export async function globalSearch(user, rawQuery, { limit = 8 } = {}) {
  const q = String(rawQuery || '').trim();
  if (q.length < 1) {
    return { query: '', prs: [], pos: [] };
  }

  const like = `%${q}%`;
  const take = Math.min(20, Math.max(1, Number(limit) || 8));
  const ownOnly = user.role === 'Requester' && !isSuperAdmin(user.role);

  const prParams = [like, like, like, like, like, like];
  let prScope = '';
  if (ownOnly) {
    prScope = ' AND pr.requester_id = ?';
    prParams.push(user.id);
  }
  prParams.push(take);

  const [prRows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.status, pr.total_amount, pr.purchase_type,
            u.name AS requester_name, d.name AS department_name,
            e.name AS entity_name, e.code AS entity_code
     FROM purchase_requests pr
     JOIN users u ON u.id = pr.requester_id
     JOIN departments d ON d.id = pr.department_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     WHERE (
       pr.pr_number LIKE ?
       OR pr.title LIKE ?
       OR IFNULL(u.name, '') LIKE ?
       OR IFNULL(d.name, '') LIKE ?
       OR IFNULL(e.name, '') LIKE ?
       OR IFNULL(e.code, '') LIKE ?
     )
     ${prScope}
     ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC
     LIMIT ?`,
    prParams
  );

  const poParams = [like, like, like, like, like];
  let poScope = '';
  if (ownOnly) {
    poScope = ' AND pr.requester_id = ?';
    poParams.push(user.id);
  }
  poParams.push(take);

  const [poRows] = await pool.query(
    `SELECT po.id, po.po_number, po.status, po.grand_total, po.vendor_name,
            pr.id AS pr_id, pr.pr_number, pr.title
     FROM purchase_orders po
     JOIN purchase_requests pr ON pr.id = po.pr_id
     WHERE (
       po.po_number LIKE ?
       OR IFNULL(po.vendor_name, '') LIKE ?
       OR IFNULL(po.reference_po_number, '') LIKE ?
       OR pr.pr_number LIKE ?
       OR pr.title LIKE ?
     )
     ${poScope}
     ORDER BY COALESCE(po.updated_at, po.created_at) DESC, po.id DESC
     LIMIT ?`,
    poParams
  );

  return {
    query: q,
    prs: prRows.map((row) => ({
      id: row.id,
      prNumber: row.pr_number,
      title: row.title || '',
      status: row.status || '',
      amount: Number(row.total_amount || 0),
      purchaseType: row.purchase_type || 'purchase_order',
      requester: row.requester_name || '',
      department: row.department_name || '',
      entity: row.entity_code || row.entity_name || '',
    })),
    pos: poRows.map((row) => ({
      id: row.id,
      poNumber: row.po_number,
      status: row.status || '',
      amount: Number(row.grand_total || 0),
      vendorName: row.vendor_name || '',
      prId: row.pr_id,
      prNumber: row.pr_number || '',
      title: row.title || '',
    })),
  };
}
