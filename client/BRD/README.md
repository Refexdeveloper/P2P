# P2P Procurement System — Business Requirements Document (BRD)

**Project:** Refex P2P Procurement Platform  
**Version:** 1.0  
**Date:** June 2026  
**Document Owner:** Product / Business Analysis  
**Tech Stack:** React + Node.js + MySQL

---

## Purpose

This folder contains the complete Business Requirements Document for the Procure-to-Pay (P2P) application. Each file describes one workflow step with **exact fields**, **roles**, **validations**, **status transitions**, and **API/UI references**.

---

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Executive Summary](./00-Executive-Summary.md) | Vision, scope, maturity matrix |
| 01 | [Roles & Access Control](./01-Roles-and-Access-Control.md) | All roles, menus, permissions |
| 02 | [Workflow Overview](./02-Workflow-Overview.md) | End-to-end process map |
| 03 | [Step 1 — PR Creation](./03-Step-01-PR-Creation.md) | Create & submit Purchase Request |
| 04 | [Step 2 — HOD Approval](./04-Step-02-HOD-Approval.md) | L1 / HOD review |
| 05 | [Step 3 — PR Manager Approval](./05-Step-03-PR-Manager-Approval.md) | Pre-RFQ manager approval |
| 06 | [Step 4 — CFO Approval](./06-Step-04-CFO-Approval.md) | Pre-RFQ CFO approval |
| 07 | [Step 5 — RFQ Process](./07-Step-05-RFQ-Process.md) | Invite vendors, quotes, rounds |
| 08 | [Step 6 — Post-RFQ Approval](./08-Step-06-Post-RFQ-Approval.md) | Manager approval after RFQ |
| 09 | [Step 7 — PO Creation](./09-Step-07-PO-Creation.md) | SCM Buyer creates PO |
| 10 | [Step 8 — SCM Manager PO Approval & Edit](./10-Step-08-SCM-Manager-PO-Approval.md) | Sign, edit, reject PO |
| 11 | [Step 9 — PO Letterhead Master](./11-Step-09-PO-Letterhead-Master.md) | Short/Long PO templates |
| 12 | [Step 10 — Vendor Master](./12-Step-10-Vendor-Master.md) | Vendor registration |
| 13 | [Step 11 — GRN (Planned)](./13-Step-11-GRN-Planned.md) | Goods receipt — UI mock |
| 14 | [Step 12 — Invoice Verification (Planned)](./14-Step-12-Invoice-Verification-Planned.md) | 3-way match — UI mock |
| 15 | [Step 13 — Payment (Planned)](./15-Step-13-Payment-Planned.md) | Payment processing — UI mock |
| 16 | [Data Dictionary](./16-Data-Dictionary.md) | All database tables & fields |
| 17 | [API Reference](./17-API-Reference.md) | All REST endpoints |
| 18 | [Integrations & Notifications](./18-Integrations-and-Notifications.md) | RefexOne, email, PDF |
| 19 | [UAT — Create PR All Phases](./19-UAT-Create-PR-All-Phases.md) | Strong UAT cases: draft, submit, approvals, RFQ, PO |

---

## End-to-End Process (Summary)

```
Requester → HOD → PR Manager → CFO → RFQ → Post-RFQ Manager → SCM Buyer (PO) → SCM Manager (Sign) → Vendor
                                                                                      ↓
                                                                              GRN → Invoice → Payment
                                                                              (Planned modules)
```

---

## Implementation Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Live | Backend + frontend implemented |
| 🟡 Partial | Some features live, some mock |
| 🔴 Planned | UI mock only, no backend |

---

## Related Code Paths

| Area | Path |
|------|------|
| Frontend routes | `src/router/config.tsx` |
| API client | `src/services/api.ts` |
| DB schema | `server/db/schema.sql` |
| Workflow logic | `server/src/services/prService.js`, `rfqService.js`, `poService.js` |
| Permissions | `server/src/services/permissionService.js` |
