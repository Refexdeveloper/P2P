import nodemailer from 'nodemailer';
import pool from '../config/db.js';
import { buildPrRaisedEmail } from '../templates/prRaisedEmail.js';
import { buildPrApprovalPendingEmail } from '../templates/prApprovalPendingEmail.js';
import { buildRfqInvitationEmail, buildRfqSendBackEmail } from '../templates/rfqVendorEmail.js';
import { buildRfqSubmittedNotifyRequesterEmail } from '../templates/rfqSubmittedEmail.js';
import { buildPostRfqActionEmail } from '../templates/prPostRfqActionEmail.js';
import { buildPoVendorEmail } from '../templates/poVendorEmail.js';

let transporter;
let smtpReady = false;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return { host, port, user, pass, secure };
}

function getTransporter() {
  if (transporter) return transporter;

  const { host, port, user, pass, secure } = getSmtpConfig();

  if (!host || !user || !pass) {
    console.warn(
      'SMTP not fully configured (need SMTP_HOST, SMTP_USER, SMTP_PASS or SMTP_PASSWORD). Emails will not be delivered.'
    );
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return transporter;
}

async function ensureSmtpReady() {
  if (smtpReady) return true;

  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) return false;

  try {
    await getTransporter().verify();
    smtpReady = true;
    console.log(`SMTP ready: ${host} as ${user}`);
    return true;
  } catch (err) {
    console.error('SMTP verification failed:', err.message);
    return false;
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
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    user ||
    'p2p-procurement@refex.co.in';
  return `"P2P Procurement" <${fromEmail}>`;
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

  await ensureSmtpReady();

  const transport = getTransporter();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to: recipients.join(', '),
    subject,
    text,
    html,
  });

  console.log(`PR notification email sent to ${recipients.join(', ')} — ${info.messageId}`);
  return info;
}

export function queuePrRaisedNotification(pr, requester, options = {}) {
  sendPrRaisedNotification(pr, requester, options).catch((err) => {
    console.error('Failed to send PR raised email:', err.message);
    if (err.response) console.error('SMTP response:', err.response);
  });
}

async function getApproverRecipients(role, departmentId = null) {
  let sql = `SELECT email, name FROM users WHERE role = ? AND is_active = 1`;
  const params = [role];
  if (role === 'HOD Approver' && departmentId) {
    sql += ' AND department_id = ?';
    params.push(departmentId);
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function sendMailToRecipients(recipients, subject, html, text) {
  const { host, user, pass } = getSmtpConfig();
  if (!host || !user || !pass) {
    console.log('Email NOT sent (SMTP missing):', subject, '→', recipients.join(', '));
    return;
  }

  await ensureSmtpReady();
  const transport = getTransporter();
  const info = await transport.sendMail({
    from: getFromAddress(),
    to: recipients.join(', '),
    subject,
    text,
    html,
  });
  console.log(`Email sent to ${recipients.join(', ')} — ${info.messageId}`);
  return info;
}

export async function sendPrApprovalPendingNotification(pr, assignedRole, requester, departmentId = null, options = {}) {
  const approvers = await getApproverRecipients(assignedRole, departmentId);
  const notifyEmails = getNotificationRecipients();

  const explicitEmails = (options.approverEmails || []).filter(Boolean);
  const emails = [...new Set([
    ...explicitEmails,
    ...approvers.map((a) => a.email),
    ...notifyEmails,
  ])];

  if (!emails.length) {
    console.warn(`No recipients for PR approval email (role: ${assignedRole})`);
    return;
  }

  const primaryName = options.approverName || approvers[0]?.name || 'Approver';

  const { subject, html, text } = buildPrApprovalPendingEmail({
    pr,
    requester,
    assignedRole,
    approverName: primaryName,
    postRfq: options.postRfq || false,
    stageLabel: options.stageLabel || null,
    rfqSummary: options.rfqSummary || null,
  });

  return sendMailToRecipients(emails, subject, html, text);
}

export function queuePrApprovalPendingNotification(pr, assignedRole, requester, departmentId = null, options = {}) {
  sendPrApprovalPendingNotification(pr, assignedRole, requester, departmentId, options).catch((err) => {
    console.error('Failed to send PR approval email:', err.message);
    if (err.response) console.error('SMTP response:', err.response);
  });
}

export async function sendPostRfqActionNotification(pr, approverRole, action, remarks, requester) {
  const [requesterRows] = await pool.query(
    `SELECT email, name FROM users WHERE id = ?`,
    [pr.requesterId || pr.requester_id]
  );
  const requesterEmail = requesterRows[0]?.email;
  const requesterName = requesterRows[0]?.name || requester?.name || 'Requester';
  const notifyEmails = getNotificationRecipients();

  const emails = [...new Set([requesterEmail, ...notifyEmails].filter(Boolean))];
  if (!emails.length) return;

  const { subject, html, text } = buildPostRfqActionEmail({
    pr,
    action,
    remarks,
    approverRole,
    requesterName,
  });

  return sendMailToRecipients(emails, subject, html, text);
}

export function queuePostRfqActionNotification(pr, approverRole, action, remarks, requester) {
  sendPostRfqActionNotification(pr, approverRole, action, remarks, requester).catch((err) => {
    console.error('Failed to send post-RFQ action email:', err.message);
  });
}

export async function sendRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round = 1) {
  const { subject, html, text } = buildRfqInvitationEmail({ pr, vendorName, submitUrl, round });
  return sendMailToRecipients([vendorEmail], subject, html, text);
}

export function queueRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round = 1) {
  sendRfqVendorEmail(pr, vendorName, vendorEmail, submitUrl, round).catch((err) => {
    console.error(`Failed to send RFQ email to ${vendorEmail}:`, err.message);
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
  sendRfqSendBackEmail(pr, vendorName, vendorEmail, submitUrl, round, reason, fields).catch((err) => {
    console.error(`Failed to send RFQ send-back email to ${vendorEmail}:`, err.message);
  });
}

export async function sendRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl) {
  const notifyEmails = getNotificationRecipients();
  const recipients = [...new Set([requesterEmail, ...notifyEmails].filter(Boolean))];

  const { subject, html, text } = buildRfqSubmittedNotifyRequesterEmail({
    pr,
    vendorName,
    requesterName,
    submission,
    reviewUrl,
  });
  return sendMailToRecipients(recipients, subject, html, text);
}

export function queueRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl) {
  sendRfqSubmittedNotifyRequester(pr, vendorName, requesterEmail, requesterName, submission, reviewUrl).catch((err) => {
    console.error(`Failed to send RFQ submitted notification:`, err.message);
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
  console.log(`PO email sent to ${to} (CC: ${cc.join(', ')}) — ${info.messageId}`);
  return info;
}
