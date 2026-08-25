# UAT — Create PR & Full Lifecycle Test Cases

**Document type:** User Acceptance Testing (UAT)  
**Module:** Create PR → Approvals → RFQ → Post-RFQ → PO  
**App paths:** `/requester/create-pr`, `/tasks`, `/rfq-approval`, RFQ Entry, Create PO  
**Version:** 2026-08-25  
**Testers:** _______________  
**Build / Environment:** _______________  

---

## How to use this document

1. Run cases in order within each **suite** (dependencies are noted).
2. For every row, mark **Pass / Fail / Blocked** and write actual result + evidence (PR number, screenshot, email log id).
3. A **strong case** means: happy path + validation + send-back/reject + notification check.
4. Do **not** skip Save Draft — many bugs appear only on draft → edit → submit.

### Result legend

| Mark | Meaning |
|------|---------|
| Pass | Matches expected result |
| Fail | Wrong behaviour / error / data loss |
| Blocked | Cannot run (role/menu/data missing) |
| N/A | Not applicable for this flow |

### Roles needed

| Role (system) | Display | Use for |
|---------------|---------|---------|
| Requester | Requester | Create PR, Own RFQ Entry, Track PR |
| HOD Approver | L1 Manager | Pre-RFQ + Vendor Final (Own) |
| PR Manager | L2 Manager | Pre-RFQ + post-RFQ L2 |
| CFO | CFO | Pre-RFQ / post-RFQ CFO |
| SCM Buyer | SCM Buyer | SCM RFQ, Create PO, Buyer Final Verify |
| SCM Manager | SCM Manager | Vendor approval, PO Sign |
| Super Admin | Admin | User Permissions, Notification Logs, admin send-back |

Also prepare **one user with only menus assigned** (e.g. Create PR + My Tasks on a non-Requester role) for permission suite.

---

## 0. Pre-conditions checklist

| # | Check | Pass? |
|---|--------|-------|
| 0.1 | Masters exist: Entity, Department, Category, Item, Vendor | |
| 0.2 | At least 1 active L1 (HOD), L2 (PR Manager), CFO, SCM Buyer, SCM Manager | |
| 0.3 | SMTP configured; Admin → Notification Logs opens | |
| 0.4 | Requester has menu: Create PR, Track PR, RFQ Entry, My Tasks | |
| 0.5 | Clear browser cache / new session per role when switching users | |

---

# Suite A — Create PR form & Save Draft (must pass first)

**Login:** Requester  
**Screen:** Create PR  

| ID | Strong case | Steps | Expected | Result | Notes / PR# |
|----|-------------|-------|----------|--------|-------------|
| A01 | Open Create PR | Open Create PR from menu | Form loads; no “Insufficient permissions”; entity/dept/category load | | |
| A02 | Required field block | Click Submit with empty form | Validation errors; PR **not** submitted | | |
| A03 | Line item required | Fill header only; no lines → Submit | Error: at least one line item | | |
| A04 | Entity required | Fill all except Entity → Submit | Error: Entity required | | |
| A05 | Save Draft — first save | Fill title, type, dept, entity, 1 line, justification → **Save Draft** | Success; PR number created; status **Draft**; no approval task | | |
| A06 | Save Draft — update | Open same draft (or stay on page) → change title/qty → Save Draft again | Same PR#; values updated; **no** duplicate PR | | |
| A07 | Soft / auto resume | Start PR, fill fields, refresh page (or leave & reopen Create PR) | Draft restored (local +/or backend id) without data loss | | |
| A08 | Attachments on draft | Add PDF/image on draft → Save Draft → reopen | Attachment listed; download works | | |
| A09 | Add line / remove line | Add 3 lines, remove 1, Save Draft | Totals correct; 2 lines persisted | | |
| A10 | Quick-add masters | From Create PR, chat/quick create category or item (if enabled) | Created & selectable; no 403 | | |
| A11 | Vendor master pick | Select vendor where UI allows (Functional Own / Own RFQ) | Vendor list loads; no queue/permission error | | |
| A12 | Permission: menu-only Create PR | User with **nav.create_pr** but non-Requester role → Create PR → Save Draft → Submit | Works end-to-end; **no** Insufficient permissions | | |

---

# Suite B — Submit PR (all Create PR flow types)

Fill minimum valid PR each time. Record PR number for later suites.

| ID | Flow | Steps | Expected after Submit | Result | PR# |
|----|------|-------|----------------------|--------|-----|
| B01 | **Standard + SCM** | Flow=Standard, Vendor=SCM → Submit | Status pending **L1**; L1 gets My Tasks + mail | | |
| B02 | **Standard + Own** | Flow=Standard, Vendor=Own → Submit | Pending L1; after L1 approve → Requester **RFQ Entry** (not SCM RFQ) | | |
| B03 | **Functional + SCM** | Flow=Functional, select 1–2 approvers, Vendor=SCM → Submit | Pending **User Approval** (selected user); not random L1 only | | |
| B04 | **Functional + Own** | Functional + Own + at least 1 vendor quote+file → Submit | User Approval chain; later SCM Final RFQ | | |
| B05 | Functional — no approver | Functional, 0 approvers → Submit | Blocked with clear error | | |
| B06 | Functional — max approvers | Select >5 approvers → Submit | Blocked (max 5) | | |
| B07 | Draft → Submit | Save Draft (A05) → open → Submit | Same PR# moves Draft → Pending approval | | |
| B08 | Notification | After B01 submit | Admin Notification Logs: PR raised / Approval Pending = **Sent** (not Failed) | | |

---

# Suite C — Pre-RFQ approvals (L1 / L2 / CFO)

Use **B01 Standard + SCM** unless noted.

| ID | Strong case | Actor | Steps | Expected | Result |
|----|-------------|-------|-------|----------|--------|
| C01 | L1 Approve (SCM) | L1 | My Tasks → Approve; choose Business Yes/No if asked | Goes to **L2** (SCM path) | |
| C02 | L1 Approve (Own) | L1 | On Standard Own PR → Approve | Goes to Requester **RFQ Entry** | |
| C03 | L1 Send Back | L1 | Send Back → Requester (Edit PR) | Status Returned; requester can edit & resubmit | |
| C04 | L1 Reject | L1 | Reject with remarks | Status Rejected; Track PR shows rejected | |
| C05 | L2 Approve → CFO | L2 | Approve when CFO required | Pending CFO | |
| C06 | L2 Approve → skip CFO | L2 | When L1 chose No Business / no CFO | Goes to **SCM RFQ Entry** | |
| C07 | L2 Send Back | L2 | Send Back to L1 or Requester | Target user gets task + mail | |
| C08 | CFO Approve | CFO | Approve | SCM RFQ Entry task for Buyer | |
| C09 | CFO Reject / Return | CFO | Reject or Send Back | Correct prior stage; notification Sent | |
| C10 | Wrong user blocked | Other user | Open task not assigned to them | Cannot approve; clear error (not silent success) | |
| C11 | Menu-assigned approver | User given My Tasks + assigned as Functional approver | Approve / Reject / Send Back | Works; **no** Insufficient permissions | |

---

# Suite D — Returned PR → Edit & Resubmit

| ID | Strong case | Steps | Expected | Result |
|----|-------------|-------|----------|--------|
| D01 | Open returned PR | From Track PR / mail link → Edit | Form prefilled; banner shows return remarks | |
| D02 | Save Draft while returned | Change line → Save Draft | Saves without forcing submit | |
| D03 | Resubmit | Fix fields → Resubmit (+ remarks if shown) | Back to L1 / User Approval 1; new approval history row | |
| D04 | Cannot edit locked PR | Open PR in Pending L2 (not returned) as requester | Edit blocked or read-only | |

---

# Suite E — RFQ Entry

### E1 — Own path (Requester RFQ)

| ID | Strong case | Steps | Expected | Result |
|----|-------------|-------|----------|--------|
| E1.01 | Open RFQ task | After C02 | RFQ Entry opens for that PR | |
| E1.02 | Invite / add vendor | Add vendor + send or manual | Invitation / row appears | |
| E1.03 | Save quote ₹0 | Enter unit 0 → confirm modal | Allowed with confirm; saves | |
| E1.04 | Upload quotation file | Attach PDF → Save | File preview/download works | |
| E1.05 | Next round / Send Back vendor | Send back for re-quote | Next round created; prior round still visible | |
| E1.06 | Finalize / recommend | Select recommended vendor → submit RFQ | Moves to L1 Vendor Final (Own) | |
| E1.07 | Notification | After finalize | Approver gets RFQ Approval pending mail = Sent | |

### E2 — SCM path (SCM Buyer RFQ)

| ID | Strong case | Steps | Expected | Result |
|----|-------------|-------|----------|--------|
| E2.01 | SCM RFQ list | After C08 / C06 | PR in SCM RFQ Entry pending | |
| E2.02 | Config + invite | Save RFQ config, invite vendors | Emails Sent / portal link works | |
| E2.03 | Manual submit | Manual quote + file without vendor email click | Quote saved | |
| E2.04 | Finalize | Recommend vendor → finalize | Goes to SCM Manager Vendor Approval | |

### E3 — Functional Own → SCM Final RFQ

| ID | Strong case | Steps | Expected | Result |
|----|-------------|-------|----------|--------|
| E3.01 | After all user approvers | Complete Functional Own approvals | SCM Final RFQ / Buyer RFQ Entry | |
| E3.02 | Quotes from create | Quotes added at Create PR still present | Rounds/files intact | |

---

# Suite F — Post-RFQ / RFQ Approval (Approve · Send Back · Reject)

| ID | Strong case | Actor | Steps | Expected | Result |
|----|-------------|-------|-------|----------|--------|
| F01 | L1 Vendor Final Approve | L1 | RFQ Approval → Approve; Yes/No Business if Own | Yes → L2→CFO; No → L2→SCM Final | |
| F02 | L1 Send Back → Requester RFQ | L1 | Send Back → Requester RFQ Entry | Requester can revise RFQ; mail Sent (not Failed) | |
| F03 | L1 Send Back → Edit PR | L1 | Send Back → Requester (Edit PR) | Returned; edit & resubmit works | |
| F04 | L2 Vendor Approve | L2 | Approve | CFO or SCM Final per prior choice | |
| F05 | CFO Vendor Approve | CFO | Approve | SCM Final RFQ / Create PO path | |
| F06 | SCM Manager Vendor Approve | SCM Mgr | Approve comparison | Buyer Create PO pending | |
| F07 | SCM Manager Send Back | SCM Mgr | Send Back → SCM RFQ | Buyer can re-open RFQ | |
| F08 | Reject at RFQ Approval | Any post-RFQ actor | Reject | Rejected; requester notified | |
| F09 | **Admin / Super Admin** Send Back | Super Admin | Open RFQ Approval detail → Send Back | Buttons enabled; send-back succeeds; log Sent/retry | |
| F10 | Admin Track PR send-back | Super Admin / privileged | Track PR → Admin Send Back to prior stage | Status + task updated; mail queued | |

---

# Suite G — Create PO → Sign → Acceptance (smoke)

| ID | Strong case | Steps | Expected | Result |
|----|-------------|-------|----------|--------|
| G01 | Create PO from pending | Buyer opens Create PO for PR | Preview PDF; save draft/create PO | |
| G02 | SCM Manager Sign | Approve/Sign PO | PO signed; vendor mail if applicable | |
| G03 | Send Back PO | Manager Send Back to Buyer | Buyer can revise | |
| G04 | Buyer Final Verify | Verify / send-back | Status advances correctly | |

---

# Suite H — Notifications & Admin logs (cross-cutting)

| ID | Event | Expected in Notification Logs | Result |
|----|-------|-------------------------------|--------|
| H01 | PR Submit | Approval Pending = Sent | |
| H02 | Approve L1/L2/CFO | Next assignee mail = Sent | |
| H03 | Send Back / Reject | **PR Reject / Return** = Sent (not Failed) | |
| H04 | Retrigger Failed | Click Retrigger on failed row | Becomes Sent or clear SMTP error | |
| H05 | WhatsApp (if enabled) | No crash; optional delivery | |
| H06 | Admin User Permissions page | List loads all users; **no** “Queue limit reached” | |

---

# Suite I — Negative / security strong cases

| ID | Case | Steps | Expected | Result |
|----|------|-------|----------|--------|
| I01 | No Create PR menu | User without nav.create_pr | Menu hidden; API create returns 403 | |
| I02 | Edit someone else’s draft | PUT another user’s PR | Not allowed / not found | |
| I03 | Approve without assignment | Call approve on PR not assigned | Error: not assigned / wrong stage | |
| I04 | Expired session | Clear token → Save Draft | Auth redirect / 401, no silent fail | |
| I05 | Double submit | Submit twice quickly | One PR / one workflow; no corrupt status | |
| I06 | Huge attachment | Upload very large file | Clear error or success; no pool crash | |

---

# End-to-end “golden path” scripts (run these fully)

Copy one PR# through the whole chain. Tick when done.

### Golden Path 1 — Standard + SCM (full)

```
Create PR (Save Draft → Submit)
  → L1 Approve (Business Yes)
  → L2 Approve
  → CFO Approve
  → SCM RFQ (invite → quote → finalize)
  → SCM Manager Vendor Approve
  → Create PO → Manager Sign
```

| Checkpoint | PR# / Status | Pass? |
|------------|--------------|-------|
| Draft saved | | |
| Submitted | | |
| L1 done | | |
| L2 done | | |
| CFO done | | |
| RFQ finalized | | |
| Vendor approved | | |
| PO signed | | |

### Golden Path 2 — Standard + Own

```
Create PR Own → Submit
  → L1 Approve
  → Requester RFQ Entry → Finalize
  → L1 Vendor Final (No Business)
  → L2 Approve
  → SCM Final RFQ / Create PO path
```

| Checkpoint | Pass? |
|------------|-------|
| Own RFQ after L1 | |
| Vendor Final Send Back works | |
| L2 → SCM Final (skip CFO) | |

### Golden Path 3 — Functional + Own (multi-approver)

```
Create PR Functional Own (2 approvers + quotes)
  → Approver 1 Approve
  → Approver 2 Approve
  → SCM Final RFQ
  → Create PO …
```

| Checkpoint | Pass? |
|------------|-------|
| Chain order correct | |
| Quotes preserved | |
| No Insufficient permissions for selected users | |

### Golden Path 4 — Send Back & Resubmit stress

```
Submit Standard SCM
  → L1 Send Back to Requester
  → Edit + Save Draft + Resubmit
  → L1 Approve → L2 Send Back to L1
  → L1 Approve → … continue to RFQ
  → RFQ Approval Send Back to Requester RFQ
  → Re-finalize → continue
```

| Checkpoint | Pass? |
|------------|-------|
| All send-backs land on correct stage | |
| All return mails Sent | |
| Resubmit restores workflow | |

---

# Defect log (fill during UAT)

| Defect # | Case ID | Severity (Blocker/Major/Minor) | Summary | Evidence | Status |
|----------|---------|--------------------------------|---------|----------|--------|
| D-001 | | | | | Open |
| D-002 | | | | | |
| D-003 | | | | | |

---

# Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Tester | | | Pass / Fail / Pass with defects |
| Product Owner | | | Accepted / Rejected |
| Tech Lead | | | |

**Minimum for release:** Suites **A, B, C, D, F02, F09, H03, H06** + **Golden Path 1** must be Pass.

---

## Quick reference — Create PR flow matrix

| Flow | Vendor | After first approval(s) | RFQ owner | Post-RFQ |
|------|--------|-------------------------|-----------|----------|
| Standard | SCM | L1 → L2 → (CFO) | SCM Buyer | SCM Manager → Create PO |
| Standard | Own | L1 | Requester | L1 Vendor Final → L2 → (CFO) → SCM Final |
| Functional | SCM | Selected users in order | SCM Buyer | SCM Manager → Create PO |
| Functional | Own | Selected users in order | SCM Final RFQ (Buyer) | Create PO path |

---

*End of UAT document.*
