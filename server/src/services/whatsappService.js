/**
 * Unfyd Meta WhatsApp HSM (template) sender.
 * Template: workflow_all_application (6 body text params).
 *
 * Meta rejects / silently drops templates when body variables contain
 * newlines, tabs, 4+ spaces, or (often) non-public / localhost URLs.
 */

const DEFAULT_API_URL = 'https://whatsapp.unfyd.com/unfyd-meta-api/api/v1/hsm/send';
const DEFAULT_TEMPLATE = 'workflow_all_application';
const DEFAULT_LANG = 'en_US';
const LIVE_APP_URL = 'https://p2p-backend-645830234926.asia-south1.run.app';

function isEnabled() {
  return process.env.WHATSAPP_ENABLED !== 'false';
}

function getConfig() {
  return {
    apiUrl: (process.env.WHATSAPP_API_URL || DEFAULT_API_URL).trim(),
    appKey: (process.env.WHATSAPP_APP_KEY || '').trim(),
    appSecret: (process.env.WHATSAPP_APP_SECRET || '').trim(),
    templateName: (process.env.WHATSAPP_TEMPLATE_NAME || DEFAULT_TEMPLATE).trim(),
    languageCode: (process.env.WHATSAPP_TEMPLATE_LANG || DEFAULT_LANG).trim(),
  };
}

/** Public HTTPS base for WhatsApp action links (never localhost). */
export function getWhatsAppPublicBaseUrl() {
  const candidates = [
    process.env.WHATSAPP_APP_URL,
    process.env.API_PUBLIC_URL,
    process.env.APP_URL,
    LIVE_APP_URL,
  ];
  for (const raw of candidates) {
    const u = String(raw || '').trim().replace(/\/$/, '');
    if (!u) continue;
    if (/^https:\/\//i.test(u) && !/localhost|127\.0\.0\.1/i.test(u)) return u;
  }
  return LIVE_APP_URL;
}

/** Normalize to digits with country code (default India 91). */
export function normalizeWhatsAppTo(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  // Strip leading + already removed; ensure not starting with 00
  if (digits.startsWith('00')) digits = digits.slice(2);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

function getDefaultNotifyPhones() {
  const raw =
    process.env.WHATSAPP_NOTIFY_PHONES ||
    process.env.WHATSAPP_DEFAULT_TO ||
    '';
  return [
    ...new Set(
      raw
        .split(',')
        .map((p) => normalizeWhatsAppTo(p))
        .filter(Boolean)
    ),
  ];
}

/**
 * Meta template variable rules:
 * - no newlines / tabs
 * - no more than 4 consecutive spaces
 * - keep short; avoid formatting markers that break rendering
 */
export function sanitizeWhatsAppText(value, max = 120) {
  let s = String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u2013\u2014\u2212]/g, '-') // en/em dashes → hyphen
    .replace(/[\u2026]/g, '...') // ellipsis
    .replace(/[*_~`#<>{}[\]]/g, ' ')
    .replace(/ {5,}/g, '    ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!s) s = '-';
  if (s.length > max) s = `${s.slice(0, Math.max(1, max - 3))}...`;
  return s;
}

function rewriteLocalUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return `${getWhatsAppPublicBaseUrl()}/tasks`;
  if (!/localhost|127\.0\.0\.1/i.test(raw)) {
    if (/^https:\/\//i.test(raw)) return raw;
    if (raw.startsWith('/')) return `${getWhatsAppPublicBaseUrl()}${raw}`;
    return sanitizeWhatsAppText(raw, 200);
  }
  try {
    const u = new URL(raw);
    return `${getWhatsAppPublicBaseUrl()}${u.pathname}${u.search || ''}`;
  } catch {
    return getWhatsAppPublicBaseUrl();
  }
}

/**
 * @param {object} opts
 * @param {string} opts.to - phone with country code
 * @param {string[]} opts.parameters - exactly 6 body text values
 */
export async function sendWhatsAppHsm({ to, parameters }) {
  if (!isEnabled()) {
    console.log('WhatsApp skipped (WHATSAPP_ENABLED=false)');
    return null;
  }

  const { apiUrl, appKey, appSecret, templateName, languageCode } = getConfig();
  if (!appKey || !appSecret) {
    console.warn('WhatsApp skipped: WHATSAPP_APP_KEY / WHATSAPP_APP_SECRET not set');
    return null;
  }

  const phone = normalizeWhatsAppTo(to);
  if (!phone) throw new Error(`Invalid WhatsApp recipient: ${to}`);

  const params = (parameters || []).slice(0, 6).map((t, i) => {
    // 5th body param is usually the action URL
    if (i === 4) return sanitizeWhatsAppText(rewriteLocalUrl(t), 200);
    return sanitizeWhatsAppText(t, i === 2 ? 80 : 60);
  });
  while (params.length < 6) params.push('-');

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        {
          type: 'body',
          parameters: params.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  console.log(
    `WhatsApp HSM → ${phone} template=${templateName} params=`,
    JSON.stringify(params)
  );

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-app-key': appKey,
      'X-App-Secret': appSecret,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }

  if (!response.ok) {
    const detail = json ? JSON.stringify(json) : text || response.statusText;
    throw new Error(`WhatsApp API ${response.status}: ${detail}`);
  }

  const wamid = json?.messages?.[0]?.id || null;
  const waId = json?.contacts?.[0]?.wa_id || phone;
  if (!wamid) {
    console.warn('WhatsApp API 200 but no message id — delivery uncertain:', text.slice(0, 500));
  } else {
    console.log(`WhatsApp HSM accepted wamid=${wamid} wa_id=${waId}`);
  }
  return json || { ok: true, to: phone };
}

/** Fire-and-forget queue (does not block API). */
let waQueue = Promise.resolve();
function enqueueWhatsApp(job) {
  const run = waQueue.then(() => job());
  waQueue = run.catch(() => {});
  return run;
}

/** Dedupe rapid duplicate HSMs to same phone+doc (PR raised + approval both firing). */
const recentKeys = new Map();
const DEDUPE_MS = 45_000;

function shouldSkipDuplicate(phone, documentNumber, stage) {
  const key = `${phone}|${documentNumber}`;
  const now = Date.now();
  for (const [k, ts] of recentKeys) {
    if (now - ts > DEDUPE_MS) recentKeys.delete(k);
  }
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) {
    console.log(`WhatsApp deduped (already sent recently): ${key} stage=${stage}`);
    return true;
  }
  recentKeys.set(key, now);
  return false;
}

export function queueWhatsAppHsm(payload) {
  enqueueWhatsApp(async () => {
    // Small gap so Unfyd/Meta aren't hammered with back-to-back HSMs
    await new Promise((r) => setTimeout(r, 400));
    return sendWhatsAppHsm(payload);
  }).catch((err) => {
    console.error('WhatsApp send failure:', err.message);
  });
}

/**
 * Resolve WhatsApp phones for assigned users (by email).
 * Priority: users.phone → RefexOne mobile/work_mobile (cached to users.phone) → optional ops CC.
 * Does NOT spam the default notify number unless assignee has no phone and fallback is enabled.
 */
export async function resolvePhonesForEmails(pool, emails = [], options = {}) {
  const {
    includeOpsCc = process.env.WHATSAPP_CC_OPS === 'true',
    fallbackToDefault = true,
  } = options;

  const phones = new Set();
  const list = [
    ...new Set((emails || []).map((e) => String(e || '').toLowerCase().trim()).filter(Boolean)),
  ];

  if (pool && list.length) {
    let rows = [];
    try {
      const [dbRows] = await pool.query(
        `SELECT id, email, phone FROM users WHERE LOWER(email) IN (${list.map(() => '?').join(',')})`,
        list
      );
      rows = dbRows;
    } catch (err) {
      if (!/Unknown column|phone/i.test(err.message || '')) {
        console.warn('WhatsApp phone lookup failed:', err.message);
      }
    }

    const byEmail = new Map(rows.map((r) => [String(r.email || '').toLowerCase(), r]));

    for (const email of list) {
      const row = byEmail.get(email);
      let phone = normalizeWhatsAppTo(row?.phone);

      if (!phone) {
        phone = await resolvePhoneFromRefexOne(email);
        if (phone && row?.id && pool) {
          try {
            await pool.query(`UPDATE users SET phone = ? WHERE id = ?`, [phone, row.id]);
          } catch {
            /* phone column may be missing */
          }
        }
      }

      if (phone) phones.add(phone);
      else console.warn(`WhatsApp: no mobile found for assignee ${email}`);
    }
  }

  if (includeOpsCc) {
    for (const p of getDefaultNotifyPhones()) phones.add(p);
  }

  if (!phones.size && fallbackToDefault) {
    for (const p of getDefaultNotifyPhones()) phones.add(p);
  }

  return [...phones];
}

async function resolvePhoneFromRefexOne(email) {
  try {
    const { getRefexOneUserByEmail } = await import('./refexOneService.js');
    const user = await getRefexOneUserByEmail(email);
    if (!user) return null;
    const raw =
      user.work_mobile ||
      user.mobile ||
      user.employee_mobile ||
      user.phone ||
      user.phone_number ||
      '';
    return normalizeWhatsAppTo(raw);
  } catch (err) {
    console.warn(`WhatsApp RefexOne phone lookup failed for ${email}:`, err.message);
    return null;
  }
}

/**
 * Workflow notification → template body:
 * 1 app, 2 doc#, 3 title, 4 stage/action, 5 link, 6 requester/extra
 */
export function buildWorkflowWhatsAppParams({
  appName = 'P2P',
  documentNumber,
  title,
  stage,
  actionUrl,
  requesterName,
}) {
  return [
    sanitizeWhatsAppText(appName, 40),
    sanitizeWhatsAppText(documentNumber, 40),
    sanitizeWhatsAppText(title, 80),
    sanitizeWhatsAppText(stage, 80),
    sanitizeWhatsAppText(rewriteLocalUrl(actionUrl), 200),
    sanitizeWhatsAppText(requesterName, 60),
  ];
}

export function queueWorkflowWhatsApp({ toPhones, parameters, documentNumber, stage }) {
  const phones = [...new Set((toPhones || []).map(normalizeWhatsAppTo).filter(Boolean))];
  if (!phones.length) {
    console.warn('WhatsApp skipped: no recipient phones');
    return;
  }
  const doc = documentNumber || parameters?.[1] || '-';
  for (const to of phones) {
    if (shouldSkipDuplicate(to, doc, stage || parameters?.[3])) continue;
    queueWhatsAppHsm({ to, parameters });
  }
}

export { getDefaultNotifyPhones };
