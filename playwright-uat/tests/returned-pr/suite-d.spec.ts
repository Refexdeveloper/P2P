import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { uniquePrTitle } from '../../test-data/pr-data';
import { CreatePrPage } from '../../pages/create-pr.page';
import { TasksPage } from '../../pages/tasks.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite D — Returned PR', () => {
  test('D01 - Open returned PR', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1');
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const createPr = new CreatePrPage(page);
    await createPr.gotoCreate();
    const title = await createPr.fillMinimalValidPr({
      title: uniquePrTitle('D01'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await createPr.submitPr();
    await createPr.expectSubmitted();
    await req.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmSendBack('UAT D01');
    await l1.close();

    const req2 = await contextForRole(browser, 'requester');
    const p2 = await req2.newPage();
    await p2.goto('/requester/track-pr');
    await expect(p2.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
    await p2.getByText(title, { exact: false }).first().click();
    await expect(p2.getByRole('button', { name: /resubmit|save draft/i }).first()).toBeVisible();
    await captureEvidence(p2, testInfo, 'D01-returned-open');
    await req2.close();
  });

  test('D02 - Save Draft while returned', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1');
    // Reuse send-back flow then save draft
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const createPr = new CreatePrPage(page);
    await createPr.gotoCreate();
    const title = await createPr.fillMinimalValidPr({
      title: uniquePrTitle('D02'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await createPr.submitPr();
    await createPr.expectSubmitted();
    await req.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmSendBack('UAT D02');
    await l1.close();

    const req2 = await contextForRole(browser, 'requester');
    const p2 = await req2.newPage();
    await p2.goto('/requester/track-pr');
    await p2.getByText(title, { exact: false }).first().click();
    const create = new CreatePrPage(p2);
    await create.fillJustification(
      'Updated justification after return for UAT D02 — verifying draft save on returned PR remains available.'
    );
    await create.saveDraft();
    await create.expectDraftSaved();
    await req2.close();
  });

  test('D03 - Resubmit', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester', 'l1');
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const createPr = new CreatePrPage(page);
    await createPr.gotoCreate();
    const title = await createPr.fillMinimalValidPr({
      title: uniquePrTitle('D03'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await createPr.submitPr();
    await createPr.expectSubmitted();
    await req.close();

    const l1 = await contextForRole(browser, 'l1');
    const l1Page = await l1.newPage();
    await new TasksPage(l1Page).openTaskByPr(title);
    await new TasksPage(l1Page).confirmSendBack('UAT D03');
    await l1.close();

    const req2 = await contextForRole(browser, 'requester');
    const p2 = await req2.newPage();
    await p2.goto('/requester/track-pr');
    await p2.getByText(title, { exact: false }).first().click();
    const create = new CreatePrPage(p2);
    if (await create.resubmitBtn.isVisible().catch(() => false)) {
      await create.resubmit();
    } else {
      await create.submitPr();
    }
    await create.expectSubmitted();
    await captureEvidence(p2, testInfo, 'D03-resubmit');
    await req2.close();
  });

  test('D04 - Locked PR cannot be edited', async ({ browser }) => {
    skipWithoutRoles('requester', 'l1');
    const req = await contextForRole(browser, 'requester');
    const page = await req.newPage();
    const createPr = new CreatePrPage(page);
    await createPr.gotoCreate();
    const title = await createPr.fillMinimalValidPr({
      title: uniquePrTitle('D04'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await createPr.submitPr();
    await createPr.expectSubmitted();
    await req.close();

    // While pending L1, requester should not edit freely
    const req2 = await contextForRole(browser, 'requester');
    const p2 = await req2.newPage();
    await p2.goto('/requester/track-pr');
    await p2.getByText(title, { exact: false }).first().click();
    const lockedHint = p2.getByText(/cannot be edited|read-only|pending/i);
    const saveEnabled = await new CreatePrPage(p2).saveDraftBtn.isEnabled().catch(() => false);
    expect(
      (await lockedHint.count()) > 0 || !saveEnabled,
      'Expected: submitted PR locked for requester edit; Actual: editable'
    ).toBeTruthy();
    await req2.close();
  });
});
