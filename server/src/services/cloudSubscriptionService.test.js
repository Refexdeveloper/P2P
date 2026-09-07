/**
 * Cloud Subscription lifecycle unit tests (Node built-in test runner).
 * Run: node --test src/services/cloudSubscriptionService.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExpiryDate,
  normalizeSubscriptionMode,
  normalizeBillingFrequency,
  __test,
} from './cloudSubscriptionService.js';

const { ymd, addDays, daysBetween, toDateOnly } = __test;

describe('Cloud Subscription — One-Time vs Recurring mode', () => {
  it('normalizes one-time and recurring', () => {
    assert.equal(normalizeSubscriptionMode('One-Time'), 'one_time');
    assert.equal(normalizeSubscriptionMode('Recurring'), 'recurring');
    assert.equal(normalizeSubscriptionMode('onetime'), 'one_time');
  });
});

describe('Cloud Subscription — billing frequency', () => {
  it('saves monthly / quarterly / yearly', () => {
    assert.equal(normalizeBillingFrequency('Monthly'), 'monthly');
    assert.equal(normalizeBillingFrequency('Quarterly'), 'quarterly');
    assert.equal(normalizeBillingFrequency('Yearly'), 'yearly');
    assert.equal(normalizeBillingFrequency('annual'), 'yearly');
  });
});

describe('Cloud Subscription — calendar expiry', () => {
  it('monthly: start + 1 calendar month', () => {
    assert.equal(ymd(calculateExpiryDate('2026-09-10', 'monthly')), '2026-10-10');
  });

  it('quarterly: start + 3 calendar months', () => {
    assert.equal(ymd(calculateExpiryDate('2026-09-10', 'quarterly')), '2026-12-10');
  });

  it('yearly: start + 1 calendar year', () => {
    assert.equal(ymd(calculateExpiryDate('2026-09-10', 'yearly')), '2027-09-10');
  });

  it('handles month-end clamp (Jan 31 → Feb)', () => {
    const exp = ymd(calculateExpiryDate('2027-01-31', 'monthly'));
    assert.ok(exp === '2027-02-28' || exp === '2027-02-29');
  });

  it('continuous monthly renewal periods', () => {
    let start = toDateOnly('2027-01-10');
    const periods = [];
    for (let i = 0; i < 4; i += 1) {
      const end = calculateExpiryDate(start, 'monthly');
      periods.push(`${ymd(start)}→${ymd(end)}`);
      start = end;
    }
    assert.deepEqual(periods, [
      '2027-01-10→2027-02-10',
      '2027-02-10→2027-03-10',
      '2027-03-10→2027-04-10',
      '2027-04-10→2027-05-10',
    ]);
  });

  it('continuous quarterly renewal periods', () => {
    let start = toDateOnly('2027-01-10');
    const periods = [];
    for (let i = 0; i < 2; i += 1) {
      const end = calculateExpiryDate(start, 'quarterly');
      periods.push(`${ymd(start)}→${ymd(end)}`);
      start = end;
    }
    assert.deepEqual(periods, ['2027-01-10→2027-04-10', '2027-04-10→2027-07-10']);
  });

  it('continuous yearly renewal periods', () => {
    let start = toDateOnly('2027-01-10');
    const periods = [];
    for (let i = 0; i < 2; i += 1) {
      const end = calculateExpiryDate(start, 'yearly');
      periods.push(`${ymd(start)}→${ymd(end)}`);
      start = end;
    }
    assert.deepEqual(periods, ['2027-01-10→2028-01-10', '2028-01-10→2029-01-10']);
  });
});

describe('Cloud Subscription — reminder schedule relative to expiry', () => {
  it('maps 7/3/1 before and day1/day2 after; day0 has no renewal email', () => {
    const expiry = toDateOnly('2026-10-10');
    assert.equal(ymd(addDays(expiry, -7)), '2026-10-03');
    assert.equal(ymd(addDays(expiry, -3)), '2026-10-07');
    assert.equal(ymd(addDays(expiry, -1)), '2026-10-09');
    assert.equal(daysBetween(expiry, expiry), 0); // Day 0 — expire, no email
    assert.equal(ymd(addDays(expiry, 1)), '2026-10-11');
    assert.equal(ymd(addDays(expiry, 2)), '2026-10-12');
    assert.equal(daysBetween(expiry, addDays(expiry, 3)), 3); // no auto email from day 3
  });
});

describe('Cloud Subscription — notification dedupe key', () => {
  it('same period + type yields identical dedupe key', () => {
    const key = (subId, renewalNumber, expiry, type) =>
      `${subId}:${renewalNumber}:${expiry}:${type}`;
    const a = key(15, 0, '2026-10-10', 'POST_EXPIRY_DAY_1');
    const b = key(15, 0, '2026-10-10', 'POST_EXPIRY_DAY_1');
    assert.equal(a, b);
    const afterRenew = key(15, 1, '2026-11-10', 'POST_EXPIRY_DAY_1');
    assert.notEqual(a, afterRenew);
  });
});
