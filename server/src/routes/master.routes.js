import { Router } from 'express';
import {
  authenticate,
  requireRolesOrPermissions,
  CREATE_PR_ROLES,
} from '../middleware/auth.js';
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
  listPoSiteLookups,
  createPoSiteLookup,
  listProjects,
  createProject,
  updateProject,
  exportProjectsCsv,
  getProjectImportTemplateCsv,
  importProjectsFromCsv,
} from '../services/masterService.js';

const router = Router();
router.use(authenticate);

const READ_ROLES = [
  'SCM Buyer',
  'SCM Manager',
  'Requester',
  'PR Manager',
  'CFO',
  'HOD Approver',
  'Super Admin',
  'Functional Team',
];
const MASTER_READ_PERMS = [
  'nav.create_pr',
  'nav.rfq_entry',
  'nav.scm_rfq_entry',
  'nav.item_master',
  'nav.category_master',
  'nav.entity_master',
  'nav.department_master',
  'nav.vendor_master',
  'nav.purchase_requests',
  'nav.create_po',
  'nav.track_po',
  'nav.po_approval',
  'nav.project_master',
  'nav.letterhead_master',
  'nav.po_letterhead_master',
];
const canReadMasters = requireRolesOrPermissions(READ_ROLES, MASTER_READ_PERMS);
const canQuickCreateFromPr = requireRolesOrPermissions(CREATE_PR_ROLES, [
  'nav.create_pr',
  'nav.item_master',
  'nav.category_master',
  'nav.entity_master',
  'nav.department_master',
  'nav.project_master',
]);
const MASTER_WRITE_ROLES = ['Requester', 'SCM Buyer', 'SCM Manager', 'Super Admin'];
const canManageItems = requireRolesOrPermissions(MASTER_WRITE_ROLES, ['nav.item_master']);
const canManageCategories = requireRolesOrPermissions(MASTER_WRITE_ROLES, ['nav.category_master']);
const canManageEntities = requireRolesOrPermissions(MASTER_WRITE_ROLES, ['nav.entity_master']);
const canManageDepartments = requireRolesOrPermissions(MASTER_WRITE_ROLES, ['nav.department_master']);
const canManageProjects = requireRolesOrPermissions(MASTER_WRITE_ROLES, ['nav.project_master']);

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/categories', canReadMasters, async (req, res) => {
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

router.post('/categories/chat-create', canQuickCreateFromPr, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new Error('Category name is required');
    const data = await createCategory({
      name,
      requestType: req.body?.requestType || 'All',
      description: req.body?.description || `Created from Create PR by ${req.user.email}`,
      status: 'active',
    });
    res.status(201).json({ data, message: 'Category created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  '/categories',
  requireRolesOrPermissions(CREATE_PR_ROLES, ['nav.create_pr', 'nav.category_master']),
  async (req, res) => {
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

router.get('/items', canReadMasters, async (req, res) => {
  try {
    const result = await listItems({
      search: req.query.search,
      categoryId: req.query.categoryId,
      status: req.query.status,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    if (Array.isArray(result)) return res.json({ data: result });
    return res.json(result);
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

router.post('/items/chat-create', canQuickCreateFromPr, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new Error('Item name is required');
    const data = await createItem({
      name,
      description: req.body?.description || name,
      categoryId: req.body?.categoryId || null,
      unit: req.body?.unit || 'Nos',
      hsnCode: req.body?.hsnCode,
      gstPercentage: req.body?.gstPercentage ?? 18,
      status: 'active',
    });
    res.status(201).json({ data, message: 'Item created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  '/items',
  requireRolesOrPermissions(CREATE_PR_ROLES, ['nav.create_pr', 'nav.item_master']),
  async (req, res) => {
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

router.get('/entities', canReadMasters, async (req, res) => {
  try {
    const result = await listEntities({
      search: req.query.search,
      status: req.query.status,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    if (Array.isArray(result)) return res.json({ data: result });
    return res.json(result);
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

router.post('/entities/chat-create', canQuickCreateFromPr, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new Error('Entity name is required');
    const costCenter =
      String(req.body?.costCenter || '').trim() ||
      name.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase() ||
      'GEN';
    const data = await createEntity({
      name,
      code: req.body?.code,
      costCenter,
      description: req.body?.description || `Created from PR chatbot by ${req.user.email}`,
      status: 'active',
    });
    res.status(201).json({ data, message: 'Entity created successfully' });
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

router.get('/departments', canReadMasters, async (req, res) => {
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

router.post('/departments/chat-create', canQuickCreateFromPr, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new Error('Department name is required');
    const data = await createDepartment({
      name,
      code: req.body?.code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase(),
      description: req.body?.description || `Created from PR chatbot by ${req.user.email}`,
      status: 'active',
    });
    res.status(201).json({ data, message: 'Department created successfully' });
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

router.get('/projects', canReadMasters, async (req, res) => {
  try {
    const data = await listProjects({
      search: req.query.search,
      status: req.query.status,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/projects/export', canManageProjects, async (_req, res) => {
  try {
    sendCsv(res, `projects-export-${Date.now()}.csv`, await exportProjectsCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/projects/import-template', canManageProjects, async (_req, res) => {
  try {
    sendCsv(res, 'projects-import-template.csv', getProjectImportTemplateCsv());
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/projects/import', canManageProjects, async (req, res) => {
  try {
    const csvText = req.body?.csv || req.body?.content || '';
    if (!csvText.trim()) throw new Error('CSV content is required');
    const result = await importProjectsFromCsv(csvText);
    res.json({
      data: result,
      message: `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/projects/chat-create', canQuickCreateFromPr, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new Error('Plant name is required');
    const data = await createProject({
      name,
      code: req.body?.code || '',
      billingLocation: req.body?.billingLocation || '',
      siteAddress: req.body?.siteAddress || '',
      description: req.body?.description || '',
      status: 'active',
    });
    res.status(201).json({ data, message: 'Plant created successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  '/projects',
  requireRolesOrPermissions(CREATE_PR_ROLES, ['nav.create_pr', 'nav.project_master']),
  async (req, res) => {
    try {
      const data = await createProject(req.body);
      res.json({ data, message: 'Plant created successfully' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.put('/projects/:id', canManageProjects, async (req, res) => {
  try {
    const data = await updateProject(Number(req.params.id), req.body);
    res.json({ data, message: 'Plant updated successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/po-site-lookups', canReadMasters, async (req, res) => {
  try {
    const data = await listPoSiteLookups({
      type: req.query.type,
      search: req.query.search,
    });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/po-site-lookups', canReadMasters, async (req, res) => {
  try {
    const data = await createPoSiteLookup(req.body);
    res.json({ data, message: 'Saved successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
