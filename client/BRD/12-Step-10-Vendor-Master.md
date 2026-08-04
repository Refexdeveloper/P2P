# 12 — Step 10: Vendor Master

**Screen:** `/scm/vendor-master`  
**Roles:** SCM Buyer, Super Admin  
**Status:** ✅ Live  
**API:** `GET /api/vendors`, `POST /api/vendors`, `PUT /api/vendors/:id`, `DELETE /api/vendors/:id`

---

## 1. Step Objective

Maintain vendor registry used for RFQ invitations and PO generation. Stores company details, tax IDs, bank info, and compliance documents.

---

## 2. Vendor List Columns

| # | Column | Field Key |
|---|--------|-----------|
| 1 | Vendor Code | `vendorCode` |
| 2 | Vendor Name | `name` |
| 3 | Type | `vendorType` |
| 4 | Category | `category` |
| 5 | Email | `email` |
| 6 | Phone | `phone` |
| 7 | GST Number | `gstNumber` |
| 8 | Status | `status` |
| 9 | Created Date | `createdAt` |

**Actions:** View, Edit, Deactivate/Activate

---

## 3. Create / Edit Vendor Form — Exact Fields

### 3.1 Basic Information

| # | Field Label | Field ID | Type | Required | Validation |
|---|-------------|----------|------|----------|------------|
| 1 | Vendor Name | `vendorName` | Text | Yes | Min 2 chars |
| 2 | Vendor Type | `vendorType` | Dropdown | Yes | Company / Individual |
| 3 | Category | `category` | Dropdown | Yes | See list below |
| 4 | Email | `email` | Email | Yes | Valid email |
| 5 | Phone | `phone` | Text | No | 10-digit preferred |
| 6 | Address | `address` | Textarea | Yes | Full address |

**Category Options:**
- IT Services
- Professional Services
- Raw Materials
- Office Supplies
- Consulting
- Equipment
- Maintenance
- Transportation

### 3.2 Tax Information

| # | Field Label | Field ID | Type | Required | Validation |
|---|-------------|----------|------|----------|------------|
| 1 | GST Number | `gstNumber` | Text | No | 15-char GSTIN format |
| 2 | PAN Number | `panNumber` | Text | No | 10-char PAN format |

### 3.3 Bank Details

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Bank Name | `bankName` | Text | No |
| 2 | Branch | `branch` | Text | No |
| 3 | Account Number | `accountNumber` | Text | No |
| 4 | IFSC Code | `ifscCode` | Text | No |

### 3.4 Document Uploads

| # | Document | Field ID | Type | Required |
|---|----------|----------|------|----------|
| 1 | GST Certificate | `gstDoc` | File (PDF/image) | No |
| 2 | PAN Card | `panDoc` | File (PDF/image) | No |
| 3 | Cancelled Cheque | `chequeDoc` | File (PDF/image) | No |

Documents stored as base64 in `vendor_documents` table.

---

## 4. Form Actions

| Button | Action |
|--------|--------|
| Save | Create or update vendor |
| Cancel | Close form |
| Upload Document | Attach GST/PAN/Cheque |

---

## 5. Vendor Usage in Workflow

| Step | Usage |
|------|-------|
| RFQ | Vendor selected from master for invitation |
| Vendor Portal | Email from master used for quote link |
| Create PO | Vendor address, GST, PAN pulled into PO |
| PO PDF | Vendor details on document header |
| PO Email | Signed PO sent to vendor email |

---

## 6. Database Tables

### `vendors`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `vendor_code` | VARCHAR | Auto: VEN-NNNN |
| `name` | VARCHAR | |
| `vendor_type` | ENUM | Company/Individual |
| `email` | VARCHAR | |
| `phone` | VARCHAR | |
| `address` | TEXT | |
| `gst_number` | VARCHAR | |
| `pan_number` | VARCHAR | |
| `category` | VARCHAR | |
| `bank_name` | VARCHAR | |
| `branch` | VARCHAR | |
| `account_number` | VARCHAR | |
| `ifsc_code` | VARCHAR | |
| `status` | ENUM | ACTIVE/INACTIVE |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

### `vendor_documents`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `vendor_id` | INT FK | |
| `doc_type` | ENUM | gst/pan/cheque |
| `file_name` | VARCHAR | |
| `file_data` | LONGTEXT | Base64 |
| `uploaded_at` | DATETIME | |

---

## 7. Validations

- Email must be unique among active vendors
- GST format: `##AAAAA####A#Z#`
- PAN format: `AAAAA####A`
- IFSC format: 11 characters

---

## 8. Permissions

| Role | Access |
|------|--------|
| SCM Buyer | Full CRUD |
| Super Admin | Full CRUD |
| Others | No access |

Permission key: `nav.vendor_master`
