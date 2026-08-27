import { test as base, expect, Page, Browser } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { apiLogin, injectSession } from '../utils/test-data';
import { assertCredentials, hasCredentials, UatRole } from '../test-data/users';
import { LoginPage } from '../pages/login.page';
import { CreatePrPage } from '../pages/create-pr.page';
import { TasksPage } from '../pages/tasks.page';
import { RfqPage } from '../pages/rfq.page';
import { RfqApprovalPage } from '../pages/rfq-approval.page';
import { CreatePoPage } from '../pages/create-po.page';
import { AdminPage } from '../pages/admin.page';

const AUTH_DIR = path.resolve(__dirname, '../.auth');

type Pages = {
  loginPage: LoginPage;
  createPrPage: CreatePrPage;
  tasksPage: TasksPage;
  rfqPage: RfqPage;
  rfqApprovalPage: RfqApprovalPage;
  createPoPage: CreatePoPage;
  adminPage: AdminPage;
};

type AuthHelpers = {
  asRole: (role: UatRole) => Promise<Page>;
  requireRole: (role: UatRole) => void;
};

export const test = base.extend<Pages & AuthHelpers>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  createPrPage: async ({ page }, use) => {
    await use(new CreatePrPage(page));
  },
  tasksPage: async ({ page }, use) => {
    await use(new TasksPage(page));
  },
  rfqPage: async ({ page }, use) => {
    await use(new RfqPage(page));
  },
  rfqApprovalPage: async ({ page }, use) => {
    await use(new RfqApprovalPage(page));
  },
  createPoPage: async ({ page }, use) => {
    await use(new CreatePoPage(page));
  },
  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
  requireRole: async ({}, use) => {
    await use((role: UatRole) => {
      test.skip(!hasCredentials(role), `Missing credentials for role "${role}" in .env`);
    });
  },
  asRole: async ({ browser }, use) => {
    const opened: Page[] = [];
    await use(async (role: UatRole) => {
      const creds = assertCredentials(role);
      const storage = path.join(AUTH_DIR, creds.storageFile);
      let context;
      if (fs.existsSync(storage)) {
        context = await browser.newContext({ storageState: storage });
      } else {
        context = await browser.newContext();
        const page = await context.newPage();
        const login = await apiLogin(page.request, creds.username, creds.password);
        await injectSession(page, login);
        await context.storageState({ path: storage });
        opened.push(page);
        return page;
      }
      const page = await context.newPage();
      opened.push(page);
      return page;
    });
    for (const p of opened) {
      await p.context().close().catch(() => undefined);
    }
  },
});

export { expect };

/** Create authenticated browser context for a role (for multi-user flows). */
export async function contextForRole(browser: Browser, role: UatRole) {
  const creds = assertCredentials(role);
  const storage = path.join(AUTH_DIR, creds.storageFile);
  if (fs.existsSync(storage)) {
    return browser.newContext({ storageState: storage });
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const login = await apiLogin(page.request, creds.username, creds.password);
  await injectSession(page, login);
  await context.storageState({ path: storage });
  await page.close();
  return context;
}
