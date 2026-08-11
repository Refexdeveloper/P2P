import pool from '../config/db.js';
import {
  queuePrRaisedNotification,
  queuePrApprovalPendingNotification,
  queuePostRfqActionNotification,
} from './emailService.js';
import {
  getL1ManagerForEmail,
  getL2ManagerForEmail,
  ensureApproverUser,
} from './refexOneService.js';
import {
  PR_STATUS,
  STAGE,
  ROLE_STAGE_MAP,
  POST_RFQ_ROLE_MAP,
  mapStatusToFrontend,
  mapStatusToManagerUI,
  mapPriorityToFrontend,
  formatDate,
  formatDateTime,
} from '../utils/constants.js';
import { nextDocumentNumber, normalizePurchaseType, purchaseTypeLabel } from './documentNumberService.js';
import { resolveScmBuyerUser } from '../utils/scmAssignee.js';
import { applySendBackToTarget, queueSendBackNotifications } from './sendBackService.js';

function normalizeCurrency(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase();
  if (code === 'EUR' || code === 'USD' || code === 'INR') return code;
  return 'INR';
}

async function getLineItems(prId) {
  const [rows] = await pool.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY id', [prId]);
  return rows;
}

function formatPrApprovalStage(stage) {
  const labels = {
    SUBMITTED: 'PR Submitted',
    HOD_REVIEW: 'L1 Manager Approval',
    PR_MANAGER_REVIEW: 'L2 Manager Approval',
    CFO_REVIEW: 'CFO Approval',
    RFQ_REQUESTER_SUBMIT: 'RFQ Submitted — Vendor Final',
    RFQ_MANAGER_REVIEW: 'Vendor Final Approval (Manager)',
    RFQ_L2_REVIEW: 'Vendor Final — L2 Manager',
    RFQ_CFO_REVIEW: 'Vendor Final — CFO Approval',
    RFQ_SCM_BUYER_SELECTION: 'SCM Vendor Selection',
    BUSINESS_REVIEW: 'SCM Manager Approval',
    SCM_PO_CREATE: 'PO Create',
    PO_CREATED: 'PO Create',
    PO_SIGNED: 'SCM Manager Sign',
    PO_BUYER_VERIFIED: 'SCM Buyer Final Verify',
    PO_BUYER_REJECTED: 'SCM Buyer Final Verify',
    PO_REJECTED: 'SCM Manager Approval',
    PO_UPDATED: 'PO Updated',
  };
  return (
    labels[stage] ||
    String(stage || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

async function getApprovalHistory(prId) {
  const [rows] = await pool.query(
    `SELECT pa.*, u.name AS approver_name, u.role AS approver_role
     FROM pr_approvals pa
     LEFT JOIN users u ON u.id = pa.approver_id
     WHERE pa.pr_id = ?
     ORDER BY pa.created_at ASC`,
    [prId]
  );
  const history = rows.map((r) => ({
    stage: formatPrApprovalStage(r.stage),
    user: r.approver_name || 'System',
    role: r.approver_role || formatPrApprovalStage(r.stage),
    date: formatDateTime(r.created_at),
    status: r.action === 'submitted' ? 'Completed' : r.action.charAt(0).toUpperCase() + r.action.slice(1),
    remarks: r.remarks || '',
    sortAt: new Date(r.created_at).getTime(),
  }));

  const stages = new Set(rows.map((r) => r.stage));
  const [cfgRows] = await pool.query(
    `SELECT rc.requester_submitted_at, rc.finalized_at, ri.vendor_name
     FROM rfq_configs rc
     LEFT JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
     WHERE rc.pr_id = ?
     LIMIT 1`,
    [prId]
  );
  const cfg = cfgRows[0];
  if (cfg?.requester_submitted_at && !stages.has(STAGE.RFQ_REQUESTER_SUBMIT)) {
    history.push({
      stage: formatPrApprovalStage(STAGE.RFQ_REQUESTER_SUBMIT),
      user: 'Requester',
      role: 'Requester',
      date: formatDateTime(cfg.requester_submitted_at),
      status: 'Submitted',
      remarks: `RFQ submitted for Vendor Final Approval${cfg.vendor_name ? `. Recommended vendor: ${cfg.vendor_name}` : ''}`,
      sortAt: new Date(cfg.requester_submitted_at).getTime(),
    });
  }
  if (cfg?.finalized_at && !stages.has(STAGE.RFQ_SCM_BUYER_SELECTION)) {
    history.push({
      stage: formatPrApprovalStage(STAGE.RFQ_SCM_BUYER_SELECTION),
      user: 'SCM Buyer',
      role: 'SCM Buyer',
      date: formatDateTime(cfg.finalized_at),
      status: 'Approved',
      remarks: `SCM Buyer Vendor Selection${cfg.vendor_name ? ` — recommended vendor: ${cfg.vendor_name}` : ''}`,
      sortAt: new Date(cfg.finalized_at).getTime(),
    });
  }

  history.sort((a, b) => a.sortAt - b.sortAt);
  return history.map(({ sortAt: _s, ...entry }) => entry);
}

let cachedScmBuyer = null;
let cachedScmBuyerAt = 0;

async function getCachedScmBuyer() {
  const now = Date.now();
  if (cachedScmBuyer && now - cachedScmBuyerAt < 60_000) return cachedScmBuyer;
  cachedScmBuyer = await resolveScmBuyerUser();
  cachedScmBuyerAt = now;
  return cachedScmBuyer;
}

async function getTimelineAssignees(prId, requesterId, prStatus = null) {
  const [taskRows] = await pool.query(
    `SELECT wt.assigned_role, wt.task_type, u.name AS user_name, u.email AS user_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ? AND wt.status = 'pending'
     ORDER BY wt.id DESC
     LIMIT 5`,
    [prId]
  );

  const byRole = (role) =>
    taskRows.find((t) => String(t.assigned_role || '') === role && (t.user_name || t.user_email));

  let l1Name = null;
  let l1Email = null;
  const hodTask = byRole('HOD Approver');
  if (hodTask) {
    l1Name = hodTask.user_name || null;
    l1Email = hodTask.user_email || null;
  }
  if (!l1Email && requesterId) {
    const [reqRows] = await pool.query(
      `SELECT supervisor_name, supervisor_email FROM users WHERE id = ? LIMIT 1`,
      [requesterId]
    );
    if (reqRows[0]?.supervisor_email) {
      l1Email = reqRows[0].supervisor_email;
      l1Name = reqRows[0].supervisor_name || reqRows[0].supervisor_email.split('@')[0];
    }
  }

  let scmName = null;
  let scmEmail = null;
  const scmTask = byRole('SCM Buyer');
  if (scmTask?.user_name || scmTask?.user_email) {
    scmName = scmTask.user_name || null;
    scmEmail = scmTask.user_email || null;
  } else if (
    prStatus === PR_STATUS.PENDING_SCM_PO ||
    prStatus === PR_STATUS.APPROVED ||
    !prStatus
  ) {
    const buyer = await getCachedScmBuyer();
    if (buyer) {
      scmName = buyer.name || null;
      scmEmail = buyer.email || null;
    }
  }

  let scmManagerName = null;
  let scmManagerEmail = null;
  const scmMgrTask = byRole('SCM Manager');
  if (scmMgrTask?.user_name || scmMgrTask?.user_email) {
    scmManagerName = scmMgrTask.user_name || null;
    scmManagerEmail = scmMgrTask.user_email || null;
  } else if (prStatus === PR_STATUS.PENDING_BUSINESS_APPROVAL) {
    const [mgrRows] = await pool.query(
      `SELECT name, email FROM users WHERE role = 'SCM Manager' AND is_active = 1 ORDER BY id ASC LIMIT 1`
    );
    if (mgrRows[0]) {
      scmManagerName = mgrRows[0].name || null;
      scmManagerEmail = mgrRows[0].email || null;
    }
  }

  const pendingTask = taskRows[0];
  const currentApproverName =
    pendingTask?.user_name ||
    (pendingTask?.assigned_role === 'HOD Approver' ? l1Name : null) ||
    (pendingTask?.assigned_role === 'SCM Buyer' ? scmName : null) ||
    (pendingTask?.assigned_role === 'SCM Manager' ? scmManagerName : null) ||
    null;
  const currentApproverEmail =
    pendingTask?.user_email ||
    (pendingTask?.assigned_role === 'HOD Approver' ? l1Email : null) ||
    (pendingTask?.assigned_role === 'SCM Buyer' ? scmEmail : null) ||
    (pendingTask?.assigned_role === 'SCM Manager' ? scmManagerEmail : null) ||
    null;

  return {
    currentApprover: currentApproverName
      ? { name: currentApproverName, email: currentApproverEmail, role: pendingTask?.assigned_role || null }
      : null,
    l1Manager: l1Name || l1Email ? { name: l1Name, email: l1Email } : null,
    scmBuyer: scmName || scmEmail ? { name: scmName, email: scmEmail } : null,
    scmManager:
      scmManagerName || scmManagerEmail
        ? { name: scmManagerName, email: scmManagerEmail }
        : null,
  };
}

async function enrichPR(row) {
  const [lineItems, approvalHistory, assignees, vendorRows, poRows, rfqMetaRows] = await Promise.all([
    getLineItems(row.id),
    getApprovalHistory(row.id),
    getTimelineAssignees(row.id, row.requester_id, row.status),
    pool
      .query(
        `SELECT ri.vendor_name
         FROM rfq_configs rc
         JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
         WHERE rc.pr_id = ?
         LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
    pool
      .query(
        `SELECT id, po_number, status, created_at
         FROM purchase_orders
         WHERE pr_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
    pool
      .query(
        `SELECT finalized_at FROM rfq_configs WHERE pr_id = ? LIMIT 1`,
        [row.id]
      )
      .then(([rows]) => rows),
  ]);
  const po = poRows[0] || null;
  return {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    requestType: row.request_type,
    purchaseType: row.purchase_type || 'purchase_order',
    purchaseTypeLabel: purchaseTypeLabel(row.purchase_type),
    department: row.department_name,
    departmentId: row.department_id,
    entityId: row.entity_id || null,
    entityName: row.entity_name || '',
    entityCode: row.entity_code || '',
    entityCostCenter: row.entity_cost_center || '',
    requester: row.requester_name,
    requesterId: row.requester_id,
    priority: row.priority,
    priorityLower: mapPriorityToFrontend(row.priority),
    justification: row.justification,
    requiredDate: formatDate(row.required_date),
    currency: normalizeCurrency(row.currency),
    totalAmount: Number(row.total_amount),
    status: row.status,
    statusFrontend: mapStatusToFrontend(row.status),
    statusUI: mapStatusToManagerUI(row.status),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    recommendedVendor: vendorRows[0]?.vendor_name || '',
    currentStage: row.current_stage,
    currentApprover: assignees.currentApprover,
    l1Manager: assignees.l1Manager,
    scmBuyer: assignees.scmBuyer,
    scmManager: assignees.scmManager,
    hasPurchaseOrder: Boolean(po),
    poNumber: po?.po_number || '',
    rfqFinalized: Boolean(rfqMetaRows[0]?.finalized_at),
    submittedDate: formatDate(row.submitted_at || row.created_at),
    createdAt: formatDate(row.created_at),
    lineItems: lineItems.map((li) => ({
      id: li.id,
      category: li.category,
      description: li.description,
      item: li.description,
      quantity: li.quantity,
      unitCost: Number(li.unit_cost),
      unitPrice: Number(li.unit_cost),
      total: Number(li.total),
    })),
    approvalHistory,
    items: lineItems.length,
  };
}

export async function previewL1Manager(user, departmentName) {
  let departmentId = null;
  if (departmentName) {
    const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [departmentName]);
    departmentId = deptRows[0]?.id || null;
  }
  const assignment = await resolveHodAssignment(user.email, departmentId);
  return {
    nextStep: 'L1 Manager Approval',
    l1Manager: {
      name: assignment.hodName || null,
      email: assignment.hodEmail || null,
    },
  };
}

async function resolveHodAssignment(requesterEmail, departmentId) {
  let l1Manager = null;
  const email = (requesterEmail || '').toLowerCase().trim();

  // Prefer local supervisor first — avoids slow RefexOne /users fetch on every PR submit
  if (email) {
    const [localRows] = await pool.query(
      `SELECT supervisor_email, supervisor_name FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (localRows[0]?.supervisor_email) {
      l1Manager = {
        email: localRows[0].supervisor_email,
        name: localRows[0].supervisor_name || localRows[0].supervisor_email.split('@')[0],
      };
    }
  }

  if (!l1Manager?.email) {
    try {
      l1Manager = await getL1ManagerForEmail(requesterEmail);
    } catch (err) {
      console.warn('RefexOne L1 manager lookup failed:', err.message);
    }
  }

  if (!l1Manager?.email) {
    return { hodUserId: null, hodEmail: null, hodName: null };
  }

  const hodUserId = await ensureApproverUser(l1Manager, 'HOD Approver', departmentId);
  return {
    hodUserId,
    hodEmail: l1Manager.email,
    hodName: l1Manager.name,
  };
}

async function createHodApprovalTask(conn, prId, requesterEmail, departmentId) {
  const { hodUserId, hodEmail, hodName } = await resolveHodAssignment(requesterEmail, departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'HOD Approver', ?, 'pending', ?)`,
    [prId, hodUserId, dueDate.toISOString().split('T')[0]]
  );

  return { hodUserId, hodEmail, hodName };
}

async function resolveL2Assignment(requesterEmail, departmentId) {
  let l2Manager = null;
  const email = (requesterEmail || '').toLowerCase().trim();

  if (email) {
    const [localRows] = await pool.query(
      `SELECT l2_manager_email FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    if (localRows[0]?.l2_manager_email) {
      const mgr = localRows[0].l2_manager_email;
      l2Manager = { email: mgr, name: mgr.split('@')[0] };
    }
  }

  if (!l2Manager?.email) {
    try {
      l2Manager = await getL2ManagerForEmail(requesterEmail);
    } catch (err) {
      console.warn('RefexOne L2 manager lookup failed:', err.message);
    }
  }

  if (!l2Manager?.email) {
    return { userId: null, email: null, name: null };
  }

  const userId = await ensureApproverUser(l2Manager, 'PR Manager', departmentId);
  return { userId, email: l2Manager.email, name: l2Manager.name };
}

async function createL2ApprovalTask(conn, prId, requesterEmail, departmentId) {
  const assignee = await resolveL2Assignment(requesterEmail, departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'PR Manager', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );

  return assignee;
}

export async function createPurchaseRequest(user, body) {
  const {
    title,
    requestType = 'Opex',
    purchaseType = 'purchase_order',
    department,
    priority = 'Medium',
    justification,
    requiredDate,
    vendorSelection = 'scm',
    entityId,
    currency = 'INR',
    lineItems = [],
    submit = false,
  } = body;

  const vendorMode = vendorSelection === 'own' ? 'own' : 'scm';
  const normalizedPurchaseType = normalizePurchaseType(purchaseType);
  const normalizedCurrency = normalizeCurrency(currency);

  if (!lineItems.length) {
    throw new Error('At least one line item is required');
  }
  if (!entityId) {
    throw new Error('Entity is required');
  }

  const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department]);
  if (!deptRows.length) throw new Error('Invalid department');

  const [entityRows] = await pool.query(
    `SELECT id FROM entity_masters WHERE id = ? AND status = 'active'`,
    [Number(entityId)]
  );
  if (!entityRows.length) throw new Error('Invalid or inactive entity');

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitCost ?? item.estimatedCost ?? 0),
    0
  );
  const prTitle = title || lineItems[0]?.description || `${requestType} Request`;
  const status = submit ? PR_STATUS.PENDING_HOD_APPROVAL : PR_STATUS.DRAFT;
  const currentStage = submit ? STAGE.HOD_REVIEW : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const prNumber = await nextDocumentNumber('PR', Number(entityId), conn);

    const [result] = await conn.query(
      `INSERT INTO purchase_requests
       (pr_number, title, request_type, purchase_type, department_id, entity_id, requester_id, priority, justification, required_date, currency, total_amount, status, vendor_selection, current_stage, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prNumber,
        prTitle,
        requestType,
        normalizedPurchaseType,
        deptRows[0].id,
        Number(entityId),
        user.id,
        priority,
        justification,
        requiredDate || null,
        normalizedCurrency,
        totalAmount,
        status,
        vendorMode,
        currentStage,
        submit ? new Date() : null,
      ]
    );

    const prId = result.insertId;

    for (const item of lineItems) {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost ?? item.estimatedCost ?? 0);
      await conn.query(
        `INSERT INTO pr_line_items (pr_id, category, description, quantity, unit_cost, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [prId, item.category || '', item.description, qty, cost, qty * cost]
      );
    }

    let hodAssignment = null;

    if (submit) {
      const vendorLabel =
        vendorMode === 'own' ? 'Own Vendor' : 'SCM Vendor Selection';
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [
          prId,
          STAGE.SUBMITTED,
          user.id,
          'submitted',
          `PR submitted for approval · Vendor path: ${vendorLabel}`,
        ]
      );

      hodAssignment = await createHodApprovalTask(conn, prId, user.email, deptRows[0].id);

      if (hodAssignment.hodEmail) {
        await conn.query(
          `UPDATE users SET supervisor_email = ?, supervisor_name = ? WHERE id = ?`,
          [hodAssignment.hodEmail, hodAssignment.hodName, user.id]
        );
      }
    }

    await conn.commit();
    const pr = await getPurchaseRequestById(prId);
    if (submit) {
      queuePrRaisedNotification(pr, { name: user.name, email: user.email });
      queuePrApprovalPendingNotification(
        pr,
        'HOD Approver',
        { name: user.name, email: user.email },
        deptRows[0].id,
        {
          approverEmails: hodAssignment?.hodEmail ? [hodAssignment.hodEmail] : undefined,
          approverName: hodAssignment?.hodName || undefined,
          stageLabel: 'L1 Manager Approval',
        }
      );
      return {
        ...pr,
        nextStep: 'L1 Manager Approval',
        l1Manager: {
          name: hodAssignment?.hodName || null,
          email: hodAssignment?.hodEmail || null,
        },
      };
    }
    return pr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getPurchaseRequestById(id) {
  const [rows] = await pool.query(
    `SELECT pr.*, d.name AS department_name, u.name AS requester_name,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center
     FROM purchase_requests pr
     JOIN departments d ON d.id = pr.department_id
     JOIN users u ON u.id = pr.requester_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     WHERE pr.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  return enrichPR(rows[0]);
}

function hodAssignedTaskSql(user) {
  // Pre-RFQ HOD + post-RFQ L1 vendor final — by assigned user or requester supervisor email
  return {
    clause: ` AND pr.status IN (?, ?) AND EXISTS (
      SELECT 1 FROM workflow_tasks wt
      WHERE wt.pr_id = pr.id
        AND wt.status = 'pending'
        AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
        AND (
          wt.assigned_user_id = ?
          OR (
            wt.assigned_user_id IS NULL
            AND wt.assigned_role = 'HOD Approver'
            AND EXISTS (
              SELECT 1 FROM users ru
              WHERE ru.id = pr.requester_id
                AND ru.supervisor_email IS NOT NULL
                AND LOWER(ru.supervisor_email) = LOWER(?)
            )
          )
        )
    )`,
    params: [
      PR_STATUS.PENDING_HOD_APPROVAL,
      PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
      user.id,
      user.email,
    ],
  };
}

const REQUESTER_PENDING_STATUSES = [
  PR_STATUS.PENDING_HOD_APPROVAL,
  PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
  PR_STATUS.PENDING_CFO_APPROVAL,
  PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
  PR_STATUS.PENDING_RFQ_L2_APPROVAL,
  PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
  PR_STATUS.PENDING_BUSINESS_APPROVAL,
  PR_STATUS.PENDING_SCM_PO,
];

/** Fast requester list — no line items / approval history / assignee N+1. */
export async function listRequesterPurchaseRequests(user, filters = {}) {
  const page = Math.max(1, parseInt(filters.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(filters.pageSize, 10) || 10));
  const offset = (page - 1) * pageSize;
  const search = String(filters.search || '').trim();
  const statusGroup = String(filters.status || 'all').toLowerCase();
  const requestType = String(filters.requestType || 'all');
  const dateFrom = String(filters.dateFrom || '').trim();
  const dateTo = String(filters.dateTo || '').trim();

  let where = 'WHERE 1=1';
  const params = [];

  if (user.role === 'Requester') {
    where += ' AND pr.requester_id = ?';
    params.push(user.id);
  }

  if (statusGroup === 'draft') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.DRAFT);
  } else if (statusGroup === 'returned') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.RETURNED);
  } else if (statusGroup === 'approved' || statusGroup === 'po_issued') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.APPROVED);
  } else if (statusGroup === 'rejected') {
    where += ' AND pr.status = ?';
    params.push(PR_STATUS.REJECTED);
  } else if (statusGroup === 'pending_approval' || statusGroup === 'pending') {
    where += ` AND pr.status IN (${REQUESTER_PENDING_STATUSES.map(() => '?').join(',')})`;
    params.push(...REQUESTER_PENDING_STATUSES);
  }

  if (requestType && requestType !== 'all') {
    where += ' AND pr.request_type = ?';
    params.push(requestType);
  }

  if (search) {
    const like = `%${search}%`;
    where += ` AND (
      pr.pr_number LIKE ? OR pr.title LIKE ?
      OR IFNULL(e.name, '') LIKE ? OR IFNULL(e.code, '') LIKE ?
      OR d.name LIKE ?
    )`;
    params.push(like, like, like, like, like);
  }

  if (dateFrom) {
    where += ' AND DATE(COALESCE(pr.submitted_at, pr.created_at)) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ' AND DATE(COALESCE(pr.submitted_at, pr.created_at)) <= ?';
    params.push(dateTo);
  }

  const fromSql = `
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    ${where}
  `;

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS total ${fromSql}`, params);
  const total = Number(countRow?.total || 0);

  const [rows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.request_type, pr.priority, pr.status,
            pr.total_amount, pr.justification, pr.required_date, pr.vendor_selection,
            pr.current_stage, pr.submitted_at, pr.created_at, pr.entity_id,
            d.name AS department_name, u.name AS requester_name,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
            (SELECT COUNT(*) FROM pr_line_items pli WHERE pli.pr_id = pr.id) AS item_count
     ${fromSql}
     ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const data = rows.map((row) =>
    toRequesterDashboardFormat({
      id: row.id,
      prNumber: row.pr_number,
      title: row.title,
      department: row.department_name,
      entityId: row.entity_id || null,
      entityName: row.entity_name || '',
      entityCode: row.entity_code || '',
      entityCostCenter: row.entity_cost_center || '',
      totalAmount: Number(row.total_amount || 0),
      status: row.status,
      statusFrontend: mapStatusToFrontend(row.status),
      statusUI: mapStatusToManagerUI(row.status),
      priorityLower: mapPriorityToFrontend(row.priority),
      submittedDate: formatDate(row.submitted_at || row.created_at),
      createdAt: formatDate(row.created_at),
      requiredDate: formatDate(row.required_date),
      justification: row.justification || '',
      lineItems: [],
      approvalHistory: [],
      requester: row.requester_name,
      vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
      currentStage: row.current_stage,
      items: Number(row.item_count || 0),
      requestType: row.request_type,
      currentApprover: null,
      l1Manager: null,
      scmBuyer: null,
    })
  );

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
    },
  };
}

export async function listPurchaseRequests(user, filters = {}) {
  // Requester lists use the lean paginated path — never N+1 enrich every PR
  if (user.role === 'Requester' && !filters.pendingOnly && filters.bucket !== 'scm') {
    const result = await listRequesterPurchaseRequests(user, {
      ...filters,
      page: filters.page || 1,
      pageSize: filters.pageSize || 50,
    });
    return result.data;
  }

  let sql = `
    SELECT pr.*, d.name AS department_name, u.name AS requester_name,
           e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    WHERE 1=1
  `;
  const params = [];

  if (user.role === 'Requester') {
    sql += ' AND pr.requester_id = ?';
    params.push(user.id);
  } else if (user.role === 'HOD Approver') {
    const hodFilter = hodAssignedTaskSql(user);
    sql += hodFilter.clause;
    params.push(...hodFilter.params);
  } else if (user.role === 'PR Manager') {
    if (filters.pendingOnly) {
      // Only PRs assigned to this L2 manager (or unassigned role queue)
      sql += ` AND pr.status IN (?, ?)
        AND (
          EXISTS (
            SELECT 1 FROM workflow_tasks wt
            WHERE wt.pr_id = pr.id
              AND wt.status = 'pending'
              AND wt.assigned_role = 'PR Manager'
              AND (wt.assigned_user_id = ? OR wt.assigned_user_id IS NULL)
          )
          OR NOT EXISTS (
            SELECT 1 FROM workflow_tasks wt2
            WHERE wt2.pr_id = pr.id
              AND wt2.status = 'pending'
              AND wt2.assigned_role = 'PR Manager'
          )
        )`;
      params.push(
        PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
        PR_STATUS.PENDING_RFQ_L2_APPROVAL,
        user.id
      );
    }
  } else if (user.role === 'CFO') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status IN (?, ?)';
      params.push(PR_STATUS.PENDING_CFO_APPROVAL, PR_STATUS.PENDING_RFQ_CFO_APPROVAL);
    }
  } else if (user.role === 'SCM Manager') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status = ?';
      params.push(PR_STATUS.PENDING_BUSINESS_APPROVAL);
    }
  } else if (user.role === 'SCM Buyer') {
    if (filters.pendingOnly) {
      sql += ' AND pr.status = ?';
      params.push(PR_STATUS.PENDING_SCM_PO);
    } else if (filters.bucket === 'scm') {
      // Ready for PO: pending SCM PO, or orphan APPROVED (RFQ done) with no active PO
      sql += ` AND (
        pr.status = ?
        OR (
          pr.status = ?
          AND EXISTS (
            SELECT 1 FROM rfq_configs rc
            WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.pr_id = pr.id
              AND po.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
          )
        )
      )`;
      params.push(PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED);
    }
  }

  if (filters.status) {
    sql += ' AND pr.status = ?';
    params.push(filters.status);
  }

  // Newest created/submitted first (HOD / approval queues)
  sql += ' ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC';

  // SCM bucket list is for dashboards only — skip heavy enrichPR (line items + approval history N+1)
  if (filters.bucket === 'scm') {
    const scmSql = `
    SELECT pr.*, d.name AS department_name, u.name AS requester_name,
           e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
           COALESCE((
             SELECT ri.vendor_name
             FROM rfq_configs rc
             JOIN rfq_invitations ri ON ri.id = rc.recommended_invitation_id
             WHERE rc.pr_id = pr.id
             LIMIT 1
           ), '') AS recommended_vendor_name
    FROM purchase_requests pr
    JOIN departments d ON d.id = pr.department_id
    JOIN users u ON u.id = pr.requester_id
    LEFT JOIN entity_masters e ON e.id = pr.entity_id
    WHERE 1=1
      AND (
        pr.status = ?
        OR (
          pr.status = ?
          AND EXISTS (
            SELECT 1 FROM rfq_configs rc
            WHERE rc.pr_id = pr.id AND rc.finalized_at IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM purchase_orders po
            WHERE po.pr_id = pr.id
              AND po.status IN ('pending_approval', 'pending_buyer_verify', 'approved', 'sent_to_vendor')
          )
        )
      )
    ORDER BY COALESCE(pr.submitted_at, pr.created_at) DESC, pr.id DESC
  `;
    const [rows] = await pool.query(scmSql, [PR_STATUS.PENDING_SCM_PO, PR_STATUS.APPROVED]);
    return rows.map((row) => mapScmBucketSummary(row));
  }

  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPR));
}

/** Lean PR row for SCM bucket lists — no line items / approval history queries. */
function mapScmBucketSummary(row) {
  return {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    requestType: row.request_type,
    purchaseType: row.purchase_type || 'purchase_order',
    purchaseTypeLabel: purchaseTypeLabel(row.purchase_type),
    department: row.department_name,
    departmentId: row.department_id,
    entityId: row.entity_id || null,
    entityName: row.entity_name || '',
    entityCode: row.entity_code || '',
    entityCostCenter: row.entity_cost_center || '',
    requester: row.requester_name,
    requesterId: row.requester_id,
    priority: row.priority,
    priorityLower: mapPriorityToFrontend(row.priority),
    justification: row.justification,
    requiredDate: formatDate(row.required_date),
    currency: normalizeCurrency(row.currency),
    totalAmount: Number(row.total_amount),
    status: row.status,
    statusFrontend: mapStatusToFrontend(row.status),
    statusUI: mapStatusToManagerUI(row.status),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    recommendedVendor: row.recommended_vendor_name || '',
    currentStage: row.current_stage,
    submittedDate: formatDate(row.submitted_at || row.created_at),
    createdAt: formatDate(row.created_at),
    lineItems: [],
    approvalHistory: [],
  };
}

export async function getRequesterStats(userId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM purchase_requests WHERE requester_id = ? GROUP BY status`,
    [userId]
  );
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.cnt]));
  const pendingStatuses = [
    PR_STATUS.PENDING_HOD_APPROVAL,
    PR_STATUS.PENDING_PR_MANAGER_APPROVAL,
    PR_STATUS.PENDING_CFO_APPROVAL,
    PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL,
    PR_STATUS.PENDING_RFQ_L2_APPROVAL,
    PR_STATUS.PENDING_RFQ_CFO_APPROVAL,
    PR_STATUS.PENDING_BUSINESS_APPROVAL,
    PR_STATUS.PENDING_SCM_PO,
  ];
  const pending = pendingStatuses.reduce((sum, s) => sum + (counts[s] || 0), 0);

  // Pending PRs past 1-day SLA from submit/create time
  const [overdueRows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM purchase_requests
     WHERE requester_id = ?
       AND status IN (${pendingStatuses.map(() => '?').join(',')})
       AND COALESCE(submitted_at, created_at) < (NOW() - INTERVAL 1 DAY)`,
    [userId, ...pendingStatuses]
  );

  return {
    myPRCount: rows.reduce((s, r) => s + r.cnt, 0),
    pendingApprovals: pending,
    approved: counts[PR_STATUS.APPROVED] || 0,
    rejected: counts[PR_STATUS.REJECTED] || 0,
    overdueSla: Number(overdueRows[0]?.cnt || 0),
    returnedForRework: counts[PR_STATUS.RETURNED] || 0,
    poIssued: counts[PR_STATUS.APPROVED] || 0,
    rfqEntryPending: await countRequesterRfqTasks(userId),
  };
}

async function countRequesterRfqTasks(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     WHERE wt.assigned_role = 'Requester' AND wt.task_type = 'RFQ_ENTRY' AND wt.status = 'pending'
     AND pr.requester_id = ?`,
    [userId]
  );
  return rows[0].cnt;
}

export async function getManagerStats() {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM purchase_requests GROUP BY status`
  );
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.cnt]));
  return {
    totalPRs: rows.reduce((s, r) => s + r.cnt, 0),
    pendingApproval:
      (counts[PR_STATUS.PENDING_PR_MANAGER_APPROVAL] || 0) +
      (counts[PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL] || 0),
    approvedThisMonth: counts[PR_STATUS.APPROVED] || 0,
    rejected: counts[PR_STATUS.REJECTED] || 0,
    overdueCount: 0,
    totalSpend: 0,
  };
}

/**
 * HOD / L1 can act when My Tasks would show the PR:
 * - pending task assigned to this user id, OR
 * - pending task assigned to same email (SSO / re-synced user id), OR
 * - unassigned HOD role-queue task and this user is the requester's L1 (supervisor), OR
 * - unassigned HOD role-queue task (same visibility as listTasks)
 */
async function assertHodCanActOnPr(user, prId) {
  const userEmail = String(user.email || '').toLowerCase().trim();
  const [taskRows] = await pool.query(
    `SELECT wt.assigned_user_id, u.email AS assigned_email
     FROM workflow_tasks wt
     LEFT JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ?
       AND wt.status = 'pending'
       AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
       AND (
         wt.assigned_user_id = ?
         OR wt.assigned_role = 'HOD Approver'
       )
     ORDER BY wt.id DESC
     LIMIT 1`,
    [prId, user.id]
  );

  if (!taskRows.length) {
    throw new Error('This PR is not assigned to you for approval');
  }

  const assignedUserId = taskRows[0].assigned_user_id;
  const assignedEmail = String(taskRows[0].assigned_email || '').toLowerCase().trim();

  if (assignedUserId) {
    if (assignedUserId === user.id) return;
    // Same person, different user row after SSO / RefexOne re-sync
    if (assignedEmail && userEmail && assignedEmail === userEmail) return;
    throw new Error('This PR is assigned to another L1 manager for approval');
  }

  // Unassigned HOD role-queue — same visibility as My Tasks (listTasks)
}

export async function processApproval(user, prId, action, remarks, options = {}) {
  const roleConfig = ROLE_STAGE_MAP[user.role];
  if (!roleConfig) throw new Error('Role cannot approve PRs');

  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  if (pr.status !== roleConfig.status) {
    throw new Error(`PR is not pending your approval (current: ${pr.status})`);
  }

  if (user.role === 'HOD Approver') {
    await assertHodCanActOnPr(user, prId);
  }

  if (!remarks?.trim()) throw new Error('Remarks are required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let newStatus;
    let newStage = null;
    let nextRole = null;

    let nextAssignee = null;

    if (action === 'approve') {
      if (user.role === 'HOD Approver') {
        if (pr.vendor_selection === 'own') {
          // Own: HOD → Requester RFQ Entry
          newStatus = PR_STATUS.APPROVED;
          newStage = null;
          nextRole = null;
        } else {
          // SCM: HOD → L2 Manager → CFO
          newStatus = PR_STATUS.PENDING_PR_MANAGER_APPROVAL;
          newStage = STAGE.PR_MANAGER_REVIEW;
          nextRole = 'PR Manager';
        }
      } else if (user.role === 'PR Manager') {
        newStatus = PR_STATUS.PENDING_CFO_APPROVAL;
        newStage = STAGE.CFO_REVIEW;
        nextRole = 'CFO';
      } else if (user.role === 'CFO') {
        // SCM path only (pre-RFQ): after CFO → SCM RFQ queue
        newStatus = PR_STATUS.APPROVED;
        newStage = null;
        nextRole = null;
      }
    } else if (action === 'reject') {
      newStatus = PR_STATUS.REJECTED;
    } else if (action === 'return' || action === 'rework') {
      const returnTo = options.returnTo || 'REQUESTER';
      const applyResult = await applySendBackToTarget(conn, pr, returnTo, remarks, user);
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
        [prId, roleConfig.stage, user.id, action, applyResult.remarksLine]
      );
      await conn.commit();
      const updatedPr = await getPurchaseRequestById(prId);
      queueSendBackNotifications(updatedPr, { ...applyResult, actorRole: user.role });
      return updatedPr;
    } else {
      throw new Error('Invalid action');
    }

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [prId, roleConfig.stage, user.id, action, remarks]
    );

    await conn.query(
      `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, newStage, prId]
    );

    await conn.query(
      `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
       WHERE pr_id = ? AND assigned_role = ? AND status = 'pending'`,
      [prId, user.role]
    );

    if (nextRole === 'PR Manager' && action === 'approve') {
      const [reqRows] = await conn.query(
        `SELECT u.email FROM users u WHERE u.id = ?`,
        [pr.requester_id]
      );
      nextAssignee = await createL2ApprovalTask(
        conn,
        prId,
        reqRows[0]?.email || '',
        pr.department_id
      );
    } else if (nextRole && action === 'approve') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      // Prefer a particular active user for role-queued steps (e.g. CFO)
      const [roleUsers] = await conn.query(
        `SELECT id, email, name FROM users WHERE role = ? AND is_active = 1 ORDER BY id ASC LIMIT 1`,
        [nextRole]
      );
      const roleUser = roleUsers[0] || null;
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'PR_APPROVAL', ?, ?, 'pending', ?)`,
        [prId, nextRole, roleUser?.id || null, dueDate.toISOString().split('T')[0]]
      );
      if (roleUser?.email) {
        nextAssignee = { email: roleUser.email, name: roleUser.name, userId: roleUser.id };
      }
    }

    // Own vendor: Requester RFQ Entry immediately after HOD approval
    let rfqEntryRequester = null;
    if (user.role === 'HOD Approver' && action === 'approve' && pr.vendor_selection === 'own') {
      const rfqDue = new Date();
      rfqDue.setDate(rfqDue.getDate() + 5);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
        [prId, pr.requester_id, rfqDue.toISOString().split('T')[0]]
      );
      const [reqRows] = await conn.query(`SELECT id, email, name FROM users WHERE id = ?`, [
        pr.requester_id,
      ]);
      rfqEntryRequester = reqRows[0] || null;
    }

    // SCM vendor: after CFO pre-RFQ → SCM Buyer RFQ Entry (/scm/rfq-entry)
    let scmRfqBuyer = null;
    if (user.role === 'CFO' && action === 'approve') {
      const rfqDue = new Date();
      rfqDue.setDate(rfqDue.getDate() + 5);
      scmRfqBuyer = await resolveScmBuyerUser(conn);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'SCM Buyer', ?, 'pending', ?)`,
        [prId, scmRfqBuyer?.id || null, rfqDue.toISOString().split('T')[0]]
      );
    }

    await conn.commit();
    const updatedPr = await getPurchaseRequestById(prId);
    if (nextRole && action === 'approve') {
      queuePrApprovalPendingNotification(
        updatedPr,
        nextRole,
        { name: updatedPr.requester, email: '' },
        updatedPr.departmentId,
        {
          approverEmails: nextAssignee?.email ? [nextAssignee.email] : undefined,
          approverName: nextAssignee?.name || undefined,
          stageLabel: nextRole === 'PR Manager' ? 'L2 Manager Approval' : `${nextRole} Approval`,
        }
      );
    } else if (rfqEntryRequester?.email) {
      // Particular requester — RFQ entry step
      queuePrApprovalPendingNotification(
        updatedPr,
        'Requester',
        { name: rfqEntryRequester.name, email: rfqEntryRequester.email },
        updatedPr.departmentId,
        {
          approverEmails: [rfqEntryRequester.email],
          approverName: rfqEntryRequester.name,
          stageLabel: 'RFQ Entry Required',
        }
      );
    } else if (user.role === 'CFO' && action === 'approve') {
      // SCM path: CFO done → SCM Buyer RFQ Entry mail
      queuePrApprovalPendingNotification(
        updatedPr,
        'SCM Buyer',
        { name: updatedPr.requester, email: '' },
        updatedPr.departmentId,
        {
          rfqEntry: true,
          stageLabel: 'SCM RFQ Entry',
          approverEmails: scmRfqBuyer?.email ? [scmRfqBuyer.email] : undefined,
          approverName: scmRfqBuyer?.name || undefined,
        }
      );
    } else if (action === 'reject' || action === 'return' || action === 'rework') {
      // Particular requester — return / reject
      queuePostRfqActionNotification(updatedPr, user.role, action, remarks, {
        name: updatedPr.requester,
      });
    }
    return updatedPr;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updatePurchaseRequest(user, prId, body, conn = null) {
  const [prRows] = await pool.query(
    'SELECT * FROM purchase_requests WHERE id = ? AND requester_id = ?',
    [prId, user.id]
  );
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  if (pr.status !== PR_STATUS.RETURNED && pr.status !== PR_STATUS.DRAFT) {
    throw new Error('Only returned or draft PRs can be edited');
  }

  const {
    title,
    requestType,
    purchaseType,
    department,
    priority,
    justification,
    requiredDate,
    vendorSelection,
    currency,
    lineItems = [],
  } = body;

  if (!lineItems.length) throw new Error('At least one line item is required');

  const [deptRows] = await pool.query('SELECT id FROM departments WHERE name = ?', [department]);
  if (!deptRows.length) throw new Error('Invalid department');

  const totalAmount = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitCost ?? item.estimatedCost ?? 0),
    0
  );
  const prTitle = title || lineItems[0]?.description || `${requestType || pr.request_type} Request`;
  const vendorMode =
    vendorSelection === 'own' || vendorSelection === 'scm'
      ? vendorSelection
      : pr.vendor_selection === 'own'
        ? 'own'
        : 'scm';
  const normalizedPurchaseType = purchaseType
    ? normalizePurchaseType(purchaseType)
    : normalizePurchaseType(pr.purchase_type);
  const normalizedCurrency = normalizeCurrency(currency ?? pr.currency);

  const run = async (db) => {
    await db.query(
      `UPDATE purchase_requests
       SET title = ?, request_type = ?, purchase_type = ?, department_id = ?, priority = ?, justification = ?,
           required_date = ?, currency = ?, total_amount = ?, vendor_selection = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        prTitle,
        requestType || pr.request_type,
        normalizedPurchaseType,
        deptRows[0].id,
        priority || pr.priority,
        justification,
        requiredDate || null,
        normalizedCurrency,
        totalAmount,
        vendorMode,
        prId,
      ]
    );

    await db.query('DELETE FROM pr_line_items WHERE pr_id = ?', [prId]);

    for (const item of lineItems) {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost ?? item.estimatedCost ?? 0);
      await db.query(
        `INSERT INTO pr_line_items (pr_id, category, description, quantity, unit_cost, total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [prId, item.category || '', item.description, qty, cost, qty * cost]
      );
    }
  };

  if (conn) {
    await run(conn);
  } else {
    const ownConn = await pool.getConnection();
    try {
      await ownConn.beginTransaction();
      await run(ownConn);
      await ownConn.commit();
    } catch (err) {
      await ownConn.rollback();
      throw err;
    } finally {
      ownConn.release();
    }
  }

  return getPurchaseRequestById(prId);
}

export async function resubmitPurchaseRequest(user, prId, body = {}) {
  const { remarks, ...updateFields } = body;
  const hasUpdates = Object.keys(updateFields).length > 0;

  const [prRows] = await pool.query(
    'SELECT * FROM purchase_requests WHERE id = ? AND requester_id = ?',
    [prId, user.id]
  );
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  if (pr.status !== PR_STATUS.RETURNED && pr.status !== PR_STATUS.DRAFT) {
    throw new Error('Only returned or draft PRs can be resubmitted');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (hasUpdates) {
      await updatePurchaseRequest(user, prId, updateFields, conn);
    }

    await conn.query(
      `UPDATE purchase_requests
       SET status = ?, current_stage = ?, submitted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [PR_STATUS.PENDING_HOD_APPROVAL, STAGE.HOD_REVIEW, prId]
    );

    await conn.query(
      `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks) VALUES (?, ?, ?, ?, ?)`,
      [
        prId,
        STAGE.SUBMITTED,
        user.id,
        'resubmitted',
        remarks?.trim() || 'PR resubmitted after rework',
      ]
    );

    await conn.query(
      `UPDATE workflow_tasks SET status = 'cancelled', completed_at = NOW()
       WHERE pr_id = ? AND status = 'pending'`,
      [prId]
    );

    const hodAssignment = await createHodApprovalTask(conn, prId, user.email, pr.department_id);

    if (hodAssignment.hodEmail) {
      await conn.query(
        `UPDATE users SET supervisor_email = ?, supervisor_name = ? WHERE id = ?`,
        [hodAssignment.hodEmail, hodAssignment.hodName, user.id]
      );
    }

    await conn.commit();
    const updatedPr = await getPurchaseRequestById(prId);
    queuePrRaisedNotification(updatedPr, { name: user.name, email: user.email }, { isResubmit: true });
    queuePrApprovalPendingNotification(
      updatedPr,
      'HOD Approver',
      { name: user.name, email: user.email },
      pr.department_id,
      {
        approverEmails: hodAssignment.hodEmail ? [hodAssignment.hodEmail] : undefined,
        approverName: hodAssignment.hodName || undefined,
        stageLabel: 'L1 Manager Approval',
      }
    );
    return {
      ...updatedPr,
      nextStep: 'L1 Manager Approval',
      l1Manager: {
        name: hodAssignment?.hodName || null,
        email: hodAssignment?.hodEmail || null,
      },
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listRequesterTasks(userId) {
  const [rows] = await pool.query(
    `SELECT wt.id, wt.pr_id, wt.task_type, wt.due_date, wt.created_at,
            pr.pr_number, pr.title, pr.total_amount, pr.status AS pr_status, pr.request_type,
            d.name AS department_name
     FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     JOIN departments d ON d.id = pr.department_id
     WHERE wt.assigned_role = 'Requester' AND wt.status = 'pending' AND pr.requester_id = ?
     ORDER BY wt.created_at DESC`,
    [userId]
  );

  return rows.map((r) => ({
    id: String(r.id),
    taskId: r.id,
    prId: r.pr_id,
    taskType: r.task_type,
    prNumber: r.pr_number,
    title: r.title,
    department: r.department_name,
    totalAmount: Number(r.total_amount),
    requestType: r.request_type,
    prStatus: r.pr_status,
    dueDate: formatDate(r.due_date),
    label: r.task_type === 'RFQ_ENTRY' ? 'RFQ Entry' : r.task_type.replace(/_/g, ' '),
    actionPath: `/requester/rfq-entry/${r.pr_id}?taskId=${r.id}`,
  }));
}

export async function completeRequesterTask(user, taskId) {
  const [rows] = await pool.query(
    `SELECT wt.*, pr.requester_id FROM workflow_tasks wt
     JOIN purchase_requests pr ON pr.id = wt.pr_id
     WHERE wt.id = ? AND wt.assigned_role = 'Requester' AND wt.status = 'pending'`,
    [taskId]
  );
  if (!rows.length) throw new Error('Task not found');
  if (rows[0].requester_id !== user.id) throw new Error('Unauthorized');

  await pool.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW() WHERE id = ?`,
    [taskId]
  );
  return { success: true };
}

function mapApproverActionToTaskStatus(action) {
  if (action === 'approve') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'return' || action === 'rework') return 'returned';
  return 'pending_approval';
}

function buildTaskRow(pr, { status, isPostRfq = false, decidedAt = null }) {
  const due = new Date(pr.submittedDate || Date.now());
  due.setDate(due.getDate() + 1);
  const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
  const pending = status === 'pending_approval';

  return {
    id: String(pr.id),
    taskId: pr.id,
    prId: pr.id,
    prNumber: pr.prNumber,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entityId: pr.entityId || null,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    totalAmount: pr.totalAmount,
    priority: pr.priorityLower || mapPriorityToFrontend(pr.priority),
    status,
    statusUI: pr.statusUI,
    submittedDate: decidedAt ? formatDate(decidedAt) : pr.submittedDate,
    dueDate: formatDate(due),
    slaRemaining: pending ? hoursLeft || 24 : 0,
    isOverdue: pending && hoursLeft <= 0,
    lineItems: Array.isArray(pr.lineItems) ? pr.lineItems.length : (pr.items || 0),
    requestType: pr.requestType,
    requesterRole: 'Requester',
    requesterAvatar: (pr.requester || 'R').charAt(0).toUpperCase(),
    justification: pr.justification,
    isPostRfq,
    actionPath: isPostRfq ? `/rfq-approval/${pr.id}` : undefined,
  };
}

/** Latest approve/reject/return decisions by this user for their approval stage(s). */
async function listMyApprovalDecisions(user) {
  const stages = [
    ROLE_STAGE_MAP[user.role]?.stage,
    POST_RFQ_ROLE_MAP[user.role]?.stage,
  ].filter(Boolean);
  if (!stages.length) return [];

  const placeholders = stages.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT pr.*, d.name AS department_name, u.name AS requester_name,
            e.name AS entity_name, e.code AS entity_code, e.cost_center AS entity_cost_center,
            pa.action AS my_action, pa.created_at AS decided_at, pa.stage AS my_stage
     FROM pr_approvals pa
     INNER JOIN (
       SELECT pr_id, MAX(id) AS max_id
       FROM pr_approvals
       WHERE approver_id = ?
         AND stage IN (${placeholders})
         AND action IN ('approve', 'reject', 'return', 'rework')
       GROUP BY pr_id
     ) latest ON latest.max_id = pa.id
     JOIN purchase_requests pr ON pr.id = pa.pr_id
     JOIN departments d ON d.id = pr.department_id
     JOIN users u ON u.id = pr.requester_id
     LEFT JOIN entity_masters e ON e.id = pr.entity_id
     ORDER BY pa.created_at DESC`,
    [user.id, ...stages]
  );

  return rows.map((row) => {
    const summary = mapScmBucketSummary(row);
    return {
      ...summary,
      items: 0,
      myAction: row.my_action,
      decidedAt: row.decided_at,
      myStage: row.my_stage,
    };
  });
}

export async function listTasks(user) {
  const roleConfig = ROLE_STAGE_MAP[user.role];
  const postRfqConfig = POST_RFQ_ROLE_MAP[user.role];
  const postRfqStatuses = new Set(Object.values(POST_RFQ_ROLE_MAP).map((c) => c.status));
  const allowedStatuses = new Set(
    [roleConfig?.status, postRfqConfig?.status].filter(Boolean)
  );

  let prs = [];

  if (user.role === 'HOD Approver') {
    prs = await listPurchaseRequests(user, { pendingOnly: true });
  } else if (roleConfig || postRfqConfig) {
    const all = await listPurchaseRequests(user, { pendingOnly: true });
    prs = all.filter((p) => allowedStatuses.has(p.status));
  }

  // Always include PRs where this user is the assigned approver
  // Match by assigned_user_id first (even if assigned_role was stored wrong).
  const [assignedRows] = await pool.query(
    `SELECT DISTINCT pr.id, wt.task_type, pr.status AS pr_status
     FROM purchase_requests pr
     JOIN workflow_tasks wt ON wt.pr_id = pr.id
     WHERE wt.status = 'pending'
       AND wt.task_type IN ('PR_APPROVAL', 'RFQ_POST_APPROVAL')
       AND (
         wt.assigned_user_id = ?
         OR (wt.assigned_user_id IS NULL AND wt.assigned_role = ?)
       )`,
    [user.id, user.role]
  );
  const pendingIds = new Set(prs.map((p) => p.id));
  // Only RFQ_POST_APPROVAL (or post-RFQ statuses) count as post-RFQ — not every assigned PR
  const assignedPostRfqIds = new Set(
    assignedRows
      .filter(
        (r) =>
          r.task_type === 'RFQ_POST_APPROVAL' ||
          postRfqStatuses.has(r.pr_status)
      )
      .map((r) => r.id)
  );
  for (const row of assignedRows) {
    if (!pendingIds.has(row.id)) {
      const pr = await getPurchaseRequestById(row.id);
      if (pr) {
        prs.push(pr);
        pendingIds.add(pr.id);
      }
    }
  }

  // Include PRs this approver already acted on (Approved / Rejected / Returned)
  const decided = await listMyApprovalDecisions(user);
  const decidedByPrId = new Map();
  for (const pr of decided) {
    decidedByPrId.set(pr.id, pr);
    if (!pendingIds.has(pr.id)) {
      prs.push(pr);
    }
  }

  // Pending first (newest), then completed
  prs.sort((a, b) => {
    const aPending = pendingIds.has(a.id) ? 0 : 1;
    const bPending = pendingIds.has(b.id) ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    const aTime = new Date(
      decidedByPrId.get(a.id)?.decidedAt || a.submittedDate || a.createdAt || 0
    ).getTime();
    const bTime = new Date(
      decidedByPrId.get(b.id)?.decidedAt || b.submittedDate || b.createdAt || 0
    ).getTime();
    if (bTime !== aTime) return bTime - aTime;
    return Number(b.id) - Number(a.id);
  });

  const tasks = prs.map((pr) => {
    const isPending = pendingIds.has(pr.id);
    const decision = decidedByPrId.get(pr.id);
    const status = isPending
      ? 'pending_approval'
      : mapApproverActionToTaskStatus(decision?.myAction);
    // Pending post-RFQ stages, or a pending RFQ_POST_APPROVAL assignment.
    // Do NOT treat completed decisions as post-RFQ for routing.
    const isPostRfq = isPending
      ? postRfqStatuses.has(pr.status) || assignedPostRfqIds.has(pr.id)
      : decision?.myStage === POST_RFQ_ROLE_MAP[user.role]?.stage;

    return buildTaskRow(pr, {
      status,
      isPostRfq,
      decidedAt: !isPending ? decision?.decidedAt : null,
    });
  });

  // SCM Buyer final verify after Manager sign-off
  if (user.role === 'SCM Buyer') {
    const [buyerVerifyRows] = await pool.query(
      `SELECT po.id AS po_id, po.po_number, po.grand_total, po.pr_id, pr.title, pr.priority,
              d.name AS department_name, u.name AS requester_name, wt.due_date,
              e.id AS entity_id, e.name AS entity_name, e.code AS entity_code
       FROM purchase_orders po
       JOIN purchase_requests pr ON pr.id = po.pr_id
       JOIN departments d ON d.id = pr.department_id
       JOIN users u ON u.id = pr.requester_id
       LEFT JOIN entity_masters e ON e.id = pr.entity_id
       LEFT JOIN workflow_tasks wt ON wt.pr_id = po.pr_id
         AND wt.task_type = 'PO_BUYER_VERIFY' AND wt.status = 'pending'
       WHERE po.status = 'pending_buyer_verify'
       ORDER BY po.signed_at DESC, po.updated_at DESC`
    );
    for (const row of buyerVerifyRows) {
      const due = row.due_date ? new Date(row.due_date) : new Date();
      if (!row.due_date) due.setDate(due.getDate() + 1);
      const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
      tasks.push({
        id: `po-verify-${row.po_id}`,
        taskId: row.po_id,
        prId: row.pr_id,
        prNumber: row.po_number,
        title: `${row.title} — Final Verify`,
        requester: row.requester_name,
        department: row.department_name,
        entityId: row.entity_id || null,
        entityName: row.entity_name || '',
        entityCode: row.entity_code || '',
        totalAmount: Number(row.grand_total),
        priority: mapPriorityToFrontend(row.priority),
        status: 'pending_approval',
        statusUI: 'Pending Buyer Verify',
        submittedDate: formatDate(due),
        dueDate: formatDate(due),
        slaRemaining: hoursLeft || 24,
        isOverdue: hoursLeft <= 0,
        lineItems: 0,
        requestType: 'PO',
        requesterRole: 'SCM Manager',
        requesterAvatar: 'S',
        justification: 'SCM Manager signed — final verify before sending to vendor',
        isPostRfq: false,
        actionPath: '/scm/buyer-final-verify',
      });
    }
  }

  return tasks;
}

export function toRequesterDashboardFormat(pr) {
  return {
    // Dashboard-compatible fields
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    department: pr.department,
    entityId: pr.entityId || null,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    entityCostCenter: pr.entityCostCenter || '',
    amount: pr.totalAmount,
    status: pr.statusFrontend,
    priority: pr.priorityLower,
    date: pr.submittedDate || pr.createdAt,
    items: pr.items,
    requestType: pr.requestType,
    // Full fields for Track PR / expanded views
    prNumber: pr.prNumber,
    totalAmount: pr.totalAmount,
    statusRaw: pr.status,
    statusFrontend: pr.statusFrontend,
    statusUI: pr.statusUI,
    priorityLower: pr.priorityLower,
    submittedDate: pr.submittedDate,
    createdAt: pr.createdAt,
    requiredDate: pr.requiredDate,
    justification: pr.justification,
    lineItems: pr.lineItems,
    approvalHistory: pr.approvalHistory,
    requester: pr.requester,
    vendorSelection: pr.vendorSelection,
    currentStage: pr.currentStage,
    currentApprover: pr.currentApprover || null,
    l1Manager: pr.l1Manager || null,
    scmBuyer: pr.scmBuyer || null,
  };
}

export function toManagerDashboardFormat(pr) {
  const due = new Date(pr.submittedDate);
  due.setDate(due.getDate() + 5);
  const isPostRfq = Boolean(
    POST_RFQ_ROLE_MAP['PR Manager'] &&
      (pr.status === PR_STATUS.PENDING_RFQ_L2_APPROVAL ||
        pr.status === PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL ||
        pr.status === PR_STATUS.PENDING_RFQ_CFO_APPROVAL ||
        pr.status === PR_STATUS.PENDING_BUSINESS_APPROVAL)
  );
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entityName: pr.entityName || '',
    entityCode: pr.entityCode || '',
    amount: pr.totalAmount,
    priority: pr.priority,
    status: pr.statusUI,
    statusKey: pr.status,
    isPostRfq,
    submittedDate: pr.submittedDate,
    dueDate: formatDate(due),
    isOverdue: false,
    justification: pr.justification,
    lineItems: pr.lineItems,
    approvalHistory: pr.approvalHistory,
  };
}

export function toCfoDashboardFormat(pr) {
  const due = new Date(pr.submittedDate || Date.now());
  due.setDate(due.getDate() + 5);
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    entity: pr.department,
    amount: pr.totalAmount,
    priority: pr.priority,
    status: pr.status === PR_STATUS.PENDING_CFO_APPROVAL ? 'Pending CFO Approval' : pr.statusUI,
    submittedDate: pr.submittedDate,
    dueDate: formatDate(due),
    justification: pr.justification,
    isHighValue: pr.totalAmount >= 500000,
    isOverdue: false,
    lineItems: pr.lineItems.map((li) => ({
      id: String(li.id),
      itemName: li.description,
      description: li.description,
      quantity: li.quantity,
      unit: 'Unit',
      estimatedPrice: li.unitPrice,
      totalPrice: li.total,
      category: li.category,
    })),
    approvalHistory: pr.approvalHistory.map((h) => ({
      stage: h.stage,
      approver: h.user,
      role: h.role,
      action: h.status,
      remarks: h.remarks,
      timestamp: h.date,
    })),
  };
}
