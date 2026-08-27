import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { uniquePrTitle } from '../../test-data/pr-data';
import { CreatePrPage } from '../../pages/create-pr.page';
import { TasksPage } from '../../pages/tasks.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { captureEvidence } from '../../utils/screenshots';

async function createAndSubmitStandardScm(browser: import('@playwright/test').Browser, prefix: string) {
  const ctx = await contextForRole(browser, 'requester');
  const page = await ctx.newPage();
  const createPr = new CreatePrPage(page);
  await createPr.gotoCreate();
  const title = await createPr.fillMinimalValidPr({
    title: uniquePrTitle(prefix),
    flow: 'standard',
    vendorSelection: 'scm',
  });
  await createPr.submitPr();
  await createPr.expectSubmitted();
  const prNumber = await createPr.getDisplayedPrNumber();
  return { ctx, page, title, prNumber: prNumber || title };
}

test.describe('Suite C — Pre-RFQ approvals', () => {
  test('C01 - L1 Approve SCM', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1');
    const { title, ctx } = await createAndSubmitStandardScm(browser, 'C01');
    await ctx.close();
    const l1 = await contextForRole(browser, 'l1');
    const page = await l1.newPage();
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmApprove('UAT C01 L1 approve', true);
    await captureEvidence(page, testInfo, 'C01-l1-approve');
    await l1.close();
  });

  test('C02 - L1 Approve Own', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1');
    const ctx = await contextForRole(browser, 'requester');
    const page = await ctx.newPage();
    const createPr = new CreatePrPage(page);
    await createPr.gotoCreate();
    const title = await createPr.fillMinimalValidPr({
      title: uniquePrTitle('C02'),
      flow: 'standard',
      vendorSelection: 'own',
      skipBilling: true,
    });
    await createPr.submitPr();
    await createPr.expectSubmitted();
    await ctx.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmApprove('UAT C02', true);
    await l1.close();
  });

  test('C03 - L1 Send Back', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1');
    const { title, ctx } = await createAndSubmitStandardScm(browser, 'C03');
    await ctx.close();
    const l1 = await contextForRole(browser, 'l1');
    const page = await l1.newPage();
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmSendBack('UAT C03 send back');
    await captureEvidence(page, testInfo, 'C03-send-back');
    await l1.close();
  });

  test('C04 - L1 Reject', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1');
    const { title, ctx } = await createAndSubmitStandardScm(browser, 'C04');
    await ctx.close();
    const l1 = await contextForRole(browser, 'l1');
    const page = await l1.newPage();
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmReject('UAT C04 reject');
    await captureEvidence(page, testInfo, 'C04-reject');
    await l1.close();
  });

  test('C05 - L2 Approve → CFO', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1', 'l2');
    test.skip(true, 'Full L1→L2→CFO chain depends on amount thresholds and L1 business-yes path; run via Golden Path 1');
  });

  test('C06 - L2 Approve → SCM RFQ', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1', 'l2', 'cfo');
    test.skip(true, 'Covered by Golden Path 1 after CFO gate');
  });

  test('C07 - L2 Send Back', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1', 'l2');
    test.skip(true, 'Requires PR already at L2 — use Golden Path 4');
  });

  test('C08 - CFO Approve', async ({ browser }) => {
    skipWithoutRoles('cfo');
    test.skip(true, 'Requires PR pending CFO — use Golden Path 1');
  });

  test('C09 - CFO Reject / Return', async ({ browser }) => {
    skipWithoutRoles('cfo');
    test.skip(true, 'Requires PR pending CFO');
  });

  test('C10 - Wrong user blocked', async ({ browser }) => {
    skipWithoutRoles('requester', 'l2');
    const { title, ctx } = await createAndSubmitStandardScm(browser, 'C10');
    await ctx.close();
    const l2 = await contextForRole(browser, 'l2');
    const page = await l2.newPage();
    const tasks = new TasksPage(page);
    await tasks.goto();
    const visible = await page.getByText(title, { exact: false }).first().isVisible().catch(() => false);
    expect(visible, `Expected: L2 cannot act on L1-pending PR "${title}"; Actual: visible=${visible}`).toBeFalsy();
    await l2.close();
  });

  test('C11 - Menu-assigned approver', async ({ browser }) => {
    skipWithoutRoles('admin', 'l1');
    test.skip(true, 'Requires admin to assign nav.tasks to a non-role user — manual data setup');
  });
});
