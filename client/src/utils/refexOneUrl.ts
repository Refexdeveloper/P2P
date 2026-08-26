/** RefexOne portal — login / logout entry */
export const DEFAULT_REFEXONE_URL = 'https://refexone.com';

export function getRefexOneUrl(): string {
  const fromEnv = String(import.meta.env.VITE_REFEXONE_WEB_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return DEFAULT_REFEXONE_URL;
}

export type RefexOneSsoConfig = {
  ssoUrl?: string | null;
  samlAppId?: string | null;
  refexoneUrl?: string;
  saml?: { appId?: string | null; ssoUrl?: string | null };
};

function envSamlAppId(): string {
  return String(import.meta.env.VITE_REFEXONE_SAML_APP_ID || '').trim();
}

/** Safe return URL after SSO (never /login — that would loop). */
export function getSamlReturnUrl(redirectPath?: string): string {
  const origin = window.location.origin;
  const raw = String(redirectPath || '').trim();
  if (!raw || raw.startsWith('http')) {
    if (raw.startsWith('http')) {
      try {
        const u = new URL(raw);
        if (u.origin === origin && u.pathname !== '/login' && u.pathname !== '/admin/login') {
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
  cfg: RefexOneSsoConfig | null | undefined,
  returnUrl: string
): string | null {
  const appId = String(cfg?.samlAppId || cfg?.saml?.appId || envSamlAppId() || '').trim();
  const existing = String(cfg?.ssoUrl || cfg?.saml?.ssoUrl || '').trim();
  if (existing) {
    try {
      const url = new URL(existing);
      url.searchParams.set('RelayState', returnUrl);
      return url.toString();
    } catch {
      /* build from app id */
    }
  }
  if (!appId) return null;
  const web = (cfg?.refexoneUrl || getRefexOneUrl()).replace(/\/$/, '');
  return `${web}/api/saml/${encodeURIComponent(appId)}/sso?RelayState=${encodeURIComponent(returnUrl)}`;
}

/** Full-page navigate to RefexOne portal (logout). */
export function goToRefexOne(): void {
  window.location.replace(getRefexOneUrl());
}

/** Full-page navigate to RefexOne SAML SSO (login). */
export function goToRefexOneSamlSso(url: string): void {
  window.location.replace(url);
}
