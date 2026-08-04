# 03 — Step 1: PR Creation & Submit

**Screen:** `/requester/create-pr`  
**Role:** Requester  
**Status:** ✅ Live  
**API:** `POST /api/pr`, `PUT /api/pr/:id`, `POST /api/pr/:id/submit`

---

## 1. Step Objective

Requester creates a Purchase Request with line items, justification, and FSD Document (Functional Specification Document), then submits for HOD approval.

---

## 2. Screen Sections & Exact Fields

### 2.1 Header / PR Information

| # | Field Label | Field ID / Key | Type | Required | Validation | Notes |
|---|-------------|----------------|------|----------|------------|-------|
| 1 | PR Number | `prNumber` | Text (read-only) | — | Auto-generated | Format: `PR-YYYY-NNNN` |
| 2 | PR Title | `title` | Text | Yes | Min 3 chars | Short summary |
| 3 | Request Type | `requestType` | Dropdown | Yes | One of: Capex, Opex, Service | |
| 4 | Department | `department` | Dropdown | Yes | From master list | User's department default |
| 5 | Required Date | `requiredDate` | Date | Yes | Future date | When items needed |
| 6 | Priority | `priority` | Dropdown | Yes | Low / Medium / High / Critical | |

### 2.2 Line Items (Repeatable)

Each line item row:

| # | Field Label | Field ID / Key | Type | Required | Validation | Notes |
|---|-------------|----------------|------|----------|------------|-------|
| 1 | Category | `category` | Dropdown | Yes | From category master | e.g. IT Services, Raw Materials |
| 2 | Quantity | `quantity` | Number | Yes | > 0 | |
| 3 | Unit Cost (₹) | `unitCost` | Currency | Yes | >= 0 | Decimal allowed |
| 4 | Line Total | `lineTotal` | Currency (calc) | — | qty × unitCost | Auto-calculated |
| 5 | Item Description | `description` | Textarea | Yes | Min 10 chars | Detailed spec |

**Actions per line:** Add Row, Remove Row

**PR Total:** Sum of all line totals (auto-calculated)

### 2.3 Justification

| # | Field Label | Field ID / Key | Type | Required | Validation | Notes |
|---|-------------|----------------|------|----------|------------|-------|
| 1 | Business Justification | `justification` | Textarea | Yes | Min 20 chars | Why purchase is needed |

### 2.4 FSD Document (Functional Specification Document)

| # | Field Label | Field ID / Key | Type | Required | Validation | Notes |
|---|-------------|----------------|------|----------|------------|-------|
| 1 | FSD Document (Functional Specification Document) | `attachments[]` | File upload | No | PDF, DOC, XLS, images | Multiple files |

### 2.5 Resubmit (Rework mode only)

| # | Field Label | Field ID / Key | Type | Required | Validation | Notes |
|---|-------------|----------------|------|----------|------------|-------|
| 1 | Resubmit Remarks | `resubmitRemarks` | Textarea | No | — | Shown when PR status = REWORK |

---

## 3. Actions

| Button | Action | Result |
|--------|--------|--------|
| Save Draft | Save without submit | Status = `DRAFT` |
| Submit | Validate & submit | Status = `PENDING_HOD`, task to HOD |
| Cancel | Navigate away | Prompt if unsaved changes |

---

## 4. Validations (Submit)

1. At least one line item required
2. All required fields on each line item filled
3. Required date must be today or future
4. Justification minimum length enforced
5. PR total > 0

---

## 5. Status Transition

```
DRAFT → (Submit) → PENDING_HOD
REWORK → (Resubmit) → PENDING_HOD
```

---

## 6. Database Tables

| Table | Purpose |
|-------|---------|
| `purchase_requests` | PR header |
| `pr_line_items` | Line items |
| `pr_attachments` | Uploaded files |
| `pr_approvals` | SUBMITTED action logged |
| `tasks` | HOD approval task created |

---

## 7. Related Screens

| Screen | Path | Purpose |
|--------|------|---------|
| My PRs | `/requester/my-prs` | List own PRs |
| Track PR | `/requester/track-pr/:id` | Status timeline |
| Create PR (edit) | `/requester/create-pr/:id` | Edit draft/rework |

---

## 8. Notifications

- Email to HOD: "New PR pending your approval"
- In-app task created for HOD approver
