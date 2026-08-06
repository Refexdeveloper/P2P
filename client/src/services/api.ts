const LIVE_API = 'https://p2p-backend-645830234926.asia-south1.run.app';
const API_URL = (import.meta.env.VITE_API_URL || LIVE_API).replace(/\/$/, '');


export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem('p2p_token');
}

async function downloadCsvFile(path: string, fallbackName: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text.slice(0, 200) || 'Download failed';
    try {
      message = (JSON.parse(text) as { message?: string }).message || message;
    } catch {
      /* keep text */
    }
    throw new ApiError(res.status, message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new ApiError(res.status, text.slice(0, 200) || `Request failed (${res.status})`);
      }
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data.message as string) || text.slice(0, 200) || `Request failed (${res.status})`);
  }
  return data as T;
}

export interface NavItem {
  code: string;
  label: string;
  path: string;
  icon: string;
  group?: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
  departmentId?: number | null;
  departmentName?: string | null;
  isSuperAdmin?: boolean;
  permissions?: string[];
  navigation?: NavItem[];
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  loginWithRefexOneToken: (accessToken: string) =>
    request<LoginResponse>('/api/auth/refexone', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    }),
  loginWithRefexOneCredentials: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/refexone/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  refexOneConfig: () =>
    request<{
      enabled: boolean;
      refexoneUrl: string;
      launchUrl?: string;
      homeUrl?: string;
      saml?: { entityId: string; acsUrl: string; homeUrl: string };
    }>('/api/auth/refexone/config'),
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
};

export const prApi = {
  list: () => request<{ data: unknown[] }>('/api/purchase-requests'),
  listPending: () => request<{ data: unknown[] }>('/api/purchase-requests?pending=true'),
  listScmBucket: () => request<{ data: unknown[] }>('/api/purchase-requests?bucket=scm'),
  get: (id: number) => request<{ data: unknown }>(`/api/purchase-requests/${id}`),
  create: (body: Record<string, unknown>) =>
    request<{ data: unknown }>('/api/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  approve: (id: number, action: 'approve' | 'reject' | 'return' | 'rework', remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    }),
  resubmit: (id: number, body: Record<string, unknown>) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Record<string, unknown>) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  requesterStats: () => request<{ data: Record<string, number> }>('/api/purchase-requests/stats/requester'),
  managerStats: () =>
    request<{ data: { stats: Record<string, number>; departmentBudget: unknown[] } }>(
      '/api/purchase-requests/stats/manager'
    ),
};

export const taskApi = {
  list: () => request<{ data: unknown[] }>('/api/tasks'),
  listRequester: () => request<{ data: unknown[] }>('/api/tasks/requester'),
  complete: (taskId: number, prId: number, action: 'approve' | 'reject' | 'return', remarks: string) =>
    request<{ data: unknown }>(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ prId, action, remarks }),
    }),
  completeRfq: (taskId: number) =>
    request<{ data: unknown; message: string }>(`/api/tasks/${taskId}/complete-rfq`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export interface RfqFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  filledBy: 'vendor' | 'requester';
  required?: boolean;
  core?: boolean;
  options?: string[];
}

export const rfqApi = {
  getByPr: (prId: number) =>
    request<{ data: { pr: unknown; config: unknown; invitations: unknown[]; quotations: unknown[]; tableRows: unknown[] } }>(`/api/rfq/pr/${prId}`),
  saveConfig: (prId: number, body: Record<string, unknown>) =>
    request<{ data: { config: unknown }; message: string }>(`/api/rfq/pr/${prId}/config`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  finalize: (prId: number, recommendedInvitationId: number, taskId?: number) =>
    request<{ data: unknown; message: string }>(`/api/rfq/pr/${prId}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ recommendedInvitationId, taskId }),
    }),
  updateReviewFields: (submissionId: number, requesterFields: Record<string, unknown>) =>
    request<{ message: string }>(`/api/rfq/submissions/${submissionId}/review-fields`, {
      method: 'PUT',
      body: JSON.stringify({ requesterFields }),
    }),
  invite: (
    prId: number,
    vendors: { name: string; email: string }[],
    fieldDefinitions?: RfqFieldDefinition[],
    sendEmail = true
  ) =>
    request<{ data: unknown; message: string }>('/api/rfq/invite', {
      method: 'POST',
      body: JSON.stringify({ prId, vendors, fieldDefinitions, sendEmail }),
    }),
  sendBack: (invitationId: number, reason: string, fields: string[]) =>
    request<{ data: { tableRows: unknown[]; config: unknown }; message: string }>(`/api/rfq/invitations/${invitationId}/send-back`, {
      method: 'POST',
      body: JSON.stringify({ reason, fields }),
    }),
  manualSubmit: (invitationId: number, body: Record<string, unknown>) =>
    request<{ data: { quotations: unknown[]; config: unknown }; message: string }>(`/api/rfq/invitations/${invitationId}/manual-submit`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  resendInviteEmail: (invitationId: number) =>
    request<{ message: string }>(`/api/rfq/invitations/${invitationId}/resend-email`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  quotationFileUrl: (submissionId: number) =>
    `${API_URL}/api/rfq/submissions/${submissionId}/file`,
  getComparison: (prId: number) =>
    request<{ data: VendorComparisonData }>(`/api/rfq/pr/${prId}/comparison`),
  listPostApprovalPending: () =>
    request<{ data: PostRfqPendingItem[] }>('/api/rfq/post-approval/pending'),
  listScmEntryPending: () =>
    request<{ data: ScmRfqEntryItem[] }>('/api/rfq/scm-entry/pending'),
  postApprove: (prId: number, action: 'approve' | 'reject' | 'return' | 'rework', remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/rfq/pr/${prId}/post-approve`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    }),
};

export interface PostRfqPendingItem {
  prId: number;
  prNumber: string;
  title: string;
  department: string;
  requester: string;
  totalAmount: number;
  requestType: string;
  priority: string;
  status: string;
  submittedDate: string;
  vendorCount: number;
  recommendedVendor: string;
  stageLabel: string;
}

export interface ScmRfqEntryItem {
  prId: number;
  prNumber: string;
  title: string;
  department: string;
  requester: string;
  totalAmount: number;
  requestType: string;
  priority: string;
  requiredDate: string;
  vendorSelection?: 'own' | 'scm';
  vendorCount: number;
  status: string;
}

export interface VendorComparisonData {
  pr: {
    id: number;
    prNumber: string;
    title: string;
    department: string;
    requestType: string;
    totalAmount: number;
    estimatedBudget: number;
    status: string;
    statusUI: string;
    justification: string;
    approvalHistory: Array<{ stage: string; user: string; role: string; date: string; status: string; remarks: string }>;
  };
  vendorCount: number;
  recommendedVendorId: number | null;
  recommendedVendorName: string;
  showFullNegotiation: boolean;
  stageLabel: string | null;
  canApprove: boolean;
  vendors: Array<{
    id: number;
    name: string;
    isRecommended: boolean;
    round: number;
    status: string;
    latest: Record<string, unknown>;
    latestSubmissionId: number | null;
    quotationFileName?: string;
    rounds: Array<{
      round: number;
      values: Record<string, unknown>;
      submittedAt: string;
      quotationFileName: string;
      submissionId: number;
    }>;
  }>;
  parameters: Array<{ id: string; label: string; type: string; icon: string }>;
  matrix: Record<string, { values: Record<number, { raw: unknown; display: string }>; bestVendorId: number | null }>;
}

const PO_API_URL = API_URL;

export const poApi = {
  getCreateContext: (prId: number) =>
    request<{ data: { pr: Record<string, unknown>; vendor: Record<string, unknown> } }>(`/api/po/pr/${prId}/context`),
  create: (prId: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/po/pr/${prId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  list: (pending?: boolean) =>
    request<{ data: unknown[] }>(`/api/po${pending ? '?pending=true' : ''}`),
  listTrack: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    purchaseType?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set('page', String(params.page));
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.purchaseType && params.purchaseType !== 'all') {
      query.set('purchaseType', params.purchaseType);
    }
    const qs = query.toString();
    return request<{
      data: Array<{
        key: string;
        prId: number;
        poId: number | null;
        prNumber: string;
        poNumber: string | null;
        title: string;
        department: string;
        requester: string;
        vendorName: string;
        amount: number;
        status: string;
        statusLabel: string;
        statusRaw?: string;
        purchaseType?: string;
        purchaseTypeLabel?: string;
        requiredDate: string;
        createdAt: string;
        kind: 'ready' | 'po';
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
      stats: {
        total: number;
        ready: number;
        pending: number;
        approved: number;
        rejected: number;
      };
    }>(`/api/po/track${qs ? `?${qs}` : ''}`);
  },
  listPending: () => request<{ data: unknown[] }>('/api/po/pending'),
  listPendingBuyerVerify: () =>
    request<{ data: unknown[] }>('/api/po/pending-buyer-verify'),
  listVendorAcceptance: () =>
    request<{ data: unknown[] }>('/api/po/vendor-acceptance'),
  sendVendorAcceptanceMail: (poId: number) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/po/${poId}/vendor-acceptance/send-mail`,
      { method: 'POST', body: JSON.stringify({}) }
    ),
  submitManualVendorAcceptance: (
    poId: number,
    body: {
      action: 'accept' | 'reject' | 'partial';
      remarks: string;
      deliveryDate?: string;
      fileName?: string;
      fileData?: string;
    }
  ) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/po/${poId}/vendor-acceptance/manual`,
      { method: 'POST', body: JSON.stringify(body) }
    ),
  getVendorAcceptanceByToken: (token: string) =>
    request<{ data: Record<string, unknown> }>(`/api/po/vendor-accept/${encodeURIComponent(token)}`),
  submitVendorAcceptanceByToken: (
    token: string,
    body: {
      action: 'accept' | 'reject' | 'partial';
      remarks: string;
      deliveryDate?: string;
      fileName?: string;
      fileData?: string;
    }
  ) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/po/vendor-accept/${encodeURIComponent(token)}`,
      { method: 'POST', body: JSON.stringify(body) }
    ),
  getVendorAcceptancePdfUrl: (token: string) =>
    `${PO_API_URL}/api/po/vendor-accept/${encodeURIComponent(token)}/pdf`,
  getVendorAcceptanceFileUrl: (poId: number) =>
    `${PO_API_URL}/api/po/${poId}/vendor-acceptance/file`,
  finalVerify: (poId: number, remarks?: string) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/final-verify`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),
  rejectFinalVerify: (poId: number, remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/final-verify/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),
  getByNumber: (poNumber: string) =>
    request<{ data: Record<string, unknown> }>(`/api/po/by-number/${encodeURIComponent(poNumber)}`),
  get: (poId: number) => request<{ data: Record<string, unknown> }>(`/api/po/${poId}`),
  getPdfUrl: (poId: number) => `${PO_API_URL}/api/po/${poId}/pdf`,
  downloadPdf: async (poId: number) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/${poId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text.slice(0, 200) || 'Could not download PDF');
    }
    return res.blob();
  },
  getDocumentUrl: (poId: number) => `${PO_API_URL}/api/po/${poId}/document`,
  previewDocumentHtml: async (prId: number, body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/pr/${prId}/preview-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text.slice(0, 200) || 'Could not load PO preview');
    }
    return res.text();
  },
  previewDocumentHtmlByPoId: async (poId: number, body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/${poId}/preview-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text.slice(0, 200) || 'Could not load PO preview');
    }
    return res.text();
  },
  fetchPdfBlob: async (poId: number) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/${poId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text.slice(0, 200) || 'Could not load PDF');
    }
    return res.blob();
  },
  sign: (
    poId: number,
    remarks: string,
    options?: {
      signatureName?: string;
      signatureImage?: string;
      signatureId?: number;
      saveToGallery?: boolean;
    }
  ) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/sign`, {
      method: 'POST',
      body: JSON.stringify({ remarks, ...options }),
    }),
  reject: (poId: number, remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),
  update: (poId: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/po/${poId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listSignatures: () =>
    request<{ data: UserSignatureItem[] }>('/api/po/signatures'),
  saveSignature: (image: string, label?: string) =>
    request<{ data: UserSignatureItem; message: string }>('/api/po/signatures', {
      method: 'POST',
      body: JSON.stringify({ image, label }),
    }),
  deleteSignature: (id: number) =>
    request<{ message: string }>(`/api/po/signatures/${id}`, { method: 'DELETE' }),
  getExcelImportConfig: () =>
    request<{ data: { defaultStatus: 'draft' | 'imported'; allowedStatuses: string[] } }>(
      '/api/po/excel-import/config'
    ),
  downloadExcelImportTemplate: () =>
    downloadCsvFile('/api/po/excel-import/template', 'po-import-template.csv'),
  validateExcelImport: (rows: Record<string, string>[]) =>
    request<{
      data: {
        valid: boolean;
        errors: Array<{ row: number; poNumber: string; field: string; message: string }>;
        groups: Array<Record<string, unknown>>;
        poCount: number;
        lineItemCount: number;
        defaultStatus: 'draft' | 'imported';
      };
    }>('/api/po/excel-import/validate', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  importExcel: (rows: Record<string, string>[], status?: 'draft' | 'imported') =>
    request<{
      data: {
        success: boolean;
        imported: number;
        failed: number;
        errors: Array<{ row: number; poNumber: string; field: string; message: string }>;
        created?: Array<{ poId: number; poNumber: string; status: string; lineItems: number }>;
        defaultStatus: string;
        message?: string;
      };
      message: string;
    }>('/api/po/excel-import', {
      method: 'POST',
      body: JSON.stringify({ rows, status }),
    }),
};

export interface UserSignatureItem {
  id: number;
  label: string;
  imagePath: string;
  imageDataUrl: string;
  createdAt?: string;
}

export type PoType = 'short_po' | 'long_po';

export interface PoLetterheadClause {
  id?: number;
  termsHeader: string;
  termsDescription: string;
  sortOrder?: number;
}

export interface PoLetterheadConfig {
  poType: PoType;
  poTypeLabel: string;
  title: string;
  letterheadHeader: string;
  terms: PoLetterheadClause[];
  annexure: PoLetterheadClause[];
  updatedAt?: string;
}

export interface LetterheadBranding {
  id?: number;
  name?: string;
  entity: string;
  headerLogo: string;
  footerLogo: string;
  status?: 'active' | 'inactive';
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface LetterheadMasterRecord {
  id: number;
  name: string;
  entity: string;
  headerLogo: string;
  footerLogo: string;
  status: 'active' | 'inactive';
  updatedAt?: string | null;
  createdAt?: string | null;
}

export const poLetterheadApi = {
  list: () => request<{ data: PoLetterheadConfig[] }>('/api/po/letterhead'),
  get: (poType: PoType) =>
    request<{ data: PoLetterheadConfig }>(`/api/po/letterhead/${poType}`),
  save: (poType: PoType, body: Partial<PoLetterheadConfig>) =>
    request<{ data: PoLetterheadConfig; message: string }>(`/api/po/letterhead/${poType}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const letterheadMasterApi = {
  list: (params?: { search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString();
    return request<{ data: LetterheadMasterRecord[] }>(
      `/api/po/letterheads${query ? `?${query}` : ''}`
    );
  },
  get: (id: number) =>
    request<{ data: LetterheadMasterRecord }>(`/api/po/letterheads/${id}`),
  create: (body: Partial<LetterheadMasterRecord>) =>
    request<{ data: LetterheadMasterRecord; message: string }>('/api/po/letterheads', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Partial<LetterheadMasterRecord>) =>
    request<{ data: LetterheadMasterRecord; message: string }>(`/api/po/letterheads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const letterheadBrandingApi = {
  get: () => request<{ data: LetterheadBranding }>('/api/po/letterhead-branding'),
  save: (body: Partial<LetterheadBranding>) =>
    request<{ data: LetterheadBranding; message: string }>('/api/po/letterhead-branding', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export interface VendorDocument {
  id: number;
  docType: 'gst' | 'pan' | 'cheque' | 'msme' | 'kyc' | 'msme_declaration';
  fileName: string;
  uploadedAt: string;
}

export interface VendorRecord {
  id: number;
  vendorCode: string;
  name: string;
  vendorType: string;
  gstNumber: string;
  panNumber: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branch: string;
  status: string;
  createdAt: string;
  documents?: VendorDocument[];
}

export interface VendorListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface VendorPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VendorListStats {
  total: number;
  company: number;
  individual: number;
}

export const vendorApi = {
  list: (params?: string | VendorListParams) => {
    const query = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) query.set('search', params);
    } else if (params) {
      if (params.search) query.set('search', params.search);
      if (params.page != null) query.set('page', String(params.page));
      if (params.limit != null) query.set('limit', String(params.limit));
    }
    const qs = query.toString();
    return request<{
      data: VendorRecord[];
      pagination?: VendorPagination;
      stats?: VendorListStats;
    }>(`/api/vendors${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => request<{ data: VendorRecord }>(`/api/vendors/${id}`),
  create: (body: Record<string, unknown>) =>
    request<{ data: VendorRecord; message: string }>('/api/vendors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: number, body: Record<string, unknown>) =>
    request<{ data: VendorRecord; message: string }>(`/api/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  exportCsv: () => downloadCsvFile('/api/vendors/export', 'vendors-export.csv'),
  downloadImportTemplate: () =>
    downloadCsvFile('/api/vendors/import-template', 'vendors-import-template.csv'),
  importCsv: (csv: string) =>
    request<{
      data: { created: number; updated: number; failed: number; errors: string[] };
      message: string;
    }>('/api/vendors/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  getDocumentUrl: (vendorId: number, docType: string) =>
    `${API_URL}/api/vendors/${vendorId}/documents/${docType}/file`,
  fetchDocumentBlob: async (vendorId: number, docType: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/vendors/${vendorId}/documents/${docType}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, text.slice(0, 200) || 'Could not load document');
    }
    return res.blob();
  },
};

export interface CategoryRecord {
  id: number;
  name: string;
  requestType: 'Capex' | 'Opex' | 'Service' | 'All' | string;
  description: string;
  status: string;
}

export interface EntityRecord {
  id: number;
  name: string;
  code: string;
  costCenter: string;
  description: string;
  status: string;
}

export interface DepartmentRecord {
  id: number;
  name: string;
  code: string;
  description: string;
  status: string;
  budgetAllocated?: number;
  budgetUtilized?: number;
}

export interface ItemRecord {
  id: number;
  itemCode: string;
  name: string;
  description: string;
  categoryId: number | null;
  categoryName: string;
  unit: string;
  hsnCode: string;
  gstPercentage: number;
  status: string;
}

export const masterApi = {
  listCategories: (params?: { search?: string; requestType?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.requestType) q.set('requestType', params.requestType);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ data: CategoryRecord[] }>(`/api/masters/categories${qs ? `?${qs}` : ''}`);
  },
  createCategory: (body: Record<string, unknown>) =>
    request<{ data: CategoryRecord; message: string }>('/api/masters/categories', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCategory: (id: number, body: Record<string, unknown>) =>
    request<{ data: CategoryRecord; message: string }>(`/api/masters/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  listEntities: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ data: EntityRecord[] }>(`/api/masters/entities${qs ? `?${qs}` : ''}`);
  },
  createEntity: (body: Record<string, unknown>) =>
    request<{ data: EntityRecord; message: string }>('/api/masters/entities', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEntity: (id: number, body: Record<string, unknown>) =>
    request<{ data: EntityRecord; message: string }>(`/api/masters/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  exportEntitiesCsv: () =>
    downloadCsvFile('/api/masters/entities/export', 'entities-export.csv'),
  downloadEntityTemplate: () =>
    downloadCsvFile('/api/masters/entities/import-template', 'entities-import-template.csv'),
  importEntitiesCsv: (csv: string) =>
    request<{
      data: { created: number; updated: number; failed: number; errors: string[] };
      message: string;
    }>('/api/masters/entities/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  listDepartments: (params?: { search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ data: DepartmentRecord[] }>(`/api/masters/departments${qs ? `?${qs}` : ''}`);
  },
  createDepartment: (body: Record<string, unknown>) =>
    request<{ data: DepartmentRecord; message: string }>('/api/masters/departments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDepartment: (id: number, body: Record<string, unknown>) =>
    request<{ data: DepartmentRecord; message: string }>(`/api/masters/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  exportCategoriesCsv: () =>
    downloadCsvFile('/api/masters/categories/export', 'categories-export.csv'),
  downloadCategoryTemplate: () =>
    downloadCsvFile('/api/masters/categories/import-template', 'categories-import-template.csv'),
  importCategoriesCsv: (csv: string) =>
    request<{
      data: { created: number; updated: number; failed: number; errors: string[] };
      message: string;
    }>('/api/masters/categories/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  listItems: (params?: { search?: string; categoryId?: number | string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', String(params.categoryId));
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ data: ItemRecord[] }>(`/api/masters/items${qs ? `?${qs}` : ''}`);
  },
  createItem: (body: Record<string, unknown>) =>
    request<{ data: ItemRecord; message: string }>('/api/masters/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateItem: (id: number, body: Record<string, unknown>) =>
    request<{ data: ItemRecord; message: string }>(`/api/masters/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  exportItemsCsv: () => downloadCsvFile('/api/masters/items/export', 'items-export.csv'),
  downloadItemTemplate: () =>
    downloadCsvFile('/api/masters/items/import-template', 'items-import-template.csv'),
  importItemsCsv: (csv: string) =>
    request<{
      data: { created: number; updated: number; failed: number; errors: string[] };
      message: string;
    }>('/api/masters/items/import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
};

export interface AdminUserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  departmentName: string;
  permissions: string[];
  isSuperAdmin: boolean;
  refexoneUserId?: string | null;
  source?: 'refexone' | 'local';
}

export interface AdminRoleRecord {
  role: string;
  defaultPermissions: string[];
}

export interface RefexOneSyncStats {
  total: number;
  created: number;
  updated: number;
  syncedAt: string;
}

export const adminApi = {
  listUsers: () => request<{ data: AdminUserRecord[] }>('/api/admin/users'),
  syncUsers: () =>
    request<{ data: AdminUserRecord[]; stats: RefexOneSyncStats; message: string }>('/api/admin/users/sync', {
      method: 'POST',
    }),
  listPermissions: () => request<{ data: NavItem[] }>('/api/admin/permissions'),
  listRoles: () => request<{ data: AdminRoleRecord[] }>('/api/admin/roles'),
  updateUser: (userId: number, payload: { role?: string; permissions?: string[] }) =>
    request<{ data: AdminUserRecord; message: string }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateUserPermissions: (userId: number, permissions: string[]) =>
    request<{ data: { permissions: string[] }; message: string }>(`/api/admin/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
};
