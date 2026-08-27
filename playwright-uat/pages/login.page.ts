import { Page, expect } from '@playwright/test';

/**
 * Local login at /admin/login (email/password).
 * Main /login uses RefexOne SSO — not automated here (MFA/SSO must stay intact).
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/admin/login');
    await expect(this.page.getByRole('heading', { name: /admin login/i })).toBeVisible();
  }

  async login(email: string, password: string): Promise<void> {
    await this.goto();
    await this.page.locator('#admin-email').fill(email);
    await this.page.locator('#admin-password').fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
    await expect(this.page).not.toHaveURL(/\/admin\/login/, { timeout: 45_000 });
  }

  async expectLoginError(message?: string | RegExp): Promise<void> {
    const alert = this.page.locator('.bg-red-50, [role="alert"]').filter({ hasText: /.+/ });
    await expect(alert.first()).toBeVisible();
    if (message) await expect(alert.first()).toContainText(message);
  }
}
