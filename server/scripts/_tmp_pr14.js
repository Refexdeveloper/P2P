import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = await mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'p2p_system',
});

const [prs] = await pool.query(
  'SELECT id, pr_number, title, status, vendor_selection, pr_flow FROM purchase_requests ORDER BY id DESC LIMIT 15'
);
console.table(prs);

const [own] = await pool.query(
  `SELECT pr.id, pr.pr_number, pr.status, pr.vendor_selection,
          rc.requester_submitted_at IS NOT NULL AS requester_submitted,
          rc.finalized_at IS NOT NULL AS finalized,
          (SELECT COUNT(*) FROM rfq_invitations ri WHERE ri.pr_id = pr.id) AS vendors
   FROM purchase_requests pr
   LEFT JOIN rfq_configs rc ON rc.pr_id = pr.id
   WHERE pr.id = 14 OR pr.vendor_selection = 'own'
   ORDER BY pr.id DESC
   LIMIT 20`
);
console.table(own);

const [subs] = await pool.query(
  `SELECT vqs.id, vqs.round, vqs.quotation_file_name,
          (vqs.quotation_file_data IS NOT NULL AND LENGTH(vqs.quotation_file_data) > 0) AS has_blob,
          vqs.quotation_file_path, ri.pr_id, ri.vendor_name
   FROM vendor_quotation_submissions vqs
   JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
   WHERE ri.pr_id = 14`
);
console.table(subs);

await pool.end();
