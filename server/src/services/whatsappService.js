/**
 * Unfyd Meta WhatsApp HSM (template) sender.
 * Template: workflow_all_application (6 body text params).
 *
 * Meta rejects / silently drops templates when body variables contain
 * newlines, tabs, 4+ spaces, or (often) non-public / localhost URLs.
 */

import { createWhatsAppLog, updateWhatsAppLog } from './whatsappLogService.js';

/**
 * Outbound WhatsApp master switch.
 * Default ON. Set WHATSAPP_SEND_ENABLED=false (or WHATSAPP_ENABLED=false) to disable.
 */
const WHATSAPP_SEND_ENABLED = process.env.WHATSAPP_SEND_ENABLED !== 'false';

const DEFAULT_API_URL = 'https://whatsapp.unfyd.com/unfyd-meta-api/api/v1/hsm/send';
const DEFAULT_TEMPLATE = 'workflow_all_application';
const DEFAULT_LANG = 'en_US';
const LIVE_APP_URL = 'https://p2p-backend-645830234926.asia-south1.run.app';

function isEnabled() {
  // --- WHATSAPP SEND SERVICE COMMENTED / DISABLED ---
  if (!WHATSAPP_SEND_ENABLED) return false;
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

/** Ops / test notify numbers — default 6382739635 when env not set. */
function getDefaultNotifyPhones() {
  const raw =
    process.env.WHATSAPP_NOTIFY_PHONES ||
    process.env.WHATSAPP_DEFAULT_TO ||
    '6382739635';
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
 * @param {object} [opts.logContext] - admin log fields
 */
export async function sendWhatsAppHsm({ to, parameters, logContext = {} }) {
  const { apiUrl, appKey, appSecret, templateName, languageCode } = getConfig();
  const phone = normalizeWhatsAppTo(to) || String(to || '').trim() || '(none)';
  const stage = logContext.stage || parameters?.[3] || parameters?.[4] || null;
  const baseLog = {
    notifyType: logContext.notifyType || 'workflow',
    prId: logContext.prId || null,
    poId: logContext.poId || null,
    relatedId: logContext.relatedId || null,
    prNumber: logContext.prNumber || parameters?.[2] || parameters?.[1] || null,
    poNumber: logContext.poNumber || null,
    toPhone: phone,
    templateName,
    stage,
    parameters: parameters || null,
    meta: logContext.meta || null,
  };

  // --- WHATSAPP SEND SERVICE COMMENTED / DISABLED ---
  if (!WHATSAPP_SEND_ENABLED) {
    console.log('WhatsApp send skipped (WHATSAPP_SEND_ENABLED=false)');
    await createWhatsAppLog({
      ...baseLog,
      status: 'skipped',
      errorMessage: 'WHATSAPP_SEND_ENABLED=false (send service commented)',
    });
    return null;
  }

  if (!isEnabled()) {
    console.log('WhatsApp skipped (WHATSAPP_ENABLED=false)');
    await createWhatsAppLog({
      ...baseLog,
      status: 'skipped',
      errorMessage: 'WHATSAPP_ENABLED=false',
    });
    return null;
  }

  if (!appKey || !appSecret) {
    console.warn('WhatsApp skipped: WHATSAPP_APP_KEY / WHATSAPP_APP_SECRET not set');
    await createWhatsAppLog({
      ...baseLog,
      status: 'skipped',
      errorMessage: 'WHATSAPP_APP_KEY / WHATSAPP_APP_SECRET not set',
    });
    return null;
  }

  const normalized = normalizeWhatsAppTo(to);
  if (!normalized) {
    await createWhatsAppLog({
      ...baseLog,
      status: 'failed',
      errorMessage: `Invalid WhatsApp recipient: ${to}`,
    });
    throw new Error(`Invalid WhatsApp recipient: ${to}`);
  }
  baseLog.toPhone = normalized;

  const params = (parameters || []).slice(0, 6).map((t, i) => {
    // {{6}} (index 5) is the login / action URL
    if (i === 5) return sanitizeWhatsAppText(rewriteLocalUrl(t), 200);
    // Status / workflow can be a bit longer
    return sanitizeWhatsAppText(t, i === 3 || i === 4 ? 80 : 60);
  });
  while (params.length < 6) params.push('-');
  baseLog.parameters = params;

  const logId = await createWhatsAppLog({
    ...baseLog,
    status: 'queued',
  });

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalized,
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
    `WhatsApp HSM → ${normalized} template=${templateName} params=`,
    JSON.stringify(params)
  );

  try {
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
      const errMsg = `WhatsApp API ${response.status}: ${detail}`;
      await updateWhatsAppLog(logId, { status: 'failed', errorMessage: errMsg });
      throw new Error(errMsg);
    }

    const wamid = json?.messages?.[0]?.id || null;
    const waId = json?.contacts?.[0]?.wa_id || normalized;
    if (!wamid) {
      console.warn('WhatsApp API 200 but no message id — delivery uncertain:', text.slice(0, 500));
      await updateWhatsAppLog(logId, {
        status: 'sent',
        wamid: null,
        errorMessage: 'API 200 but no message id — delivery uncertain',
      });
    } else {
      console.log(`WhatsApp HSM accepted wamid=${wamid} wa_id=${waId}`);
      await updateWhatsAppLog(logId, { status: 'sent', wamid });
    }
    return json || { ok: true, to: normalized };
  } catch (err) {
    if (!String(err.message || '').startsWith('WhatsApp API')) {
      await updateWhatsAppLog(logId, { status: 'failed', errorMessage: err.message });
    }
    throw err;
  }
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
  // Include stage so each approval step (L1 → L2 → CFO…) can notify the same ops phone
  const key = `${phone}|${documentNumber}|${String(stage || '').trim()}`;
  const now = Date.now();
  for (const [k, ts] of recentKeys) {
    if (now - ts > DEDUPE_MS) recentKeys.delete(k);
  }
  const prev = recentKeys.get(key);
  if (prev && now - prev < DEDUPE_MS) {
    console.log(`WhatsApp deduped (already sent recently): ${key}`);
    return true;
  }
  recentKeys.set(key, now);
  return false;
}

export function queueWhatsAppHsm(payload) {
  // --- WHATSAPP SEND SERVICE COMMENTED / DISABLED ---
  if (!WHATSAPP_SEND_ENABLED) {
    console.log('WhatsApp queue skipped (WHATSAPP_SEND_ENABLED=false)');
    return;
  }
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
 * Meta template workflow_all_application body vars:
 * Dear {{1}},
 * Application  : {{2}}
 * Reference ID : {{3}}
 * Status       : {{4}}
 * Workflow     : {{5}}
 * {{6}}  ← login URL
 * Thanks       ← hardcoded in template
 */
export function formatWhatsAppApprovalStatus(stageOrRole) {
  let label = String(stageOrRole || 'Approval').trim();
  if (/rejected|sent back|rework|completed|cancelled/i.test(label)) {
    return label;
  }
  label = label
    .replace(/\s*-\s*Action Required\s*$/i, '')
    .replace(/^Pending\s*-?\s*/i, '')
    .trim();
  if (!label) label = 'Approval';
  if (!/approval$/i.test(label) && /manager|cfo|scm|hod|buyer|approver/i.test(label)) {
    label = `${label} Approval`;
  }
  return `Pending - ${label}`;
}

export function formatWhatsAppWorkflowLabel(stageOrRole) {
  let label = String(stageOrRole || 'Approval').trim();
  label = label
    .replace(/\s*-\s*Action Required\s*$/i, '')
    .replace(/^Pending\s*-?\s*/i, '')
    .trim();
  if (!label) return 'Approval';
  if (!/approval$/i.test(label) && /manager|cfo|scm|hod|buyer|approver/i.test(label)) {
    label = `${label} Approval`;
  }
  return label;
}

export function buildWorkflowWhatsAppParams({
  appName = 'Procure to Pay',
  documentNumber,
  title,
  stage,
  status,
  actionUrl,
  requesterName,
  assigneeName,
  workflowLabel,
}) {
  const dearName = assigneeName || requesterName || 'Approver';
  const statusText =
    status ||
    (stage ? formatWhatsAppApprovalStatus(stage) : 'Pending - Approval');
  const workflow =
    workflowLabel ||
    (stage ? formatWhatsAppWorkflowLabel(stage) : title || 'Approval');

  return [
    sanitizeWhatsAppText(dearName, 60), // {{1}} Dear
    sanitizeWhatsAppText(appName || 'Procure to Pay', 40), // {{2}} Application
    sanitizeWhatsAppText(documentNumber, 40), // {{3}} Reference ID = PR number
    sanitizeWhatsAppText(statusText, 80), // {{4}} Status
    sanitizeWhatsAppText(workflow, 80), // {{5}} Workflow
    sanitizeWhatsAppText(rewriteLocalUrl(actionUrl), 200), // {{6}} URL
  ];
}

export function queueWorkflowWhatsApp({
  toPhones,
  parameters,
  documentNumber,
  stage,
  logContext = {},
}) {
  // --- WHATSAPP SEND SERVICE COMMENTED / DISABLED ---
  if (!WHATSAPP_SEND_ENABLED) {
    console.log('WhatsApp workflow skipped (WHATSAPP_SEND_ENABLED=false)');
    return;
  }

  const phones = [...new Set((toPhones || []).map(normalizeWhatsAppTo).filter(Boolean))];
  const doc = documentNumber || parameters?.[2] || '-';
  const resolvedStage = stage || parameters?.[3] || parameters?.[4] || null;
  const ctx = {
    notifyType: logContext.notifyType || 'workflow',
    prId: logContext.prId || null,
    poId: logContext.poId || null,
    relatedId: logContext.relatedId || null,
    prNumber: logContext.prNumber || doc || null,
    poNumber: logContext.poNumber || null,
    stage: resolvedStage,
    meta: {
      ...(logContext.meta || {}),
      emails: logContext.emails || null,
    },
  };

  if (!phones.length) {
    console.warn('WhatsApp skipped: no recipient phones');
    createWhatsAppLog({
      ...ctx,
      status: 'skipped',
      toPhone: '(none)',
      templateName: getConfig().templateName,
      parameters,
      errorMessage: 'No recipient phones',
    });
    return;
  }

  for (const to of phones) {
    if (shouldSkipDuplicate(to, doc, resolvedStage)) {
      createWhatsAppLog({
        ...ctx,
        status: 'skipped',
        toPhone: to,
        templateName: getConfig().templateName,
        parameters,
        errorMessage: 'Deduped — already sent recently for this phone + document',
      });
      continue;
    }
    queueWhatsAppHsm({ to, parameters, logContext: ctx });
  }
}

export { getDefaultNotifyPhones };
