# 10 — Step 8: SCM Manager PO Approval & Edit

**Screen:** `/scm/po-approval` (review), `/scm/create-po?poId={id}` (edit)  
**Role:** SCM Manager  
**Status:** ✅ Live  
**API:** `GET /api/po/pending-sign`, `PUT /api/po/:id`, `POST /api/po/:id/preview-document`, `POST /api/po/:id/sign`, `POST /api/po/:id/reject`, `GET /api/po/:id/document`

---

## 1. Step Objective

SCM Manager reviews PO document, vendor comparison, and full approval history. Before signing, SCM Manager can **edit PO fields** (delivery, line items, terms, annexure, etc.), then signs (approves) or rejects the PO.

---

## 2. Queue List Fields

| # | Column | Source |
|---|--------|--------|
| 1 | PO Number | `poNumber` |
| 2 | PR Number | `prNumber` |
| 3 | Vendor | `vendorName` |
| 4 | PO Type | `poType` (Short/Long) |
| 5 | Grand Total (₹) | `grandTotal` |
| 6 | Created By | `createdByName` |
| 7 | Created Date | `createdAt` |
| 8 | Status | `status` |

**Row actions (pending POs):** View PDF, **Edit PO**, Approve, Reject

---

## 3. Expanded Row — Tabs

### Tab 1: PO Document Preview

| Content | Source |
|---------|--------|
| Full Refex PO HTML | `GET /api/po/:id/document` |
| Download PDF | `GET /api/po/:id/pdf` |

### Tab 2: PO Details

Read-only summary of header fields and line items.

### Tab 3: Vendor Comparison

Full RFQ vendor comparison matrix with quotation file preview.

**API:** `GET /api/rfq/:prId/comparison`

### Tab 4: Approval History

Full timeline including `PO Created`, **`PO Updated`**, `PO Signed`, `PO Rejected`.

---

## 4. SCM Manager — Edit PO (Before Sign)

**Screen:** `/scm/create-po?poId={id}`  
**When:** Only for POs with status `pending_approval`

### 4.1 Editable Fields

Same fields as PO Creation (Step 7):

| # | Field Label | Field ID | Editable |
|---|-------------|----------|----------|
| 1 | PO Type | `poType` | Yes |
| 2 | Delivery Address | `deliveryAddress` | Yes |
| 3 | Expected Delivery Date | `expectedDeliveryDate` | Yes |
| 4 | Payment Terms | `paymentTerms` | Yes |
| 5 | Incoterms | `incoterms` | Yes |
| 6 | Special Instructions | `specialInstructions` | Yes |
| 7 | GST % | `gstPercentage` | Yes |
| 8 | Line Items | `lineItems[]` | Yes (add/edit/remove) |
| 9 | Letterhead Header | `letterheadHeader` | Yes |
| 10 | Terms & Conditions | `termsClauses[]` | Yes |
| 11 | Annexure | `annexureClauses[]` | Yes |
| 12 | Change Summary | `changeSummary` | No (optional note) |

**Read-only in edit mode:** PO Number, Vendor Name, PR Reference

### 4.2 Edit Screen Tabs

| Tab | Content |
|-----|---------|
| PO Details | Editable form fields |
| Terms & Conditions | Editable clauses |
| Preview | Live Refex HTML via `POST /api/po/:id/preview-document` |

### 4.3 Edit Actions

| Button | Action | Result |
|--------|--------|--------|
| Save Changes | `PUT /api/po/:id` | PO updated, draft PDF regenerated, `PO_UPDATED` logged in approval history |
| Back | Navigate | Returns to `/scm/po-approval` |

---

## 5. Action Panel Fields (Sign / Reject)

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Sign Comments | `comments` | Textarea | Yes (min 3 chars) |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (reject, min 10 chars) |

---

## 6. Actions

| Button | Action | Result |
|--------|--------|--------|
| Edit PO | Open edit screen | `/scm/create-po?poId={id}` |
| Sign PO | Approve & sign | Status = `sent_to_vendor`, PDF emailed to vendor |
| Reject PO | Reject | Status = `rejected`, returned to SCM Buyer |

---

## 7. PO Update Process (SCM Manager Edit)

1. Validate PO status is `pending_approval`
2. Validate required fields (delivery address, expected date, line items)
3. Update `purchase_orders` header fields
4. Replace `po_line_items` rows
5. Insert `PO_UPDATED` record in `pr_approvals` with change summary
6. Regenerate draft PDF
7. PO remains `pending_approval` — SCM Manager can sign after review

---

## 8. Sign PO Process

1. Validate PO is `pending_approval`
2. Record `PO_SIGNED` in `pr_approvals`
3. Generate signed PDF via puppeteer-core + system Chrome
4. Email signed PO PDF to vendor
5. CC: Requester, SCM Buyer, stakeholders
6. Update PO status to `sent_to_vendor`

---

## 9. Reject PO Process

1. Record `PO_REJECTED` in `pr_approvals`
2. Status → `rejected`
3. Task back to SCM Buyer for revision
4. Email notification to SCM Buyer

---

## 10. Status Transition

```
PO_PENDING_SIGN → (Edit) → PO_PENDING_SIGN  (updated in place)
PO_PENDING_SIGN → (Sign) → PO_SIGNED (sent_to_vendor)
PO_PENDING_SIGN → (Reject) → PO_REJECTED → (SCM Buyer revises) → PO_PENDING_SIGN
```

---

## 11. Approval History Events

| Action | Stage | Actor |
|--------|-------|-------|
| PO Created | PO Created | SCM Buyer |
| PO Updated | PO Updated | SCM Manager |
| PO Signed | SCM Manager Sign | SCM Manager |
| PO Rejected | SCM Manager Approval | SCM Manager |

---

## 12. PDF Generation

| Component | Path |
|-----------|------|
| HTML Template | `server/src/templates/poDocumentTemplate.js` |
| PDF Service | `server/src/services/poPdfService.js` |
| Engine | puppeteer-core + system Chrome/Edge |
| Fallback | HTML download if PDF fails |
