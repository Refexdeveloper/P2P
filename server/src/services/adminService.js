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
