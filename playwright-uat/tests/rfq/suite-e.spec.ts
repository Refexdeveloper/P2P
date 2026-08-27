import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRoles } from '../../utils/skip';
import { rfqDefaults } from '../../test-data/rfq-data';
import { RfqPage } from '../../pages/rfq.page';
import { contextForRole } from '../../fixtures/auth.fixture';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite E — RFQ', () => {
  test('E1.01 - Own RFQ opens', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester');
    const ctx = await contextForRole(browser, 'requester');
    const page = await ctx.newPage();
    const rfq = new RfqPage(page);
    await rfq.gotoRequesterRfq();
    await expect(page).toHaveURL(/\/requester\/rfq-entry/);
    await captureEvidence(page, testInfo, 'E1.01-own-rfq');
    await ctx.close();
  });

  test('E1.02 - Add/invite vendor', async ({ browser }) => {
    skipWithoutRoles('requester');
    test.skip(true, 'Needs a PR in REQUESTER_RFQ status — create via Standard+Own L1 approve first');
  });

  test('E1.03 - Quote ₹0 confirmation', async ({ browser }) => {
    skipWithoutRoles('requester');
    test.skip(true, 'Needs active Own RFQ with vendor row to enter ₹0 and assert confirm dialog');
  });

  test('E1.04 - Upload quotation', async ({ browser }) => {
    skipWithoutRoles('requester');
    test.skip(true, 'Needs active Own RFQ session');
  });

  test('E1.05 - Next RFQ round / send back', async ({ browser }) => {
    skipWithoutRoles('requester');
    test.skip(true, 'Needs multi-round RFQ PR');
  });

  test('E1.06 - Finalize/recommend', async ({ browser }, testInfo) => {
    skipWithoutRoles('requester');
    const ctx = await contextForRole(browser, 'requester');
    const page = await ctx.newPage();
    const rfq = new RfqPage(page);
    await rfq.gotoRequesterRfq();
    const finalize = page.getByRole('button', {
      name: /finalize|recommend|submit rfq|submit recommendation/i,
    });
    if (!(await finalize.first().isVisible().catch(() => false))) {
      test.skip(true, 'No finalize control visible — no PR currently in Own RFQ for requester');
    }
    await finalize.first().click();
    await captureEvidence(page, testInfo, 'E1.06-finalize');
    await ctx.close();
  });

  test('E1.07 - RFQ notification', async ({ browser }) => {
    skipWithoutRoles('admin');
    test.skip(true, 'Depends on RFQ submit event + email log entry');
  });

  test('E2.01 - SCM RFQ list', async ({ browser }, testInfo) => {
    skipWithoutRoles('scmBuyer');
    const ctx = await contextForRole(browser, 'scmBuyer');
    const page = await ctx.newPage();
    await new RfqPage(page).gotoScmRfq();
    await expect(page).toHaveURL(/\/scm\/rfq-entry/);
    await captureEvidence(page, testInfo, 'E2.01-scm-rfq-list');
    await ctx.close();
  });

  test('E2.02 - RFQ config + vendor invite', async () => {
    test.skip(true, 'Needs PR at SCM_RFQ after CFO approve');
  });

  test('E2.03 - Manual quote', async () => {
    test.skip(true, 'Needs active SCM RFQ');
  });

  test('E2.04 - Finalize RFQ', async () => {
    test.skip(true, 'Covered by Golden Path 1 when PR reaches SCM RFQ');
  });

  test('E3.01 - Functional Own → SCM Final RFQ', async () => {
    test.skip(true, 'Covered by Golden Path 3');
  });

  test('E3.02 - Quotes/files preserved', async () => {
    test.skip(true, 'Requires Functional Own PR with quotes then send-back/reopen');
  });
});

void rfqDefaults;
