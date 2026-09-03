const LIVE_API = 'https://p2p-backend-645830234926.asia-south1.run.app';
/** API base URL — set VITE_API_URL in client/.env (see .env.example). */
export const API_BASE_URL = String(import.meta.env.VITE_API_URL || LIVE_API).replace(/\/$/, '');
const API_URL = API_BASE_URL;
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

function errorMessageFromResponse(text: string, fallback: string) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed?.message) return String(parsed.message);
  } catch {
    /* keep raw */
  }
  return raw.slice(0, 200) || fallback;
}
function asPdfBlob(buffer: ArrayBuffer): Blob {
  const bytes = new Uint8Array(buffer);
  const header = String.fromCharCode(bytes[0] || 0, bytes[1] || 0, bytes[2] || 0, bytes[3] || 0, bytes[4] || 0);
  if (!header.startsWith('%PDF')) {
    const text = new TextDecoder().decode(bytes.slice(0, 300));
    let message = 'Downloaded file is not a valid PDF';
    try {
      message = (JSON.parse(text) as { message?: string }).message || message;
    } catch {
      if (/<html|<!doctype/i.test(text)) {
        message = 'Server returned HTML instead of PDF. Try Download PDF again after server restart.';
      }
    }
    throw new ApiError(400, message);
  }
  return new Blob([buffer], { type: 'application/pdf' });
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Safe download name from PO number, e.g. PO-SWELTER-2026-27-0001.pdf */
export function poPdfDownloadFileName(
  poNumber: string | null | undefined,
  kind: 'final' | 'draft' | 'signed' | 'preview' = 'final'
) {
  const base = String(poNumber || 'PO')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'PO';
  if (kind === 'preview') return `${base}_preview.pdf`;
  if (kind === 'signed') return `${base}_signed.pdf`;
  if (kind === 'draft') return `${base}_draft.pdf`;
  return `${base}.pdf`;
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
  entityId?: number | null;
  entityName?: string | null;
  entityCode?: string | null;
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
      samlAppId?: string | null;
      ssoUrl?: string | null;
      saml?: {
        entityId: string;
        acsUrl: string;
        homeUrl: string;
        appId?: string | null;
        ssoUrl?: string | null;
      };
    }>('/api/auth/refexone/config'),
  /** 302 to https://refexone.com/api/saml/{APP_ID}/sso?RelayState= */
  refexOneSsoStartUrl: (returnUrl?: string) => {
    const qs = new URLSearchParams();
    if (returnUrl) qs.set('returnUrl', returnUrl);
    return `${API_URL}/api/auth/refexone/sso${qs.toString() ? `?${qs}` : ''}`;
  },
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
};

export type RequesterPrListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  requestType?: string;
  dateFrom?: string;
  dateTo?: string;
  scope?: 'requester';
  involvedOnly?: boolean;
};

export type RequesterPrListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PrAttachmentRecord = {
  id: number;
  prId?: number;
  fileName: string;
  size: number;
  mimeType?: string;
  uploadedAt?: string;
};

export async function fileToAttachmentPayload(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, data, mimeType: file.type };
}

export const prApi = {
  list: (params?: RequesterPrListParams) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.requestType && params.requestType !== 'all') qs.set('requestType', params.requestType);
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    if (params?.scope) qs.set('scope', params.scope);
    if (params?.involvedOnly) qs.set('involvedOnly', 'true');
    // Default requester-fast path when any list params are used
    if (params && !params.scope && (params.page != null || params.search || params.status)) {
      qs.set('scope', 'requester');
    }
    const query = qs.toString();
    return request<{ data: unknown[]; meta?: RequesterPrListMeta }>(
      `/api/purchase-requests${query ? `?${query}` : ''}`
    );
  },
  listPending: () => request<{ data: unknown[] }>('/api/purchase-requests?pending=true'),
  listScmBucket: () => request<{ data: unknown[] }>('/api/purchase-requests?bucket=scm'),
  get: (id: number) => request<{ data: unknown }>(`/api/purchase-requests/${id}`),
  listApprovalUsers: () =>
    request<{
      data: Array<{ id: number; name: string; email: string; role: string; department: string }>;
    }>('/api/purchase-requests/approval-users'),
  previewL1Manager: (department?: string) =>
    request<{
      data: {
        nextStep: string;
        l1Manager: { name: string | null; email: string | null };
      };
    }>(`/api/purchase-requests/l1-manager${department ? `?department=${encodeURIComponent(department)}` : ''}`),
  create: (body: Record<string, unknown>) =>
    request<{ data: unknown }>('/api/purchase-requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  sendBackTargets: (id: number, opts?: { admin?: boolean }) =>
    request<{ data: { key: string; label: string }[] }>(
      `/api/purchase-requests/${id}/send-back-targets${opts?.admin ? '?admin=1' : ''}`
    ),
  /** Track PR admin: send back to any prior workflow step */
  adminSendBack: (id: number, body: { returnTo: string; remarks: string }) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/admin/send-back`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDelete: (id: number) =>
    request<{ data: { prId: number; prNumber: string }; message: string }>(`/api/purchase-requests/${id}`, {
      method: 'DELETE',
    }),
  deleteDraft: (id: number) =>
    request<{ data: { prId: number; prNumber: string }; message: string }>(
      `/api/purchase-requests/${id}/draft`,
      { method: 'DELETE' }
    ),
  approve: (
    id: number,
    action: 'approve' | 'reject' | 'return' | 'rework',
    remarks: string,
    options?: { returnTo?: string; goToBusinessApproval?: boolean }
  ) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        remarks,
        ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
        ...(typeof options?.goToBusinessApproval === 'boolean'
          ? { goToBusinessApproval: options.goToBusinessApproval }
          : {}),
      }),
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
  updateBilling: (id: number, body: Record<string, unknown>) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/billing`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  /** RFQ Approval / admin: edit any PR field + line items */
  adminUpdate: (id: number, body: Record<string, unknown>) =>
    request<{ data: unknown; message: string }>(`/api/purchase-requests/${id}/admin`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  uploadAttachment: (prId: number, body: { fileName: string; data: string; mimeType?: string }) =>
    request<{ data: PrAttachmentRecord }>(`/api/purchase-requests/${prId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteAttachment: (prId: number, attachmentId: number) =>
    request<{ message: string }>(`/api/purchase-requests/${prId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    }),
  downloadAttachment: async (prId: number, attachmentId: number, fileName: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/purchase-requests/${prId}/attachments/${attachmentId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not download file'));
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'attachment';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  requesterStats: () => request<{ data: Record<string, number> }>('/api/purchase-requests/stats/requester'),
  managerStats: () =>
    request<{ data: { stats: Record<string, number>; departmentBudget: unknown[] } }>(
      '/api/purchase-requests/stats/manager'
    ),
  cfoDashboard: () =>
    request<{
      data: {
        stats: {
          totalPendingApprovals: number;
          highValuePRs: number;
          approvedThisMonth: number;
          rejectedThisMonth: number;
          totalSpendAllEntities: number;
          pendingAmount?: number;
          approvedAmountThisMonth?: number;
        };
        entities: Array<{
          id: string;
          name: string;
          code: string;
          allocatedBudget: number;
          utilizedBudget: number;
          utilizationPercentage: number;
          pendingPRsCount: number;
          pendingAmount: number;
          approvedAmount: number;
          color: string;
        }>;
        highValueAlerts: Array<{
          id: string;
          prId: string;
          title: string;
          entity: string;
          amount: number;
          priority: string;
          daysWaiting: number;
          isOverdue?: boolean;
        }>;
        recentActivity: Array<{
          id: string;
          type: string;
          prId: string;
          entity: string;
          amount: number;
          user: string;
          timestamp: string;
        }>;
      };
    }>('/api/purchase-requests/stats/cfo'),
};

export const taskApi = {
  list: () => request<{ data: unknown[] }>('/api/tasks'),
  listRequester: () => request<{ data: unknown[] }>('/api/tasks/requester'),
  complete: (
    taskId: number,
    prId: number,
    action: 'approve' | 'reject' | 'return',
    remarks: string,
    options?: { returnTo?: string }
  ) =>
    request<{ data: unknown }>(`/api/tasks/${taskId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        prId,
        action,
        remarks,
        ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
      }),
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
  /** Where this field appears on the comparative statement */
  showIn?: 'commercial' | 'technical';
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
  finalize: (
    prId: number,
    recommendedInvitationId: number,
    taskId?: number,
    recommendationJustification?: string
  ) =>
    request<{ data: unknown; message: string }>(`/api/rfq/pr/${prId}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ recommendedInvitationId, taskId, recommendationJustification }),
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
  removeInvitation: (invitationId: number) =>
    request<{
      data: { tableRows: unknown[]; config: unknown; removedVendorName?: string };
      message: string;
    }>(`/api/rfq/invitations/${invitationId}`, { method: 'DELETE' }),
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
  attachQuotationFile: (submissionId: number, body: { quotationFileName: string; quotationFileData: string }) =>
    request<{ data: { submissionId: number; quotationFileName: string }; message: string }>(
      `/api/rfq/submissions/${submissionId}/attach-file`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
  extractQuotation: (body: {
    fileName: string;
    fileData: string;
    pages?: Array<{ fileName: string; fileData: string }>;
  }) =>
    request<{
      data: {
        quotedPrice: number;
        lineItems: Array<{
          description: string;
          quantity: number;
          quotedUnitPrice: number;
          quotedTotal: number;
          extra?: boolean;
        }>;
        leadTime?: number;
        paymentTerms?: string;
        scanned?: boolean;
        foundText?: boolean;
        method?: string;
        textPreview?: string;
      };
      message: string;
    }>('/api/rfq/quotation-extract', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Edit quoted amounts / line items (+ optional file) on an existing submission */
  updateSubmission: (submissionId: number, body: Record<string, unknown>) =>
    request<{
      data: { tableRows: unknown[]; config: unknown; quotations: unknown[] };
      message: string;
    }>(`/api/rfq/submissions/${submissionId}/admin`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  resendInviteEmail: (invitationId: number) =>
    request<{ message: string }>(`/api/rfq/invitations/${invitationId}/resend-email`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  quotationFileUrl: (submissionId: number) =>
    `${API_URL}/api/rfq/submissions/${submissionId}/file`,
  quotationExtraFileUrl: (fileId: number) =>
    `${API_URL}/api/rfq/quotation-files/${fileId}/file`,
  getComparison: (prId: number) =>
    request<{ data: VendorComparisonData }>(`/api/rfq/pr/${prId}/comparison`),
  listPostApprovalPending: () =>
    request<{ data: PostRfqPendingItem[] }>('/api/rfq/post-approval/pending'),
  listScmEntryPending: () =>
    request<{ data: ScmRfqEntryItem[] }>('/api/rfq/scm-entry/pending'),
  postApprove: (
    prId: number,
    action: 'approve' | 'reject' | 'return' | 'rework',
    remarks: string,
    options?: { goToBusinessApproval?: boolean; returnTo?: string }
  ) =>
    request<{ data: unknown; message: string }>(`/api/rfq/pr/${prId}/post-approve`, {
      method: 'POST',
      body: JSON.stringify({
        action,
        remarks,
        ...(typeof options?.goToBusinessApproval === 'boolean'
          ? { goToBusinessApproval: options.goToBusinessApproval }
          : {}),
        ...(options?.returnTo ? { returnTo: options.returnTo } : {}),
      }),
    }),
};

export interface PostRfqPendingItem {
  prId: number;
  prNumber: string;
  title: string;
  department: string;
  entityName?: string;
  entityCode?: string;
  requester: string;
  totalAmount: number;
  requestType: string;
  priority: string;
  status: string;
  submittedDate: string;
  vendorCount: number;
  recommendedVendor: string;
  stageLabel: string;
  approvalState?: 'pending' | 'approved';
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
  recommendedInvitationId?: number | null;
  recommendationJustification?: string;
  recommendedVendor?: string;
  canGoPo?: boolean;
}

export interface VendorComparisonData {
  pr: {
    id: number;
    prNumber: string;
    title: string;
    department: string;
    entityName?: string;
    entityCode?: string;
    requestType: string;
    totalAmount: number;
    estimatedBudget: number;
    status: string;
    statusUI: string;
    vendorSelection?: 'own' | 'scm';
    prFlow?: 'standard' | 'functional';
    justification: string;
    approvalHistory: Array<{ stage: string; user: string; role: string; date: string; status: string; remarks: string }>;
    lineItems?: Array<{
      id: number | string;
      description: string;
      category?: string;
      quantity: number;
      uom?: string;
      unitCost?: number;
      total?: number;
    }>;
  };
  vendorCount: number;
  /** Highest quotation round reached across vendors */
  totalRounds?: number;
  /** Configured round limit (null = unlimited) */
  maxRounds?: number | null;
  recommendedVendorId: number | null;
  recommendedVendorName: string;
  recommendationJustification?: string;
  recommendedRound?: number | null;
  recommendedQuoteLineItems?: Array<{
    lineItemId?: string | number;
    description?: string;
    quantity?: number;
    quotedUnitPrice?: number;
    gstPercent?: number;
    quotedTotal?: number;
  }>;
  showFullNegotiation: boolean;
  stageLabel: string | null;
  /** Own-vendor HOD final: ask Yes=CFO / No=SCM vendor selection */
  askBusinessApproval?: boolean;
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
    hasQuotationFile?: boolean;
    quoteLineItems?: Array<Record<string, unknown>>;
    rounds: Array<{
      round: number;
      values: Record<string, unknown>;
      submittedAt: string;
      quotationFileName: string;
      hasQuotationFile?: boolean;
      submissionId: number;
      quotationFiles?: Array<{ id?: number | null; fileName: string; isPrimary?: boolean }>;
      quoteLineItems?: Array<Record<string, unknown>>;
    }>;
  }>;
  parameters: Array<{
    id: string;
    label: string;
    type: string;
    icon: string;
    showIn?: 'commercial' | 'technical';
  }>;
  matrix: Record<string, { values: Record<number, { raw: unknown; display: string }>; bestVendorId: number | null }>;
}

const PO_API_URL = API_URL;

export const poApi = {
  getScmManager: () =>
    request<{ data: { id: number | null; name: string; email: string; role: string } }>(
      '/api/po/scm-manager'
    ),
  cfoInsights: () =>
    request<{
      data: {
        kpis: {
          totalPOAmount: number;
          entityWiseSpend: number;
          approvedPOAmount: number;
          pendingPOAmount: number;
          totalVendorPayments: number;
          budgetUtilization: number;
          totalPOCount: number;
          entityCount: number;
        };
        entityWisePOSummary: Array<{
          entityId: number | null;
          entityName: string;
          code: string;
          totalPOCount: number;
          totalPOAmount: number;
          approvedAmount: number;
          pendingAmount: number;
          color: string;
        }>;
        monthlyPOTrend: Array<Record<string, string | number>>;
        monthlySeries: Array<{ key: string; label: string; color: string }>;
        recentPurchaseOrders: Array<{
          poId: number | null;
          prId: number | null;
          poNumber: string;
          entity: string;
          vendorName: string;
          poAmount: number;
          poDate: string;
          status: string;
        }>;
        topVendorsByPOAmount: Array<{
          vendorName: string;
          entity: string;
          totalPOAmount: number;
          poCount: number;
        }>;
      };
    }>('/api/po/stats/cfo'),
  getCreateContext: (prId: number) =>
    request<{
      data: { pr: Record<string, unknown>; vendor: Record<string, unknown>; draftPoId?: number | null };
    }>(`/api/po/pr/${prId}/context`),
  create: (prId: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/po/pr/${prId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createManual: (body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>('/api/po/manual', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  saveDraft: (body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>('/api/po/draft', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  previewManualDocumentHtml: async (body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/manual/preview-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = text.slice(0, 200) || 'Could not load PO preview';
      try {
        message = (JSON.parse(text) as { message?: string }).message || message;
      } catch {
        /* keep text */
      }
      throw new ApiError(res.status, message);
    }
    return res.text();
  },
  previewManualPdfBlob: async (body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/manual/preview-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = text.slice(0, 200) || 'Could not generate preview PDF';
      try {
        message = (JSON.parse(text) as { message?: string }).message || message;
      } catch {
        /* keep text */
      }
      throw new ApiError(res.status, message);
    }
    return asPdfBlob(await res.arrayBuffer());
  },
  list: (pending?: boolean) =>
    request<{ data: unknown[] }>(`/api/po${pending ? '?pending=true' : ''}`),
  listTrack: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    purchaseType?: string;
    entityId?: number | string;
    department?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.page != null) query.set('page', String(params.page));
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.purchaseType && params.purchaseType !== 'all') {
      query.set('purchaseType', params.purchaseType);
    }
    if (params?.entityId) query.set('entityId', String(params.entityId));
    if (params?.department) query.set('department', params.department);
    if (params?.category) query.set('category', params.category);
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
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
        entityId?: number | null;
        entityName?: string;
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
  getCancellationFileUrl: (poId: number, index: number) =>
    `${PO_API_URL}/api/po/${poId}/cancellation/${index}/file`,
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
  sendBackFinalVerify: (poId: number, remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/final-verify/send-back`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),
  getByNumber: (poNumber: string) =>
    request<{ data: Record<string, unknown> }>(`/api/po/by-number/${encodeURIComponent(poNumber)}`),
  get: (poId: number) => request<{ data: Record<string, unknown> }>(`/api/po/${poId}`),
  adminDelete: (poId: number) =>
    request<{ data: { poId: number; poNumber: string }; message: string }>(`/api/po/${poId}`, {
      method: 'DELETE',
    }),
  getPdfUrl: (poId: number) => `${PO_API_URL}/api/po/${poId}/pdf`,
  downloadPdf: async (poId: number) => {
    const blob = await poApi.fetchPdfBlob(poId);
    return blob;
  },
  /** Fetch PO PDF and save as {poNumber}.pdf */
  downloadPdfFile: async (poId: number, poNumber?: string, kind: 'final' | 'draft' | 'signed' = 'final') => {
    const blob = await poApi.fetchPdfBlob(poId);
    triggerBlobDownload(blob, poPdfDownloadFileName(poNumber, kind));
    return blob;
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
  previewPdfBlob: async (prId: number, body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/pr/${prId}/preview-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not generate preview PDF'));
    }
    return asPdfBlob(await res.arrayBuffer());
  },
  previewPdfBlobByPoId: async (poId: number, body: Record<string, unknown>) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/${poId}/preview-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not generate preview PDF'));
    }
    return asPdfBlob(await res.arrayBuffer());
  },
  fetchPdfBlob: async (poId: number) => {
    const token = getToken();
    const res = await fetch(`${PO_API_URL}/api/po/${poId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not load PDF'));
    }
    return asPdfBlob(await res.arrayBuffer());
  },
  /** Prefer stored/generated PDF; fall back to live HTML document when Chrome/PDF is unavailable. */
  fetchPreviewBlob: async (poId: number): Promise<{ blob: Blob; isHtml: boolean }> => {
    const token = getToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const pdfRes = await fetch(`${PO_API_URL}/api/po/${poId}/pdf`, { headers: authHeaders });
    if (pdfRes.ok) {
      try {
        return { blob: asPdfBlob(await pdfRes.arrayBuffer()), isHtml: false };
      } catch {
        /* not a real PDF — try HTML document */
      }
    }
    const htmlRes = await fetch(`${PO_API_URL}/api/po/${poId}/document`, { headers: authHeaders });
    if (!htmlRes.ok) {
      const text = await htmlRes.text();
      throw new ApiError(htmlRes.status, text.slice(0, 200) || 'Could not load document');
    }
    return { blob: new Blob([await htmlRes.text()], { type: 'text/html' }), isHtml: true };
  },
  sign: (
    poId: number,
    remarks: string,
    options?: {
      signatureName?: string;
      signatureImage?: string;
      signatureId?: number;
      saveToGallery?: boolean;
      dsc?: {
        holderName: string;
        serial: string;
        issuer: string;
        validTill: string;
      };
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
  sendBack: (poId: number, remarks: string) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/send-back`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    }),
  cancel: (
    poId: number,
    body: {
      reason: string;
      attachments?: Array<{ fileName: string; fileData: string }>;
    }
  ) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  retrieve: (poId: number) =>
    request<{ data: unknown; message: string }>(`/api/po/${poId}/retrieve`, {
      method: 'POST',
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
  isDefault?: boolean;
}

export type PoType =
  | 'short_po'
  | 'long_po'
  | 'short_wo'
  | 'long_wo'
  | 'custom_short_po'
  | 'custom_long_po'
  | 'custom_short_wo'
  | 'custom_long_wo';

export const PO_TYPE_LABELS: Record<PoType, string> = {
  short_po: 'Short PO',
  long_po: 'Long PO',
  short_wo: 'Short WO',
  long_wo: 'Long WO',
  custom_short_po: 'Custom PO — Short',
  custom_long_po: 'Custom PO — Long',
  custom_short_wo: 'Custom WO — Short',
  custom_long_wo: 'Custom WO — Long',
};

export const ALL_PO_TYPES: PoType[] = [
  'short_po',
  'long_po',
  'short_wo',
  'long_wo',
  'custom_short_po',
  'custom_long_po',
  'custom_short_wo',
  'custom_long_wo',
];

export function isLongPoType(poType: PoType | string): boolean {
  return String(poType || '')
    .trim()
    .toLowerCase()
    .includes('long');
}

export function isCustomPoType(poType: PoType | string): boolean {
  return String(poType || '')
    .trim()
    .toLowerCase()
    .includes('custom');
}

export function alignPoTypeWithDocument(
  poType: PoType,
  documentType: 'purchase_order' | 'work_order'
): PoType {
  const isLong = isLongPoType(poType);
  const isCustom = isCustomPoType(poType);
  if (documentType === 'work_order') {
    if (isCustom) return isLong ? 'custom_long_wo' : 'custom_short_wo';
    return isLong ? 'long_wo' : 'short_wo';
  }
  if (isCustom) return isLong ? 'custom_long_po' : 'custom_short_po';
  return isLong ? 'long_po' : 'short_po';
}

export function coercePoType(
  raw: unknown,
  documentType: 'purchase_order' | 'work_order'
): PoType {
  const v = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const asType = (ALL_PO_TYPES.includes(v as PoType) ? v : defaultPoTypeForDocument(documentType)) as PoType;
  return alignPoTypeWithDocument(asType, documentType);
}

export function defaultPoTypeForDocument(documentType: 'purchase_order' | 'work_order'): PoType {
  return documentType === 'work_order' ? 'short_wo' : 'short_po';
}

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

export interface LetterheadLocationRecord {
  id?: number;
  location: string;
  gstNo: string;
  footerLogo: string;
  sortOrder?: number;
}

export interface LetterheadBranding {
  id?: number;
  name?: string;
  entity: string;
  location?: string;
  gstNo?: string;
  headerLogo: string;
  footerLogo: string;
  locations?: LetterheadLocationRecord[];
  status?: 'active' | 'inactive';
  updatedAt?: string | null;
  createdAt?: string | null;
}

export interface LetterheadMasterRecord {
  id: number;
  name: string;
  entity: string;
  location: string;
  gstNo: string;
  headerLogo: string;
  footerLogo: string;
  locations?: LetterheadLocationRecord[];
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
  contactName: string;
  msme: string;
  msmeType: '' | 'Micro' | 'Small' | 'Medium' | string;
  documentsComplete: 'yes' | 'no' | string;
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
  uploadDocument: (vendorId: number, body: { docType: string; fileName: string; file: string }) =>
    request<{ data: VendorRecord; message: string }>(`/api/vendors/${vendorId}/documents`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  fetchDocumentBlob: async (vendorId: number, docType: string) => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/vendors/${vendorId}/documents/${docType}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not load document'));
    }
    const contentType = (res.headers.get('Content-Type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const text = await res.text();
      throw new ApiError(res.status, errorMessageFromResponse(text, 'Could not load document'));
    }
    const blob = await res.blob();
    if (!blob.size) {
      throw new ApiError(404, 'Document file is empty. Please re-upload it.');
    }
    return blob;
  },
};

export interface CategoryRecord {
  id: number;
  name: string;
  requestType: 'Capex' | 'Opex' | 'Service' | 'All' | string;
  description: string;
  status: string;
}

export interface EntityLocationRecord {
  id?: number;
  location: string;
  gstNo: string;
  footerLogo: string;
  sortOrder?: number;
}

export interface EntityRecord {
  id: number;
  name: string;
  code: string;
  costCenter: string;
  description: string;
  status: string;
  locations?: EntityLocationRecord[];
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

export type PoSiteLookupType = 'site_address' | 'site_contact' | 'project_manager';

export interface PoSiteLookupRecord {
  id: number;
  type: PoSiteLookupType;
  label: string;
  email: string;
  phone: string;
  status: string;
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
  chatCreateCategory: (body: { name: string; requestType?: string }) =>
    request<{ data: CategoryRecord; message: string }>('/api/masters/categories/chat-create', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  listEntities: (params?: {
    search?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return request<{
      data: EntityRecord[];
      meta?: { page: number; pageSize: number; total: number; totalPages: number };
    }>(`/api/masters/entities${qs ? `?${qs}` : ''}`);
  },
  chatCreateEntity: (body: { name: string; costCenter?: string; code?: string }) =>
    request<{ data: EntityRecord; message: string }>('/api/masters/entities/chat-create', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  chatCreateDepartment: (body: { name: string; code?: string }) =>
    request<{ data: DepartmentRecord; message: string }>('/api/masters/departments/chat-create', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  listPoSiteLookups: (type: PoSiteLookupType) => {
    const q = new URLSearchParams({ type });
    return request<{ data: PoSiteLookupRecord[] }>(`/api/masters/po-site-lookups?${q.toString()}`);
  },
  createPoSiteLookup: (body: {
    type: PoSiteLookupType;
    label: string;
    email?: string;
    phone?: string;
  }) =>
    request<{ data: PoSiteLookupRecord; message: string }>('/api/masters/po-site-lookups', {
      method: 'POST',
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
  listItems: (params?: {
    search?: string;
    categoryId?: number | string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.categoryId) q.set('categoryId', String(params.categoryId));
    if (params?.status) q.set('status', params.status);
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.pageSize != null) q.set('pageSize', String(params.pageSize));
    const qs = q.toString();
    return request<{
      data: ItemRecord[];
      meta?: { page: number; pageSize: number; total: number; totalPages: number };
    }>(`/api/masters/items${qs ? `?${qs}` : ''}`);
  },
  chatCreateItem: (body: { name: string; categoryId?: number | null; unit?: string }) =>
    request<{ data: ItemRecord; message: string }>('/api/masters/items/chat-create', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  entityId?: number | null;
  entityName?: string;
  entityCode?: string;
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

export interface EmailLogRecord {
  id: number;
  emailType: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped' | string;
  prId?: number | null;
  poId?: number | null;
  relatedId?: number | null;
  prNumber?: string;
  poNumber?: string;
  toAddresses: string;
  ccAddresses?: string;
  bccAddresses?: string;
  subject: string;
  messageId?: string;
  errorMessage?: string;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  sentAt?: string | null;
}

export interface WhatsAppLogRecord {
  id: number;
  notifyType: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped' | string;
  prId?: number | null;
  poId?: number | null;
  relatedId?: number | null;
  prNumber?: string;
  poNumber?: string;
  toPhone: string;
  templateName?: string;
  stage?: string;
  wamid?: string;
  errorMessage?: string;
  parameters?: string[] | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
  sentAt?: string | null;
}

export interface UserActivityLogRecord {
  id: number;
  userId?: number | null;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  resource?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  entityType?: string;
  entityId?: number | null;
  entityLabel?: string;
  statusCode?: number | null;
  meta?: Record<string, unknown> | null;
  createdAt?: string;
}

export const adminApi = {
  listUsers: () => request<{ data: AdminUserRecord[] }>('/api/admin/users'),
  syncUsers: () =>
    request<{ data: AdminUserRecord[]; stats: RefexOneSyncStats; message: string }>('/api/admin/users/sync', {
      method: 'POST',
    }),
  listPermissions: () => request<{ data: NavItem[] }>('/api/admin/permissions'),
  listRoles: () => request<{ data: AdminRoleRecord[] }>('/api/admin/roles'),
  updateUser: (userId: number, payload: { role?: string; permissions?: string[]; entityId?: number | null }) =>
    request<{ data: AdminUserRecord; message: string }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateUserPermissions: (userId: number, permissions: string[]) =>
    request<{ data: { permissions: string[] }; message: string }>(`/api/admin/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    }),
  listEmailLogs: (params?: {
    status?: string;
    emailType?: string;
    prId?: number | string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.emailType) q.set('emailType', params.emailType);
    if (params?.prId != null && params.prId !== '') q.set('prId', String(params.prId));
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{
      data: { items: EmailLogRecord[]; total: number; page: number; limit: number };
    }>(`/api/admin/email-logs${qs ? `?${qs}` : ''}`);
  },
  retriggerEmailLog: (id: number, extraTo?: string) =>
    request<{ data: { id: number; status: string; to: string[]; subject: string }; message: string }>(
      `/api/admin/email-logs/${id}/retrigger`,
      {
        method: 'POST',
        body: JSON.stringify({ extraTo: extraTo || '' }),
      }
    ),
  listWhatsAppLogs: (params?: {
    status?: string;
    notifyType?: string;
    prId?: number | string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.notifyType) q.set('notifyType', params.notifyType);
    if (params?.prId != null && params.prId !== '') q.set('prId', String(params.prId));
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{
      data: { items: WhatsAppLogRecord[]; total: number; page: number; limit: number };
    }>(`/api/admin/whatsapp-logs${qs ? `?${qs}` : ''}`);
  },
  listUserActivityLogs: (params?: {
    action?: string;
    userId?: number | string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.userId != null && params.userId !== '') q.set('userId', String(params.userId));
    if (params?.search) q.set('search', params.search);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{
      data: { items: UserActivityLogRecord[]; total: number; page: number; limit: number };
    }>(`/api/admin/user-activity-logs${qs ? `?${qs}` : ''}`);
  },
  resetData: (confirm: string) =>
    request<{
      data: {
        clearedTables: string[];
        missingTables: string[];
        filesRemoved: number;
        kept: string[];
        message: string;
      };
      message: string;
    }>('/api/admin/reset-data', {
      method: 'POST',
      body: JSON.stringify({ confirm }),
    }),
  getScmManagerSignature: () =>
    request<{
      data: {
        fileName: string;
        label: string;
        managerName: string;
        managerEmail: string;
        imageDataUrl: string | null;
        updatedAt: string | null;
      };
    }>('/api/admin/scm-manager-signature'),
  updateScmManagerSignature: (image: string, applyToSignedPos = true) =>
    request<{
      data: {
        fileName: string;
        label: string;
        managerName: string;
        managerEmail: string;
        imageDataUrl: string | null;
        updatedAt: string | null;
        backfilled?: number;
      };
      message: string;
    }>('/api/admin/scm-manager-signature', {
      method: 'PUT',
      body: JSON.stringify({ image, applyToSignedPos }),
    }),
};

export const accountsApi = {
  dashboard: () => request<{ data: Record<string, unknown> }>('/api/accounts/dashboard'),
  listPendingGrnPos: () => request<{ data: Record<string, unknown>[] }>('/api/accounts/grn/pending-pos'),
  listGrnUsers: () =>
    request<{
      data: Array<{ id: number; name: string; email: string; role: string; department: string }>;
    }>('/api/accounts/grn/users'),
  listGrns: () => request<{ data: Record<string, unknown>[] }>('/api/accounts/grn'),
  submitGrn: (body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>('/api/accounts/grn', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listInvoices: (forPayment?: boolean) =>
    request<{ data: Record<string, unknown>[] }>(
      `/api/accounts/invoices${forPayment ? '?forPayment=true' : ''}`
    ),
  getInvoice: (id: number) =>
    request<{ data: Record<string, unknown> }>(`/api/accounts/invoices/${id}`),
  sendVendorInvoiceMail: (id: number) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/accounts/invoices/${id}/send-mail`,
      { method: 'POST', body: JSON.stringify({}) }
    ),
  manualInvoiceEntry: (id: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/accounts/invoices/${id}/manual`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadInvoice: (id: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/accounts/invoices/${id}/upload`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  verifyInvoice: (id: number, action: string, remarks?: string) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/accounts/invoices/${id}/verify`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    }),
  managerApprove: (id: number, action: string, remarks?: string) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/accounts/invoices/${id}/manager-approve`,
      {
        method: 'POST',
        body: JSON.stringify({ action, remarks }),
      }
    ),
  uploadPayment: (id: number, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(`/api/accounts/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  invoiceFileUrl: (id: number) => `${API_URL}/api/accounts/invoices/${id}/file`,
  getVendorInvoiceByToken: (token: string) =>
    request<{ data: Record<string, unknown> }>(
      `/api/accounts/vendor-invoice/${encodeURIComponent(token)}`
    ),
  submitVendorInvoiceByToken: (token: string, body: Record<string, unknown>) =>
    request<{ data: Record<string, unknown>; message: string }>(
      `/api/accounts/vendor-invoice/${encodeURIComponent(token)}`,
      { method: 'POST', body: JSON.stringify(body) }
    ),
};
