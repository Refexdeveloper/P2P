import pool from '../config/db.js';
import { isSuperAdmin } from '../services/permissionService.js';

/** Load entity scope for the signed-in user (admin-assigned entity on users.entity_id). */
export async function resolveUserEntityScope(user) {
  if (!user?.id) {
    return { entityId: null, entityName: null, entityCode: null, restricted: false };
  }
  if (isSuperAdmin(user.role)) {
    return { entityId: null, entityName: null, entityCode: null, restricted: false };
  }

  const [rows] = await pool.query(
    `SELECT u.entity_id, e.name AS entity_name, e.code AS entity_code
     FROM users u
     LEFT JOIN entity_masters e ON e.id = u.entity_id
     WHERE u.id = ? AND u.is_active = 1
     LIMIT 1`,
    [user.id]
  );
  const row = rows[0];
  const entityId = row?.entity_id ? Number(row.entity_id) : null;
  if (!entityId) {
    return { entityId: null, entityName: null, entityCode: null, restricted: false };
  }
  return {
    entityId,
    entityName: row.entity_name || '',
    entityCode: row.entity_code || '',
    restricted: true,
  };
}

/** PO queries: match entity on PO or linked PR. */
export function poEntityScopeSql(entityId, { poAlias = 'po', prAlias = 'pr' } = {}) {
  if (!entityId) {
    return { join: '', where: '', params: [] };
  }
  return {
    join: `LEFT JOIN purchase_requests ${prAlias} ON ${prAlias}.id = ${poAlias}.pr_id`,
    where: ` AND COALESCE(${poAlias}.entity_id, ${prAlias}.entity_id) = ?`,
    params: [entityId],
  };
}

/** PR list queries. */
export function prEntityScopeSql(entityId, { prAlias = 'pr' } = {}) {
  if (!entityId) {
    return { where: '', params: [] };
  }
  return {
    where: ` AND ${prAlias}.entity_id = ?`,
    params: [entityId],
  };
}
