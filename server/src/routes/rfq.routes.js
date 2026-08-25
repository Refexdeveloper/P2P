import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  inviteVendors,
  removeRfqInvitation,
  getRfqByPrId,
  getRfqByToken,
  submitVendorQuotation,
  submitManualVendorQuotation,
  resendRfqInvitationEmail,
  sendBackVendorQuote,
  getSubmissionFile,
  attachQuotationFileToSubmission,
  adminUpdateVendorQuotationSubmission,
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
import { extractQuotationFromUpload } from '../services/quotationOcrService.js';

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

router.get('/submissions/:id/file', authenticate, async (req, res) => {
  try {
    const { fullPath, fileName, buffer } = await getSubmissionFile(req.user, Number(req.params.id));
    if (buffer) {
      const lower = String(fileName || '').toLowerCase();
      const contentType = lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.png')
          ? 'image/png'
          : lower.endsWith('.jpg') || lower.endsWith('.jpeg')
            ? 'image/jpeg'
            : lower.endsWith('.webp')
              ? 'image/webp'
              : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${String(fileName).replace(/"/g, '')}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }
    return res.download(fullPath, fileName);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.use(authenticate);

router.post(
  '/quotation-extract',
  requireRoles('Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'),
  async (req, res) => {
    try {
      const data = await extractQuotationFromUpload(req.body || {});
      res.json({
        data,
        message: data.quotedPrice
          ? 'Quotation details read from the file'
          : data.scanned
            ? 'This PDF looks scanned. We will try OCR on the pages.'
            : 'File read, but no prices were found. Enter them manually.',
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

const POST_RFQ_ROLES = ['HOD Approver', 'PR Manager', 'SCM Manager', 'CFO', 'SCM Buyer'];

router.get('/scm-entry/pending', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
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
    const { action, remarks, goToBusinessApproval, returnTo } = req.body;
    const data = await processPostRfqApproval(req.user, Number(req.params.prId), action, remarks, {
      goToBusinessApproval,
      returnTo,
    });
    res.json({ data, message: `RFQ ${action} recorded successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pr/:prId', async (req, res) => {
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
    const { recommendedInvitationId, taskId, recommendationJustification } = req.body;
    const result = await finalizeRfq(req.user, Number(req.params.prId), {
      recommendedInvitationId,
      taskId,
      recommendationJustification,
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

router.post('/submissions/:id/attach-file', requireRoles('Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const result = await attachQuotationFileToSubmission(req.user, Number(req.params.id), req.body);
    res.json({ data: result, message: result.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Admin / SCM / requester: edit quoted amounts (+ optional file) on an existing submission */
router.put(
  '/submissions/:id/admin',
  requireRoles('Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'),
  async (req, res) => {
    try {
      const result = await adminUpdateVendorQuotationSubmission(
        req.user,
        Number(req.params.id),
        req.body
      );
      res.json({ data: result, message: result.message });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

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

router.delete('/invitations/:id', requireRoles('Requester', 'SCM Buyer'), async (req, res) => {
  try {
    const result = await removeRfqInvitation(req.user, Number(req.params.id));
    res.json({
      data: {
        tableRows: result.tableRows,
        quotations: result.quotations,
        config: result.config,
        removedVendorName: result.removedVendorName,
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
      message: 'Next quotation round started',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
