import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { buildPrRaisedEmail } from '../templates/prRaisedEmail.js';
import { buildPrApprovalPendingEmail } from '../templates/prApprovalPendingEmail.js';
import { buildRfqInvitationEmail, buildRfqSendBackEmail } from '../templates/rfqVendorEmail.js';
import { buildRfqSubmittedNotifyRequesterEmail } from '../templates/rfqSubmittedEmail.js';
import { buildPostRfqActionEmail } from '../templates/prPostRfqActionEmail.js';
import { buildPoVendorEmail } from '../templates/poVendorEmail.js';
import { buildPoWorkflowEmail } from '../templates/poWorkflowEmail.js';
import { buildVendorInvoiceRequestEmail } from '../templates/vendorInvoiceRequestEmail.js';
import { resolveScmBuyerUsers, getScmBuyerNotifyEmails } from '../utils/scmAssignee.js';
import { formatRoleDisplayName } from '../templates/emailUtils.js';
import {
  buildWorkflowWhatsAppParams,
  queueWorkflowWhatsApp,
  resolvePhonesForEmails,
  getWhatsAppPublicBaseUrl,
  getDefaultNotifyPhones,
} from './whatsappService.js';
import { createEmailLog, updateEmailLog } from './emailLogService.js';

/**
 * Outbound email master switch — set manually here (no env).
 * true  = send emails
 * false = skip all outbound email
 */
const EMAIL_SEND_ENABLED = true;

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
  if (!EMAIL_SEND_ENABLED) {
    console.log('Email send skipped (EMAIL_SEND_ENABLED=false)');
    return Promise.resolve(null);
  }
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
  const createPo = Boolean(options.createPo);
  const stage = String(options.stageLabel || '').toLowerCase();
  const isCreatePo =
    createPo ||
    stage.includes('po create') ||
    stage.includes('create po') ||
    (postRfq && assignedRole === 'SCM Buyer');

  if (isCreatePo) return `${base}/scm/create-po?prId=${prId}`;
  if (assignedRole === 'Requester') {
    if (options.editPr) return `${base}/requester/edit-pr/${prId}`;
    return `${base}/requester/rfq-entry/${prId}`;
  }
  if (rfqEntry || (assignedRole === 'SCM Buyer' && !postRfq)) {
    return `${base}/scm/rfq-entry/${prId}`;
  }
  if (assignedRole === 'SCM Manager' && postRfq) return `${base}/rfq-approval/${prId}`;
  if (postRfq) return `${base}/rfq-approval/${prId}`;
  if (assignedRole === 'CFO') return `${base}/cfo/dashboard?prId=${prId}`;
  if (assignedRole === 'PR Manager') return `${base}/pr-manager/dashboard?prId=${prId}`;
  if (assignedRole === 'SCM Manager') return `${base}/scm/po-approval`;
  return `${base}/tasks?prId=${prId}`;
}

async function notifyWorkflowWhatsApp({
  pr,
  emails = [],
  stage,
  actionUrl,
  requesterName,
  assigneeName,
}) {
  try {
    const prId = pr?.id || pr?.prId || null;
    const prNumber = pr?.prNumber || pr?.pr_number || (prId ? `PR-${prId}` : null);

    const assigneePhones = await resolvePhonesForEmails(pool, emails, {
      includeOpsCc: false,
      fallbackToDefault: false,
    });
    const opsPhones = getDefaultNotifyPhones();
    const ccOps = process.env.WHATSAPP_CC_OPS === 'true';
    const toPhones = [
      ...new Set([
        ...assigneePhones,
        ...((ccOps || !assigneePhones.length) ? opsPhones : []),
      ]),
    ];

    if (!toPhones.length) {
      console.warn(
        `WhatsApp skipped: no phone for assignees [${(emails || []).join(', ')}] on ${prNumber || prId}`
      );
      const { createWhatsAppLog } = await import('./whatsappLogService.js');
      await createWhatsAppLog({
        notifyType: 'workflow',
        status: 'skipped',
        prId,
        prNumber,
        toPhone: '(none)',
        stage,
        errorMessage: `No phone for assignees: ${(emails || []).join(', ') || '(none)'}`,
        meta: { emails },
      });
      return;
    }
    console.log(
      `WhatsApp approval notify → ${toPhones.join(', ')} (assignee phones: ${assigneePhones.join(', ') || 'none'}; emails: ${(emails || []).join(', ') || 'none'}) stage=${stage}`
    );
    const parameters = buildWorkflowWhatsAppParams({
      appName: 'Procure to Pay',
      documentNumber: prNumber || `PR-${prId}`,
      stage,
      actionUrl: actionUrl || `${getAppBaseUrl()}/tasks`,
      assigneeName: assigneeName || 'Approver',
    });
    queueWorkflowWhatsApp({
      toPhones,
      parameters,
      documentNumber: prNumber || `PR-${prId}`,
      stage,
      logContext: {
        notifyType: 'workflow',
        prId,
        prNumber,
        emails,
        stage,
        meta: {
          actionUrl,
          assigneeName,
          assigneePhones,
          opsPhones: (ccOps || !assigneePhones.length) ? opsPhones : [],
          requesterName: requesterName || null,
        },
      },
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
  if (!EMAIL_SEND_ENABLED) {
    throw new Error('Email send is disabled (EMAIL_SEND_ENABLED=false)');
  }

  const recipient = String(to || '').trim();
  if (!recipient) throw new Error('Recipient email is required');

  const subject = 'P2P SMTP test';
  const logId = await createEmailLog({
    emailType: 'smtp_test',
    status: 'queued',
    toAddresses: recipient,
    subject,
  });

  const ok = await ensureSmtpReady();
  if (!ok) {
    await updateEmailLog(logId, {
      status: 'failed',
      errorMessage: 'SMTP is not connected. Check SMTP_HOST / SMTP_USER / SMTP_PASSWORD.',
    });
    throw new Error('SMTP is not connected. Check SMTP_HOST / SMTP_USER / SMTP_PASSWORD.');
  }

  try {
    const info = await getTransporter().sendMail({
      from: getFromAddress(),
      to: recipient,
      subject,
      text: `P2P SMTP test message sent at ${new Date().toISOString()}`,
      html: `<p>P2P SMTP test message sent at <strong>${new Date().toISOString()}</strong></p>`,
    });

    await updateEmailLog(logId, { status: 'sent', messageId: info.messageId });
    console.log(`SMTP test email sent to ${recipient} — ${info.messageId}`);
    return info;
  } catch (err) {
    await updateEmailLog(logId, { status: 'failed', errorMessage: err.message });
    throw err;
  }
}

export async function sendPrRaisedNotification(pr, requester, options = {}) {
  if (!EMAIL_SEND_ENABLED) {
    console.log('Email send skipped (PR raised): EMAIL_SEND_ENABLED=false');
    return null;
  }

  const recipients = getNotificationRecipients();
  const prId = pr?.id || pr?.prId || null;
  const prNumber = pr?.prNumber || pr?.pr_number || null;

  if (!recipients.length) {
    console.warn('PR email skipped: no PR_NOTIFY_EMAIL configured');
    await createEmailLog({
      emailType: 'pr_raised',
      status: 'skipped',
      prId,
      prNumber,
      toAddresses: '',
      subject: `PR raised ${prNumber || ''}`.trim(),
      errorMessage: 'No PR_NOTIFY_EMAIL configured',
      meta: { isResubmit: Boolean(options.isResubmit) },
    });
    return;
  }

  const { subject, html, text } = buildPrRaisedEmail({
    pr,
    requester,
    isResubmit: options.isResubmit || false,
  });

  const logId = await createEmailLog({
    emailType: 'pr_raised',
    status: 'queued',
    prId,
    prNumber,
    toAddresses: recipients,
    subject,
    meta: { isResubmit: Boolean(options.isResubmit) },
  });

  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    console.log('PR notification email NOT sent (SMTP missing):');
    console.log('  To:', recipients.join(', '));
    console.log('  Subject:', subject);
    await updateEmailLog(logId, {
      status: 'skipped',
      errorMessage: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)',
    });
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

    await updateEmailLog(logId, { status: 'sent', messageId: info.messageId });
    console.log(
      `Email sent successfully to ${recipients.join(', ')} — ${info.messageId}`
    );
    return info;
  } catch (err) {
    smtpReady = false;
    await updateEmailLog(logId, { status: 'failed', errorMessage: err.message });
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
    const buyers = await resolveScmBuyerUsers();
    if (buyers.length) {
      return buyers.map((b) => ({ email: b.email, name: b.name }));
    }
    const emails = await getScmBuyerNotifyEmails();
    return emails.map((email) => ({ email, name: 'SCM Buyer' }));
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
  if (!EMAIL_SEND_ENABLED) {
    console.log('Email send skipped (EMAIL_SEND_ENABLED=false):', subject);
    return null;
  }

  const toList = (recipients || []).filter(Boolean);
  const logCtx = {
    emailType: mailOptions.emailType || 'generic',
    prId: mailOptions.prId || null,
    poId: mailOptions.poId || null,
    relatedId: mailOptions.relatedId || null,
    prNumber: mailOptions.prNumber || null,
    poNumber: mailOptions.poNumber || null,
    meta: mailOptions.meta || null,
  };

  if (!toList.length) {
    await createEmailLog({
      ...logCtx,
      status: 'skipped',
      toAddresses: '',
      ccAddresses: '',
      bccAddresses: mailOptions.bcc || [],
      subject,
      errorMessage: 'No recipients',
    });
    return;
  }

  const logId = await createEmailLog({
    ...logCtx,
    status: 'queued',
    toAddresses: toList,
    bccAddresses: mailOptions.bcc || [],
    subject,
  });

  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    console.log('Email NOT sent (SMTP missing):', subject, '→', toList.join(', '));
    if (attachments?.length) {
      console.log(`  Attachments skipped (${attachments.length}):`, attachments.map((a) => a.filename).join(', '));
    }
    await updateEmailLog(logId, {
      status: 'skipped',
      errorMessage: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)',
    });
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
      to: toList.join(', '),
      bcc: mailOptions.bcc?.length ? mailOptions.bcc.join(', ') : undefined,
      subject,
      text,
      html,
      attachments: attachments?.length ? attachments : undefined,
    });
    await updateEmailLog(logId, { status: 'sent', messageId: info.messageId });
    console.log(`Email sent to ${toList.join(', ')} — ${info.messageId}`);
    return info;
  } catch (err) {
    smtpReady = false;
    await updateEmailLog(logId, { status: 'failed', errorMessage: err.message });
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

  if (assignedRole === 'SCM Buyer') {
    const buyerEmails = await getScmBuyerNotifyEmails();
    emails = [...new Set([...emails, ...buyerEmails])];
    if (!primaryName && buyerEmails.length) primaryName = 'SCM Buyer';
  }

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
    await createEmailLog({
      emailType: 'pr_approval_pending',
      status: 'skipped',
      prId: pr.id || pr.prId || null,
      prNumber: pr.prNumber || pr.pr_number || null,
      toAddresses: '',
      subject: `Approval pending ${pr.prNumber || pr.id || ''}`.trim(),
      errorMessage: `No recipients for role: ${assignedRole}`,
      meta: { assignedRole, stageLabel: options.stageLabel || null },
    });
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
    createPo: options.createPo || false,
    appBaseUrl: getAppBaseUrl(),
  });

  console.log(
    `Step mail → ${assignedRole} (${primaryName}): ${emails.join(', ')} for ${pr.prNumber || pr.id}`
  );

  return sendMailToRecipients(emails, subject, html, text, options.attachments || [], {
    bcc,
    emailType: 'pr_approval_pending',
    prId: pr.id || pr.prId || null,
    prNumber: pr.prNumber || pr.pr_number || null,
    meta: {
      assignedRole,
      approverName: primaryName,
      stageLabel: options.stageLabel || null,
      postRfq: Boolean(options.postRfq),
      rfqEntry: Boolean(options.rfqEntry),
    },
  });
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
  const roleLabel = formatRoleDisplayName(assignedRole);
  const stage =
    options.stageLabel ||
    `${roleLabel} Approval`;

  // Resolve assignee email + name for WhatsApp (send to assignee mobile)
  (async () => {
    let assigneeEmails = [...emails];
    let assigneeName = options.approverName || null;

    if (assignedRole === 'SCM Buyer') {
      try {
        const extra = await getScmBuyerNotifyEmails();
        assigneeEmails = [...new Set([...assigneeEmails, ...extra])];
        if (!assigneeName) assigneeName = 'SCM Buyer';
      } catch {
        /* ignore */
      }
    }

    if (!assigneeEmails.length || !assigneeName) {
      try {
        const fromTask = await resolveAssignedUserForStep(pr.id || pr.prId, assignedRole);
        if (!assigneeEmails.length) assigneeEmails = fromTask.emails || [];
        if (!assigneeName) assigneeName = fromTask.name || null;
      } catch {
        /* ignore */
      }
    }
    if (!assigneeEmails.length || !assigneeName) {
      try {
        const approvers = await getApproverRecipients(assignedRole, departmentId);
        if (!assigneeEmails.length) {
          assigneeEmails = approvers.map((a) => a.email).filter(Boolean);
        }
        if (!assigneeName) assigneeName = approvers[0]?.name || null;
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
      assigneeName: assigneeName || roleLabel || 'Approver',
    });
  })().catch((err) => console.error('WhatsApp assignee notify failed:', err.message));
}

export async function sendPostRfqActionNotification(pr, approverRole, action, remarks, requester, options = {}) {
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
    await createEmailLog({
      emailType: 'pr_post_rfq_action',
      status: 'skipped',
      prId: pr.id || pr.prId || null,
      prNumber: pr.prNumber || pr.pr_number || null,
      toAddresses: '',
      subject: `PR ${action} ${pr.prNumber || pr.id || ''}`.trim(),
      errorMessage: 'No requester email',
      meta: { action, approverRole },
    });
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
    editPr: Boolean(options.editPr),
    appBaseUrl: getAppBaseUrl(),
  });

  console.log(`Step mail → Requester (${requesterName}): ${emails.join(', ')} for ${pr.prNumber || pr.id}`);
  return sendMailToRecipients(emails, subject, html, text, [], {
    bcc,
    emailType: 'pr_post_rfq_action',
    prId: pr.id || pr.prId || null,
    prNumber: pr.prNumber || pr.pr_number || null,
    meta: { action, approverRole, editPr: Boolean(options.editPr) },
  });
}

export function queuePostRfqActionNotification(pr, approverRole, action, remarks, requester, options = {}) {
  enqueueMail(() =>
    sendPostRfqActionNotification(pr, approverRole, action, remarks, requester, options)
  ).catch((err) => {
    console.error('Email send failure (post-RFQ action):', err.message);
  });

  const actionLabel =
    action === 'reject'
      ? 'Rejected'
      : action === 'return' || action === 'rework'
        ? 'Sent Back'
        : action;
  const portal = options.editPr
    ? `${getAppBaseUrl()}/requester/edit-pr/${pr.id || pr.prId}`
    : action === 'reject'
      ? `${getAppBaseUrl()}/requester/track-pr`
      : `${getAppBaseUrl()}/requester/rfq-entry/${pr.id || pr.prId}`;
  notifyWorkflowWhatsApp({
    pr,
    emails: [requester?.email].filter(Boolean),
    stage: `PR ${actionLabel}`,
    actionUrl: portal,
    requesterName: requester?.name || pr.requester || 'Requester',
    assigneeName: requester?.name || pr.requester || 'Requester',
  });
}

export async function sendRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round = 1) {
  const { subject, html, text } = buildRfqInvitationEmail({ pr, vendorName, submitUrl, round });
  return sendMailToRecipients([vendorEmail], subject, html, text, [], {
    emailType: 'rfq_vendor',
    prId: pr?.id || pr?.prId || null,
    prNumber: pr?.prNumber || pr?.pr_number || null,
    meta: { vendorName, round },
  });
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
  return sendMailToRecipients([vendorEmail], subject, html, text, [], {
    emailType: 'rfq_send_back',
    prId: pr?.id || pr?.prId || null,
    prNumber: pr?.prNumber || pr?.pr_number || null,
    meta: { vendorName, round },
  });
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
  return sendMailToRecipients(recipients, subject, html, text, [], {
    bcc,
    emailType: 'rfq_submitted',
    prId: pr?.id || pr?.prId || null,
    prNumber: pr?.prNumber || pr?.pr_number || null,
    meta: { vendorName },
  });
}

export function queueRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl) {
  enqueueMail(() =>
    sendRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl)
  ).catch((err) => {
    console.error('Email send failure (RFQ submitted):', err.message);
  });
}

/**
 * PO workflow mail — assign / sendback / reject (manager approval + buyer final verify).
 * @param {'assign'|'sendback'|'reject'} action
 */
export async function sendPoWorkflowNotification(po, {
  action,
  stageLabel,
  recipientEmails = [],
  recipientName,
  actorName,
  actorRole,
  remarks,
  portalUrl,
  ctaLabel,
}) {
  const emails = [...new Set((recipientEmails || []).map((e) => String(e || '').trim()).filter(Boolean))];
  if (!emails.length) {
    console.warn(`No recipients for PO workflow email (${action}) ${po?.poNumber || po?.id}`);
    await createEmailLog({
      emailType: 'po_workflow',
      status: 'skipped',
      poId: po?.id || po?.poId || null,
      prId: po?.prId || po?.pr_id || null,
      poNumber: po?.poNumber || po?.po_number || null,
      prNumber: po?.prNumber || po?.pr_number || null,
      toAddresses: '',
      subject: `PO ${action} ${po?.poNumber || po?.id || ''}`.trim(),
      errorMessage: 'No recipients',
      meta: { action, stageLabel },
    });
    return;
  }

  const emailSet = new Set(emails.map((e) => e.toLowerCase()));
  const bcc = getNotificationRecipients().filter((e) => e && !emailSet.has(e.toLowerCase()));

  const { subject, html, text } = buildPoWorkflowEmail({
    po,
    action,
    stageLabel,
    recipientName: recipientName || 'User',
    actorName,
    actorRole,
    remarks,
    portalUrl,
    ctaLabel,
  });

  console.log(`PO workflow mail (${action}) → ${emails.join(', ')} for ${po?.poNumber || po?.id}`);

  return sendMailToRecipients(emails, subject, html, text, [], {
    bcc,
    emailType: 'po_workflow',
    poId: po?.id || po?.poId || null,
    prId: po?.prId || po?.pr_id || null,
    poNumber: po?.poNumber || po?.po_number || null,
    prNumber: po?.prNumber || po?.pr_number || null,
    meta: { action, stageLabel, actorRole },
  });
}

export function queuePoWorkflowNotification(po, options = {}) {
  enqueueMail(() => sendPoWorkflowNotification(po, options)).catch((err) => {
    console.error('Email send failure (PO workflow):', err.message);
  });

  const action = options.action || 'assign';
  const stageLabel =
    options.stageLabel ||
    (action === 'assign'
      ? 'PO Approval'
      : action === 'sendback'
        ? 'PO Sent Back'
        : 'PO Rejected');
  const emails = (options.recipientEmails || []).map((e) => String(e || '').trim()).filter(Boolean);

  const prLike = {
    id: po?.prId || po?.pr_id || null,
    prId: po?.prId || po?.pr_id || null,
    prNumber: po?.prNumber || po?.pr_number || null,
    title: po?.prTitle || po?.title || po?.poNumber || '',
  };

  notifyWorkflowWhatsApp({
    pr: prLike,
    emails,
    stage: stageLabel,
    actionUrl: options.portalUrl || `${getAppBaseUrl()}/scm/buyer-final-verify`,
    requesterName: po?.requester || options.actorName || 'User',
    assigneeName: options.recipientName || 'Approver',
  });
}

export async function sendVendorInvoiceRequestNotification(po, invoice, { portalUrl, ccEmails = [] }) {
  const { subject, html, text } = buildVendorInvoiceRequestEmail({ invoice, po, portalUrl });
  const to = po.vendorEmail || po.vendor_email;
  if (!to) {
    await createEmailLog({
      emailType: 'vendor_invoice_request',
      status: 'skipped',
      poId: po?.id || null,
      prId: po?.prId || po?.pr_id || null,
      poNumber: po?.poNumber || po?.po_number || null,
      prNumber: po?.prNumber || po?.pr_number || null,
      toAddresses: '',
      subject,
      errorMessage: 'No vendor email',
    });
    throw new Error('Vendor email is missing on this PO');
  }

  if (!EMAIL_SEND_ENABLED) {
    console.log('Email send skipped (vendor invoice request): EMAIL_SEND_ENABLED=false →', to);
    await createEmailLog({
      emailType: 'vendor_invoice_request',
      status: 'skipped',
      poId: po?.id || null,
      prId: po?.prId || po?.pr_id || null,
      poNumber: po?.poNumber || po?.po_number || null,
      prNumber: po?.prNumber || po?.pr_number || null,
      toAddresses: to,
      subject,
      errorMessage: 'EMAIL_SEND_ENABLED=false',
      meta: { portalUrl },
    });
    return { skipped: true, to, subject };
  }

  return sendMailToRecipients([to], subject, html, text, [], {
    bcc: (ccEmails || []).filter((e) => e && e.toLowerCase() !== String(to).toLowerCase()),
    emailType: 'vendor_invoice_request',
    poId: po?.id || null,
    prId: po?.prId || po?.pr_id || null,
    poNumber: po?.poNumber || po?.po_number || null,
    prNumber: po?.prNumber || po?.pr_number || null,
    meta: { portalUrl, invoiceId: invoice?.id || null },
  });
}

export async function sendPoVendorNotification(po, { signerName, signerComments, ccEmails, pdfPath, portalUrl }) {
  if (!EMAIL_SEND_ENABLED) {
    console.log('Email send skipped (PO vendor): EMAIL_SEND_ENABLED=false');
    return null;
  }

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
  const cc = (ccEmails || []).filter((e) => e && e.toLowerCase() !== String(to || '').toLowerCase());
  const logId = await createEmailLog({
    emailType: 'po_vendor',
    status: 'queued',
    poId: po?.id || po?.poId || null,
    prId: po?.prId || po?.pr_id || null,
    poNumber: po?.poNumber || po?.po_number || null,
    prNumber: po?.prNumber || po?.pr_number || null,
    toAddresses: to || '',
    ccAddresses: cc,
    subject,
    meta: { signerName, hasPdf: Boolean(pdfPath) },
  });

  if (!host || !user || !pass) {
    console.log('PO email NOT sent (SMTP missing):', subject, '→', to, 'CC:', cc.join(', '));
    await updateEmailLog(logId, {
      status: 'skipped',
      errorMessage: 'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD)',
    });
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
    await updateEmailLog(logId, { status: 'sent', messageId: info.messageId });
    console.log(
      `Email sent successfully to ${to} (CC: ${cc.join(', ')}) — ${info.messageId}`
    );
    return info;
  } catch (err) {
    await updateEmailLog(logId, { status: 'failed', errorMessage: err.message });
    console.error('Email send failure (PO vendor):', err.message);
    if (err.response) console.error('SMTP response:', err.response);
    throw err;
  }
}
