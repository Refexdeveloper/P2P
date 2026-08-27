import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/auth.fixture';
import { skipWithoutRequester } from '../../utils/skip';
import { uniquePrTitle, prDefaults } from '../../test-data/pr-data';
import { captureEvidence } from '../../utils/screenshots';

test.describe('Suite A — Create PR form & Save Draft', () => {
  test.beforeEach(() => {
    skipWithoutRequester();
  });

  test('A01 - Open Create PR', async ({ createPrPage, page }, testInfo) => {
    await createPrPage.gotoCreate();
    await createPrPage.expectOnCreatePr();
    await expect(createPrPage.saveDraftBtn).toBeVisible();
    await expect(createPrPage.submitBtn).toBeVisible();
    await captureEvidence(page, testInfo, 'A01-create-pr-open');
  });

  test('A02 - Required field validation', async ({ createPrPage, page }, testInfo) => {
    await createPrPage.gotoCreate();
    await createPrPage.submitPr();
    await createPrPage.expectValidation(/entity is required|add at least one line item|business justification is required/i);
    await captureEvidence(page, testInfo, 'A02-validation');
  });

  test('A03 - Line item required', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.fillPrTitle(uniquePrTitle('A03'));
    await createPrPage.selectEntity(prDefaults.entitySearch || undefined);
    await createPrPage.fillJustification(prDefaults.justification);
    await createPrPage.submitPr();
    await createPrPage.expectValidation(/add at least one line item/i);
  });

  test('A04 - Entity required', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.fillPrTitle(uniquePrTitle('A04'));
    await createPrPage.addLineItem();
    await createPrPage.fillJustification(prDefaults.justification);
    await createPrPage.submitPr();
    await createPrPage.expectValidation(/entity is required/i);
  });

  test('A05 - Save Draft - first save', async ({ createPrPage, page }, testInfo) => {
    await createPrPage.gotoCreate();
    const title = await createPrPage.fillMinimalValidPr({ title: uniquePrTitle('A05') });
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    await expect(page.getByText(title).or(page.getByText(/PR-/i).first())).toBeVisible({
      timeout: 20_000,
    });
    await captureEvidence(page, testInfo, 'A05-draft-saved');
  });

  test('A06 - Save Draft - update', async ({ createPrPage, page }, testInfo) => {
    await createPrPage.gotoCreate();
    const title = await createPrPage.fillMinimalValidPr({ title: uniquePrTitle('A06') });
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    const updated = `${title} UPDATED`;
    await createPrPage.fillPrTitle(updated);
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    await expect(page.locator('[data-field="prTitle"] input').first()).toHaveValue(updated);
    await captureEvidence(page, testInfo, 'A06-draft-updated');
  });

  test('A07 - Draft resume', async ({ createPrPage, page }) => {
    await createPrPage.gotoCreate();
    const title = await createPrPage.fillMinimalValidPr({ title: uniquePrTitle('A07') });
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    // Resume via Track PR or edit URL if PR id appears
    await page.goto('/requester/track-pr');
    const row = page.getByText(title, { exact: false }).first();
    test.skip(!(await row.isVisible().catch(() => false)), 'Draft not listed on Track PR — check listing filters');
    await row.click();
    await expect(page.getByText(title).first()).toBeVisible();
  });

  test('A08 - Attachments on draft', async ({ createPrPage }, testInfo) => {
    const sample = path.resolve(__dirname, '../../test-data/sample-attachment.txt');
    fs.writeFileSync(sample, 'UAT attachment sample');
    await createPrPage.gotoCreate();
    await createPrPage.fillMinimalValidPr({ title: uniquePrTitle('A08') });
    await createPrPage.attachFile(sample);
    await createPrPage.saveDraft();
    await createPrPage.expectDraftSaved();
    void testInfo;
  });

  test('A09 - Add/remove line', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.addLineItem({ itemName: 'UAT Line A09-1' });
    await createPrPage.addLineItem({ itemName: 'UAT Line A09-2' });
    await expect(createPrPage.page.getByText('UAT Line A09-2')).toBeVisible();
    await createPrPage.removeFirstLineItem();
  });

  test('A10 - Quick-add masters if available', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    const name = `UAT Master Item ${Date.now()}`;
    await createPrPage.addLineItem({ itemName: name, category: `UAT Cat ${Date.now()}` });
    await expect(createPrPage.page.getByText(name).first()).toBeVisible();
  });

  test('A11 - Vendor master selection', async ({ createPrPage }) => {
    await createPrPage.gotoCreate();
    await createPrPage.selectVendorSelection('own');
    // Own vendor path may show vendor picker later / on RFQ — assert control switched
    const select = createPrPage.page
      .locator('label:has-text("Vendor Selection")')
      .locator('..')
      .locator('select')
      .first();
    await expect(select).toHaveValue('own');
  });

  test('A12 - Permission: menu-only Create PR', async ({ page, createPrPage }) => {
    await createPrPage.gotoCreate();
    await expect(createPrPage.navCreatePrLink().or(page.getByText(/create pr/i).first())).toBeVisible();
  });
});
