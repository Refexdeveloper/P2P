import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { getUserPermissionCodes, isSuperAdmin } from '../services/permissionService.js';

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;

    // Use the live DB role so Admin → User Permissions changes apply without re-login
    if (payload?.id) {
      try {
        const [rows] = await pool.query(
          `SELECT id, email, name, role, is_active FROM users WHERE id = ? LIMIT 1`,
          [payload.id]
        );
        if (!rows[0] || Number(rows[0].is_active) !== 1) {
          return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.user = {
          ...payload,
          id: rows[0].id,
          email: rows[0].email,
          name: rows[0].name,
          role: rows[0].role,
        };
      } catch (err) {
        console.warn('Auth role refresh skipped:', err.message);
      }
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/** Roles that can open Create PR and quick-add item / vendor / category / department. */
export const CREATE_PR_ROLES = [
  'Requester',
  'Super Admin',
  'SCM Buyer',
  'SCM Manager',
  'HOD Approver',
  'PR Manager',
  'CFO',
];

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

/** Allow if user has any of the given nav permission codes (or is Super Admin). */
export function requirePermissions(...permissionCodes) {
  return async (req, res, next) => {
    try {
      if (isSuperAdmin(req.user?.role)) return next();
      const codes = await getUserPermissionCodes(req.user.id, req.user.role);
      if (permissionCodes.some((code) => codes.includes(code))) return next();
      return res.status(403).json({ message: 'Insufficient permissions' });
    } catch {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
  };
}

/**
 * Allow if JWT role is in `roles` OR user was granted any of `permissionCodes`
 * (Admin → User Permissions menus). Super Admin always allowed.
 */
export function requireRolesOrPermissions(roles = [], permissionCodes = []) {
  return async (req, res, next) => {
    try {
      if (isSuperAdmin(req.user?.role)) return next();
      if (roles.length && roles.includes(req.user?.role)) return next();
      if (permissionCodes.length) {
        const codes = await getUserPermissionCodes(req.user.id, req.user.role);
        if (permissionCodes.some((code) => codes.includes(code))) return next();
      }
      return res.status(403).json({ message: 'Insufficient permissions' });
    } catch {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
  };
}
