import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listCloudSubscriptionsForUser,
  getCloudSubscriptionById,
  getCloudSubscriptionByPrId,
  getRenewalHistory,
  createSubscriptionRenewal,
  getRenewalById,
  processSubscriptionRenewalApproval,
  processCloudSubscriptionNotifications,
  calculateExpiryDate,
} from '../services/cloudSubscriptionService.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const data = await listCloudSubscriptionsForUser(req.user, {
      status: req.query.status || undefined,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/by-pr/:prId', async (req, res) => {
  try {
    const data = await getCloudSubscriptionByPrId(Number(req.params.prId));
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/preview-expiry', async (req, res) => {
  try {
    const { startDate, frequency } = req.body || {};
    const expiry = calculateExpiryDate(startDate, frequency);
    const y = expiry.getUTCFullYear();
    const m = String(expiry.getUTCMonth() + 1).padStart(2, '0');
    const d = String(expiry.getUTCDate()).padStart(2, '0');
    res.json({ data: { expiryDate: `${y}-${m}-${d}` } });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Manual/admin trigger for scheduler (Super Admin). */
router.post('/admin/process-notifications', async (req, res) => {
  try {
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const data = await processCloudSubscriptionNotifications();
    res.json({ data, message: 'Processed' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/renewals/:renewalId', async (req, res) => {
  try {
    const data = await getRenewalById(Number(req.params.renewalId));
    if (!data) return res.status(404).json({ message: 'Renewal not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/renewals/:renewalId/approve', async (req, res) => {
  try {
    const { action = 'approve', remarks } = req.body || {};
    const data = await processSubscriptionRenewalApproval(
      req.user,
      Number(req.params.renewalId),
      action,
      remarks
    );
    res.json({ data, message: `Renewal ${action}d successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const data = await getCloudSubscriptionById(Number(req.params.id));
    if (!data) return res.status(404).json({ message: 'Subscription not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const data = await getRenewalHistory(Number(req.params.id));
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/renew', async (req, res) => {
  try {
    const data = await createSubscriptionRenewal(req.user, Number(req.params.id));
    res.json({ data, message: 'Renewal request submitted to L1 Manager' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
