# 04 — Step 2: HOD Approval

**Screen:** `/hod/approval`  
**Role:** HOD Approver  
**Status:** ✅ Live  
**API:** `GET /api/pr/pending/hod`, `POST /api/pr/:id/approve`, `POST /api/pr/:id/reject`, `POST /api/pr/:id/rework`

---

## 1. Step Objective

Head of Department (L1 manager from RefexOne hierarchy) reviews the PR and approves, rejects, or sends back for rework.

---

## 2. Queue List Fields

| # | Column | Source | Notes |
|---|--------|--------|-------|
| 1 | PR Number | `prNumber` | Click to expand |
| 2 | Title | `title` | |
| 3 | Requester | `requesterName` | |
| 4 | Department | `department` | |
| 5 | Total Amount (₹) | `totalAmount` | |
| 6 | Priority | `priority` | Badge color |
| 7 | Required Date | `requiredDate` | |
| 8 | Submitted Date | `submittedAt` | |

---

## 3. Expanded Row — PR Details (Read-only)

### 3.1 PR Header

| Field | Key |
|-------|-----|
| PR Number | `prNumber` |
| Title | `title` |
| Request Type | `requestType` |
| Department | `department` |
| Required Date | `requiredDate` |
| Priority | `priority` |
| Total Amount | `totalAmount` |

### 3.2 Line Items Table

| Column | Key |
|--------|-----|
| # | index |
| Category | `category` |
| Description | `description` |
| Quantity | `quantity` |
| Unit Cost | `unitCost` |
| Line Total | `lineTotal` |

### 3.3 Justification & Attachments

| Field | Key |
|-------|-----|
| Business Justification | `justification` |
| Attachments | `attachments[]` — download links |

---

## 4. Action Panel Fields

| # | Field Label | Field ID | Type | Required | Notes |
|---|-------------|----------|------|----------|-------|
| 1 | Approval Comments | `comments` | Textarea | No | Logged in approval history |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (on reject) | Required for reject |
| 3 | Rework Instructions | `reworkInstructions` | Textarea | Yes (on rework) | Required for rework |

---

## 5. Actions

| Button | Action | Next Status | Next Assignee |
|--------|--------|-------------|---------------|
| Approve | Approve PR | `PENDING_PR_MANAGER` | PR Manager |
| Reject | Reject PR | `REJECTED` | Requester (notify) |
| Send for Rework | Return to requester | `REWORK` | Requester |

---

## 6. Validations

- Reject: `rejectionReason` mandatory
- Rework: `reworkInstructions` mandatory
- Only assigned HOD can action (task-based)

---

## 7. Status Transition

```
PENDING_HOD → (Approve) → PENDING_PR_MANAGER
PENDING_HOD → (Reject) → REJECTED
PENDING_HOD → (Rework) → REWORK
```

---

## 8. Database

| Table | Action |
|-------|--------|
| `purchase_requests` | Update status |
| `pr_approvals` | Insert APPROVED / REJECTED / REWORK |
| `tasks` | Complete HOD task; create PR Manager task |

---

## 9. Notifications

- Approve → Email to PR Manager + Requester
- Reject → Email to Requester
- Rework → Email to Requester with instructions
