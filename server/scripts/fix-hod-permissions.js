/**
 * One-time fix: reset HOD Approver users to correct default menus
 * (removes Requester dashboard menus that cause "Insufficient permissions").
 *
 * Usage: node scripts/fix-hod-permissions.js
 */
import 'dotenv/config';
import pool from '../src/config/db.js';
import { ROLE_DEFAULT_PERMISSIONS, setUserPermissions } from '../src/services/permissionService.js';

const defaults = ROLE_DEFAULT_PERMISSIONS['HOD Approver'] || ['nav.tasks', 'nav.rfq_approval'];

const [users] = await pool.query(
  `SELECT id, name, email FROM users WHERE role = 'HOD Approver' AND is_active = 1`
);

console.log(`Found ${users.length} HOD Approver user(s)`);

for (const u of users) {
  await setUserPermissions(u.id, defaults);
  console.log(`✔ ${u.name} <${u.email}> → ${defaults.join(', ')}`);
}

await pool.end();
console.log('Done. Ask HOD users to log out and log in again.');
