# 00 — Executive Summary

## 1. Business Objective

Build a digital Procure-to-Pay (P2P) platform for Refex that covers:

- Purchase Request (PR) creation and multi-level approval
- Request for Quotation (RFQ) and vendor comparison
- Purchase Order (PO) generation with Refex letterhead
- SCM Manager authorization and vendor notification
- Future: GRN, invoice verification, and payment

## 2. In Scope (Live)

| Module | Status |
|--------|--------|
| User login (local + RefexOne) | ✅ |
| Super Admin user sync & permissions | ✅ |
| PR create, submit, track, resubmit | ✅ |
| HOD / PR Manager / CFO approval chain | ✅ |
| RFQ invite, vendor quote portal, comparison | ✅ |
| Post-RFQ manager approval | ✅ |
| Vendor Master | ✅ |
| PO Letterhead Master (Short PO / Long PO) | ✅ |
| PO create, preview, PDF, SCM sign/reject | ✅ |
| Email notifications (PR, RFQ, PO) | ✅ |

## 3. Out of Scope / Planned

| Module | Status |
|--------|--------|
| GRN (Goods Receipt Note) | 🔴 Mock UI |
| Invoice verification (3-way match) | 🔴 Mock UI |
| Payment processing | 🔴 Mock UI |
| Vendor logged-in portal (PO accept, invoice) | 🔴 Mock UI |
| Technical clearance module | 🔴 Mock UI |
| Tech evaluator scoring module | 🔴 Mock UI |
| Budget enforcement during approval | 🔴 Not implemented |

## 4. Key Integrations

- **RefexOne** — User directory, login, L1/L2 manager hierarchy
- **SMTP** — Transactional emails
- **Chrome/Edge** — HTML-to-PDF for PO documents

## 5. User Roles (13)

Requester, HOD Approver, PR Manager, CFO, SCM Buyer, SCM Manager, Accounts Payable, Accounts Manager, Functional Team, Tech Evaluator, Vendor, Super Admin

## 6. Current Post-RFQ Flow (As Built)

```
Requester → HOD (L1) → RFQ → Post-RFQ Manager Approval (L1) → SCM Buyer (Create PO) → SCM Manager (Sign PO) → Vendor Email
```

Note: L2 Manager and CFO post-RFQ steps are defined in constants but **skipped** for new PRs in current configuration.

## 7. Success Criteria

- Requester can raise PR and track status end-to-end
- Approvers receive tasks and email notifications
- Vendors submit quotes via secure token link
- SCM Buyer creates PO using letterhead master templates
- SCM Manager signs PO; signed PDF emailed to vendor with CC to stakeholders
- Full approval history visible at PO approval stage
