# 09 — Step 7: PO Creation

**Screen:** `/scm/create-po`  
**Role:** SCM Buyer  
**Status:** ✅ Live  
**API:** `GET /api/po/pending`, `POST /api/po/pr/:prId`, `POST /api/po/pr/:prId/preview-document`

---

## 1. Step Objective

SCM Buyer creates a Purchase Order from an approved PR/RFQ, selects PO type (Short/Long), configures terms from letterhead master, previews Refex-branded document, and submits for SCM Manager signature.

---

## 2. Queue List (Pending PO PRs)

| # | Column | Source |
|---|--------|--------|
| 1 | PR Number | `prNumber` |
| 2 | Title | `title` |
| 3 | Vendor | `selectedVendorName` |
| 4 | Final Price (₹) | `finalPrice` |
| 5 | Department | `department` |
| 6 | Post-RFQ Approved Date | From approvals |

---

## 3. PO Form — Exact Fields

### 3.1 PO Header

| # | Field Label | Field ID | Type | Required | Notes |
|---|-------------|----------|------|----------|-------|
| 1 | PO Number | `poNumber` | Text (auto) | — | Generated on save |
| 2 | PO Type | `poType` | Radio/Dropdown | Yes | `SHORT_PO` / `LONG_PO` |
| 3 | PO Date | `poDate` | Date | Yes | Default today |
| 4 | PR Reference | `prNumber` | Text (read-only) | — | |
| 5 | Vendor Name | `vendorName` | Text (read-only) | — | From RFQ winner |
| 6 | Vendor Address | `vendorAddress` | Text (read-only) | — | From Vendor Master |
| 7 | Vendor GST | `vendorGst` | Text (read-only) | — | |
| 8 | Vendor PAN | `vendorPan` | Text (read-only) | — | |
| 9 | Vendor Phone | `vendorPhone` | Text (read-only) | — | |
| 10 | Delivery Address | `deliveryAddress` | Textarea | Yes | Ship-to location |
| 11 | Payment Terms | `paymentTerms` | Text | Yes | From quote or manual |
| 12 | Delivery Terms | `deliveryTerms` | Text | No | |
| 13 | Expected Delivery Date | `expectedDeliveryDate` | Date | Yes | |

### 3.2 PO Line Items

| # | Column | Field ID | Type | Required |
|---|--------|----------|------|----------|
| 1 | # | `lineNo` | Number | — |
| 2 | Description | `description` | Text | Yes |
| 3 | Quantity | `quantity` | Number | Yes |
| 4 | Unit | `unit` | Text | No |
| 5 | Unit Price (₹) | `unitPrice` | Currency | Yes |
| 6 | Amount (₹) | `amount` | Currency (calc) | — |
| 7 | HSN/SAC | `hsnSac` | Text | No |

**PO Subtotal / Tax / Grand Total:** Auto-calculated

### 3.3 Letterhead Content (Loaded from Master)

| # | Section | Field ID | Type | Editable |
|---|---------|----------|------|----------|
| 1 | Letterhead Header | `letterheadHeader` | Rich HTML | Yes (override) |
| 2 | Terms & Conditions | `termsClauses[]` | Array of {header, description} | Yes |
| 3 | Annexure | `annexureClauses[]` | Array of {header, description} | Yes |
| 4 | Special Notes | `specialNotes` | Textarea | Yes |

Each clause row:
| Field | Key | Type |
|-------|-----|------|
| Terms Header | `header` | Text |
| Terms Description | `description` | Rich text (HTML) |

### 3.4 Acknowledgment Block

| Field | Key | Notes |
|-------|-----|-------|
| Vendor Acknowledgment Text | `acknowledgmentText` | From letterhead template |

---

## 4. Screen Tabs

| Tab | Content |
|-----|---------|
| PO Details | Form fields above |
| Terms & Annexure | Editable clauses from letterhead |
| Preview | Live Refex HTML document (iframe) |
| Attachments | PR/RFQ attachments reference |

---

## 5. Actions

| Button | Action | Result |
|--------|--------|--------|
| Save Draft | Save PO | Status = `PO_CREATED` |
| Preview Document | Render HTML | Calls preview API |
| Submit for Approval | Send to SCM Manager | Status = `PO_PENDING_SIGN` |

---

## 6. PO Type Behavior

| PO Type | Use Case | Template Source |
|---------|----------|-----------------|
| Short PO | Standard purchases | `po_letterhead_masters` where `po_type = SHORT_PO` |
| Long PO | Complex/large contracts | `po_letterhead_masters` where `po_type = LONG_PO` |

On PO type change → terms/annexure reload from letterhead master.

---

## 7. Preview Document

- **API:** `POST /api/po/pr/:prId/preview-document`
- **Template:** `server/src/templates/poDocumentTemplate.js`
- **Branding:** Refex logo, company address, price schedule table, terms, annexure, acknowledgment
- **Output:** HTML rendered in iframe on Preview tab

---

## 8. Status Transition

```
PENDING_PO → (Create PO) → PO_CREATED
PO_CREATED → (Submit) → PO_PENDING_SIGN
```

---

## 9. Database Tables

| Table | Fields Stored |
|-------|---------------|
| `purchase_orders` | Header, vendor, amounts, `po_type`, `letterhead_header`, `terms_clauses`, `annexure_clauses`, `special_notes` |
| `po_line_items` | Line items |
| `pr_approvals` | `PO_CREATED` action |

---

## 10. Notifications

- Submit → Email to SCM Manager with PO details link
- SCM Manager edit → Logged in approval history (`PO_UPDATED`); no separate email
- Sign → Email to vendor with signed PDF

---

## 11. SCM Manager Edit Access

SCM Manager can open `/scm/create-po?poId={id}` from PO Approval to edit a pending PO before signing. See **Step 8 — SCM Manager PO Approval & Edit** for full field list.
