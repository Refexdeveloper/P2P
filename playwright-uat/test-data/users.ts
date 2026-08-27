/**
 * Role credentials from environment — never hardcode passwords.
 */
export type UatRole =
  | 'requester'
  | 'l1'
  | 'l2'
  | 'cfo'
  | 'scmBuyer'
  | 'scmManager'
  | 'admin'
  | 'noCreatePr';

export type RoleCredentials = {
  role: UatRole;
  username: string;
  password: string;
  storageFile: string;
};

function req(name: string): string {
  return (process.env[name] || '').trim();
}

export function getRoleCredentials(role: UatRole): RoleCredentials {
  const map: Record<UatRole, { user: string; pass: string; file: string }> = {
    requester: {
      user: 'REQUESTER_USERNAME',
      pass: 'REQUESTER_PASSWORD',
      file: 'requester.json',
    },
    l1: { user: 'L1_USERNAME', pass: 'L1_PASSWORD', file: 'l1.json' },
    l2: { user: 'L2_USERNAME', pass: 'L2_PASSWORD', file: 'l2.json' },
    cfo: { user: 'CFO_USERNAME', pass: 'CFO_PASSWORD', file: 'cfo.json' },
    scmBuyer: {
      user: 'SCM_BUYER_USERNAME',
      pass: 'SCM_BUYER_PASSWORD',
      file: 'scm-buyer.json',
    },
    scmManager: {
      user: 'SCM_MANAGER_USERNAME',
      pass: 'SCM_MANAGER_PASSWORD',
      file: 'scm-manager.json',
    },
    admin: {
      user: 'ADMIN_USERNAME',
      pass: 'ADMIN_PASSWORD',
      file: 'admin.json',
    },
    noCreatePr: {
      user: 'NO_CREATE_PR_USERNAME',
      pass: 'NO_CREATE_PR_PASSWORD',
      file: 'no-create-pr.json',
    },
  };

  const cfg = map[role];
  return {
    role,
    username: req(cfg.user),
    password: req(cfg.pass),
    storageFile: cfg.file,
  };
}

export function assertCredentials(role: UatRole): RoleCredentials {
  const creds = getRoleCredentials(role);
  if (!creds.username || !creds.password) {
    throw new Error(
      `Missing credentials for role "${role}". Set ${role.toUpperCase()} username/password in playwright-uat/.env (see .env.example).`
    );
  }
  return creds;
}

export function hasCredentials(role: UatRole): boolean {
  const c = getRoleCredentials(role);
  return Boolean(c.username && c.password);
}

/** Seed emails from server/db/init.js — for documentation only; passwords come from .env */
export const SEED_USER_HINTS = {
  requester: 'requester@procure.com',
  l1: 'manager@procure.com',
  l2: 'prmanager@procure.com',
  cfo: 'cfo@procure.com',
  scmBuyer: 'scm@procure.com',
  scmManager: 'rajeev.v@refex.co.in',
  admin: 'admin@procure.com',
} as const;
