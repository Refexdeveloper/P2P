import 'dotenv/config';
import pool from '../src/config/db.js';
import { PR_STATUS, STAGE } from '../src/utils/constants.js';

/**
 * Heal PRs stuck as APPROVED after RFQ finalize but before PO create
 * (caused by SCM Buyer "approve" on RFQ Approval clearing PENDING_SCM_PO).
 */
const [orphans] = await pool.query(
  `SELECT pr.id, pr.pr_number
   FROM purchase_requests pr
   JOIN rfq_configs rc ON rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
   LEFT JOIN purchase_orders po ON po.pr_id = pr.id
     AND po.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
   WHERE pr.status = ?
     AND po.id IS NULL`,
  [PR_STATUS.APPROVED]
);

console.log(`Found ${orphans.length} orphan PR(s)`);

for (const row of orphans) {
  await pool.query(
    `UPDATE purchase_requests
     SET status = ?, current_stage = ?, updated_at = NOW()
     WHERE id = ?`,
    [PR_STATUS.PENDING_SCM_PO, STAGE.SCM_PO_CREATE, row.id]
  );

  const [pending] = await pool.query(
    `SELECT id FROM workflow_tasks
     WHERE pr_id = ? AND task_type = 'RFQ_POST_APPROVAL'
       AND assigned_role = 'SCM Buyer' AND status = 'pending'
     LIMIT 1`,
    [row.id]
  );

  if (!pending.length) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 2);
    await pool.query(
      `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date)
       VALUES (?, 'RFQ_POST_APPROVAL', 'SCM Buyer', 'pending', ?)`,
      [row.id, dueDate.toISOString().split('T')[0]]
    );
  }

  console.log(`Healed ${row.pr_number} (id=${row.id}) → PENDING_SCM_PO`);
}

await pool.end();
