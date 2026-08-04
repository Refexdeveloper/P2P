# 17 — API Reference

Base URL: `http://localhost:3001/api`  
Auth: Bearer JWT token in `Authorization` header (except public RFQ quote endpoints)

---

## Authentication

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | Public | Login with email/password or RefexOne |
| GET | `/auth/me` | Authenticated | Current user profile + permissions |

---

## Purchase Requests

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| POST | `/pr` | Requester | Create PR |
| GET | `/pr` | All | List PRs (filtered by role) |
| GET | `/pr/:id` | All | Get PR detail |
| PUT | `/pr/:id` | Requester | Update draft/rework PR |
| POST | `/pr/:id/resubmit` | Requester | Resubmit after rework |
| POST | `/pr/:id/approve` | HOD/PR Manager/CFO | Approve/reject/rework |
| GET | `/pr/stats/requester` | Requester | Dashboard stats |
| GET | `/pr/stats/manager` | PR Manager | Dashboard stats |

---

## RFQ

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/rfq/quote/:token` | Public | Vendor quote form data |
| POST | `/rfq/quote/:token` | Public | Submit vendor quote |
| GET | `/rfq/scm-entry/pending` | SCM Buyer | PRs pending RFQ |
| GET | `/rfq/post-approval/pending` | PR Manager | Post-RFQ approval queue |
| GET | `/rfq/pr/:prId` | Requester/SCM Buyer | RFQ config + submissions |
| GET | `/rfq/pr/:prId/comparison` | Multiple | Vendor comparison matrix |
| PUT | `/rfq/pr/:prId/config` | Requester/SCM Buyer | Update RFQ field config |
| POST | `/rfq/pr/:prId/finalize` | Requester/SCM Buyer | Finalize RFQ + select vendor |
| POST | `/rfq/pr/:prId/post-approve` | PR Manager | Post-RFQ approve/reject |
| POST | `/rfq/invite` | Requester/SCM Buyer | Send RFQ invitations |
| POST | `/rfq/invitations/:id/manual-submit` | Requester/SCM Buyer | Manual quote entry |
| POST | `/rfq/invitations/:id/resend-email` | Requester/SCM Buyer | Resend vendor email |
| POST | `/rfq/invitations/:id/send-back` | Requester/SCM Buyer | Send back to vendor |
| PUT | `/rfq/submissions/:id/review-fields` | Requester/SCM Buyer | Update scoring fields |
| GET | `/rfq/submissions/:id/file` | Multiple | Download quotation file |

---

## Purchase Orders

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/po/letterhead` | SCM Buyer/Admin | List letterhead types |
| GET | `/po/letterhead/:poType` | SCM Buyer/Admin | Get letterhead template |
| PUT | `/po/letterhead/:poType` | SCM Buyer/Admin | Save letterhead template |
| GET | `/po/pr/:prId/context` | SCM Buyer | PR + RFQ context for PO |
| POST | `/po/pr/:prId/preview-document` | SCM Buyer | HTML preview |
| POST | `/po/pr/:prId` | SCM Buyer | Create/update PO |
| PUT | `/po/:id` | SCM Manager | Edit pending PO before sign |
| POST | `/po/:id/preview-document` | SCM Manager | HTML preview while editing |
| GET | `/po/pending` | SCM Manager | POs pending signature |
| GET | `/po` | SCM Buyer/Manager | List all POs |
| GET | `/po/:id` | SCM Buyer/Manager | PO detail |
| GET | `/po/:id/document` | Multiple | HTML document |
| GET | `/po/:id/pdf` | Multiple | PDF download |
| GET | `/po/by-number/:poNumber` | Multiple | Lookup by PO number |
| POST | `/po/:id/sign` | SCM Manager | Sign PO |
| POST | `/po/:id/reject` | SCM Manager | Reject PO |

---

## Vendors

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/vendors` | SCM Buyer/Manager/Requester | List vendors |
| GET | `/vendors/:id` | SCM Buyer/Manager/Requester | Vendor detail |
| POST | `/vendors` | SCM Buyer | Create vendor |
| PUT | `/vendors/:id` | SCM Buyer | Update vendor |
| GET | `/vendors/:id/documents/:docType/file` | SCM Buyer/Manager | Download document |

---

## Tasks

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | All | Pending tasks for user |
| GET | `/tasks/requester` | Requester | Requester-specific tasks |
| POST | `/tasks/:taskId/complete` | All | Complete task |
| POST | `/tasks/:taskId/complete-rfq` | Requester | Complete RFQ scoring task |

---

## Admin

| Method | Endpoint | Role | Description |
|--------|----------|------|-------------|
| GET | `/admin/users` | Super Admin | List users |
| POST | `/admin/users/sync` | Super Admin | Sync from RefexOne |
| GET | `/admin/permissions` | Super Admin | All permissions |
| GET | `/admin/roles` | Super Admin | Role list |
| PUT | `/admin/users/:id` | Super Admin | Update user |
| PUT | `/admin/users/:id/permissions` | Super Admin | Set user permissions |

---

## Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

Error:
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Key Request Bodies

### Create PR
```json
{
  "title": "string",
  "requestType": "Opex",
  "departmentId": 1,
  "priority": "Medium",
  "requiredDate": "2026-07-15",
  "justification": "string",
  "lineItems": [
    { "category": "IT Services", "description": "...", "quantity": 1, "unitCost": 50000 }
  ]
}
```

### Approve PR
```json
{
  "action": "approve|reject|rework",
  "comments": "string",
  "rejectionReason": "string",
  "reworkInstructions": "string"
}
```

### Save PO (SCM Manager Edit)
```json
{
  "poType": "short_po",
  "deliveryAddress": "string",
  "expectedDeliveryDate": "2026-08-01",
  "paymentTerms": "Net 30 Days",
  "incoterms": "DDP",
  "specialInstructions": "string",
  "gstPercentage": 18,
  "letterheadHeader": "<html>...",
  "terms": [{ "termsHeader": "Payment", "termsDescription": "<p>..." }],
  "annexure": [{ "termsHeader": "Scope", "termsDescription": "<p>..." }],
  "lineItems": [{ "description": "...", "quantity": 1, "unitPrice": 50000 }],
  "changeSummary": "Updated delivery date and payment terms"
}
```

### Create PO
```json
{
  "poType": "short_po",
  "deliveryAddress": "string",
  "expectedDeliveryDate": "2026-08-01",
  "paymentTerms": "Net 30 Days",
  "letterheadHeader": "<html>...",
  "termsClauses": [{ "header": "Payment", "description": "<p>..." }],
  "annexureClauses": [{ "header": "Scope", "description": "<p>..." }],
  "lineItems": [{ "description": "...", "quantity": 1, "unitPrice": 50000 }]
}
```

### Save Letterhead
```json
{
  "title": "Purchase Order",
  "letterheadHeader": "<html>...",
  "termsClauses": [{ "header": "...", "description": "..." }],
  "annexureClauses": [{ "header": "...", "description": "..." }]
}
```
