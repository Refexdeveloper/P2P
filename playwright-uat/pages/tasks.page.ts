import { Locator, Page, expect } from '@playwright/test';

/** My Tasks / Approvals — /tasks */
export class TasksPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/tasks');
    await expect(
      this.page.getByRole('heading', { name: /tasks|approvals|my tasks/i }).or(
        this.page.getByText(/pending/i).first()
      )
    ).toBeVisible({ timeout: 30_000 });
  }

  async openTaskByPr(prNumberOrTitle: string): Promise<void> {
    await this.goto();
    const card = this.page.getByText(prNumberOrTitle, { exact: false }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.click();
  }

  async clickApprove(): Promise<void> {
    await this.page.getByRole('button', { name: /^approve$|approve \(vendor|sign & approve/i }).first().click();
  }

  async clickSendBack(): Promise<void> {
    await this.page.getByRole('button', { name: /send back/i }).first().click();
  }

  async clickReject(): Promise<void> {
    await this.page.getByRole('button', { name: /^reject$/i }).first().click();
  }

  async confirmApprove(remarks = 'UAT approve', businessYes?: boolean): Promise<void> {
    await this.clickApprove();
    const dialog = this.page.getByRole('dialog').or(this.page.locator('div').filter({ hasText: /approve purchase request/i }).first());
    await expect(this.page.getByText(/approve purchase request|confirm approve/i).first()).toBeVisible();

    if (businessYes !== undefined) {
      const yes = this.page.getByRole('button', { name: /^yes$/i }).or(
        this.page.getByText(/yes.*business|send to business/i)
      );
      const no = this.page.getByRole('button', { name: /^no$/i }).or(
        this.page.getByText(/no.*scm|skip business/i)
      );
      if (businessYes) {
        if (await yes.first().isVisible().catch(() => false)) await yes.first().click();
      } else if (await no.first().isVisible().catch(() => false)) {
        await no.first().click();
      }
    }

    const remarksBox = this.page.locator('textarea').first();
    if (await remarksBox.isVisible().catch(() => false)) {
      await remarksBox.fill(remarks);
    }
    await this.page.getByRole('button', { name: /confirm approve/i }).click();
    await expect(this.page.getByText(/approved|success/i).first()).toBeVisible({ timeout: 30_000 });
    void dialog;
  }

  async confirmSendBack(remarks = 'UAT send back'): Promise<void> {
    await this.clickSendBack();
    await expect(this.page.getByText(/send back for rework|confirm send back/i).first()).toBeVisible();
    const remarksBox = this.page.locator('textarea').first();
    await remarksBox.fill(remarks);
    await this.page.getByRole('button', { name: /confirm send back/i }).click();
    await expect(this.page.getByText(/sent back|returned|success/i).first()).toBeVisible({
      timeout: 30_000,
    });
  }

  async confirmReject(remarks = 'UAT reject'): Promise<void> {
    await this.clickReject();
    await expect(this.page.getByText(/reject purchase request|confirm reject/i).first()).toBeVisible();
    await this.page.locator('textarea').first().fill(remarks);
    await this.page.getByRole('button', { name: /confirm reject/i }).click();
    await expect(this.page.getByText(/rejected|success/i).first()).toBeVisible({ timeout: 30_000 });
  }

  async expectNoApproveFor(prText: string): Promise<void> {
    await this.goto();
    const card = this.page.locator('div, tr, article').filter({ hasText: prText });
    if (await card.count()) {
      await expect(card.getByRole('button', { name: /^approve$/i })).toHaveCount(0);
    }
  }

  taskCard(prText: string): Locator {
    return this.page.locator('div, tr, article').filter({ hasText: prText }).first();
  }
}
