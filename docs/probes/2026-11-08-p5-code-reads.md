# P5 code-read record (revision r2, 2026-11-08, Asia/Colombo)

Scope: re-checks of every fact the master plan cites, at the pinned refs, plus the facts added by the review of PR #1 (head `cd4f9675287c2e2dc5040b646f93ba9ee1df61ca`). This revision performed NO runtime probe: no product stack, no harness run, no account or settings action, no send, no merge, no history rewrite. Where a fact needs a live run, it is marked UNPROBED with the probe that will settle it (plan section 13).

Private detail: private-first items appear only as IDs and status. Nothing from them was read beyond identity confirmation.

## 1. Read methods and inventory completeness

| Source | Ref | Method | Inventory completeness |
|---|---|---|---|
| This repo | `origin/main` = `06ac98808964854b62e2e7699783bc86c9b23e20` | `git ls-tree -r --name-only origin/main` (r1 hard-stop check) | Complete: two files |
| P2 `Jayami123/api-webhook-db-test-suite` | `99a2fde` | full anonymous clone (scratch, outside this repo); `git show 99a2fde:<path>` | Complete for the plan's wildcard list: 356 files (`git ls-tree -r`) |
| Harness `Jayami123/qa-portfolio-harness` | `v0.3.1` | full anonymous clone | Specific files only; absence = grep over `src/` |
| P6 `Jayami123/k6-load-concurrency-suite` | `0533e61` | full anonymous clone | Specific files only |
| Cal `Jayami123/cal` | `c2b7ac44c66f24ffef1662b276f0653988a609a3` | shallow fetch by SHA | Specific paths |
| Documenso `Jayami123/documenso` | `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` | shallow fetch by SHA | Specific paths |
| Medusa starter `Jayami123/medusa-dtc-starter` | `f677db438f27294fc50e4c7c6612e71ff38eeff5` | shallow fetch by SHA | Specific paths (`apps/backend/package.json`, lock) |
| Twenty `Jayami123/twenty-crm` | `7cbdfec6f346b43715bc2056932f4fad5886f733` | shallow fetch by SHA | Specific paths |
| Medusa core `medusajs/medusa` | tag `v2.21.2` = commit `020565398e436a2bc65777a3b1ad347b4735d6df` | blobless sparse fetch (`packages/medusa/src/feature-flags`, `packages/medusa/src/api/store/orders`, `packages/medusa/src/api/store/carts`) | Sparse |
| docs.stripe.com/webhooks; stripe-node `v23.0.1` `src/Webhooks.ts` | live / tag | public HTTPS GET | Single page / single file |
| code.claude.com `docs/en/settings-reference` | live | public HTTPS GET (this revision) | Single page; attribution text found |
| GitHub REST `rulesets` for this repo | live | public GET | `[]` |

Access: all repositories read anonymously as public. No token, credential, internal API, proxy change or alternate transport was used. A denial would have been a STOP; none occurred.

## 2. Facts (plan section 2)

Status: CONFIRMED (checked here at the pin), CONFIRMED-REVIEW (checked by the review, not re-read here), UNREAD, UNPROBED (needs a runtime probe), CONTRADICTS (none outstanding).

| # | Fact | Evidence | Status |
|---|---|---|---|
| 1 | Documenso bypass only when `DANGEROUS_BYPASS_RATE_LIMITS === "true"`; P2 roadmap line stale | harness `src/adapters/documenso-env.ts:297-298`; P2 `docs/plans/2026-10-20-p2-phase1-roadmap.md:211` | CONFIRMED |
| 2 | Ten P6 routes; seven Documenso values cited (authorize 10, forgot 3, resend 3, verify 5, reset 5, upload 20, ai 3) | P6 `src/load/spike/limiter-contract.ts:14-58`; `:19` upload 20; `:20` ai 3; `:21-28` authorize; `:29-35` forgot; `:36-42` resend; `:43-49` verify; `:50-57` reset | CONFIRMED (cited; not re-run). The plan's earlier six-value list omitted `ai`; corrected. |
| 3 | Documenso session tests | Documenso `packages/app-tests/e2e/user/password.spec.ts:113`, `:171` | CONFIRMED |
| 4 | P6 race 002 oracle | P6 `tests/documenso/races/doc-race-002-double-submit.spec.ts:40-48` | CONFIRMED |
| 5 | Twenty passthrough names; `LOGIC_FUNCTION_TYPE` absent | harness `src/adapters/twenty-passthrough.ts:5-12`; `twenty-rate-limits.ts:7-14`; grep `LOGIC_FUNCTION_TYPE` in `src/`: none | CONFIRMED |
| 6 | Twenty captcha with no driver returns success | Twenty `7cbdfec6` `packages/twenty-server/src/engine/core-modules/captcha/captcha.service.ts:12-18`; grep `CAPTCHA` in harness `src/`: none | CONFIRMED on source; image UNPROBED |
| 7 | Twenty logic timeouts | `logic-function.entity.ts:23` (300), `:64-65` (1..900); `create-logic-function-from-source.input.ts:51-52`; `local.driver.ts:114` (`timeoutMs = 900_000` default parameter) | CONFIRMED; termination UNPROBED |
| 8 | B-P21: API key cannot create or activate a workflow version | P2 `docs/probes/2026-11-03-p2-lane-tw-probes.md:42` | CONFIRMED (doc evidence) |
| 9 | Cal OAuth: admin-only `createClient`; INACTIVE_ADMIN; seed client only from env with `enablePkce: false` | Cal `_router.tsx:23`, `:32`; `next-auth-options.ts:254`, `:264`, `:270`; `scripts/seed.ts:1015-1016`, `:1018` (`if (clientId && clientSecret)`), `:1019`, `:1026` (`enablePkce: false`) | CONFIRMED |
| 10 | Cal members CSV is client-side in org members table | Cal `UserListTable.tsx:657`, `:760`; `csvUtils.ts:1`, `:33`, `:40`, `:49` | CONFIRMED |
| 11 | Cal throttle 120 per 60 s per key; public-booking helper no-op without `UNKEY_ROOT_KEY` | Cal `apps/api/v2/src/lib/throttler-guard.ts:36` (default 120), default TTL 60 s; Cal `packages/lib/rateLimit.ts:35-43` (returns success when `UNKEY_ROOT_KEY` unset) | CONFIRMED for throttler and helper; booking call path UNREAD |
| 12 | Medusa RBAC flag and harness backend env | Medusa core `packages/medusa/src/feature-flags/rbac.ts:3-7` (`default_val: false`, `env_key: "MEDUSA_FF_RBAC"`); harness `src/adapters/medusa.adapter.ts:276-282` | CONFIRMED; `medusa-env.ts` UNREAD |
| 13 | `GET /store/orders/:id` unauthenticated by design | Medusa core `api/store/orders/middlewares.ts:30-37` (only `validateAndTransformQuery`); `:19-21` (list route authenticated); `[id]/route.ts` header comment | CONFIRMED |
| 14 | Stripe default tolerance 5 minutes; stripe-node 300 s | docs.stripe.com/webhooks text "Our libraries have a default tolerance of 5 minutes"; stripe-node `v23.0.1` `src/Webhooks.ts:142` | CONFIRMED (Stripe). Daily tolerance UNVERIFIED. |
| 15 | P2 reusable kit: Daily signer, verifier, reach, roles | P2 `src/webhooks/sign.ts:87`, `:105`; `verify.ts:102`; `reach.ts:25`, `:29`; `src/db/roles.ts:12-13` | CONFIRMED |
| 16 | Rulesets empty; secret scanning and push protection stated; code scanning and Actions permissions unreadable without auth | `GET /repos/Jayami123/appsec-devsecops-pipeline/rulesets` → `[]` | Rulesets CONFIRMED; others UNREAD |
| 17 | P2 CAL-DLY tests: `:23-40` negative (tampered body with old signature → 403 `Signature does not match`); `:42-60` valid signature accepted by signature check, downstream 400 `Invalid Payload`; `:63-79` unknown type with valid signature → 200 | P2 `99a2fde` `tests/webhooks/cal/cal-dly.spec.ts:23-40, 42-60, 63-79` (lines read in r2 and r3) | CONFIRMED (authenticity only; residual random/forged signature values UNCOVERED) |
| 18 | Medusa cart middlewares: `GET /store/carts/:id` only query validation; `POST /store/carts/:id/customer` the only cart matcher with customer `authenticate` (line 63); line-item, promotion, tax, shipping and complete routes show no authenticate in the grep | Medusa core `v2.21.2` `api/store/carts/middlewares.ts` (matchers and `authenticate` grep, r3) | CONFIRMED for middleware; handler ownership UNPROBED |
| 19 | Cal normal seed inherits env | harness `src/adapters/cal.adapter.ts:977-981` (`runCapture(resolveYarn(), ["db-seed"], …)`); `src/internal/run.ts:100-102` (`env: { ...process.env, ...options.env }`) | CONFIRMED (no pass-through needed for seed vars). Whether the harness sets `SEED_OAUTH2_*`: UNPROBED. |
| 20 | Twenty limiter layers and spender scope | Twenty `usage-limit-definitions.constant.ts:9-46` (API-key speed windows via `API_RATE_LIMITING_SHORT_*` and `API_RATE_LIMITING_LONG_*`; application window via `APPLICATION_API_RATE_LIMITING_*`; `allowedSpenderTypes: ['apiKey','application']`; `spenderId: ''`); `constants/try-consume-token-buckets-script.constant.ts:7-15` (token-bucket try-consume script); P6 `limiter-profile.ts:6-8` (binding claim) | CONFIRMED (structure). Request-versus-operation counting under GraphQL batching: UNPROBED. Setup consumption and window rollover: UNPROBED. |
| 21 | Harness has only a whole-stack volume reset | harness `src/adapters/twenty-env.ts:137` (`twentyVolumeResetCommand`, `down -v`), `:218`, `:251` (`TWENTY_DOWN_VOLUMES=1`). No product-scoped reset in `src/adapters/*.ts` reset grep. | CONFIRMED (no scoped reset exists) |
| 22 | P2 bootstrap writes Cal `.env` with generated secrets | P2 `99a2fde` `scripts/bootstrap.sh:139-149` (`prepare_cal_env`: copies `.env.example`, writes `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`) | CONFIRMED. The revised plan does not vendor this function; fork `.env` provisioning is harness-owned (plan section 10.4). |
| 23 | P2 Documenso CI dual runtime | P2 `99a2fde` `.github/workflows/p2-doc.yml:57-96`: Node 22 via `.nvmrc` with `NODE22=$(command -v node)` in `GITHUB_ENV`; Node 24 via setup-node `node-version: 24` with `NODE24=$(command -v node)`; `bootstrap.sh documenso` run with `NODE24` set | CONFIRMED |
| 24 | P2 bootstrap needs a usable Node 24 before Documenso `npm ci` | P2 `99a2fde` `scripts/bootstrap.sh:117-128` (`install_documenso_deps`: `NODE24` default `/opt/node24/bin/node`; exits 1 if not executable) | CONFIRMED |
| 25 | P2 Cursor start calls receiver-hostname script and `npm run qa:passwords` with warning fallbacks | P2 `99a2fde` `.cursor/environment.json` (`start` value) | CONFIRMED |
| 26 | Claude attribution: `sessionUrl: false` documented; requires Claude Code ≥ 2.1.281; official text says to use empty `commit` and `pr` plus `sessionUrl: false` rather than `includeCoAuthoredBy` | `https://code.claude.com/docs/en/settings-reference` (fetched this revision; attribution section contains `sessionUrl` and the 2.1.281 note) | CONFIRMED (documented). Effective behaviour in this environment: UNPROBED (plan step F0-1.9). |
| 27 | CodeQL advanced setup vs default setup; public SARIF; public permissions | GitHub documentation as reported by the review (advanced-setup and SARIF pages) | CONFIRMED-REVIEW (not re-read here) |
| 28 | Reusable workflows cannot elevate token permissions | GitHub documentation as reported by the review | CONFIRMED-REVIEW |

## 3. Additional checks (not plan section 2)

| Check | Evidence | Status |
|---|---|---|
| Harness `PRODUCTS_ROOT` default is inside the installed package | harness `src/config.ts:151` (`path.join(HARNESS_ROOT, "..", "products")`) | CONFIRMED |
| P2 CI `PRODUCTS_ROOT` workspace-relative | P2 `99a2fde` `.github/workflows/p2-tw.yml` env (`${{ github.workspace }}/../products`) | CONFIRMED |
| P2 kit import edges (for the closure in plan section 7.2) | P2 `99a2fde` `src/db/pg.ts:2` (`dbStatementTimeoutMs`, `roleDbUrl`, `ProductId` from `../env.ts`); `src/readiness/checks.ts:4` (`ProductId`); `src/db/roles-admin.ts:2` (`dbUrl`, `loadEnv`, `ProductId`); `src/db/fixture-allowlist.ts:1` (`ProductId` type); `src/webhooks/reach.ts:1`; `src/invariants/engine.ts:1-3`; `src/webhooks/receiver.ts:6` (`RUN_PREFIX_PATTERN`) | CONFIRMED |
| P2 env exports used by the closure | P2 `src/env.ts:4` (`ProductId`), `:54-84` (`CAL_BASE_URL`, `CAL_API_BASE_URL`, `*_DB_URL`, `P2_RECEIVER_HOSTS`, `P2_RECEIVER_PORT`, `P2_QA_RO_PASSWORD`, `P2_QA_FIXTURE_PASSWORD`, `P2_DB_STATEMENT_TIMEOUT_MS`), `:102-109` (maps), `:116-150` (`apiBaseUrl`, `dbUrl`, `dbStatementTimeoutMs`, `receiverConfig`, `roleDbUrl`) | CONFIRMED |
| P2 known-defect guard exemption | P2 `src/ci/known-defect-guard.ts:9` (`EXEMPT_FILE = "src/ci/known-defect.ts"`), `:125` (filter) | CONFIRMED (plan adapts to `src/kit/ci/known-defect.ts`) |
| P2 known-defect test imports | P2 `tests/unit/ci/known-defect.test.ts:4`, `:10`, `:128` (imports of `src/ci/known-defect*.ts`); `:65`, `:74`, `:100`, `:116` are string literals used as guard inputs, not imports | CONFIRMED |
| P2 script import | P2 `scripts/write-ci-job-summary.ts:10` (`../src/ci/playwright-json-summary.ts`) | CONFIRMED |
| P2 prefix pattern | P2 `src/run/prefix.ts:4-5` (`p2-qa-…`, `P2_RUN_ID`) | CONFIRMED |
| P2 action pins | P2 `ci.yml`, `api.yml`, `p2-doc.yml`: `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`; `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0` | CONFIRMED |
| P2 timeouts | P2 `p2-cal.yml:31` (30); `p2-tw.yml` tw-api (30); `api.yml` check/unit (10) | CONFIRMED |
| P6 evidence-release permissions | P6 `.github/workflows/evidence-release.yml:19-20` (workflow read), `:25` (`timeout-minutes: 30`), `:29-30` (job write) | CONFIRMED |
| P6 findings shape | P6 `docs/findings.json`: `schema` (1), 24 rows, row keys `id, aliases, product, label, severity, upstream, tests, evidence, provenance` (shape only; no text copied) | CONFIRMED |
| Medusa core lock pin | starter `apps/backend/package.json:32`, `pnpm-lock.yaml:1672` (`@medusajs/medusa` 2.21.2) | CONFIRMED |
| PR #1 body footer | The live PR body ends with a generated-attribution/session footer (found by the review) | CONFIRMED-REVIEW. This revision does not edit the body; removal needs owner authorization. |
| P1 master-plan identity for MI-14 | Recorded by the review at its original line; not present in this repository | UNREAD in this revision |

## 4. Stale or corrected statements in the PR #1 body and plan r1

| Earlier statement | Correct statement |
|---|---|
| "Six budget values" for Documenso | Seven cited values, including `ai` 3 (fact 2) |
| Cal OAuth route `/v2/auth/oauth2/token` | The correct route is `/api/v2/auth/oauth2/token` (fact 9; e2e spec `oauth2.controller.e2e-spec.ts:52`). The plan's route text is corrected. |
| "Twenty `local.driver` hard cap 900000 ms" | A default parameter (fact 7). Effective termination is UNPROBED. |
| "`sessionUrl` not in P2 and unverified" | Documented by the official settings reference (fact 26). The P2 file lacks the key; the plan adds it and verifies effective output. |
| "Documenso bypass at ~297-299" | `297-298` (fact 1) |
| "Harness `v0.3.0` turns limits off" (P2 roadmap) | Stale (fact 1) |
| PR body: "checklist says no footer" | The live body contains a generated-attribution/session footer (review); removal requires authorization. |
| Cal seed "solves OAuth" | Normal seed inherits env (fact 19), but its client has PKCE off (fact 9); OAUTH-002 cannot rely on it |
| Medusa cart GET 403/404 assumed | Protected-operation semantics unproven; cart GET lacks customer auth at the pin (fact 18). The oracle waits for probe P-10. |
| RL-002 as 101 per user | Restored as one attempt per throwaway account plus a separate enumeration analysis (r2) |
| DOC-RL-003 cited as verify/resend routes | Corrected to file upload max 20 (`limiter-contract.ts:19`) (r3) |
| CAL-WH-004 cited as acceptance | Corrected to negative tampered-body validation `:23-40` (r3) |
| MED-AUTHZ-001 fallback 'B cannot mutate A's cart' | Removed. Protected candidate is `POST /store/carts/:id/customer`; probe decides (r3) |

## 5. UNREAD and UNPROBED (carried into the plan's probe-first list)

- Secret scanning and push protection effective state; code scanning default setup; Actions default token permissions (owner step; not readable anonymously).
- Harness `src/adapters/medusa-env.ts` contents (P-11).
- Cal booking call path for the Unkey helper (P-6).
- Twenty `v2.44.0` runtime: captcha, layer values, workspace sign-up for throwaway users (P-4).
- Twenty counting unit under GraphQL batching, setup consumption per key, and window rollover (P-9).
- Twenty per-function termination with the harness opt-in (P-7).
- Cal normal-seed OAuth client creation and PKCE-client creation through normal routes (P-5); organisation for CSV; `NEXT_PUBLIC_IS_E2E` not set.
- Documenso OIDC mock IdP reachability (P-8).
- Medusa cart and address route protection and admin/customer creation paths (P-10, P-14).
- Cal mail catcher (P-13). Canary presence proof (P-12). Harness `.env` provisioning path for Cal (P-15).
- Claude attribution effective output with the minimum version (P-2). Node 24 provisioning from the approved host (P-3).
- Multi-repository hook and settings loading order (plan section 10.5).
- NIST SP 800-63B-4 section and wording behind the 100-attempt ceiling (plan section 8): not verified in this revision.
- Schemathesis CLI option names at the pinned version (plan section 8).
- Actions pins for CodeQL, SARIF upload, gitleaks, OSV, Trivy, Syft, ZAP, zizmor and actionlint's checksum (plan section 9.4): resolved at build time.

## 6. Private detail withheld

Yes. Private items are recorded only as IDs and status (plan section 4.7). No title, mechanism, route, payload, literal, test name, fixture or commit text from any private item is present in this record.

## 7. Checks performed in revision r3 (docs-only; no product, harness, CI or settings action)

| Check | How | Result |
|---|---|---|
| P2 Cal webhook negative and acceptance tests | `git show 99a2fde:tests/webhooks/cal/cal-dly.spec.ts`, lines 1-40 read; lines 38-80 read in r2 | Negative tampered-body 403 test in `:23-40`; acceptance test in `:42-60`; unknown-type test in `:63-79`. CONFIRMED. |
| P6 limiter route table | `git show 0533e61:src/load/spike/limiter-contract.ts`, lines 14-22 read | `upload` at line 19 (max 20); `ai` at line 20 (max 3). CONFIRMED. |
| Medusa cart route protection | `grep` of matchers and `authenticate` in `packages/medusa/src/api/store/carts/middlewares.ts` at `v2.21.2` (sparse fetch from r2) | Only `POST /store/carts/:id/customer` (line 60-63) has customer authenticate. CONFIRMED for middleware only; handler ownership UNPROBED. |
| P2 db-roles imports | `git show 99a2fde:scripts/db-roles.ts`, lines 1-4 | Imports `../src/env.ts` (line 3) and `../src/db/roles-admin.ts` (line 4); the closure now names the kit paths. CONFIRMED. |
| Plan and record arithmetic | Mechanical counts over the edited files | KEEP 64, ALIAS 10, DROP 2, Playwright projects 13, F0-2 unit tests 31, F0-3 unit tests 42, F0-4 ledger tests 8. Derived from listed names; not a test run. |

Not performed in r3: no product stack, no harness run, no CI or scanner run, no settings or account change, no send, no merge, no PR-body edit. Live CI status for the existing PR is not re-read here.

## 2.1 F0-2 re-check of section 2 at the pinned refs (P-1)

Method: each cited path was read by raw URL at its pinned ref (P2 `99a2fde`, harness `v0.3.1`, P6 `0533e61`, Documenso `f4105e47`, Twenty `7cbdfec6`, Cal `c2b7ac44`, Medusa core `v2.21.2`, Medusa starter `f677db43`, stripe-node `v23.0.1`) and the cited lines were printed and compared with the claim. Code search was used only where the index was known to cover the repository; its control query failed for the harness, so no absence claim rests on search.

Legend: CONFIRMED = cited lines support the claim. UNREAD = not re-checked here (path not established at the pin, or external setting or documentation not read). CONTRADICTS = the pinned ref does not support the cited evidence. Line offsets of one line are noted and are not findings.

| # | Re-check status | Evidence at pin (file:line) | Note |
|---|---|---|---|
| 1 | CONFIRMED | harness `v0.3.1` `src/adapters/documenso-env.ts:297-298` | Exact condition |
| 2 | CONFIRMED | P6 `0533e61` `src/load/spike/limiter-contract.ts:19` (upload 20), `:20` (ai 3), `:26` (authorize 10), `:31-33`, `:38-40`, `:45-47`, `:52-54` | Values match the cited ranges |
| 3 | CONFIRMED | Documenso `f4105e47` `packages/app-tests/e2e/user/password.spec.ts:113`, `:171` | Test titles at the cited lines |
| 4 | CONFIRMED | P6 `0533e61` `tests/documenso/races/doc-race-002-double-submit.spec.ts:40-48` | Oracle lines |
| 5 | UNREAD (absence part) | harness `v0.3.1` `src/adapters/twenty-passthrough.ts:5-12`, `twenty-rate-limits.ts:7-14` read; `LOGIC_FUNCTION_TYPE` absent from the listed names | Absence from `src/` not checked: code search control failed |
| 6 | CONFIRMED (source); harness absence UNREAD | Twenty `7cbdfec6` `packages/twenty-server/src/engine/core-modules/captcha/captcha.service.ts:12-18` | Image behaviour UNPROBED per record |
| 7 | UNREAD | Twenty `logic-function.entity.ts`, `create-logic-function-from-source.input.ts`, `local.driver.ts` | Full paths not in the record; not discoverable without tree access |
| 8 | CONFIRMED | P2 `99a2fde` `docs/probes/2026-11-03-p2-lane-tw-probes.md:42` | Row shows `createWorkflowVersion` FORBIDDEN for the API key and core mutations absent from its schema |
| 9 | CONFIRMED (partly) | Cal `c2b7ac44` `packages/features/auth/lib/next-auth-options.ts:254-270`; `scripts/seed.ts:1015-1026` | `apps/web/app/_router.tsx` (cited `:23`, `:32`) does not exist at the pin: UNREAD |
| 10 | CONFIRMED (CSV); UNREAD (table) | Cal `packages/lib/csvUtils.ts:1`, `:33`, `:40`, `:49` | `UserListTable.tsx` path not found at the pin: UNREAD |
| 11 | CONFIRMED | Cal `apps/api/v2/src/lib/throttler-guard.ts:36` (default 120), `:34` (60 s default TTL); `packages/lib/rateLimit.ts:36-41` (no-op without `UNKEY_ROOT_KEY`) | Booking call path UNREAD (as recorded) |
| 12 | CONFIRMED (rbac and harness env range); UNREAD (medusa-env, absence) | Medusa `v2.21.2` `packages/medusa/src/feature-flags/rbac.ts:5-6`; harness `src/adapters/medusa.adapter.ts:276-282` (`backendProcessEnv`) | `MEDUSA_FF_RBAC` absence from harness not checked |
| 13 | CONFIRMED | Medusa `v2.21.2` `packages/medusa/src/api/store/orders/middlewares.ts:17-27` (list, authenticated), `:28-37` (`/store/orders/:id`, query validation only) | |
| 14 | CONFIRMED (stripe-node); UNREAD (Stripe documentation sentence) | stripe-node `v23.0.1` `src/Webhooks.ts:142` (`DEFAULT_TOLERANCE: 300`) | Daily tolerance UNVERIFIED (as recorded) |
| 15 | CONFIRMED | P2 `99a2fde` `src/webhooks/sign.ts:87`, `:105`; `verify.ts:102`; `reach.ts:25`, `:29`; `src/db/roles.ts:12-13` | |
| 16 | UNREAD | Repository rulesets, secret scanning, code scanning and Actions permissions are settings, not read in this pass | Owner settings check (plan section 12) |
| 17 | CONFIRMED | P2 `99a2fde` `tests/webhooks/cal/cal-dly.spec.ts:23-40`, `:42-60`, `:63-79` | Authenticity only, as recorded |
| 18 | CONFIRMED (middleware) | Medusa `v2.21.2` `packages/medusa/src/api/store/carts/middlewares.ts:60-63` (`POST /store/carts/:id/customer` with `authenticate`) | Handler ownership UNPROBED (as recorded) |
| 19 | CONFIRMED | harness `src/adapters/cal.adapter.ts:977-981`; `src/internal/run.ts:100-102` | `SEED_OAUTH2_*` pass-through UNPROBED (as recorded) |
| 20 | **CONTRADICTS** | P6 `0533e61`: `src/load/spike/limiter-profile.ts` returns not found at the cited path. `limiter-contract.ts` (lines 1-12) does not import a profile module. Code search for `limiter-profile` in the P6 repository found no P6 file. Twenty `usage-limit-definitions.constant.ts` not found at the recorded path | Binding claim (P6 `limiter-profile.ts:6-8`) and the matching §8 `TW_LIMITER_LAYERS` citation (`:10-17`) have no pinned source. **STOP** per plan section 15 until the plan owner supplies the correct pinned path or retracts the citation. |
| 21 | CONFIRMED | harness `src/adapters/twenty-env.ts:137`, `:218`, `:251` | No product-scoped reset in the cited lines |
| 22 | CONFIRMED (range off by one) | P2 `99a2fde` `scripts/bootstrap.sh:138-148` (`prepare_cal_env`) | Cited 139-149 |
| 23 | CONFIRMED | P2 `99a2fde` `.github/workflows/p2-doc.yml:57-96` | |
| 24 | CONFIRMED (range off by one) | P2 `99a2fde` `scripts/bootstrap.sh:116-127` (`install_documenso_deps`, default `/opt/node24/bin/node` at `:120`) | Cited 117-128 |
| 25 | CONFIRMED | P2 `99a2fde` `.cursor/environment.json:6` (`start` calls the receiver script and `qa:passwords`) | |
| 26 | UNREAD | Claude Code settings documentation | External documentation, not re-read here |
| 27 | UNREAD | GitHub CodeQL documentation | External documentation, not re-read here |
| 28 | UNREAD | GitHub reusable-workflow documentation | External documentation, not re-read here |

**Result: one CONTRADICTS (fact 20). Work stopped per plan section 15.** Facts 5, 6, 7, 9, 10, 12, 16 and 26-28 have UNREAD parts recorded above. None of them blocks the code work listed in this record, but none may be cited as CONFIRMED.
