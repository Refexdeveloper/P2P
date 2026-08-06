import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth.js';
import {
  getPoCreateContext,
  createPurchaseOrder,
  buildPoPreviewDocument,
  listPurchaseOrders,
  listTrackPurchaseOrders,
  getPurchaseOrderById,
  getPurchaseOrderByNumber,
  signPurchaseOrder,
  rejectPurchaseOrder,
  finalVerifyPurchaseOrder,
  rejectBuyerFinalVerify,
  updatePurchaseOrder,
  buildPoPreviewForPo,
} from '../services/poService.js';
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
import { buildPoHtml, resolvePoDocumentPath } from '../services/poPdfService.js';
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
  signatureFileToDataUrl,
} from '../services/signatureService.js';

const router = Router();
router.use(authenticate);

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

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
    res.json({ data, message: `${data.poTypeLabel} PO type saved` });
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

router.post('/pr/:prId', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await createPurchaseOrder(req.user, Number(req.params.prId), req.body);
    res.json({ data, message: `PO ${data.poNumber} created and sent for SCM Manager approval` });
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

router.get('/track', requireRoles('SCM Buyer', 'SCM Manager', 'Super Admin'), async (req, res) => {
  try {
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const limit = req.query.limit != null ? Number(req.query.limit) : 10;
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const result = await listTrackPurchaseOrders(req.user, {
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 10,
      search,
      status,
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
    const data = await listPurchaseOrders(req.user, { pendingOnly, buyerVerifyOnly });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/by-number/:poNumber', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager'), async (req, res) => {
  try {
    const data = await getPurchaseOrderByNumber(req.params.poNumber);
    if (!data) return res.status(404).json({ message: 'PO not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/document', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const html = buildPoHtml(po, {
      signature: po.signatureName
        ? {
            name: po.signatureName,
            date: po.signedAt || '',
            comments: po.signerComments || '',
            imageDataUrl: signatureFileToDataUrl(po.signatureImagePath),
          }
        : undefined,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/pdf', requireRoles('SCM Buyer', 'SCM Manager', 'CFO', 'PR Manager'), async (req, res) => {
  try {
    const po = await getPurchaseOrderById(Number(req.params.id));
    if (!po) return res.status(404).json({ message: 'PO not found' });
    const { fullPath, fileName, isHtml } = resolvePoDocumentPath(po);
    if (isHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.sendFile(fullPath);
    }
    res.download(fullPath, fileName);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', requireRoles('SCM Buyer', 'SCM Manager'), async (req, res) => {
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
    const { remarks, signatureName, signatureImage, signatureId, saveToGallery } = req.body;
    const data = await signPurchaseOrder(req.user, Number(req.params.id), {
      remarks,
      signatureName,
      signatureImage,
      signatureId,
      saveToGallery,
    });
    res.json({
      data,
      message: `PO signed — sent to SCM Buyer for final verification before vendor dispatch`,
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

router.post('/:id/final-verify', requireRoles('SCM Buyer'), async (req, res) => {
  try {
    const data = await finalVerifyPurchaseOrder(req.user, Number(req.params.id), req.body?.remarks);
    res.json({
      data,
      message: `PO final-verified and emailed to ${data.vendorName} with all participants in CC`,
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

export default router;
