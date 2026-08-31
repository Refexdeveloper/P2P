import bcrypt from 'bcryptjs';
import pool from '../config/db.js';
import {
  seedUserPermissionsForRole,
  ROLE_DEFAULT_PERMISSIONS,
  setUserPermissions,
} from './permissionService.js';

const DEFAULT_ROLE = 'Requester';
const PLACEHOLDER_PASSWORD = 'refexone-sync-no-login';
const INSERT_BATCH_SIZE = 100;
const USERS_CACHE_TTL_MS = 30 * 60 * 1000;
let usersCache = { fetchedAt: 0, users: [] };

function isRefexOneTokenExpiredError(status, text = '') {
  return status === 401 && /token expired/i.test(String(text || ''));
}

async function getLocalUserRecord(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;
  const [rows] = await pool.query(
    `SELECT refexone_user_id, email, name, supervisor_email, supervisor_name,
            l2_manager_email, phone
     FROM users WHERE email = ? LIMIT 1`,
    [normalizedEmail]
  );
  return rows[0] || null;
}

function localUserAsRefexShape(row) {
  if (!row) return null;
  return {
    id: row.refexone_user_id,
    user_id: row.refexone_user_id,
    email: row.email,
    name: row.name,
    supervisor_email: row.supervisor_email,
    supervisor_name: row.supervisor_name,
    l2_manager_email: row.l2_manager_email,
    work_mobile: row.phone,
    mobile: row.phone,
    phone: row.phone,
  };
}

function getBaseUrl() {
  return (process.env.REFEXONE_API_URL || 'https://refexone.com/api').replace(/\/$/, '');
}

function isRefexOneLoginEnabled() {
  return process.env.REFEXONE_LOGIN_ENABLED !== 'false';
}

function getApiConfig() {
  const baseUrl = getBaseUrl();
  const token = String( 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYTM2MmY4YWQtNzBkZC00OTYyLWE0Y2EtMTRmNDg4NmYzNDVhIiwiZW1haWwiOiJnb3d0aGFtLnNAcmVmZXguY28uaW4iLCJvcmdfaWQiOiIxNWY2ODhhZC1hZTBhLTQ5NDctYjMyOS03YTIzMTg1OWYyMjYiLCJyb2xlIjoib3JnX2FkbWluIiwiZXhwIjoxNzkwNzUzMDc5LCJpYXQiOjE3ODgxNjEwNzl9.IhR02vBDEILb2eO7Y2iqQqeANEFIsBLDePnajca_5Qs').trim();
  if (!token) {
    throw new Error('REFEXONE_API_TOKEN is not configured in server/.env');
  }
  return { baseUrl, token };
}

function parseRefexOneLoginResponse(body, fallbackEmail) {
  const user = body.user || body.data?.user || body.data || body;
  const refexoneUserId = user.id || user.user_id || body.user_id || null;
  const email = (user.email || body.email || fallbackEmail || '').trim().toLowerCase();
  const name = (user.name || user.full_name || email.split('@')[0] || 'User').trim();

  if (!email) {
    throw new Error('RefexOne login response missing user email');
  }

  return {
    refexoneUserId,
    email,
    name,
    accessToken: body.access_token || body.token || null,
  };
}

export async function authenticateRefexOne(email, password) {
  if (!isRefexOneLoginEnabled()) {
    throw new Error('RefexOne login is disabled');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const response = await fetch(`${getBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: normalizedEmail, password }),
  });

  if (!response.ok) {
    throw new Error('Invalid RefexOne credentials');
  }

  const body = await response.json();
  return parseRefexOneLoginResponse(body, normalizedEmail);
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function fetchRefexOneProfileWithToken(accessToken) {
  const baseUrl = getBaseUrl();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
  };

  const paths = ['/auth/me', '/users/me', '/me', '/auth/session', '/auth/profile'];
  for (const path of paths) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
      if (!response.ok) continue;
      const body = await response.json();
      return parseRefexOneLoginResponse(body, null);
    } catch {
      // try next profile endpoint
    }
  }

  return null;
}

async function resolveProfileFromJwtAndDirectory(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return null;

  const exp = Number(payload.exp || 0);
  if (exp && exp * 1000 < Date.now()) {
    throw new Error('RefexOne session expired. Please sign in again at RefexOne.');
  }

  const email = (payload.email || '').trim().toLowerCase();
  const refexoneUserId = payload.user_id || payload.userId || payload.sub || null;
  if (!email && !refexoneUserId) return null;

  try {
    const users = await fetchRefexOneUsersRaw();
    const match = users.find((u) => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uId = u.id || u.user_id || u.uuid;
      return (email && uEmail === email) || (refexoneUserId && uId === refexoneUserId);
    });

    if (match) {
      const normalized = normalizeRefexOneUser(match);
      if (normalized) {
        return {
          refexoneUserId: normalized.refexoneUserId,
          email: normalized.email,
          name: normalized.name,
          accessToken,
        };
      }
    }
  } catch {
    // directory lookup unavailable — fall back to JWT claims
  }

  if (!email) return null;

  return {
    refexoneUserId,
    email,
    name: (payload.name || payload.full_name || email.split('@')[0] || 'User').trim(),
    accessToken,
  };
}

/**
 * Auto-login when user already has a RefexOne access token (SSO / redirect).
 */
export async function authenticateWithRefexOneToken(accessToken) {
  if (!isRefexOneLoginEnabled()) {
    throw new Error('RefexOne login is disabled');
  }

  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('RefexOne access token is required');
  }

  let profile = await fetchRefexOneProfileWithToken(token);
  if (!profile) {
    profile = await resolveProfileFromJwtAndDirectory(token);
  }

  if (!profile?.email) {
    throw new Error('Could not validate RefexOne session. Please sign in with RefexOne again.');
  }

  return {
    ...profile,
    accessToken: token,
  };
}

async function loadUserRow(userId) {
  const [rows] = await pool.query(
    `SELECT u.*, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.id = ? AND u.is_active = 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function resolveLocalUserFromRefexOne(refexProfile) {
  const email = refexProfile.email.toLowerCase().trim();
  const [rows] = await pool.query(
    `SELECT u.*, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     WHERE u.email = ? OR (u.refexone_user_id IS NOT NULL AND u.refexone_user_id = ?)
     LIMIT 1`,
    [email, refexProfile.refexoneUserId || '']
  );

  if (rows.length) {
    const existing = rows[0];
    if (refexProfile.refexoneUserId && existing.refexone_user_id !== refexProfile.refexoneUserId) {
      await pool.query(
        `UPDATE users SET refexone_user_id = ?, name = ?, email = ? WHERE id = ?`,
        [refexProfile.refexoneUserId, refexProfile.name, email, existing.id]
      );
    } else if (refexProfile.name && refexProfile.name !== existing.name) {
      await pool.query(`UPDATE users SET name = ? WHERE id = ?`, [refexProfile.name, existing.id]);
    }
    return loadUserRow(existing.id);
  }

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active, refexone_user_id)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [refexProfile.name, email, passwordHash, DEFAULT_ROLE, refexProfile.refexoneUserId]
  );

  await seedUserPermissionsForRole(result.insertId, DEFAULT_ROLE);
  return loadUserRow(result.insertId);
}

export function shouldTryRefexOneLogin(userRow, email) {
  if (!isRefexOneLoginEnabled()) return false;
  if (userRow?.refexone_user_id) return true;
  return email.endsWith('@refex.co.in');
}

function extractUserList(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.users)) return body.users;
  if (Array.isArray(body?.results)) return body.results;
  return [];
}

function normalizeRefexOneUser(raw) {
  const refexoneUserId = raw.id || raw.user_id || raw.uuid || null;
  const email = (raw.email || '').trim().toLowerCase();
  const name = (raw.name || raw.full_name || email.split('@')[0] || 'User').trim();
  const isActive = raw.status ? raw.status === 'active' : raw.is_active !== false;
  const supervisorEmail = (raw.supervisor_email || '').trim().toLowerCase() || null;
  const supervisorName = (raw.supervisor_name || '').trim() || null;
  const l2ManagerEmail = (raw.l2_manager_email || '').trim().toLowerCase() || null;
  const phoneRaw =
    raw.work_mobile ||
    raw.mobile ||
    raw.employee_mobile ||
    raw.phone ||
    raw.phone_number ||
    raw.mobile_number ||
    '';
  const phone = String(phoneRaw || '').replace(/\D/g, '') || null;

  if (!refexoneUserId || !email) return null;

  return {
    refexoneUserId,
    email,
    name,
    isActive,
    supervisorEmail,
    supervisorName,
    l2ManagerEmail,
    phone,
  };
}

async function fetchRefexOneUsersRaw(force = false, { strict = false } = {}) {
  const now = Date.now();
  if (!force && usersCache.users.length && now - usersCache.fetchedAt < USERS_CACHE_TTL_MS) {
    return usersCache.users;
  }

  let baseUrl;
  let token;
  try {
    ({ baseUrl, token } = getApiConfig());
  } catch (err) {
    if (strict) throw err;
    console.warn(`RefexOne users API skipped: ${err.message}`);
    return usersCache.users.length ? usersCache.users : [];
  }

  const response = await fetch(`${baseUrl}/users`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (isRefexOneTokenExpiredError(response.status, text)) {
      const hint =
        'RefexOne API token expired — generate a new token in RefexOne and set REFEXONE_API_TOKEN in server/.env, then restart the server.';
      if (usersCache.users.length) {
        console.warn(`${hint} Using cached user directory until token is refreshed.`);
        return usersCache.users;
      }
      if (!strict) {
        console.warn(`${hint} Continuing with local DB manager data only.`);
        return [];
      }
      throw new Error(hint);
    }
    const detail = text || response.statusText;
    throw new Error(`RefexOne API error (${response.status}): ${detail}`);
  }

  const body = await response.json();
  usersCache = {
    fetchedAt: now,
    users: extractUserList(body),
  };
  return usersCache.users;
}

async function findRefexOneUserInDirectory(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;
  try {
    const users = await fetchRefexOneUsersRaw();
    return users.find((u) => (u.email || '').toLowerCase() === normalizedEmail) || null;
  } catch (err) {
    console.warn(`RefexOne directory lookup failed for ${normalizedEmail}:`, err.message);
    return null;
  }
}

export async function getRefexOneUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  const local = localUserAsRefexShape(await getLocalUserRecord(normalizedEmail));
  if (local) return local;
  return findRefexOneUserInDirectory(normalizedEmail);
}

export async function getL1ManagerForEmail(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  const local = await getLocalUserRecord(normalizedEmail);
  const localSupervisor = (local?.supervisor_email || '').trim().toLowerCase();
  if (localSupervisor) {
    return {
      email: localSupervisor,
      name: (local.supervisor_name || localSupervisor.split('@')[0] || 'L1 Manager').trim(),
      employeeCode: null,
    };
  }

  try {
    const refexUser =
      (await findRefexOneUserInDirectory(normalizedEmail)) ||
      localUserAsRefexShape(local);
    if (!refexUser) return null;

    const managerEmail = (refexUser.supervisor_email || '').trim().toLowerCase();
    if (!managerEmail) return null;

    return {
      email: managerEmail,
      name: (refexUser.supervisor_name || managerEmail.split('@')[0] || 'L1 Manager').trim(),
      employeeCode: refexUser.supervisor_employee_code || null,
    };
  } catch (err) {
    console.warn('RefexOne L1 manager lookup failed:', err.message);
    return null;
  }
}

export async function getL2ManagerForEmail(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!normalizedEmail) return null;

  const local = await getLocalUserRecord(normalizedEmail);
  const localL2 = (local?.l2_manager_email || '').trim().toLowerCase();
  if (localL2) {
    return {
      email: localL2,
      name: localL2.split('@')[0] || 'L2 Manager',
      employeeCode: null,
    };
  }

  try {
    const refexUser =
      (await findRefexOneUserInDirectory(normalizedEmail)) ||
      localUserAsRefexShape(local);
    if (refexUser) {
      const managerEmail = (refexUser.l2_manager_email || '').trim().toLowerCase();
      if (managerEmail) {
        return {
          email: managerEmail,
          name: (refexUser.l2_manager_name || managerEmail.split('@')[0] || 'L2 Manager').trim(),
          employeeCode: refexUser.l2_manager_employee_code || null,
        };
      }
    }
  } catch (err) {
    console.warn('RefexOne L2 manager lookup failed:', err.message);
  }

  return null;
}

export async function ensureApproverUser({ email, name }, role, departmentId = null) {
  const normalizedEmail = email.toLowerCase().trim();
  const [rows] = await pool.query(
    `SELECT id, role, department_id FROM users WHERE email = ? LIMIT 1`,
    [normalizedEmail]
  );

  const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role] || [];

  if (rows.length) {
    const existing = rows[0];
    const updates = [];
    const params = [];

    if (existing.role === 'Requester') {
      updates.push('role = ?');
      params.push(role);
    }
    if (departmentId && !existing.department_id) {
      updates.push('department_id = ?');
      params.push(departmentId);
    }
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }

    if (updates.length) {
      params.push(existing.id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (existing.role === 'Requester') {
      await setUserPermissions(existing.id, defaultPerms);
    }

    return existing.id;
  }

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department_id, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [name || normalizedEmail.split('@')[0], normalizedEmail, passwordHash, role, departmentId]
  );

  await setUserPermissions(result.insertId, defaultPerms);
  return result.insertId;
}

export async function ensureHodApproverUser({ email, name }, departmentId = null) {
  return ensureApproverUser({ email, name }, 'HOD Approver', departmentId);
}

export async function fetchRefexOneUsers() {
  const users = await fetchRefexOneUsersRaw(false, { strict: true });
  return users.map(normalizeRefexOneUser).filter(Boolean);
}

export async function syncRefexOneUsers() {
  const remoteUsers = await fetchRefexOneUsersRaw(true, { strict: true }).then((raw) =>
    raw.map(normalizeRefexOneUser).filter(Boolean)
  );
  if (!remoteUsers.length) {
    return { total: 0, created: 0, updated: 0, syncedAt: new Date().toISOString() };
  }

  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);

  const [localRows] = await pool.query(
    `SELECT id, email, refexone_user_id, role FROM users`
  );

  const byRefexId = new Map();
  const byEmail = new Map();
  for (const row of localRows) {
    if (row.refexone_user_id) byRefexId.set(row.refexone_user_id, row);
    if (row.email) byEmail.set(row.email.toLowerCase(), row);
  }

  const toInsert = [];
  const toUpdate = [];
  const newUserIds = [];

  for (const remote of remoteUsers) {
    const existing =
      byRefexId.get(remote.refexoneUserId) ||
      byEmail.get(remote.email);

    if (!existing) {
      toInsert.push(remote);
      continue;
    }

    toUpdate.push({ localId: existing.id, remote });
    byRefexId.set(remote.refexoneUserId, existing);
    byEmail.set(remote.email, existing);
  }

  let created = 0;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const values = batch.flatMap((u) => [
      u.name,
      u.email,
      passwordHash,
      DEFAULT_ROLE,
      u.isActive ? 1 : 0,
      u.refexoneUserId,
      u.supervisorEmail,
      u.supervisorName,
      u.l2ManagerEmail,
      u.phone || null,
    ]);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, refexone_user_id, supervisor_email, supervisor_name, l2_manager_email, phone)
       VALUES ${placeholders}`,
      values
    );

    created += batch.length;

    const refexIds = batch.map((u) => u.refexoneUserId);
    const [insertedRows] = await pool.query(
      `SELECT id, role FROM users WHERE refexone_user_id IN (${refexIds.map(() => '?').join(', ')})`,
      refexIds
    );
    for (const row of insertedRows) {
      newUserIds.push({ id: row.id, role: row.role });
    }
  }

  let updated = 0;
  for (const { localId, remote } of toUpdate) {
    await pool.query(
      `UPDATE users
       SET name = ?, email = ?, is_active = ?, refexone_user_id = ?,
           supervisor_email = ?, supervisor_name = ?, l2_manager_email = ?,
           phone = COALESCE(?, phone)
       WHERE id = ?`,
      [
        remote.name,
        remote.email,
        remote.isActive ? 1 : 0,
        remote.refexoneUserId,
        remote.supervisorEmail,
        remote.supervisorName,
        remote.l2ManagerEmail,
        remote.phone || null,
        localId,
      ]
    );
    updated += 1;
  }

  for (const u of newUserIds) {
    await seedUserPermissionsForRole(u.id, u.role);
  }

  return {
    total: remoteUsers.length,
    created,
    updated,
    syncedAt: new Date().toISOString(),
  };
}
