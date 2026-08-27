import { Page, expect } from '@playwright/test';

/** Admin surfaces: user permissions, email logs */
export class AdminPage {
  constructor(private readonly page: Page) {}

  async gotoUserPermissions(): Promise<void> {
    await this.page.goto('/admin/user-permissions');
    await expect(this.page.getByRole('heading', { name: /user permissions/i })).toBeVisible({
      timeout: 30_000,
    });
  }

  async gotoEmailLogs(): Promise<void> {
    await this.page.goto('/admin/email-logs');
    await expect(this.page.getByText(/email/i).first()).toBeVisible({ timeout: 30_000 });
  }

  async selectUserByEmailOrName(text: string): Promise<void> {
    await this.page.getByText(text, { exact: false }).first().click();
  }

  async expectPermissionCheckbox(label: string | RegExp): Promise<void> {
    await expect(this.page.getByText(label).first()).toBeVisible();
  }

  async savePermissionsIfDirty(): Promise<void> {
    const save = this.page.getByRole('button', { name: /save/i }).first();
    if (await save.isEnabled().catch(() => false)) {
      await save.click();
      await expect(this.page.getByText(/updated|success/i).first()).toBeVisible({ timeout: 20_000 });
    }
  }

  async expectCreatePrMenuVisible(visible: boolean): Promise<void> {
    const link = this.page.getByRole('link', { name: /^create pr$/i });
    if (visible) await expect(link).toBeVisible();
    else await expect(link).toHaveCount(0);
  }
}
