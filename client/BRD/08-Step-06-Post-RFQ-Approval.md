# 08 — Step 6: Post-RFQ Approval

**Screen:** `/pr-manager/post-rfq-approval`  
**Role:** PR Manager (L1 Manager from RefexOne)  
**Status:** ✅ Live  
**API:** `GET /api/pr/pending/post-rfq`, `POST /api/pr/:id/post-rfq/approve`, `POST /api/pr/:id/post-rfq/reject`

---

## 1. Step Objective

After RFQ is finalized and vendor is selected, designated approver validates vendor selection and commercial terms before PO creation.

---

## 2. Current Configuration

| Setting | Value |
|---------|-------|
| Active approver | L1 Manager only |
| Skipped steps | L2 Manager, CFO (post-RFQ) |
| Config source | `POST_RFQ_ROLE_MAP` in constants |

---

## 3. Queue List Fields

| # | Column | Source |
|---|--------|--------|
| 1 | PR Number | `prNumber` |
| 2 | RFQ Number | `rfqNumber` |
| 3 | Selected Vendor | `selectedVendorName` |
| 4 | Final Price (₹) | `finalPrice` |
| 5 | Requester | `requesterName` |
| 6 | Department | `department` |
| 7 | RFQ Finalized Date | `finalizedAt` |

---

## 4. Expanded Row — Tabs

### Tab 1: PR & RFQ Summary

| Field | Key |
|-------|-----|
| PR Number | `prNumber` |
| PR Title | `title` |
| Total PR Amount | `totalAmount` |
| Selected Vendor | `selectedVendorName` |
| Final Quoted Price | `finalPrice` |
| Selection Justification | `selectionJustification` |
| RFQ Instructions | `instructions` |

### Tab 2: Vendor Comparison Matrix

Full comparison of all vendor quotes (same component as RFQ Approval).

| Column | Description |
|--------|-------------|
| Vendor Name | |
| Quoted Price | |
| Lead Time | |
| Payment Terms | |
| Warranty | |
| Delivery Terms | |
| Compliance | |
| Quotation File | Preview/download |
| Scores | Technical, Commercial, Overall |

### Tab 3: Approval History

All prior approvals from PR submission through RFQ.

---

## 5. Action Panel Fields

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Approval Comments | `comments` | Textarea | No |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (reject) |

---

## 6. Actions

| Button | Next Status | Next Assignee |
|--------|-------------|---------------|
| Approve | `PENDING_PO` | SCM Buyer |
| Reject | `REWORK` or `REJECTED` | Requester / SCM Buyer |

---

## 7. Status Transition

```
PENDING_POST_RFQ → (Approve) → PENDING_PO
PENDING_POST_RFQ → (Reject) → REWORK
```

---

## 8. Notifications

- Approve → SCM Buyer (Create PO task)
- Reject → Requester + SCM Buyer
