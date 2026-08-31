import jwt from 'jsonwebtoken';
import { createUserActivityLog } from '../services/userActivityLogService.js';

const SKIP_AUDIT_PATHS = [
  '/api/auth/login',
  '/api/auth/refexone/login',
  '/api/auth/refexone/saml/acs',
  '/api/auth/refexone/sso',
  '/api/health',
  '/api/health/db',
  '/api/health/smtp',
  '/api/health/whatsapp',
];

function shouldSkipAudit(path) {
  if (!path.startsWith('/api')) return true;
  return SKIP_AUDIT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

function actionFromMethod(method) {
  switch (method) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'update';
  }
}

function inferEntityType(path) {
  if (path.includes('/purchase-requests')) return 'PR';
  if (path.includes('/po')) return 'PO';
  if (path.includes('/rfq')) return 'RFQ';
  if (path.includes('/masters')) return 'Master';
  if (path.includes('/admin/users')) return 'User';
  if (path.includes('/accounts')) return 'Accounts';
  if (path.includes('/vendors')) return 'Vendor';
  if (path.includes('/tasks')) return 'Task';
  return null;
}

function buildDescription(req, path) {
  const method = req.method;
  const entity = inferEntityType(path);
  const id =
    req.params?.id ||
    req.params?.prId ||
    req.params?.poId ||
    req.body?.id ||
    req.body?.prId ||
    req.body?.poId;
  const parts = [method, path];
  if (entity && id) parts.push(`${entity} #${id}`);
  return parts.join(' ').slice(0, 500);
}

/** Parse JWT early so audit can run after response even before route-level authenticate. */
export function attachUserFromToken(req, _res, next) {
  if (req.user) return next();
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    /* unauthenticated */
  }
  next();
}

/** Log successful create / update / delete API calls. */
export function auditUserActivity(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (shouldSkipAudit(path)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const user = req.user;
    if (!user?.id && !user?.email) return;

    const entityType = inferEntityType(path);
    const entityId = Number(
      req.params?.id || req.params?.prId || req.params?.poId || req.body?.id || 0
    ) || null;

    void createUserActivityLog({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: actionFromMethod(req.method),
      resource: path,
      description: buildDescription(req, path),
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
      entityType,
      entityId,
      statusCode: res.statusCode,
      meta: {
        method: req.method,
        params: req.params || {},
      },
    });
  });

  next();
}
