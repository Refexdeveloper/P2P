import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import {
  NAV_ITEMS,
  ROLE_DEFAULT_PERMISSIONS,
  ASSIGNABLE_ROLES,
  getUserPermissionCodes,
  setUserPermissions,
  isSuperAdmin,
} from './permissionService.js';
import { syncRefexOneUsers } from './refexOneService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

/** Tables cleared on Reset Data — PRs / POs / RFQs only (keeps users + all masters). */
const RESET_TABLES = [
  'vendor_quotation_submissions',
  'rfq_invitations',
  'rfq_configs',
  'pr_approvals',
  'workflow_tasks',
  'pr_line_items',
  'po_line_items',
  'purchase_orders',
  'purchase_requests',
  'document_number_sequences',
  'email_logs',
];

function clearUploadDir(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, name);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        removed += clearUploadDir(full);
        fs.rmdirSync(full);
      } else {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      /* ignore locked/missing files */
    }
  }
  return removed;
}

async function mapUserRow(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: Boolean(u.is_active),
    departmentName: u.department_name || '',
    permissions: await getUserPermissionCodes(u.id, u.role),
    isSuperAdmin: isSuperAdmin(u.role),
    refexoneUserId: u.refexone_user_id || null,
    source: u.refexone_user_id ? 'refexone' : 'local',
  };
}

export async function listUsersForAdmin() {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.refexone_user_id, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     ORDER BY u.name`
  );

  return Promise.all(rows.map(mapUserRow));
}

export async function syncUsersFromRefexOne() {
  const stats = await syncRefexOneUsers();
  const data = await listUsersForAdmin();
  return { stats, data };
}

export async function getPermissionCatalog() {
  return NAV_ITEMS.map((n) => ({
    code: n.code,
    label: n.label,
    path: n.path,
    icon: n.icon,
    group: n.group,
  }));
}

export function getRoleCatalog() {
  return ASSIGNABLE_ROLES.map((role) => ({
    role,
    defaultPermissions: ROLE_DEFAULT_PERMISSIONS[role] || [],
  }));
}

export async function updateUserPermissions(adminUser, userId, permissionCodes) {
  if (!isSuperAdmin(adminUser.role)) {
    throw new Error('Only Super Admin can manage user permissions');
  }
  return setUserPermissions(userId, permissionCodes);
}

export async function updateUser(adminUser, userId, { role, permissions }) {
  if (!isSuperAdmin(adminUser.role)) {
    throw new Error('Only Super Admin can manage users');
  }

  const [userRows] = await pool.query(`SELECT id, role FROM users WHERE id = ?`, [userId]);
  if (!userRows.length) throw new Error('User not found');

  const target = userRows[0];
  if (isSuperAdmin(target.role)) {
    throw new Error('Cannot modify Super Admin user');
  }

  const roleChanged = role !== undefined && role !== target.role;

  if (role !== undefined) {
    if (role === 'Super Admin') {
      throw new Error('Cannot assign Super Admin role');
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }
    await pool.query(`UPDATE users SET role = ? WHERE id = ?`, [role, userId]);
  }

  let updatedPermissions;
  if (permissions !== undefined) {
    updatedPermissions = await setUserPermissions(userId, permissions);
  } else if (roleChanged) {
    // Role changed without explicit permissions → apply that role's default menus
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ['nav.tasks'];
    updatedPermissions = await setUserPermissions(userId, defaults);
  } else {
    const [updated] = await pool.query(`SELECT role FROM users WHERE id = ?`, [userId]);
    updatedPermissions = await getUserPermissionCodes(userId, updated[0].role);
  }

  const [final] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.refexone_user_id, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = ?`,
    [userId]
  );
  const u = final[0];

  return mapUserRow(u);
}

/**
 * Wipe PR / PO / RFQ transactional data only.
 * Keeps: users, permissions, departments, and all master data
 * (vendors, items, entities, letterheads, categories, etc.).
 */
export async function resetAllData(adminUser, { confirm } = {}) {
  if (!isSuperAdmin(adminUser.role)) {
    throw new Error('Only Super Admin can reset data');
  }
  if (String(confirm || '').trim().toUpperCase() !== 'RESET') {
    throw new Error('Type RESET to confirm data wipe');
  }

  const cleared = [];
  const missing = [];

  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of RESET_TABLES) {
      try {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        cleared.push(table);
      } catch (err) {
        // Table may not exist on older DBs
        if (String(err?.code) === 'ER_NO_SUCH_TABLE') {
          missing.push(table);
        } else {
          throw err;
        }
      }
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch {
      /* ignore */
    }
    conn.release();
  }

  // Only clear PO/RFQ uploads — not signature masters or unrelated files
  const poUploads = path.join(UPLOAD_ROOT, 'po');
  const filesRemoved = clearUploadDir(poUploads);

  return {
    clearedTables: cleared,
    missingTables: missing,
    filesRemoved,
    kept: [
      'users',
      'user_permissions',
      'navigation_permissions',
      'departments',
      'vendors',
      'items',
      'categories',
      'entity_masters',
      'letterhead_masters',
      'po_letterhead_masters',
    ],
    message:
      `Reset complete. Cleared PRs, POs, RFQs (${cleared.length} tables)` +
      (filesRemoved ? ` and ${filesRemoved} PO upload files` : '') +
      '. Users and master data were kept.',
  };
}
