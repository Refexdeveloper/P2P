import pool from '../config/db.js';
import {
  listSendBackTargets,
  listAdminSendBackTargets,
  resolveSendBackTarget,
  immediatePreviousSendBackKey,
} from '../utils/sendBackTargets.js';
import { resolveScmBuyerUser, getPreferredScmManagerEmail } from '../utils/scmAssignee.js';
import { SASS_MUGESH_EMAIL } from './sassWorkflow.js';
import {
  getL1ManagerForEmail,
  getL2ManagerForEmail,
  ensureApproverUser,
} from './refexOneService.js';
import { queuePrApprovalPendingNotification, queuePostRfqActionNotification } from './emailService.js';

async function resolveHodUser(requesterEmail, departmentId) {
  let l1 = null;
  try {
    l1 = await getL1ManagerForEmail(requesterEmail);
  } catch {
    /* ignore */
  }
  if (!l1?.email) return { userId: null, email: null, name: null };
  const userId = await ensureApproverUser(l1, 'HOD Approver', departmentId);
  return { userId, email: l1.email, name: l1.name };
}

async function resolveL2User(requesterEmail, departmentId) {
  let l2 = null;
  try {
    l2 = await getL2ManagerForEmail(requesterEmail);
  } catch {
    /* ignore */
  }
  if (!l2?.email) return { userId: null, email: null, name: null };
  const userId = await ensureApproverUser(l2, 'PR Manager', departmentId);
  return { userId, email: l2.email, name: l2.name };
}

async function resolveRoleUser(role, conn = null) {
  if (role === 'SCM Buyer') {
    const buyer = await resolveScmBuyerUser(conn);
    return buyer
      ? { userId: buyer.id, email: buyer.email, name: buyer.name }
      : { userId: null, email: null, name: null };
  }
  const db = conn || pool;
  const [rows] = await db.query(
    `SELECT id, email, name FROM users WHERE role = ? AND is_active = 1 ORDER BY id ASC LIMIT 1`,
    [role]
  );
  if (!rows[0]) return { userId: null, email: null, name: null };
  return { userId: rows[0].id, email: rows[0].email, name: rows[0].name };
}

export async function getSendBackTargetsForPr(prId, { admin = false } = {}) {
  const [rows] = await pool.query(
    `SELECT status, vendor_selection, pr_flow, po_creation_by FROM purchase_requests WHERE id = ?`,
    [prId]
  );
  if (!rows[0]) throw new Error('PR not found');
  const targets = admin
    ? listAdminSendBackTargets(
        rows[0].status,
        rows[0].vendor_selection,
        rows[0].pr_flow,
        rows[0].po_creation_by
      )
    : listSendBackTargets(rows[0].status, rows[0].vendor_selection, rows[0].pr_flow);
  const preferred = immediatePreviousSendBackKey(
    rows[0].status,
    rows[0].vendor_selection,
    rows[0].pr_flow
  );
  const defaultKey = targets.some((t) => t.key === preferred)
    ? preferred
    : targets[targets.length - 1]?.key || null;
  return { targets, defaultKey };
}

/**
 * Apply send-back to a selected previous stage.
 * `pr` is raw purchase_requests row.
 * @param {{ admin?: boolean }} options — admin may target any prior stage for the path
 */
export async function applySendBackToTarget(conn, pr, returnTo, remarks, actor, options = {}) {
  const target = resolveSendBackTarget(returnTo);
  if (!target) {
    throw new Error('Select a previous stage to send back to');
  }

  const admin = Boolean(options.admin);
  const allowed = (
    admin
      ? listAdminSendBackTargets(pr.status, pr.vendor_selection, pr.pr_flow, pr.po_creation_by)
      : listSendBackTargets(pr.status, pr.vendor_selection, pr.pr_flow)
  ).map((t) => t.key);
  if (!allowed.includes(target.key)) {
    throw new Error(`Cannot send back to ${target.label} from the current stage`);
  }

  const db = conn || pool;
  const newStatus = target.status;
  const newStage = target.stage;
  const moveVerb = admin ? 'Moved to' : 'Sent back to';

  // Complete every pending task for this PR (approval / RFQ / PO steps share pr_id)
  await db.query(
    `UPDATE workflow_tasks
     SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND status = 'pending'`,
    [pr.id]
  );
  // Also complete pending tasks on linked POs if po_id column exists and is used
  try {
    await db.query(
      `UPDATE workflow_tasks wt
       INNER JOIN purchase_orders po ON po.id = wt.po_id
       SET wt.status = 'completed', wt.completed_at = NOW()
       WHERE po.pr_id = ? AND wt.status = 'pending'`,
      [pr.id]
    );
  } catch {
    /* po_id column may not exist — PR-scoped update above is enough */
  }

  const remarksText = String(remarks || '').trim();
  if (target.resetRfqSubmit || target.resetRfqFinalize || target.clearRecommendation || remarksText) {
    const sets = ['updated_at = NOW()'];
    const params = [];
    if (target.resetRfqFinalize) sets.push('finalized_at = NULL');
    if (target.resetRfqSubmit) sets.push('requester_submitted_at = NULL');
    if (target.clearRecommendation) {
      sets.push('recommended_invitation_id = NULL');
      sets.push('recommendation_justification = NULL');
    }
    if (remarksText) {
      sets.push('send_back_remarks = ?');
      params.push(
        `[${actor?.role || 'Approver'} → ${target.label}] ${remarksText}`
      );
    }
    params.push(pr.id);
    await db.query(`UPDATE rfq_configs SET ${sets.join(', ')} WHERE pr_id = ?`, params);
  }

  if (target.key === 'REQUESTER_PO') {
    await db.query(
      `UPDATE purchase_requests SET po_creation_by = 'requester', status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, newStage, pr.id]
    );
  } else if (target.key === 'SCM_PO') {
    await db.query(
      `UPDATE purchase_requests SET po_creation_by = 'scm', status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, newStage, pr.id]
    );
  } else {
    await db.query(
      `UPDATE purchase_requests SET status = ?, current_stage = ?, updated_at = NOW() WHERE id = ?`,
      [newStatus, newStage, pr.id]
    );
  }

  let assignee = { userId: null, email: null, name: null };
  let taskCreated = false;
  const [reqRows] = await db.query(`SELECT id, email, name FROM users WHERE id = ?`, [pr.requester_id]);
  const requester = reqRows[0] || null;

  if (target.taskType && target.assignedRole) {
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const dueStr = due.toISOString().split('T')[0];

    if (target.assignedRole === 'Requester') {
      assignee = {
        userId: pr.requester_id,
        email: requester?.email || null,
        name: requester?.name || null,
      };
    } else if (target.assignedRole === 'HOD Approver') {
      if (pr.pr_flow === 'functional') {
        let chain = [];
        try {
          const raw = pr.approval_user_ids;
          if (Array.isArray(raw)) chain = raw.map(Number).filter((id) => id > 0);
          else if (typeof raw === 'string' && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) chain = parsed.map(Number).filter((id) => id > 0);
          }
        } catch {
          chain = [];
        }
        const firstId = chain[0] || pr.approval_user_id;
        if (firstId) {
          const [stdRows] = await db.query(
            `SELECT id, email, name FROM users WHERE id = ? AND is_active = 1 LIMIT 1`,
            [firstId]
          );
          assignee = stdRows[0]
            ? { userId: stdRows[0].id, email: stdRows[0].email, name: stdRows[0].name }
            : { userId: firstId, email: null, name: null };
          await db.query(`UPDATE purchase_requests SET approval_user_id = ? WHERE id = ?`, [
            assignee.userId,
            pr.id,
          ]);
        }
      } else {
        assignee = await resolveHodUser(requester?.email || '', pr.department_id);
      }
    } else if (target.assignedRole === 'PR Manager') {
      assignee = await resolveL2User(requester?.email || '', pr.department_id);
    } else if (target.key === 'PO_MUGESH_SIGN') {
      const [mugeshRows] = await db.query(
        `SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(?) AND is_active = 1 LIMIT 1`,
        [SASS_MUGESH_EMAIL]
      );
      assignee = mugeshRows[0]
        ? { userId: mugeshRows[0].id, email: mugeshRows[0].email, name: mugeshRows[0].name }
        : { userId: null, email: SASS_MUGESH_EMAIL, name: 'Mugesh' };
    } else {
      assignee = await resolveRoleUser(target.assignedRole, db);
    }

    // SCM Buyer / SCM Manager: role-queue (null user) so any active user of that role can act
    const roleQueued =
      target.assignedRole === 'SCM Buyer' || target.assignedRole === 'SCM Manager';
    await db.query(
      `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [pr.id, target.taskType, target.assignedRole, roleQueued ? null : assignee.userId, dueStr]
    );
    taskCreated = true;
  }

  return {
    target,
    newStatus,
    newStage,
    assignee,
    requester,
    taskCreated,
    movedTo: { key: target.key, label: target.label, assignedRole: target.assignedRole || null },
    remarksLine: `${remarks.trim()}\n[${moveVerb}: ${target.label}]`,
    actorRole: actor?.role || '',
  };
}

/**
 * Notify the next-step owner after send-back / admin move.
 * When `normalHandoff` is true (admin Move to step), mail looks like a normal
 * workflow assignment — no “Sent back” / “Admin” wording for the recipient.
 */
export function queueSendBackNotifications(updatedPr, applyResult) {
  const { target, assignee, requester } = applyResult;
  const normalHandoff = Boolean(applyResult.normalHandoff);
  const requesterCreated = String(updatedPr.poCreationBy || updatedPr.po_creation_by || 'scm') === 'requester';
  const rajeevCc = requesterCreated ? [] : [getPreferredScmManagerEmail()].filter(Boolean);
  const cleanRemarks = String(
    applyResult.userRemarks || applyResult.remarksLine || ''
  )
    .replace(/\[(?:Admin[^\]]*|Moved to:[^\]]*|Sent back to:[^\]]*)\]/gi, '')
    .trim();
  const sendBackRemarks = normalHandoff ? '' : String(applyResult.remarksLine || '').trim();
  const stageLabel = normalHandoff ? target.label : `Sent back — ${target.label}`;

  // Requester Edit PR — handoff like a normal next-step mail (not “sent back”) when admin moves
  if (target.key === 'REQUESTER') {
    if (normalHandoff) {
      queuePrApprovalPendingNotification(
        updatedPr,
        'Requester',
        {
          name: requester?.name || updatedPr.requester,
          email: requester?.email,
        },
        updatedPr.departmentId ?? updatedPr.department_id ?? null,
        {
          stageLabel: target.label,
          approverEmails: requester?.email ? [requester.email] : undefined,
          approverName: requester?.name || updatedPr.requester,
          skipOpsBcc: true,
          bccOps: false,
          editPr: true,
        }
      );
      return;
    }
    queuePostRfqActionNotification(
      updatedPr,
      applyResult.actorRole || 'Approver',
      'return',
      applyResult.remarksLine,
      {
        name: requester?.name || updatedPr.requester,
        email: requester?.email,
      },
      { editPr: true, ccEmails: [], skipOpsBcc: true }
    );
    return;
  }

  // Requester Create PO / Requester RFQ — mail the requester only.
  if (
    (target.key === 'REQUESTER_RFQ' || target.key === 'REQUESTER_PO' || target.key === 'PO_REQUESTER_VERIFY') &&
    (assignee?.email || requester?.email)
  ) {
    const to = {
      name: assignee?.name || requester?.name || updatedPr.requester,
      email: assignee?.email || requester?.email,
    };
    if (normalHandoff) {
      const isRfqEntry = target.taskType === 'RFQ_ENTRY';
      const isCreatePo = target.key === 'REQUESTER_PO';
      queuePrApprovalPendingNotification(
        updatedPr,
        'Requester',
        to,
        updatedPr.departmentId ?? updatedPr.department_id ?? null,
        {
          stageLabel: target.label,
          rfqEntry: isRfqEntry,
          createPo: isCreatePo,
          approverEmails: to.email ? [to.email] : undefined,
          approverName: to.name,
          skipOpsBcc: true,
          bccOps: false,
        }
      );
      return;
    }
    queuePostRfqActionNotification(
      updatedPr,
      applyResult.actorRole || 'Approver',
      'return',
      applyResult.remarksLine,
      to,
      { editPr: false, ccEmails: [], skipOpsBcc: true }
    );
    return;
  }

  const canNotifyRole =
    Boolean(target.assignedRole) &&
    (Boolean(assignee?.email) ||
      target.assignedRole === 'SCM Buyer' ||
      target.assignedRole === 'SCM Manager');

  if (canNotifyRole) {
    const isRfqEntry = target.taskType === 'RFQ_ENTRY';
    const isCreatePo =
      target.key === 'SCM_PO' ||
      String(target.label || '').toLowerCase().includes('create po') ||
      (target.taskType === 'RFQ_POST_APPROVAL' && target.assignedRole === 'SCM Buyer');
    const notifyEmails =
      target.assignedRole === 'SCM Buyer' || target.assignedRole === 'SCM Manager'
        ? undefined
        : assignee?.email
          ? [assignee.email]
          : undefined;
    const mailOpts = {
      postRfq: target.taskType === 'RFQ_POST_APPROVAL',
      rfqEntry: isRfqEntry,
      createPo: isCreatePo,
      stageLabel,
      ...(sendBackRemarks ? { sendBackRemarks } : {}),
      ...(cleanRemarks && normalHandoff ? { notes: cleanRemarks } : {}),
      approverEmails: notifyEmails,
      approverName:
        target.assignedRole === 'SCM Buyer'
          ? 'SCM Buyer'
          : target.assignedRole === 'SCM Manager'
            ? 'SCM Manager'
            : assignee?.name || undefined,
      ccEmails: isCreatePo && !normalHandoff ? rajeevCc : [],
      skipOpsBcc: true,
      bccOps: false,
    };
    if (target.taskType === 'RFQ_POST_APPROVAL' || isCreatePo || (isRfqEntry && updatedPr.vendorSelection === 'own')) {
      void import('./rfqService.js')
        .then(({ queuePostQuotationApprovalMail }) =>
          queuePostQuotationApprovalMail(updatedPr, target.assignedRole, mailOpts)
        )
        .catch((err) => {
          console.warn('Step handoff RFQ pack mail failed, falling back:', err.message);
          queuePrApprovalPendingNotification(
            updatedPr,
            target.assignedRole,
            { name: updatedPr.requester, email: '' },
            updatedPr.departmentId ?? updatedPr.department_id ?? null,
            mailOpts
          );
        });
      return;
    }
    queuePrApprovalPendingNotification(
      updatedPr,
      target.assignedRole,
      { name: updatedPr.requester, email: '' },
      updatedPr.departmentId ?? updatedPr.department_id ?? null,
      mailOpts
    );
    return;
  }

  // Fallback: notify requester when assignee email is missing
  if (requester?.email || updatedPr.requester) {
    if (normalHandoff) {
      queuePrApprovalPendingNotification(
        updatedPr,
        'Requester',
        {
          name: requester?.name || updatedPr.requester,
          email: requester?.email,
        },
        updatedPr.departmentId ?? updatedPr.department_id ?? null,
        {
          stageLabel: target.label,
          approverEmails: requester?.email ? [requester.email] : undefined,
          skipOpsBcc: true,
          bccOps: false,
        }
      );
      return;
    }
    queuePostRfqActionNotification(
      updatedPr,
      applyResult.actorRole || 'Approver',
      'return',
      applyResult.remarksLine,
      {
        name: requester?.name || updatedPr.requester,
        email: requester?.email,
      },
      { ccEmails: [], skipOpsBcc: true }
    );
  }
}

export { listSendBackTargets, resolveSendBackTarget };
