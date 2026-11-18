import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import {
  getPreferredPoApproverEmail,
  getPreferredScmManagerEmail,
  resolvePoSignAssignee,
  insertScmManagerPoApprovalTask,
} from '../utils/scmAssignee.js';

/** RMC PO release categories (company-wide). */
export const PO_RELEASE_CATEGORIES = [
  {
    code: 'RAW_MATERIALS',
    label: 'Raw Materials',
    hint: 'Raw material / consumable supply POs',
  },
  {
    code: 'SERVICE_TM_PUMP_CONVERSION',
    label: 'Service Orders — TMs, Pumps & Conversion',
    hint: 'Service / WO for Transit Mixers, Pumps, Conversion',
  },
  {
    code: 'SERVICE_OTHER',
    label: 'All Service POs other than TMs and Pumps',
    hint: 'Other service / work orders',
  },
  {
    code: 'CAPEX',
    label: 'CAPEX POs',
    hint: 'Capital expenditure POs',
  },
];

const LAKH = 100000;

/** Seed rows from RefexOne P2P approval matrix.xlsx (Temporary structure). Amounts in INR. */
const PO_VALUE_MATRIX_SEED = [
  // Raw Materials
  {
    categoryCode: 'RAW_MATERIALS',
    levelNo: 1,
    amountMin: 0,
    amountMax: 20 * LAKH,
    emails: ['mounesh.r@refex.co.in', 'tarkeshwar.singh@refex.co.in'],
  },
  {
    categoryCode: 'RAW_MATERIALS',
    levelNo: 2,
    amountMin: 0,
    amountMax: 40 * LAKH,
    emails: ['lalitha.u@refex.co.in'],
  },
  {
    categoryCode: 'RAW_MATERIALS',
    levelNo: 3,
    amountMin: 0,
    amountMax: null,
    emails: ['anil.kulkarni@refex.co.in'],
  },
  // Service TM / Pump / Conversion
  {
    categoryCode: 'SERVICE_TM_PUMP_CONVERSION',
    levelNo: 1,
    amountMin: 0,
    amountMax: 10 * LAKH,
    emails: ['tarkeshwar.singh@refex.co.in'],
  },
  {
    categoryCode: 'SERVICE_TM_PUMP_CONVERSION',
    levelNo: 2,
    amountMin: 0,
    amountMax: 20 * LAKH,
    emails: ['tarkeshwar.singh@refex.co.in'],
  },
  {
    categoryCode: 'SERVICE_TM_PUMP_CONVERSION',
    levelNo: 3,
    amountMin: 0,
    amountMax: null,
    emails: ['tarkeshwar.singh@refex.co.in', 'anil.kulkarni@refex.co.in'],
  },
  // Other services
  {
    categoryCode: 'SERVICE_OTHER',
    levelNo: 1,
    amountMin: 0,
    amountMax: 5 * LAKH,
    emails: ['tarkeshwar.singh@refex.co.in'],
  },
  {
    categoryCode: 'SERVICE_OTHER',
    levelNo: 2,
    amountMin: 0,
    amountMax: 10 * LAKH,
    emails: ['tarkeshwar.singh@refex.co.in'],
  },
  {
    categoryCode: 'SERVICE_OTHER',
    levelNo: 3,
    amountMin: 0,
    amountMax: null,
    emails: ['tarkeshwar.singh@refex.co.in', 'lalitha.u@refex.co.in'],
  },
  // Capex — 2 levels only
  {
    categoryCode: 'CAPEX',
    levelNo: 1,
    amountMin: 0,
    amountMax: 5 * LAKH,
    emails: ['lalitha.u@refex.co.in'],
  },
  {
    categoryCode: 'CAPEX',
    levelNo: 2,
    amountMin: 0,
    amountMax: null,
    emails: ['anil.kulkarni@refex.co.in'],
  },
];

const MATRIX_USERS = [
  {
    email: 'lalitha.u@refex.co.in',
    name: 'Lalitha U',
    role: 'CFO',
  },
  {
    email: 'anil.kulkarni@refex.co.in',
    name: 'Anil Kulkarni',
    role: 'Business Head',
  },
];

export function normalizePoReleaseCategory(value, requestType = '') {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (PO_RELEASE_CATEGORIES.some((c) => c.code === raw)) return raw;
  const rt = String(requestType || '').trim().toLowerCase();
  if (rt === 'capex') return 'CAPEX';
  return '';
}

export function poAmountExGst(poRow = {}) {
  const sub = Number(poRow.subtotal ?? poRow.subTotal);
  if (Number.isFinite(sub) && sub > 0) return sub;
  const grand = Number(poRow.grand_total ?? poRow.grandTotal) || 0;
  const tax = Number(poRow.tax_amount ?? poRow.taxAmount) || 0;
  const net = grand - tax;
  return net > 0 ? net : grand;
}

/**
 * Sequential value bands (Excel interpretation B):
 * - Find the highest level whose amountMax is null OR amount >= that level's band start.
 * - Required levels = 1..highestNeeded.
 *
 * Band mapping from Excel "Value upto X" on level N:
 * - Level N applies when amount is within that level's max (or above previous max).
 * For sequential: if amount is 45L Raw → need L1+L2+L3 because 45 > 40.
 */
export function resolveRequiredValueLevels(categoryCode, amountExGst, matrixRows) {
  const amount = Number(amountExGst) || 0;
  const rows = (matrixRows || [])
    .filter((r) => r.category_code === categoryCode && Number(r.is_active) !== 0)
    .sort((a, b) => Number(a.level_no) - Number(b.level_no));

  if (!rows.length || amount <= 0) return [];

  // Excel bands are sequential: amount falls in (prevMax, max] → need levels 1..that level.
  // Open max (null) = above previous max.
  let coveringLevel = 0;
  for (const row of rows) {
    const level = Number(row.level_no);
    const max = row.amount_max == null ? Number.POSITIVE_INFINITY : Number(row.amount_max);
    const prev = rows.filter((r) => Number(r.level_no) < level);
    const prevMax = prev.length
      ? Math.max(
          ...prev.map((r) => (r.amount_max == null ? Number.NEGATIVE_INFINITY : Number(r.amount_max)))
        )
      : 0;
    if (amount > prevMax && amount <= max) {
      coveringLevel = level;
      break;
    }
  }

  if (!coveringLevel && amount > 0) {
    coveringLevel = Number(rows[rows.length - 1].level_no);
  }

  return rows.filter((r) => Number(r.level_no) <= coveringLevel);
}

function parseEmails(value) {
  if (Array.isArray(value)) {
    return value.map((e) => String(e || '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parseEmails(parsed);
    } catch {
      /* fall through */
    }
    return value
      .split(/[,;/|]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

async function ensureMatrixUsers(conn = pool) {
  const hash = await bcrypt.hash('Welcome@2026', 10);
  for (const u of MATRIX_USERS) {
    const [rows] = await conn.query(`SELECT id, role FROM users WHERE LOWER(email) = ? LIMIT 1`, [
      u.email,
    ]);
    if (rows[0]) {
      if (rows[0].role !== u.role && u.role === 'Business Head') {
        await conn.query(`UPDATE users SET role = ?, is_active = 1 WHERE id = ?`, [
          u.role,
          rows[0].id,
        ]);
      }
      continue;
    }
    await conn.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [u.name, u.email, hash, u.role]
    );
  }
}

async function resolveUsersByEmails(emails, conn = pool) {
  const list = [...new Set((emails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!list.length) return [];
  const placeholders = list.map(() => '?').join(', ');
  const [rows] = await conn.query(
    `SELECT id, email, name, role FROM users
     WHERE LOWER(email) IN (${placeholders}) AND is_active = 1
     ORDER BY FIELD(LOWER(email), ${placeholders})`,
    [...list, ...list]
  );
  return rows || [];
}

export async function seedPoValueApprovalMatrix(conn = pool) {
  await ensureMatrixUsers(conn);

  const [existing] = await conn.query(
    `SELECT COUNT(*) AS c FROM po_value_approval_matrix WHERE is_active = 1`
  );
  if (Number(existing[0]?.c || 0) > 0) {
    return { seeded: false, count: Number(existing[0].c) };
  }

  for (const row of PO_VALUE_MATRIX_SEED) {
    const users = await resolveUsersByEmails(row.emails, conn);
    await conn.query(
      `INSERT INTO po_value_approval_matrix
         (category_code, level_no, amount_min, amount_max, approver_emails, approver_user_ids, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [
        row.categoryCode,
        row.levelNo,
        row.amountMin,
        row.amountMax,
        JSON.stringify(row.emails),
        JSON.stringify(users.map((u) => u.id)),
      ]
    );
  }
  return { seeded: true, count: PO_VALUE_MATRIX_SEED.length };
}

export async function listPoValueMatrix() {
  const [rows] = await pool.query(
    `SELECT * FROM po_value_approval_matrix ORDER BY category_code, level_no, id`
  );
  return (rows || []).map(mapPoMatrixRow);
}

export async function listPrApprovalMatrix() {
  const [rows] = await pool.query(
    `SELECT * FROM pr_approval_matrix ORDER BY priority ASC, id ASC`
  );
  return (rows || []).map(mapPrMatrixRow);
}

function mapPoMatrixRow(row) {
  return {
    id: row.id,
    categoryCode: row.category_code,
    levelNo: Number(row.level_no),
    amountMin: row.amount_min == null ? 0 : Number(row.amount_min),
    amountMax: row.amount_max == null ? null : Number(row.amount_max),
    approverEmails: parseEmails(row.approver_emails),
    approverUserIds: (() => {
      try {
        const v =
          typeof row.approver_user_ids === 'string'
            ? JSON.parse(row.approver_user_ids)
            : row.approver_user_ids;
        return Array.isArray(v) ? v.map(Number).filter(Boolean) : [];
      } catch {
        return [];
      }
    })(),
    isActive: Number(row.is_active) === 1,
    updatedAt: row.updated_at,
  };
}

function mapPrMatrixRow(row) {
  let stages = row.stages_json;
  try {
    stages = typeof stages === 'string' ? JSON.parse(stages) : stages;
  } catch {
    stages = {};
  }
  return {
    id: row.id,
    name: row.name,
    priority: Number(row.priority) || 100,
    plantName: row.plant_name || '',
    departmentId: row.department_id || null,
    categoryCode: row.category_code || '',
    requesterEmail: row.requester_email || '',
    approvalModeDefault: row.approval_mode_default || 'matrix',
    stages: stages || {},
    isActive: Number(row.is_active) === 1,
    updatedAt: row.updated_at,
  };
}

export async function upsertPoValueMatrixRow(body = {}) {
  const categoryCode = normalizePoReleaseCategory(body.categoryCode || body.category_code);
  if (!categoryCode) throw new Error('Valid categoryCode is required');
  const levelNo = Number(body.levelNo || body.level_no);
  if (![1, 2, 3].includes(levelNo)) throw new Error('levelNo must be 1, 2, or 3');
  const amountMin = Number(body.amountMin ?? body.amount_min ?? 0) || 0;
  const amountMaxRaw = body.amountMax ?? body.amount_max;
  const amountMax =
    amountMaxRaw === null || amountMaxRaw === undefined || amountMaxRaw === ''
      ? null
      : Number(amountMaxRaw);
  const emails = parseEmails(body.approverEmails || body.approver_emails || body.emails);
  if (!emails.length) throw new Error('At least one approver email is required');
  const users = await resolveUsersByEmails(emails);
  const isActive = body.isActive === false || body.is_active === 0 ? 0 : 1;
  const id = Number(body.id || 0);

  if (id) {
    await pool.query(
      `UPDATE po_value_approval_matrix
       SET category_code = ?, level_no = ?, amount_min = ?, amount_max = ?,
           approver_emails = ?, approver_user_ids = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        categoryCode,
        levelNo,
        amountMin,
        amountMax,
        JSON.stringify(emails),
        JSON.stringify(users.map((u) => u.id)),
        isActive,
        id,
      ]
    );
    const [rows] = await pool.query(`SELECT * FROM po_value_approval_matrix WHERE id = ?`, [id]);
    return mapPoMatrixRow(rows[0]);
  }

  const [result] = await pool.query(
    `INSERT INTO po_value_approval_matrix
       (category_code, level_no, amount_min, amount_max, approver_emails, approver_user_ids, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      categoryCode,
      levelNo,
      amountMin,
      amountMax,
      JSON.stringify(emails),
      JSON.stringify(users.map((u) => u.id)),
      isActive,
    ]
  );
  const [rows] = await pool.query(`SELECT * FROM po_value_approval_matrix WHERE id = ?`, [
    result.insertId,
  ]);
  return mapPoMatrixRow(rows[0]);
}

export async function deletePoValueMatrixRow(id) {
  await pool.query(`UPDATE po_value_approval_matrix SET is_active = 0, updated_at = NOW() WHERE id = ?`, [
    Number(id),
  ]);
}

/**
 * Skip value levels whose approvers are only the designated SCM PO signer
 * (Mounesh/Tarkesh) — they will sign later; avoid duplicate approval.
 */
export async function filterLevelsSkippingScmSigner(levels, poCreatorId, conn = pool) {
  const signer = await resolvePoSignAssignee(poCreatorId, conn);
  const signerEmail = String(signer?.email || '').trim().toLowerCase();
  const scmEmails = new Set(
    [signerEmail, getPreferredScmManagerEmail(), getPreferredPoApproverEmail()]
      .map((e) => String(e || '').trim().toLowerCase())
      .filter(Boolean)
  );

  return (levels || []).filter((level) => {
    const emails = parseEmails(level.approver_emails || level.approverEmails);
    if (!emails.length) return true;
    // Keep level if ANY approver is outside SCM signer set (e.g. Tarkesh+Anil → keep for Anil/OR)
    return emails.some((e) => !scmEmails.has(e));
  }).map((level) => {
    const emails = parseEmails(level.approver_emails || level.approverEmails);
    const keptEmails = emails.filter((e) => !scmEmails.has(e));
    // If some were SCM-only and some not, keep only non-SCM for this value step
    if (keptEmails.length && keptEmails.length < emails.length) {
      return {
        ...level,
        approver_emails: JSON.stringify(keptEmails),
        approverEmails: keptEmails,
      };
    }
    return level;
  });
}

export async function loadActivePoValueMatrix(conn = pool) {
  const [rows] = await conn.query(
    `SELECT * FROM po_value_approval_matrix WHERE is_active = 1 ORDER BY category_code, level_no`
  );
  return rows || [];
}

/**
 * After Buyer sends PO: value approvals first (if any), else SCM sign.
 * Returns { status, valueLevels, skippedToSign }.
 */
export async function startPoApprovalRouting(conn, {
  poId,
  prId,
  createdByUserId,
  categoryCode,
  amountExGst,
}) {
  const category = normalizePoReleaseCategory(categoryCode);
  const amount = Number(amountExGst) || 0;
  const matrix = await loadActivePoValueMatrix(conn);
  let levels = category
    ? resolveRequiredValueLevels(category, amount, matrix)
    : [];
  levels = await filterLevelsSkippingScmSigner(levels, createdByUserId, conn);

  await conn.query(
    `UPDATE purchase_orders
     SET po_release_category = ?,
         matrix_amount_ex_gst = ?,
         value_approval_level = 0,
         value_approval_status = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      category || null,
      amount,
      levels.length ? 'pending' : 'skipped',
      poId,
    ]
  );

  if (!levels.length) {
    await conn.query(
      `UPDATE purchase_orders
       SET status = 'pending_approval',
           value_approval_status = 'skipped',
           updated_at = NOW()
       WHERE id = ?`,
      [poId]
    );
    const due = new Date();
    due.setDate(due.getDate() + 2);
    const dueStr = due.toISOString().split('T')[0];
    if (prId) {
      await insertScmManagerPoApprovalTask(conn, prId, dueStr, createdByUserId);
      try {
        const [taskRows] = await conn.query(
          `SELECT id FROM workflow_tasks
           WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND status = 'pending'
             AND (po_id IS NULL OR po_id = 0)
           ORDER BY id DESC LIMIT 1`,
          [prId]
        );
        if (taskRows[0]?.id) {
          await conn.query(`UPDATE workflow_tasks SET po_id = ? WHERE id = ?`, [
            poId,
            taskRows[0].id,
          ]);
        }
      } catch {
        /* ignore */
      }
    } else {
      // Manual PO — create SCM sign task keyed by po_id only
      const signer = await resolvePoSignAssignee(createdByUserId, conn);
      await conn.query(
        `INSERT INTO workflow_tasks
           (pr_id, po_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (NULL, ?, 'PO_APPROVAL', 'SCM Manager', ?, 'pending', ?)`,
        [poId, signer?.id || null, dueStr]
      );
    }
    return { status: 'pending_approval', valueLevels: [], skippedToSign: true };
  }

  const first = levels[0];
  const emails = parseEmails(first.approver_emails || first.approverEmails);
  const users = await resolveUsersByEmails(emails, conn);
  const due = new Date();
  due.setDate(due.getDate() + 2);
  const dueStr = due.toISOString().split('T')[0];

  await conn.query(
    `UPDATE purchase_orders
     SET status = 'pending_value_approval',
         value_approval_level = ?,
         value_approval_status = 'pending',
         updated_at = NOW()
     WHERE id = ?`,
    [Number(first.level_no || first.levelNo), poId]
  );

  {
    const assignees = users.length ? users : [{ id: null, role: 'CFO' }];
    for (const u of assignees) {
      await conn.query(
        `INSERT INTO workflow_tasks
           (pr_id, po_id, task_type, assigned_role, assigned_user_id, status, due_date)
         VALUES (?, ?, 'PO_VALUE_APPROVAL', ?, ?, 'pending', ?)`,
        [prId || null, poId, u.role || 'CFO', u.id || null, dueStr]
      );
    }
    if (prId) {
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, ?, NULL, 'SUBMITTED', ?)`,
        [
          prId,
          `PO_VALUE_L${Number(first.level_no || first.levelNo)}`,
          `PO #${poId} sent for value approval (${category}, ₹${amount.toFixed(2)} ex-GST)`,
        ]
      );
    }
  }

  return {
    status: 'pending_value_approval',
    valueLevels: levels.map((l) => Number(l.level_no || l.levelNo)),
    skippedToSign: false,
    currentLevel: Number(first.level_no || first.levelNo),
    assignees: users,
  };
}

/**
 * Value approver (CFO / Business Head) — approve or reject. No PDF signature.
 */
export async function actOnPoValueApproval(user, poId, { action, remarks } = {}) {
  const decision = String(action || '').toLowerCase();
  if (!['approve', 'reject'].includes(decision)) {
    throw new Error('action must be approve or reject');
  }

  const [rows] = await pool.query(`SELECT * FROM purchase_orders WHERE id = ?`, [poId]);
  if (!rows[0]) throw new Error('PO not found');
  const po = rows[0];
  if (po.status !== 'pending_value_approval') {
    throw new Error('PO is not pending value approval');
  }

  const matrix = await loadActivePoValueMatrix();
  const category = normalizePoReleaseCategory(po.po_release_category);
  const amount = poAmountExGst(po);
  let levels = resolveRequiredValueLevels(category, amount, matrix);
  levels = await filterLevelsSkippingScmSigner(levels, po.created_by);
  const currentLevel = Number(po.value_approval_level) || Number(levels[0]?.level_no) || 1;
  const current = levels.find((l) => Number(l.level_no) === currentLevel) || levels[0];
  const emails = parseEmails(current?.approver_emails || current?.approverEmails);
  const userEmail = String(user.email || '').trim().toLowerCase();
  const allowed =
    user.role === 'Super Admin' ||
    emails.includes(userEmail) ||
    (await resolveUsersByEmails(emails)).some((u) => Number(u.id) === Number(user.id));

  if (!allowed) throw new Error('You are not an assignee for this value approval level');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE workflow_tasks
       SET status = 'completed', completed_at = NOW()
       WHERE po_id = ? AND task_type = 'PO_VALUE_APPROVAL' AND status = 'pending'`,
      [poId]
    );

    if (po.pr_id) {
      await conn.query(
        `INSERT INTO pr_approvals (pr_id, stage, approver_id, action, remarks)
         VALUES (?, ?, ?, ?, ?)`,
        [
          po.pr_id,
          `PO_VALUE_L${currentLevel}`,
          user.id,
          decision === 'approve' ? 'APPROVED' : 'REJECTED',
          remarks?.trim() ||
            (decision === 'approve'
              ? `Value approval L${currentLevel}`
              : `Value approval L${currentLevel} rejected`),
        ]
      );
    }

    if (decision === 'reject') {
      await conn.query(
        `UPDATE purchase_orders
         SET status = 'draft',
             value_approval_status = 'rejected',
             value_approval_level = 0,
             updated_at = NOW()
         WHERE id = ?`,
        [poId]
      );
      await conn.commit();
      return { status: 'draft', message: 'PO returned to buyer draft after value rejection' };
    }

    const remaining = levels.filter((l) => Number(l.level_no) > currentLevel);
    if (remaining.length) {
      const next = remaining[0];
      const nextEmails = parseEmails(next.approver_emails || next.approverEmails);
      const nextUsers = await resolveUsersByEmails(nextEmails, conn);
      const due = new Date();
      due.setDate(due.getDate() + 2);
      const dueStr = due.toISOString().split('T')[0];
      await conn.query(
        `UPDATE purchase_orders
         SET value_approval_level = ?, value_approval_status = 'pending', updated_at = NOW()
         WHERE id = ?`,
        [Number(next.level_no), poId]
      );
      {
        const assignees = nextUsers.length ? nextUsers : [{ id: null, role: 'CFO' }];
        for (const u of assignees) {
          await conn.query(
            `INSERT INTO workflow_tasks
               (pr_id, po_id, task_type, assigned_role, assigned_user_id, status, due_date)
             VALUES (?, ?, 'PO_VALUE_APPROVAL', ?, ?, 'pending', ?)`,
            [po.pr_id || null, poId, u.role || 'CFO', u.id || null, dueStr]
          );
        }
      }
      await conn.commit();
      return {
        status: 'pending_value_approval',
        level: Number(next.level_no),
        message: `Moved to value approval L${next.level_no}`,
      };
    }

    // All value levels done → SCM sign
    await conn.query(
      `UPDATE purchase_orders
       SET status = 'pending_approval',
           value_approval_status = 'completed',
           updated_at = NOW()
       WHERE id = ?`,
      [poId]
    );
    {
      const due = new Date();
      due.setDate(due.getDate() + 2);
      const dueStr = due.toISOString().split('T')[0];
      if (po.pr_id) {
        await insertScmManagerPoApprovalTask(conn, po.pr_id, dueStr, po.created_by);
        try {
          const [taskRows] = await conn.query(
            `SELECT id FROM workflow_tasks
             WHERE pr_id = ? AND task_type = 'PO_APPROVAL' AND status = 'pending'
               AND (po_id IS NULL OR po_id = 0)
             ORDER BY id DESC LIMIT 1`,
            [po.pr_id]
          );
          if (taskRows[0]?.id) {
            await conn.query(`UPDATE workflow_tasks SET po_id = ? WHERE id = ?`, [
              poId,
              taskRows[0].id,
            ]);
          }
        } catch {
          /* ignore */
        }
      } else {
        const signer = await resolvePoSignAssignee(po.created_by, conn);
        await conn.query(
          `INSERT INTO workflow_tasks
             (pr_id, po_id, task_type, assigned_role, assigned_user_id, status, due_date)
           VALUES (NULL, ?, 'PO_APPROVAL', 'SCM Manager', ?, 'pending', ?)`,
          [poId, signer?.id || null, dueStr]
        );
      }
    }
    await conn.commit();
    return { status: 'pending_approval', message: 'Value approvals complete — sent for SCM sign' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Preview routing for Admin / PO UI. */
export async function previewPoValueRouting({ categoryCode, amountExGst, createdByUserId }) {
  const category = normalizePoReleaseCategory(categoryCode);
  const matrix = await loadActivePoValueMatrix();
  let levels = category ? resolveRequiredValueLevels(category, Number(amountExGst) || 0, matrix) : [];
  const beforeSkip = levels.map((l) => ({
    level: Number(l.level_no),
    emails: parseEmails(l.approver_emails),
    amountMax: l.amount_max == null ? null : Number(l.amount_max),
  }));
  levels = await filterLevelsSkippingScmSigner(levels, createdByUserId);
  return {
    category,
    amountExGst: Number(amountExGst) || 0,
    levelsBeforeSkip: beforeSkip,
    levelsAfterSkip: levels.map((l) => ({
      level: Number(l.level_no),
      emails: parseEmails(l.approver_emails || l.approverEmails),
    })),
    goesStraightToScmSign: !levels.length,
  };
}
