export const PR_REQUEST_CATEGORY_OPTIONS = ['Product', 'Service'] as const;
export type PrRequestCategory = (typeof PR_REQUEST_CATEGORY_OPTIONS)[number];

export function normalizeRequestCategory(value: unknown): PrRequestCategory | '' {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'product') return 'Product';
  if (s === 'service') return 'Service';
  return '';
}

export const PR_PAYMENT_TERM_OPTIONS = [
  'Net 15 Days',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
  '100% Advance',
  '50% Advance, 50% on Delivery',
  'Against Delivery',
];

export const PR_DELIVERY_TIMELINE_OPTIONS = [
  'Within 7 days',
  'Within 15 days',
  'Within 30 days',
  'Within 45 days',
  'Within 60 days',
  'As per project schedule',
];
