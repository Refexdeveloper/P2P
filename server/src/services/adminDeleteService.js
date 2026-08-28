import pool from '../config/db.js';
import { isSuperAdmin } from './permissionService.js';

function assertSuperAdmin(user) {
  if (!isSuperAdmin(user?.role)) {
    throw new Error('Only Super Admin can delete purchase requests and purchase orders');
  }
}

function inList(ids) {
  return ids.map(() => '?').join(',');
}

async function tryQuery(conn, sql, params = []) {
  try {
    return await conn.query(sql, params);
  } catch (err) {
    if (String(err?.code || '') === 'ER_NO_SUCH_TABLE') return [[], []];
    throw err;
  }
}

async function deletePoDependents(conn, poIds) {
  const ids = [...new Set((poIds || []).map(Number).filter((n) => n > 0))];
  if (!ids.length) return;
  const ph = inList(ids);

  await tryQuery(conn, `DELETE FROM payments WHERE po_id IN (${ph})`, ids);
  await tryQuery(conn, `DELETE FROM invoices WHERE po_id IN (${ph})`, ids);

  const [grns] = await tryQuery(conn, `SELECT id FROM grn_headers WHERE po_id IN (${ph})`, ids);
  const grnIds = (grns || []).map((g) => Number(g.id)).filter((n) => n > 0);
  if (grnIds.length) {
    await tryQuery(conn, `DELETE FROM grn_line_items WHERE grn_id IN (${inList(grnIds)})`, grnIds);
    await tryQuery(conn, `DELETE FROM grn_headers WHERE po_id IN (${ph})`, ids);
  }

  await tryQuery(conn, `UPDATE email_logs SET po_id = NULL WHERE po_id IN (${ph})`, ids);
  await tryQuery(conn, `UPDATE whatsapp_logs SET po_id = NULL WHERE po_id IN (${ph})`, ids);
  await tryQuery(conn, `DELETE FROM po_line_items WHERE po_id IN (${ph})`, ids);
  await conn.query(`DELETE FROM purchase_orders WHERE id IN (${ph})`, ids);
}

export async function adminDeletePurchaseOrder(user, poId) {
  assertSuperAdmin(user);
  const id = Number(poId);
  if (!id) throw new Error('PO id is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, po_number FROM purchase_orders WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) throw new Error('Purchase order not found');
    await deletePoDependents(conn, [id]);
    await conn.commit();
    return { poId: id, poNumber: rows[0].po_number };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function adminDeletePurchaseRequest(user, prId) {
  assertSuperAdmin(user);
  const id = Number(prId);
  if (!id) throw new Error('PR id is required');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, pr_number FROM purchase_requests WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) throw new Error('Purchase request not found');

    const [pos] = await conn.query(`SELECT id FROM purchase_orders WHERE pr_id = ?`, [id]);
    await deletePoDependents(conn, (pos || []).map((p) => p.id));

    const [subs] = await tryQuery(
      conn,
      `SELECT vqs.id FROM vendor_quotation_submissions vqs
       JOIN rfq_invitations ri ON ri.id = vqs.rfq_invitation_id
       WHERE ri.pr_id = ?`,
      [id]
    );
    const subIds = (subs || []).map((s) => Number(s.id)).filter((n) => n > 0);
    if (subIds.length) {
      await tryQuery(
        conn,
        `DELETE FROM vendor_quotation_files WHERE submission_id IN (${inList(subIds)})`,
        subIds
      );
    }

    await tryQuery(conn, `UPDATE email_logs SET pr_id = NULL, po_id = NULL WHERE pr_id = ?`, [id]);
    await tryQuery(conn, `UPDATE whatsapp_logs SET pr_id = NULL, po_id = NULL WHERE pr_id = ?`, [id]);

    await conn.query(`DELETE FROM purchase_requests WHERE id = ?`, [id]);
    await conn.commit();
    return { prId: id, prNumber: rows[0].pr_number };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
