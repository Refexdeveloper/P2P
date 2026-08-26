import { Router } from 'express';
import { authenticate, requireRoles, requireRolesOrPermissions } from '../middleware/auth.js';
import {
  getPoCreateContext,
  createPurchaseOrder,
  createManualPurchaseOrder,
  savePurchaseOrderDraft,
  buildPoPreviewDocument,
  buildManualPoPreviewDocument,
  listPurchaseOrders,
  listTrackPurchaseOrders,
  listVendorAcceptancePOs,
  getPurchaseOrderById,
  getPurchaseOrderByNumber,
  signPurchaseOrder,
  rejectPurchaseOrder,
  sendBackPurchaseOrder,
  cancelPurchaseOrder,
  finalVerifyPurchaseOrder,
  rejectBuyerFinalVerify,
  sendBackBuyerFinalVerify,
  updatePurchaseOrder,
  buildPoPreviewForPo,
  sendVendorAcceptanceMail,
  submitManualVendorAcceptance,
  getVendorAcceptanceByToken,
  submitVendorAcceptanceByToken,
  resolveVendorAcceptanceFile,
  resolveCancellationAttachment,
  getCfoPoInsights,
} from '../services/poService.js';
import {
  resolveScmManagerUser,
  getPreferredScmManagerEmail,
  getPreferredScmManagerName,
} from '../utils/scmAssignee.js';
import {
  listLetterheads,
  getLetterheadByType,
  saveLetterhead,
} from '../services/poLetterheadService.js';
import {
  listLetterheadMasters,
  getLetterheadMasterById,
  createLetterheadMaster,
  updateLetterheadMaster,
  getLetterheadBranding,
  saveLetterheadBranding,
} from '../services/letterheadBrandingService.js';
import {
  buildPoHtml,
  resolvePoDocumentPath,
  ensurePoPdf,
  renderPoPdfToFile,
} from '../services/poPdfService.js';
import fs from 'fs';
import {
  getPoExcelImportTemplateCsv,
  validatePoExcelImport,
  importPoExcelRows,
  getPoExcelImportDefaultStatus,
} from '../services/poExcelImportService.js';
import {
  listUserSignatures,
  saveUserSignature,
  deleteUserSignature,
} from '../services/signatureService.js';

const router = Router();

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

/** Public vendor acceptance link (no login) */
router.get('/vendor-accept/:token', async (req, res) => {
  try {
    const data = await getVendorAcceptanceByToken(req.params.token);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/vendor-accept/:token', async (req, res) => {
  try {
    const data = await submitVendorAcceptanceByToken(req.params.token, req.body || {});
    res.json({ data, message: 'Vendor response recorded' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/vendor-accept/:token/pdf', async (req, res) => {
  try {
    const pool = (await import('../config/db.js')).default;
    const [rows] = await pool.query(
      `SELECT * FROM purchase_orders WHERE vendor_acceptance_token = ? LIMIT 1`,
      [String(req.params.token || '').trim()]
    );
    if (!rows.length) return res.status(404).json({ message: 'Invalid link' });
    const doc = resolvePoDocumentPath({
      signedPdfPath: rows[0].signed_pdf_path,
      pdfPath: rows[0].pdf_path,
    });
    res.download(doc.fullPath, `${rows[0].po_number}_signed.pdf`);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.use(authenticate);

router.get(
  '/stats/cfo',
  requireRolesOrPermissions(['CFO', 'Super Admin'], ['nav.cfo_dashboard', 'nav.tasks', 'nav.rfq_approval']),
  async (_req, res) => {
    try {
      const data = await getCfoPoInsights();
      res.json({ data });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

router.get('/signatures', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const data = await listUserSignatures(req.user.id);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/signatures', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const data = await saveUserSignature(req.user.id, {
      image: req.body.image,
      label: req.body.label,
    });
    res.json({ data, message: 'Signature saved to gallery' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/signatures/:id', requireRoles('SCM Manager'), async (req, res) => {
  try {
    await deleteUserSignature(req.user.id, Number(req.params.id));
    res.json({ message: 'Signature removed from gallery' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/** Who receives PO approval next (shown on Create / Save confirm) */
router.get(
  '/scm-manager',
  requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'),
  async (_req, res) => {
    try {
      const mgr = await resolveScmManagerUser();
      res.json({
        data: {
          id: mgr?.id || null,
          name: mgr?.name || getPreferredScmManagerName(),
          email: mgr?.email || getPreferredScmManagerEmail(),
          role: 'SCM Manager',
        },
      });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

/** Excel / CSV PO import — no approval workflow */
const poImportRoles = requireRoles('SCM Buyer', 'Super Admin');

router.get('/excel-import/template', poImportRoles, (_req, res) => {
  sendCsv(res, 'po-import-template.csv', getPoExcelImportTemplateCsv());
});

router.get('/excel-import/config', poImportRoles, (_req, res) => {
  res.json({
    data: {
      defaultStatus: getPoExcelImportDefaultStatus(),
      allowedStatuses: ['draft', 'imported'],
    },
  });
});

router.post('/excel-import/validate', poImportRoles, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const data = await validatePoExcelImport(rows);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/excel-import', poImportRoles, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const status = req.body?.status;
    const data = await importPoExcelRows(req.user, rows, { status });
    res.json({
      data,
      message: `Imported ${data.imported} purchase order(s) as ${data.defaultStatus} (no approval workflow)`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

const letterheadRoles = requireRoles('SCM Buyer', 'Super Admin');
const letterheadReadRoles = requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin');

router.get('/letterheads', letterheadReadRoles, async (req, res) => {
  try {
    const data = await listLetterheadMasters({
      search: req.query.search,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/letterheads/:id', letterheadReadRoles, async (req, res) => {
  try {
    const data = await getLetterheadMasterById(Number(req.params.id));
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/letterheads', letterheadRoles, async (req, res) => {
  try {
    const data = await createLetterheadMaster(req.body);
    res.json({ data, message: 'Letterhead created' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/letterheads/:id', letterheadRoles, async (req, res) => {
  try {
    const data = await updateLetterheadMaster(Number(req.params.id), req.body);
    res.json({ data, message: 'Letterhead updated' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/letterhead-branding', letterheadReadRoles, async (req, res) => {
  try {
    const data = await getLetterheadBranding();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/letterhead-branding', letterheadRoles, async (req, res) => {
  try {
    const data = await saveLetterheadBranding(req.body);
    res.json({ data, message: 'Letterhead master saved' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/letterhead', letterheadReadRoles, async (req, res) => {
  try {
    const data = await listLetterheads();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/letterhead/:poType', letterheadReadRoles, async (req, res) => {
  try {
    const data = await getLetterheadByType(req.params.poType);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/letterhead/:poType', letterheadRoles, async (req, res) => {
  try {
    const data = await saveLetterhead(req.params.poType, req.body);
    res.json({ data, message: `${data.poTypeLabel} template saved` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pr/:prId/context', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await getPoCreateContext(req.user, Number(req.params.prId));
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/pr/:prId/preview-document', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const po = await buildPoPreviewDocument(req.user, Number(req.params.prId), req.body);
    const html = buildPoHtml(po);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/pr/:prId/preview-pdf', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    // Same PO payload + HTML path as preview-document → PDF matches preview exactly
    const po = await buildPoPreviewDocument(req.user, Number(req.params.prId), req.body);
    const safeName = String(po.poNumber || `PR-${req.params.prId}`).replace(/[^\w.-]+/g, '_');
    const { filePath, fileName } = await renderPoPdfToFile(po, `${safeName}_preview.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/pr/:prId', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await createPurchaseOrder(req.user, Number(req.params.prId), req.body);
    res.json({ data, message: `PO ${data.poNumber} created and sent for SCM Manager approval` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/manual', requireRoles('SCM Buyer', 'Super Admin'), async (req, res) => {
  try {
    const data = await createManualPurchaseOrder(req.user, req.body || {});
    res.json({
      data,
      message: `PO ${data.poNumber} created${data.statusRaw === 'approved' ? '' : ' and sent for SCM Manager approval'} (no PR)`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/draft', requireRoles('SCM Buyer', 'Super Admin'), async (req, res) => {
  try {
    const data = await savePurchaseOrderDraft(req.user, req.body || {});
    res.json({ data, message: `Draft saved — ${data.poNumber}` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/manual/preview-document', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const po = await buildManualPoPreviewDocument(req.user, req.body || {});
    const html = buildPoHtml(po);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/manual/preview-pdf', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const po = await buildManualPoPreviewDocument(req.user, req.body || {});
    const safeName = String(po.poNumber || 'MANUAL-PO').replace(/[^\w.-]+/g, '_');
    const { filePath, fileName } = await renderPoPdfToFile(po, `${safeName}_preview.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pending', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const data = await listPurchaseOrders(req.user, { pendingOnly: true });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/pending-buyer-verify', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await listPurchaseOrders(req.user, { buyerVerifyOnly: true });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/vendor-acceptance', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const data = await listVendorAcceptancePOs(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/track', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const limit = req.query.limit != null ? Number(req.query.limit) : 10;
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const purchaseType =
      typeof req.query.purchaseType === 'string' ? req.query.purchaseType : 'all';
    const entityId = req.query.entityId != null ? Number(req.query.entityId) : undefined;
    const department = typeof req.query.department === 'string' ? req.query.department : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
    const result = await listTrackPurchaseOrders(req.user, {
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 10,
      search,
      status,
      purchaseType,
      entityId: Number.isFinite(entityId) ? entityId : undefined,
      department,
      category,
      dateFrom,
      dateTo,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/', requireRoles('SCM Buyer', 'SCM Manager'), async (req, res) => {
  try {
    const pendingOnly = req.query.pending === 'true';
    const buyerVerifyOnly = req.query.buyerVerify === 'true';
    const approvalQueue = req.query.approvalQueue === 'true' || req.user.role === 'SCM Manager';
    const data = await listPurchaseOrders(req.user, {
      pendingOnly,
      buyerVerifyOnly,
      approvalQueue: approvalQueue && !buyerVerifyOnly,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/by-number/:poNumber', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager', 'Super Admin'), async (req, res) => {
  try {
    const data = await getPurchaseOrderByNumber(req.params.poNumber);
    if (!data) return res.status(404).json({ message: 'PO not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/document', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager', 'Super Admin'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const { buildSignatureRenderOptions } = await import('../services/signatureService.js');
    const html = buildPoHtml(po, {
      signature: buildSignatureRenderOptions(po),
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/pdf', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager', 'Super Admin'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const isSigned = Boolean(po.signedPdfPath || po.signatureImagePath || po.signedAt);
    const preferredName = isSigned
      ? po.signedPdfPath || `${po.poNumber || `PO-${po.id}`}_signed.pdf`
      : po.pdfPath || `${po.poNumber || `PO-${po.id}`}_draft.pdf`;
    const { buildSignatureRenderOptions } = await import('../services/signatureService.js');
    const signatureOpts = buildSignatureRenderOptions(po);
    const { fullPath, fileName } = await ensurePoPdf(po, {
      fileName: preferredName,
      signed: isSigned,
      signature: signatureOpts,
      // Prefer existing PDF; deleted on signature backfill so missing files regenerate with Rajeev sig
      forceRegenerate: false,
    });
    // Persist regenerated PDF path when previous value was HTML-only
    if (!isSigned && po.pdfPath !== fileName) {
      try {
        const pool = (await import('../config/db.js')).default;
        await pool.query(`UPDATE purchase_orders SET pdf_path = ? WHERE id = ?`, [fileName, po.id]);
      } catch {
        /* non-fatal */
      }
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin', 'CFO', 'PR Manager'), async (req, res) => {
  try {
    const data = await getPurchaseOrderById(Number(req.params.id));
    if (!data) return res.status(404).json({ message: 'PO not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/preview-document', requireRoles('SCM Manager', 'SCM Buyer'), async (req, res) => {
  try {
    const po = await buildPoPreviewForPo(req.user, Number(req.params.id), req.body);
    const html = buildPoHtml(po);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/preview-pdf', requireRoles('SCM Manager', 'SCM Buyer'), async (req, res) => {
  try {
    // Same PO payload + HTML path as preview-document → PDF matches preview exactly
    const po = await buildPoPreviewForPo(req.user, Number(req.params.id), req.body);
    const safeName = String(po.poNumber || `PO-${req.params.id}`).replace(/[^\w.-]+/g, '_');
    const { filePath, fileName } = await renderPoPdfToFile(po, `${safeName}_preview.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', requireRoles('SCM Manager', 'SCM Buyer'), async (req, res) => {
  try {
    const data = await updatePurchaseOrder(req.user, Number(req.params.id), req.body);
    res.json({ data, message: `PO ${data.poNumber} updated successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/sign', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const { remarks, signatureName, signatureImage, signatureId, saveToGallery, dsc } = req.body;
    const data = await signPurchaseOrder(req.user, Number(req.params.id), {
      remarks,
      signatureName,
      signatureImage,
      signatureId,
      saveToGallery,
      dsc,
    });
    res.json({
      data,
      message: `PO signed. Next step: SCM Buyer Final Verify. Vendor mail is not sent at this step.`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/reject', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const { remarks } = req.body;
    const data = await rejectPurchaseOrder(req.user, Number(req.params.id), remarks);
    res.json({ data, message: 'PO rejected' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/send-back', requireRoles('SCM Manager'), async (req, res) => {
  try {
    const data = await sendBackPurchaseOrder(req.user, Number(req.params.id), req.body?.remarks);
    res.json({
      data,
      message: 'PO sent back to SCM Buyer for revision',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/cancel', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const data = await cancelPurchaseOrder(req.user, Number(req.params.id), req.body || {});
    res.json({ data, message: 'PO cancelled successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/final-verify', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await finalVerifyPurchaseOrder(req.user, Number(req.params.id), req.body?.remarks);
    res.json({
      data,
      message: 'PO final-verified. Requester and approvers notified. Vendor is not emailed from this step.',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/final-verify/reject', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await rejectBuyerFinalVerify(req.user, Number(req.params.id), req.body?.remarks);
    res.json({ data, message: 'PO rejected at buyer final verify' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/final-verify/send-back', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await sendBackBuyerFinalVerify(req.user, Number(req.params.id), req.body?.remarks);
    res.json({
      data,
      message: 'PO sent back to SCM Manager for re-approval',
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/vendor-acceptance/send-mail', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await sendVendorAcceptanceMail(req.user, Number(req.params.id));
    res.json({
      data,
      message: `Acceptance mail sent to ${data.vendorEmail} with signed PO attached`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/:id/vendor-acceptance/manual', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await submitManualVendorAcceptance(req.user, Number(req.params.id), req.body || {});
    res.json({ data, message: 'Vendor acceptance recorded manually' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/vendor-acceptance/file', requireRoles('SCM Buyer', 'SCM Manager'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const fullPath = resolveVendorAcceptanceFile(po);
    res.download(fullPath, po.vendorAcceptanceFileName || 'vendor-acceptance.pdf');
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/cancellation/:index/file', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const { fullPath, fileName } = resolveCancellationAttachment(po, req.params.index);
    res.download(fullPath, fileName);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
