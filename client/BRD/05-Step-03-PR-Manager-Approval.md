# 05 — Step 3: PR Manager Approval

**Screen:** `/pr-manager/approval`  
**Role:** PR Manager  
**Status:** ✅ Live  
**API:** `GET /api/pr/pending/pr-manager`, `POST /api/pr/:id/approve`, `POST /api/pr/:id/reject`, `POST /api/pr/:id/rework`

---

## 1. Step Objective

PR Manager reviews PR after HOD approval and forwards to CFO or sends back.

---

## 2. Queue List Fields

| # | Column | Source |
|---|--------|--------|
| 1 | PR Number | `prNumber` |
| 2 | Title | `title` |
| 3 | Requester | `requesterName` |
| 4 | Department | `department` |
| 5 | Total Amount (₹) | `totalAmount` |
| 6 | Priority | `priority` |
| 7 | HOD Approved Date | From `pr_approvals` |
| 8 | Required Date | `requiredDate` |

---

## 3. Expanded Row — Tabs

### Tab 1: PR Details
Same fields as HOD approval (header, line items, justification, attachments).

### Tab 2: Approval History

| Column | Key |
|--------|-----|
| Date/Time | `createdAt` |
| Action | `action` |
| Actor | `actorName` / `actorRole` |
| Comments | `comments` |

---

## 4. Action Panel Fields

| # | Field Label | Field ID | Type | Required | Notes |
|---|-------------|----------|------|----------|-------|
| 1 | Approval Comments | `comments` | Textarea | No | |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (reject) | |
| 3 | Rework Instructions | `reworkInstructions` | Textarea | Yes (rework) | |

---

## 5. Actions

| Button | Next Status | Next Assignee |
|--------|-------------|---------------|
| Approve | `PENDING_CFO` | CFO |
| Reject | `REJECTED` | Requester |
| Send for Rework | `REWORK` | Requester |

---

## 6. Status Transition

```
PENDING_PR_MANAGER → (Approve) → PENDING_CFO
PENDING_PR_MANAGER → (Reject) → REJECTED
PENDING_PR_MANAGER → (Rework) → REWORK
```
