import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { CreatePoPage } from '../../pages/create-po.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite G — Create PO', () => {
  test('G01 - Create PO', async ({ browser }, testInfo) => {
    skipWithoutRoles('scmBuyer');
    const ctx = await contextForRole(browser, 'scmBuyer');
    const page = await ctx.newPage();
    const po = new CreatePoPage(page);
    await po.goto();
    await expect(page.getByRole('heading', { name: /create po/i })).toBeVisible();
    await captureEvidence(page, testInfo, 'G01-create-po-page');
    const eligible = page.getByText(/PR-|ready|eligible/i).first();
    if (!(await eligible.isVisible().catch(() => false))) {
      test.skip(true, 'No eligible PR listed on Create PO — complete RFQ approval first (Golden Path 1)');
    }
    await eligible.click();
    await po.createOrSendPo();
    await ctx.close();
  });

  test('G02 - SCM Manager Sign', async ({ browser }) => {
    skipWithoutRoles('scmManager');
    const ctx = await contextForRole(browser, 'scmManager');
    const page = await ctx.newPage();
    await new CreatePoPage(page).gotoPoApproval();
    const item = page.getByText(/PO-|PR-/i).first();
    test.skip(!(await item.isVisible().catch(() => false)), 'No PO pending manager sign');
    await ctx.close();
  });

  test('G03 - Send Back PO', async () => {
    test.skip(true, 'Needs PO pending SCM Manager approval');
  });

  test('G04 - Buyer Final Verify', async ({ browser }) => {
    skipWithoutRoles('scmBuyer');
    const ctx = await contextForRole(browser, 'scmBuyer');
    const page = await ctx.newPage();
    await page.goto('/scm/buyer-final-verify');
    await expect(page.getByText(/final verify|buyer/i).first()).toBeVisible({ timeout: 20_000 });
    await ctx.close();
  });
});
