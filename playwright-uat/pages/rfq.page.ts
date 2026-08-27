import { Page, expect } from '@playwright/test';

/** Requester RFQ /admin paths: /requester/rfq-entry ; SCM: /scm/rfq-entry */
export class RfqPage {
  constructor(private readonly page: Page) {}

  async gotoRequesterRfq(): Promise<void> {
    await this.page.goto('/requester/rfq-entry');
    await expect(
      this.page.getByRole('heading', { name: /rfq/i }).or(this.page.getByText(/rfq entry|vendor/i).first())
    ).toBeVisible({ timeout: 30_000 });
  }

  async gotoScmRfq(): Promise<void> {
    await this.page.goto('/scm/rfq-entry');
    await expect(
      this.page.getByRole('heading', { name: /rfq/i }).or(this.page.getByText(/rfq entry|purchase request/i).first())
    ).toBeVisible({ timeout: 30_000 });
  }

  async openPr(prNumberOrTitle: string): Promise<void> {
    const row = this.page.getByText(prNumberOrTitle, { exact: false }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
  }

  async inviteOrAddVendor(search: string): Promise<void> {
    const add = this.page.getByRole('button', { name: /add vendor|invite vendor|select vendor/i }).first();
    if (await add.isVisible().catch(() => false)) await add.click();
    const input = this.page.getByPlaceholder(/vendor|search/i).first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(search);
      await this.page.waitForTimeout(500);
      const opt = this.page.locator('button, [role="option"], li').filter({ hasText: new RegExp(search, 'i') }).first();
      if (await opt.isVisible().catch(() => false)) await opt.click();
    }
  }

  async enterQuoteAmount(amount: string, index = 0): Promise<void> {
    const inputs = this.page.locator('input[type="number"], input').filter({ has: this.page.locator('xpath=self::*') });
    const amountField = this.page.getByLabel(/quote|amount|price/i).nth(index);
    if (await amountField.count()) {
      await amountField.fill(amount);
      return;
    }
    const fallback = this.page.locator('input').filter({ hasNot: this.page.locator('[type="file"]') }).nth(index);
    await fallback.fill(amount);
    void inputs;
  }

  async uploadQuotation(filePath: string): Promise<void> {
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
  }

  async finalizeOrRecommend(): Promise<void> {
    const btn = this.page.getByRole('button', {
      name: /finalize|recommend|submit rfq|submit recommendation|complete rfq/i,
    }).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    // Confirm zero quote if prompted
    const confirm = this.page.getByRole('button', { name: /confirm|yes|proceed/i }).first();
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
    await expect(this.page.getByText(/submitted|finalized|recommended|success/i).first()).toBeVisible({
      timeout: 45_000,
    });
  }

  async nextRoundOrSendBack(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /next round|new round|send back/i }).first();
    await btn.click();
  }
}
