# RMC UAT — PR / PO Value Matrix (new flow only)

**Scope:** `P2P-RMC-Bussiness` only. Does **not** delete existing PR/PO/master data.  
**Rollback tag:** `rmc-uat-value-matrix-v1` (use if anything wrong)

## Pre-check

1. Restart API so migrations run (`users.rmc_tags`, value matrix tables).
2. Admin → **Approval Matrix** → PO Value rows visible + Preview works.
3. Admin → User Permissions → set `rmcTags` for approvers to `RIL_RMC` and/or `P2P_RMC`  
   (API: `PUT /api/admin/users/:id` body `{ "rmcTags": ["RIL_RMC"] }`).  
   Until at least one user is tagged, approval dropdown falls back to all active users.

## UAT cases

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1 | Plant + category required | Create PR without Plant / Release Category | Validation error |
| 2 | Manual PR approvers | Mode = Manual; pick L1 from list | Only RMC-tagged users after tags set; submit uses chosen approvers |
| 3 | Matrix mode (PR) | Mode = Matrix | Flag saved; until PR matrix rows uploaded, HOD still Refex/L1 fallback |
| 4 | Own / SCM vendor | Same as old | Unchanged |
| 5 | SCM vendor choose / add | After RFQ, Create PO | Can edit vendor or add new |
| 6 | Low value Capex 3L | Create PO → Send | Value: Lalitha → then SCM sign |
| 7 | High value Capex 8L | Create PO → Send | Lalitha → Anil → SCM sign |
| 8 | Raw 15L | Create PO → Send | Skip value (SCM L1 skipped) → SCM sign |
| 9 | Value reject | Reject on My Tasks | PO back to draft |
| 10 | Multi PO | 2 POs on same PR, split qty | Both allowed |
| 11 | Qty exceed | 2nd PO qty > remaining PR qty | Error, blocked |
| 12 | Manual PO | Manual create, high amount + category | Value approval before SCM sign |
| 13 | SCM sign + Buyer verify | After value done | Same as old; then vendor mail |

## Pass rule

All rows Pass → OK to push **live** (same URL).  
Any Fail → **do not live push**; revert to tag `rmc-uat-value-matrix-v1`.

## Rollback

```bash
git checkout rmc-uat-value-matrix-v1
# redeploy that revision / image
```
