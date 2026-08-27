import { Page, expect } from '@playwright/test';

/**
 * Notification / email-log helpers.
 * App surfaces: /admin/email-logs (Super Admin).
 */
export async function openEmailLogs(page: Page): Promise<void> {
  await page.goto('/admin/email-logs');
  await expect(page.getByRole('heading', { name: /email/i })).toBeVisible({ timeout: 20_000 });
}

export async function expectEmailLogContains(
  page: Page,
  text: string | RegExp
): Promise<void> {
  await openEmailLogs(page);
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30_000 });
}

export async function clickRetriggerIfPresent(page: Page): Promise<boolean> {
  const btn = page.getByRole('button', { name: /retrigger|retry|resend/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    return true;
  }
  return false;
}
