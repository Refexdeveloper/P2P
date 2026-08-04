# 16 — Data Dictionary

All database tables in `p2p_system` schema. Source: `server/db/schema.sql`

---

## 1. departments

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | Auto increment |
| name | VARCHAR(100) | Department name (unique) |
| budget_allocated | DECIMAL(15,2) | Allocated budget |
| budget_utilized | DECIMAL(15,2) | Used budget |
| created_at | TIMESTAMP | |

---

## 2. users

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| name | VARCHAR(100) | Full name |
| email | VARCHAR(150) | Login email (unique) |
| password_hash | VARCHAR(255) | Bcrypt hash |
| role | VARCHAR(50) | User role |
| department_id | INT FK | → departments |
| is_active | TINYINT(1) | 1=active |
| refexone_user_id | VARCHAR(36) | RefexOne UUID |
| supervisor_email | VARCHAR(150) | L1 manager email |
| supervisor_name | VARCHAR(120) | L1 manager name |
| l2_manager_email | VARCHAR(150) | L2 manager email |
| created_at | TIMESTAMP | |

---

## 3. purchase_requests

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| pr_number | VARCHAR(20) | PR-YYYY-NNNN (unique) |
| title | VARCHAR(255) | PR title |
| request_type | ENUM | Capex / Opex / Service |
| department_id | INT FK | |
| requester_id | INT FK | → users |
| priority | ENUM | Low / Medium / High / Critical |
| justification | TEXT | Business case |
| required_date | DATE | Needed by date |
| total_amount | DECIMAL(15,2) | Sum of line items |
| status | VARCHAR(50) | Workflow status |
| current_stage | VARCHAR(50) | Active stage |
| submitted_at | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 4. pr_line_items

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| pr_id | INT FK | → purchase_requests |
| category | VARCHAR(100) | Item category |
| description | VARCHAR(255) | Item description |
| quantity | INT | |
| unit_cost | DECIMAL(15,2) | |
| total | DECIMAL(15,2) | qty × unit_cost |

---

## 5. pr_approvals

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| pr_id | INT FK | |
| stage | VARCHAR(50) | HOD, PR_MANAGER, CFO, RFQ, PO, etc. |
| approver_id | INT FK | → users |
| action | VARCHAR(30) | SUBMITTED, APPROVED, REJECTED, PO_CREATED, PO_SIGNED, etc. |
| remarks | TEXT | Comments |
| created_at | TIMESTAMP | |

---

## 6. workflow_tasks

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| pr_id | INT FK | |
| task_type | VARCHAR(50) | PR_APPROVAL, RFQ, PO_SIGN, etc. |
| assigned_role | VARCHAR(50) | Role to action |
| assigned_user_id | INT FK | Specific user (optional) |
| status | ENUM | pending / completed / cancelled |
| due_date | DATE | |
| completed_at | TIMESTAMP | |
| created_at | TIMESTAMP | |

---

## 7. rfq_invitations

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| pr_id | INT FK | |
| vendor_name | VARCHAR(150) | |
| vendor_email | VARCHAR(150) | |
| access_token | VARCHAR(64) | Quote portal token (unique) |
| round | INT | Negotiation round |
| status | ENUM | invited / submitted / sent_back / accepted |
| send_back_reason | TEXT | |
| send_back_fields | JSON | Fields to revise |
| created_by | INT FK | |
| invite_mode | ENUM | email / manual |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 8. vendor_quotation_submissions

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| rfq_invitation_id | INT FK | |
| round | INT | |
| quoted_price | DECIMAL(15,2) | |
| lead_time_days | INT | |
| payment_terms | VARCHAR(100) | |
| compliance | TINYINT(1) | |
| vendor_notes | TEXT | |
| warranty | VARCHAR(100) | |
| delivery_terms | VARCHAR(100) | |
| quotation_file_name | VARCHAR(255) | |
| quotation_file_path | VARCHAR(500) | |
| custom_fields | JSON | Dynamic vendor fields |
| requester_fields | JSON | Scoring fields |
| status | ENUM | submitted / sent_back / accepted |
| submitted_at | TIMESTAMP | |

---

## 9. rfq_configs

| Column | Type | Description |
|--------|------|-------------|
| pr_id | INT PK FK | |
| field_definitions | JSON | Custom RFQ fields |
| recommended_invitation_id | INT | Selected vendor invitation |
| max_rounds | INT | |
| finalized_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 10. purchase_orders

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| po_number | VARCHAR(30) | Unique PO number |
| pr_id | INT FK | |
| vendor_name | VARCHAR(150) | |
| vendor_email | VARCHAR(150) | |
| rfq_invitation_id | INT FK | Winning vendor |
| created_by | INT FK | SCM Buyer |
| delivery_address | TEXT | |
| expected_delivery_date | DATE | |
| payment_terms | VARCHAR(100) | |
| incoterms | VARCHAR(50) | Default DDP |
| special_instructions | TEXT | |
| po_type | ENUM | short_po / long_po |
| letterhead_header | LONGTEXT | HTML header |
| terms_clauses | JSON | [{header, description}] |
| annexure_clauses | JSON | [{header, description}] |
| gst_percentage | DECIMAL(5,2) | Default 18% |
| subtotal | DECIMAL(15,2) | |
| tax_amount | DECIMAL(15,2) | |
| grand_total | DECIMAL(15,2) | |
| status | ENUM | draft / pending_approval / approved / rejected / sent_to_vendor |
| pdf_path | VARCHAR(500) | |
| signed_pdf_path | VARCHAR(500) | |
| signer_id | INT FK | SCM Manager |
| signature_name | VARCHAR(150) | |
| signer_comments | TEXT | |
| signed_at | TIMESTAMP | |
| vendor_notified_at | TIMESTAMP | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 11. po_line_items

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| po_id | INT FK | |
| category | VARCHAR(100) | |
| description | VARCHAR(255) | |
| quantity | INT | |
| unit_price | DECIMAL(15,2) | |
| total | DECIMAL(15,2) | |

---

## 12. vendors

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| vendor_code | VARCHAR(30) | VEN-NNNN (unique) |
| name | VARCHAR(150) | |
| vendor_type | ENUM | Company / Individual |
| gst_number | VARCHAR(15) | |
| pan_number | VARCHAR(10) | |
| email | VARCHAR(150) | |
| phone | VARCHAR(20) | |
| address | TEXT | |
| category | VARCHAR(100) | |
| account_number | VARCHAR(50) | |
| ifsc_code | VARCHAR(11) | |
| bank_name | VARCHAR(100) | |
| branch | VARCHAR(100) | |
| status | ENUM | active / inactive |
| created_by | INT FK | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 13. po_letterhead_masters

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| po_type | ENUM | short_po / long_po (unique) |
| title | VARCHAR(200) | Document title |
| letterhead_header | LONGTEXT | HTML |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 14. po_letterhead_clauses

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| master_id | INT FK | → po_letterhead_masters |
| section_type | ENUM | terms / annexure |
| sort_order | INT | Display order |
| terms_header | VARCHAR(255) | Clause title |
| terms_description | LONGTEXT | HTML content |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

## 15. vendor_documents

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| vendor_id | INT FK | |
| doc_type | ENUM | gst / pan / cheque |
| file_name | VARCHAR(255) | |
| file_path | VARCHAR(500) | |
| uploaded_at | TIMESTAMP | |

---

## 16. navigation_permissions

| Column | Type | Description |
|--------|------|-------------|
| id | INT PK | |
| code | VARCHAR(80) | Permission key (unique) |
| label | VARCHAR(120) | Display label |
| path | VARCHAR(200) | Frontend route |
| icon | VARCHAR(80) | Remix icon class |
| nav_group | VARCHAR(80) | Menu group |
| sort_order | INT | |

---

## 17. user_permissions

| Column | Type | Description |
|--------|------|-------------|
| user_id | INT PK FK | → users |
| permission_code | VARCHAR(80) PK | → navigation_permissions.code |

---

## Entity Relationship Summary

```
departments ← users ← purchase_requests → pr_line_items
                              ↓
                    pr_approvals, workflow_tasks
                              ↓
                    rfq_invitations → vendor_quotation_submissions
                              ↓
                         rfq_configs
                              ↓
                    purchase_orders → po_line_items
                              ↑
                    po_letterhead_masters → po_letterhead_clauses
                              ↑
                         vendors → vendor_documents
```
