/** RefexOne portal — used for login / logout redirects */
export const DEFAULT_REFEXONE_URL = 'https://refexone.com';

export function getRefexOneUrl(): string {
  const fromEnv = String(import.meta.env.VITE_REFEXONE_WEB_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return DEFAULT_REFEXONE_URL;
}

/** Full-page navigate to RefexOne (login / logout). */
export function goToRefexOne(): void {
  window.location.replace(getRefexOneUrl());
}
