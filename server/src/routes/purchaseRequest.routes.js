import { Router } from 'express';
import { authenticate, requireRoles, CREATE_PR_ROLES } from '../middleware/auth.js';
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  listPurchaseRequests,
  listRequesterPurchaseRequests,
  getRequesterStats,
  getManagerStats,
  processApproval,
  updatePurchaseRequest,
  adminUpdatePurchaseRequest,
  adminSendBackPurchaseRequest,
  resubmitPurchaseRequest,
  previewL1Manager,
  listApprovalUsers,
  toRequesterDashboardFormat,
  toManagerDashboardFormat,
  toCfoDashboardFormat,
} from '../services/prService.js';
import { getSendBackTargetsForPr } from '../services/sendBackService.js';
import { addPrAttachment, getPrAttachmentFile, deletePrAttachment } from '../services/prAttachmentService.js';
import pool from '../config/db.js';

const router = Router();

router.use(authenticate);

router.post('/', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
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
    const wantsRequesterList =
      req.user.role === 'Requester' ||
      req.query.scope === 'requester' ||
      req.query.page != null;

    // Fast paginated list for requester dashboard / track-pr (avoids heavy enrichPR N+1)
    if (wantsRequesterList && !pendingOnly && !bucket) {
      const result = await listRequesterPurchaseRequests(req.user, {
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        status: req.query.status,
        requestType: req.query.requestType,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });
      return res.json(result);
    }

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

router.get('/l1-manager', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
  try {
    const data = await previewL1Manager(req.user, req.query.department);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/approval-users', requireRoles('Requester', 'Super Admin', 'SCM Manager', 'HOD Approver', 'PR Manager', 'CFO'), async (req, res) => {
  try {
    const data = await listApprovalUsers(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
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

router.get('/:id/attachments/:attachmentId/file', async (req, res) => {
  try {
    const file = await getPrAttachmentFile(Number(req.params.id), Number(req.params.attachmentId));
    const safeName = String(file.fileName || 'attachment').replace(/"/g, '');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(file.buffer);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.post('/:id/attachments', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
  try {
    const pr = await getPurchaseRequestById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'PR not found' });
    if (req.user.role === 'Requester' && pr.requesterId !== req.user.id) {
      return res.status(403).json({ message: 'Not allowed to upload files to this PR' });
    }
    const saved = await addPrAttachment(Number(req.params.id), req.user.id, req.body || {});
    res.status(201).json({ data: saved });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id/attachments/:attachmentId', requireRoles('Requester', 'Super Admin'), async (req, res) => {
  try {
    const pr = await getPurchaseRequestById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'PR not found' });
    if (req.user.role === 'Requester' && pr.requesterId !== req.user.id) {
      return res.status(403).json({ message: 'Not allowed to delete files from this PR' });
    }
    await deletePrAttachment(Number(req.params.id), Number(req.params.attachmentId));
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
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

/** RFQ Approval / admin: edit full PR details at any status */
router.put(
  '/:id/admin',
  requireRoles('Super Admin', 'SCM Manager', 'SCM Buyer', 'HOD Approver', 'PR Manager', 'CFO'),
  async (req, res) => {
    try {
      const pr = await adminUpdatePurchaseRequest(req.user, Number(req.params.id), req.body);
      res.json({ data: pr, message: 'PR details updated successfully' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.post('/:id/resubmit', requireRoles('Requester'), async (req, res) => {
  try {
    const pr = await resubmitPurchaseRequest(req.user, req.params.id, req.body);
    res.json({ data: pr, message: 'PR resubmitted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/send-back-targets', async (req, res) => {
  try {
    const admin = String(req.query.admin || '') === '1' || String(req.query.admin || '') === 'true';
    const targets = await getSendBackTargetsForPr(Number(req.params.id), { admin });
    res.json({ data: targets });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Admin (Track PR): send back to any prior step without holding the approval task */
router.post(
  '/:id/admin/send-back',
  requireRoles('Super Admin', 'SCM Manager', 'SCM Buyer', 'HOD Approver', 'PR Manager', 'CFO'),
  async (req, res) => {
    try {
      const { returnTo, remarks } = req.body || {};
      const pr = await adminSendBackPurchaseRequest(req.user, Number(req.params.id), returnTo, remarks);
      res.json({ data: pr, message: 'PR sent back successfully' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.post('/:id/approve', requireRoles('HOD Approver', 'PR Manager', 'CFO', 'Super Admin'), async (req, res) => {
  try {
    const { action = 'approve', remarks, returnTo, goToBusinessApproval } = req.body;
    const pr = await processApproval(req.user, req.params.id, action, remarks, {
      returnTo,
      goToBusinessApproval,
    });
    res.json({ data: pr, message: `PR ${action}d successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
