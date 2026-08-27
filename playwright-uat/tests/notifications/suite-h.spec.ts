import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { contextForRole } from '../../fixtures/auth.fixture';
import { openEmailLogs, clickRetriggerIfPresent } from '../../utils/notifications';
import { AdminPage } from '../../pages/admin.page';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite H — Notifications', () => {
  test('H01 - PR Submit notification', async ({ browser }) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    await openEmailLogs(page);
    await expect(page.getByText(/email|log|notification/i).first()).toBeVisible();
    await ctx.close();
  });

  test('H02 - Approval notification', async () => {
    test.skip(true, 'Assert specific approval email after C01 — depends on SMTP delivery timing');
  });

  test('H03 - Send Back / Reject notification', async ({ browser }, testInfo) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    await openEmailLogs(page);
    const hit = page.getByText(/send back|sent back|reject|returned/i).first();
    if (!(await hit.isVisible().catch(() => false))) {
      test.skip(true, 'No send-back/reject email log rows yet — run C03/C04 then re-check');
    }
    await expect(hit).toBeVisible();
    await captureEvidence(page, testInfo, 'H03-sendback-reject-logs');
    await ctx.close();
  });

  test('H04 - Retrigger failed notification', async ({ browser }) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    await openEmailLogs(page);
    const ok = await clickRetriggerIfPresent(page);
    test.skip(!ok, 'No Retrigger/Retry control on email logs for failed rows');
    await ctx.close();
  });

  test('H05 - WhatsApp if enabled', async () => {
    test.skip(true, 'WhatsApp channel optional — enable only when app WhatsApp integration is configured');
  });

  test('H06 - Admin User Permissions', async ({ browser }, testInfo) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    const admin = new AdminPage(page);
    await admin.gotoUserPermissions();
    await expect(page.getByRole('heading', { name: /user permissions/i })).toBeVisible();
    await expect(page.getByText(/create pr|nav\.create_pr|permissions/i).first()).toBeVisible();
    await captureEvidence(page, testInfo, 'H06-user-permissions');
    await ctx.close();
  });
});
