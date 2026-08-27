import { APIRequestContext, expect, Page, Browser } from '@playwright/test';

export function apiBase(): string {
  return (process.env.API_URL || process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
}

export function appBase(): string {
  return (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
}

export type LoginResult = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    navigation?: string[];
  };
};

/** Local email/password login via API (same as /admin/login). Does not bypass MFA/SSO. */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<LoginResult> {
  const res = await request.post(`${apiBase()}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(
      `API login failed for ${email}: HTTP ${res.status()} — ${body?.message || body?.error || JSON.stringify(body)}`
    );
  }
  if (!body?.token || !body?.user) {
    throw new Error(`API login response missing token/user for ${email}`);
  }
  return { token: body.token, user: body.user };
}

/**
 * Prefer UI admin login so AuthContext persists session the same way as a real user.
 * Falls back to API + localStorage inject if the form is unavailable.
 */
export async function injectSession(page: Page, login: LoginResult): Promise<void> {
  const base = appBase();
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('p2p_token', token);
      localStorage.setItem('p2p_user', JSON.stringify(user));
    },
    { token: login.token, user: login.user }
  );
  await page.goto(base + '/requester/dashboard', { waitUntil: 'domcontentloaded' });
  // If still bounced to RefexOne, session inject failed
  if (page.url().includes('refexone.com')) {
    throw new Error('Session inject redirected to RefexOne — token not accepted by /api/auth/me');
  }
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  // Guard against accidental SSO bounce
  if (page.url().includes('refexone.com')) {
    throw new Error('Unexpected redirect to RefexOne while opening /admin/login');
  }
  await expect(page.locator('#admin-email')).toBeVisible({ timeout: 20_000 });
  await page.locator('#admin-email').fill(email);
  await page.locator('#admin-password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 45_000 });
  if (page.url().includes('refexone.com')) {
    throw new Error('Login redirected to RefexOne after Sign in — check credentials / session');
  }
}

export async function authHeaders(token: string): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function assertEq(actual: unknown, expected: unknown, label: string): void {
  expect(actual, `Expected: ${label} = ${JSON.stringify(expected)}; Actual: ${JSON.stringify(actual)}`).toEqual(
    expected
  );
}

/** Persist storage state using real /admin/login UI (most reliable for this app). */
export async function saveRoleStorage(
  browser: Browser,
  email: string,
  password: string,
  storagePath: string
): Promise<LoginResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Verify credentials via API first (clear error messages)
    const login = await apiLogin(page.request, email, password);
    await loginViaUi(page, email, password);
    // Confirm token present on app origin
    const token = await page.evaluate(() => localStorage.getItem('p2p_token'));
    if (!token) {
      throw new Error(`No p2p_token in localStorage after UI login for ${email}`);
    }
    await context.storageState({ path: storagePath });
    return login;
  } finally {
    await context.close();
  }
}
