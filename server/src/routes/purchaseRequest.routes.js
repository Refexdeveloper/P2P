import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  listPurchaseRequests,
  getRequesterStats,
  getManagerStats,
  processApproval,
  updatePurchaseRequest,
  resubmitPurchaseRequest,
  toRequesterDashboardFormat,
  toManagerDashboardFormat,
  toCfoDashboardFormat,
} from '../services/prService.js';
import pool from '../config/db.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRoles('Requester'), async (req, res) => {
  try {
    const pr = await createPurchaseRequest(req.user, req.body);
    res.status(201).json({ data: pr });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const pendingOnly = req.query.pending === 'true';
    const bucket = req.query.bucket === 'scm' ? 'scm' : undefined;
    const list = await listPurchaseRequests(req.user, { pendingOnly, bucket });

    if (req.user.role === 'Requester') {
      return res.json({ data: list.map(toRequesterDashboardFormat) });
    }
    if (req.user.role === 'PR Manager') {
      return res.json({ data: list.map(toManagerDashboardFormat) });
    }
    if (req.user.role === 'CFO') {
      return res.json({ data: list.map(toCfoDashboardFormat) });
    }
    if (req.user.role === 'HOD Approver') {
      return res.json({ data: list.map(toManagerDashboardFormat) });
    }

    res.json({ data: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats/requester', requireRoles('Requester'), async (req, res) => {
  try {
    const stats = await getRequesterStats(req.user.id);
    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats/manager', requireRoles('PR Manager'), async (req, res) => {
  try {
    const stats = await getManagerStats();
    const [budgetRows] = await pool.query(
      'SELECT name AS department, budget_allocated AS allocated, budget_utilized AS utilized FROM departments'
    );
    const departmentBudget = budgetRows.map((d) => ({
      department: d.department,
      allocated: Number(d.allocated),
      utilized: Number(d.utilized),
      percentage: d.allocated ? Math.round((d.utilized / d.allocated) * 100) : 0,
    }));
    res.json({ data: { stats, departmentBudget } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const pr = await getPurchaseRequestById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'PR not found' });
    res.json({ data: pr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', requireRoles('Requester'), async (req, res) => {
  try {
    const pr = await updatePurchaseRequest(req.user, req.params.id, req.body);
    res.json({ data: pr, message: 'PR updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/resubmit', requireRoles('Requester'), async (req, res) => {
  try {
    const pr = await resubmitPurchaseRequest(req.user, req.params.id, req.body);
    res.json({ data: pr, message: 'PR resubmitted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/approve', requireRoles('HOD Approver', 'PR Manager', 'CFO'), async (req, res) => {
  try {
    const { action = 'approve', remarks } = req.body;
    const pr = await processApproval(req.user, req.params.id, action, remarks);
    res.json({ data: pr, message: `PR ${action}d successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
