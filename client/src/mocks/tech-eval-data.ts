export interface TechEvalRFQ {
  id: string;
  rfqRef: string;
  prRef: string;
  prTitle: string;
  department: string;
  scmBuyer: string;
  sentForEvalDate: string;
  dueDate: string;
  status: 'Pending Evaluation' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  totalVendors: number;
  evaluatedVendors: number;
  vendors: TechEvalVendor[];
}

export interface TechEvalVendor {
  id: string;
  vendorName: string;
  currentRound: number;
  quotedPrice: number;
  leadTime: number;
  paymentTerms: string;
  compliance: boolean;
  quotationFileName: string;
  source: 'vendor-portal' | 'manual';
  rounds: TechEvalRound[];
}

export interface TechEvalRound {
  round: number;
  quotedPrice: number;
  status: 'pending' | 'evaluated';
  technicalCompliance: number;
  qualityStandards: number;
  deliveryCapability: number;
  afterSalesSupport: number;
  certifications: number;
  siteVisitScore: number;
  technicalScore: number;
  commercialScore: number;
  overallScore: number;
  remarks: string;
  evalBy: string;
  evalDate: string;
}

export const techEvalRFQs: TechEvalRFQ[] = [
  {
    id: 'te-001',
    rfqRef: 'RFQ-2024-0091',
    prRef: 'PR-2024-0112',
    prTitle: 'Office Laptop Procurement - Q1 2024',
    department: 'Information Technology',
    scmBuyer: 'Arjun Mehta',
    sentForEvalDate: '2024-03-16',
    dueDate: '2024-03-22',
    status: 'Pending Evaluation',
    priority: 'High',
    totalVendors: 3,
    evaluatedVendors: 0,
    vendors: [
      {
        id: 'v1',
        vendorName: 'Tech Solutions Pvt Ltd',
        currentRound: 2,
        quotedPrice: 1180000,
        leadTime: 21,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'TechSolutions_Q2_Quote.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 1250000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
          { round: 2, quotedPrice: 1180000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
        ],
      },
      {
        id: 'v2',
        vendorName: 'Digital Systems Inc',
        currentRound: 2,
        quotedPrice: 1195000,
        leadTime: 18,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'DigitalSystems_Q2_Quote.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 1270000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
          { round: 2, quotedPrice: 1195000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
        ],
      },
      {
        id: 'v3',
        vendorName: 'Computer World Ltd',
        currentRound: 1,
        quotedPrice: 1220000,
        leadTime: 25,
        paymentTerms: 'Deviated',
        compliance: false,
        quotationFileName: 'ComputerWorld_Q1_Quote.pdf',
        source: 'manual',
        rounds: [
          { round: 1, quotedPrice: 1220000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
        ],
      },
    ],
  },
  {
    id: 'te-002',
    rfqRef: 'RFQ-2024-0087',
    prRef: 'PR-2024-0098',
    prTitle: 'AC Unit Installation - Server Room Expansion',
    department: 'Facilities Management',
    scmBuyer: 'Priya Sharma',
    sentForEvalDate: '2024-03-10',
    dueDate: '2024-03-18',
    status: 'In Progress',
    priority: 'High',
    totalVendors: 2,
    evaluatedVendors: 1,
    vendors: [
      {
        id: 'v4',
        vendorName: 'Cool Air Services Ltd',
        currentRound: 2,
        quotedPrice: 490000,
        leadTime: 15,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'CoolAir_Q2_Revised.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 510000, status: 'evaluated', technicalCompliance: 82, qualityStandards: 78, deliveryCapability: 85, afterSalesSupport: 80, certifications: 90, siteVisitScore: 75, technicalScore: 82, commercialScore: 76, overallScore: 79, remarks: 'Good technical specs, price slightly high in Q1', evalBy: 'Rajesh Kumar', evalDate: '2024-03-12' },
          { round: 2, quotedPrice: 490000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
        ],
      },
      {
        id: 'v5',
        vendorName: 'Climate Control Inc',
        currentRound: 1,
        quotedPrice: 475000,
        leadTime: 20,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'ClimateControl_Q1_Quote.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 475000, status: 'pending', technicalCompliance: 0, qualityStandards: 0, deliveryCapability: 0, afterSalesSupport: 0, certifications: 0, siteVisitScore: 0, technicalScore: 0, commercialScore: 0, overallScore: 0, remarks: '', evalBy: '', evalDate: '' },
        ],
      },
    ],
  },
  {
    id: 'te-003',
    rfqRef: 'RFQ-2024-0094',
    prRef: 'PR-2024-0118',
    prTitle: 'CCTV Surveillance System - Warehouse',
    department: 'Security',
    scmBuyer: 'Deepak Nair',
    sentForEvalDate: '2024-03-08',
    dueDate: '2024-03-15',
    status: 'Completed',
    priority: 'Medium',
    totalVendors: 3,
    evaluatedVendors: 3,
    vendors: [
      {
        id: 'v6',
        vendorName: 'SecureGuard Services',
        currentRound: 1,
        quotedPrice: 308000,
        leadTime: 25,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'SecureGuard_Quote.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 308000, status: 'evaluated', technicalCompliance: 88, qualityStandards: 85, deliveryCapability: 82, afterSalesSupport: 90, certifications: 92, siteVisitScore: 88, technicalScore: 88, commercialScore: 84, overallScore: 86, remarks: 'Excellent technical compliance, strong after-sales support', evalBy: 'Rajesh Kumar', evalDate: '2024-03-10' },
        ],
      },
      {
        id: 'v7',
        vendorName: 'Elite Security Solutions',
        currentRound: 1,
        quotedPrice: 295000,
        leadTime: 30,
        paymentTerms: 'Deviated',
        compliance: true,
        quotationFileName: 'EliteSecurity_Quote.pdf',
        source: 'vendor-portal',
        rounds: [
          { round: 1, quotedPrice: 295000, status: 'evaluated', technicalCompliance: 80, qualityStandards: 82, deliveryCapability: 75, afterSalesSupport: 78, certifications: 85, siteVisitScore: 80, technicalScore: 80, commercialScore: 88, overallScore: 83, remarks: 'Good price but delivery timeline is longer', evalBy: 'Rajesh Kumar', evalDate: '2024-03-10' },
        ],
      },
      {
        id: 'v8',
        vendorName: 'Network Solutions India',
        currentRound: 1,
        quotedPrice: 320000,
        leadTime: 20,
        paymentTerms: 'Standard',
        compliance: true,
        quotationFileName: 'NetworkSolutions_Quote.pdf',
        source: 'manual',
        rounds: [
          { round: 1, quotedPrice: 320000, status: 'evaluated', technicalCompliance: 92, qualityStandards: 90, deliveryCapability: 95, afterSalesSupport: 88, certifications: 90, siteVisitScore: 92, technicalScore: 91, commercialScore: 80, overallScore: 87, remarks: 'Best technical score, fastest delivery, slightly higher price', evalBy: 'Rajesh Kumar', evalDate: '2024-03-11' },
        ],
      },
    ],
  },
];
