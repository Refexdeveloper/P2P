import 'dotenv/config';

const token = process.env.REFEXONE_API_TOKEN;
const users = await fetch('https://refexone.com/api/users', {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
}).then((r) => r.json());

const keySet = new Set();
const managerKeys = new Set();
for (const u of users) {
  for (const k of Object.keys(u)) {
    keySet.add(k);
    if (/manager|report|l1|hod|supervisor|lead/i.test(k)) managerKeys.add(k);
  }
  for (const [k, v] of Object.entries(u)) {
    if (v && typeof v === 'object') {
      console.log('nested', u.email, k, JSON.stringify(v).slice(0, 200));
    }
  }
}

console.log('keys', [...keySet].sort());
console.log('manager-like keys', [...managerKeys]);

const sample = users.find((u) => u.kissflow_user_id && u.email.includes('refex'));
console.log('sample refex user', JSON.stringify(sample, null, 2));

const paths = [
  '/kissflow/user/UsDhZv5__fXb',
  '/kissflow/users/UsDhZv5__fXb',
  '/kissflow/reporting/UsDhZv5__fXb',
  '/integrations/kissflow/users/UsDhZv5__fXb',
];

for (const p of paths) {
  const r = await fetch(`https://refexone.com/api${p}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (r.status !== 404) console.log(p, r.status, (await r.text()).slice(0, 300));
}
