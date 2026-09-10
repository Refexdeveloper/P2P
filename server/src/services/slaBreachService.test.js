/**
 * Daily SLA breach reminder unit tests (Node built-in test runner).
 * Run: node --test src/services/slaBreachService.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSlaDate,
  getSlaWaitingDays,
  getDailySlaApprovalTypeLabel,
  isDailySlaReminderRole,
  isTaskSlaBreached,
  getTaskSlaDeadlineMs,
  DAILY_SLA_REMINDER_ROLES,
  SCM_SLA_ONE_TIME_ROLES,
  SLA_REMINDER_SLOTS,
} from '../utils/sla.js';
import { buildSlaBreachDailyEmail } from '../templates/slaBreachDailyEmail.js';
import { __test } from './slaBreachService.js';

describe('Daily SLA — role gates (User/L1/L2 only)', () => {
  it('includes HOD Approver and PR Manager', () => {
    assert.equal(isDailySlaReminderRole('HOD Approver'), true);
    assert.equal(isDailySlaReminderRole('PR Manager'), true);
    assert.ok(DAILY_SLA_REMINDER_ROLES.has('HOD Approver'));
    assert.ok(DAILY_SLA_REMINDER_ROLES.has('PR Manager'));
  });

  it('excludes SCM Buyer and SCM Manager from daily reminders', () => {
    assert.equal(isDailySlaReminderRole('SCM Buyer'), false);
    assert.equal(isDailySlaReminderRole('SCM Manager'), false);
    assert.ok(SCM_SLA_ONE_TIME_ROLES.has('SCM Buyer'));
    assert.ok(SCM_SLA_ONE_TIME_ROLES.has('SCM Manager'));
    assert.ok(__test.SCM_SLA_ONE_TIME_ROLES.has('SCM Buyer'));
  });
});

describe('Daily SLA — approval type labels', () => {
  it('maps functional HOD → User Approval', () => {
    assert.equal(getDailySlaApprovalTypeLabel('HOD Approver', 'functional'), 'User Approval');
  });

  it('maps standard HOD → L1 Manager Approval', () => {
    assert.equal(getDailySlaApprovalTypeLabel('HOD Approver', 'standard'), 'L1 Manager Approval');
  });

  it('maps PR Manager → L2 Manager Approval', () => {
    assert.equal(getDailySlaApprovalTypeLabel('PR Manager', 'standard'), 'L2 Manager Approval');
    assert.equal(getDailySlaApprovalTypeLabel('PR Manager', 'functional'), 'L2 Manager Approval');
  });

  it('does not map SCM roles to User/L1/L2 labels', () => {
    assert.notEqual(getDailySlaApprovalTypeLabel('SCM Buyer'), 'User Approval');
    assert.notEqual(getDailySlaApprovalTypeLabel('SCM Manager'), 'L1 Manager Approval');
  });
});

describe('Daily SLA — dates and waiting days', () => {
  it('formats start / SLA due as YYYY-MM-DD', () => {
    assert.equal(formatSlaDate('2026-09-06T10:00:00'), '2026-09-06');
    assert.equal(formatSlaDate(new Date('2026-09-07T23:00:00')), '2026-09-07');
  });

  it('computes waiting days like the example (start 09-06 → 4 days on 09-10)', () => {
    const waiting = getSlaWaitingDays('2026-09-06T09:00:00', new Date('2026-09-10T12:00:00'));
    assert.equal(waiting, 4);
  });

  it('detects breach after SLA hours from task start', () => {
    const start = new Date('2026-09-06T09:00:00');
    const beforeDue = new Date(start.getTime() + 12 * 3600000);
    const afterDue = new Date(start.getTime() + 25 * 3600000);
    // Patch Date.now via deadline comparison helpers
    const deadline = getTaskSlaDeadlineMs(start, null, 24);
    assert.ok(beforeDue.getTime() < deadline);
    assert.ok(afterDue.getTime() > deadline);
    assert.equal(isTaskSlaBreached(start, null, 24), Date.now() > deadline);
  });
});

describe('Daily SLA — morning / evening slots', () => {
  it('maps MORNING → sla_daily_notified_on and EVENING → sla_evening_notified_on', () => {
    assert.equal(__test.slotNotifiedColumn('MORNING'), 'sla_daily_notified_on');
    assert.equal(__test.slotNotifiedColumn('EVENING'), 'sla_evening_notified_on');
    assert.equal(__test.normalizeSlaReminderSlot('evening'), 'EVENING');
    assert.equal(__test.normalizeSlaReminderSlot(''), 'MORNING');
  });

  it('tracks morning and evening independently (same day allowed)', () => {
    __test.resetDailyRunDate();
    // Simulate morning already ran today
    const today = __test.calendarDateInTz();
    // Force path still blocked after lastSlotRunDate is set via reset only —
    // verify columns differ so both slots can claim the same calendar day.
    assert.notEqual(
      __test.slotNotifiedColumn(SLA_REMINDER_SLOTS.MORNING),
      __test.slotNotifiedColumn(SLA_REMINDER_SLOTS.EVENING)
    );
    assert.ok(today);
  });
});

describe('Daily SLA — email template', () => {
  it('builds required subject and body fields for L1 example', () => {
    const { subject, html, text } = buildSlaBreachDailyEmail({
      pr: { prNumber: 'PR-2026-001', title: 'Office supplies' },
      approverName: 'Sasikumar S',
      approvalType: 'L1 Manager Approval',
      startDate: '2026-09-06',
      slaDue: '2026-09-07',
      waitingDays: 4,
      appBaseUrl: 'http://localhost:3000',
    });

    assert.equal(subject, '[SLA Breached] Approval Pending - Action Required');
    assert.match(text, /Hello Sasikumar S/);
    assert.match(text, /Approval Type: L1 Manager Approval/);
    assert.match(text, /Approver: Sasikumar S/);
    assert.match(text, /Start Date: 2026-09-06/);
    assert.match(text, /SLA Due: 2026-09-07/);
    assert.match(text, /Waiting: 4 days/);
    assert.match(text, /Status: SLA Breached/);
    assert.match(text, /SLA exceeded — awaiting action/);
    assert.match(text, /P2P Procurement/);
    assert.match(html, /L1 Manager Approval/);
    assert.match(html, /Sasikumar S/);
    assert.match(html, /SLA Breached/);
  });

  it('builds User Approval and L2 labels correctly in template', () => {
    for (const type of ['User Approval', 'L2 Manager Approval']) {
      const { text } = buildSlaBreachDailyEmail({
        pr: { prNumber: 'PR-X' },
        approverName: 'Approver',
        approvalType: type,
        startDate: '2026-09-01',
        slaDue: '2026-09-02',
        waitingDays: 1,
      });
      assert.match(text, new RegExp(`Approval Type: ${type}`));
      assert.match(text, /Waiting: 1 day/);
    }
  });
});
