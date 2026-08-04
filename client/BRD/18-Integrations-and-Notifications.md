# 18 — Integrations & Notifications

---

## 1. RefexOne Integration

**Service:** `server/src/services/refexOneService.js`  
**Portal:** [https://refexone.com/](https://refexone.com/)

### Purpose
- User authentication via RefexOne credentials
- **SSO auto-login** when user already has a RefexOne session/token
- Sync user directory (name, email, department)
- Resolve L1/L2 manager hierarchy for approval routing

### SSO Auto-Login Flow

**Primary (email + password SSO)**  
1. User clicks **Continue with RefexOne** on P2P login → `/auth/refexone`  
2. Enters the **same email & password** as [refexone.com](https://refexone.com/)  
3. P2P calls `POST /api/auth/refexone/login` → RefexOne `/auth/login`  
4. User is mapped/created in P2P and redirected to their portal dashboard  

**Token handoff (when RefexOne opens P2P with a session token)**  
1. RefexOne opens `https://p2p-app/auth/refexone/callback?access_token=<JWT>`  
2. P2P calls `POST /api/auth/refexone` and completes SSO without password  

**APIs**
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/refexone/login` | RefexOne email/password → P2P session |
| POST | `/api/auth/refexone` | Exchange RefexOne access token → P2P session |
| GET | `/api/auth/refexone/config` | SSO enabled flag + RefexOne web URL |

**UI routes:** `/auth/refexone`, `/auth/refexone/callback`

### Key Functions

| Function | Purpose |
|----------|---------|
| `authenticateRefexOneUser()` | Validate RefexOne login |
| `syncUsersFromRefexOne()` | Bulk user sync (Super Admin) |
| `getL1ManagerForEmail()` | Get HOD / L1 approver |
| `getL2ManagerForEmail()` | Get L2 manager |
| `ensureApproverUser()` | Auto-create approver in local DB |

### User Fields from RefexOne

| Field | Mapped To |
|-------|-----------|
| User ID | `users.refexone_user_id` |
| Email | `users.email` |
| Name | `users.name` |
| Supervisor Email | `users.supervisor_email` |
| Supervisor Name | `users.supervisor_name` |
| L2 Manager Email | `users.l2_manager_email` |

### Approval Routing

| Stage | RefexOne Lookup |
|-------|-----------------|
| HOD Approval | L1 Manager of requester |
| Post-RFQ Approval | L1 Manager of requester |
| (Planned L2) | L2 Manager of requester |

---

## 2. Email Notifications

**Service:** `server/src/services/emailService.js`  
**Transport:** SMTP (configured via environment variables)

### Email Events

| Event | Function | Recipients | Content |
|-------|----------|------------|---------|
| PR Submitted | `queuePrApprovalPendingNotification` | HOD | PR details + approval link |
| PR Approved | `queuePrApprovalPendingNotification` | Next approver | PR summary |
| PR Rejected | Email service | Requester | Rejection reason |
| PR Rework | Email service | Requester | Rework instructions |
| RFQ Sent | `queueRfqVendorEmail` / `sendRfqVendorEmail` | Vendor | Quote portal link with token |
| RFQ Quote Submitted | `queueRfqSubmittedNotifyRequester` | Requester, SCM Buyer | Vendor name + price |
| RFQ Send Back | `queueRfqSendBackEmail` | Vendor | Fields to revise |
| Post-RFQ Pending | `queuePostRfqActionNotification` | PR Manager | Approval link |
| Post-RFQ Action | `queuePostRfqActionNotification` | Requester, SCM Buyer | Result |
| PO Pending Sign | Email on PO submit | SCM Manager | PO summary link |
| PO Signed | Email with PDF attachment | Vendor | Signed PO PDF |
| PO Signed CC | Same email | Requester, SCM Buyer, stakeholders | |
| PO Rejected | Email | SCM Buyer | Rejection reason |

### RFQ Vendor Email Content

- PR title and description
- Submission deadline
- Secure link: `{FRONTEND_URL}/rfq/vendor/{access_token}`
- RFQ instructions and technical requirements

### PO Signed Email Content

- PO number, vendor name, grand total
- Signed PDF attachment
- Delivery and payment terms summary

---

## 3. PDF Generation

**Service:** `server/src/services/poPdfService.js`  
**Template:** `server/src/templates/poDocumentTemplate.js`

### Process

1. Build HTML from PO data + letterhead + terms + annexure
2. Launch puppeteer-core with system Chrome/Edge
3. Render HTML to PDF
4. Save to `uploads/po-pdfs/`
5. Return PDF path or fallback to HTML

### Document Sections

| Section | Source |
|---------|--------|
| Letterhead | `purchase_orders.letterhead_header` |
| PO Header | PO number, date, vendor, delivery |
| Price Schedule | `po_line_items` |
| Terms & Conditions | `purchase_orders.terms_clauses` |
| Annexure | `purchase_orders.annexure_clauses` |
| Special Notes | `purchase_orders.special_instructions` |
| Acknowledgment | Template block |

### Environment

| Variable | Purpose |
|----------|---------|
| `CHROME_PATH` | Path to Chrome/Edge executable |
| Falls back | Auto-detect common Windows paths |

---

## 4. File Storage

| Type | Location |
|------|----------|
| Quotation files | `server/uploads/quotations/` |
| PO PDFs | `server/uploads/po-pdfs/` |
| Vendor documents | `server/uploads/vendor-docs/` |
| PR attachments | `server/uploads/pr-attachments/` |

---

## 5. Environment Variables

| Variable | Purpose |
|----------|---------|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Token signing |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email |
| `FRONTEND_URL` | Links in emails |
| `REFEXONE_API_URL` | RefexOne integration |
| `CHROME_PATH` | PDF generation |

---

## 6. Startup Migrations

**Service:** `server/src/services/dbMigrate.js`  
Runs on server startup to ensure tables like `po_letterhead_masters` exist without manual `db:init`.

---

## 7. Future Integration Points

| Integration | Purpose | Status |
|-------------|---------|--------|
| ERP (SAP/Oracle) | PO sync | Not started |
| Banking API | Payment processing | Not started |
| GST Portal | Tax validation | Not started |
| Document Management | Central file store | Local files only |
| Budget System | Real-time budget check | Not implemented |
