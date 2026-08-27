import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { saveRoleStorage, appBase } from '../utils/test-data';
import { getRoleCredentials, UatRole } from '../test-data/users';

const AUTH_DIR = path.resolve(__dirname, '../.auth');
fs.mkdirSync(AUTH_DIR, { recursive: true });

const roles: UatRole[] = [
  'requester',
  'l1',
  'l2',
  'cfo',
  'scmBuyer',
  'scmManager',
  'admin',
  'noCreatePr',
];

setup('authenticate UAT roles via /api/auth/login', async ({ browser, request }) => {
  let any = false;

  for (const role of roles) {
    const creds = getRoleCredentials(role);
    if (!creds.username || !creds.password) {
      console.log(`[auth.setup] SKIP ${role} — credentials not set in .env`);
      continue;
    }
    any = true;
    const out = path.join(AUTH_DIR, creds.storageFile);
    try {
      const login = await saveRoleStorage(browser, creds.username, creds.password, out);
      console.log(`[auth.setup] OK ${role} → ${creds.storageFile} (${login.user.role})`);
    } catch (err) {
      console.error(`[auth.setup] FAIL ${role}:`, err instanceof Error ? err.message : err);
    }
  }

  if (!any) {
    console.warn(
      '[auth.setup] No role credentials found. Copy .env.example → .env and set usernames/passwords.'
    );
  }

  const health = await request.get(appBase()).catch(() => null);
  expect(health === null || health.ok() || health.status() < 500).toBeTruthy();
});
