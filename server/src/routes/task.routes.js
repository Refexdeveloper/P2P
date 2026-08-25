import { Router } from 'express';
import { authenticate, requireRolesOrPermissions } from '../middleware/auth.js';
import { listTasks, listRequesterTasks, completeRequesterTask, processApproval } from '../services/prService.js';

const router = Router();

router.use(authenticate);

const canRequesterRfq = requireRolesOrPermissions(
  ['Requester', 'Super Admin'],
  ['nav.create_pr', 'nav.rfq_entry', 'nav.tasks', 'nav.requester_dashboard']
);

router.get('/requester', canRequesterRfq, async (req, res) => {
  try {
    const tasks = await listRequesterTasks(req.user.id);
    res.json({ data: tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:taskId/complete-rfq', canRequesterRfq, async (req, res) => {
  try {
    const result = await completeRequesterTask(req.user, req.params.taskId);
    res.json({ data: result, message: 'RFQ entry task completed' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const tasks = await listTasks(req.user);
    res.json({ data: tasks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:taskId/complete', async (req, res) => {
  try {
    const { action = 'approve', remarks, prId, returnTo, goToBusinessApproval } = req.body;
    if (!prId) return res.status(400).json({ message: 'prId is required' });

    const pr = await processApproval(req.user, prId, action, remarks, { returnTo, goToBusinessApproval });
    res.json({ data: pr, message: 'Task completed' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
