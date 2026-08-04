
export interface POLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface POData {
  poNumber: string;
  prId: string;
  prDbId: number;
  prTitle: string;
  vendor: string;
  department: string;
  requester: string;
  createdDate: string;
  expectedDeliveryDate: string;
  deliveryAddress: string;
  paymentTerms: string;
  specialInstructions: string;
  lineItems: POLineItem[];
  subtotal: number;
  gstPercentage: number;
  taxAmount: number;
  grandTotal: number;
  status: 'Pending Approval' | 'PO Approved' | 'PO Rejected';
  priority: 'high' | 'medium' | 'low';
  createdBy: string;
  approvalHistory: {
    stage: string;
    approver: string;
    role: string;
    action: string;
    date: string;
    remarks: string;
  }[];
}

export const poData: POData[] = [
  {
    poNumber: 'PO-2024-1003',
    prId: 'PR-2024-001',
    prDbId: 0,
    prTitle: 'Dell Latitude Laptops - 50 Units',
    vendor: 'Tech Solutions Pvt Ltd',
    department: 'IT Department',
    requester: 'Rajesh Kumar',
    createdDate: '2024-01-25',
    expectedDeliveryDate: '2024-02-15',
    deliveryAddress: 'Tech Park, Building A, 3rd Floor, Whitefield, Bangalore - 560066, Karnataka, India',
    paymentTerms: 'Net 30',
    specialInstructions: 'Please ensure all laptops are pre-configured with Windows 11 Pro and standard corporate software suite before delivery.',
    lineItems: [
      { id: '1', description: 'Dell Latitude 5540 - i7, 16GB RAM, 512GB SSD', quantity: 50, unitPrice: 75000, total: 3750000 }
    ],
    subtotal: 3750000,
    gstPercentage: 18,
    taxAmount: 675000,
    grandTotal: 4425000,
    status: 'Pending Approval',
    priority: 'high',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-25 10:30 AM', remarks: 'PO created from PR-2024-001 and sent for SCM Manager approval' }
    ]
  },
  {
    poNumber: 'PO-2024-1004',
    prId: 'PR-2024-002',
    prTitle: 'Office Furniture - Ergonomic Chairs',
    vendor: 'Comfort Furniture Co',
    department: 'Administration',
    requester: 'Meera Iyer',
    createdDate: '2024-01-26',
    expectedDeliveryDate: '2024-02-28',
    deliveryAddress: 'Corporate Office, New Wing, 2nd Floor, MG Road, Bangalore - 560001, Karnataka, India',
    paymentTerms: 'Net 30',
    specialInstructions: 'Delivery should be coordinated with Facilities team. Installation required.',
    lineItems: [
      { id: '1', description: 'Ergonomic Office Chair with Lumbar Support', quantity: 30, unitPrice: 15000, total: 450000 }
    ],
    subtotal: 450000,
    gstPercentage: 18,
    taxAmount: 81000,
    grandTotal: 531000,
    status: 'PO Approved',
    priority: 'medium',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-26 09:15 AM', remarks: 'PO created from PR-2024-002 and sent for approval' },
      { stage: 'SCM Manager Approval', approver: 'Vikram Singh', role: 'SCM Manager', action: 'Approved', date: '2024-01-26 02:30 PM', remarks: 'All terms verified. PO approved and ready to send to vendor.' }
    ]
  },
  {
    poNumber: 'PO-2024-1005',
    prId: 'PR-2024-004',
    prTitle: 'Software Licenses - Adobe Creative Cloud',
    vendor: 'Adobe Authorized Reseller',
    department: 'Marketing',
    requester: 'Pooja Nair',
    createdDate: '2024-01-27',
    expectedDeliveryDate: '2024-02-10',
    deliveryAddress: 'Marketing Department, Building B, 4th Floor, Whitefield, Bangalore - 560066, Karnataka, India',
    paymentTerms: 'Advance Payment',
    specialInstructions: 'License keys to be delivered via email to IT team for deployment.',
    lineItems: [
      { id: '1', description: 'Adobe Creative Cloud All Apps - Annual License', quantity: 20, unitPrice: 36000, total: 720000 }
    ],
    subtotal: 720000,
    gstPercentage: 18,
    taxAmount: 129600,
    grandTotal: 849600,
    status: 'PO Rejected',
    priority: 'medium',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-27 11:00 AM', remarks: 'PO created from PR-2024-004' },
      { stage: 'SCM Manager Approval', approver: 'Vikram Singh', role: 'SCM Manager', action: 'Rejected', date: '2024-01-27 03:45 PM', remarks: 'Payment terms need revision. Advance payment not aligned with company policy for software licenses. Please revise to Net 30 and resubmit.' }
    ]
  },
  {
    poNumber: 'PO-2024-1006',
    prId: 'PR-2024-005',
    prTitle: 'Industrial Safety Equipment - Q1 2024',
    vendor: 'SafeGuard Industries Ltd',
    department: 'Operations',
    requester: 'Arjun Mehta',
    createdDate: '2024-01-28',
    expectedDeliveryDate: '2024-02-20',
    deliveryAddress: 'Plant Site, Gate No. 3, Industrial Area, Pune - 411019, Maharashtra, India',
    paymentTerms: 'Net 45',
    specialInstructions: 'All safety equipment must carry ISI certification. Delivery to be accepted only by Safety Officer.',
    lineItems: [
      { id: '1', description: 'Hard Hat - Type II, Class E (ANSI Z89.1)', quantity: 200, unitPrice: 850, total: 170000 },
      { id: '2', description: 'Safety Harness Full Body - EN361 Certified', quantity: 50, unitPrice: 4200, total: 210000 },
      { id: '3', description: 'Safety Boots - Steel Toe Cap, Size 6-12', quantity: 100, unitPrice: 3500, total: 350000 }
    ],
    subtotal: 730000,
    gstPercentage: 18,
    taxAmount: 131400,
    grandTotal: 861400,
    status: 'Pending Approval',
    priority: 'high',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-28 08:45 AM', remarks: 'Urgent safety equipment PO. Compliance deadline approaching.' }
    ]
  },
  {
    poNumber: 'PO-2024-1007',
    prId: 'PR-2024-006',
    prTitle: 'Server Infrastructure Upgrade',
    vendor: 'CloudNet Systems Pvt Ltd',
    department: 'IT Department',
    requester: 'Suresh Babu',
    createdDate: '2024-01-29',
    expectedDeliveryDate: '2024-03-01',
    deliveryAddress: 'Data Center, Server Room B2, Whitefield, Bangalore - 560066, Karnataka, India',
    paymentTerms: '50% Advance',
    specialInstructions: 'Rack installation and configuration included. Coordinate with IT infrastructure team for scheduling.',
    lineItems: [
      { id: '1', description: 'Dell PowerEdge R750 Server - 2x Xeon Gold, 256GB RAM', quantity: 4, unitPrice: 850000, total: 3400000 },
      { id: '2', description: 'NetApp AFF A250 Storage Array - 24TB', quantity: 1, unitPrice: 1200000, total: 1200000 },
      { id: '3', description: '10GbE Network Switch - 48 Port', quantity: 2, unitPrice: 180000, total: 360000 }
    ],
    subtotal: 4960000,
    gstPercentage: 18,
    taxAmount: 892800,
    grandTotal: 5852800,
    status: 'Pending Approval',
    priority: 'high',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-29 11:20 AM', remarks: 'High-value PO for critical infrastructure. Requires expedited approval.' }
    ]
  },
  {
    poNumber: 'PO-2024-1008',
    prId: 'PR-2024-007',
    prTitle: 'Office Stationery & Supplies - Q1',
    vendor: 'OfficeMax Supplies Co',
    department: 'Administration',
    requester: 'Kavitha Reddy',
    createdDate: '2024-01-30',
    expectedDeliveryDate: '2024-02-12',
    deliveryAddress: 'Admin Store Room, Ground Floor, Corporate Office, MG Road, Bangalore - 560001',
    paymentTerms: 'Net 15',
    specialInstructions: 'Deliver during business hours only. Contact admin team before delivery.',
    lineItems: [
      { id: '1', description: 'A4 Paper Ream - 80 GSM (Box of 5 reams)', quantity: 100, unitPrice: 450, total: 45000 },
      { id: '2', description: 'Ballpoint Pens - Blue/Black (Box of 50)', quantity: 30, unitPrice: 280, total: 8400 },
      { id: '3', description: 'Sticky Notes - 3x3 inch (Pack of 12)', quantity: 50, unitPrice: 120, total: 6000 },
      { id: '4', description: 'File Folders - A4 (Box of 100)', quantity: 20, unitPrice: 650, total: 13000 }
    ],
    subtotal: 72400,
    gstPercentage: 12,
    taxAmount: 8688,
    grandTotal: 81088,
    status: 'PO Approved',
    priority: 'low',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-30 09:00 AM', remarks: 'Routine quarterly stationery replenishment.' },
      { stage: 'SCM Manager Approval', approver: 'Vikram Singh', role: 'SCM Manager', action: 'Approved', date: '2024-01-30 10:15 AM', remarks: 'Standard procurement. Approved.' }
    ]
  },
  {
    poNumber: 'PO-2024-1009',
    prId: 'PR-2024-008',
    prTitle: 'Annual Maintenance Contract - HVAC Systems',
    vendor: 'CoolAir Services Pvt Ltd',
    department: 'Facilities',
    requester: 'Dinesh Sharma',
    createdDate: '2024-01-31',
    expectedDeliveryDate: '2024-02-05',
    deliveryAddress: 'All Floors, Corporate Office, MG Road, Bangalore - 560001, Karnataka, India',
    paymentTerms: 'Quarterly',
    specialInstructions: 'AMC covers all 8 HVAC units. Emergency response within 4 hours. Monthly preventive maintenance included.',
    lineItems: [
      { id: '1', description: 'HVAC Annual Maintenance Contract - 8 Units', quantity: 1, unitPrice: 240000, total: 240000 },
      { id: '2', description: 'Emergency Call-out Service (12 visits)', quantity: 12, unitPrice: 5000, total: 60000 }
    ],
    subtotal: 300000,
    gstPercentage: 18,
    taxAmount: 54000,
    grandTotal: 354000,
    status: 'Pending Approval',
    priority: 'medium',
    createdBy: 'Neha Gupta',
    approvalHistory: [
      { stage: 'PO Created', approver: 'Neha Gupta', role: 'SCM Executive', action: 'Created', date: '2024-01-31 02:00 PM', remarks: 'Annual renewal of HVAC maintenance contract. Previous contract expires Feb 4.' }
    ]
  }
];
