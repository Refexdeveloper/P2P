# 14 — Step 12: Invoice Verification (Planned)

**Screens:** `/accounts/invoice-verification`, `/vendor/invoice`  
**Roles:** Accounts Payable, Vendor  
**Status:** 🔴 UI Mock Only — No Backend

---

## 1. Step Objective (Planned)

Match vendor invoice against PO and GRN (3-way match) before payment approval.

---

## 2. Planned Queue List

| # | Column | Source |
|---|--------|--------|
| 1 | Invoice Number | `invoiceNumber` |
| 2 | Vendor | `vendorName` |
| 3 | PO Reference | `poNumber` |
| 4 | GRN Reference | `grnNumber` |
| 5 | Invoice Amount (₹) | `invoiceAmount` |
| 6 | PO Amount (₹) | `poAmount` |
| 7 | GRN Qty Match | `qtyMatch` |
| 8 | Status | `status` |
| 9 | Submitted Date | `submittedAt` |

---

## 3. Planned Invoice Form (Vendor Portal)

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Invoice Number | `invoiceNumber` | Text | Yes |
| 2 | Invoice Date | `invoiceDate` | Date | Yes |
| 3 | PO Reference | `poNumber` | Dropdown | Yes |
| 4 | Invoice Amount (₹) | `invoiceAmount` | Currency | Yes |
| 5 | Tax Amount (₹) | `taxAmount` | Currency | No |
| 6 | GST Number | `gstNumber` | Text | Yes |
| 7 | Invoice Document | `invoiceFile` | File (PDF) | Yes |
| 8 | Supporting Docs | `supportingDocs[]` | File | No |

---

## 4. Planned Verification Screen (Accounts Payable)

### 4.1 Match Summary

| Check | Field | Pass/Fail |
|-------|-------|-----------|
| PO exists | `poNumber` | Auto |
| GRN complete | `grnNumber` | Auto |
| Amount match | PO vs Invoice | Tolerance % |
| Quantity match | GRN vs Invoice | Auto |
| Vendor match | PO vendor = Invoice vendor | Auto |
| Tax match | GST calculation | Auto |

### 4.2 Action Panel

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Verification Comments | `comments` | Textarea | No |
| 2 | Rejection Reason | `rejectionReason` | Textarea | Yes (reject) |
| 3 | Hold Reason | `holdReason` | Textarea | Yes (hold) |

### 4.3 Actions

| Button | Result |
|--------|--------|
| Approve | Ready for payment |
| Reject | Back to vendor |
| Hold | Pending clarification |

---

## 5. Planned Status Flow

```
INVOICE_SUBMITTED → INVOICE_VERIFICATION → INVOICE_APPROVED / INVOICE_REJECTED / INVOICE_ON_HOLD
```

---

## 6. Gap Notes

- No backend tables or APIs
- Vendor invoice portal is mock UI
- 3-way match logic not implemented
