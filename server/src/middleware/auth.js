import jwt from 'jsonwebtoken';
import { getUserPermissionCodes, isSuperAdmin } from '../services/permissionService.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

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
