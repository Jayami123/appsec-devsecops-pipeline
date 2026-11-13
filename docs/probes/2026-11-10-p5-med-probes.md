# P5 L-MED probe record (2026-11-10)

Scope: probe and plan only. This record changes no lane code, test, workflow or config. It starts no stack, seeds nothing, and changes no setting, ruleset or environment. No secret value was read or printed; secret inputs are recorded by name and set or unset state only.

Base: `origin/main` = `f4fe6c1` (contains F0-3 PR #4 and F0-4 PR #5, merged at `5a3a1d9`, and later PRs #6 to #8). The branch `plan/2026-11-10-p5-med` starts from `f4fe6c1`.

Citation key:

- `MP:<n>` is the master plan at `298ae29`, the numbering the brief uses (`docs/plans/2026-11-08-p5-master-plan.md` at that commit). The file on `main` is 1082 lines and differs from `298ae29` (1063 lines) by 26 insertions and 7 deletions. The differences are the D4 wording, one section 7.2.2 row, the F0-3 corrections block, the section 9 scanner text and one P5-SCAN-001 row. No L-MED row, decision or budget changed (checked with `git diff 298ae29 origin/main`).
- File references are `path:line` at the pin named in the row. Harness references are at tag `v0.3.1` (commit `7d4a3ae36100a0150397eeac1c6fefefe5e64c15`). Core references are at `@medusajs/medusa` commit `020565398e436a2bc65777a3b1ad347b4735d6df`. Fork references are at `f677db438f27294fc50e4c7c6612e71ff38eeff5`. P2 references are at `99a2fde`.

Status key: **CONFIRMED** (observed; matches the master plan or the stated expectation), **CONTRADICTS** (observed differs from the master plan; a STOP item), **UNPROBED** (not run; the reason is given), **BLOCKED** (a harness capability is not in v0.3.1; the MP wording is used), **ENV** (an environment or secret input this session does not have).

## 0. Summary

| Area | Status | Result |
|---|---|---|
| Merged contracts the lane depends on | CONFIRMED | Ledger counts 74 cases, 8 private, 0 findings, 0 accepted risks. `p5-med.yml` stub marker present. Classifier `med` regex and `med`, `med-serial` Playwright projects present (section 5). |
| P-11 and fact 12 (harness backend env) | CONFIRMED | No `MEDUSA_FF_RBAC` anywhere in the harness tree. The switch parser reads four names only. Section 2a. |
| D14 / harness item 2 (RBAC-001) | BLOCKED | `BLOCKED: MEDUSA_FF_RBAC not in harness v0.3.1 (released in v0.4.0; gated on the P5 pin-bump PR #v0.3.1 -> #v0.4.0)` (MP:803). |
| P-10 (throwaway customers and admins) | CONFIRMED on source; live UNPROBED | Customers: normal store routes need no admin. Admins: no route creates one without an existing admin session. Harness admin credentials are unset here (ENV). Section 2b. |
| P-14 and fact 18 (cart and address routes) | CONFIRMED on middleware and handler; live UNPROBED | Only `POST /store/carts/:id/customer` is customer-authenticated. Its workflow has no owner check. Address routes scope by customer. Section 2c. |
| Fact 13 (order routes) | CONFIRMED | List route authenticated; order-by-id is intentionally unauthenticated. Section 2c. |
| WH-001 and WH-002 controls (webhook path) | CONFIRMED on source; live UNPROBED | Route answers 200 before verification; the state oracle is required. `STRIPE_WEBHOOK_SECRET` is unset here (ENV). Section 2d. |
| P5-MED-WH-003 alias scope | CONFIRMED | P2 `tests/webhooks/med/signed-event.spec.ts` at `99a2fde` also covers a repeated signed delivery. Section 2d. |
| AUTHZ-002 (publishable key on admin) | CONFIRMED on source; live UNPROBED | Admin authentication accepts only a secret key. Section 2e. |
| CORS-001, HDR-001, FIELD-001 | CONFIRMED on source; live UNPROBED | Disallowed origins get no ACAO by the `cors` library rule. Store restricted fields do not include `customer`. Section 2e. |
| FUZZ-001 inputs | CONFIRMED | Schemathesis 4.33.1 option names confirmed. P2 OpenAPI file present with the recorded SHA-256. P2 has no Schemathesis run to copy. Section 2f. |
| Bootstrap for medusa | CONFIRMED | Clone at the pin; `pnpm install --frozen-lockfile` exit 0; no fork `.env` written. Section 3. |
| Live stack (`up.mjs medusa`) | ENV, not run | Docker daemon not running; harness admin and webhook secret inputs unset. Section 6. |
| Repository checks at branch head | CONFIRMED | `npm ci` exit 0; `check:static` exit 0; `unit` 346 pass, 0 fail; `list:lanes` exit 0 with 0 tests. Section 4. |
| NEW-MED-3 premise (single-use `QA10`) | CONTRADICTS | The harness seed sets no `usage_limit` (`fork ref held by the owner`). Re-scoped in the plan. Section 2g. |
| CONTRADICTS against the L-MED contract | none | Facts 12, 13, 14 and 18 are CONFIRMED. Citation and ledger corrections are recorded in section 7. |

## 1. Method and environment

| Item | Value |
|---|---|
| Node | `v22.23.4`, npm `10.9.9` (repository runtime, `.nvmrc` family 22). |
| Node 24 | `/opt/node24/bin/node` reports `v24.22.1`. It is the legacy path that `docs/cloud-environments.md:23-28` records as not selected. The medusa path does not invoke the Node 24 check (section 3). |
| Docker | Client `29.9.2`. Daemon not running (`/var/run/docker.sock` absent). `dockerd` exists; it was not started. Matches `docs/cloud-environments.md:44`. |
| Harness | Read from a shallow clone of the public repository at tag `v0.3.1`, outside this repository. Lock entry `package-lock.json:1643-1645` resolves to the same commit `7d4a3ae`. |
| Medusa core | `medusajs/medusa` at `020565398e436a2bc65777a3b1ad347b4735d6df` (OD-4), shallow fetch by full SHA, outside this repository. |
| Fork | `Jayami123/medusa-dtc-starter` at `f677db438f27294fc50e4c7c6612e71ff38eeff5` (`scripts/bootstrap.sh:15`). |
| P2 | `Jayami123/api-webhook-db-test-suite` at `99a2fdebbb60aac196fcb0fce16911e36a0d5c0a`, blobless clone. |
| Stripe packages | `stripe@15.12.0` and `stripe@23.0.1` from the npm registry into a scratch directory. Text read only. |
| Schemathesis | `4.33.1` from PyPI into a scratch virtualenv outside this repository. `--help` read only. |
| Secrets | Presence checked by name only: `STRIPE_API_KEY` set (value not read); `STRIPE_WEBHOOK_SECRET`, `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD` unset. |

## 2. Probe results

### 2a. P-11 and fact 12: harness backend environment

- CONFIRMED: a search of the whole harness tree (excluding `.git`) for `MEDUSA_FF_RBAC` returns no match.
- CONFIRMED: `src/adapters/medusa-env.ts` is readable. Its switch parser `parseMedusaHarnessSwitches` (`fork ref held by the owner`) reads `MEDUSA_REDIS`, `MEDUSA_STRIPE`, `MEDUSA_LOCK` and `MEDUSA_FF_CACHING` only. Fact 12's status "`medusa-env.ts` UNREAD" becomes CONFIRMED.
- CONFIRMED: the backend `.env` is written at `fork ref held by the owner`. `buildMedusaBackendEnvFile` (`fork ref held by the owner`) upserts `DATABASE_URL`, `REDIS_URL`, `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` into the template. The read-back is `backendProcessEnv` at `fork ref held by the owner`.
- Correction to the brief: `fork ref held by the owner` is the storefront `.env.local` writer (`fork ref held by the owner`), not the backend `.env`. Recorded in section 7.
- Result: RBAC-001 is `BLOCKED: MEDUSA_FF_RBAC not in harness v0.3.1 (released in v0.4.0; gated on the P5 pin-bump PR #v0.3.1 -> #v0.4.0)` (MP:803). The D14 gate holds.
- Second pass (section 10): the flag is present on harness `main` at commit `519dfba` (`src/adapters/medusa-env.ts:206-217`, `:271`; test at `fork ref held by the owner`). It is merged on `main` and unreleased. The owner's wording is "BLOCKED: MEDUSA_FF_RBAC not in harness v0.3.1 (merged on harness main, unreleased)".

### 2b. P-10: throwaway actors through normal routes

- Customers (CONFIRMED on source). The harness registers and logs in a store customer through `POST /auth/customer/emailpass/register` and `POST /auth/customer/emailpass` (`src/adapters/medusa-seed.ts:495`, `:525`). The profile can be created by `POST /store/customers`, which accepts an unregistered identity (`medusa` core `fork ref held by the owner`, `allowUnregistered: true`). A throwaway customer with the run prefix can therefore be made through normal routes, with no admin. Live: UNPROBED (ENV, section 6).
- Admins (CONFIRMED on source). No route creates an admin without an existing admin session. `POST /admin/invites` exists (`fork ref held by the owner`) and its query config includes `token` (`fork ref held by the owner`). Creating an invite needs an admin session.
- The only admin session the harness creates comes from `authenticate()` (`fork ref held by the owner`), which needs `MEDUSA_ADMIN_EMAIL` and `MEDUSA_ADMIN_PASSWORD` (`fork ref held by the owner`, `:1353`). Both are unset here. P5 may not generate or copy seed secrets (`AGENTS.md:27`).
- Not traced: whether invite acceptance needs the token from mail. UNPROBED.
- Result: a throwaway admin has no route without a harness admin session. P5-MED-RL-001 is gated by ENV (section 6) and its admin-login rows need an owner-provided harness admin.
- Logout: `fork ref held by the owner` exists in core. Bearer JWT revocation semantics were not traced. UNPROBED. The brief's "revoke every token before down" (MP:354) depends on it. Recorded as an open question (section 7).

### 2c. P-14 and fact 18: cart, address and order routes

**Cart middleware (CONFIRMED).** `fork ref held by the owner` (core):

| Matcher | Line | Authentication |
|---|---|---|
| `GET /store/carts/:id` | 27 | none (query validation only) |
| `POST /store/carts/:id/customer` | 61-63 | `authenticate("customer", ["session", "bearer"])` at line 63 |
| line items `POST`, `POST /:line_id`, `DELETE /:line_id` | 73, 84, 95 | none |
| promotions, taxes, shipping methods | 105, 116, 127, 138 | none |
| `POST /store/carts/:id/complete` | 149 | none |

Fact 18 is CONFIRMED: line 63 is the only cart matcher with customer authentication.

**Customer-attach handler (CONFIRMED by reading).** `fork ref held by the owner` sets `customer_id` from `req.auth_context.actor_id` (line 21) and runs `transferCartCustomerWorkflow` on `req.params.id` (lines 18-24). The handler has no ownership check.

**Transfer workflow (CONFIRMED by reading).** `fork ref held by the owner`:

- reads the cart (lines 60-73) and the caller as `customer` (lines 82-91);
- `shouldTransfer` is `cart.customer?.id !== customer.id` (lines 101-104);
- when true, writes the caller's `customer_id` and `email` onto the cart (lines 117-121) under a cart lock (lines 111-115).
- There is no check that the cart has no current customer, and none that the current customer is the caller.

Consequence for the oracle (MP:144): the repeat call by the cart's own customer is a no-op (`shouldTransfer` is false). The control must therefore be a guest cart (no customer) claimed by its own customer, which changes state from null to A. The negative is B's session on A's cart. Expected verdict: `PRODUCT BUG (SUSPECTED)` if the cart's `customer_id` changes from A to B; `PASS` if refused. Live: UNPROBED (ENV).

The line-item, GET, complete and promotion routes have no authentication. They are capability-by-cart-ID and go to the MI-5 design verdict, with no defect assumed (MP:144).

**Address routes (CONFIRMED).** `/store/customers/me*` is authenticated (`fork ref held by the owner`). The address handlers scope by the caller's ID: GET filters on `customer_id: actor_id` (`fork ref held by the owner`, `:27`); POST runs `validateCustomerAddress` (`:50-51`) and updates with `selector: { id, customer_id }` (`:56`); `validateCustomerAddress` (`:88-109`) throws `NOT_FOUND` when no address matches the caller. Expected for B on A's address: `deny-404`. Control: A on A's address succeeds. Live: UNPROBED.

**Order routes (fact 13, CONFIRMED).**

- `fork ref held by the owner`: `GET /store/orders` is authenticated.
- `fork ref held by the owner`: the list filters on `customer_id: actor_id`. A NEW order-IDOR row on the list route is therefore expected to PASS by source. Live: UNPROBED.
- `fork ref held by the owner`: `GET /store/orders/:id` has no authentication. `fork ref held by the owner` documents this as intentional, with the order ID as the authentication mechanism. This is the MI-5 capability verdict.

### 2d. WH-001 and WH-002: webhook path, state oracle and P2 alias scope

- Route (CONFIRMED): `POST /hooks/payment/[provider]` (`medusa` core `fork ref held by the owner`). It does not verify a signature. It emits `payment.webhook_received` with `rawData` and `headers` (`:14-31`) and answers `200` (`:37`). It answers `400` only when the emit throws (`:33`).
- Consequence: the HTTP status is not the oracle for WH-001 and WH-002. The oracle is the payment or order state after a settle window.
- Subscriber (CONFIRMED): `src/subscribers/payment-webhook.ts:18-62` calls `paymentService.getWebhookActionAndData` (`:36`). It returns without running the workflow when there is no `session_id` (`:43-45`). It runs `processPaymentWorkflow` otherwise (`:62`). An invalid signature throws inside `getWebhookActionAndData`, so the subscriber fails and no state changes.
- Signature check (CONFIRMED): `fork ref held by the owner` calls `stripe.webhooks.constructEvent` with `options_.webhookSecret`.
- Queue defaults (CONFIRMED on the route): `delay` 5000 ms and `attempts` 3 (`fork ref held by the owner`), unless the payment module options override them. The fork's module options were not traced. The settle window in the lane must exceed these defaults and is a named budget (section 3 of the plan).
- Harness names (CONFIRMED): provider `pp_stripe_stripe` (`src/adapters/medusa-env.ts:31`); signing secret `STRIPE_WEBHOOK_SECRET` (`src/config.ts:66`, `:200`; `fork ref held by the owner`; server config `fork ref held by the owner`). The Stripe provider loads only with `MEDUSA_STRIPE=1` (`fork ref held by the owner`).
- Hook path segment for this provider (`stripe_stripe` or similar): UNVERIFIED. The core route is `[provider]` and the harness does not name the segment. The live probe records it.
- Stripe tolerance (CONFIRMED for two candidate versions): `Webhook.DEFAULT_TOLERANCE = 300` in `stripe@15.12.0` (`fork ref held by the owner`) and `stripe@23.0.1` (`fork ref held by the owner`). The core package declares `stripe ^15.5.0` (`fork ref held by the owner`). The version the fork resolves for the provider is UNVERIFIED (the fork lock lists `15.12.0` and `19.1.0`; `19.1.0` not checked). Fact 14 is therefore CONFIRMED for `15.12.0` and `23.0.1` and UNVERIFIED for the resolved provider version.
- Kit (CONFIRMED): `src/kit/webhooks/sign.ts:129` exports `signStripe` and `src/kit/webhooks/verify.ts:135` exports `verifyStripe` (with `toleranceSeconds`). The lane needs no new signer.
- P2 alias scope (CONFIRMED): `tests/webhooks/med/signed-event.spec.ts` at `99a2fde`. P2-MED-WH-001 delivers one signed `payment_intent.succeeded` event twice and asserts one payment session, one payment and one capture after a drain marker (lines 29-80). It requires a Stripe test-mode key to load the provider (lines 17-25). The repeat delivery is therefore also covered by P2, and the P5-MED-WH-003 ALIAS scope stays limited to the covered case (MP:200).
- Result: the WH-001 and WH-002 control (a fresh order with a valid signature changes state) needs `STRIPE_WEBHOOK_SECRET` to sign the event. It is unset here (ENV). Live: UNPROBED.

### 2e. Live-only items and store-side source reads

- **AUTHZ-002, publishable key on an admin route (CONFIRMED on source).** `fork ref held by the owner`: the `api-key` branch applies only when the actor type is exclusively `user` (admin). `getApiKeyInfo` (`:181-193`) accepts only a `Basic` Authorization header. The publishable key is read only by the store-side middleware (`fork ref held by the owner`, header `x-publishable-api-key`). Expected: a publishable key alone on an admin route is refused. Whether the status is 401 or 403 is UNPROBED. Live: UNPROBED (ENV).
- **CORS-001 (CONFIRMED on source).** Routes get CORS per route type (`fork ref held by the owner`). Origins come from `parseCorsOrigins` (`fork ref held by the owner`). The `cors` library (`cors@2.8.5`, the framework range `^2.8.5`, `fork ref held by the owner`) sets `Access-Control-Allow-Origin` to the request origin when allowed, and to `false` when not (`fork ref held by the owner`), so no ACAO header is written. The fork template sets `STORE_CORS=http://localhost:8000,https://docs.medusajs.com`, `ADMIN_CORS` and `AUTH_CORS` (`fork ref held by the owner`). Test origins are strings only; no request goes to the listed origins. Live: UNPROBED (ENV).
- **FIELD-001 (CONFIRMED on source).** The default store restricted fields are `order` and `orders` (`fork ref held by the owner`, applied at `:564-566`). `customer`, `customers` and the payment collections are commented out of the default. The fork's `fork ref held by the owner` sets no `restrictedFields`, so the default applies. Source therefore suggests that `fields=customer.*` is not restricted on store routes, including `GET /store/orders/:id`. Whether that is PASS, a design verdict (MI-5) or `PRODUCT BUG (SUSPECTED)` is decided by the live result. Live: UNPROBED (ENV).
- **HDR-001 (admin `/app` and store API headers).** Not traced in this probe. UNPROBED.
- **One throwaway order (P-14 live, FIELD-001 live).** UNPROBED (ENV).

### 2f. FUZZ-001 inputs

- CONFIRMED (Schemathesis 4.33.1, `run --help`): `--max-examples`, `--max-time`, `--workers`, `--checks`, `--exclude-checks`, `--rate-limit`, `--suppress-health-check`. `FUZZ_MAX_EXAMPLES` maps to `--max-examples`. `FUZZ_WALL_MIN` maps to `--max-time` only after its semantics are read at build time (UNVERIFIED here). MP:652 is resolved for the option name.
- Release age: `4.33.1` was uploaded on `2026-11-04T15:30:11Z`, five days before this probe. MP has no age rule for pip tools. Pin choice is an owner decision (section 9 of the plan).
- CONFIRMED: `contracts/med/upstream/store.openapi.full.yaml` at `99a2fde` has 47001 lines and SHA-256 `cc4af9d7b00fead80c8ab75bd3b2ab97fec0397086bc0d0eccc2f7cb12b7032a`, matching `contracts/med/upstream/PROVENANCE.md`. The PROVENANCE file says the tag is `v2.21.2` and the file's own `info.version` reads `2.21.1`.
- CONFIRMED: P2 at `99a2fde` has no Schemathesis run. `git grep` finds only documentation mentions (`docs/master-plan.html:364`, `docs/plans/2026-10-20-p2-phase1-roadmap.md:73`). There is no P2 command to copy.

### 2g. NEW-MED-3 premise: is the seeded promo code single-use?

- CONTRADICTS (against the proposal premise, not against an MP fact): the brief describes `QA10` as a single-use code. The harness seed creates it with `code`, `type: "standard"`, `status: "active"` and an `application_method` (`percentage`, value 10, target `order`) (`src/adapters/medusa-seed.ts:459-474`). No `usage_limit` is set there. A search of the harness `src/adapters` for `usage_limit` and `limit:` returns nothing in `medusa-seed.ts`, `fork ref held by the owner` or `medusa-env.ts`.
- Result: the NEW-MED-3 oracle "a single-use code used twice in parallel leaves one redemption" cannot be built on the seed as it is. The plan re-scopes NEW-MED-3 (plan section 3c). Per the STOP rule (`AGENTS.md` STOP 4), the row is not built on the single-use premise.

## 3. Bootstrap for medusa (CONFIRMED)

Command: `NODE24=/opt/node24/bin/node PRODUCTS_ROOT=<scratch directory outside the repository> bash scripts/bootstrap.sh medusa`. Exit `0`. Log summary:

- `cloned f677db438f27294fc50e4c7c6612e71ff38eeff5` (depth 1, the pinned SHA);
- `pnpm 10.11.1`; `pnpm install --frozen-lockfile` added 1499 packages and finished;
- warning: build scripts ignored for `@swc/core`, `esbuild`, `msgpackr-extract`, `protobufjs`, `sharp`, `unrs-resolver` (recorded; the harness sets no `MEDUSA_REBUILD_PACKAGES`, `fork ref held by the owner`);
- `fork ref held by the owner` absent after bootstrap (checked by path), so no fork `.env` was written (rule: `AGENTS.md:27`).

The Node 24 check (`scripts/bootstrap.sh:125-160`, exact `24.22.0` at `:145-146`) sits in the Documenso path. The medusa path does not reach it. `/opt/node24` at `v24.22.1` is therefore not a blocker for L-MED. The mismatch with the approved `24.22.0` (`scripts/bootstrap.sh:20`, `scripts/cloud-install.sh:22`) is already recorded as legacy in `docs/cloud-environments.md:23-28`. It affects L-DOC only.

## 4. Repository checks at the branch head

Run at `plan/2026-11-10-p5-med` after the first `npm ci`. The docs-only change does not add tests. Re-run after the deliverables were written (section 8).

| Command | Exit | Output |
|---|---|---|
| `npm ci` | 0 | 140 packages added; harness installed from the lock at `7d4a3ae`. |
| `npm run check:static` | 0 | `prettier --check .`, `eslint`, `tsc -p tsconfig.json` all pass. `docs/` is in `.prettierignore`. |
| `npm run unit` | 0 | `# tests 346`, `# suites 41`, `# pass 346`, `# fail 0`, `# cancelled 0`, `# skipped 0`, `# todo 0`. |
| `npm run list:lanes` | 0 | `Total: 0 tests in 0 files` (`--pass-with-no-tests`). |

## 5. Merged contracts the L-MED plan depends on (CONFIRMED at `f4fe6c1`)

| Contract | Location | Result |
|---|---|---|
| Ledger counts | `docs/findings/ledger.json` | 74 cases (64 planned, 8 alias, 2 dropped); 8 private entries; 0 findings; 0 accepted risks. Matches MP:296-300. |
| MED rows in the ledger | same | 11 `planned` (`P5-MED-*` KEEP rows) and 1 `alias` (`P5-MED-WH-003`, canonical `P2-MED-WH-001`, ref `99a2fde`). |
| Lane stub | `.github/workflows/p5-med.yml:1` | `# P5-STUB: remove this line when the first real job lands`. One job `stub`. |
| Gate | `.github/workflows/ci.yml:100-117` | `gate` needs `changes`, `foundation`, `p5-cal`, `p5-doc`, `p5-med`, `p5-tw`, `p5-tw-iso`, `p5-scans`, `p5-x`; runs `scripts/ci-gate.mjs`. |
| Classifier | `scripts/ci-changes.sh:22` | `re_med` covers `src/lanes/med/`, `tests/unit/lanes/med/`, `tests/(contracts|webhooks|integration|serial|ui)/med/`, and `.github/workflows/p5-med.yml`. |
| Playwright | `playwright.config.ts:27`, `:45-47` | `med` project (`{contracts,webhooks,integration}/med/**`); `med-serial` project depends on `med`. |
| Ownership | `docs/lane-ownership.md` | No entry for `docs/capabilities/` or MI-5. The directory does not exist on `main`. |
| Harness scripts | harness `scripts/up.mjs`, `scripts/down.mjs` | Both present at `v0.3.1`. Not run. |

## 6. Live stack and secret inputs (not run)

The brief's live path is `node fork ref held by the owner medusa` inside a `trap ... down.mjs` wrapper. It was not run. Reasons, each sufficient on its own:

| Item | Status | Detail |
|---|---|---|
| Docker daemon | ENV | Not running; no socket. Images the medusa stack needs: `postgres:15` (harness `docker/medusa.compose.yml:11`); `redis:7` only with `MEDUSA_REDIS=1` (harness `docker/medusa.redis.compose.yml:4`). |
| Harness admin credentials | ENV | `MEDUSA_ADMIN_EMAIL` and `MEDUSA_ADMIN_PASSWORD` are unset. The harness seed needs them (`fork ref held by the owner`). P5 may not generate them (`AGENTS.md:27`). |
| Webhook signing secret | ENV | `STRIPE_WEBHOOK_SECRET` is unset. The WH-001 and WH-002 controls cannot sign a valid event without it. `STRIPE_API_KEY` is set (name only); the Stripe switch `MEDUSA_STRIPE=1` is also needed. |

Because no stack was started, there is no readiness output, no `up` exit code and no `down` output to record. No token or key was created, so nothing needed revocation.

## 7. Recorded corrections

1. **Brief citation.** `fork ref held by the owner` is the storefront `.env.local` writer. The backend `.env` writer is `fork ref held by the owner`.
2. **Brief citation.** The master plan numbering in the brief is `298ae29`. The file on `main` differs from it (section 0 of this record). The L-MED rows are unchanged.
3. **Fact 12.** `medusa-env.ts` is read at `v0.3.1` and has no `MEDUSA_FF_RBAC`. Status changes from UNREAD to CONFIRMED.
4. **Fact 18.** Handler ownership checks were UNPROBED. The transfer handler and workflow have no owner check, so AUTHZ-001's oracle is the state change (section 2c). Address handlers scope by customer, so AUTHZ-003's oracle is `deny-404`.
5. **MI-5 owner.** `docs/capabilities/` does not exist and `docs/lane-ownership.md` has no MI-5 row. Proposed owner: L-MED, with L-CAL citing it (MP:926). The ownership row is a foundation change (section 3b of the plan).
6. **RL-001 job.** `med-serial` exists (`playwright.config.ts:45-47`) and the classifier covers `tests/serial/med/` (`scripts/ci-changes.sh:22`). Proposed: `med-serial` for RL-001 in the same `p5-med.yml` (plan section 5).
7. **FUZZ-001 source path.** No P5 destination for the OpenAPI file. Proposed: `src/lanes/med/contracts/`, vendored with a PROVENANCE manifest (MP:360-369; plan section 3b).
8. **Throwaway admin.** MP does not specify the route (MP:350). Probed result: none without a harness admin session (section 2b). Recorded as the RL-001 gate.
9. **Ledger status for RBAC-001.** `docs/findings/ledger.json` records `P5-MED-RBAC-001` as `planned` with no blocker. D14 (MP:84) and the schema (`status: gated` requires a blocker) say `gated`. Proposed foundation change: status `gated`, blocker `BLOCKED: harness item 2 not in harness v0.3.1`. Not made in this PR, because the ledger is foundation-owned.
10. **Bearer revocation (open question).** MP:354 requires revoking created tokens before `down`. The logout route exists (`fork ref held by the owner`), but bearer JWT revocation semantics were not traced. Owner or foundation decision needed before RL and customer rows rely on it.

## 8. Redaction and checks

- No secret value was read or printed. Names and set or unset states only.
- No artefact was uploaded. No token was created.
- Repository checks in section 4 were re-run after the deliverables were written. The counts are unchanged (docs-only change).

## 9. STOP and CONTRADICTS log

- **CONTRADICTS (NEW proposal premise):** NEW-MED-3 assumes `QA10` is single-use. The harness seed sets no `usage_limit` (section 2g). The row is re-scoped in the plan and is not built on the single-use oracle.
- **CONTRADICTS (against the L-MED contract):** none. Facts 12, 13, 14 and 18 are CONFIRMED.
- **STOP (live):** the live stack was not started. Docker is not running (STOP item 8), and the harness admin credentials and webhook secret are not present (STOP item 3). P5 may not generate seed secrets (`AGENTS.md:27`). The source work and the plan proceed because they do not depend on the live stack.
- **Recorded, not L-MED:** `/opt/node24` reports `v24.22.1` against the approved `24.22.0`. The contract is `docs/cloud-environments.md:23-28`; the bootstrap check is `scripts/bootstrap.sh:145-146`. Affects L-DOC only.

## 10. Second pass: owner decisions D-MED-1 to D-MED-9 (source checks, no live run)

Scope: source reads and scratch computations only. No stack, no Docker, no secret read. Every value below is a path and line at the pin named.

### 10a. RBAC on harness main (owner item 12)

- Harness `main` at `519dfba` (shallow clone, outside the repo). `MEDUSA_FF_RBAC` is read by `src/adapters/medusa-env.ts:206-217` (`MEDUSA_FF_RBAC_VALUES`, parser with `MEDUSA_FF_RBAC_INVALID`) and written at `:271`. The test is at `src/adapters/medusa.adapter.test.ts:11`.
- Tag `v0.3.1` (`7d4a3ae`) has no reference. Status: merged on harness main, unreleased.
- Update (2026-11-10): released in v0.4.0 (31cafc0), VERIFIED.

### 10b. Core v2.21.2 routes for D-MED-3, D-MED-4, D-MED-6 (method names confirmed; body enums UNVERIFIED)

| Need | Route (file) | Method |
|---|---|---|
| Create publishable key | `fork ref held by the owner` | POST |
| Link sales channel | `fork ref held by the owner` | POST |
| Revoke key | `fork ref held by the owner` | POST |
| Delete key | `fork ref held by the owner` | DELETE |
| Create invite | `fork ref held by the owner` | POST; body `email`, `roles` (`fork ref held by the owner`) |
| Accept invite | `fork ref held by the owner` | POST; `AUTHENTICATE = false` (`:42`); token from query (`filterableFields.token`, `:16`); user from body (`:18`) |
| Delete admin user | `fork ref held by the owner` | DELETE |
| Delete customer (admin) | `fork ref held by the owner` | DELETE |
| Logout session | `fork ref held by the owner` | DELETE |

- API key `type` is `z.nativeEnum(ApiKeyType)` (`fork ref held by the owner`). The enum value `publishable` is **UNVERIFIED** (the enum definition was not read).
- Invite token appears in the query config (`fork ref held by the owner`). Whether the create response returns it is UNVERIFIED.
- Accept flow: the invitee must hold an authenticated identity (`auth_context.auth_identity_id`, `fork ref held by the owner`). The register step that creates it is not traced: UNVERIFIED.

### 10c. System payment provider (D-MED-1 fixture option)

- `fork ref held by the owner`: `static identifier = "system"`. The class exists in the payment module.
- Whether a seeded region exposes it, and the provider ID string, are **UNVERIFIED** (live P-10 needed).

### 10d. Session hook (owner item 11 correction)

- `.claude/hooks/session-start.sh:3`: "POST-SETUP ONLY. It never installs, repairs, downloads, clones, or starts a product or Docker." A search of the file finds no Docker check. The earlier plan text that said the hook checks Docker was wrong and is corrected in the plan (section 3g).

### 10e. Harness export surface for the lane (D-MED-2, D-MED-6)

- Harness `main` `src/index.ts` exports `getAdapter` (registry), `NotImplementedError`, `createPgClient`, data factories, and a Twenty helper. It does not export `MedusaAdapter` or `authenticate()` by name. Whether `getAdapter("medusa")` exposes `authenticate()` to a lane is **UNVERIFIED**. Fallback: harness request H3 in the plan.

### 10f. Playwright CLI (owner item 10)

- The installed `@playwright/test` (from `npm ci`) lists `--no-deps  Do not run project dependencies` (`npx playwright test --help`). CONFIRMED for the pinned version. Recheck at build.

### 10g. Schemathesis shared lock (D-MED-5)

- Generated in scratch with `pip-compile --generate-hashes` for `schemathesis==4.33.1` (Python 3.13, scratch virtualenv outside the repo).
- Result: NOT GENERATED. Attempt 1 was terminated before it wrote a lock. Attempt 2 (`timeout 1700`, verbose log) exited 124 (timed out) with no lock written. The resolution through the package proxy did not complete in this session. Status: UNVERIFIED that hashed resolution completes here. D-MED-5 stays open until the foundation PR generates `requirements/p5-tools.lock` with `pip-compile --generate-hashes` on a host where it completes. No digest is recorded.
- The lock file is not committed here. The proposed path is `requirements/p5-tools.lock`; the foundation PR names the file and generates it.

### 10h. Stripe key handling (D-MED-1)

- Presence was checked by name only earlier (`STRIPE_API_KEY` set; value never read). The prefix guard in the plan accepts `rk_test_` or `sk_test_` and never prints the value. No Stripe request was made by this probe.
