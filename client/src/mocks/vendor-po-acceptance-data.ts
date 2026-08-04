export interface VendorPOLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  specifications?: string;
}

export type VendorPOAcceptanceStatus = 'Pending Acceptance' | 'Accepted' | 'Rejected' | 'Partially Accepted';

export interface VendorPOData {
  poNumber: string;
  prId: string;
  prTitle: string;
  vendorName: string;
  vendorCode: string;
  vendorContact: string;
  vendorEmail: string;
  issuedBy: string;
  issuedByRole: string;
  issuedDate: string;
  acceptanceDueDate: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  specialInstructions: string;
  lineItems: VendorPOLineItem[];
  subtotal: number;
  gstPercentage: number;
  taxAmount: number;
  grandTotal: number;
  status: VendorPOAcceptanceStatus;
  priority: 'high' | 'medium' | 'low';
  department: string;
  requester: string;
  rejectionReason?: string;
  acceptanceDate?: string;
  acceptanceRemarks?: string;
  deliveryConfirmedDate?: string;
}

export const vendorPOAcceptanceData: VendorPOData[] = [
  {
    poNumber: 'PO-2024-1003',
    prId: 'PR-2024-001',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    vendorName: 'Tech Solutions Pvt Ltd',
    vendorCode: 'VND-0041',
    vendorContact: 'Arun Sharma',
    vendorEmail: 'arun.sharma@techsolutions.in',
    issuedBy: 'Neha Gupta',
    issuedByRole: 'SCM Executive',
    issuedDate: '2024-01-25',
    acceptanceDueDate: '2024-01-27',
    expectedDeliveryDate: '2024-02-15',
    deliveryAddress: 'Tech Park, Building A, 3rd Floor, Whitefield, Bangalore - 560066, Karnataka',
    paymentTerms: 'Net 30',
    specialInstructions: 'All laptops must be pre-configured with Windows 11 Pro and standard corporate software. Serial numbers to be shared before delivery.',
    lineItems: [
      { id: 'L1', description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD', quantity: 50, unit: 'Nos', unitPrice: 75000, total: 3750000, specifications: 'Intel Core i7-1355U, 16GB DDR4, 512GB NVMe SSD, 15.6\" FHD' }
    ],
    subtotal: 3750000,
    gstPercentage: 18,
    taxAmount: 675000,
    grandTotal: 4425000,
    status: 'Pending Acceptance',
    priority: 'high',
    department: 'IT Department',
    requester: 'Rajesh Kumar',
  },
  {
    poNumber: 'PO-2024-1006',
    prId: 'PR-2024-005',
    prTitle: 'Industrial Safety Equipment - Q1 2024',
    vendorName: 'SafeGuard Industries Ltd',
    vendorCode: 'VND-0078',
    vendorContact: 'Priya Menon',
    vendorEmail: 'priya.menon@safeguard.in',
    issuedBy: 'Neha Gupta',
    issuedByRole: 'SCM Executive',
    issuedDate: '2024-01-28',
    acceptanceDueDate: '2024-01-30',
    expectedDeliveryDate: '2024-02-20',
    deliveryAddress: 'Plant Site, Gate No. 3, Industrial Area, Pune - 411019, Maharashtra',
    paymentTerms: 'Net 45',
    specialInstructions: 'All safety equipment must carry ISI certification. Delivery to be accepted only by Safety Officer. Include compliance certificates.',
    lineItems: [
      { id: 'L1', description: 'Hard Hat - Type II, Class E (ANSI Z89.1)', quantity: 200, unit: 'Nos', unitPrice: 850, total: 170000, specifications: 'ISI Mark IS:2925, High density polyethylene, 6-point suspension' },
      { id: 'L2', description: 'Safety Harness Full Body - EN361 Certified', quantity: 50, unit: 'Nos', unitPrice: 4200, total: 210000, specifications: 'EN 361:2002, Polyester webbing, D-ring at back' },
      { id: 'L3', description: 'Safety Boots - Steel Toe Cap, Size 6-12', quantity: 100, unit: 'Pairs', unitPrice: 3500, total: 350000, specifications: 'IS:15298 certified, Steel toe cap, Anti-slip sole' }
    ],
    subtotal: 730000,
    gstPercentage: 18,
    taxAmount: 131400,
    grandTotal: 861400,
    status: 'Accepted',
    priority: 'high',
    department: 'Operations',
    requester: 'Arjun Mehta',
    acceptanceDate: '2024-01-29',
    acceptanceRemarks: 'We confirm acceptance of the purchase order. All items are in stock and will be delivered within the agreed timeline with ISI certifications.',
    deliveryConfirmedDate: '2024-02-18',
  },
  {
    poNumber: 'PO-2024-1007',
    prId: 'PR-2024-006',
    prTitle: 'Server Infrastructure Upgrade',
    vendorName: 'CloudNet Systems Pvt Ltd',
    vendorCode: 'VND-0033',
    vendorContact: 'Rohit Nair',
    vendorEmail: 'rohit.nair@cloudnetsystems.in',
    issuedBy: 'Vikram Singh',
    issuedByRole: 'SCM Manager',
    issuedDate: '2024-01-29',
    acceptanceDueDate: '2024-01-31',
    expectedDeliveryDate: '2024-03-01',
    deliveryAddress: 'Data Center, Server Room B2, Whitefield, Bangalore - 560066, Karnataka',
    paymentTerms: '50% Advance, 50% on Delivery',
    specialInstructions: 'Rack installation and configuration included. Coordinate with IT infrastructure team minimum 48 hours before delivery.',
    lineItems: [
      { id: 'L1', description: 'Dell PowerEdge R750 Server - 2x Xeon Gold, 256GB RAM', quantity: 4, unit: 'Nos', unitPrice: 850000, total: 3400000, specifications: '2x Intel Xeon Gold 6326, 256GB DDR4-3200 ECC, 2x 960GB SSD' },
      { id: 'L2', description: 'NetApp AFF A250 Storage Array - 24TB', quantity: 1, unit: 'Nos', unitPrice: 1200000, total: 1200000, specifications: '24TB Raw, NVMe SSDs, Dual controller, ONTAP' },
      { id: 'L3', description: '10GbE Network Switch - 48 Port', quantity: 2, unit: 'Nos', unitPrice: 180000, total: 360000, specifications: '48x 10GbE SFP+, 4x 100GbE QSFP28, Layer 3' }
    ],
    subtotal: 4960000,
    gstPercentage: 18,
    taxAmount: 892800,
    grandTotal: 5852800,
    status: 'Rejected',
    priority: 'high',
    department: 'IT Department',
    requester: 'Suresh Babu',
    rejectionReason: 'Unable to fulfill the order within the specified delivery timeline of March 1st. Current component lead times are 8-10 weeks. Requesting revised delivery date to April 15, 2024. Price remains firm.',
  },
  {
    poNumber: 'PO-2024-1009',
    prId: 'PR-2024-008',
    prTitle: 'Annual Maintenance Contract - HVAC Systems',
    vendorName: 'CoolAir Services Pvt Ltd',
    vendorCode: 'VND-0055',
    vendorContact: 'Sanjay Verma',
    vendorEmail: 'sanjay.verma@coolair.in',
    issuedBy: 'Neha Gupta',
    issuedByRole: 'SCM Executive',
    issuedDate: '2024-01-31',
    acceptanceDueDate: '2024-02-02',
    expectedDeliveryDate: '2024-02-05',
    deliveryAddress: 'All Floors, Corporate Office, MG Road, Bangalore - 560001, Karnataka',
    paymentTerms: 'Quarterly',
    specialInstructions: 'AMC covers all 8 HVAC units on all floors. Emergency response within 4 hours mandatory. Technician roster to be submitted before start date.',
    lineItems: [
      { id: 'L1', description: 'HVAC Annual Maintenance Contract - 8 Units', quantity: 1, unit: 'Contract', unitPrice: 240000, total: 240000, specifications: '12 months, 8 units, Monthly preventive + 24x7 emergency support' },
      { id: 'L2', description: 'Emergency Call-out Service (12 visits)', quantity: 12, unit: 'Visits', unitPrice: 5000, total: 60000, specifications: '4-hour response SLA, Part replacement excluded' }
    ],
    subtotal: 300000,
    gstPercentage: 18,
    taxAmount: 54000,
    grandTotal: 354000,
    status: 'Pending Acceptance',
    priority: 'medium',
    department: 'Facilities',
    requester: 'Dinesh Sharma',
  },
  {
    poNumber: 'PO-2024-1010',
    prId: 'PR-2024-009',
    prTitle: 'Laboratory Testing Equipment - Chemistry Lab',
    vendorName: 'LabTech Scientific Pvt Ltd',
    vendorCode: 'VND-0092',
    vendorContact: 'Dr. Kavitha Rao',
    vendorEmail: 'kavitha.rao@labtechscientific.in',
    issuedBy: 'Neha Gupta',
    issuedByRole: 'SCM Executive',
    issuedDate: '2024-02-01',
    acceptanceDueDate: '2024-02-03',
    expectedDeliveryDate: '2024-02-28',
    deliveryAddress: 'R&D Block, Chemistry Lab, 2nd Floor, Science Park, Hyderabad - 500081, Telangana',
    paymentTerms: 'Net 30',
    specialInstructions: 'Equipment must include calibration certificate. Installation and commissioning by vendor engineers mandatory. Training for 3 lab staff required.',
    lineItems: [
      { id: 'L1', description: 'HPLC System - Reverse Phase Chromatography', quantity: 1, unit: 'System', unitPrice: 850000, total: 850000, specifications: 'Quaternary pump, UV-Vis detector, 100-bar pressure, Agilent compatible' },
      { id: 'L2', description: 'Analytical Balance - 220g Capacity', quantity: 3, unit: 'Nos', unitPrice: 85000, total: 255000, specifications: '0.0001g readability, OIML Class II, RS232 interface' },
      { id: 'L3', description: 'Digital pH Meter with Auto-calibration', quantity: 5, unit: 'Nos', unitPrice: 18000, total: 90000, specifications: 'Range 0-14 pH, ±0.01 accuracy, Temperature compensation' }
    ],
    subtotal: 1195000,
    gstPercentage: 18,
    taxAmount: 215100,
    grandTotal: 1410100,
    status: 'Partially Accepted',
    priority: 'medium',
    department: 'R&D',
    requester: 'Dr. Meera Pillai',
    acceptanceDate: '2024-02-02',
    acceptanceRemarks: 'We accept Line Items 1 and 2 fully. For Line Item 3 (pH Meter), stock is available for 3 units only. Can supply remaining 2 units by March 15. Please confirm if partial delivery is acceptable.',
  },
  {
    poNumber: 'PO-2024-1011',
    prId: 'PR-2024-010',
    prTitle: 'Promotional Merchandise - Annual Sales Conference',
    vendorName: 'PrintPro Marketing Ltd',
    vendorCode: 'VND-0067',
    vendorContact: 'Anand Krishnan',
    vendorEmail: 'anand.k@printpro.in',
    issuedBy: 'Neha Gupta',
    issuedByRole: 'SCM Executive',
    issuedDate: '2024-02-03',
    acceptanceDueDate: '2024-02-05',
    expectedDeliveryDate: '2024-02-22',
    deliveryAddress: 'Marketing Department, Building B, 4th Floor, Whitefield, Bangalore - 560066',
    paymentTerms: 'Net 15',
    specialInstructions: 'Company logo and color guidelines sent separately via email. Sample approval required before bulk production. Packaging must be eco-friendly.',
    lineItems: [
      { id: 'L1', description: 'Premium Corporate Pen Set (Logo Embossed)', quantity: 500, unit: 'Sets', unitPrice: 350, total: 175000, specifications: 'Matte finish, gift box, logo on barrel' },
      { id: 'L2', description: 'Branded Tote Bag - Canvas 14oz', quantity: 500, unit: 'Nos', unitPrice: 280, total: 140000, specifications: '14oz canvas, 2-color print, reinforced handles' },
      { id: 'L3', description: 'Customized Notebook - A5 Hardcover', quantity: 500, unit: 'Nos', unitPrice: 220, total: 110000, specifications: 'A5 size, 200 pages, foiling on cover, company branding' }
    ],
    subtotal: 425000,
    gstPercentage: 12,
    taxAmount: 51000,
    grandTotal: 476000,
    status: 'Pending Acceptance',
    priority: 'low',
    department: 'Marketing',
    requester: 'Pooja Nair',
  },
];
