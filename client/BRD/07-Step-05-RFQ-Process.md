# 07 — Step 5: RFQ Process

**Screens:** `/scm/rfq-management`, `/rfq/vendor/:token` (public), `/requester/rfq-approval`  
**Roles:** SCM Buyer, Vendor (external), Requester  
**Status:** ✅ Live  
**API:** `/api/rfq/*`

---

## 1. Step Objective

SCM Buyer configures RFQ, invites vendors, collects quotations through vendor portal, manages negotiation rounds, and finalizes vendor selection.

---

## 2. SCM Buyer — RFQ Configuration

**Screen:** `/scm/rfq-management` (expand PR row)

### 2.1 RFQ Header Fields

| # | Field Label | Field ID | Type | Required | Notes |
|---|-------------|----------|------|----------|-------|
| 1 | RFQ Number | `rfqNumber` | Text (auto) | — | Auto-generated |
| 2 | PR Reference | `prNumber` | Text (read-only) | — | Linked PR |
| 3 | RFQ Title | `title` | Text | Yes | Defaults from PR title |
| 4 | Submission Deadline | `deadline` | DateTime | Yes | Vendor quote cutoff |
| 5 | RFQ Instructions | `instructions` | Textarea | No | Shown to vendors |
| 6 | Technical Requirements | `technicalRequirements` | Textarea | No | |
| 7 | Commercial Terms | `commercialTerms` | Textarea | No | |

### 2.2 Vendor Selection

| # | Field Label | Field ID | Type | Required | Notes |
|---|-------------|----------|------|----------|-------|
| 1 | Select Vendors | `vendorIds[]` | Multi-select | Yes (min 1) | From Vendor Master |
| 2 | Vendor Email | `email` | Text (read-only) | — | Per vendor |
| 3 | Vendor Category | `category` | Text (read-only) | — | |

### 2.3 Custom Quote Fields (Configurable)

Default vendor fields (`DEFAULT_FIELD_DEFINITIONS`):

| # | Field ID | Label | Type | Filled By | Required |
|---|----------|-------|------|-----------|----------|
| 1 | `quotedPrice` | Quoted Price (₹) | number | vendor | Yes |
| 2 | `leadTime` | Lead Time (days) | number | vendor | No |
| 3 | `paymentTerms` | Payment Terms | text | vendor | No |
| 4 | `warranty` | Warranty | text | vendor | No |
| 5 | `deliveryTerms` | Delivery Terms | text | vendor | No |
| 6 | `compliance` | Compliance | boolean | vendor | No |

Requester scoring fields:

| # | Field ID | Label | Type | Filled By |
|---|----------|-------|------|-----------|
| 1 | `technicalScore` | Technical Score | number | requester |
| 2 | `commercialScore` | Commercial Score | number | requester |
| 3 | `overallScore` | Overall Score | number | requester |

**Custom fields:** SCM Buyer can add fields with label, type (text/number/boolean), filledBy (vendor/requester), required flag.

### 2.4 RFQ Line Items (from PR)

| Column | Key |
|--------|-----|
| # | index |
| Category | `category` |
| Description | `description` |
| Quantity | `quantity` |
| Unit | `unit` |

---

## 3. RFQ Actions (SCM Buyer)

| Button | Action | Result |
|--------|--------|--------|
| Save Draft | Save RFQ config | Status unchanged |
| Send RFQ | Email vendors with token link | Status = `RFQ_IN_PROGRESS` |
| Send Back | Return to requester | PR → REWORK |
| Add Round | New negotiation round | New deadline, vendors re-invited |
| Finalize RFQ | Close quotes, select winner | Status = `PENDING_POST_RFQ` |

### Finalize RFQ Fields

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Selected Vendor | `selectedVendorId` | Dropdown | Yes |
| 2 | Selection Justification | `selectionJustification` | Textarea | Yes |
| 3 | Final Quoted Price | `finalPrice` | Currency | Yes |

---

## 4. Vendor Quote Portal (Public)

**URL:** `/rfq/vendor/:token`  
**Auth:** Secure token (no login)

### 4.1 Vendor Form Fields

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Company Name | `vendorName` | Text (read-only) | — |
| 2 | Quoted Price (₹) | `quotedPrice` | Number | Yes |
| 3 | Lead Time (days) | `leadTime` | Number | No |
| 4 | Payment Terms | `paymentTerms` | Text | No |
| 5 | Warranty | `warranty` | Text | No |
| 6 | Delivery Terms | `deliveryTerms` | Text | No |
| 7 | Compliance | `compliance` | Checkbox | No |
| 8 | Quotation Document | `quotationFile` | File upload | Yes |
| 9 | Additional Notes | `notes` | Textarea | No |
| 10 | Custom fields | Dynamic | Per config | Per field |

**Actions:** Submit Quote, Save Draft (if enabled)

---

## 5. Requester — RFQ Approval / Scoring

**Screen:** `/requester/rfq-approval`

| # | Field | Type | Notes |
|---|-------|------|-------|
| 1 | Technical Score | Number (0-100) | Per vendor |
| 2 | Commercial Score | Number (0-100) | Per vendor |
| 3 | Overall Score | Number (0-100) | Per vendor |
| 4 | Scoring Comments | Textarea | Optional |

### Vendor Comparison Matrix (Read-only + scores)

| Column | Source |
|--------|--------|
| Vendor Name | `vendorName` |
| Quoted Price | `quotedPrice` |
| Lead Time | `leadTime` |
| Payment Terms | `paymentTerms` |
| Warranty | `warranty` |
| Delivery Terms | `deliveryTerms` |
| Compliance | `compliance` |
| Quotation File | Download link |
| Technical Score | Editable |
| Commercial Score | Editable |
| Overall Score | Editable |

---

## 6. RFQ Status Lifecycle

| Status | Description |
|--------|-------------|
| `DRAFT` | RFQ configured, not sent |
| `SENT` | Invitations emailed |
| `IN_PROGRESS` | Vendors submitting |
| `FINALIZED` | Winner selected |
| `CLOSED` | Archived |

---

## 7. Database Tables

| Table | Purpose |
|-------|---------|
| `rfqs` | RFQ header |
| `rfq_vendors` | Invited vendors + tokens |
| `rfq_quotes` | Vendor submissions |
| `rfq_rounds` | Negotiation rounds |
| `rfq_field_definitions` | Custom fields |

---

## 8. Notifications

| Event | Recipients |
|-------|------------|
| RFQ sent | Each invited vendor |
| Quote submitted | Requester, SCM Buyer |
| RFQ finalized | Post-RFQ approver |
| Send back | Requester |
