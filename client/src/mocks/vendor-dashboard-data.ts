export interface VendorKPIData {
  openRFQs: number;
  pendingQuotes: number;
  reQuoteRequested: number;
  pendingPOAcceptance: number;
  acceptedPOs: number;
  draftInvoices: number;
  pendingInvoices: number;
  discrepancyInvoices: number;
  paidInvoices: number;
  totalPaidAmount: number;
  totalPendingPayment: number;
  totalActiveOrderValue: number;
}

export interface VendorAlertItem {
  id: string;
  type: 'rfq_deadline' | 'po_pending' | 'invoice_discrepancy' | 'payment_received' | 'requote' | 'invoice_approved';
  title: string;
  description: string;
  refNumber: string;
  dueDate?: string;
  amount?: number;
  urgency: 'critical' | 'warning' | 'info' | 'success';
  timestamp: string;
}

export interface VendorRFQSummary {
  rfqNumber: string;
  prTitle: string;
  buyerName: string;
  dueDate: string;
  estimatedValue: number;
  status: string;
  priority: string;
}

export interface VendorPOSummary {
  poNumber: string;
  prTitle: string;
  grandTotal: number;
  acceptanceDueDate: string;
  expectedDeliveryDate: string;
  status: string;
  priority: string;
}

export interface VendorInvoiceSummary {
  invoiceNumber: string;
  prTitle: string;
  grandTotal: number;
  dueDate: string;
  status: string;
  priority: string;
}

export const vendorKPIData: VendorKPIData = {
  openRFQs: 6,
  pendingQuotes: 2,
  reQuoteRequested: 1,
  pendingPOAcceptance: 3,
  acceptedPOs: 2,
  draftInvoices: 1,
  pendingInvoices: 2,
  discrepancyInvoices: 1,
  paidInvoices: 1,
  totalPaidAmount: 476000,
  totalPendingPayment: 5852800,
  totalActiveOrderValue: 13970120,
};

export const vendorAlerts: VendorAlertItem[] = [
  {
    id: 'a1',
    type: 'rfq_deadline',
    title: 'RFQ Closing Tomorrow',
    description: 'Quote submission for Conference Room Furniture is due in 1 day',
    refNumber: 'RFQ-2024-0097',
    dueDate: '2024-03-28',
    amount: 680000,
    urgency: 'critical',
    timestamp: '2024-03-27T09:00:00',
  },
  {
    id: 'a2',
    type: 'requote',
    title: 'Re-quote Requested',
    description: 'Buyer has requested revised pricing for AC Unit installation',
    refNumber: 'RFQ-2024-0087',
    amount: 510000,
    urgency: 'critical',
    timestamp: '2024-03-26T14:30:00',
  },
  {
    id: 'a3',
    type: 'po_pending',
    title: 'PO Awaiting Acceptance',
    description: 'Promotional Merchandise PO acceptance overdue by 2 days',
    refNumber: 'PO-2024-1011',
    amount: 476000,
    urgency: 'warning',
    timestamp: '2024-03-25T11:00:00',
  },
  {
    id: 'a4',
    type: 'invoice_discrepancy',
    title: 'Invoice Discrepancy Raised',
    description: 'Accounts team flagged discrepancy on emergency visit count',
    refNumber: 'INV-CAS-2024-0055',
    amount: 354000,
    urgency: 'warning',
    timestamp: '2024-03-24T16:00:00',
  },
  {
    id: 'a5',
    type: 'invoice_approved',
    title: 'Invoice Approved for Payment',
    description: 'Safety Equipment invoice cleared — payment scheduled by Apr 5',
    refNumber: 'INV-SGI-2024-0078',
    amount: 861400,
    urgency: 'success',
    timestamp: '2024-03-23T10:00:00',
  },
  {
    id: 'a6',
    type: 'payment_received',
    title: 'Payment Received',
    description: 'NEFT payment received for Promotional Merchandise invoice',
    refNumber: 'INV-PPM-2024-0067',
    amount: 476000,
    urgency: 'success',
    timestamp: '2024-03-08T12:00:00',
  },
];

export const vendorRFQSummary: VendorRFQSummary[] = [
  {
    rfqNumber: 'RFQ-2024-0097',
    prTitle: 'Conference Room Furniture - New HQ',
    buyerName: 'Arjun Mehta',
    dueDate: '2024-03-28',
    estimatedValue: 680000,
    status: 'Pending Quote',
    priority: 'Medium',
  },
  {
    rfqNumber: 'RFQ-2024-0091',
    prTitle: 'Office Laptop Procurement - Q1 2024',
    buyerName: 'Arjun Mehta',
    dueDate: '2024-03-15',
    estimatedValue: 1250000,
    status: 'Pending Quote',
    priority: 'High',
  },
  {
    rfqNumber: 'RFQ-2024-0087',
    prTitle: 'AC Unit Installation - Server Room',
    buyerName: 'Priya Sharma',
    dueDate: '2024-03-05',
    estimatedValue: 480000,
    status: 'Re-quote Requested',
    priority: 'High',
  },
  {
    rfqNumber: 'RFQ-2024-0094',
    prTitle: 'CCTV Surveillance System - Warehouse',
    buyerName: 'Deepak Nair',
    dueDate: '2024-03-20',
    estimatedValue: 320000,
    status: 'Quote Submitted',
    priority: 'Medium',
  },
];

export const vendorPOSummary: VendorPOSummary[] = [
  {
    poNumber: 'PO-2024-1003',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    grandTotal: 4425000,
    acceptanceDueDate: '2024-01-27',
    expectedDeliveryDate: '2024-02-15',
    status: 'Pending Acceptance',
    priority: 'high',
  },
  {
    poNumber: 'PO-2024-1009',
    prTitle: 'Annual Maintenance Contract - HVAC',
    grandTotal: 354000,
    acceptanceDueDate: '2024-02-02',
    expectedDeliveryDate: '2024-02-05',
    status: 'Pending Acceptance',
    priority: 'medium',
  },
  {
    poNumber: 'PO-2024-1011',
    prTitle: 'Promotional Merchandise - Sales Conference',
    grandTotal: 476000,
    acceptanceDueDate: '2024-02-05',
    expectedDeliveryDate: '2024-02-22',
    status: 'Pending Acceptance',
    priority: 'low',
  },
];

export const vendorInvoiceSummary: VendorInvoiceSummary[] = [
  {
    invoiceNumber: 'INV-CNS-2024-0033',
    prTitle: 'Server Infrastructure Upgrade',
    grandTotal: 5852800,
    dueDate: '2024-05-17',
    status: 'Draft',
    priority: 'high',
  },
  {
    invoiceNumber: 'INV-LTS-2024-0092',
    prTitle: 'Laboratory Testing Equipment',
    grandTotal: 1367620,
    dueDate: '2024-04-01',
    status: 'Submitted',
    priority: 'medium',
  },
  {
    invoiceNumber: 'INV-TSP-2024-0041',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    grandTotal: 4425000,
    dueDate: '2024-03-18',
    status: 'Under Verification',
    priority: 'high',
  },
  {
    invoiceNumber: 'INV-CAS-2024-0055',
    prTitle: 'Annual Maintenance Contract - HVAC',
    grandTotal: 354000,
    dueDate: '2024-03-12',
    status: 'Discrepancy',
    priority: 'medium',
  },
];
