# 01 — Roles & Access Control

## 1. Role Definitions

| Role | Code | Primary Responsibility |
|------|------|------------------------|
| Requester | `requester` | Create and submit PRs; participate in RFQ scoring |
| HOD Approver | `hod_approver` | L1 approval on PR |
| PR Manager | `pr_manager` | Pre-RFQ and post-RFQ manager approval |
| CFO | `cfo` | Pre-RFQ financial approval |
| SCM Buyer | `scm_buyer` | RFQ management, PO creation, letterhead master |
| SCM Manager | `scm_manager` | PO sign/reject, vendor comparison review |
| Accounts Payable | `accounts_payable` | Invoice verification (planned) |
| Accounts Manager | `accounts_manager` | Payment approval (planned) |
| Functional Team | `functional_team` | Technical clearance (planned) |
| Tech Evaluator | `tech_evaluator` | Technical evaluation (planned) |
| Vendor | `vendor` | External vendor (portal planned) |
| Super Admin | `super_admin` | User sync, permissions, full access |

## 2. Navigation Access by Role

### Requester
- Dashboard
- Create PR
- My PRs
- Track PR
- RFQ Approval (view/score when assigned)

### HOD Approver
- Dashboard
- HOD Approval

### PR Manager
- Dashboard
- PR Approval
- RFQ Approval
- Post-RFQ Approval

### CFO
- Dashboard
- CFO Approval

### SCM Buyer
- Dashboard
- RFQ Management
- Create PO
- PO Letterhead Master
- Vendor Master

### SCM Manager
- Dashboard
- PO Approval (with vendor comparison & approval history)

### Super Admin
- All menus above
- User Management
- Permission Management
- RefexOne User Sync

## 3. Permission Keys

Permissions are stored in `role_permissions` and checked via `permissionService.js`.

| Permission Key | Description |
|----------------|-------------|
| `nav.dashboard` | Dashboard access |
| `nav.create_pr` | Create PR |
| `nav.my_prs` | My PR list |
| `nav.track_pr` | Track PR |
| `nav.hod_approval` | HOD approval queue |
| `nav.pr_approval` | PR Manager approval |
| `nav.cfo_approval` | CFO approval |
| `nav.rfq_management` | RFQ configuration |
| `nav.rfq_approval` | RFQ review/scoring |
| `nav.post_rfq_approval` | Post-RFQ approval |
| `nav.create_po` | Create PO |
| `nav.po_approval` | SCM Manager PO approval |
| `nav.po_letterhead_master` | PO letterhead templates |
| `nav.vendor_master` | Vendor CRUD |
| `nav.user_management` | User admin |
| `nav.permission_management` | Role permissions |
| `nav.refexone_sync` | RefexOne user sync |

## 4. Authentication

| Method | Details |
|--------|---------|
| Local login | Email + password (`users` table) |
| RefexOne login | External API; auto-provisions user |
| Session | JWT token stored client-side |
| Protected routes | `ProtectedRoute.tsx` redirects unauthenticated users |

## 5. Demo Credentials

| Email | Password | Role |
|-------|----------|------|
| admin@procure.com | demo1234 | Super Admin |

Additional users synced from RefexOne or created via User Management.

## 6. Task Assignment Rules

| Stage | Assigned To |
|-------|---------------|
| PR submitted | HOD (from RefexOne L1 manager of requester) |
| HOD approved | PR Manager |
| PR Manager approved | CFO |
| CFO approved | SCM Buyer (RFQ task) |
| RFQ finalized | Post-RFQ approver (L1 Manager) |
| Post-RFQ approved | SCM Buyer (Create PO task) |
| PO created | SCM Manager |
| PO signed | Vendor (email notification) |
