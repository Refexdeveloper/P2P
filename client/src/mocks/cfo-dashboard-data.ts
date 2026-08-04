export const cfoDashboardKPIs = {
  totalPOAmount: 124850000,
  entityWiseSpend: 98420000,
  approvedPOAmount: 87650000,
  pendingPOAmount: 37200000,
  totalVendorPayments: 72340000,
  budgetUtilization: 74.2
};

export const entityWisePOSummary = [
  {
    entityName: 'Entity A - Manufacturing',
    code: 'ENT-A',
    totalPOCount: 38,
    totalPOAmount: 48500000,
    approvedAmount: 36200000,
    pendingAmount: 12300000,
    color: '#14B8A6'
  },
  {
    entityName: 'Entity B - Services',
    code: 'ENT-B',
    totalPOCount: 29,
    totalPOAmount: 32400000,
    approvedAmount: 24100000,
    pendingAmount: 8300000,
    color: '#F59E0B'
  },
  {
    entityName: 'Entity C - Retail',
    code: 'ENT-C',
    totalPOCount: 22,
    totalPOAmount: 26750000,
    approvedAmount: 18900000,
    pendingAmount: 7850000,
    color: '#10B981'
  },
  {
    entityName: 'Holding Company',
    code: 'HOLD',
    totalPOCount: 14,
    totalPOAmount: 17200000,
    approvedAmount: 8450000,
    pendingAmount: 8750000,
    color: '#6366F1'
  }
];

export const monthlyPOTrend = [
  { month: 'Aug', entityA: 3200000, entityB: 2100000, entityC: 1800000, holding: 900000 },
  { month: 'Sep', entityA: 4100000, entityB: 2800000, entityC: 2200000, holding: 1100000 },
  { month: 'Oct', entityA: 3800000, entityB: 3200000, entityC: 2600000, holding: 1400000 },
  { month: 'Nov', entityA: 5200000, entityB: 3600000, entityC: 3100000, holding: 1800000 },
  { month: 'Dec', entityA: 4600000, entityB: 2900000, entityC: 2400000, holding: 1200000 },
  { month: 'Jan', entityA: 6100000, entityB: 4200000, entityC: 3800000, holding: 2100000 }
];

export const recentPurchaseOrders = [
  {
    poNumber: 'PO-2024-1101',
    entity: 'Entity A - Manufacturing',
    vendorName: 'Siemens Industrial Solutions',
    poAmount: 8500000,
    poDate: '2024-01-20',
    status: 'Approved'
  },
  {
    poNumber: 'PO-2024-1102',
    entity: 'Entity B - Services',
    vendorName: 'SAP India Pvt Ltd',
    poAmount: 6200000,
    poDate: '2024-01-19',
    status: 'Pending Approval'
  },
  {
    poNumber: 'PO-2024-1103',
    entity: 'Entity C - Retail',
    vendorName: 'Shopify Plus Partners',
    poAmount: 5800000,
    poDate: '2024-01-18',
    status: 'Approved'
  },
  {
    poNumber: 'PO-2024-1104',
    entity: 'Entity A - Manufacturing',
    vendorName: 'ABB Automation Ltd',
    poAmount: 7200000,
    poDate: '2024-01-17',
    status: 'Pending Approval'
  },
  {
    poNumber: 'PO-2024-1105',
    entity: 'Entity B - Services',
    vendorName: 'Amazon Web Services',
    poAmount: 4800000,
    poDate: '2024-01-16',
    status: 'Approved'
  },
  {
    poNumber: 'PO-2024-1106',
    entity: 'Holding Company',
    vendorName: 'Deloitte Consulting',
    poAmount: 3900000,
    poDate: '2024-01-15',
    status: 'Approved'
  },
  {
    poNumber: 'PO-2024-1107',
    entity: 'Entity C - Retail',
    vendorName: 'Salesforce India',
    poAmount: 3200000,
    poDate: '2024-01-14',
    status: 'Pending Approval'
  },
  {
    poNumber: 'PO-2024-1108',
    entity: 'Entity A - Manufacturing',
    vendorName: 'Honeywell Process Solutions',
    poAmount: 2800000,
    poDate: '2024-01-13',
    status: 'Rejected'
  }
];

export const topVendorsByPOAmount = [
  { vendorName: 'Siemens Industrial Solutions', entity: 'Entity A - Manufacturing', totalPOAmount: 18400000, poCount: 6 },
  { vendorName: 'SAP India Pvt Ltd', entity: 'Entity B - Services', totalPOAmount: 14200000, poCount: 4 },
  { vendorName: 'ABB Automation Ltd', entity: 'Entity A - Manufacturing', totalPOAmount: 12600000, poCount: 5 },
  { vendorName: 'Amazon Web Services', entity: 'Entity B - Services', totalPOAmount: 9800000, poCount: 7 },
  { vendorName: 'Deloitte Consulting', entity: 'Holding Company', totalPOAmount: 8900000, poCount: 3 },
  { vendorName: 'Shopify Plus Partners', entity: 'Entity C - Retail', totalPOAmount: 7600000, poCount: 4 },
  { vendorName: 'Honeywell Process Solutions', entity: 'Entity A - Manufacturing', totalPOAmount: 6800000, poCount: 3 },
  { vendorName: 'Salesforce India', entity: 'Entity C - Retail', totalPOAmount: 5400000, poCount: 5 }
];
