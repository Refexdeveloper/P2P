import 'dotenv/config';
import crypto from 'crypto';
import pool from '../src/config/db.js';

const [rows] = await pool.query(
  `SELECT id, vendor_acceptance_token, vendor_acceptance_status
   FROM purchase_orders WHERE status = 'sent_to_vendor'`
);

let n = 0;
for (const r of rows) {
  const token = r.vendor_acceptance_token || crypto.randomBytes(24).toString('hex');
  await pool.query(
    `UPDATE purchase_orders
     SET vendor_acceptance_token = ?,
         vendor_acceptance_status = COALESCE(vendor_acceptance_status, 'pending')
     WHERE id = ?`,
    [token, r.id]
  );
  n += 1;
}

console.log('healed', n, 'sent_to_vendor POs');
process.exit(0);
