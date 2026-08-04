# 06 — Step 4: CFO Approval

**Screen:** `/cfo/approval`  
**Role:** CFO  
**Status:** ✅ Live  
**API:** `GET /api/pr/pending/cfo`, `POST /api/pr/:id/approve`, `POST /api/pr/:id/reject`, `POST /api/pr/:id/rework`

---

## 1. Step Objective

CFO provides financial sign-off before PR proceeds to RFQ stage.

---

## 2. Queue List Fields

| # | Column | Source |
|---|--------|--------|
| 1 | PR Number | `prNumber` |
| 2 | Title | `title` |
| 3 | Requester | `requesterName` |
| 4 | Department | `department` |
| 5 | Total Amount (₹) | `totalAmount` |
| 6 | Request Type | `requestType` |
| 7 | Priority | `priority` |
| 8 | Required Date | `requiredDate` |

---

## 3. Expanded Row

- PR Details (read-only)
- Approval History (HOD + PR Manager entries)
- Attachments download

---

## 4. Action Panel Fields

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Approval Comments | `comments` | Textarea | No |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (reject) |
| 3 | Rework Instructions | `reworkInstructions` | Textarea | Yes (rework) |

---

## 5. Actions

| Button | Next Status | Next Assignee |
|--------|-------------|---------------|
| Approve | `PENDING_RFQ` | SCM Buyer |
| Reject | `REJECTED` | Requester |
| Send for Rework | `REWORK` | Requester |

---

## 6. Status Transition

```
PENDING_CFO → (Approve) → PENDING_RFQ
PENDING_CFO → (Reject) → REJECTED
PENDING_CFO → (Rework) → REWORK
```

---

## 7. Post-Approval

- SCM Buyer receives RFQ task
- Email notification to SCM Buyer
- PR appears in RFQ Management queue
