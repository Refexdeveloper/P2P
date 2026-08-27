/** RFQ-related defaults for UAT. */

export const rfqDefaults = {
  vendorSearch: process.env.UAT_VENDOR_SEARCH || 'Tech Solutions',
  quoteAmount: '1500',
  zeroQuoteConfirmText: /₹\s*0|Rs\.?\s*0|zero/i,
  remarks: 'UAT RFQ remarks — automated vendor recommendation',
};
