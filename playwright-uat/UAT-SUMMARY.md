# UAT Automation Summary

Generated from framework scaffold + local runs against `http://localhost:5000`.

| UAT ID | Test Name | Status | Evidence | Notes |
|--------|-----------|--------|----------|-------|
| SMOKE-01 | BASE_URL reachable | PASS | `uat:smoke` | localhost:5000 OK |
| SMOKE-02 | API login endpoint | PASS | `uat:smoke` | `/api/auth/login` exists |
| SMOKE-03 | Admin login page | PASS | `uat:smoke` | `/admin/login` |
| SMOKE-04 | Requester credentials | PASS | `uat:smoke` | `.env` configured |
| A01 | Open Create PR | PASS | last run | Form + Save Draft / Submit PR visible |
| A02 | Required field validation | PASS | last run | Empty submit shows validation |
| A03–A04 | Line/Entity required | NOT RUN | — | Implemented |
| A05 | Save Draft — first save | PASS | last run | Line item + draft save OK |
| A06–A12 | Suite A remainder | NOT RUN | — | Specs present |
| B01–B08 | Suite B | NOT RUN | — | Specs present; need stable fill+submit |
| C01,C03,C04 | L1 approve/sendback/reject | NOT RUN | — | Specs present; need submitted PR |
| C02,C05–C11 | Other approvals | SKIPPED/NOT RUN | — | Some explicitly skipped until stage data |
| D01–D04 | Returned PR | NOT RUN | — | Specs present |
| E1.01 | Own RFQ opens | NOT RUN | — | Spec opens `/requester/rfq-entry` |
| E1.06 | Finalize/recommend | SKIP if empty | — | Skips when no RFQ work item |
| E* remainder | RFQ suite | SKIPPED | — | Need mid-pipeline PRs |
| F02 | L1 Send Back → Requester RFQ | SKIP if empty | — | Needs RFQ Approval queue |
| F09 | Admin Send Back | SKIP if empty | — | Needs RFQ Approval item |
| G01 | Create PO | SKIP if empty | — | Needs eligible PR |
| H03 | Send Back/Reject notification | SKIP if empty | — | Needs email-log rows |
| H06 | Admin User Permissions | NOT RUN | — | Spec opens `/admin/user-permissions` |
| I01 | No Create PR menu | BLOCKED | — | Set `NO_CREATE_PR_*` in `.env` |
| I05 | Double submit | NOT RUN | — | Spec present |
| GP1 | Golden Path 1 | BLOCKED | — | `SCM_MANAGER` login 401 for seed email in this DB |
| GP2–GP4 | Other golden paths | NOT RUN / SKIP | — | Specs present |

## Blockers (current environment)

1. **SCM Manager credentials** — `rajeev.v@refex.co.in` / seed password returns HTTP 401. Update `SCM_MANAGER_*` in `playwright-uat/.env` to a valid SCM Manager user. Blocks GP1 and G02.
2. **NO_CREATE_PR user** — not set; I01 / A12 negative path blocked.
3. **Stage-dependent cases** (E/F/G mid-flow, H03) need prior PR progress or a successful Golden Path 1.
4. **Do not use Vite `:3000` with cloud API** for these seed users — use `BASE_URL=http://localhost:5000` (same-origin API).

## Inspected (app not modified)

- Routes, `/admin/login`, Create PR fields, Tasks approval modal, RFQ/PO/Admin paths
- Remix Icon prefixes on button accessible names → use `/save draft/i` not `/^save draft$/`
- Protected routes redirect unauthenticated users to RefexOne SSO (session must be valid)

## How to continue

```bash
cd playwright-uat
# fix SCM_MANAGER_* (and optional NO_CREATE_PR_*) in .env
npm run uat:smoke
npx playwright test --grep "A01|A02|A05|A06" --project=chromium
npm run uat:priority
npm run uat:report
```

Application source under `client/` and `server/` was **not** changed.
