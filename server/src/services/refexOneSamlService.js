import zlib from 'zlib';
import { promisify } from 'util';

const inflateRaw = promisify(zlib.inflateRaw);
const inflate = promisify(zlib.inflate);

function appUrl(path = '') {
  const base = (process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function apiUrl(path = '') {
  const port = process.env.PORT || 5000;
  // Prefer explicit API public URL. For local SSO, APP_URL (Vite :3000) can proxy /api.
  const base = (
    process.env.API_PUBLIC_URL ||
    process.env.APP_URL ||
    `http://localhost:${port}`
  ).replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getRefexOneSamlConfig() {
  const entityId = process.env.REFEXONE_SAML_ENTITY_ID || `${appUrl()}/auth/refexone/saml`;
  const acsUrl = process.env.REFEXONE_SAML_ACS_URL || apiUrl('/api/auth/refexone/saml/acs');
  const launchUrl = appUrl('/auth/refexone/launch');
  const homeUrl = launchUrl;
  return {
    entityId,
    acsUrl,
    homeUrl,
    launchUrl,
    appUrl: appUrl(),
    refexoneUrl: (process.env.REFEXONE_WEB_URL || 'https://refexone.com').replace(/\/$/, ''),
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
