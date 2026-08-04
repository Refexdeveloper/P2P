export type RFQItemStatus = 'Pending Quote' | 'Quote Submitted' | 'Re-quote Requested' | 'Quote Accepted' | 'Quote Rejected' | 'Expired';

export interface RFQLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number;
  specifications: string;
  quotedUnitPrice?: number;
  quotedTotal?: number;
  leadTimeDays?: number;
  remarks?: string;
}

export interface QuoteRoundHistory {
  round: number;
  submittedDate: string;
  totalAmount: number;
  leadTimeDays: number;
  paymentTerms: string;
  status: 'accepted' | 'rejected' | 're-quote-requested';
  rejectionReason?: string;
  reQuoteFields?: string[];
}

export interface VendorRFQItem {
  id: string;
  rfqNumber: string;
  prNumber: string;
  prTitle: string;
  buyerName: string;
  buyerDepartment: string;
  company: string;
  issuedDate: string;
  dueDate: string;
  requiredDeliveryDate: string;
  status: RFQItemStatus;
  priority: 'High' | 'Medium' | 'Low';
  estimatedValue: number;
  quotedValue?: number;
  currentRound: number;
  lineItems: RFQLineItem[];
  terms: string;
  specialInstructions: string;
  attachments: string[];
  quoteHistory: QuoteRoundHistory[];
  reQuoteReason?: string;
  reQuoteFields?: string[];
}

export const vendorRFQData: VendorRFQItem[] = [
  {
    id: 'rfq-001',
    rfqNumber: 'RFQ-2024-0091',
    prNumber: 'PR-2024-0112',
    prTitle: 'Office Laptop Procurement - Q1 2024',
    buyerName: 'Arjun Mehta',
    buyerDepartment: 'Information Technology',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-03-01',
    dueDate: '2024-03-15',
    requiredDeliveryDate: '2024-04-10',
    status: 'Pending Quote',
    priority: 'High',
    estimatedValue: 1250000,
    currentRound: 1,
    lineItems: [
      { id: 'li-1', description: 'Dell Latitude 7420 Laptop', category: 'IT Hardware', quantity: 15, unit: 'Nos', estimatedUnitPrice: 75000, specifications: 'Intel i7, 16GB RAM, 512GB SSD, 14" FHD Display, Windows 11 Pro' },
      { id: 'li-2', description: 'Laptop Carry Bag', category: 'IT Accessories', quantity: 15, unit: 'Nos', estimatedUnitPrice: 1500, specifications: '15.6" compatible, waterproof, branded' },
      { id: 'li-3', description: 'Wireless Mouse & Keyboard Combo', category: 'IT Accessories', quantity: 15, unit: 'Set', estimatedUnitPrice: 2500, specifications: 'USB/Bluetooth, ergonomic design' },
    ],
    terms: 'Payment within 30 days of invoice. GST extra. Delivery to company warehouse.',
    specialInstructions: 'All laptops must include 3-year onsite warranty. Please provide OEM certificates.',
    attachments: ['Tech_Specs_Laptops.pdf', 'RFQ_Terms_2024.pdf'],
    quoteHistory: [],
  },
  {
    id: 'rfq-002',
    rfqNumber: 'RFQ-2024-0087',
    prNumber: 'PR-2024-0098',
    prTitle: 'AC Unit Installation - Server Room Expansion',
    buyerName: 'Priya Sharma',
    buyerDepartment: 'Facilities Management',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-02-20',
    dueDate: '2024-03-05',
    requiredDeliveryDate: '2024-03-25',
    status: 'Re-quote Requested',
    priority: 'High',
    estimatedValue: 480000,
    quotedValue: 510000,
    currentRound: 2,
    reQuoteReason: 'Quoted price exceeds budget. Please revise commercial terms and consider volume discount.',
    reQuoteFields: ['Unit Price', 'Payment Terms', 'Installation Charges'],
    lineItems: [
      { id: 'li-4', description: 'Precision AC Unit 5 Ton', category: 'HVAC Equipment', quantity: 2, unit: 'Nos', estimatedUnitPrice: 150000, specifications: 'Downflow type, 5TR, 3-phase, energy efficient 5-star rating', quotedUnitPrice: 165000, quotedTotal: 330000 },
      { id: 'li-5', description: 'AC Installation & Commissioning', category: 'Service', quantity: 2, unit: 'Set', estimatedUnitPrice: 35000, specifications: 'Including all piping, wiring, gas charging', quotedUnitPrice: 40000, quotedTotal: 80000 },
      { id: 'li-6', description: 'AMC for 3 Years', category: 'Service', quantity: 1, unit: 'Contract', estimatedUnitPrice: 100000, specifications: '2 visits per year, parts included', quotedUnitPrice: 100000, quotedTotal: 100000 },
    ],
    terms: 'Payment 50% advance, 50% on delivery. GST extra.',
    specialInstructions: 'Installation must be completed on weekends only to avoid disruption.',
    attachments: ['Floor_Plan_ServerRoom.pdf'],
    quoteHistory: [
      { round: 1, submittedDate: '2024-02-28', totalAmount: 510000, leadTimeDays: 20, paymentTerms: '50% advance, 50% on delivery', status: 're-quote-requested', rejectionReason: 'Price exceeds approved budget', reQuoteFields: ['Unit Price', 'Payment Terms'] },
    ],
  },
  {
    id: 'rfq-003',
    rfqNumber: 'RFQ-2024-0081',
    prNumber: 'PR-2024-0089',
    prTitle: 'Annual Stationery & Office Supplies',
    buyerName: 'Suresh Kumar',
    buyerDepartment: 'Administration',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-02-10',
    dueDate: '2024-02-25',
    requiredDeliveryDate: '2024-03-15',
    status: 'Quote Accepted',
    priority: 'Low',
    estimatedValue: 85000,
    quotedValue: 82500,
    currentRound: 1,
    lineItems: [
      { id: 'li-7', description: 'A4 Paper Ream 80GSM', category: 'Stationery', quantity: 200, unit: 'Ream', estimatedUnitPrice: 280, specifications: 'ITC or JK brand, 500 sheets per ream', quotedUnitPrice: 265, quotedTotal: 53000 },
      { id: 'li-8', description: 'Ball Point Pens (Box of 10)', category: 'Stationery', quantity: 50, unit: 'Box', estimatedUnitPrice: 120, specifications: 'Blue ink, medium tip, branded', quotedUnitPrice: 110, quotedTotal: 5500 },
      { id: 'li-9', description: 'Whiteboard Markers Set', category: 'Stationery', quantity: 30, unit: 'Set', estimatedUnitPrice: 250, specifications: '4 colors per set, erasable', quotedUnitPrice: 240, quotedTotal: 7200 },
      { id: 'li-10', description: 'File Folders (Pack of 50)', category: 'Stationery', quantity: 20, unit: 'Pack', estimatedUnitPrice: 400, specifications: 'L-clip, plastic, A4 size', quotedUnitPrice: 390, quotedTotal: 7800 },
    ],
    terms: 'Payment within 15 days. No advance required.',
    specialInstructions: 'Delivery in batches if required. Provide samples before bulk order.',
    attachments: ['Stationery_List_2024.xlsx'],
    quoteHistory: [
      { round: 1, submittedDate: '2024-02-22', totalAmount: 82500, leadTimeDays: 7, paymentTerms: 'Net 15', status: 'accepted' },
    ],
  },
  {
    id: 'rfq-004',
    rfqNumber: 'RFQ-2024-0094',
    prNumber: 'PR-2024-0118',
    prTitle: 'CCTV Surveillance System - Warehouse',
    buyerName: 'Deepak Nair',
    buyerDepartment: 'Security',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-03-05',
    dueDate: '2024-03-20',
    requiredDeliveryDate: '2024-04-15',
    status: 'Quote Submitted',
    priority: 'Medium',
    estimatedValue: 320000,
    quotedValue: 308000,
    currentRound: 1,
    lineItems: [
      { id: 'li-11', description: 'IP Dome Camera 4MP', category: 'Security Equipment', quantity: 20, unit: 'Nos', estimatedUnitPrice: 8500, specifications: 'Night vision, 30m range, IP66 rated, PoE compatible', quotedUnitPrice: 8000, quotedTotal: 160000 },
      { id: 'li-12', description: '16 Channel NVR', category: 'Security Equipment', quantity: 2, unit: 'Nos', estimatedUnitPrice: 25000, specifications: '4K output, 4TB HDD, remote access via app', quotedUnitPrice: 24000, quotedTotal: 48000 },
      { id: 'li-13', description: 'Cat6 Cable (Box 305m)', category: 'Networking', quantity: 5, unit: 'Box', estimatedUnitPrice: 3500, specifications: 'Outdoor grade, UV resistant', quotedUnitPrice: 3500, quotedTotal: 17500 },
      { id: 'li-14', description: 'Installation & Configuration', category: 'Service', quantity: 1, unit: 'Job', estimatedUnitPrice: 50000, specifications: 'Full installation, testing, 1 year support', quotedUnitPrice: 45000, quotedTotal: 45000 },
    ],
    terms: 'Payment 40% advance, 60% after installation. GST applicable.',
    specialInstructions: 'All cameras to be installed as per approved layout drawing.',
    attachments: ['Warehouse_Layout.pdf', 'Camera_Specs.pdf'],
    quoteHistory: [
      { round: 1, submittedDate: '2024-03-14', totalAmount: 308000, leadTimeDays: 25, paymentTerms: '40-60 split', status: 'rejected', rejectionReason: 'Under verification' },
    ],
  },
  {
    id: 'rfq-005',
    rfqNumber: 'RFQ-2024-0077',
    prNumber: 'PR-2024-0082',
    prTitle: 'Software License Renewal - Adobe Creative Suite',
    buyerName: 'Neha Joshi',
    buyerDepartment: 'Marketing',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-01-25',
    dueDate: '2024-02-10',
    requiredDeliveryDate: '2024-02-28',
    status: 'Quote Rejected',
    priority: 'Medium',
    estimatedValue: 175000,
    quotedValue: 192000,
    currentRound: 2,
    lineItems: [
      { id: 'li-15', description: 'Adobe Creative Cloud - Business (Annual)', category: 'Software', quantity: 10, unit: 'Licenses', estimatedUnitPrice: 17500, specifications: 'All Apps plan, 1-year subscription, includes Photoshop, Illustrator, Premiere Pro', quotedUnitPrice: 19200, quotedTotal: 192000 },
    ],
    terms: 'Full payment upfront. License keys to be delivered digitally within 2 business days.',
    specialInstructions: 'Renewal must be continuous — no gap between old and new license period.',
    attachments: ['Current_License_Details.pdf'],
    quoteHistory: [
      { round: 1, submittedDate: '2024-02-05', totalAmount: 205000, leadTimeDays: 2, paymentTerms: 'Full advance', status: 're-quote-requested', reQuoteFields: ['Unit Price'] },
      { round: 2, submittedDate: '2024-02-09', totalAmount: 192000, leadTimeDays: 2, paymentTerms: 'Full advance', status: 'rejected', rejectionReason: 'Selected alternative vendor with better pricing' },
    ],
  },
  {
    id: 'rfq-006',
    rfqNumber: 'RFQ-2024-0097',
    prNumber: 'PR-2024-0125',
    prTitle: 'Conference Room Furniture - New HQ',
    buyerName: 'Arjun Mehta',
    buyerDepartment: 'Administration',
    company: 'Techzone Systems Pvt Ltd',
    issuedDate: '2024-03-10',
    dueDate: '2024-03-28',
    requiredDeliveryDate: '2024-05-01',
    status: 'Pending Quote',
    priority: 'Medium',
    estimatedValue: 680000,
    currentRound: 1,
    lineItems: [
      { id: 'li-16', description: '12-Seater Conference Table', category: 'Furniture', quantity: 3, unit: 'Nos', estimatedUnitPrice: 85000, specifications: 'Engineered wood with glass top, wire management, 280x120cm' },
      { id: 'li-17', description: 'Executive Conference Chair', category: 'Furniture', quantity: 36, unit: 'Nos', estimatedUnitPrice: 8500, specifications: 'High-back, mesh + leather, armrest, 5-star base with castor' },
      { id: 'li-18', description: 'Projector Screen (100 inch)', category: 'AV Equipment', quantity: 3, unit: 'Nos', estimatedUnitPrice: 15000, specifications: 'Electric, remote control, matte white, front projection' },
      { id: 'li-19', description: 'Mobile Whiteboard', category: 'Furniture', quantity: 6, unit: 'Nos', estimatedUnitPrice: 7500, specifications: 'Double-sided, 120x90cm, lockable wheels' },
    ],
    terms: 'Payment 30% advance, 70% on delivery. GST extra. Delivery and installation included.',
    specialInstructions: 'All furniture must be fire-retardant certified. Provide samples/catalog before order confirmation.',
    attachments: ['Conference_Room_Plans.pdf', 'Furniture_Spec_Sheet.pdf'],
    quoteHistory: [],
  },
];
