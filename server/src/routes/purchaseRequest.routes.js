import { Router } from 'express';
import {
  authenticate,
  requireRoles,
  requireRolesOrPermissions,
  CREATE_PR_ROLES,
} from '../middleware/auth.js';
import { adminDeletePurchaseRequest } from '../services/adminDeleteService.js';
import {
  createPurchaseRequest,
  getPurchaseRequestById,
  listPurchaseRequests,
  listRequesterPurchaseRequests,
  getRequesterStats,
  getManagerStats,
  getCfoDashboard,
  processApproval,
  updatePurchaseRequest,
  updatePrBillingDelivery,
  adminUpdatePurchaseRequest,
  adminSendBackPurchaseRequest,
  resubmitPurchaseRequest,
  previewL1Manager,
  listApprovalUsers,
  toRequesterDashboardFormat,
  toManagerDashboardFormat,
  toCfoDashboardFormat,
  deleteRequesterDraftPurchaseRequest,
} from '../services/prService.js';
import { getSendBackTargetsForPr } from '../services/sendBackService.js';
import { addPrAttachment, getPrAttachmentFile, deletePrAttachment } from '../services/prAttachmentService.js';
import pool from '../config/db.js';

const router = Router();

/** Create PR menu (or classic create roles) — used when Admin assigns nav.create_pr to any role. */
const canCreatePr = requireRolesOrPermissions(CREATE_PR_ROLES, ['nav.create_pr']);
const canApproveAdmin = requireRolesOrPermissions(
  ['Super Admin', 'SCM Manager', 'SCM Buyer', 'HOD Approver', 'PR Manager', 'CFO'],
  ['nav.rfq_approval', 'nav.track_pr', 'nav.tasks', 'nav.pr_manager_dashboard']
);
const canEditPrDetails = requireRolesOrPermissions(
  ['Super Admin', 'SCM Manager', 'SCM Buyer', 'HOD Approver', 'PR Manager', 'CFO', 'Requester'],
  ['nav.rfq_approval', 'nav.track_pr', 'nav.tasks', 'nav.pr_manager_dashboard', 'nav.rfq_entry', 'nav.scm_rfq_entry', 'nav.create_pr']
);

router.use(authenticate);

router.post('/', canCreatePr, async (req, res) => {
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
        involvedOnly:
          req.query.involvedOnly === 'true' ||
          req.query.involvedOnly === '1' ||
          req.query.scope === 'involved',
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

router.get(
  '/stats/requester',
  requireRolesOrPermissions(['Requester'], ['nav.create_pr', 'nav.requester_dashboard', 'nav.track_pr']),
  async (req, res) => {
    try {
      const stats = await getRequesterStats(req.user.id);
      res.json({ data: stats });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get('/l1-manager', canCreatePr, async (req, res) => {
  try {
    const data = await previewL1Manager(req.user, req.query.department);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get(
  '/approval-users',
  requireRolesOrPermissions(
    ['Requester', 'Super Admin', 'SCM Manager', 'HOD Approver', 'PR Manager', 'CFO', ...CREATE_PR_ROLES],
    ['nav.create_pr']
  ),
  async (req, res) => {
    try {
      const data = await listApprovalUsers(req.user);
      res.json({ data });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.get(
  '/stats/manager',
  requireRolesOrPermissions(['PR Manager'], ['nav.pr_manager_dashboard', 'nav.tasks']),
  async (req, res) => {
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
  }
);

router.get(
  '/stats/cfo',
  requireRolesOrPermissions(['CFO'], ['nav.cfo_dashboard', 'nav.tasks', 'nav.rfq_approval']),
  async (req, res) => {
    try {
      const data = await getCfoDashboard(req.user);
      res.json({ data });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

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

router.post('/:id/attachments', canCreatePr, async (req, res) => {
  try {
    const pr = await getPurchaseRequestById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'PR not found' });
    // Requesters / menu-only users may only attach to their own PRs
    if (
      pr.requesterId !== req.user.id &&
      req.user.role !== 'Super Admin' &&
      (req.user.role === 'Requester' || !CREATE_PR_ROLES.includes(req.user.role))
    ) {
      return res.status(403).json({ message: 'Not allowed to upload files to this PR' });
    }
    const saved = await addPrAttachment(Number(req.params.id), req.user.id, req.body || {});
    res.status(201).json({ data: saved });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete(
  '/:id/attachments/:attachmentId',
  requireRolesOrPermissions(['Requester', 'Super Admin', ...CREATE_PR_ROLES], ['nav.create_pr']),
  async (req, res) => {
    try {
      const pr = await getPurchaseRequestById(req.params.id);
      if (!pr) return res.status(404).json({ message: 'PR not found' });
      if (pr.requesterId !== req.user.id && req.user.role !== 'Super Admin') {
        return res.status(403).json({ message: 'Not allowed to delete files from this PR' });
      }
      await deletePrAttachment(Number(req.params.id), Number(req.params.attachmentId));
      res.json({ message: 'Attachment deleted' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const pr = await getPurchaseRequestById(req.params.id);
    if (!pr) return res.status(404).json({ message: 'PR not found' });
    res.json({ data: pr });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', canCreatePr, async (req, res) => {
  try {
    const pr = await updatePurchaseRequest(req.user, req.params.id, req.body);
    res.json({ data: pr, message: 'PR updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put(
  '/:id/billing',
  requireRolesOrPermissions(
    ['Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin', ...CREATE_PR_ROLES],
    ['nav.create_pr', 'nav.create_po', 'nav.purchase_requests']
  ),
  async (req, res) => {
    try {
      const pr = await updatePrBillingDelivery(req.user, req.params.id, req.body);
      res.json({ data: pr, message: 'Billing and delivery saved' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

/** RFQ Approval / admin: edit full PR details at any status */
router.put('/:id/admin', canEditPrDetails, async (req, res) => {
  try {
    const pr = await adminUpdatePurchaseRequest(req.user, Number(req.params.id), req.body);
    res.json({ data: pr, message: 'PR details updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/resubmit', canCreatePr, async (req, res) => {
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

/** Requester: delete own draft PR only */
router.delete('/:id/draft', requireRoles('Requester'), async (req, res) => {
  try {
    const data = await deleteRequesterDraftPurchaseRequest(req.user, Number(req.params.id));
    res.json({ data, message: `Draft ${data.prNumber} deleted` });
  } catch (err) {
    res.status(err.message === 'Purchase request not found' ? 404 : 400).json({ message: err.message });
  }
});

/** Super Admin only: permanently delete a purchase request and related RFQ / PO records */
router.delete('/:id', requireRoles('Super Admin'), async (req, res) => {
  try {
    const data = await adminDeletePurchaseRequest(req.user, Number(req.params.id));
    res.json({ data, message: `PR ${data.prNumber} deleted` });
  } catch (err) {
    res.status(err.message === 'Purchase request not found' ? 404 : 400).json({ message: err.message });
  }
});

/** Admin (Track PR): send back to any prior step without holding the approval task */
router.post('/:id/admin/send-back', canApproveAdmin, async (req, res) => {
  try {
    const { returnTo, remarks } = req.body || {};
    const pr = await adminSendBackPurchaseRequest(req.user, Number(req.params.id), returnTo, remarks);
    res.json({ data: pr, message: 'PR sent back successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Any authenticated user may call this; processApproval enforces role/assignment. */
router.post('/:id/approve', async (req, res) => {
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
