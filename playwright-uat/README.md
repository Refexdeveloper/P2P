# Playwright UAT — P2P Create PR → PO Sign

Isolated automation for the Create PR UAT document. **Does not modify** application source under `client/` or `server/`.

## What was inspected

| Area | Finding |
|------|---------|
| Stack | React (Vite) + Express API + MySQL |
| Local SPA+API | `http://localhost:5000` serves `client/out` + `/api` |
| Vite dev | `http://localhost:3000` proxies `/api` to `VITE_API_URL` (often cloud) |
| SSO login | `/login` → RefexOne (not automated; MFA must not be bypassed) |
| Local login | `/admin/login` → `POST /api/auth/login` → `p2p_token` / `p2p_user` |
| Create PR | `/requester/create-pr`, edit `/requester/edit-pr/:id` |
| Tasks | `/tasks` (Approve / Send Back / Reject + modal) |
| RFQ | `/requester/rfq-entry`, `/scm/rfq-entry` |
| RFQ Approval | `/rfq-approval` |
| Create PO | `/scm/create-po`, sign `/scm/po-approval` |
| Admin | `/admin/user-permissions`, `/admin/email-logs` |

## Installation

```bash
cd playwright-uat
npm install
npm run uat:install
cp .env.example .env
```

Edit `.env` with real credentials for each role. Never commit `.env`.

For a local DB seeded via `server/db/init.js`, usernames often match seed emails (e.g. `requester@procure.com`). Passwords are **not** stored in this folder — put them only in `.env`.

**Recommended BASE_URL for local UAT:** `http://localhost:5000` (same origin for UI + API).  
If you use Vite on `:3000`, ensure its API proxy targets the same database/API your test users exist on.

## Environment variables

See `.env.example`:

- `BASE_URL`, optional `API_URL`
- `REQUESTER_*`, `L1_*`, `L2_*`, `CFO_*`, `SCM_BUYER_*`, `SCM_MANAGER_*`, `ADMIN_*`
- Optional `NO_CREATE_PR_*` for I01
- Optional `UAT_ENTITY_SEARCH`, `UAT_ITEM_NAME`, `UAT_CATEGORY_NAME`

## Authentication

1. Project `setup` (`tests/auth.setup.ts`) logs in each configured role via **`POST /api/auth/login`** (same path as Admin Login).
2. Session is injected into browser storage (`p2p_token`, `p2p_user`) and saved under `.auth/*.json`.
3. Multi-user flows open a fresh browser context per role (`contextForRole`).
4. RefexOne SSO / MFA is **not** bypassed. If your environment requires SSO-only auth, document the blocker and use users that have local password hashes, or provide a secure test IdP — do not disable app security.

## How to run

```bash
npm run uat:smoke          # connectivity + login page
npm run uat:priority       # priority UAT IDs
npm run uat                # all tests
npm run uat:headed         # headed browser
npm run uat:create-pr      # Suite A
npm run uat:submit-pr      # Suite B
npm run uat:approvals      # Suite C
npm run uat:returned       # Suite D
npm run uat:rfq            # Suite E
npm run uat:post-rfq       # Suite F
npm run uat:po             # Suite G
npm run uat:notifications  # Suite H
npm run uat:security       # Suite I
npm run uat:golden         # Golden paths
npm run uat:report         # open HTML report
```

### Single UAT case

```bash
npx playwright test --grep "A05"
npx playwright test --grep "C03 - L1 Send Back"
```

### Headed single case

```bash
npx playwright test --grep "A01" --headed
```

## Reports, screenshots, traces

| Artifact | Location |
|----------|----------|
| HTML report | `reports/html` (`npm run uat:report`) |
| JSON results | `reports/results.json` |
| Failure screenshots | Playwright `test-results/` + optional `screenshots/` via `captureEvidence` |
| Traces | On first retry (`trace: on-first-retry`) inside `test-results/` |

## Page Object Model

Page objects live in `pages/`. Fixtures in `fixtures/auth.fixture.ts`. Prefer `getByRole` / `getByLabel` / `getByPlaceholder`.

## Adding a new UAT test

1. Place the spec under the matching `tests/<suite>/` folder.
2. Name it with the UAT ID: `test('A13 - …', …)`.
3. Reuse page objects; add methods only when selectors are confirmed in the app.
4. Use `test.skip(condition, 'reason')` when the environment cannot support the case — do not weaken expected behavior.
5. Capture evidence on important asserts with `captureEvidence`.

## Release criteria (target)

Executable / passing before declaring complete:

- Suite A, B, C, D  
- F02, F09, H03, H06  
- Golden Path 1  

Cases that need mid-pipeline PRs may be **SKIPPED** with reasons until seed data exists.

## Blockers to report if incomplete

1. Missing `.env` credentials → auth.setup skips roles; tests skip.  
2. `BASE_URL` points at Vite proxying **cloud** API while credentials are local (or vice versa).  
3. Empty masters (no Entity / Item) → Create PR fill fails until `UAT_ENTITY_SEARCH` / masters exist.  
4. Stage-dependent cases (RFQ / PO) need prior pipeline progress or Golden Path run.
