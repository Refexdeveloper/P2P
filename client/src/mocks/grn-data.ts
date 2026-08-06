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
  poId?: number;
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
  /** True when row is a vendor-accepted PO waiting for GRN entry */
  awaitingEntry?: boolean;
  receiptHistory: {
    action: string;
    performedBy: string;
    role: string;
    date: string;
    notes: string;
  }[];
}

/** Mock list removed — GRN register loads vendor-accepted POs from API */
export const grnData: GRNData[] = [];
