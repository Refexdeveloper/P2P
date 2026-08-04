# 15 — Step 13: Payment (Planned)

**Screens:** `/accounts/payment`, `/scm/payment-approval`  
**Roles:** Accounts Payable, Accounts Manager, SCM Manager  
**Status:** 🔴 UI Mock Only — No Backend

---

## 1. Step Objective (Planned)

Process approved invoices for payment, with SCM/Accounts Manager approval for high-value payments.

---

## 2. Planned Payment Queue

| # | Column | Source |
|---|--------|--------|
| 1 | Payment Request # | `paymentNumber` |
| 2 | Invoice # | `invoiceNumber` |
| 3 | Vendor | `vendorName` |
| 4 | PO Reference | `poNumber` |
| 5 | Amount (₹) | `amount` |
| 6 | Due Date | `dueDate` |
| 7 | Status | `status` |
| 8 | Priority | `priority` |

---

## 3. Planned Payment Form

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Payment Reference | `paymentNumber` | Text (auto) | — |
| 2 | Invoice Reference | `invoiceNumber` | Dropdown | Yes |
| 3 | Vendor | `vendorName` | Text (read-only) | — |
| 4 | Payment Amount (₹) | `amount` | Currency | Yes |
| 5 | Payment Mode | `paymentMode` | Dropdown | Yes |
| 6 | Bank Account | `bankAccount` | Dropdown | Yes |
| 7 | Payment Date | `paymentDate` | Date | Yes |
| 8 | UTR/Transaction Ref | `transactionRef` | Text | Yes (on complete) |
| 9 | Remarks | `remarks` | Textarea | No |

**Payment Mode Options:** NEFT, RTGS, Cheque, UPI

---

## 4. Planned Approval Thresholds

| Amount Range | Approver |
|--------------|----------|
| ≤ ₹1,00,000 | Accounts Payable |
| ₹1,00,001 – ₹10,00,000 | Accounts Manager |
| > ₹10,00,000 | SCM Manager + Accounts Manager |

---

## 5. Planned SCM Payment Approval

| # | Field | Type | Required |
|---|-------|------|----------|
| 1 | Approval Comments | Textarea | No |
| 2 | Rejection Reason | Textarea | Yes (reject) |

---

## 6. Planned Status Flow

```
INVOICE_APPROVED → PAYMENT_PENDING → PAYMENT_APPROVED → PAYMENT_PROCESSED
```

---

## 7. Gap Notes

- All payment screens are mock UI
- No integration with banking/ERP
- No payment audit trail in DB
