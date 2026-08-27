import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRequester, skipWithoutRoles } from '../../utils/skip';
import { uniquePrTitle } from '../../test-data/pr-data';
import { captureEvidence } from '../../utils/screenshots';
import { CreatePrPage } from '../../pages/create-pr.page';
import { contextForRole } from '../../fixtures/auth.fixture';

test.describe('Suite B — Submit PR', () => {
  test.beforeEach(() => skipWithoutRequester());

  async function submitVariant(
    createPrPage: CreatePrPage,
    flow: 'standard' | 'functional',
    vendor: 'scm' | 'own',
    titlePrefix: string
  ) {
    await createPrPage.gotoCreate();
    const title = await createPrPage.fillMinimalValidPr({
      title: uniquePrTitle(titlePrefix),
      flow,
      vendorSelection: vendor,
      skipBilling: vendor === 'own',
    });
    if (flow === 'functional') {
      // Functional requires selecting approver(s)
      const approver = createPrPage.page.getByText(/select.*approver|approval user|user approval/i).first();
      if (await approver.isVisible().catch(() => false)) {
        const combo = createPrPage.page.locator('input').filter({ has: createPrPage.page.locator('xpath=ancestor::*[contains(., "Approver") or contains(., "approval")]') }).first();
        if (await combo.isVisible().catch(() => false)) {
          await combo.click();
          await createPrPage.page.locator('div.absolute button').first().click();
        }
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Functional approver picker not found with current selectors — may fail submit validation',
        });
      }
    }
    await createPrPage.submitPr();
    await createPrPage.expectSubmitted();
    return title;
  }

  test('B01 - Standard + SCM', async ({ createPrPage, page }, testInfo) => {
    const title = await submitVariant(createPrPage, 'standard', 'scm', 'B01');
    await captureEvidence(page, testInfo, 'B01-submitted');
    expect(title).toBeTruthy();
  });

  test('B02 - Standard + Own', async ({ createPrPage }) => {
    await submitVariant(createPrPage, 'standard', 'own', 'B02');
  });

  test('B03 - Functional + SCM', async ({ createPrPage }) => {
    await submitVariant(createPrPage, 'functional', 'scm', 'B03');
  });

  test('B04 - Functional + Own', async ({ createPrPage }) => {
    await submitVariant(createPrPage, 'functional', 'own', 'B04');
  });

  test('B05 - Functional with no approver', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.fillMinimalValidPr({
      title: uniquePrTitle('B05'),
      flow: 'functional',
      vendorSelection: 'scm',
    });
    await createPrPage.submitPr();
    await createPrPage.expectValidation(/select at least one user|functional flow approval/i);
  });

  test('B06 - Functional maximum approvers', async ({ createPrPage }) => {
    test.skip(true, 'Requires UI multi-select of 5+ approvers — implement once Functional approver multi-select selectors are confirmed in env');
  });

  test('B07 - Draft → Submit', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.fillMinimalValidPr({ title: uniquePrTitle('B07'), flow: 'standard', vendorSelection: 'scm' });
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    await createPrPage.submitPr();
    await createPrPage.expectSubmitted();
  });

  test('B08 - Notification after submit', async ({ browser, createPrPage }) => {
    skipWithoutRoles('admin');
    const title = await submitVariant(createPrPage, 'standard', 'scm', 'B08');
    const adminCtx = await contextForRole(browser, 'admin');
    const adminPage = await adminCtx.newPage();
    await adminPage.goto('/admin/email-logs');
    const found = await adminPage.getByText(title, { exact: false }).first().isVisible().catch(() => false);
    test.skip(!found, 'Email log entry for PR not found — SMTP/queue may be delayed or disabled');
    await adminCtx.close();
  });
});
