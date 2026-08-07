import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { buildPrRaisedEmail } from '../templates/prRaisedEmail.js';
import { buildPrApprovalPendingEmail } from '../templates/prApprovalPendingEmail.js';
import { buildRfqInvitationEmail, buildRfqSendBackEmail } from '../templates/rfqVendorEmail.js';
import { buildRfqSubmittedNotifyRequesterEmail } from '../templates/rfqSubmittedEmail.js';
import { buildPostRfqActionEmail } from '../templates/prPostRfqActionEmail.js';
import { buildPoVendorEmail } from '../templates/poVendorEmail.js';
import { resolveScmBuyerUser } from '../utils/scmAssignee.js';
import { formatRoleDisplayName } from '../templates/emailUtils.js';
import {
  buildWorkflowWhatsAppParams,
  queueWorkflowWhatsApp,
  resolvePhonesForEmails,
  getWhatsAppPublicBaseUrl,
} from './whatsappService.js';

let transporter;
let smtpReady = false;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER?.trim();
  // SMTP_PASSWORD is the required name; SMTP_PASS kept as a deploy fallback
  const pass = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  const secure = process.env.SMTP_SECURE === 'true';

  return { host, port, user, pass, secure };
}

function getTransporter() {
  if (transporter) return transporter;

  const { host, port, user, pass, secure } = getSmtpConfig();

  if (!host || !user || !pass || Number.isNaN(port)) {
    console.warn(
      'SMTP not fully configured (need SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD). Emails will not be delivered.'
    );
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  // Gmail / Google Workspace: port 587 + STARTTLS (secure:false)
  // Pool + rate limit: one connection, avoid parallel handshake storms (slow + rate-limits)
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 8,
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 30_000,
  });

  return transporter;
}

/** Serialize outbound mail so Gmail isn't hit with parallel SMTP sessions. */
let mailQueue = Promise.resolve();
function enqueueMail(job) {
  const run = mailQueue.then(() => job());
  mailQueue = run.catch(() => {});
  return run;
}

/**
 * Verify SMTP connectivity/auth. Safe to call at startup and before sends.
 * @returns {Promise<boolean>}
 */
export async function testSmtpConnection() {
  const { host, port, user, pass } = getSmtpConfig();

  if (!host || !user || !pass || Number.isNaN(port)) {
    console.warn(
      'SMTP connection test skipped: missing SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASSWORD'
    );
    return false;
  }

  try {
    await getTransporter().verify();
    smtpReady = true;
    console.log(`SMTP connection success: ${host}:${port} as ${user}`);
    return true;
  } catch (err) {
    smtpReady = false;
    const code = err.code || err.responseCode || '';
    const isAuthFailure =
      code === 'EAUTH' ||
      code === 535 ||
      /auth|credential|login|password/i.test(err.message || '');

    if (isAuthFailure) {
      console.error('SMTP authentication failure:', err.message);
    } else {
      console.error('SMTP connection failure:', err.message);
    }
    return false;
  }
}

async function ensureSmtpReady() {
  if (smtpReady) return true;
  return testSmtpConnection();
}

function getAppBaseUrl() {
  // Emails / WhatsApp must use public HTTPS — never localhost
  return getWhatsAppPublicBaseUrl();
}

function buildWorkflowPortalUrl(pr, assignedRole, options = {}) {
  const base = getAppBaseUrl();
  const prId = pr.id || pr.prId;
  const postRfq = Boolean(options.postRfq);
  const rfqEntry = Boolean(options.rfqEntry);

  if (assignedRole === 'Requester') return `${base}/requester/rfq-entry/${prId}`;
  if (rfqEntry || (assignedRole === 'SCM Buyer' && !postRfq)) {
    return `${base}/scm/rfq-entry/${prId}`;
  }
  if (postRfq) return `${base}/rfq-approval/${prId}`;
  if (assignedRole === 'CFO') return `${base}/cfo/dashboard?prId=${prId}`;
  if (assignedRole === 'PR Manager') return `${base}/tasks?prId=${prId}`;
  return `${base}/tasks?prId=${prId}`;
}

async function notifyWorkflowWhatsApp({
  pr,
  emails = [],
  stage,
  actionUrl,
  requesterName,
}) {
  try {
    const toPhones = await resolvePhonesForEmails(pool, emails, {
      includeOpsCc: process.env.WHATSAPP_CC_OPS === 'true',
      fallbackToDefault: process.env.WHATSAPP_FALLBACK_DEFAULT !== 'false',
    });
    if (!toPhones.length) {
      console.warn(
        `WhatsApp skipped: no phone for assignees [${(emails || []).join(', ')}] on ${pr.prNumber || pr.id}`
      );
      return;
    }
    console.log(
      `WhatsApp assignees ${(emails || []).join(', ') || '(none)'} → ${toPhones.join(', ')}`
    );
    const parameters = buildWorkflowWhatsAppParams({
      appName: 'P2P',
      documentNumber: pr.prNumber || `PR-${pr.id || pr.prId}`,
      title: pr.title || 'Purchase Request',
      stage,
      actionUrl: actionUrl || `${getAppBaseUrl()}/tasks`,
      requesterName: requesterName || pr.requester || 'Requester',
    });
    queueWorkflowWhatsApp({
      toPhones,
      parameters,
      documentNumber: pr.prNumber || `PR-${pr.id || pr.prId}`,
      stage,
    });
  } catch (err) {
    console.error('WhatsApp notify failed:', err.message);
  }
}

function getNotificationRecipients() {
  const configured = process.env.PR_NOTIFY_EMAIL || 'sathishkumar.r@refex.co.in';
  return configured
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function getFromAddress() {
  const { user } = getSmtpConfig();
  const fromEmail =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_FROM_EMAIL?.trim() ||
    user ||
    'support@refexone.com';
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'P2P Procurement';
  return `"${fromName}" <${fromEmail}>`;
}

/** Send a one-off SMTP test message (used by /api/health/smtp/send-test). */
export async function sendTestEmail(to) {
  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Recipient email is required');

  const ok = await ensureSmtpReady();
  if (!ok) {
    throw new Error('SMTP is not connected. Check SMTP_HOST / SMTP_USER / SMTP_PASSWORD.');
  }

  const info = await getTransporter().sendMail({
    from: getFromAddress(),
    to: recipient,
    subject: 'P2P SMTP test',
    text: `P2P SMTP test message sent at ${new Date().toISOString()}`,
    html: `<p>P2P SMTP test message sent at <strong>${new Date().toISOString()}</strong></p>`,
  });

  console.log(`SMTP test email sent to ${recipient} — ${info.messageId}`);
  return info;
}

export async function sendPrRaisedNotification(pr, requester, options = {}) {
  const recipients = getNotificationRecipients();
  if (!recipients.length) {
    console.warn('PR email skipped: no PR_NOTIFY_EMAIL configured');
    return;
  }

  const { subject, html, text } = buildPrRaisedEmail({
    pr,
    requester,
    isResubmit: options.isResubmit || false,
  });

  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    console.log('PR notification email NOT sent (SMTP missing):');
    console.log('  To:', recipients.join(', '));
    console.log('  Subject:', subject);
    return;
  }

  if (!smtpReady) {
    await ensureSmtpReady();
  }

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(', '),
      subject,
      text,
      html,
    });

    console.log(
      `Email sent successfully to ${recipients.join(', ')} — ${info.messageId}`
    );
    return info;
  } catch (err) {
    smtpReady = false;
    console.error('Email send failure:', err.message);
    if (err.response) console.error('SMTP response:', err.response);
    throw err;
  }
}

export function queuePrRaisedNotification(pr, requester, options = {}) {
  enqueueMail(() => sendPrRaisedNotification(pr, requester, options)).catch((err) => {
    console.error('Email send failure (PR raised):', err.message);
    if (err.response) console.error('SMTP response:', err.response);
  });
  // WhatsApp is sent only on approval-pending (action required) to avoid
  // duplicate HSMs that Meta/Unfyd often drop when fired milliseconds apart.
}

async function getApproverRecipients(role, departmentId = null) {
  if (role === 'SCM Buyer') {
    const buyer = await resolveScmBuyerUser();
    return buyer?.email ? [{ email: buyer.email, name: buyer.name }] : [];
  }

  let sql = `SELECT email, name FROM users WHERE role = ? AND is_active = 1`;
  const params = [role];
  if (role === 'HOD Approver' && departmentId) {
    sql += ' AND department_id = ?';
    params.push(departmentId);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function sendMailToRecipients(recipients, subject, html, text, attachments = [], mailOptions = {}) {
  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    console.log('Email NOT sent (SMTP missing):', subject, '→', recipients.join(', '));
    if (attachments?.length) {
      console.log(`  Attachments skipped (${attachments.length}):`, attachments.map((a) => a.filename).join(', '));
    }
    return;
  }

  // Skip verify when already confirmed at startup — verify was a major latency source
  if (!smtpReady) {
    await ensureSmtpReady();
  }
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: getFromAddress(),
      to: recipients.join(', '),
      bcc: mailOptions.bcc?.length ? mailOptions.bcc.join(', ') : undefined,
      subject,
      text,
      html,
      attachments: attachments?.length ? attachments : undefined,
    });
    console.log(`Email sent to ${recipients.join(', ')} — ${info.messageId}`);
    return info;
  } catch (err) {
    smtpReady = false;
    throw err;
  }
}

/** Resolve the particular user assigned on the pending workflow task for this step */
async function resolveAssignedUserForStep(prId, assignedRole) {
  if (!prId || !assignedRole) return { emails: [], name: null };
  const [rows] = await pool.query(
    `SELECT u.email, u.name
     FROM workflow_tasks wt
     JOIN users u ON u.id = wt.assigned_user_id
     WHERE wt.pr_id = ?
       AND wt.assigned_role = ?
       AND wt.status = 'pending'
       AND wt.assigned_user_id IS NOT NULL
     ORDER BY wt.id DESC
     LIMIT 1`,
    [prId, assignedRole]
  );
  if (!rows[0]?.email) return { emails: [], name: null };
  return { emails: [rows[0].email], name: rows[0].name || null };
}

/**
 * Step mail goes to the particular assigned user.
 * - Prefer options.approverEmails (explicit assignee for this step)
 * - Else pending workflow_tasks.assigned_user_id
 * - Else role inbox (CFO / SCM Manager queues without a person)
 * Ops notify list is BCC only (not primary To).
 */
export async function sendPrApprovalPendingNotification(pr, assignedRole, requester, departmentId = null, options = {}) {
  const explicitEmails = (options.approverEmails || [])
    .map((e) => String(e || '').trim())
    .filter(Boolean);

  let emails = [...new Set(explicitEmails)];
  let primaryName = options.approverName || null;

  if (!emails.length) {
    const fromTask = await resolveAssignedUserForStep(pr.id || pr.prId, assignedRole);
    emails = fromTask.emails;
    primaryName = primaryName || fromTask.name;
  }

  if (!emails.length) {
    const approvers = await getApproverRecipients(assignedRole, departmentId);
    emails = [...new Set(approvers.map((a) => a.email).filter(Boolean))];
    primaryName = primaryName || approvers[0]?.name || 'Approver';
  }

  if (!emails.length) {
    console.warn(`No recipients for PR approval email (role: ${assignedRole}, pr: ${pr.prNumber || pr.id})`);
    return;
  }

  primaryName = primaryName || 'Approver';

  // Keep ops copy as BCC so the step owner is the only primary recipient
  const emailSet = new Set(emails.map((e) => e.toLowerCase()));
  const bcc = getNotificationRecipients().filter((e) => e && !emailSet.has(e.toLowerCase()));

  const { subject, html, text } = buildPrApprovalPendingEmail({
    pr,
    requester,
    assignedRole,
    approverName: primaryName,
    postRfq: options.postRfq || false,
    stageLabel: options.stageLabel || null,
    rfqSummary: options.rfqSummary || null,
    rfqEntry: options.rfqEntry || false,
  });

  console.log(
    `Step mail → ${assignedRole} (${primaryName}): ${emails.join(', ')} for ${pr.prNumber || pr.id}`
  );

  return sendMailToRecipients(emails, subject, html, text, options.attachments || [], { bcc });
}

export function queuePrApprovalPendingNotification(pr, assignedRole, requester, departmentId = null, options = {}) {
  enqueueMail(() =>
    sendPrApprovalPendingNotification(pr, assignedRole, requester, departmentId, options)
  ).catch((err) => {
    console.error('Email send failure (PR approval):', err.message);
    if (err.response) console.error('SMTP response:', err.response);
  });

  const emails = [
    ...((options.approverEmails || []).map((e) => String(e || '').trim()).filter(Boolean)),
  ];
  // If assignee emails not passed yet, still try notify with empty → will resolve from task later in send path
  // Prefer only the step assignee for WhatsApp (not ops PR_NOTIFY_EMAIL)
  const stage =
    options.stageLabel ||
    `${formatRoleDisplayName(assignedRole)} - Action Required`;

  // Resolve assignee emails async for WhatsApp (same logic as mail, but WA is fire-and-forget)
  (async () => {
    let assigneeEmails = emails;
    if (!assigneeEmails.length) {
      try {
        const fromTask = await resolveAssignedUserForStep(pr.id || pr.prId, assignedRole);
        assigneeEmails = fromTask.emails || [];
      } catch {
        /* ignore */
      }
    }
    if (!assigneeEmails.length) {
      try {
        const approvers = await getApproverRecipients(assignedRole, departmentId);
        assigneeEmails = approvers.map((a) => a.email).filter(Boolean);
      } catch {
        /* ignore */
      }
    }
    await notifyWorkflowWhatsApp({
      pr,
      emails: assigneeEmails,
      stage,
      actionUrl: buildWorkflowPortalUrl(pr, assignedRole, options),
      requesterName: requester?.name || pr.requester || 'Requester',
    });
  })().catch((err) => console.error('WhatsApp assignee notify failed:', err.message));
}

export async function sendPostRfqActionNotification(pr, approverRole, action, remarks, requester) {
  const [requesterRows] = await pool.query(
    `SELECT email, name FROM users WHERE id = ?`,
    [pr.requesterId || pr.requester_id]
  );
  const requesterEmail = requesterRows[0]?.email || requester?.email;
  const requesterName = requesterRows[0]?.name || requester?.name || 'Requester';

  // Particular requester only (ops notify as BCC)
  const emails = requesterEmail ? [requesterEmail] : [];
  if (!emails.length) {
    console.warn(`No requester email for action notification on ${pr.prNumber || pr.id}`);
    return;
  }
  const emailSet = new Set(emails.map((e) => e.toLowerCase()));
  const bcc = getNotificationRecipients().filter((e) => e && !emailSet.has(e.toLowerCase()));

  const { subject, html, text } = buildPostRfqActionEmail({
    pr,
    action,
    remarks,
    approverRole,
    requesterName,
  });

  console.log(`Step mail → Requester (${requesterName}): ${emails.join(', ')} for ${pr.prNumber || pr.id}`);
  return sendMailToRecipients(emails, subject, html, text, [], { bcc });
}

export function queuePostRfqActionNotification(pr, approverRole, action, remarks, requester) {
  enqueueMail(() => sendPostRfqActionNotification(pr, approverRole, action, remarks, requester)).catch(
    (err) => {
      console.error('Email send failure (post-RFQ action):', err.message);
    }
  );

  notifyWorkflowWhatsApp({
    pr,
    emails: [requester?.email].filter(Boolean),
    stage: `PR ${action === 'reject' ? 'Rejected' : action === 'return' || action === 'rework' ? 'Sent Back' : action}`,
    actionUrl: `${getAppBaseUrl()}/requester/dashboard`,
    requesterName: requester?.name || pr.requester || 'Requester',
  });
}

export async function sendRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round = 1) {
  const { subject, html, text } = buildRfqInvitationEmail({ pr, vendorName, submitUrl, round });
  return sendMailToRecipients([vendorEmail], subject, html, text);
}

export function queueRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round = 1) {
  enqueueMail(() => sendRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round)).catch((err) => {
    console.error(`Email send failure (RFQ vendor ${vendorEmail}):`, err.message);
  });
}

export async function sendRfqSendBackEmail(pr, vendorName, vendorEmail, submitUrl, round, reason, fields) {
  const { subject, html, text } = buildRfqSendBackEmail({
    pr,
    vendorName,
    submitUrl,
    round,
    reason,
    fields,
  });
  return sendMailToRecipients([vendorEmail], subject, html, text);
}

export function queueRfqSendBackEmail(pr, vendorName, vendorEmail, submitUrl, round, reason, fields) {
  enqueueMail(() =>
    sendRfqSendBackEmail(pr, vendorName, vendorEmail, submitUrl, round, reason, fields)
  ).catch((err) => {
    console.error(`Email send failure (RFQ send-back ${vendorEmail}):`, err.message);
  });
}

export async function sendRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl) {
  const recipients = requesterEmail ? [requesterEmail] : [];
  if (!recipients.length) return;
  const emailSet = new Set(recipients.map((e) => e.toLowerCase()));
  const bcc = getNotificationRecipients().filter((e) => e && !emailSet.has(e.toLowerCase()));

  const { subject, html, text } = buildRfqSubmittedNotifyRequesterEmail({
    pr,
    vendorName,
    requesterName,
    submission,
    reviewUrl,
  });
  return sendMailToRecipients(recipients, subject, html, text, [], { bcc });
}

export function queueRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl) {
  enqueueMail(() =>
    sendRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl)
  ).catch((err) => {
    console.error('Email send failure (RFQ submitted):', err.message);
  });
}

export async function sendPoVendorNotification(po, { signerName, signerComments, ccEmails, pdfPath, portalUrl }) {
  const { host, user, pass } = getSmtpConfig();
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const acceptUrl = portalUrl || `${base}/scm/vendor-po-acceptance`;

  const { subject, html, text } = buildPoVendorEmail({
    po,
    signerName,
    signerComments,
    portalUrl: acceptUrl,
  });

  const to = po.vendorEmail;
  const cc = ccEmails.filter((e) => e && e.toLowerCase() !== to.toLowerCase());

  if (!host || !user || !pass) {
    console.log('PO email NOT sent (SMTP missing):', subject, '→', to, 'CC:', cc.join(', '));
    return;
  }

  await ensureSmtpReady();

  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: getFromAddress(),
      to,
      cc: cc.length ? cc.join(', ') : undefined,
      subject,
      text,
      html,
      attachments: pdfPath
        ? [{ filename: `${po.poNumber}_signed.pdf`, path: pdfPath, contentType: 'application/pdf' }]
        : [],
    });
    console.log(
      `Email sent successfully to ${to} (CC: ${cc.join(', ')}) — ${info.messageId}`
    );
    return info;
  } catch (err) {
    console.error('Email send failure (PO vendor):', err.message);
    if (err.response) console.error('SMTP response:', err.response);
    throw err;
  }
}
