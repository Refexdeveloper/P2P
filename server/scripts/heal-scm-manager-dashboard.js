import 'dotenv/config';
import pool from '../src/config/db.js';
import { seedNavigationPermissions } from '../src/services/permissionService.js';

await seedNavigationPermissions();
const [managers] = await pool.query(
  `SELECT id, email FROM users WHERE role = 'SCM Manager' AND is_active = 1`
);
for (const u of managers) {
  await pool.query(
    `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
    [u.id, 'nav.scm_manager_dashboard']
  );
}
console.log('seeded nav + healed', managers.length, 'managers');
process.exit(0);
