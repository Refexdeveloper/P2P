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
import { listUserActivityLogs } from '../services/userActivityLogService.js';
import { retriggerEmailLog } from '../services/emailService.js';
import { listWhatsAppLogs } from '../services/whatsappLogService.js';

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
    const { role, permissions, entityId } = req.body || {};
    const data = await updateUser(req.user, Number(req.params.id), { role, permissions, entityId });
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

router.post('/email-logs/:id/retrigger', async (req, res) => {
  try {
    const data = await retriggerEmailLog(Number(req.params.id), {
      extraTo: req.body?.extraTo || req.body?.to || '',
    });
    res.json({
      data,
      message: `Email sent to ${Array.isArray(data.to) ? data.to.join(', ') : data.to}`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/whatsapp-logs', async (req, res) => {
  try {
    const data = await listWhatsAppLogs({
      status: req.query.status,
      notifyType: req.query.notifyType,
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

router.get('/user-activity-logs', async (req, res) => {
  try {
    const data = await listUserActivityLogs({
      action: req.query.action,
      userId: req.query.userId,
      search: req.query.search,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/scm-manager-signature', async (_req, res) => {
  try {
    const { getDefaultScmManagerSignatureInfo } = await import('../services/signatureService.js');
    res.json({ data: getDefaultScmManagerSignatureInfo() });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/scm-manager-signature', async (req, res) => {
  try {
    const { updateDefaultScmManagerSignature } = await import('../services/signatureService.js');
    const data = await updateDefaultScmManagerSignature({
      image: req.body?.image,
      applyToSignedPos: req.body?.applyToSignedPos !== false,
    });
    res.json({
      data,
      message: data.backfilled
        ? `Default signature updated and applied to ${data.backfilled} signed PO(s)`
        : 'Default SCM Manager signature updated',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
