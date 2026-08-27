/** Default PR payload values for UAT (overridable via env). */

export function uniquePrTitle(prefix = 'UAT PR'): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix} ${stamp}`;
}

export const prDefaults = {
  requestType: 'Purchase Order' as const,
  flow: 'standard' as 'standard' | 'functional',
  vendorSelection: 'scm' as 'scm' | 'own',
  priority: 'Medium',
  justification:
    'Automated UAT business justification for purchase request validation. Covers operational need, expected benefits, and compliance evidence for end-to-end workflow testing.',
  lineItem: {
    itemName: process.env.UAT_ITEM_NAME || 'UAT Test Item',
    category: process.env.UAT_CATEGORY_NAME || 'IT Services',
    quantity: '1',
    unitPrice: '1000',
    description: 'UAT automated line item description',
  },
  entitySearch: process.env.UAT_ENTITY_SEARCH || '',
  billingAddress: 'UAT Billing Address, Test Campus',
  placeOfDelivery: 'UAT Delivery Site',
  expectedDeliveryTimeline: 'Within 30 days',
  paymentTerms: 'Net 30 Days',
  deliveryPoc: 'UAT POC / 9999999999',
};

export type PrFillOptions = {
  title?: string;
  flow?: 'standard' | 'functional';
  vendorSelection?: 'scm' | 'own';
  justification?: string;
  skipLineItem?: boolean;
  skipEntity?: boolean;
  skipBilling?: boolean;
};
