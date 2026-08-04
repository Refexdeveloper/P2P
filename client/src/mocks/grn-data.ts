
export type GRNStatus = 'Pending Receipt' | 'Partially Received' | 'Fully Received' | 'Quality Rejected';

export interface GRNLineItem {
  id: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  pendingQty: number;
  unitPrice: number;
  total: number;
  condition: 'Good' | 'Damaged' | 'Pending Inspection';
}

export interface GRNData {
  grnNumber: string;
  poNumber: string;
  prId: string;
  prTitle: string;
  vendor: string;
  department: string;
  requester: string;
  poDate: string;
  expectedDeliveryDate: string;
  receivedDate: string | null;
  deliveryAddress: string;
  paymentTerms: string;
  lineItems: GRNLineItem[];
  subtotal: number;
  gstPercentage: number;
  taxAmount: number;
  grandTotal: number;
  receivedValue: number;
  status: GRNStatus;
  priority: 'high' | 'medium' | 'low';
  receivedBy: string | null;
  inspectedBy: string | null;
  remarks: string;
  receiptHistory: {
    action: string;
    performedBy: string;
    role: string;
    date: string;
    notes: string;
  }[];
}

export const grnData: GRNData[] = [
  {
    grnNumber: 'GRN-2024-0021',
    poNumber: 'PO-2024-1004',
    prId: 'PR-2024-002',
    prTitle: 'Office Furniture - Ergonomic Chairs',
    vendor: 'Comfort Furniture Co',
    department: 'Administration',
    requester: 'Meera Iyer',
    poDate: '2024-01-26',
    expectedDeliveryDate: '2024-02-28',
    receivedDate: '2024-02-26',
    deliveryAddress: 'Corporate Office, New Wing, 2nd Floor, MG Road, Bangalore - 560001, Karnataka, India',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: '1',
        description: 'Ergonomic Office Chair with Lumbar Support',
        orderedQty: 30,
        receivedQty: 30,
        pendingQty: 0,
        unitPrice: 15000,
        total: 450000,
        condition: 'Good',
      },
    ],
    subtotal: 450000,
    gstPercentage: 18,
    taxAmount: 81000,
    grandTotal: 531000,
    receivedValue: 531000,
    status: 'Fully Received',
    priority: 'medium',
    receivedBy: 'Anand Pillai',
    inspectedBy: 'Ritu Sharma',
    remarks: 'All 30 chairs received in good condition. Installation completed by vendor team.',
    receiptHistory: [
      {
        action: 'PO Dispatched',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-26 03:00 PM',
        notes: 'PO sent to vendor. Delivery expected by Feb 28.',
      },
      {
        action: 'Goods Received',
        performedBy: 'Anand Pillai',
        role: 'Store Keeper',
        date: '2024-02-26 11:30 AM',
        notes: 'All 30 ergonomic chairs received. Delivery challan verified.',
      },
      {
        action: 'Quality Inspection Passed',
        performedBy: 'Ritu Sharma',
        role: 'QC Inspector',
        date: '2024-02-26 02:00 PM',
        notes: 'All items inspected. No defects found. GRN closed.',
      },
    ],
  },
  {
    grnNumber: 'GRN-2024-0022',
    poNumber: 'PO-2024-1008',
    prId: 'PR-2024-007',
    prTitle: 'Office Stationery & Supplies - Q1',
    vendor: 'OfficeMax Supplies Co',
    department: 'Administration',
    requester: 'Kavitha Reddy',
    poDate: '2024-01-30',
    expectedDeliveryDate: '2024-02-12',
    receivedDate: '2024-02-11',
    deliveryAddress: 'Admin Store Room, Ground Floor, Corporate Office, MG Road, Bangalore - 560001',
    paymentTerms: 'Net 15',
    lineItems: [
      {
        id: '1',
        description: 'A4 Paper Ream - 80 GSM (Box of 5 reams)',
        orderedQty: 100,
        receivedQty: 100,
        pendingQty: 0,
        unitPrice: 450,
        total: 45000,
        condition: 'Good',
      },
      {
        id: '2',
        description: 'Ballpoint Pens - Blue/Black (Box of 50)',
        orderedQty: 30,
        receivedQty: 25,
        pendingQty: 5,
        unitPrice: 280,
        total: 7000,
        condition: 'Good',
      },
      {
        id: '3',
        description: 'Sticky Notes - 3x3 inch (Pack of 12)',
        orderedQty: 50,
        receivedQty: 50,
        pendingQty: 0,
        unitPrice: 120,
        total: 6000,
        condition: 'Good',
      },
      {
        id: '4',
        description: 'File Folders - A4 (Box of 100)',
        orderedQty: 20,
        receivedQty: 20,
        pendingQty: 0,
        unitPrice: 650,
        total: 13000,
        condition: 'Good',
      },
    ],
    subtotal: 71000,
    gstPercentage: 12,
    taxAmount: 8520,
    grandTotal: 79520,
    receivedValue: 71000,
    status: 'Partially Received',
    priority: 'low',
    receivedBy: 'Anand Pillai',
    inspectedBy: null,
    remarks: '5 boxes of ballpoint pens pending. Vendor to deliver balance by Feb 15.',
    receiptHistory: [
      {
        action: 'PO Dispatched',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-30 10:00 AM',
        notes: 'PO sent to OfficeMax. Delivery expected Feb 12.',
      },
      {
        action: 'Partial Goods Received',
        performedBy: 'Anand Pillai',
        role: 'Store Keeper',
        date: '2024-02-11 09:45 AM',
        notes: 'Most items received. 5 boxes of pens short-shipped. Vendor informed.',
      },
    ],
  },
  {
    grnNumber: 'GRN-2024-0023',
    poNumber: 'PO-2024-1006',
    prId: 'PR-2024-005',
    prTitle: 'Industrial Safety Equipment - Q1 2024',
    vendor: 'SafeGuard Industries Ltd',
    department: 'Operations',
    requester: 'Arjun Mehta',
    poDate: '2024-01-28',
    expectedDeliveryDate: '2024-02-20',
    receivedDate: '2024-02-19',
    deliveryAddress: 'Plant Site, Gate No. 3, Industrial Area, Pune - 411019, Maharashtra, India',
    paymentTerms: 'Net 45',
    lineItems: [
      {
        id: '1',
        description: 'Hard Hat - Type II, Class E (ANSI Z89.1)',
        orderedQty: 200,
        receivedQty: 200,
        pendingQty: 0,
        unitPrice: 850,
        total: 170000,
        condition: 'Good',
      },
      {
        id: '2',
        description: 'Safety Harness Full Body - EN361 Certified',
        orderedQty: 50,
        receivedQty: 50,
        pendingQty: 0,
        unitPrice: 4200,
        total: 210000,
        condition: 'Good',
      },
      {
        id: '3',
        description: 'Safety Boots - Steel Toe Cap, Size 6-12',
        orderedQty: 100,
        receivedQty: 80,
        pendingQty: 20,
        unitPrice: 3500,
        total: 280000,
        condition: 'Damaged',
      },
    ],
    subtotal: 660000,
    gstPercentage: 18,
    taxAmount: 118800,
    grandTotal: 778800,
    receivedValue: 660000,
    status: 'Quality Rejected',
    priority: 'high',
    receivedBy: 'Suresh Nair',
    inspectedBy: 'Ritu Sharma',
    remarks: '20 pairs of safety boots received in damaged condition. Replacement requested from vendor.',
    receiptHistory: [
      {
        action: 'PO Dispatched',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-28 09:00 AM',
        notes: 'Urgent safety equipment PO dispatched to SafeGuard Industries.',
      },
      {
        action: 'Goods Received',
        performedBy: 'Suresh Nair',
        role: 'Store Keeper',
        date: '2024-02-19 08:30 AM',
        notes: 'Goods received at Plant Gate 3. Delivery challan signed.',
      },
      {
        action: 'Quality Inspection Failed',
        performedBy: 'Ritu Sharma',
        role: 'QC Inspector',
        date: '2024-02-19 11:00 AM',
        notes: '20 pairs of safety boots found damaged. Vendor notified for replacement. GRN partially closed.',
      },
    ],
  },
  {
    grnNumber: 'GRN-2024-0024',
    poNumber: 'PO-2024-1003',
    prId: 'PR-2024-001',
    prTitle: 'Dell Latitude Laptops - 50 Units',
    vendor: 'Tech Solutions Pvt Ltd',
    department: 'IT Department',
    requester: 'Rajesh Kumar',
    poDate: '2024-01-25',
    expectedDeliveryDate: '2024-02-15',
    receivedDate: null,
    deliveryAddress: 'Tech Park, Building A, 3rd Floor, Whitefield, Bangalore - 560066, Karnataka, India',
    paymentTerms: 'Net 30',
    lineItems: [
      {
        id: '1',
        description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD',
        orderedQty: 50,
        receivedQty: 0,
        pendingQty: 50,
        unitPrice: 75000,
        total: 3750000,
        condition: 'Pending Inspection',
      },
    ],
    subtotal: 3750000,
    gstPercentage: 18,
    taxAmount: 675000,
    grandTotal: 4425000,
    receivedValue: 0,
    status: 'Pending Receipt',
    priority: 'high',
    receivedBy: null,
    inspectedBy: null,
    remarks: 'Awaiting delivery from Tech Solutions. PO under SCM Manager approval.',
    receiptHistory: [
      {
        action: 'PO Created',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-25 10:30 AM',
        notes: 'PO created and sent for SCM Manager approval.',
      },
    ],
  },
  {
    grnNumber: 'GRN-2024-0025',
    poNumber: 'PO-2024-1009',
    prId: 'PR-2024-008',
    prTitle: 'Annual Maintenance Contract - HVAC Systems',
    vendor: 'CoolAir Services Pvt Ltd',
    department: 'Facilities',
    requester: 'Dinesh Sharma',
    poDate: '2024-01-31',
    expectedDeliveryDate: '2024-02-05',
    receivedDate: '2024-02-05',
    deliveryAddress: 'All Floors, Corporate Office, MG Road, Bangalore - 560001, Karnataka, India',
    paymentTerms: 'Quarterly',
    lineItems: [
      {
        id: '1',
        description: 'HVAC Annual Maintenance Contract - 8 Units',
        orderedQty: 1,
        receivedQty: 1,
        pendingQty: 0,
        unitPrice: 240000,
        total: 240000,
        condition: 'Good',
      },
      {
        id: '2',
        description: 'Emergency Call-out Service (12 visits)',
        orderedQty: 12,
        receivedQty: 12,
        pendingQty: 0,
        unitPrice: 5000,
        total: 60000,
        condition: 'Good',
      },
    ],
    subtotal: 300000,
    gstPercentage: 18,
    taxAmount: 54000,
    grandTotal: 354000,
    receivedValue: 354000,
    status: 'Fully Received',
    priority: 'medium',
    receivedBy: 'Dinesh Sharma',
    inspectedBy: 'Ritu Sharma',
    remarks: 'AMC service agreement signed and activated. All 8 HVAC units registered.',
    receiptHistory: [
      {
        action: 'PO Dispatched',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-31 02:30 PM',
        notes: 'AMC PO sent to CoolAir Services.',
      },
      {
        action: 'Service Commencement Confirmed',
        performedBy: 'Dinesh Sharma',
        role: 'Facilities Manager',
        date: '2024-02-05 10:00 AM',
        notes: 'CoolAir team visited and activated AMC for all 8 units. Agreement signed.',
      },
      {
        action: 'GRN Closed',
        performedBy: 'Ritu Sharma',
        role: 'QC Inspector',
        date: '2024-02-05 12:00 PM',
        notes: 'Service delivery confirmed. GRN marked as fully received.',
      },
    ],
  },
  {
    grnNumber: 'GRN-2024-0026',
    poNumber: 'PO-2024-1007',
    prId: 'PR-2024-006',
    prTitle: 'Server Infrastructure Upgrade',
    vendor: 'CloudNet Systems Pvt Ltd',
    department: 'IT Department',
    requester: 'Suresh Babu',
    poDate: '2024-01-29',
    expectedDeliveryDate: '2024-03-01',
    receivedDate: null,
    deliveryAddress: 'Data Center, Server Room B2, Whitefield, Bangalore - 560066, Karnataka, India',
    paymentTerms: '50% Advance',
    lineItems: [
      {
        id: '1',
        description: 'Dell PowerEdge R750 Server - 2x Xeon Gold, 256GB RAM',
        orderedQty: 4,
        receivedQty: 0,
        pendingQty: 4,
        unitPrice: 850000,
        total: 3400000,
        condition: 'Pending Inspection',
      },
      {
        id: '2',
        description: 'NetApp AFF A250 Storage Array - 24TB',
        orderedQty: 1,
        receivedQty: 0,
        pendingQty: 1,
        unitPrice: 1200000,
        total: 1200000,
        condition: 'Pending Inspection',
      },
      {
        id: '3',
        description: '10GbE Network Switch - 48 Port',
        orderedQty: 2,
        receivedQty: 0,
        pendingQty: 2,
        unitPrice: 180000,
        total: 360000,
        condition: 'Pending Inspection',
      },
    ],
    subtotal: 4960000,
    gstPercentage: 18,
    taxAmount: 892800,
    grandTotal: 5852800,
    receivedValue: 0,
    status: 'Pending Receipt',
    priority: 'high',
    receivedBy: null,
    inspectedBy: null,
    remarks: 'Delivery scheduled for March 1. IT infrastructure team on standby.',
    receiptHistory: [
      {
        action: 'PO Created',
        performedBy: 'Neha Gupta',
        role: 'SCM Executive',
        date: '2024-01-29 11:20 AM',
        notes: 'High-value server infrastructure PO created. Awaiting manager approval.',
      },
    ],
  },
];
