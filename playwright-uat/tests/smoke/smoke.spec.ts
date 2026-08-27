import { test, expect } from '../../fixtures/auth.fixture';
import { hasCredentials } from '../../test-data/users';
import { apiBase } from '../../utils/test-data';

test.describe('SMOKE — environment readiness', () => {
  test('SMOKE-01 - BASE_URL is reachable', async ({ page }) => {
    const base = process.env.BASE_URL || 'http://localhost:5000';
    const res = await page.request.get(base);
    expect(
      res.status(),
      `Expected: BASE_URL ${base} returns HTTP < 500; Actual: ${res.status()}`
    ).toBeLessThan(500);
  });

  test('SMOKE-02 - API login endpoint exists', async ({ request }) => {
    const res = await request.post(`${apiBase()}/api/auth/login`, {
      data: { email: 'invalid@example.com', password: 'invalid' },
      headers: { 'Content-Type': 'application/json' },
    });
    // Endpoint should respond (401/400), not 404
    expect(
      res.status(),
      `Expected: /api/auth/login exists (not 404); Actual: ${res.status()}`
    ).not.toBe(404);
  });

  test('SMOKE-03 - Admin login page renders', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /admin login/i })).toBeVisible();
    await expect(page.locator('#admin-email')).toBeVisible();
    await expect(page.locator('#admin-password')).toBeVisible();
  });

  test('SMOKE-04 - Requester credentials configured', async () => {
    test.skip(
      !hasCredentials('requester'),
      'REQUESTER_USERNAME / REQUESTER_PASSWORD not set in playwright-uat/.env'
    );
    expect(hasCredentials('requester')).toBeTruthy();
  });
});
