import path from 'path';
import fs from 'fs';
import { test as base } from '@playwright/test';
import { hasCredentials } from '../test-data/users';

export function skipWithoutRequester(): void {
  base.skip(
    !hasCredentials('requester') ||
      !fs.existsSync(path.resolve(__dirname, '../.auth/requester.json')),
    'Requester auth missing — set REQUESTER_* in .env and ensure auth.setup succeeds'
  );
}

export function skipWithoutRoles(...roles: Array<'requester' | 'l1' | 'l2' | 'cfo' | 'scmBuyer' | 'scmManager' | 'admin' | 'noCreatePr'>): void {
  for (const role of roles) {
    const fileMap: Record<string, string> = {
      requester: 'requester.json',
      l1: 'l1.json',
      l2: 'l2.json',
      cfo: 'cfo.json',
      scmBuyer: 'scm-buyer.json',
      scmManager: 'scm-manager.json',
      admin: 'admin.json',
      noCreatePr: 'no-create-pr.json',
    };
    base.skip(
      !hasCredentials(role) || !fs.existsSync(path.resolve(__dirname, '../.auth', fileMap[role])),
      `Missing auth for ${role}`
    );
  }
}
