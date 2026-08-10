import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { SUPER_ADMIN_ROLE } from '../services/permissionService.js';
import {
  listUsersForAdmin,
  getPermissionCatalog,
  getRoleCatalog,
  updateUserPermissions,
  updateUser,
  syncUsersFromRefexOne,
  resetAllData,
} from '../services/adminService.js';
import { listEmailLogs } from '../services/emailLogService.js';

const router = Router();
router.use(authenticate);
router.use(requireRoles(SUPER_ADMIN_ROLE));

router.get('/users', async (_req, res) => {
  try {
    const data = await listUsersForAdmin();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/users/sync', async (_req, res) => {
  try {
    const { stats, data } = await syncUsersFromRefexOne();
    res.json({
      data,
      stats,
      message: `Synced ${stats.total} users from RefexOne (${stats.created} new, ${stats.updated} updated)`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/permissions', async (_req, res) => {
  try {
    const data = await getPermissionCatalog();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/roles', async (_req, res) => {
  try {
    const data = getRoleCatalog();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { role, permissions } = req.body || {};
    const data = await updateUser(req.user, Number(req.params.id), { role, permissions });
    res.json({ data, message: 'User updated' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/users/:id/permissions', async (req, res) => {
  try {
    const permissions = await updateUserPermissions(req.user, Number(req.params.id), req.body.permissions || []);
    res.json({ data: { permissions }, message: 'User permissions updated' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/reset-data', async (req, res) => {
  try {
    const data = await resetAllData(req.user, { confirm: req.body?.confirm });
    res.json({ data, message: data.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/email-logs', async (req, res) => {
  try {
    const data = await listEmailLogs({
      status: req.query.status,
      emailType: req.query.emailType,
      prId: req.query.prId,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
