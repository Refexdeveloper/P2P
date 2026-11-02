import { Router } from 'express';
import {
  authenticate,
  requireRoles,
  requireRolesOrPermissions,
  requireRolesOrPermissionsAsRequester,
} from '../middleware/auth.js';
import {
  listPendingGrnPos,
  listGrnReceiverUsers,
  listGrns,
  submitGrn,
  listInvoices,
  uploadInvoiceDocument,
  verifyInvoice,
  managerApproveInvoice,
  uploadPayment,
  getAccountsDashboard,
  resolveInvoiceFile,
  resolveGrnLineAttachmentFile,
  getInvoiceById,
  sendVendorInvoiceMail,
  getInvoiceByToken,
  submitInvoiceByToken,
} from '../services/accountsFulfillmentService.js';
import { sendStoredFile } from '../utils/sendStoredFile.js';

const router = Router();

const GRN_ROLES = ['SCM Buyer', 'SCM Manager', 'Super Admin', 'Functional Team', 'Requester'];
const ACCOUNTS_ROLES = ['Accounts Payable', 'Accounts Manager', 'Super Admin', 'SCM Manager'];
const INVOICE_ENTRY_ROLES = ['SCM Buyer', 'Super Admin', 'Accounts Payable', 'Accounts Manager', 'Requester'];
/** Menus granted from Admin → User Permissions (e.g. to an L1 Manager) */
const GRN_CODES = ['nav.grn'];
const INVOICE_CODES = ['nav.requester_vendor_invoice', 'nav.vendor_invoice'];
const grnAccess = requireRolesOrPermissionsAsRequester(GRN_ROLES, GRN_CODES);
const grnReadAccess = requireRolesOrPermissionsAsRequester([...GRN_ROLES, ...ACCOUNTS_ROLES], GRN_CODES);
const invoiceReadAccess = requireRolesOrPermissionsAsRequester(
  [...ACCOUNTS_ROLES, 'SCM Buyer', 'Requester'],
  INVOICE_CODES
);
const invoiceEntryAccess = requireRolesOrPermissionsAsRequester(INVOICE_ENTRY_ROLES, INVOICE_CODES);

/** Public vendor invoice submit (token link from email) */
router.get('/vendor-invoice/:token', async (req, res) => {
  try {
    const data = await getInvoiceByToken(req.params.token);
    res.json({ data });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.post('/vendor-invoice/:token', async (req, res) => {
  try {
    const data = await submitInvoiceByToken(req.params.token, req.body);
    res.json({ data, message: 'Invoice submitted successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.use(authenticate);

router.get('/dashboard', requireRoles(...ACCOUNTS_ROLES), async (req, res) => {
  try {
    const data = await getAccountsDashboard();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/grn/pending-pos', grnAccess, async (req, res) => {
  try {
    const data = await listPendingGrnPos(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/grn/users', grnAccess, async (_req, res) => {
  try {
    const data = await listGrnReceiverUsers();
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/grn', grnReadAccess, async (req, res) => {
  try {
    const data = await listGrns(req.user);
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/grn', grnAccess, async (req, res) => {
  try {
    const data = await submitGrn(req.user, req.body);
    res.json({ data, message: data.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get(
  '/grn/line-attachments/:id/file',
  requireRolesOrPermissions(
    [...GRN_ROLES, ...ACCOUNTS_ROLES, 'CFO', 'PR Manager', 'HOD Approver'],
    ['nav.track_po', 'nav.grn', 'nav.invoice_verification']
  ),
  async (req, res) => {
    try {
      const file = await resolveGrnLineAttachmentFile(Number(req.params.id));
      if (!file) return res.status(404).json({ message: 'GRN attachment not found' });
      return sendStoredFile(res, file);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.get('/invoices', invoiceReadAccess, async (req, res) => {
  try {
    const forPayment = req.query.forPayment === 'true';
    const data = await listInvoices(req.user, { forPayment });
    res.json({ data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/invoices/:id', invoiceReadAccess, async (req, res) => {
  try {
    const data = await getInvoiceById(Number(req.params.id));
    res.json({ data });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
});

router.post('/invoices/:id/send-mail', invoiceEntryAccess, async (req, res) => {
  try {
    const data = await sendVendorInvoiceMail(req.user, Number(req.params.id));
    res.json({ data, message: data.message });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invoices/:id/manual', invoiceEntryAccess, async (req, res) => {
  try {
    const data = await uploadInvoiceDocument(req.user, Number(req.params.id), {
      ...req.body,
      mode: 'manual',
    });
    res.json({ data, message: 'Invoice recorded via manual entry' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invoices/:id/upload', requireRoles(...ACCOUNTS_ROLES, 'SCM Buyer'), async (req, res) => {
  try {
    const data = await uploadInvoiceDocument(req.user, Number(req.params.id), {
      ...req.body,
      mode: req.body?.mode || 'manual',
    });
    res.json({ data, message: 'Invoice uploaded — pending verification' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/invoices/:id/verify', requireRoles('Accounts Payable', 'Accounts Manager', 'Super Admin'), async (req, res) => {
  try {
    const data = await verifyInvoice(req.user, Number(req.params.id), {
      action: req.body?.action,
      remarks: req.body?.remarks,
    });
    res.json({ data, message: 'Invoice verification updated' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post(
  '/invoices/:id/manager-approve',
  requireRoles('Accounts Manager', 'Super Admin', 'SCM Manager'),
  async (req, res) => {
    try {
      const data = await managerApproveInvoice(req.user, Number(req.params.id), {
        action: req.body?.action || 'approve',
        remarks: req.body?.remarks,
      });
      res.json({ data, message: 'Manager decision recorded' });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  }
);

router.post('/invoices/:id/payment', requireRoles(...ACCOUNTS_ROLES), async (req, res) => {
  try {
    const data = await uploadPayment(req.user, Number(req.params.id), req.body);
    res.json({ data, message: 'Payment uploaded — PO marked paid' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get(
  '/invoices/:id/file',
  requireRolesOrPermissions(
    [...ACCOUNTS_ROLES, 'SCM Buyer', 'CFO', 'PR Manager', 'HOD Approver', 'Requester'],
    ['nav.track_po', 'nav.invoice_verification', 'nav.cfo_insights', ...INVOICE_CODES]
  ),
  async (req, res) => {
  try {
    const file = await resolveInvoiceFile(Number(req.params.id));
    if (!file) return res.status(404).json({ message: 'Invoice file not found' });
    return sendStoredFile(res, file);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
