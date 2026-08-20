/**
 * Default Short / Long Work Order templates — cloned from PO defaults with WO wording.
 */
import { SHORT_PO_LETTERHEAD_DEFAULTS } from './shortPoLetterheadDefaults.js';
import { LONG_PO_LETTERHEAD_DEFAULTS } from './longPoLetterheadDefaults.js';

function toWorkOrderText(value) {
  return String(value || '')
    .replace(/PURCHASE ORDER/g, 'WORK ORDER')
    .replace(/Purchase Order/g, 'Work Order')
    .replace(/purchase order/gi, 'work order')
    .replace(/\bthis PO\b/g, 'this WO')
    .replace(/\bthis po\b/g, 'this wo')
    .replace(/\bPO Type\b/g, 'WO Type')
    .replace(/\bPO\b/g, 'WO');
}

function mapDefaults(source, title) {
  return {
    title,
    letterheadHeader: toWorkOrderText(source.letterheadHeader),
    terms: (source.terms || []).map((row) => ({
      termsHeader: toWorkOrderText(row.termsHeader),
      termsDescription: toWorkOrderText(row.termsDescription),
    })),
    annexure: (source.annexure || []).map((row) => ({
      termsHeader: toWorkOrderText(row.termsHeader),
      termsDescription: toWorkOrderText(row.termsDescription),
    })),
  };
}

export const SHORT_WO_LETTERHEAD_DEFAULTS = mapDefaults(SHORT_PO_LETTERHEAD_DEFAULTS, 'Short WO');
export const LONG_WO_LETTERHEAD_DEFAULTS = mapDefaults(LONG_PO_LETTERHEAD_DEFAULTS, 'Long WO');
