import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  inviteVendors,
  getRfqByPrId,
  getRfqByToken,
  submitVendorQuotation,
  submitManualVendorQuotation,
  resendRfqInvitationEmail,
  sendBackVendorQuote,
  getSubmissionFile,
  saveRfqConfig,
  updateSubmissionReviewFields,
  finalizeRfq,
  mapInvitationsToQuotations,
  mapInvitationsToTableRows,
  getVendorComparisonMatrix,
  listPostRfqPending,
  listScmRfqEntryPrs,
  processPostRfqApproval,
} from '../services/rfqService.js';

const router = Router();

router.get('/quote/:token', async (req, res) => {
  try {
    const data = await getRfqByToken(req.params.token);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/quote/:token', async (req, res) => {
  try {
    const result = await submitVendorQuotation(req.params.token, req.body);
    res.json({ data: result, message: result.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/submissions/:id/file', authenticate, requireRoles('Requester', 'SCM Buyer', 'HOD Approver', 'PR Manager', 'SCM Manager', 'CFO'), async (req, res) => {
  try {
    const { fullPath, fileName } = await getSubmissionFile(req.user, Number(req.params.id));
    res.download(fullPath, fileName);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.use(authenticate);

const POST_RFQ_ROLES = ['HOD Approver', 'PR Manager', 'SCM Manager', 'CFO', 'SCM Buyer'];

router.get('/scm-entry/pending', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await listScmRfqEntryPrs(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/post-approval/pending', async (req, res) => {
  try {
    const data = await listPostRfqPending(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pr/:prId/comparison', async (req, res) => {
  try {
    const data = await getVendorComparisonMatrix(req.user, Number(req.params.prId));
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/pr/:prId/post-approve', async (req, res) => {
  try {
    const { action, remarks } = req.body;
    const data = await processPostRfqApproval(req.user, Number(req.params.prId), action, remarks);
    res.json({ data, message: `RFQ ${action} recorded successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pr/:prId', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const data = await getRfqByPrId(req.user, Number(req.params.prId));
    res.json({
      data: {
        pr: data.pr,
        config: data.config,
        invitations: data.invitations,
        quotations: mapInvitationsToQuotations(data.invitations),
        tableRows: mapInvitationsToTableRows(data.invitations, data.config),
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/pr/:prId/config', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const config = await saveRfqConfig(req.user, Number(req.params.prId), req.body);
    res.json({ data: { config }, message: 'RFQ configuration saved' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/pr/:prId/finalize', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const { recommendedInvitationId, taskId } = req.body;
    const result = await finalizeRfq(req.user, Number(req.params.prId), {
      recommendedInvitationId,
      taskId,
    });
    res.json({ data: result, message: result.message || 'RFQ submitted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/submissions/:id/review-fields', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const result = await updateSubmissionReviewFields(req.user, Number(req.params.id), req.body.requesterFields);
    res.json({ data: result, message: 'Review fields saved' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invite', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const { prId, vendors, fieldDefinitions, sendEmail = true } = req.body;
    if (!prId) return res.status(400).json({ message: 'prId is required' });
    const result = await inviteVendors(req.user, Number(prId), vendors, fieldDefinitions, { sendEmail });
    res.json({
      data: {
        ...result,
        quotations: mapInvitationsToQuotations(result.rfq),
        tableRows: mapInvitationsToTableRows(result.rfq, result.config),
        config: result.config,
      },
      message: result.message,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invitations/:id/manual-submit', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const result = await submitManualVendorQuotation(req.user, Number(req.params.id), req.body);
    res.json({ data: result, message: result.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invitations/:id/resend-email', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const result = await resendRfqInvitationEmail(req.user, Number(req.params.id));
    res.json({ data: result, message: result.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invitations/:id/send-back', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const { reason, fields } = req.body;
    const rfq = await sendBackVendorQuote(req.user, Number(req.params.id), reason, fields);
    const prId = rfq[0]?.prId;
    const full = prId ? await getRfqByPrId(req.user, prId) : { config: null };
    res.json({
      data: {
        invitations: rfq,
        quotations: mapInvitationsToQuotations(rfq),
        tableRows: mapInvitationsToTableRows(rfq, full.config),
        config: full.config,
      },
      message: 'Send-back email sent to vendor',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
