import { Page, expect } from '@playwright/test';

/** Create PO — /scm/create-po ; PO Approval — /scm/po-approval */
export class CreatePoPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/scm/create-po');
    await expect(this.page.getByRole('heading', { name: /create po/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  async openEligiblePr(prNumberOrTitle: string): Promise<void> {
    await this.goto();
    await this.page.getByText(prNumberOrTitle, { exact: false }).first().click();
  }

  async createOrSendPo(): Promise<void> {
    const btn = this.page.getByRole('button', {
      name: /create po|send for approval|create po only|send$/i,
    }).first();
    await expect(btn).toBeVisible({ timeout: 20_000 });
    await btn.click();
    await expect(this.page.getByText(/created|sent|success|po-/i).first()).toBeVisible({
      timeout: 60_000,
    });
  }

  async gotoPoApproval(): Promise<void> {
    await this.page.goto('/scm/po-approval');
    await expect(
      this.page.getByRole('heading', { name: /po approval|sign/i }).or(
        this.page.getByText(/pending|purchase order/i).first()
      )
    ).toBeVisible({ timeout: 30_000 });
  }

  async signApprove(prOrPo: string): Promise<void> {
    await this.gotoPoApproval();
    await this.page.getByText(prOrPo, { exact: false }).first().click();
    await this.page.getByRole('button', { name: /sign|approve/i }).first().click();
    const ta = this.page.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) await ta.fill('UAT PO sign');
    await this.page.getByRole('button', { name: /confirm|sign|approve/i }).last().click();
  }

  async sendBackPo(remarks = 'UAT PO send back'): Promise<void> {
    await this.page.getByRole('button', { name: /send back/i }).first().click();
    await this.page.locator('textarea').first().fill(remarks);
    await this.page.getByRole('button', { name: /confirm/i }).first().click();
  }
}
