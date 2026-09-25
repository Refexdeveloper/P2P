import 'dotenv/config';
import crypto from 'crypto';
import pool from '../src/config/db.js';

/**
 * Heal POs/WOs that should be in vendor acceptance:
 * - already sent_to_vendor (ensure token + pending)
 * - awaiting_grn without completed acceptance (move back to sent_to_vendor)
 *   so GRN only after vendor accepts
 */
const [rows] = await pool.query(
  `SELECT id, status, vendor_acceptance_token, vendor_acceptance_status,
          vendor_accepted_at, vendor_acceptance_file_name, pr_id
   FROM purchase_orders
   WHERE status = 'sent_to_vendor'
      OR (
           status = 'awaiting_grn'
           AND (
             vendor_acceptance_status IS NULL
             OR vendor_acceptance_status = 'pending'
             OR (
               vendor_acceptance_status NOT IN ('accepted', 'rejected', 'partial')
               AND vendor_accepted_at IS NULL
               AND (vendor_acceptance_file_name IS NULL OR vendor_acceptance_file_name = '')
             )
           )
         )`
);

let n = 0;
for (const r of rows) {
  const token = r.vendor_acceptance_token || crypto.randomBytes(24).toString('hex');
  const finished = ['accepted', 'rejected', 'partial'].includes(
    String(r.vendor_acceptance_status || '').toLowerCase()
  );
  if (finished) continue;

  await pool.query(
    `UPDATE purchase_orders
     SET status = 'sent_to_vendor',
         vendor_acceptance_token = ?,
         vendor_acceptance_status = 'pending',
         updated_at = NOW()
     WHERE id = ?`,
    [token, r.id]
  );
  n += 1;
}

console.log('healed', n, 'POs/WOs into pending vendor acceptance');
process.exit(0);
