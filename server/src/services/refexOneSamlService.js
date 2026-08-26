import zlib from 'zlib';
import { promisify } from 'util';

const inflateRaw = promisify(zlib.inflateRaw);
const inflate = promisify(zlib.inflate);

/** Live Cloud Run backend (SPA + API). Override with APP_URL / API_PUBLIC_URL in env. */
const LIVE_APP_URL = 'https://p2p-backend-645830234926.asia-south1.run.app';

function isUsablePublicBase(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed || trimmed === '*') return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  // Cloud Run sets PORT=8080; never advertise localhost ACS to RefexOne there
  if (process.env.K_SERVICE && /localhost|127\.0\.0\.1/i.test(trimmed)) return false;
  return true;
}

function publicBase(...candidates) {
  for (const c of candidates) {
    if (!c) continue;
    const base = String(c).trim().replace(/\/$/, '');
    if (isUsablePublicBase(base)) return base;
  }
  return LIVE_APP_URL;
}

function appUrl(path = '') {
  const safeBase = publicBase(
    process.env.APP_URL,
    process.env.CORS_ORIGIN,
    LIVE_APP_URL
  );
  if (!path) return safeBase;
  return `${safeBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function apiUrl(path = '') {
  const safeBase = publicBase(
    process.env.API_PUBLIC_URL,
    process.env.APP_URL,
    LIVE_APP_URL
  );
  return `${safeBase}${path.startsWith('/') ? path : `/${path}`}`;
}

/** RefexOne SAML — hardcoded in code (not env). */
export const DEFAULT_REFEXONE_WEB_URL = 'https://refexone.com';
export const DEFAULT_REFEXONE_API_URL = 'https://refexone.com/api';
export const DEFAULT_REFEXONE_SAML_APP_ID = 'bcc7387a-613a-4607-ae97-028fbdf5dd3b';

export function getRefexOneSamlAppId() {
  return DEFAULT_REFEXONE_SAML_APP_ID;
}

/**
 * SP-initiated SSO: https://refexone.com/api/saml/{APP_ID}/sso?RelayState={return_url}
 */
export function getRefexOneSamlSsoUrl(relayState) {
  const appId = getRefexOneSamlAppId();
  const apiBase = DEFAULT_REFEXONE_API_URL.replace(/\/$/, '');
  const url = new URL(`${apiBase}/saml/${encodeURIComponent(appId)}/sso`);
  if (relayState) url.searchParams.set('RelayState', String(relayState));
  return url.toString();
}

function mailPublicBase() {
  const candidates = [
    process.env.API_PUBLIC_URL,
    process.env.WHATSAPP_APP_URL,
    process.env.APP_URL,
    LIVE_APP_URL,
  ];
  for (const c of candidates) {
    const base = String(c || '').trim().replace(/\/$/, '');
    if (/^https:\/\//i.test(base) && !/localhost|127\.0\.0\.1/i.test(base)) return base;
  }
  return LIVE_APP_URL;
}

function isVendorFacingUrl(url) {
  return /\/vendor\/submit-quote|\/vendor\/invoice-submit|\/vendor\/quote/i.test(String(url || ''));
}

/**
 * Wrap an internal P2P page URL so email/WhatsApp clicks go through RefexOne SSO,
 * then land on the original approval/reject page (RelayState).
 */
export function wrapPortalUrlWithSso(targetUrl) {
  const raw = String(targetUrl || '').trim();
  if (!raw) return '';
  if (/\/api\/saml\/[^/]+\/sso/i.test(raw)) return raw;
  if (isVendorFacingUrl(raw)) return raw;

  const publicBaseUrl = mailPublicBase();
  let absolute = raw;
  if (raw.startsWith('/')) {
    absolute = `${publicBaseUrl}${raw}`;
  } else {
    try {
      const parsed = new URL(raw);
      if (/localhost|127\.0\.0\.1/i.test(parsed.hostname)) {
        absolute = `${publicBaseUrl}${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      absolute = `${publicBaseUrl}${raw.startsWith('/') ? raw : `/${raw}`}`;
    }
  }

  return getRefexOneSamlSsoUrl(absolute) || absolute;
}

export function resolveSamlRelayState(requested, fallbackAppUrl) {
  const appBase = fallbackAppUrl || appUrl();
  try {
    const target = new URL(String(requested || appBase), appBase);
    if (target.origin !== new URL(appBase).origin) return appBase;
    // Never send the user back to /login (that would loop into SSO)
    const path = target.pathname.replace(/\/$/, '') || '/';
    if (path === '/login' || path === '/admin/login' || path.startsWith('/auth/refexone')) {
      target.pathname = '/';
      target.search = '';
      target.hash = '';
    }
    return target.toString();
  } catch {
    return appBase;
  }
}

export function getRefexOneSamlConfig() {
  const entityId =
    process.env.REFEXONE_SAML_ENTITY_ID || `${appUrl()}/auth/refexone/saml`;
  const acsUrl =
    process.env.REFEXONE_SAML_ACS_URL ||
    apiUrl('/api/auth/refexone/saml/acs');
  const launchUrl = appUrl('/auth/refexone/launch');
  const homeUrl = launchUrl;
  const appBase = appUrl();
  const samlAppId = getRefexOneSamlAppId();
  const ssoUrl = getRefexOneSamlSsoUrl(appBase);
  return {
    entityId,
    acsUrl,
    homeUrl,
    launchUrl,
    appUrl: appBase,
    refexoneUrl: DEFAULT_REFEXONE_WEB_URL,
    samlAppId,
    ssoUrl,
  };
}

async function decodeSamlResponse(samlResponse) {
  if (!samlResponse || typeof samlResponse !== 'string') {
    throw new Error('SAMLResponse is required');
  }

  const raw = Buffer.from(samlResponse.replace(/\s/g, ''), 'base64');
  const attempts = [
    async () => raw.toString('utf8'),
    async () => (await inflateRaw(raw)).toString('utf8'),
    async () => (await inflate(raw)).toString('utf8'),
  ];

  let lastErr;
  for (const attempt of attempts) {
    try {
      const xml = await attempt();
      if (xml.includes('Assertion') || xml.includes('NameID') || xml.includes('Email')) {
        return xml;
      }
    } catch (err) {
      lastErr = err;
    }
  }

  // Last resort: treat as utf8 even if tags look different
  const fallback = raw.toString('utf8');
  if (fallback.includes('<')) return fallback;
  throw lastErr || new Error('Unable to decode SAMLResponse');
}

function extractEmailFromSamlXml(xml) {
  const patterns = [
    /<saml2?:NameID[^>]*>([^<]+)<\/saml2?:NameID>/i,
    /<saml?:NameID[^>]*>([^<]+)<\/saml?:NameID>/i,
    /<NameID[^>]*>([^<]+)<\/NameID>/i,
    /EmailAddress[^>]*>([^<]+)</i,
    /Attribute[^>]*Name="[^"]*email[^"]*"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
    /Attribute[^>]*Name="[^"]*mail[^"]*"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
    /AttributeValue[^>]*>([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})</i,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ];

  for (const re of patterns) {
    const match = xml.match(re);
    if (match?.[1]) {
      const value = match[1].trim().toLowerCase();
      if (value.includes('@')) return value;
    }
  }

  throw new Error('Could not find user email in SAML assertion');
}

function extractNameFromSamlXml(xml, fallbackEmail) {
  const patterns = [
    /Attribute[^>]*Name="[^"]*displayName"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
    /Attribute[^>]*Name="[^"]*name"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
    /Attribute[^>]*FriendlyName="[^"]*displayName"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
    /Attribute[^>]*Name="[^"]*cn"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)/i,
  ];
  for (const re of patterns) {
    const match = xml.match(re);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return fallbackEmail.split('@')[0];
}

/**
 * Parse IdP-initiated SAMLResponse from RefexOne / Kissflow and return profile.
 * Signature validation can be enabled later via REFEXONE_SAML_CERT.
 */
export async function parseRefexOneSamlResponse(samlResponse) {
  const xml = await decodeSamlResponse(samlResponse);
  const email = extractEmailFromSamlXml(xml);
  const name = extractNameFromSamlXml(xml, email);
  return {
    email,
    name,
    refexoneUserId: null,
    accessToken: null,
    rawXmlPreview: xml.slice(0, 200),
  };
}
