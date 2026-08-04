/** Demo vendor catalog — all route to test inbox for RFQ emails */
export const VENDOR_CATALOG = [
  { id: 'v1', name: 'Tech Solutions Ltd', email: 'sathishkumar.r@refex.co.in' },
  { id: 'v2', name: 'Global Supplies Inc', email: 'sathishkumar.r@refex.co.in' },
  { id: 'v3', name: 'Prime Vendors Co', email: 'sathishkumar.r@refex.co.in' },
  { id: 'v4', name: 'Alpha Industrial', email: 'sathishkumar.r@refex.co.in' },
  { id: 'v5', name: 'Beta Traders', email: 'sathishkumar.r@refex.co.in' },
] as const;

export const PAYMENT_TERM_OPTIONS = ['Net 30', 'Net 45', 'Net 60', 'Advance 50%', 'On Delivery'] as const;
