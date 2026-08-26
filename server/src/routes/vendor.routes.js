import { Router } from 'express';
import { authenticate, requirePermissions, requireRolesOrPermissions, CREATE_PR_ROLES } from '../middleware/auth.js';
import {
  listVendors,
  createVendor,
  updateVendor,
  getVendorById,
  getVendorDocumentFile,
  uploadVendorDocument,
  exportVendorsCsv,
  getVendorImportTemplateCsv,
  importVendorsFromCsv,
} from '../services/vendorService.js';

const router = Router();
router.use(authenticate);

const canManageVendors = requirePermissions('nav.vendor_master');
const canUseVendorsForPr = requireRolesOrPermissions(CREATE_PR_ROLES, [
  'nav.create_pr',
  'nav.vendor_master',
  'nav.rfq_entry',
  'nav.scm_rfq_entry',
]);

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/', canUseVendorsForPr, async (req, res) => {
  try {
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const result = await listVendors({
      search: req.query.search,
      page: Number.isFinite(page) ? page : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/export', canManageVendors, async (_req, res) => {
  try {
    sendCsv(res, `vendors-export-${Date.now()}.csv`, await exportVendorsCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/import-template', canManageVendors, async (_req, res) => {
  try {
    sendCsv(res, 'vendors-import-template.csv', getVendorImportTemplateCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/import', canManageVendors, async (req, res) => {
  try {
    const csvText = req.body?.csv || req.body?.content || '';
    if (!csvText.trim()) throw new Error('CSV content is required');
    const result = await importVendorsFromCsv(req.user, csvText);
    res.json({
      data: result,
      message: `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', canUseVendorsForPr, async (req, res) => {
  try {
    const data = await getVendorById(Number(req.params.id));
    if (!data) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

function fileContentType(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

router.get('/:id/documents/:docType/file', canUseVendorsForPr, async (req, res) => {
  try {
    const { fullPath, fileName, buffer } = await getVendorDocumentFile(
      Number(req.params.id),
      req.params.docType
    );
    const contentType = fileContentType(fileName);
    const safeName = String(fileName || 'document').replace(/"/g, '');
    const disposition = `inline; filename="${safeName}"`;

    if (buffer) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', disposition);
      res.setHeader('Content-Length', buffer.length);
      return res.send(buffer);
    }

    if (fullPath) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', disposition);
      return res.sendFile(fullPath);
    }

    return res.status(404).json({ message: 'File not found on server' });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.post('/:id/documents', canUseVendorsForPr, async (req, res) => {
  try {
    const data = await uploadVendorDocument(Number(req.params.id), req.body || {});
    res.json({ data, message: 'Document saved' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/', canUseVendorsForPr, async (req, res) => {
  try {
    const data = await createVendor(req.user, req.body);
    res.json({ data, message: `Vendor ${data.vendorCode} created successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', canManageVendors, async (req, res) => {
  try {
    const data = await updateVendor(Number(req.params.id), req.body);
    res.json({ data, message: `Vendor ${data.vendorCode} updated successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
