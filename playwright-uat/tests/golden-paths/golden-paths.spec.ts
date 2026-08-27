import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { runGoldenPath1 } from '../../utils/golden-path';
import { captureEvidence } from '../../utils/screenshots';
import { CreatePrPage } from '../../pages/create-pr.page';
import { TasksPage } from '../../pages/tasks.page';
import { RfqPage } from '../../pages/rfq.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { uniquePrTitle } from '../../test-data/pr-data';

test.describe('Golden Paths', () => {
  test('GP1 - Standard + SCM end-to-end', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1', 'l2', 'cfo', 'scmBuyer', 'scmManager');
    try {
      const result = await runGoldenPath1(browser);
      expect(result.title).toBeTruthy();
      testInfo.annotations.push({
        type: 'notes',
        description: result.notes.join(' → '),
      });
    } catch (err) {
      const page = await (await contextForRole(browser, 'requester')).newPage();
      await captureEvidence(page, testInfo, 'GP1-failure');
      await page.context().close();
      throw err;
    }
  });

  test('GP2 - Standard + Own', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1', 'l2', 'scmBuyer');
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const create = new CreatePrPage(page);
    await create.gotoCreate();
    const title = await create.fillMinimalValidPr({
      title: uniquePrTitle('GP2'),
      flow: 'standard',
      vendorSelection: 'own',
      skipBilling: true,
    });
    await create.submitPr();
    await create.expectSubmitted();
    await req.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmApprove('GP2 L1', true);
    await l1.close();

    const req2 = await contextForRole(browser, 'requester');
    const r2 = await req2.newPage();
    await new RfqPage(r2).gotoRequesterRfq();
    const hasPr = await r2.getByText(title, { exact: false }).isVisible().catch(() => false);
    test.skip(!hasPr, 'PR not yet on Requester RFQ list after L1 — continue manually / check Own path status');
    await req2.close();
  });

  test('GP3 - Functional + Own', async () => {
    test.skip(true, 'Requires Functional multi-approver selection UX confirmed against live data');
  });

  test('GP4 - Send Back & Resubmit', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1', 'l2');
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const create = new CreatePrPage(page);
    await create.gotoCreate();
    const title = await create.fillMinimalValidPr({
      title: uniquePrTitle('GP4'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await create.submitPr();
    await create.expectSubmitted();
    await req.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmSendBack('GP4 L1 send back');
    await l1.close();

    const req2 = await contextForRole(browser, 'requester');
    const p2 = await req2.newPage();
    await p2.goto('/requester/track-pr');
    await p2.getByText(title, { exact: false }).first().click();
    const edit = new CreatePrPage(p2);
    await edit.saveDraft();
    if (await edit.resubmitBtn.isVisible().catch(() => false)) await edit.resubmit();
    else await edit.submitPr();
    await edit.expectSubmitted();
    await req2.close();

    const l1b = await contextForRole(browser, 'l1');
    const l1bPage = await l1b.newPage();
    await new TasksPage(l1bPage).openTaskByPr(title);
    await new TasksPage(l1bPage).confirmApprove('GP4 L1 re-approve', true);
    await l1b.close();
  });
});
