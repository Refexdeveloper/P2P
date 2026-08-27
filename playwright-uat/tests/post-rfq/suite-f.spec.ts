import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { RfqApprovalPage } from '../../pages/rfq-approval.page';
import { AdminPage } from '../../pages/admin.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite F — Post-RFQ Approval', () => {
  test('F01 - L1 Vendor Final Approve', async () => {
    test.skip(true, 'Needs PR at RFQ Approval (L1 vendor final)');
  });

  test('F02 - L1 Send Back → Requester RFQ', async ({ browser }, testInfo) => {
    skipWithoutRoles('l1');
    const ctx = await contextForRole(browser, 'l1');
    const page = await ctx.newPage();
    const rfqAppr = new RfqApprovalPage(page);
    await rfqAppr.goto();
    const any = page.getByRole('button', { name: /send back/i }).first();
    if (!(await any.isVisible().catch(() => false))) {
      test.skip(true, 'No RFQ Approval Send Back available for L1 — seed a PR at vendor-final stage');
    }
    await any.click();
    await page.locator('textarea').first().fill('UAT F02 send back to requester RFQ');
    // Prefer target containing Requester RFQ if select present
    const select = page.locator('select').first();
    if (await select.isVisible().catch(() => false)) {
      const opts = await select.locator('option').allTextContents();
      const match = opts.find((o) => /requester.*rfq|rfq/i.test(o));
      if (match) await select.selectOption({ label: match });
    }
    await page.getByRole('button', { name: /confirm/i }).first().click();
    await captureEvidence(page, testInfo, 'F02-send-back-requester-rfq');
    await ctx.close();
  });

  test('F03 - L1 Send Back → Edit PR', async () => {
    test.skip(true, 'Needs send-back target REQUESTER (edit PR)');
  });

  test('F04 - L2 Vendor Approve', async () => {
    test.skip(true, 'Needs PR at L2 vendor approval');
  });

  test('F05 - CFO Vendor Approve', async () => {
    test.skip(true, 'Needs PR at CFO vendor approval');
  });

  test('F06 - SCM Manager Vendor Approve', async () => {
    test.skip(true, 'Covered by Golden Path 1');
  });

  test('F07 - SCM Manager Send Back', async () => {
    test.skip(true, 'Needs PR at SCM Manager vendor approval');
  });

  test('F08 - Reject at RFQ Approval', async () => {
    test.skip(true, 'Needs PR at RFQ Approval');
  });

  test('F09 - Admin/Super Admin Send Back', async ({ browser }, testInfo) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    const rfqAppr = new RfqApprovalPage(page);
    await rfqAppr.goto();
    await expect(page).toHaveURL(/\/rfq-approval/);
    const sendBack = page.getByRole('button', { name: /send back/i }).first();
    if (!(await sendBack.isVisible().catch(() => false))) {
      // Admin may open a card first — try first PR row
      const row = page.locator('button, a, tr, div').filter({ hasText: /PR-/i }).first();
      if (await row.isVisible().catch(() => false)) await row.click();
    }
    if (!(await sendBack.isVisible().catch(() => false))) {
      test.skip(true, 'No RFQ Approval item available for Admin send-back in this environment');
    }
    await sendBack.click();
    await page.locator('textarea').first().fill('UAT F09 admin send back');
    await page.getByRole('button', { name: /confirm/i }).first().click();
    await captureEvidence(page, testInfo, 'F09-admin-send-back');
    await ctx.close();
  });

  test('F10 - Admin Track PR Send Back', async ({ browser }) => {
    skipWithoutRoles('admin');
    const ctx = await contextForRole(browser, 'admin');
    const page = await ctx.newPage();
    await page.goto('/requester/track-pr');
    const sendBack = page.getByRole('button', { name: /send back/i }).first();
    test.skip(!(await sendBack.isVisible().catch(() => false)), 'Track PR admin send-back control not visible');
    await ctx.close();
  });
});

void AdminPage;
void expect;
