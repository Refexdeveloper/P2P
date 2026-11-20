/**
 * New Joiners Laptop Purchase workflow
 * HR Create PR (joiner roster) → Mugesh approval → Reginold RFQ Entry
 * → vendor rounds → Mugesh L1 → Srivaths L2 → SCM Final RFQ → SCM PO
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

/** Normalize device labels so line items consolidate correctly. */
export function normalizeJoinerDeviceType(raw) {
  const device = String(raw || 'Laptop').trim() || 'Laptop';
  if (/desk\s*top|desktop/i.test(device)) return 'Desktop';
  if (/smart\s*phone|smartphone|mobile\s*phone|\btab\b|tablet/i.test(device)) {
    return 'Smartphone / Tab';
  }
  if (/laptop/i.test(device)) return 'Laptop';
  return device;
}

/** Multi-select devices per joiner — Laptop + Desktop → two RFQ line contributions. */
export function parseJoinerDeviceTypes(raw = {}) {
  const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : { deviceType: raw };
  let list = [];
  if (Array.isArray(row.deviceTypes) && row.deviceTypes.length) {
    list = row.deviceTypes;
  } else if (Array.isArray(row.deviceType)) {
    list = row.deviceType;
  } else {
    const single = row.deviceType || row.laptop_desktop || row.laptopDesktop || '';
    if (typeof single === 'string' && single.includes(',')) {
      list = single.split(/[,|;]+/);
    } else if (single) {
      list = [single];
    }
  }
  const normalized = [
    ...new Set(
      list
        .map((d) => normalizeJoinerDeviceType(d))
        .filter((d) => d && String(d).trim())
    ),
  ];
  return normalized.length ? normalized : ['Laptop'];
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
    address: String(raw.address || raw.fullAddress || raw.full_address || '').trim(),
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
    deviceTypes: parseJoinerDeviceTypes(raw),
    // Keep singular for older UI / displays — first selected device
    deviceType: parseJoinerDeviceTypes(raw)[0] || 'Laptop',
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
  // HR New Joiners: no per-field mandatory checks (Company / Reporting Head / etc. optional).
  // Only require at least one roster row so line items can be derived.
  const list = parseJoinerDetails(joiners, creator);
  if (!list.length) {
    throw new Error('Add at least one new joiner for New Joiners Laptop Purchase');
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

/** One catalogue line per device type — multi-select on a joiner adds one qty per device. */
function deviceLinesFromJoiners(joiners) {
  const counts = new Map();
  for (const row of joiners) {
    for (const key of parseJoinerDeviceTypes(row)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([device, quantity]) => ({
    category: 'IT Hardware',
    itemName: device,
    description: device,
    quantity,
    unit: 'Nos',
    unitCost: 0,
    gstPercent: 18,
  }));
}

/** Build PR line items from joiner roster — always one line per device type (Laptop × N). */
export function lineItemsFromJoiners(joiners, _existingLineItems = []) {
  return deviceLinesFromJoiners(parseJoinerDetails(joiners));
}

function newPurchaseJoiners(joiners) {
  return parseJoinerDetails(joiners).filter((row) => {
    const status = String(row.inventoryStatus || '').trim().toLowerCase();
    if (status === 'from_inventory') return false;
    return status === 'new_purchase' || !status;
  });
}

/** Distinct linked requester ids on new-purchase joiners (for RFQ Entry task split). */
export function linkedRequesterIdsFromJoiners(joiners) {
  const ids = new Set();
  for (const row of newPurchaseJoiners(joiners)) {
    const id = Number(row.linkedRequesterId || 0);
    if (id > 0) ids.add(id);
  }
  return [...ids];
}

/**
 * RFQ Entry line items from new-purchase joiners.
 * Always one line per device type (Laptop × qty) — RFQ Entry is Reginold-only.
 */
export function lineItemsFromNewPurchaseJoiners(joiners, _requesterLabelById = {}) {
  const buy = newPurchaseJoiners(joiners);
  if (!buy.length) return [];
  return deviceLinesFromJoiners(buy);
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

/**
 * Heal PRs that look like New Joiners Laptop but were routed to L1/HOD by mistake.
 * Sets purchase_type, title, Mugesh (CFO) task, and PR-NJL number when still on draft-style entity PR#.
 */
export async function healMisroutedNewJoinersLaptopPrs() {
  const { PR_STATUS, STAGE } = await import('../utils/constants.js');
  const [rows] = await pool.query(
    `SELECT pr.id, pr.pr_number, pr.title, pr.status, pr.purchase_type, pr.department_id,
            pr.entity_id, pr.joiner_details_json, u.role AS requester_role
     FROM purchase_requests pr
     JOIN users u ON u.id = pr.requester_id
     WHERE pr.status = ?
       AND (
         pr.purchase_type = 'new_joiners_laptop'
         OR u.role = 'HR'
         OR pr.title LIKE 'New Joiners Laptop%'
         OR (pr.joiner_details_json IS NOT NULL AND pr.joiner_details_json <> '' AND pr.joiner_details_json <> '[]')
       )`,
    [PR_STATUS.PENDING_HOD_APPROVAL]
  );
  let healed = 0;
  for (const row of rows) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const joiners = parseJoinerDetails(row.joiner_details_json);
      const joinerCount = joiners.filter((j) => j.firstName || j.lastName).length || joiners.length || 1;
      await conn.query(
        `UPDATE purchase_requests
         SET purchase_type = 'new_joiners_laptop',
             vendor_selection = 'own',
             pr_flow = 'standard',
             title = ?,
             status = ?,
             current_stage = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          `New Joiners Laptop Purchase (${joinerCount})`,
          PR_STATUS.PENDING_CFO_APPROVAL,
          STAGE.CFO_REVIEW,
          row.id,
        ]
      );
      await conn.query(
        `UPDATE workflow_tasks SET status = 'cancelled', completed_at = NOW()
         WHERE pr_id = ? AND status = 'pending' AND task_type = 'PR_APPROVAL'`,
        [row.id]
      );
      await createMugeshApprovalTaskForNewJoiners(conn, row.id, row.department_id);
      // Renumber only placeholder-style / non-NJL numbers still pending first approval
      if (row.pr_number && !String(row.pr_number).includes('NJL') && row.entity_id) {
        try {
          const { nextDocumentNumber } = await import('./documentNumberService.js');
          const next = await nextDocumentNumber('PR', row.entity_id, conn, {
            purchaseType: 'new_joiners_laptop',
          });
          await conn.query(`UPDATE purchase_requests SET pr_number = ? WHERE id = ?`, [next, row.id]);
        } catch (err) {
          console.warn(`New Joiners PR number heal skipped for ${row.id}:`, err.message);
        }
      }
      await conn.commit();
      healed += 1;
    } catch (err) {
      await conn.rollback();
      console.warn(`healMisroutedNewJoinersLaptopPrs failed for ${row.id}:`, err.message);
    } finally {
      conn.release();
    }
  }
  return { scanned: rows.length, healed };
}

/**
 * Replace legacy per-joiner PR lines ("New joiner Laptop for X") with
 * consolidated device lines (Laptop × qty) from joiner inventory status.
 */
export async function healNewJoinersLaptopLineItems() {
  const [rows] = await pool.query(
    `SELECT id, joiner_details_json, purchase_type, title
     FROM purchase_requests
     WHERE purchase_type = 'new_joiners_laptop'
        OR title LIKE 'New Joiners Laptop%'
        OR (joiner_details_json IS NOT NULL AND joiner_details_json <> '' AND joiner_details_json <> '[]')`
  );
  let healed = 0;
  for (const row of rows) {
    const joiners = parseJoinerDetails(row.joiner_details_json);
    if (!joiners.length) continue;
    // Prefer new-purchase filter when any inventory status is set; else all joiners
    const hasStatus = joiners.some((j) => String(j.inventoryStatus || '').trim());
    const lines = hasStatus
      ? lineItemsFromNewPurchaseJoiners(joiners)
      : deviceLinesFromJoiners(joiners);
    const [existing] = await pool.query(
      'SELECT id, item_name, description, quantity FROM pr_line_items WHERE pr_id = ? ORDER BY id',
      [row.id]
    );
    const same =
      existing.length === lines.length &&
      lines.every((line, i) => {
        const cur = existing[i];
        return (
          String(cur?.item_name || cur?.description || '').trim() === String(line.itemName) &&
          Number(cur?.quantity) === Number(line.quantity)
        );
      });
    if (same) continue;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM pr_line_items WHERE pr_id = ?', [row.id]);
      for (const item of lines) {
        const qty = Number(item.quantity) || 0;
        const cost = Number(item.unitCost) || 0;
        const gstPct = Number(item.gstPercent) || 18;
        const total = Math.round(qty * cost * (1 + gstPct / 100) * 100) / 100;
        await conn.query(
          `INSERT INTO pr_line_items (pr_id, category, item_name, description, quantity, unit, unit_cost, gst_percentage, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            item.category || 'IT Hardware',
            item.itemName,
            item.description,
            qty,
            item.unit || 'Nos',
            cost,
            gstPct,
            total,
          ]
        );
      }
      await conn.commit();
      healed += 1;
    } catch (err) {
      await conn.rollback();
      console.warn(`healNewJoinersLaptopLineItems failed for ${row.id}:`, err.message);
    } finally {
      conn.release();
    }
  }
  return { scanned: rows.length, healed };
}

/**
 * Create RFQ Entry after Mugesh approve — always Reginold only (never HR / linked requesters).
 */
export async function createNewJoinersRfqEntryTask(conn, prId, departmentId, _joiners = null) {
  const assignee = await resolveNewJoinersRfqAssignee(departmentId);
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 5);
  const due = dueDate.toISOString().split('T')[0];

  await conn.query(
    `UPDATE workflow_tasks SET status = 'completed', completed_at = NOW()
     WHERE pr_id = ? AND status = 'pending' AND task_type = 'RFQ_ENTRY'`,
    [prId]
  );

  await conn.query(
    `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
     VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
    [prId, assignee.userId, due]
  );

  return {
    ...assignee,
    assignees: [assignee],
  };
}

/**
 * Keep New Joiners RFQ Entry on Reginold only — cancel any HR/linked-requester RFQ tasks.
 */
export async function syncNewJoinersRfqEntryTasks(connOrPool, prId, departmentId, _joiners) {
  const db = connOrPool || pool;
  const reginold = await resolveNewJoinersRfqAssignee(departmentId);
  const reginoldId = Number(reginold?.userId || 0) || null;

  // Cancel pending RFQ_ENTRY not assigned to Reginold (e.g. wrongly given to HR)
  if (reginoldId) {
    await db.query(
      `UPDATE workflow_tasks SET status = 'cancelled', completed_at = NOW()
       WHERE pr_id = ?
         AND task_type = 'RFQ_ENTRY'
         AND assigned_role = 'Requester'
         AND status IN ('pending', 'in_progress')
         AND (assigned_user_id IS NULL OR assigned_user_id <> ?)`,
      [prId, reginoldId]
    );

    const [have] = await db.query(
      `SELECT id FROM workflow_tasks
       WHERE pr_id = ?
         AND task_type = 'RFQ_ENTRY'
         AND assigned_role = 'Requester'
         AND assigned_user_id = ?
         AND status IN ('pending', 'in_progress')
       LIMIT 1`,
      [prId, reginoldId]
    );
    if (!have.length) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5);
      await db.query(
        `INSERT INTO workflow_tasks (pr_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, 'RFQ_ENTRY', 'Requester', ?, 'pending', ?)`,
        [prId, reginoldId, dueDate.toISOString().split('T')[0]]
      );
      return { created: 1, assignees: [reginold] };
    }
  }

  return { created: 0, assignees: [] };
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
