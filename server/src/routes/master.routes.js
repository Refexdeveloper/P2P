import { Router } from 'express';
import { authenticate, requireRoles, requirePermissions } from '../middleware/auth.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  listItems,
  createItem,
  updateItem,
  exportCategoriesCsv,
  getCategoryImportTemplateCsv,
  importCategoriesFromCsv,
  exportItemsCsv,
  getItemImportTemplateCsv,
  importItemsFromCsv,
  listEntities,
  createEntity,
  updateEntity,
  exportEntitiesCsv,
  getEntityImportTemplateCsv,
  importEntitiesFromCsv,
  listDepartments,
  createDepartment,
  updateDepartment,
} from '../services/masterService.js';

const router = Router();
router.use(authenticate);

const READ_ROLES = ['SCM Buyer', 'SCM Manager', 'Requester', 'PR Manager', 'CFO', 'HOD Approver'];
const canManageItems = requirePermissions('nav.item_master');
const canManageCategories = requirePermissions('nav.category_master');
const canManageEntities = requirePermissions('nav.entity_master');
const canManageDepartments = requirePermissions('nav.department_master');

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/categories', requireRoles(...READ_ROLES), async (req, res) => {
  try {
    const data = await listCategories({
      search: req.query.search,
      requestType: req.query.requestType,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/categories/export', canManageCategories, async (_req, res) => {
  try {
    sendCsv(res, `categories-export-${Date.now()}.csv`, await exportCategoriesCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/categories/import-template', canManageCategories, async (_req, res) => {
  try {
    sendCsv(res, 'categories-import-template.csv', getCategoryImportTemplateCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/categories/import', canManageCategories, async (req, res) => {
  try {
    const csvText = req.body?.csv || req.body?.content || '';
    if (!csvText.trim()) throw new Error('CSV content is required');
    const result = await importCategoriesFromCsv(csvText);
    res.json({
      data: result,
      message: `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/categories', canManageCategories, async (req, res) => {
  try {
    const data = await createCategory(req.body);
    res.json({ data, message: 'Category created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/categories/:id', canManageCategories, async (req, res) => {
  try {
    const data = await updateCategory(Number(req.params.id), req.body);
    res.json({ data, message: 'Category updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/items', requireRoles(...READ_ROLES), async (req, res) => {
  try {
    const data = await listItems({
      search: req.query.search,
      categoryId: req.query.categoryId,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/items/export', canManageItems, async (_req, res) => {
  try {
    sendCsv(res, `items-export-${Date.now()}.csv`, await exportItemsCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/items/import-template', canManageItems, async (_req, res) => {
  try {
    sendCsv(res, 'items-import-template.csv', getItemImportTemplateCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/items/import', canManageItems, async (req, res) => {
  try {
    const csvText = req.body?.csv || req.body?.content || '';
    if (!csvText.trim()) throw new Error('CSV content is required');
    const result = await importItemsFromCsv(csvText);
    res.json({
      data: result,
      message: `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/items', canManageItems, async (req, res) => {
  try {
    const data = await createItem(req.body);
    res.json({ data, message: `Item ${data.itemCode} created successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/items/:id', canManageItems, async (req, res) => {
  try {
    const data = await updateItem(Number(req.params.id), req.body);
    res.json({ data, message: `Item ${data.itemCode} updated successfully` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/entities', requireRoles(...READ_ROLES), async (req, res) => {
  try {
    const data = await listEntities({
      search: req.query.search,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/entities/export', canManageEntities, async (_req, res) => {
  try {
    sendCsv(res, `entities-export-${Date.now()}.csv`, await exportEntitiesCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/entities/import-template', canManageEntities, async (_req, res) => {
  try {
    sendCsv(res, 'entities-import-template.csv', getEntityImportTemplateCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/entities/import', canManageEntities, async (req, res) => {
  try {
    const csvText = req.body?.csv || req.body?.content || '';
    if (!csvText.trim()) throw new Error('CSV content is required');
    const result = await importEntitiesFromCsv(csvText);
    res.json({
      data: result,
      message: `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/entities', canManageEntities, async (req, res) => {
  try {
    const data = await createEntity(req.body);
    res.json({ data, message: 'Entity created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/entities/:id', canManageEntities, async (req, res) => {
  try {
    const data = await updateEntity(Number(req.params.id), req.body);
    res.json({ data, message: 'Entity updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/departments', requireRoles(...READ_ROLES), async (req, res) => {
  try {
    const data = await listDepartments({
      search: req.query.search,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/departments', canManageDepartments, async (req, res) => {
  try {
    const data = await createDepartment(req.body);
    res.json({ data, message: 'Department created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/departments/:id', canManageDepartments, async (req, res) => {
  try {
    const data = await updateDepartment(Number(req.params.id), req.body);
    res.json({ data, message: 'Department updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
