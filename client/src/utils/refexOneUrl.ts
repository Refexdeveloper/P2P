/** RefexOne portal */
export const DEFAULT_REFEXONE_URL = 'https://refexone.com';

/** Live P2P app (RelayState after SSO). */
export const DEFAULT_P2P_APP_URL = 'https://p2p-backend-rmc-business-645830234926.asia-south1.run.app';

/** RefexOne SAML App ID for RMC Business — set in code, not env */
export const DEFAULT_REFEXONE_SAML_APP_ID = '0f71f9c3-751e-4004-bb9c-a3f6f007c420';

export function getRefexOneUrl(): string {
  return DEFAULT_REFEXONE_URL;
}

export type RefexOneSsoConfig = {
  ssoUrl?: string | null;
  samlAppId?: string | null;
  refexoneUrl?: string;
  saml?: { appId?: string | null; ssoUrl?: string | null };
};

function publicP2pOrigin(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : DEFAULT_P2P_APP_URL;
  if (/localhost|127\.0\.0\.1/i.test(origin)) return DEFAULT_P2P_APP_URL;
  return origin.replace(/\/$/, '');
}

/** Safe return URL after SSO (never /login — that would loop). */
export function getSamlReturnUrl(redirectPath?: string): string {
  const origin = publicP2pOrigin();
  const raw = String(redirectPath || '').trim();
  if (!raw || raw.startsWith('http')) {
    if (raw.startsWith('http')) {
      try {
        const u = new URL(raw);
        const allowed =
          u.origin === origin ||
          u.origin === DEFAULT_P2P_APP_URL ||
          u.origin === (typeof window !== 'undefined' ? window.location.origin : '');
        if (allowed && u.pathname !== '/login' && u.pathname !== '/admin/login') {
          if (/localhost|127\.0\.0\.1/i.test(u.hostname)) {
            return `${DEFAULT_P2P_APP_URL}${u.pathname}${u.search}${u.hash}`;
          }
          return u.toString();
        }
      } catch {
        /* fall through */
      }
    }
    return `${origin}/`;
  }
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path === '/login' || path === '/admin/login' || path.startsWith('/auth/refexone')) {
    return `${origin}/`;
  }
  return `${origin}${path}`;
}

/**
 * https://refexone.com/api/saml/{APP_ID}/sso?RelayState={return_url}
 */
export function buildRefexOneSamlSsoUrl(
  _cfg: RefexOneSsoConfig | null | undefined,
  returnUrl: string
): string {
  const web = DEFAULT_REFEXONE_URL.replace(/\/$/, '');
  const appId = DEFAULT_REFEXONE_SAML_APP_ID;
  return `${web}/api/saml/${encodeURIComponent(appId)}/sso?RelayState=${encodeURIComponent(returnUrl)}`;
}

/** Unauthenticated redirect: start SSO on THIS RMC host (never the old p2p-backend). */
export function getUnauthenticatedSsoUrl(returnPath?: string): string {
  const returnUrl = getSamlReturnUrl(returnPath);
  const origin = publicP2pOrigin();
  return `${origin}/api/auth/refexone/sso?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** Full-page navigate to RefexOne portal (logout). */
export function goToRefexOne(): void {
  window.location.replace(getRefexOneUrl());
}

/** Full-page navigate to RefexOne SAML SSO (login). */
export function goToRefexOneSamlSso(url?: string): void {
  window.location.replace(url || getUnauthenticatedSsoUrl());
}
