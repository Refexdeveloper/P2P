/**
 * Quick unit checks for RMC PO value matrix routing (no DB required).
 * Run: node scripts/test-po-value-matrix.js
 */
import {
  resolveRequiredValueLevels,
  normalizePoReleaseCategory,
  poAmountExGst,
} from '../src/services/approvalMatrixService.js';

const LAKH = 100000;

function row(category, level, max) {
  return {
    category_code: category,
    level_no: level,
    amount_min: 0,
    amount_max: max,
    is_active: 1,
    approver_emails: JSON.stringify(['a@x.com']),
  };
}

const raw = [
  row('RAW_MATERIALS', 1, 20 * LAKH),
  row('RAW_MATERIALS', 2, 40 * LAKH),
  row('RAW_MATERIALS', 3, null),
];

const capex = [
  row('CAPEX', 1, 5 * LAKH),
  row('CAPEX', 2, null),
];

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

const l15 = resolveRequiredValueLevels('RAW_MATERIALS', 15 * LAKH, raw);
assert(l15.map((r) => r.level_no).join(',') === '1', 'Raw 15L → L1 only');

const l30 = resolveRequiredValueLevels('RAW_MATERIALS', 30 * LAKH, raw);
assert(l30.map((r) => r.level_no).join(',') === '1,2', 'Raw 30L → L1+L2');

const l50 = resolveRequiredValueLevels('RAW_MATERIALS', 50 * LAKH, raw);
assert(l50.map((r) => r.level_no).join(',') === '1,2,3', 'Raw 50L → L1+L2+L3');

const c3 = resolveRequiredValueLevels('CAPEX', 3 * LAKH, capex);
assert(c3.map((r) => r.level_no).join(',') === '1', 'Capex 3L → L1');

const c8 = resolveRequiredValueLevels('CAPEX', 8 * LAKH, capex);
assert(c8.map((r) => r.level_no).join(',') === '1,2', 'Capex 8L → L1+L2');

assert(normalizePoReleaseCategory('', 'Capex') === 'CAPEX', 'Capex requestType → CAPEX');
assert(poAmountExGst({ subtotal: 100, tax_amount: 18, grand_total: 118 }) === 100, 'ex-GST uses subtotal');
assert(poAmountExGst({ grand_total: 118, tax_amount: 18 }) === 100, 'ex-GST fallback grand-tax');

if (!process.exitCode) console.log('\nAll matrix unit checks passed.');
