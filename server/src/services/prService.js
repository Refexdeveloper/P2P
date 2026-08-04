import pool from '../config/db.js';
import { queuePrRaisedNotification, queuePrApprovalPendingNotification } from './emailService.js';
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
import { nextDocumentNumber } from './documentNumberService.js';

async function getLineItems(prId) {
  const [rows] = await pool.query('SELECT * FROM pr_line_items WHERE pr_id = ? ORDER BY id', [prId]);
  return rows;
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
  return rows.map((r) => ({
    stage: r.stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    user: r.approver_name || 'System',
    role: r.approver_role || r.stage,
    date: formatDateTime(r.created_at),
    status: r.action === 'submitted' ? 'Completed' : r.action.charAt(0).toUpperCase() + r.action.slice(1),
    remarks: r.remarks || '',
  }));
}

async function enrichPR(row) {
  const lineItems = await getLineItems(row.id);
  const approvalHistory = await getApprovalHistory(row.id);
  return {
    id: row.id,
    prNumber: row.pr_number,
    title: row.title,
    requestType: row.request_type,
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
    totalAmount: Number(row.total_amount),
    status: row.status,
    statusFrontend: mapStatusToFrontend(row.status),
    statusUI: mapStatusToManagerUI(row.status),
    vendorSelection: row.vendor_selection === 'own' ? 'own' : 'scm',
    currentStage: row.current_stage,
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

async function resolveHodAssignment(requesterEmail, departmentId) {
  let l1Manager = null;

  try {
    l1Manager = await getL1ManagerForEmail(requesterEmail);
  } catch (err) {
    console.warn('RefexOne L1 manager lookup failed:', err.message);
  }

  if (!l1Manager?.email) {
    const [localRows] = await pool.query(
      `SELECT supervisor_email, supervisor_name FROM users WHERE email = ? LIMIT 1`,
      [requesterEmail.toLowerCase().trim()]
    );
    if (localRows[0]?.supervisor_email) {
      l1Manager = {
        email: localRows[0].supervisor_email,
        name: localRows[0].supervisor_name || localRows[0].supervisor_email.split('@')[0],
      };
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
  try {
    l2Manager = await getL2ManagerForEmail(requesterEmail);
  } catch (err) {
    console.warn('RefexOne L2 manager lookup failed:', err.message);
  }

  if (!l2Manager?.email) {
    const [localRows] = await pool.query(
      `SELECT l2_manager_email FROM users WHERE email = ? LIMIT 1`,
      [requesterEmail.toLowerCase().trim()]
    );
    if (localRows[0]?.l2_manager_email) {
      const email = localRows[0].l2_manager_email;
      l2Manager = { email, name: email.split('@')[0] };
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
    department,
    priority = 'Medium',
    justification,
    requiredDate,
    vendorSelection = 'scm',
    entityId,
    lineItems = [],
    submit = false,
  } = body;

  const vendorMode = vendorSelection === 'own' ? 'own' : 'scm';

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
       (pr_number, title, request_type, department_id, entity_id, requester_id, priority, justification, required_date, total_amount, status, vendor_selection, current_stage, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prNumber,
        prTitle,
        requestType,
        deptRows[0].id,
        Number(entityId),
        user.id,
        priority,
        justification,
        requiredDate || null,
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
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [prId, STAGE.SUBMITTED, user.id, 'submitted', 'PR submitted for approval']
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
          stageLabel: 'HOD / L1 Manager Approval',
        }
      );
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
  return {
    clause: ` AND pr.status = ? AND EXISTS (
      SELECT 1 FROM workflow_tasks wt
      WHERE wt.pr_id = pr.id
        AND wt.assigned_role = 'HOD Approver'
        AND wt.status = 'pending'
        AND (
          wt.assigned_user_id = ?
          OR (
            wt.assigned_user_id IS NULL
            AND EXISTS (
              SELECT 1 FROM users ru
              WHERE ru.id = pr.requester_id
                AND ru.supervisor_email IS NOT NULL
                AND LOWER(ru.supervisor_email) = LOWER(?)
            )
          )
        )
    )`,
    params: [PR_STATUS.PENDING_HOD_APPROVAL, user.id, user.email],
  };
}

export async function listPurchaseRequests(user, filters = {}) {
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
      sql += ' AND pr.status IN (?, ?)';
      params.push(PR_STATUS.PENDING_PR_MANAGER_APPROVAL, PR_STATUS.PENDING_RFQ_L2_APPROVAL);
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
      sql += ` AND pr.status = ?`;
      params.push(PR_STATUS.PENDING_SCM_PO);
    }
  }

  if (filters.status) {
    sql += ' AND pr.status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY pr.updated_at DESC';

  const [rows] = await pool.query(sql, params);
  return Promise.all(rows.map(enrichPR));
}

export async function getRequesterStats(userId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt FROM purchase_requests WHERE requester_id = ? GROUP BY status`,
    [userId]
  );
  const counts = Object.fromEntries(rows.map((r) => [r.status, r.cnt]));
  const pending =
    (counts[PR_STATUS.PENDING_HOD_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_PR_MANAGER_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_CFO_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_RFQ_MANAGER_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_RFQ_L2_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_RFQ_CFO_APPROVAL] || 0) +
    (counts[PR_STATUS.PENDING_SCM_PO] || 0);

  return {
    myPRCount: rows.reduce((s, r) => s + r.cnt, 0),
    pendingApprovals: pending,
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

export async function processApproval(user, prId, action, remarks) {
  const roleConfig = ROLE_STAGE_MAP[user.role];
  if (!roleConfig) throw new Error('Role cannot approve PRs');

  const [prRows] = await pool.query('SELECT * FROM purchase_requests WHERE id = ?', [prId]);
  if (!prRows.length) throw new Error('PR not found');

  const pr = prRows[0];
  if (pr.status !== roleConfig.status) {
    throw new Error(`PR is not pending your approval (current: ${pr.status})`);
  }

  if (user.role === 'HOD Approver') {
    const [taskRows] = await pool.query(
      `SELECT wt.assigned_user_id
       FROM workflow_tasks wt
       WHERE wt.pr_id = ? AND wt.assigned_role = 'HOD Approver' AND wt.status = 'pending'
       ORDER BY wt.id DESC LIMIT 1`,
      [prId]
    );
    const assignedUserId = taskRows[0]?.assigned_user_id;
    if (assignedUserId) {
      if (assignedUserId !== user.id) {
        throw new Error('This PR is assigned to another L1 manager for approval');
      }
    } else {
      const [requesterRows] = await pool.query(
        `SELECT supervisor_email FROM users WHERE id = ? LIMIT 1`,
        [pr.requester_id]
      );
      const supervisorEmail = (requesterRows[0]?.supervisor_email || '').toLowerCase();
      const userEmail = (user.email || '').toLowerCase();
      if (!supervisorEmail || supervisorEmail !== userEmail) {
        throw new Error('This PR is not assigned to you for approval');
      }
    }
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
      newStatus = PR_STATUS.RETURNED;
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
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, status, due_date) VALUES (?, 'PR_APPROVAL', ?, 'pending', ?)`,
        [prId, nextRole, dueDate.toISOString().split('T')[0]]
      );
    }

    // Own vendor: Requester RFQ Entry immediately after HOD approval
    if (user.role === 'HOD Approver' && action === 'approve' && pr.vendor_selection === 'own') {
      const rfqDue = new Date();
      rfqDue.setDate(rfqDue.getDate() + 5);
      await conn.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
        [prId, pr.requester_id, rfqDue.toISOString().split('T')[0]]
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
          stageLabel: nextRole === 'PR Manager' ? 'L2 Manager Approval' : undefined,
        }
      );
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
    department,
    priority,
    justification,
    requiredDate,
    vendorSelection,
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

  const run = async (db) => {
    await db.query(
      `UPDATE purchase_requests
       SET title = ?, request_type = ?, department_id = ?, priority = ?, justification = ?,
           required_date = ?, total_amount = ?, vendor_selection = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        prTitle,
        requestType || pr.request_type,
        deptRows[0].id,
        priority || pr.priority,
        justification,
        requiredDate || null,
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
        stageLabel: 'HOD / L1 Manager Approval',
      }
    );
    return updatedPr;
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

  // Always include PRs where this user is the assigned post-RFQ approver
  // (e.g. HOD Approver / L2 Manager from RefexOne)
  const [assignedRows] = await pool.query(
    `SELECT DISTINCT pr.id
     FROM purchase_requests pr
     JOIN workflow_tasks wt ON wt.pr_id = pr.id
     WHERE wt.task_type = 'RFQ_POST_APPROVAL'
       AND wt.status = 'pending'
       AND (wt.assigned_user_id = ? OR (wt.assigned_user_id IS NULL AND wt.assigned_role = ?))`,
    [user.id, user.role]
  );
  const existing = new Set(prs.map((p) => p.id));
  const assignedPostRfqIds = new Set(assignedRows.map((r) => r.id));
  for (const row of assignedRows) {
    if (!existing.has(row.id)) {
      const pr = await getPurchaseRequestById(row.id);
      if (pr) prs.push(pr);
    }
  }

  if (!prs.length) return [];

  return prs.map((pr) => {
    const due = new Date(pr.submittedDate || Date.now());
    due.setDate(due.getDate() + 1);
    const hoursLeft = Math.max(0, Math.round((due.getTime() - Date.now()) / 3600000));
    const isPostRfq = postRfqStatuses.has(pr.status) || assignedPostRfqIds.has(pr.id);

    return {
      id: String(pr.id),
      taskId: pr.id,
      prId: pr.id,
      prNumber: pr.prNumber,
      title: pr.title,
      requester: pr.requester,
      department: pr.department,
      totalAmount: pr.totalAmount,
      priority: pr.priorityLower || mapPriorityToFrontend(pr.priority),
      status: 'pending_approval',
      statusUI: pr.statusUI,
      submittedDate: pr.submittedDate,
      dueDate: formatDate(due),
      slaRemaining: hoursLeft || 24,
      isOverdue: hoursLeft <= 0,
      lineItems: pr.items,
      requestType: pr.requestType,
      requesterRole: 'Requester',
      requesterAvatar: (pr.requester || 'R').charAt(0).toUpperCase(),
      justification: pr.justification,
      isPostRfq,
      actionPath: isPostRfq ? `/rfq-approval/${pr.id}` : undefined,
    };
  });
}

export function toRequesterDashboardFormat(pr) {
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    department: pr.department,
    amount: pr.totalAmount,
    status: pr.statusFrontend,
    priority: pr.priorityLower,
    date: pr.submittedDate || pr.createdAt,
    items: pr.items,
    requestType: pr.requestType,
  };
}

export function toManagerDashboardFormat(pr) {
  const due = new Date(pr.submittedDate);
  due.setDate(due.getDate() + 5);
  return {
    id: pr.prNumber,
    prId: pr.id,
    title: pr.title,
    requester: pr.requester,
    department: pr.department,
    amount: pr.totalAmount,
    priority: pr.priority,
    status: pr.statusUI,
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
