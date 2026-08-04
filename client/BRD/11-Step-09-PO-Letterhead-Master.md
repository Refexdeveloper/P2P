# 11 — Step 9: PO Letterhead Master

**Screen:** `/scm/po-letterhead-master`  
**Roles:** SCM Buyer, Super Admin  
**Status:** ✅ Live  
**API:** `GET /api/po/letterhead/:poType`, `PUT /api/po/letterhead/:poType`

---

## 1. Step Objective

Configure reusable PO document templates for **Short PO** and **Long PO** types, including letterhead header, Terms & Conditions table, and Annexure table. Templates are used when SCM Buyer creates PO.

---

## 2. PO Type Tabs

| Tab | Code | Description |
|-----|------|-------------|
| Short PO | `SHORT_PO` | Standard purchase orders |
| Long PO | `LONG_PO` | Extended contracts / complex POs |

Each type has independent template configuration.

---

## 3. Template Fields

### 3.1 Document Title

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Document Title | `title` | Text | Yes |

Example: "PURCHASE ORDER" or "WORK ORDER"

### 3.2 Letterhead Header

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Letterhead Header | `letterheadHeader` | Rich Text Editor | Yes |

Content typically includes:
- Refex company logo reference
- Company name and registered address
- CIN, GSTIN
- Contact details

Uses `RichTextEditor` component (HTML output).

---

## 4. Terms & Conditions Table

Repeatable rows — each row:

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Terms Header | `header` | Text | Yes |
| 2 | Terms Description | `description` | Rich Text Editor | Yes |
| 3 | Sort Order | `sortOrder` | Number (auto) | — |

**Actions:**
- Add Row
- Remove Row
- Reorder (up/down)

**Example rows:**
| Header | Description |
|--------|-------------|
| Payment | 30 days from invoice date |
| Delivery | Within 15 days of PO date |
| Warranty | 12 months from delivery |

---

## 5. Annexure Table

Same structure as Terms & Conditions:

| # | Field Label | Field ID | Type | Required |
|---|-------------|----------|------|----------|
| 1 | Annexure Header | `header` | Text | Yes |
| 2 | Annexure Description | `description` | Rich Text Editor | Yes |
| 3 | Sort Order | `sortOrder` | Number (auto) | — |

**Actions:** Add Row, Remove Row, Reorder

---

## 6. Screen Actions

| Button | Action |
|--------|--------|
| Save | Persist template to DB |
| Reset | Reload from last saved |
| Unsaved indicator | Shows when changes pending |

---

## 7. Database Tables

### `po_letterhead_masters`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `po_type` | ENUM | SHORT_PO / LONG_PO |
| `title` | VARCHAR | Document title |
| `letterhead_header` | TEXT | HTML header |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

### `po_letterhead_clauses`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT PK | |
| `letterhead_id` | INT FK | |
| `clause_type` | ENUM | TERMS / ANNEXURE |
| `header` | VARCHAR | Clause title |
| `description` | TEXT | HTML content |
| `sort_order` | INT | Display order |

---

## 8. Integration with Create PO

When SCM Buyer selects PO type on Create PO screen:
1. `GET /api/po/letterhead/:poType` loads template
2. Terms & annexure populate editable fields
3. On PO save → clauses copied to `purchase_orders.terms_clauses`, `annexure_clauses`
4. Preview/PDF uses saved PO data (not live master)

---

## 9. Default Seed Data

On `npm run db:init`, default Short PO and Long PO templates are seeded with Refex branding and standard terms.

---

## 10. Permissions

| Role | Access |
|------|--------|
| SCM Buyer | Read + Write |
| Super Admin | Read + Write |
| Others | No access |

Permission key: `nav.po_letterhead_master`
