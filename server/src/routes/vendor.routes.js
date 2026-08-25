import { Router } from 'express';
import { authenticate, requireRoles, requirePermissions, CREATE_PR_ROLES } from '../middleware/auth.js';
import {
  listVendors,
  createVendor,
  updateVendor,
  getVendorById,
  getVendorDocumentFile,
  exportVendorsCsv,
  getVendorImportTemplateCsv,
  importVendorsFromCsv,
} from '../services/vendorService.js';

const router = Router();
router.use(authenticate);

const canManageVendors = requirePermissions('nav.vendor_master');

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
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

router.get('/:id', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
  try {
    const data = await getVendorById(Number(req.params.id));
    if (!data) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id/documents/:docType/file', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
  try {
    const { fullPath, fileName } = await getVendorDocumentFile(Number(req.params.id), req.params.docType);
    res.download(fullPath, fileName);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.post('/', requireRoles(...CREATE_PR_ROLES), async (req, res) => {
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
