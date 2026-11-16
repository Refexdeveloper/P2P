/**
 * New Joiners Laptop Purchase workflow
 * HR Create PR (joiner roster) → Mugesh approval → Reginold RFQ Entry
 * → vendor rounds → L1/L2 → SCM Final RFQ → SCM PO
 */
import pool from '../config/db.js';
import { ensureApproverUser } from './refexOneService.js';
import { SASS_MUGESH_EMAIL, SASS_MUGESH_NAME, resolveSassMugeshAssignment } from './sassWorkflow.js';

export const NEW_JOINERS_RFQ_EMAIL = 'reginold.j@refex.co.in';
export const NEW_JOINERS_RFQ_NAME = 'Reginold J';
export const NEW_JOINERS_PURCHASE_TYPE = 'new_joiners_laptop';

export function isNewJoinersLaptopType(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return (
    raw === 'new_joiners_laptop' ||
    raw === 'new_joiner_laptop' ||
    raw === 'newjoinerslaptop' ||
    raw === 'njl'
  );
}

export function isNewJoinersLaptopPr(pr = {}) {
  return isNewJoinersLaptopType(pr.purchase_type || pr.purchaseType);
}

export function normalizeJoinerRow(raw = {}, creator = null) {
  const firstName = String(raw.firstName || raw.first_name || '').trim();
  const lastName = String(raw.lastName || raw.last_name || '').trim();
  const createdByName = String(
    creator?.name ||
      raw.createdByName ||
      raw.created_by_name ||
      raw.hrName ||
      raw.hr_name ||
      ''
  ).trim();
  const createdByUserId =
    Number(creator?.id || raw.createdByUserId || raw.created_by_user_id || 0) || null;
  const createdByEmail = String(
    creator?.email || raw.createdByEmail || raw.created_by_email || ''
  ).trim();
  return {
    hrUpdatedDate: String(raw.hrUpdatedDate || raw.hr_updated_date || '').trim(),
    joiningDate: String(raw.joiningDate || raw.joining_date || '').trim(),
    firstName,
    lastName,
    mobileNumber: String(raw.mobileNumber || raw.mobile_number || raw.mobile || '').trim(),
    designation: String(raw.designation || '').trim(),
    department: String(raw.department || '').trim(),
    company: String(raw.company || '').trim(),
    location: String(raw.location || '').trim(),
    // HR Name UI removed — store who created the PR instead
    hrName: createdByName,
    createdByName,
    createdByUserId,
    createdByEmail,
    reportingHead: String(
      raw.reportingHead || raw.reporting_head || raw.reportingHeadEmail || ''
    ).trim(),
    reportingHeadUserId:
      Number(raw.reportingHeadUserId || raw.reporting_head_user_id || 0) || null,
    reportingHeadName: String(
      raw.reportingHeadName || raw.reporting_head_name || ''
    ).trim(),
    reportingHeadEmail: String(
      raw.reportingHeadEmail || raw.reporting_head_email || ''
    ).trim(),
    onRollsOrContract: String(
      raw.onRollsOrContract || raw.on_rolls_or_contract || raw.employmentType || 'On Rolls'
    ).trim(),
    emailRequired: String(raw.emailRequired || raw.email_id || raw.emailId || '').trim(),
    deviceType: String(raw.deviceType || raw.laptop_desktop || raw.laptopDesktop || 'Laptop').trim(),
    inventoryStatus: String(raw.inventoryStatus || raw.inventory_status || '').trim(),
    remarks: String(raw.remarks || '').trim(),
    linkedRequesterId: Number(raw.linkedRequesterId || raw.linked_requester_id || 0) || null,
  };
}

export function parseJoinerDetails(raw, creator = null) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => normalizeJoinerRow(row, creator))
    .filter((row) => row.firstName || row.lastName || row.mobileNumber);
}

export function stampJoinerCreator(joiners, user) {
  const creator = user
    ? {
        id: user.id,
        name: String(user.name || '').trim(),
        email: String(user.email || '').trim(),
      }
    : null;
  return parseJoinerDetails(joiners, creator);
}

export function assertJoinerDetailsForSubmit(joiners, creator = null) {
  const list = parseJoinerDetails(joiners, creator);
  if (!list.length) {
    throw new Error('Add at least one new joiner for New Joiners Laptop Purchase');
  }
  for (let i = 0; i < list.length; i += 1) {
    const row = list[i];
    if (!row.firstName) throw new Error(`Joiner #${i + 1}: First Name is required`);
    if (!row.joiningDate) throw new Error(`Joiner #${i + 1}: Joining Date is required`);
    if (!row.department) throw new Error(`Joiner #${i + 1}: Department is required`);
    if (!row.company) throw new Error(`Joiner #${i + 1}: Company is required`);
    if (!row.reportingHead && !row.reportingHeadEmail && !row.reportingHeadUserId) {
      throw new Error(`Joiner #${i + 1}: Reporting Head is required`);
    }
    if (!row.deviceType) throw new Error(`Joiner #${i + 1}: Laptop / Desktop is required`);
  }
  return list;
}

/** First joiner's reporting head — used as L1 Manager after RFQ for New Joiners. */
export function resolveReportingHeadFromJoiners(joiners) {
  const list = parseJoinerDetails(joiners);
  for (const row of list) {
    const email = String(row.reportingHeadEmail || row.reportingHead || '').trim();
    const name = String(row.reportingHeadName || '').trim();
    const userId = Number(row.reportingHeadUserId || 0) || null;
    if (userId || email.includes('@') || email) {
      return {
        userId,
        email: email.includes('@') ? email : '',
        name: name || (email.includes('@') ? email.split('@')[0] : email) || 'Reporting Head',
        label: email.includes('@') ? email : name || email,
      };
    }
  }
  return null;
}

function joinerToLaptopLineItem(row, index) {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim() || `Joiner ${index + 1}`;
  const device = row.deviceType || 'Laptop';
  const requesterNote = row.linkedRequesterId
    ? ` · linked requester #${row.linkedRequesterId}`
    : '';
  const remarksNote = row.remarks ? ` · ${row.remarks}` : '';
  return {
    category: 'IT Hardware',
    itemName: `${device} - ${name}`,
    description: `New joiner ${device} for ${name}${row.designation ? ` (${row.designation})` : ''}${
      row.location ? ` · ${row.location}` : ''
    }${row.company ? ` · ${row.company}` : ''}${requesterNote}${remarksNote}`,
    quantity: 1,
    unit: 'Nos',
    unitCost: 0,
    gstPercent: 18,
  };
}

/** Build PR line items from joiner roster when HR does not enter catalogue lines. */
export function lineItemsFromJoiners(joiners, existingLineItems = []) {
  if (Array.isArray(existingLineItems) && existingLineItems.length) return existingLineItems;
  const list = parseJoinerDetails(joiners);
  return list.map((row, index) => joinerToLaptopLineItem(row, index));
}

/**
 * RFQ Entry: 1 laptop line item per joiner marked new_purchase.
 * from_inventory joiners are excluded (no purchase task).
 * Unset status is treated as new_purchase so HR roster count → laptop tasks.
 */
export function lineItemsFromNewPurchaseJoiners(joiners) {
  const list = parseJoinerDetails(joiners);
  const buy = list.filter((row) => {
    const status = String(row.inventoryStatus || '').trim().toLowerCase();
    if (status === 'from_inventory') return false;
    return status === 'new_purchase' || !status;
  });
  return buy.map((row, index) => joinerToLaptopLineItem(row, index));
}

export async function resolveNewJoinersRfqAssignee(departmentId = null) {
  // ensureApproverUser({ email, name }, role, departmentId) — role is 2nd arg
  const userId = await ensureApproverUser(
    { email: NEW_JOINERS_RFQ_EMAIL, name: NEW_JOINERS_RFQ_NAME },
    'Requester',
    departmentId || null
  );
  return {
    userId,
    email: NEW_JOINERS_RFQ_EMAIL,
    name: NEW_JOINERS_RFQ_NAME,
  };
}

export async function createMugeshApprovalTaskForNewJoiners(conn, prId, departmentId) {
  const mugesh = await resolveSassMugeshAssignment(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'PR_APPROVAL', 'CFO', ?, 'pending', ?)`,
    [prId, mugesh?.userId || null, dueDate.toISOString().split('T')[0]]
  );
  const resolved = mugesh || {
    userId: null,
    email: SASS_MUGESH_EMAIL,
    name: SASS_MUGESH_NAME,
  };
  // Alias hod* fields so submit mail helpers (queuePrSubmitNotifications) can reuse them
  return {
    ...resolved,
    hodUserId: resolved.userId || null,
    hodEmail: resolved.email || SASS_MUGESH_EMAIL,
    hodName: resolved.name || SASS_MUGESH_NAME,
  };
}

export async function createNewJoinersRfqEntryTask(conn, prId, departmentId) {
  const assignee = await resolveNewJoinersRfqAssignee(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);
  await conn.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND status = 'pending' AND task_type = 'RFQ_ENTRY'`,
    [prId]
  );
  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
    [prId, assignee.userId, dueDate.toISOString().split('T')[0]]
  );
  return assignee;
}

export async function saveJoinerDetails(connOrPool, prId, joiners) {
  const db = connOrPool || pool;
  const list = parseJoinerDetails(joiners);
  try {
    await db.query(`UPDATE purchase_requests SET joiner_details_json = ? WHERE id = ?`, [
      JSON.stringify(list),
      prId,
    ]);
  } catch (err) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  return list;
}

export function applyInventoryRemarksToJoiners(joiners, remarksByIndex = {}) {
  return parseJoinerDetails(joiners).map((row, index) => {
    const patch = remarksByIndex[index] || remarksByIndex[String(index)] || {};
    return {
      ...row,
      inventoryStatus: String(patch.inventoryStatus || row.inventoryStatus || '').trim(),
      remarks: String(patch.remarks || row.remarks || '').trim(),
      linkedRequesterId:
        Number(patch.linkedRequesterId || row.linkedRequesterId || 0) || null,
    };
  });
}
