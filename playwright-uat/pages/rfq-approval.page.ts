import { Page, expect } from '@playwright/test';

/** Post-RFQ vendor final approval — /rfq-approval */
export class RfqApprovalPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/rfq-approval');
    await expect(
      this.page.getByRole('heading', { name: /rfq approval|vendor/i }).or(
        this.page.getByText(/rfq approval|pending/i).first()
      )
    ).toBeVisible({ timeout: 30_000 });
  }

  async openPr(prNumberOrTitle: string): Promise<void> {
    await this.page.getByText(prNumberOrTitle, { exact: false }).first().click();
  }

  async approve(remarks = 'UAT RFQ vendor approve'): Promise<void> {
    await this.page.getByRole('button', { name: /approve/i }).first().click();
    const ta = this.page.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) await ta.fill(remarks);
    const confirm = this.page.getByRole('button', { name: /confirm|approve/i }).last();
    await confirm.click();
    await expect(this.page.getByText(/approved|success/i).first()).toBeVisible({ timeout: 30_000 });
  }

  async sendBack(remarks = 'UAT RFQ send back', targetHint?: string | RegExp): Promise<void> {
    await this.page.getByRole('button', { name: /send back/i }).first().click();
    await expect(this.page.getByText(/send back/i).first()).toBeVisible();
    if (targetHint) {
      const select = this.page.locator('select').first();
      if (await select.isVisible().catch(() => false)) {
        const options = await select.locator('option').allTextContents();
        const match = options.find((o) =>
          typeof targetHint === 'string' ? o.toLowerCase().includes(targetHint.toLowerCase()) : targetHint.test(o)
        );
        if (match) await select.selectOption({ label: match });
      }
    }
    await this.page.locator('textarea').first().fill(remarks);
    await this.page.getByRole('button', { name: /confirm send back|confirm/i }).first().click();
    await expect(this.page.getByText(/sent back|returned|success/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  async reject(remarks = 'UAT RFQ reject'): Promise<void> {
    await this.page.getByRole('button', { name: /reject/i }).first().click();
    await this.page.locator('textarea').first().fill(remarks);
    await this.page.getByRole('button', { name: /confirm reject|confirm/i }).first().click();
  }
}
