import { Locator, Page, expect } from '@playwright/test';
import { prDefaults, PrFillOptions, uniquePrTitle } from '../test-data/pr-data';

/**
 * Create / Edit PR — routes:
 *  /requester/create-pr
 *  /requester/edit-pr/:prId
 */
export class CreatePrPage {
  readonly page: Page;
  readonly saveDraftBtn: Locator;
  readonly submitBtn: Locator;
  readonly resubmitBtn: Locator;
  readonly prTitle: Locator;
  readonly addLineItemBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    // Remix Icon glyphs prefix accessible names (e.g. " Save Draft")
    this.saveDraftBtn = page.getByRole('button', { name: /save draft/i });
    this.submitBtn = page.getByRole('button', { name: /submit pr/i });
    this.resubmitBtn = page.getByRole('button', { name: /resubmit pr|^resubmit$/i });
    this.prTitle = page.locator('[data-field="prTitle"] input, input').filter({ has: page.locator('xpath=ancestor::*[@data-field="prTitle"]') });
    this.addLineItemBtn = page.getByRole('button', { name: /add line item/i }).first();
  }

  async gotoCreate(): Promise<void> {
    await this.page.goto('/requester/create-pr');
    await expect(
      this.page.getByRole('heading', { name: /new purchase requisition|create purchase|edit/i })
    ).toBeVisible({ timeout: 30_000 });
  }

  async gotoEdit(prId: number | string): Promise<void> {
    await this.page.goto(`/requester/edit-pr/${prId}`);
    await expect(
      this.page.getByRole('heading', { name: /purchase requisition|edit/i }).or(
        this.page.getByText(/pr title/i).first()
      )
    ).toBeVisible({ timeout: 30_000 });
  }

  async expectOnCreatePr(): Promise<void> {
    await expect(this.page).toHaveURL(/\/requester\/(create-pr|edit-pr)/);
    await expect(this.page.getByRole('heading', { name: /purchase requisition/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(this.page.getByPlaceholder(/enter a short title/i)).toBeVisible();
    await this.saveDraftBtn.scrollIntoViewIfNeeded();
    await expect(this.saveDraftBtn).toBeVisible({ timeout: 20_000 });
    await expect(this.submitBtn).toBeVisible();
  }

  async fillPrTitle(title: string): Promise<void> {
    const byPlaceholder = this.page.getByPlaceholder(/enter a short title/i);
    if (await byPlaceholder.count()) {
      await byPlaceholder.fill(title);
      return;
    }
    const field = this.page.locator('[data-field="prTitle"] input').first();
    if (await field.count()) {
      await field.fill(title);
      return;
    }
    await this.page.getByLabel(/pr title/i).fill(title);
  }

  async selectFlow(flow: 'standard' | 'functional'): Promise<void> {
    const select = this.page.locator('label:has-text("Flow")').locator('..').locator('select').first();
    await select.selectOption(flow);
  }

  async selectVendorSelection(vendor: 'scm' | 'own'): Promise<void> {
    const select = this.page
      .locator('label:has-text("Vendor Selection")')
      .locator('..')
      .locator('select')
      .first();
    await select.selectOption(vendor);
  }

  /** SearchCreateField for Entity — placeholder: "Search entity by code, name, cost center…" */
  async selectEntity(search?: string): Promise<void> {
    const input = this.page.getByPlaceholder(/search entity by code/i);
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.click();
    if (search) await input.fill(search);
    else await input.fill(' ');
    await this.page.waitForTimeout(600);
    const dropdownBtn = this.page.locator('div.relative div.absolute button, div.absolute button').first();
    if (await dropdownBtn.isVisible().catch(() => false)) {
      await dropdownBtn.click();
      return;
    }
    await input.press('Enter');
  }

  async fillJustification(text: string): Promise<void> {
    await this.page
      .getByPlaceholder(/describe the business need/i)
      .fill(text);
  }

  async addLineItem(opts?: {
    itemName?: string;
    category?: string;
    quantity?: string;
    unitPrice?: string;
    description?: string;
  }): Promise<void> {
    const item = { ...prDefaults.lineItem, ...opts };
    await this.addLineItemBtn.click();
    await expect(this.page.getByText(/item name/i).first()).toBeVisible();

    const itemInput = this.page.getByPlaceholder(/search item by name or code/i);
    await itemInput.fill(item.itemName);
    await this.page.waitForTimeout(500);
    // Prefer existing option, else quick-add
    const existing = this.page
      .locator('div.absolute button')
      .filter({ hasText: new RegExp(item.itemName, 'i') })
      .first();
    const addNew = this.page.getByRole('button', {
      name: new RegExp(`save .*${item.itemName}.*as new item|save .*as new item`, 'i'),
    });
    if (await existing.isVisible().catch(() => false)) {
      await existing.click();
    } else if (await addNew.isVisible().catch(() => false)) {
      await addNew.click();
      await this.page.waitForTimeout(1000);
    } else {
      await itemInput.press('Enter');
      await this.page.waitForTimeout(1000);
    }

    const catInput = this.page.getByPlaceholder(/search category|category/i).first();
    if (await catInput.isVisible().catch(() => false)) {
      const current = await catInput.inputValue().catch(() => '');
      if (!current) {
        await catInput.fill(item.category);
        await this.page.waitForTimeout(400);
        const catOpt = this.page.locator('div.absolute button').first();
        const addCat = this.page.getByRole('button', {
          name: /save .*as new categor/i,
        });
        if (await catOpt.isVisible().catch(() => false)) await catOpt.click();
        else if (await addCat.isVisible().catch(() => false)) await addCat.click();
        else await catInput.press('Enter');
        await this.page.waitForTimeout(600);
      }
    }

    await this.page.getByLabel('Quantity').fill(item.quantity);
    await this.page.getByLabel('Unit Price').fill(item.unitPrice);

    const desc = this.page.getByPlaceholder(/type the item description/i);
    if (await desc.count()) await desc.fill(item.description || item.itemName);

    await this.page.getByRole('button', { name: /\badd\b|\bupdate\b/i }).last().click();
    await expect(this.page.getByText(item.itemName).first()).toBeVisible({ timeout: 20_000 });
  }

  async fillBillingIfVisible(): Promise<void> {
    const addr = this.page.getByPlaceholder(/enter billing/i);
    if (!(await addr.isVisible().catch(() => false))) return;

    const region = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: /select billing region|select entity/i }) }).first();
    if (await region.isVisible().catch(() => false)) {
      const options = await region.locator('option').allTextContents();
      const firstReal = options.find((o) => o && !/select/i.test(o));
      if (firstReal) await region.selectOption({ label: firstReal });
    }
    await addr.fill(prDefaults.billingAddress);
    const delivery = this.page.getByPlaceholder(/site \/ warehouse/i);
    if (await delivery.isVisible().catch(() => false)) {
      await delivery.fill(prDefaults.placeOfDelivery);
    }
    const timeline = this.page.getByPlaceholder(/within 30 days/i);
    if (await timeline.isVisible().catch(() => false)) {
      await timeline.fill(prDefaults.expectedDeliveryTimeline);
    }
    const terms = this.page.getByPlaceholder(/net 30/i);
    if (await terms.isVisible().catch(() => false)) {
      await terms.fill(prDefaults.paymentTerms);
    }
    const poc = this.page.getByPlaceholder(/name \/ phone/i);
    if (await poc.isVisible().catch(() => false)) {
      await poc.fill(prDefaults.deliveryPoc);
    }
  }

  async selectDepartment(search?: string): Promise<void> {
    const input = this.page.getByPlaceholder(/search department|department/i).or(
      this.page.locator('label:has-text("Department")').locator('..').locator('input').first()
    );
    await input.first().click();
    if (search) await input.first().fill(search);
    await this.page.waitForTimeout(500);
    const opt = this.page.locator('div.absolute button, div.relative div.absolute button').first();
    if (await opt.isVisible().catch(() => false)) await opt.click();
    else await input.first().press('Enter');
  }

  async fillRequiredDate(isoDate?: string): Promise<void> {
    const date = isoDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const input = this.page.locator('input[type="date"]').first();
    if (await input.count()) {
      await input.fill(date);
      return;
    }
    const byLabel = this.page.locator('label:has-text("Required Date")').locator('..').locator('input').first();
    await byLabel.fill(date);
  }

  async fillMinimalValidPr(options: PrFillOptions = {}): Promise<string> {
    const title = options.title || uniquePrTitle();
    await this.fillPrTitle(title);
    await this.selectFlow(options.flow || 'standard');
    await this.selectVendorSelection(options.vendorSelection || 'scm');
    if (!options.skipEntity) {
      await this.selectEntity(prDefaults.entitySearch || undefined);
    }
    await this.selectDepartment();
    await this.fillRequiredDate();
    if (!options.skipLineItem) {
      await this.addLineItem();
    }
    await this.fillJustification(options.justification || prDefaults.justification);
    if (!options.skipBilling && (options.vendorSelection || 'scm') === 'scm') {
      await this.fillBillingIfVisible();
    }
    return title;
  }

  async saveDraft(): Promise<void> {
    await this.saveDraftBtn.click();
  }

  async submitPr(): Promise<void> {
    await this.submitBtn.click();
  }

  async resubmit(): Promise<void> {
    await this.resubmitBtn.click();
  }

  async expectValidation(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
  }

  async expectDraftSaved(): Promise<void> {
    await expect(
      this.page
        .getByText(/saved\. you can continue|draft saved|saved as draft|draft auto-saved|pr number/i)
        .or(this.page.getByText(/PR-[A-Z0-9-]+/i))
        .first()
    ).toBeVisible({ timeout: 45_000 });
  }

  async expectSubmitted(): Promise<void> {
    await expect(
      this.page.getByText(/submitted|pending.*approval|has been submitted/i).first()
    ).toBeVisible({ timeout: 45_000 });
  }

  async getDisplayedPrNumber(): Promise<string | null> {
    const el = this.page.getByText(/PR-[A-Z0-9-]+/i).first();
    if (await el.isVisible().catch(() => false)) {
      return (await el.innerText()).match(/PR-[A-Z0-9-]+/i)?.[0] || null;
    }
    return null;
  }

  async removeFirstLineItem(): Promise<void> {
    const remove = this.page.getByRole('button', { name: /remove|delete/i }).first();
    await remove.click();
  }

  async attachFile(filePath: string): Promise<void> {
    const input = this.page.locator('input[type="file"]').first();
    await input.setInputFiles(filePath);
  }

  async expectFormLocked(): Promise<void> {
    await expect(this.saveDraftBtn).toBeDisabled({ timeout: 10_000 }).catch(async () => {
      await expect(this.page.getByText(/cannot be edited|locked|read-only/i).first()).toBeVisible();
    });
  }

  navCreatePrLink(): Locator {
    return this.page.getByRole('link', { name: /^create pr$/i });
  }
}
