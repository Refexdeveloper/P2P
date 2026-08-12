export type InvoiceStatus =
  | 'Pending Verification'
  | 'Matched'
  | 'Discrepancy'
  | 'Approved for Payment'
  | 'On Hold'
  | 'Pending Manager Approval'
  | 'Paid';

export type PaymentStatus = 'Pending Payment' | 'Paid' | 'Overdue';

export interface PaymentDetails {
  paymentDate: string;
  paymentMode: 'NEFT' | 'RTGS' | 'IMPS' | 'Cheque' | 'DD';
  bankAccount: string;
  utrReference: string;
  amountPaid: number;
  remarks: string;
  receiptFileName?: string;
  receiptFileSize?: string;
  uploadedBy: string;
  uploadedDate: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  invoicedQty: number;
  invoicedUnitPrice: number;
  invoicedTotal: number;
  poQty: number;
  poUnitPrice: number;
  poTotal: number;
  grnQty: number;
  qtyMatch: boolean;
  priceMatch: boolean;
  grnMatch: boolean;
}

export interface InvoiceData {
  id?: number;
  invoiceNumber: string;
  invoiceDate: string;
  submittedDate: string;
  dueDate: string;
  vendor: string;
  vendorGSTIN: string;
  vendorAddress: string;
  poNumber: string;
  grnNumber: string;
  poStatus?: string;
  hasInvoiceFile?: boolean;
  invoiceFileName?: string | null;
  statusRaw?: string;
  prId: string;
  prTitle: string;
  department: string;
  requester: string;
  paymentTerms: string;
  lineItems: InvoiceLineItem[];
  invoiceSubtotal: number;
  invoiceGST: number;
  invoiceGrandTotal: number;
  poGrandTotal: number;
  grnReceivedValue: number;
  matchStatus: {
    poMatch: boolean;
    grnMatch: boolean;
    priceMatch: boolean;
    overallMatch: boolean;
  };
  discrepancies: string[];
  status: InvoiceStatus;
  priority: 'high' | 'medium' | 'low';
  accountsRemarks: string;
  approvalHistory: {
    action: string;
    performedBy: string;
    role: string;
    date: string;
    notes: string;
  }[];
  paymentStatus?: PaymentStatus;
  paymentDetails?: PaymentDetails;
}

export const invoiceData: InvoiceData[] = [
  {
    invoiceNumber: 'INV-CF-2024-0891',
    invoiceDate: '2024-02-27',
    submittedDate: '2024-02-28',
    dueDate: '2024-03-28',
    vendor: 'Comfort Furniture Co',
    vendorGSTIN: '29AABCC1234F1Z5',
    vendorAddress: '45, Industrial Estate, Peenya, Bangalore - 560058, Karnataka',
    poNumber: 'PO-2024-1004',
    grnNumber: 'GRN-2024-0021',
    prId: 'PR-2024-002',
    prTitle: 'Office Furniture - Ergonomic Chairs',
    department: 'Administration',
    requester: 'Meera Iyer',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: '1',
        description: 'Ergonomic Office Chair with Lumbar Support',
        invoicedQty: 30,
        invoicedUnitPrice: 15000,
        invoicedTotal: 450000,
        poQty: 30,
        poUnitPrice: 15000,
        poTotal: 450000,
        grnQty: 30,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
    ],
    invoiceSubtotal: 450000,
    invoiceGST: 81000,
    invoiceGrandTotal: 531000,
    poGrandTotal: 531000,
    grnReceivedValue: 531000,
    matchStatus: {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: [],
    status: 'Matched',
    priority: 'medium',
    accountsRemarks: 'All three documents match perfectly. Ready for payment approval.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-02-28 09:00 AM',
        notes: 'Invoice INV-CF-2024-0891 submitted by Comfort Furniture Co.',
      },
      {
        action: '3-Way Match Completed',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-02-28 11:30 AM',
        notes: 'PO, GRN and Invoice all match. No discrepancies found.',
      },
    ],
    paymentStatus: 'Pending Payment',
  },
  {
    invoiceNumber: 'INV-OM-2024-0445',
    invoiceDate: '2024-02-12',
    submittedDate: '2024-02-13',
    dueDate: '2024-02-27',
    vendor: 'OfficeMax Supplies Co',
    vendorGSTIN: '27AABCO5678G1Z3',
    vendorAddress: '12, Andheri Industrial Area, Mumbai - 400053, Maharashtra',
    poNumber: 'PO-2024-1008',
    grnNumber: 'GRN-2024-0022',
    prId: 'PR-2024-007',
    prTitle: 'Office Stationery & Supplies - Q1',
    department: 'Administration',
    requester: 'Kavitha Reddy',
    paymentTerms: 'Net 15',
    lineItems: [
      {
        id: '1',
        description: 'A4 Paper Ream - 80 GSM (Box of 5 reams)',
        invoicedQty: 100,
        invoicedUnitPrice: 450,
        invoicedTotal: 45000,
        poQty: 100,
        poUnitPrice: 450,
        poTotal: 45000,
        grnQty: 100,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '2',
        description: 'Ballpoint Pens - Blue/Black (Box of 50)',
        invoicedQty: 30,
        invoicedUnitPrice: 310,
        invoicedTotal: 9300,
        poQty: 30,
        poUnitPrice: 280,
        poTotal: 8400,
        grnQty: 25,
        qtyMatch: false,
        priceMatch: false,
        grnMatch: false,
      },
      {
        id: '3',
        description: 'Sticky Notes - 3x3 inch (Pack of 12)',
        invoicedQty: 50,
        invoicedUnitPrice: 120,
        invoicedTotal: 6000,
        poQty: 50,
        poUnitPrice: 120,
        poTotal: 6000,
        grnQty: 50,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '4',
        description: 'File Folders - A4 (Box of 100)',
        invoicedQty: 20,
        invoicedUnitPrice: 650,
        invoicedTotal: 13000,
        poQty: 20,
        poUnitPrice: 650,
        poTotal: 13000,
        grnQty: 20,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
    ],
    invoiceSubtotal: 73300,
    invoiceGST: 8796,
    invoiceGrandTotal: 82096,
    poGrandTotal: 81088,
    grnReceivedValue: 71000,
    matchStatus: {
      poMatch: false,
      grnMatch: false,
      priceMatch: false,
      overallMatch: false,
    },
    discrepancies: [
      'Ballpoint Pens: Invoice price ₹310 vs PO price ₹280 (difference: ₹30/unit)',
      'Ballpoint Pens: Invoice qty 30 vs GRN received qty 25 (5 units not yet received)',
      'Invoice total ₹82,096 exceeds PO total ₹81,088 by ₹1,008',
    ],
    status: 'Discrepancy',
    priority: 'high',
    accountsRemarks: 'Price and quantity discrepancy found for Ballpoint Pens. Vendor to issue credit note or revised invoice.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-02-13 10:15 AM',
        notes: 'Invoice submitted by OfficeMax Supplies Co.',
      },
      {
        action: 'Discrepancy Identified',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-02-13 02:00 PM',
        notes: 'Price mismatch and GRN quantity shortfall found for Ballpoint Pens. Invoice put on hold.',
      },
    ],
  },
  {
    invoiceNumber: 'INV-CA-2024-0112',
    invoiceDate: '2024-02-06',
    submittedDate: '2024-02-07',
    dueDate: '2024-05-07',
    vendor: 'CoolAir Services Pvt Ltd',
    vendorGSTIN: '29AABCC9876K1Z1',
    vendorAddress: '78, Rajajinagar Industrial Area, Bangalore - 560044, Karnataka',
    poNumber: 'PO-2024-1009',
    grnNumber: 'GRN-2024-0025',
    prId: 'PR-2024-008',
    prTitle: 'Annual Maintenance Contract - HVAC Systems',
    department: 'Facilities',
    requester: 'Dinesh Sharma',
    paymentTerms: 'Quarterly',
    lineItems: [
      {
        id: '1',
        description: 'HVAC Annual Maintenance Contract - 8 Units',
        invoicedQty: 1,
        invoicedUnitPrice: 240000,
        invoicedTotal: 240000,
        poQty: 1,
        poUnitPrice: 240000,
        poTotal: 240000,
        grnQty: 1,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '2',
        description: 'Emergency Call-out Service (12 visits)',
        invoicedQty: 12,
        invoicedUnitPrice: 5000,
        invoicedTotal: 60000,
        poQty: 12,
        poUnitPrice: 5000,
        poTotal: 60000,
        grnQty: 12,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
    ],
    invoiceSubtotal: 300000,
    invoiceGST: 54000,
    invoiceGrandTotal: 354000,
    poGrandTotal: 354000,
    grnReceivedValue: 354000,
    matchStatus: {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: [],
    status: 'Approved for Payment',
    priority: 'medium',
    accountsRemarks: 'Full match confirmed. Payment approved and scheduled for Q1 disbursement.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-02-07 08:30 AM',
        notes: 'Invoice submitted by CoolAir Services.',
      },
      {
        action: '3-Way Match Completed',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-02-07 10:00 AM',
        notes: 'All documents verified and matched.',
      },
      {
        action: 'Approved for Payment',
        performedBy: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-02-07 03:00 PM',
        notes: 'Payment approved. Scheduled for quarterly disbursement cycle.',
      },
    ],
    paymentStatus: 'Paid',
    paymentDetails: {
      paymentDate: '2024-02-15',
      paymentMode: 'NEFT',
      bankAccount: 'HDFC Bank - A/c ****4521',
      utrReference: 'HDFC24021512345678',
      amountPaid: 354000,
      remarks: 'Q1 2024 HVAC AMC payment processed as per schedule.',
      receiptFileName: 'payment_receipt_INV-CA-2024-0112.pdf',
      receiptFileSize: '245 KB',
      uploadedBy: 'Ramesh Iyer',
      uploadedDate: '2024-02-15 04:30 PM',
    },
  },
  {
    invoiceNumber: 'INV-SG-2024-0334',
    invoiceDate: '2024-02-20',
    submittedDate: '2024-02-21',
    dueDate: '2024-04-05',
    vendor: 'SafeGuard Industries Ltd',
    vendorGSTIN: '27AABCS4321H1Z7',
    vendorAddress: '23, MIDC Industrial Area, Pune - 411019, Maharashtra',
    poNumber: 'PO-2024-1006',
    grnNumber: 'GRN-2024-0023',
    prId: 'PR-2024-005',
    prTitle: 'Industrial Safety Equipment - Q1 2024',
    department: 'Operations',
    requester: 'Arjun Mehta',
    paymentTerms: 'Net 45',
    lineItems: [
      {
        id: '1',
        description: 'Hard Hat - Type II, Class E (ANSI Z89.1)',
        invoicedQty: 200,
        invoicedUnitPrice: 850,
        invoicedTotal: 170000,
        poQty: 200,
        poUnitPrice: 850,
        poTotal: 170000,
        grnQty: 200,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '2',
        description: 'Safety Harness Full Body - EN361 Certified',
        invoicedQty: 50,
        invoicedUnitPrice: 4200,
        invoicedTotal: 210000,
        poQty: 50,
        poUnitPrice: 4200,
        poTotal: 210000,
        grnQty: 50,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '3',
        description: 'Safety Boots - Steel Toe Cap, Size 6-12',
        invoicedQty: 100,
        invoicedUnitPrice: 3500,
        invoicedTotal: 350000,
        poQty: 100,
        poUnitPrice: 3500,
        poTotal: 350000,
        grnQty: 80,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: false,
      },
    ],
    invoiceSubtotal: 730000,
    invoiceGST: 131400,
    invoiceGrandTotal: 861400,
    poGrandTotal: 861400,
    grnReceivedValue: 660000,
    matchStatus: {
      poMatch: true,
      grnMatch: false,
      priceMatch: true,
      overallMatch: false,
    },
    discrepancies: [
      'Safety Boots: Invoice qty 100 vs GRN received qty 80 (20 units rejected/pending)',
      'GRN received value ₹7,78,800 does not match invoice total ₹8,61,400',
    ],
    status: 'On Hold',
    priority: 'high',
    accountsRemarks: 'GRN mismatch due to 20 damaged boots. Payment on hold until replacement GRN is received.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-02-21 09:45 AM',
        notes: 'Invoice submitted by SafeGuard Industries.',
      },
      {
        action: 'GRN Mismatch Found',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-02-21 11:30 AM',
        notes: 'GRN shows 20 boots rejected. Invoice claims full 100 units. Payment put on hold.',
      },
    ],
  },
  {
    invoiceNumber: 'INV-TS-2024-0678',
    invoiceDate: '2024-03-01',
    submittedDate: '2024-03-02',
    dueDate: '2024-04-01',
    vendor: 'Tech Solutions Pvt Ltd',
    vendorGSTIN: '29AABCT7654J1Z2',
    vendorAddress: 'Tech Park, Tower C, Whitefield, Bangalore - 560066, Karnataka',
    poNumber: 'PO-2024-1003',
    grnNumber: 'GRN-2024-0024',
    prId: 'PR-2024-001',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    department: 'IT Department',
    requester: 'Rajesh Kumar',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: '1',
        description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD',
        invoicedQty: 50,
        invoicedUnitPrice: 75000,
        invoicedTotal: 3750000,
        poQty: 50,
        poUnitPrice: 75000,
        poTotal: 3750000,
        grnQty: 0,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: false,
      },
    ],
    invoiceSubtotal: 3750000,
    invoiceGST: 675000,
    invoiceGrandTotal: 4425000,
    poGrandTotal: 4425000,
    grnReceivedValue: 0,
    matchStatus: {
      poMatch: true,
      grnMatch: false,
      priceMatch: true,
      overallMatch: false,
    },
    discrepancies: [
      'GRN not yet completed — goods not received at warehouse',
      'Invoice submitted before delivery. Cannot process payment without GRN confirmation.',
    ],
    status: 'Pending Verification',
    priority: 'high',
    accountsRemarks: 'Invoice received but GRN pending. Awaiting delivery confirmation from store team.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-03-02 08:00 AM',
        notes: 'Invoice submitted by Tech Solutions Pvt Ltd before delivery.',
      },
    ],
  },
  {
    invoiceNumber: 'INV-EP-2024-0556',
    invoiceDate: '2024-01-28',
    submittedDate: '2024-01-29',
    dueDate: '2024-02-12',
    vendor: 'ElectroParts Distributors',
    vendorGSTIN: '29AABCE3456L1Z9',
    vendorAddress: '56, Electronics City Phase 1, Bangalore - 560100, Karnataka',
    poNumber: 'PO-2024-1002',
    grnNumber: 'GRN-2024-0018',
    prId: 'PR-2024-003',
    prTitle: 'Electrical Components - Production Line',
    department: 'Production',
    requester: 'Suresh Nair',
    paymentTerms: 'Net 15',
    lineItems: [
      {
        id: '1',
        description: 'Circuit Breakers - 32A MCB (Box of 20)',
        invoicedQty: 50,
        invoicedUnitPrice: 2800,
        invoicedTotal: 140000,
        poQty: 50,
        poUnitPrice: 2800,
        poTotal: 140000,
        grnQty: 50,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '2',
        description: 'Industrial Cables - 4 Core 10mm (100m roll)',
        invoicedQty: 30,
        invoicedUnitPrice: 8500,
        invoicedTotal: 255000,
        poQty: 30,
        poUnitPrice: 8500,
        poTotal: 255000,
        grnQty: 30,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
    ],
    invoiceSubtotal: 395000,
    invoiceGST: 71100,
    invoiceGrandTotal: 466100,
    poGrandTotal: 466100,
    grnReceivedValue: 466100,
    matchStatus: {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: [],
    status: 'Approved for Payment',
    priority: 'high',
    accountsRemarks: 'All documents match. Payment due date approaching.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-01-29 09:00 AM',
        notes: 'Invoice submitted by ElectroParts Distributors.',
      },
      {
        action: '3-Way Match Completed',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-01-29 11:00 AM',
        notes: 'All documents verified and matched.',
      },
      {
        action: 'Approved for Payment',
        performedBy: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-01-29 02:00 PM',
        notes: 'Payment approved. Due date: 2024-02-12.',
      },
    ],
    paymentStatus: 'Overdue',
  },
  {
    invoiceNumber: 'INV-MS-2024-0223',
    invoiceDate: '2024-02-18',
    submittedDate: '2024-02-19',
    dueDate: '2024-03-20',
    vendor: 'MediSupply Healthcare',
    vendorGSTIN: '27AABCM8765N1Z4',
    vendorAddress: '89, Andheri West, Mumbai - 400058, Maharashtra',
    poNumber: 'PO-2024-1007',
    grnNumber: 'GRN-2024-0020',
    prId: 'PR-2024-006',
    prTitle: 'First Aid & Medical Supplies',
    department: 'HR & Safety',
    requester: 'Anjali Desai',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: '1',
        description: 'First Aid Kit - Industrial Grade (50 items)',
        invoicedQty: 20,
        invoicedUnitPrice: 1500,
        invoicedTotal: 30000,
        poQty: 20,
        poUnitPrice: 1500,
        poTotal: 30000,
        grnQty: 20,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '2',
        description: 'Digital Thermometer - Non-contact IR',
        invoicedQty: 10,
        invoicedUnitPrice: 2200,
        invoicedTotal: 22000,
        poQty: 10,
        poUnitPrice: 2200,
        poTotal: 22000,
        grnQty: 10,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
      {
        id: '3',
        description: 'Disposable Face Masks - N95 (Box of 100)',
        invoicedQty: 50,
        invoicedUnitPrice: 850,
        invoicedTotal: 42500,
        poQty: 50,
        poUnitPrice: 850,
        poTotal: 42500,
        grnQty: 50,
        qtyMatch: true,
        priceMatch: true,
        grnMatch: true,
      },
    ],
    invoiceSubtotal: 94500,
    invoiceGST: 11340,
    invoiceGrandTotal: 105840,
    poGrandTotal: 105840,
    grnReceivedValue: 105840,
    matchStatus: {
      poMatch: true,
      grnMatch: true,
      priceMatch: true,
      overallMatch: true,
    },
    discrepancies: [],
    status: 'Approved for Payment',
    priority: 'medium',
    accountsRemarks: 'Full match confirmed. Ready for payment processing.',
    approvalHistory: [
      {
        action: 'Invoice Submitted',
        performedBy: 'Vendor Portal',
        role: 'Vendor',
        date: '2024-02-19 10:30 AM',
        notes: 'Invoice submitted by MediSupply Healthcare.',
      },
      {
        action: '3-Way Match Completed',
        performedBy: 'Priya Menon',
        role: 'Accounts Executive',
        date: '2024-02-19 01:00 PM',
        notes: 'All documents verified and matched.',
      },
      {
        action: 'Approved for Payment',
        performedBy: 'Ramesh Iyer',
        role: 'Accounts Manager',
        date: '2024-02-19 03:30 PM',
        notes: 'Payment approved. Due date: 2024-03-20.',
      },
    ],
    paymentStatus: 'Pending Payment',
  },
];
