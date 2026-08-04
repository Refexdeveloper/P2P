export interface QuoteRound {
  round: number;
  quotedPrice: number;
  leadTime: number;
  paymentTerms: string;
  compliance: boolean;
  technicalScore: number;
  commercialScore: number;
  overallScore: number;
  quotationFile: File | null;
  quotationFileName: string;
  status: 'active' | 'sent-back' | 'pending-tech-eval' | 'tech-evaluated';
  sentBackReason?: string;
  sentBackFields?: string[];
  // Vendor-submitted fields (from vendor portal)
  vendorSubmitted?: boolean;
  vendorSubmittedDate?: string;
  vendorNotes?: string;
  warranty?: string;
  deliveryTerms?: string;
  // Technical evaluation fields (filled by Tech Evaluator role)
  techEvalStatus?: 'pending' | 'in-progress' | 'completed';
  techEvalBy?: string;
  techEvalDate?: string;
  techEvalNotes?: string;
  techEvalCriteria?: TechEvalCriteria;
}

export interface TechEvalCriteria {
  technicalCompliance: number;   // 0-100
  qualityStandards: number;      // 0-100
  deliveryCapability: number;    // 0-100
  afterSalesSupport: number;     // 0-100
  certifications: number;        // 0-100
  siteVisitScore?: number;       // 0-100 (optional)
  remarks: string;
}

export interface VendorQuotation {
  id: string;
  invitationId?: number;
  vendorName: string;
  vendorEmail?: string;
  quotes: QuoteRound[];
  showHistory: boolean;
  // Source tracking
  source?: 'manual' | 'vendor-portal';
  vendorPortalId?: string;
  rfqStatus?: string;
}

export type RFQStatus = 
  | 'draft'
  | 'quotes-in-progress'
  | 'pending-tech-eval'
  | 'tech-eval-in-progress'
  | 'tech-eval-done'
  | 'submitted';
