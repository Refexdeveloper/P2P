# 13 — Step 11: GRN (Planned)

**Screen:** `/grn`  
**Role:** Functional Team / Warehouse  
**Status:** 🔴 UI Mock Only — No Backend

---

## 1. Step Objective (Planned)

Record Goods Receipt Note when ordered items are physically received, linking to PO line items for 3-way match.

---

## 2. Planned Screen Fields

### 2.1 GRN Header

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | GRN Number | `grnNumber` | Text (auto) | — |
| 2 | PO Reference | `poNumber` | Dropdown/search | Yes |
| 3 | Vendor | `vendorName` | Text (read-only) | — |
| 4 | Receipt Date | `receiptDate` | Date | Yes |
| 5 | Received By | `receivedBy` | Text | Yes |
| 6 | Warehouse/Location | `location` | Dropdown | Yes |
| 7 | Delivery Challan No | `challanNumber` | Text | No |
| 8 | Remarks | `remarks` | Textarea | No |

### 2.2 GRN Line Items

| # | Column | Field ID | Type | Required |
|---|--------|----------|------|----------|
| 1 | PO Line # | `poLineNo` | Number | — |
| 2 | Description | `description` | Text (read-only) | — |
| 3 | Ordered Qty | `orderedQty` | Number (read-only) | — |
| 4 | Received Qty | `receivedQty` | Number | Yes |
| 5 | Accepted Qty | `acceptedQty` | Number | Yes |
| 6 | Rejected Qty | `rejectedQty` | Number | No |
| 7 | Rejection Reason | `rejectionReason` | Text | Conditional |
| 8 | Unit | `unit` | Text | — |

### 2.3 Attachments

| # | Field | Type |
|---|-------|------|
| 1 | Delivery Challan | File upload |
| 2 | Inspection Report | File upload |
| 3 | Photos | File upload (multiple) |

---

## 3. Planned Actions

| Button | Action |
|--------|--------|
| Save Draft | Save partial GRN |
| Submit GRN | Finalize receipt |
| Partial Receipt | Allow qty < ordered |

---

## 4. Planned Status Flow

```
PO_SIGNED → GRN_PENDING → GRN_PARTIAL → GRN_COMPLETE
```

---

## 5. Planned Database Tables (Not Created)

- `grn_headers`
- `grn_line_items`
- `grn_attachments`

---

## 6. Gap Notes

- Current `/grn` page uses static mock data
- No API routes exist
- No link from PO Signed status to GRN queue
- Required for invoice 3-way match
