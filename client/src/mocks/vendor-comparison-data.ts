export interface VendorParameter {
  key: string;
  displayValue: string;
  numericValue?: number;
}

export interface QuotationFile {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'xlsx' | 'docx' | 'jpg';
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface QuoteRoundDetail {
  round: number;
  submittedDate: string;
  submittedBy: 'vendor-portal' | 'manual';
  quotedPrice: number;
  leadTime: number;
  paymentTerms: string;
  compliance: string;
  technicalScore: number;
  commercialScore: number;
  overallScore: number;
  status: 'active' | 'sent-back' | 'tech-evaluated' | 'final';
  sentBackReason?: string;
  techEvalBy?: string;
  techEvalDate?: string;
  vendorNotes?: string;
  quotationFile?: string;
}

export interface Vendor {
  id: string;
  name: string;
  parameters: VendorParameter[];
  quotationFiles: QuotationFile[];
  quoteRounds?: QuoteRoundDetail[];
}

export interface ParameterRow {
  key: string;
  label: string;
  icon: string;
}

export interface VendorComparisonData {
  rfqReference: string;
  prReference: string;
  department: string;
  requestType: string;
  estimatedBudget: string;
  recommendedVendorId: string;
  vendors: Vendor[];
  parameterRows: ParameterRow[];
}

export const vendorComparisonData: VendorComparisonData = {
  rfqReference: 'RFQ-2024-0089',
  prReference: 'PR-2024-0156',
  department: 'IT Infrastructure',
  requestType: 'Capex',
  estimatedBudget: '₹8,50,000',
  recommendedVendorId: 'vendor-2',
  vendors: [
    {
      id: 'vendor-1',
      name: 'TechCorp Solutions',
      quotationFiles: [
        { id: 'f1-1', fileName: 'TechCorp_Quotation_RFQ0089.pdf', fileType: 'pdf', fileSize: '1.2 MB', uploadedBy: 'Vendor Portal', uploadedAt: '12 Jan 2024, 10:30 AM' },
        { id: 'f1-2', fileName: 'TechCorp_Technical_Specs.xlsx', fileType: 'xlsx', fileSize: '540 KB', uploadedBy: 'Vendor Portal', uploadedAt: '12 Jan 2024, 10:32 AM' },
      ],
      quoteRounds: [
        {
          round: 1,
          submittedDate: '08 Jan 2024, 11:00 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 920000,
          leadTime: 55,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 78,
          commercialScore: 70,
          overallScore: 74.8,
          status: 'sent-back',
          sentBackReason: 'Price too high vs budget. Lead time needs reduction. Please revise and resubmit.',
          vendorNotes: 'Initial quote based on standard pricing.',
          quotationFile: 'TechCorp_Round1_Quote.pdf',
        },
        {
          round: 2,
          submittedDate: '11 Jan 2024, 02:30 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 870000,
          leadTime: 48,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 82,
          commercialScore: 75,
          overallScore: 79.2,
          status: 'sent-back',
          sentBackReason: 'Still above budget ceiling. Technical specs need clarification on warranty terms.',
          vendorNotes: 'Revised pricing with 5.4% reduction. Lead time improved.',
          quotationFile: 'TechCorp_Round2_Revised.pdf',
        },
        {
          round: 3,
          submittedDate: '12 Jan 2024, 10:30 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 845000,
          leadTime: 45,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 85,
          commercialScore: 78,
          overallScore: 82.2,
          status: 'tech-evaluated',
          techEvalBy: 'Suresh Reddy (Tech Evaluator)',
          techEvalDate: '14 Jan 2024',
          vendorNotes: 'Final best offer. 3-year warranty included.',
          quotationFile: 'TechCorp_Round3_Final.pdf',
        },
      ],
      parameters: [
        { key: 'quotedPrice', displayValue: '₹8,45,000', numericValue: 845000 },
        { key: 'leadTime', displayValue: '45 days', numericValue: 45 },
        { key: 'paymentTerms', displayValue: 'Standard (Net 30)' },
        { key: 'complianceStatus', displayValue: 'Compliant' },
        { key: 'technicalScore', displayValue: '85/100', numericValue: 85 },
        { key: 'commercialScore', displayValue: '78/100', numericValue: 78 },
        { key: 'overallScore', displayValue: '82.2/100', numericValue: 82.2 },
        { key: 'deliveryTerms', displayValue: 'FOB Destination' },
      ],
    },
    {
      id: 'vendor-2',
      name: 'Global IT Systems',
      quotationFiles: [
        { id: 'f2-1', fileName: 'GlobalIT_Commercial_Quote.pdf', fileType: 'pdf', fileSize: '2.1 MB', uploadedBy: 'Vendor Portal', uploadedAt: '11 Jan 2024, 03:15 PM' },
        { id: 'f2-2', fileName: 'GlobalIT_BOM_Breakdown.xlsx', fileType: 'xlsx', fileSize: '780 KB', uploadedBy: 'Vendor Portal', uploadedAt: '11 Jan 2024, 03:18 PM' },
        { id: 'f2-3', fileName: 'GlobalIT_Compliance_Certificate.pdf', fileType: 'pdf', fileSize: '320 KB', uploadedBy: 'Vendor Portal', uploadedAt: '11 Jan 2024, 03:20 PM' },
      ],
      quoteRounds: [
        {
          round: 1,
          submittedDate: '07 Jan 2024, 09:00 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 860000,
          leadTime: 40,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 88,
          commercialScore: 82,
          overallScore: 85.6,
          status: 'sent-back',
          sentBackReason: 'BOM breakdown required. Delivery schedule needs to be confirmed.',
          vendorNotes: 'Competitive initial pricing.',
          quotationFile: 'GlobalIT_Round1_Quote.pdf',
        },
        {
          round: 2,
          submittedDate: '10 Jan 2024, 04:00 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 820000,
          leadTime: 33,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 90,
          commercialScore: 85,
          overallScore: 88.0,
          status: 'sent-back',
          sentBackReason: 'Compliance certificate missing. Please attach ISO certification.',
          vendorNotes: 'Revised with detailed BOM. Lead time reduced by 7 days.',
          quotationFile: 'GlobalIT_Round2_BOM.pdf',
        },
        {
          round: 3,
          submittedDate: '11 Jan 2024, 03:15 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 795000,
          leadTime: 30,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Compliant',
          technicalScore: 92,
          commercialScore: 88,
          overallScore: 90.4,
          status: 'tech-evaluated',
          techEvalBy: 'Suresh Reddy (Tech Evaluator)',
          techEvalDate: '14 Jan 2024',
          vendorNotes: 'ISO 9001 certificate attached. Best and final offer.',
          quotationFile: 'GlobalIT_Round3_Final.pdf',
        },
      ],
      parameters: [
        { key: 'quotedPrice', displayValue: '₹7,95,000', numericValue: 795000 },
        { key: 'leadTime', displayValue: '30 days', numericValue: 30 },
        { key: 'paymentTerms', displayValue: 'Standard (Net 30)' },
        { key: 'complianceStatus', displayValue: 'Compliant' },
        { key: 'technicalScore', displayValue: '92/100', numericValue: 92 },
        { key: 'commercialScore', displayValue: '88/100', numericValue: 88 },
        { key: 'overallScore', displayValue: '90.4/100', numericValue: 90.4 },
        { key: 'deliveryTerms', displayValue: 'CIF Port' },
      ],
    },
    {
      id: 'vendor-3',
      name: 'Enterprise Tech Hub',
      quotationFiles: [
        { id: 'f3-1', fileName: 'EnterpriseTech_Quote_Final.pdf', fileType: 'pdf', fileSize: '1.8 MB', uploadedBy: 'Vendor Portal', uploadedAt: '13 Jan 2024, 09:00 AM' },
        { id: 'f3-2', fileName: 'EnterpriseTech_Warranty_Terms.docx', fileType: 'docx', fileSize: '210 KB', uploadedBy: 'Vendor Portal', uploadedAt: '13 Jan 2024, 09:05 AM' },
      ],
      quoteRounds: [
        {
          round: 1,
          submittedDate: '09 Jan 2024, 10:00 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 890000,
          leadTime: 50,
          paymentTerms: 'Deviated (Net 45)',
          compliance: 'Compliant',
          technicalScore: 84,
          commercialScore: 76,
          overallScore: 80.8,
          status: 'sent-back',
          sentBackReason: 'Payment terms deviated from standard. Lead time too long. Price needs revision.',
          vendorNotes: 'Standard enterprise pricing.',
          quotationFile: 'EnterpriseTech_Round1.pdf',
        },
        {
          round: 2,
          submittedDate: '12 Jan 2024, 11:30 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 845000,
          leadTime: 42,
          paymentTerms: 'Deviated (Net 45)',
          compliance: 'Compliant',
          technicalScore: 86,
          commercialScore: 79,
          overallScore: 83.2,
          status: 'sent-back',
          sentBackReason: 'Payment terms still deviated. Warranty documentation incomplete.',
          vendorNotes: 'Price reduced. Lead time improved to 42 days.',
          quotationFile: 'EnterpriseTech_Round2.pdf',
        },
        {
          round: 3,
          submittedDate: '13 Jan 2024, 09:00 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 820000,
          leadTime: 40,
          paymentTerms: 'Deviated (Net 45)',
          compliance: 'Compliant',
          technicalScore: 88,
          commercialScore: 82,
          overallScore: 85.6,
          status: 'tech-evaluated',
          techEvalBy: 'Suresh Reddy (Tech Evaluator)',
          techEvalDate: '15 Jan 2024',
          vendorNotes: 'Warranty terms attached. Final offer.',
          quotationFile: 'EnterpriseTech_Round3_Final.pdf',
        },
      ],
      parameters: [
        { key: 'quotedPrice', displayValue: '₹8,20,000', numericValue: 820000 },
        { key: 'leadTime', displayValue: '40 days', numericValue: 40 },
        { key: 'paymentTerms', displayValue: 'Deviated (Net 45)' },
        { key: 'complianceStatus', displayValue: 'Compliant' },
        { key: 'technicalScore', displayValue: '88/100', numericValue: 88 },
        { key: 'commercialScore', displayValue: '82/100', numericValue: 82 },
        { key: 'overallScore', displayValue: '85.6/100', numericValue: 85.6 },
        { key: 'deliveryTerms', displayValue: 'FOB Origin' },
      ],
    },
    {
      id: 'vendor-4',
      name: 'Digital Innovations Ltd',
      quotationFiles: [
        { id: 'f4-1', fileName: 'DigitalInno_Quotation.pdf', fileType: 'pdf', fileSize: '950 KB', uploadedBy: 'Vendor Portal', uploadedAt: '14 Jan 2024, 11:45 AM' },
      ],
      quoteRounds: [
        {
          round: 1,
          submittedDate: '10 Jan 2024, 03:00 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 950000,
          leadTime: 45,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Partially Compliant',
          technicalScore: 74,
          commercialScore: 68,
          overallScore: 71.6,
          status: 'sent-back',
          sentBackReason: 'Compliance issues noted. Price significantly above budget. Technical specs incomplete.',
          vendorNotes: 'Initial quote. Open to negotiation.',
          quotationFile: 'DigitalInno_Round1.pdf',
        },
        {
          round: 2,
          submittedDate: '14 Jan 2024, 11:45 AM',
          submittedBy: 'vendor-portal',
          quotedPrice: 865000,
          leadTime: 35,
          paymentTerms: 'Standard (Net 30)',
          compliance: 'Partially Compliant',
          technicalScore: 80,
          commercialScore: 75,
          overallScore: 78.0,
          status: 'tech-evaluated',
          techEvalBy: 'Suresh Reddy (Tech Evaluator)',
          techEvalDate: '16 Jan 2024',
          vendorNotes: 'Revised pricing. Compliance partially addressed.',
          quotationFile: 'DigitalInno_Round2_Final.pdf',
        },
      ],
      parameters: [
        { key: 'quotedPrice', displayValue: '₹8,65,000', numericValue: 865000 },
        { key: 'leadTime', displayValue: '35 days', numericValue: 35 },
        { key: 'paymentTerms', displayValue: 'Standard (Net 30)' },
        { key: 'complianceStatus', displayValue: 'Partially Compliant' },
        { key: 'technicalScore', displayValue: '80/100', numericValue: 80 },
        { key: 'commercialScore', displayValue: '75/100', numericValue: 75 },
        { key: 'overallScore', displayValue: '78.0/100', numericValue: 78.0 },
        { key: 'deliveryTerms', displayValue: 'Ex Works' },
      ],
    },
    {
      id: 'vendor-5',
      name: 'Smart Systems Inc',
      quotationFiles: [
        { id: 'f5-1', fileName: 'SmartSystems_Quote_v2.pdf', fileType: 'pdf', fileSize: '1.5 MB', uploadedBy: 'Vendor Portal', uploadedAt: '10 Jan 2024, 02:00 PM' },
        { id: 'f5-2', fileName: 'SmartSystems_Product_Catalog.pdf', fileType: 'pdf', fileSize: '3.4 MB', uploadedBy: 'Vendor Portal', uploadedAt: '10 Jan 2024, 02:05 PM' },
        { id: 'f5-3', fileName: 'SmartSystems_Delivery_Schedule.xlsx', fileType: 'xlsx', fileSize: '430 KB', uploadedBy: 'Vendor Portal', uploadedAt: '10 Jan 2024, 02:08 PM' },
      ],
      quoteRounds: [
        {
          round: 1,
          submittedDate: '06 Jan 2024, 04:00 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 840000,
          leadTime: 60,
          paymentTerms: 'Deviated (Net 60)',
          compliance: 'Compliant',
          technicalScore: 82,
          commercialScore: 74,
          overallScore: 78.8,
          status: 'sent-back',
          sentBackReason: 'Lead time of 60 days is too long. Payment terms deviated. Please revise.',
          vendorNotes: 'Competitive pricing. Delivery schedule attached.',
          quotationFile: 'SmartSystems_Round1.pdf',
        },
        {
          round: 2,
          submittedDate: '09 Jan 2024, 01:00 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 810000,
          leadTime: 52,
          paymentTerms: 'Deviated (Net 60)',
          compliance: 'Compliant',
          technicalScore: 84,
          commercialScore: 77,
          overallScore: 81.2,
          status: 'sent-back',
          sentBackReason: 'Lead time still too long. Payment terms remain deviated.',
          vendorNotes: 'Price reduced. Lead time improved by 8 days.',
          quotationFile: 'SmartSystems_Round2.pdf',
        },
        {
          round: 3,
          submittedDate: '10 Jan 2024, 02:00 PM',
          submittedBy: 'vendor-portal',
          quotedPrice: 785000,
          leadTime: 50,
          paymentTerms: 'Deviated (Net 60)',
          compliance: 'Compliant',
          technicalScore: 86,
          commercialScore: 80,
          overallScore: 83.6,
          status: 'tech-evaluated',
          techEvalBy: 'Suresh Reddy (Tech Evaluator)',
          techEvalDate: '14 Jan 2024',
          vendorNotes: 'Best and final offer. Product catalog and delivery schedule attached.',
          quotationFile: 'SmartSystems_Round3_Final.pdf',
        },
      ],
      parameters: [
        { key: 'quotedPrice', displayValue: '₹7,85,000', numericValue: 785000 },
        { key: 'leadTime', displayValue: '50 days', numericValue: 50 },
        { key: 'paymentTerms', displayValue: 'Deviated (Net 60)' },
        { key: 'complianceStatus', displayValue: 'Compliant' },
        { key: 'technicalScore', displayValue: '86/100', numericValue: 86 },
        { key: 'commercialScore', displayValue: '80/100', numericValue: 80 },
        { key: 'overallScore', displayValue: '83.6/100', numericValue: 83.6 },
        { key: 'deliveryTerms', displayValue: 'DDP Delivered' },
      ],
    },
  ],
  parameterRows: [
    { key: 'quotedPrice', label: 'Quoted Price', icon: 'ri-money-rupee-circle-line' },
    { key: 'leadTime', label: 'Lead Time', icon: 'ri-time-line' },
    { key: 'paymentTerms', label: 'Payment Terms', icon: 'ri-bank-card-line' },
    { key: 'complianceStatus', label: 'Compliance Status', icon: 'ri-shield-check-line' },
    { key: 'technicalScore', label: 'Technical Score', icon: 'ri-tools-line' },
    { key: 'commercialScore', label: 'Commercial Score', icon: 'ri-line-chart-line' },
    { key: 'overallScore', label: 'Overall Score', icon: 'ri-star-line' },
    { key: 'deliveryTerms', label: 'Delivery Terms', icon: 'ri-truck-line' },
  ],
};
