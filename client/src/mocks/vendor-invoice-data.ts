export type VendorInvoiceStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Verification'
  | 'Approved for Payment'
  | 'Paid'
  | 'Discrepancy'
  | 'Rejected';

export interface VendorInvoiceLineItem {
  id: string;
  poLineRef: string;
  description: string;
  unit: string;
  poQty: number;
  deliveredQty: number;
  invoicedQty: number;
  unitPrice: number;
  total: number;
}

export interface VendorInvoiceData {
  invoiceNumber: string;
  poNumber: string;
  prId: string;
  prTitle: string;
  vendorName: string;
  vendorCode: string;
  vendorContact: string;
  vendorEmail: string;
  invoiceDate: string;
  submittedDate: string;
  dueDate: string;
  grnNumber: string;
  grnDate: string;
  department: string;
  status: VendorInvoiceStatus;
  priority: 'high' | 'medium' | 'low';
  lineItems: VendorInvoiceLineItem[];
  subtotal: number;
  gstPercentage: number;
  taxAmount: number;
  grandTotal: number;
  paymentTerms: string;
  bankAccount: string;
  ifscCode: string;
  bankName: string;
  remarks?: string;
  discrepancyReason?: string;
  paymentDate?: string;
  paymentRef?: string;
  attachments: string[];
}

export const vendorInvoiceData: VendorInvoiceData[] = [
  {
    invoiceNumber: 'INV-TSP-2024-0041',
    poNumber: 'PO-2024-1003',
    prId: 'PR-2024-001',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    vendorName: 'Tech Solutions Pvt Ltd',
    vendorCode: 'VND-0041',
    vendorContact: 'Arun Sharma',
    vendorEmail: 'arun.sharma@techsolutions.in',
    invoiceDate: '2024-02-16',
    submittedDate: '2024-02-17',
    dueDate: '2024-03-18',
    grnNumber: 'GRN-2024-0091',
    grnDate: '2024-02-15',
    department: 'IT Department',
    status: 'Under Verification',
    priority: 'high',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD', unit: 'Nos', poQty: 50, deliveredQty: 50, invoicedQty: 50, unitPrice: 75000, total: 3750000 }
    ],
    subtotal: 3750000,
    gstPercentage: 18,
    taxAmount: 675000,
    grandTotal: 4425000,
    paymentTerms: 'Net 30',
    bankAccount: 'XXXX XXXX 4512',
    ifscCode: 'HDFC0001234',
    bankName: 'HDFC Bank',
    remarks: 'All 50 units delivered and verified against GRN. Requesting payment as per PO terms.',
    attachments: ['invoice_TSP_0041.pdf', 'delivery_challan.pdf', 'eway_bill.pdf'],
  },
  {
    invoiceNumber: 'INV-SGI-2024-0078',
    poNumber: 'PO-2024-1006',
    prId: 'PR-2024-005',
    prTitle: 'Industrial Safety Equipment - Q1 2024',
    vendorName: 'SafeGuard Industries Ltd',
    vendorCode: 'VND-0078',
    vendorContact: 'Priya Menon',
    vendorEmail: 'priya.menon@safeguard.in',
    invoiceDate: '2024-02-19',
    submittedDate: '2024-02-20',
    dueDate: '2024-04-05',
    grnNumber: 'GRN-2024-0094',
    grnDate: '2024-02-18',
    department: 'Operations',
    status: 'Approved for Payment',
    priority: 'high',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'Hard Hat - Type II, Class E (ANSI Z89.1)', unit: 'Nos', poQty: 200, deliveredQty: 200, invoicedQty: 200, unitPrice: 850, total: 170000 },
      { id: 'L2', poLineRef: 'PO-L2', description: 'Safety Harness Full Body - EN361 Certified', unit: 'Nos', poQty: 50, deliveredQty: 50, invoicedQty: 50, unitPrice: 4200, total: 210000 },
      { id: 'L3', poLineRef: 'PO-L3', description: 'Safety Boots - Steel Toe Cap, Size 6-12', unit: 'Pairs', poQty: 100, deliveredQty: 100, invoicedQty: 100, unitPrice: 3500, total: 350000 },
    ],
    subtotal: 730000,
    gstPercentage: 18,
    taxAmount: 131400,
    grandTotal: 861400,
    paymentTerms: 'Net 45',
    bankAccount: 'XXXX XXXX 7834',
    ifscCode: 'ICIC0009876',
    bankName: 'ICICI Bank',
    remarks: 'Complete delivery with ISI certification attached. 3-way match verified.',
    attachments: ['invoice_SGI_0078.pdf', 'isi_certificates.pdf'],
  },
  {
    invoiceNumber: 'INV-CAS-2024-0055',
    poNumber: 'PO-2024-1009',
    prId: 'PR-2024-008',
    prTitle: 'Annual Maintenance Contract - HVAC Systems',
    vendorName: 'CoolAir Services Pvt Ltd',
    vendorCode: 'VND-0055',
    vendorContact: 'Sanjay Verma',
    vendorEmail: 'sanjay.verma@coolair.in',
    invoiceDate: '2024-02-10',
    submittedDate: '2024-02-11',
    dueDate: '2024-03-12',
    grnNumber: 'GRN-2024-0088',
    grnDate: '2024-02-05',
    department: 'Facilities',
    status: 'Discrepancy',
    priority: 'medium',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'HVAC Annual Maintenance Contract - 8 Units', unit: 'Contract', poQty: 1, deliveredQty: 1, invoicedQty: 1, unitPrice: 240000, total: 240000 },
      { id: 'L2', poLineRef: 'PO-L2', description: 'Emergency Call-out Service (12 visits)', unit: 'Visits', poQty: 12, deliveredQty: 4, invoicedQty: 12, unitPrice: 5000, total: 60000 },
    ],
    subtotal: 300000,
    gstPercentage: 18,
    taxAmount: 54000,
    grandTotal: 354000,
    paymentTerms: 'Quarterly',
    bankAccount: 'XXXX XXXX 2291',
    ifscCode: 'SBIN0003456',
    bankName: 'State Bank of India',
    discrepancyReason: 'Invoice charges for 12 emergency visits but GRN records show only 4 visits completed. Vendor to resubmit for 4 visits or provide documentation for remaining 8.',
    attachments: ['invoice_CAS_0055.pdf'],
  },
  {
    invoiceNumber: 'INV-LTS-2024-0092',
    poNumber: 'PO-2024-1010',
    prId: 'PR-2024-009',
    prTitle: 'Laboratory Testing Equipment - Chemistry Lab',
    vendorName: 'LabTech Scientific Pvt Ltd',
    vendorCode: 'VND-0092',
    vendorContact: 'Dr. Kavitha Rao',
    vendorEmail: 'kavitha.rao@labtechscientific.in',
    invoiceDate: '2024-03-01',
    submittedDate: '2024-03-02',
    dueDate: '2024-04-01',
    grnNumber: 'GRN-2024-0102',
    grnDate: '2024-02-28',
    department: 'R&D',
    status: 'Submitted',
    priority: 'medium',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'HPLC System - Reverse Phase Chromatography', unit: 'System', poQty: 1, deliveredQty: 1, invoicedQty: 1, unitPrice: 850000, total: 850000 },
      { id: 'L2', poLineRef: 'PO-L2', description: 'Analytical Balance - 220g Capacity', unit: 'Nos', poQty: 3, deliveredQty: 3, invoicedQty: 3, unitPrice: 85000, total: 255000 },
      { id: 'L3', poLineRef: 'PO-L3', description: 'Digital pH Meter with Auto-calibration', unit: 'Nos', poQty: 5, deliveredQty: 3, invoicedQty: 3, unitPrice: 18000, total: 54000 },
    ],
    subtotal: 1159000,
    gstPercentage: 18,
    taxAmount: 208620,
    grandTotal: 1367620,
    paymentTerms: 'Net 30',
    bankAccount: 'XXXX XXXX 6643',
    ifscCode: 'AXIS0007788',
    bankName: 'Axis Bank',
    remarks: 'Invoice for partial delivery - 3 pH meters. Remaining 2 units will be delivered by March 15.',
    attachments: ['invoice_LTS_0092.pdf', 'calibration_certs.pdf', 'delivery_note.pdf'],
  },
  {
    invoiceNumber: 'INV-PPM-2024-0067',
    poNumber: 'PO-2024-1011',
    prId: 'PR-2024-010',
    prTitle: 'Promotional Merchandise - Annual Sales Conference',
    vendorName: 'PrintPro Marketing Ltd',
    vendorCode: 'VND-0067',
    vendorContact: 'Anand Krishnan',
    vendorEmail: 'anand.k@printpro.in',
    invoiceDate: '2024-02-23',
    submittedDate: '2024-02-24',
    dueDate: '2024-03-10',
    grnNumber: 'GRN-2024-0099',
    grnDate: '2024-02-22',
    department: 'Marketing',
    status: 'Paid',
    priority: 'low',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'Premium Corporate Pen Set (Logo Embossed)', unit: 'Sets', poQty: 500, deliveredQty: 500, invoicedQty: 500, unitPrice: 350, total: 175000 },
      { id: 'L2', poLineRef: 'PO-L2', description: 'Branded Tote Bag - Canvas 14oz', unit: 'Nos', poQty: 500, deliveredQty: 500, invoicedQty: 500, unitPrice: 280, total: 140000 },
      { id: 'L3', poLineRef: 'PO-L3', description: 'Customized Notebook - A5 Hardcover', unit: 'Nos', poQty: 500, deliveredQty: 500, invoicedQty: 500, unitPrice: 220, total: 110000 },
    ],
    subtotal: 425000,
    gstPercentage: 12,
    taxAmount: 51000,
    grandTotal: 476000,
    paymentTerms: 'Net 15',
    bankAccount: 'XXXX XXXX 9901',
    ifscCode: 'KOTAK0005566',
    bankName: 'Kotak Mahindra Bank',
    remarks: 'Full delivery completed. Payment received, thank you.',
    paymentDate: '2024-03-08',
    paymentRef: 'NEFT-KOTAK-20240308-7741',
    attachments: ['invoice_PPM_0067.pdf'],
  },
  {
    invoiceNumber: 'INV-CNS-2024-0033',
    poNumber: 'PO-2024-1007',
    prId: 'PR-2024-006',
    prTitle: 'Server Infrastructure Upgrade',
    vendorName: 'CloudNet Systems Pvt Ltd',
    vendorCode: 'VND-0033',
    vendorContact: 'Rohit Nair',
    vendorEmail: 'rohit.nair@cloudnetsystems.in',
    invoiceDate: '2024-04-16',
    submittedDate: '2024-04-17',
    dueDate: '2024-05-17',
    grnNumber: 'GRN-2024-0121',
    grnDate: '2024-04-15',
    department: 'IT Department',
    status: 'Draft',
    priority: 'high',
    lineItems: [
      { id: 'L1', poLineRef: 'PO-L1', description: 'Dell PowerEdge R750 Server - 2x Xeon Gold', unit: 'Nos', poQty: 4, deliveredQty: 4, invoicedQty: 4, unitPrice: 850000, total: 3400000 },
      { id: 'L2', poLineRef: 'PO-L2', description: 'NetApp AFF A250 Storage Array - 24TB', unit: 'Nos', poQty: 1, deliveredQty: 1, invoicedQty: 1, unitPrice: 1200000, total: 1200000 },
      { id: 'L3', poLineRef: 'PO-L3', description: '10GbE Network Switch - 48 Port', unit: 'Nos', poQty: 2, deliveredQty: 2, invoicedQty: 2, unitPrice: 180000, total: 360000 },
    ],
    subtotal: 4960000,
    gstPercentage: 18,
    taxAmount: 892800,
    grandTotal: 5852800,
    paymentTerms: '50% Advance, 50% on Delivery',
    bankAccount: 'XXXX XXXX 3312',
    ifscCode: 'HDFC0008833',
    bankName: 'HDFC Bank',
    remarks: 'Draft invoice prepared for review before submission.',
    attachments: ['invoice_CNS_draft.pdf', 'installation_report.pdf'],
  },
];
