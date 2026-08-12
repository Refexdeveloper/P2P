import {
  ensurePreferredScmBuyerRole,
  getPreferredScmBuyerEmails,
  reassignPendingScmBuyerTasks,
  resolveScmBuyerUsers,
} from '../src/utils/scmAssignee.js';
import pool from '../src/config/db.js';

await ensurePreferredScmBuyerRole();
const buyers = await resolveScmBuyerUsers();
const result = await reassignPendingScmBuyerTasks();

console.log('SCM Buyer emails:', getPreferredScmBuyerEmails());
console.log('Resolved buyers:', buyers);
console.log('Pending tasks role-queued:', result.updated);

await pool.end();
