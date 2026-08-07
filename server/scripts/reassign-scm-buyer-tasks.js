import {
  ensurePreferredScmBuyerRole,
  getPreferredScmBuyerEmail,
  reassignPendingScmBuyerTasks,
  resolveScmBuyerUser,
} from '../src/utils/scmAssignee.js';
import pool from '../src/config/db.js';

await ensurePreferredScmBuyerRole();
const buyer = await resolveScmBuyerUser();
const result = await reassignPendingScmBuyerTasks();

console.log('Preferred SCM Buyer email:', getPreferredScmBuyerEmail());
console.log('Resolved buyer:', buyer);
console.log('Pending tasks reassigned:', result.updated);

await pool.end();
