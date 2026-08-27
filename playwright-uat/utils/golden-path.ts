import { Browser, Page } from '@playwright/test';
import { contextForRole } from '../fixtures/auth.fixture';
import { CreatePrPage } from '../pages/create-pr.page';
import { TasksPage } from '../pages/tasks.page';
import { RfqPage } from '../pages/rfq.page';
import { RfqApprovalPage } from '../pages/rfq-approval.page';
import { CreatePoPage } from '../pages/create-po.page';
import { uniquePrTitle } from '../test-data/pr-data';
import { rfqDefaults } from '../test-data/rfq-data';

export type GoldenPathResult = {
  title: string;
  prNumber: string | null;
  lastStage: string;
  notes: string[];
};

async function withRole<T>(
  browser: Browser,
  role: Parameters<typeof contextForRole>[1],
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const ctx = await contextForRole(browser, role);
  const page = await ctx.newPage();
  try {
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

/**
 * Golden Path 1 — Standard + SCM (happy path through Manager Sign).
 * Stops with descriptive notes if a stage has no work item (env data dependent).
 */
export async function runGoldenPath1(browser: Browser): Promise<GoldenPathResult> {
  const notes: string[] = [];
  let title = '';
  let prNumber: string | null = null;

  await withRole(browser, 'requester', async (page) => {
    const create = new CreatePrPage(page);
    await create.gotoCreate();
    title = await create.fillMinimalValidPr({
      title: uniquePrTitle('GP1'),
      flow: 'standard',
      vendorSelection: 'scm',
    });
    await create.saveDraft();
    await create.expectDraftSaved();
    await create.submitPr();
    await create.expectSubmitted();
    prNumber = await create.getDisplayedPrNumber();
    notes.push('Requester: draft saved + submitted (Standard/SCM)');
  });

  await withRole(browser, 'l1', async (page) => {
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmApprove('GP1 L1 approve', true);
    notes.push('L1: approved (Business Yes)');
  });

  await withRole(browser, 'l2', async (page) => {
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmApprove('GP1 L2 approve');
    notes.push('L2: approved');
  });

  await withRole(browser, 'cfo', async (page) => {
    const tasks = new TasksPage(page);
    await tasks.openTaskByPr(title);
    await tasks.confirmApprove('GP1 CFO approve');
    notes.push('CFO: approved');
  });

  await withRole(browser, 'scmBuyer', async (page) => {
    const rfq = new RfqPage(page);
    await rfq.gotoScmRfq();
    await rfq.openPr(title);
    await rfq.inviteOrAddVendor(rfqDefaults.vendorSearch);
    await rfq.enterQuoteAmount(rfqDefaults.quoteAmount);
    await rfq.finalizeOrRecommend();
    notes.push('SCM Buyer: RFQ invite + quote + finalize');
  });

  await withRole(browser, 'scmManager', async (page) => {
    const appr = new RfqApprovalPage(page);
    await appr.goto();
    await appr.openPr(title);
    await appr.approve('GP1 SCM Manager vendor approve');
    notes.push('SCM Manager: vendor approve');
  });

  await withRole(browser, 'scmBuyer', async (page) => {
    const po = new CreatePoPage(page);
    await po.openEligiblePr(title);
    await po.createOrSendPo();
    notes.push('SCM Buyer: Create PO');
  });

  await withRole(browser, 'scmManager', async (page) => {
    const po = new CreatePoPage(page);
    await po.signApprove(title);
    notes.push('SCM Manager: PO sign');
  });

  return { title, prNumber, lastStage: 'manager_sign', notes };
}
