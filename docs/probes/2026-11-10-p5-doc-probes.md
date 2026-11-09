# P5 L-DOC probe record (2026-11-10)

Scope: probe and plan only for the Documenso lane (L-DOC). This record builds no lane code, test, workflow or config. It starts no product stack by hand. It seeds nothing, changes no setting, environment or ruleset, and writes no fork `.env`. The only outbound change is the plan branch.

Base: `origin/main` = `f4fe6c177d7585633921b4a44ff5849cd601a132` (F0-3 and F0-4 merged; the merged files are read in plan section 0). Master plan references are `MP:<line>` at revision `298ae29`, the revision the build brief cites. `origin/main` carries a later revision of the same file (commit `54f4ffc`, the recorded master-plan corrections). That revision adds lines after MP:502 and inside the F0-3 block, so its line numbers differ from 298ae29 from about MP:560 on. The cited content is the same in both (the diff was read for every cited section).

Redaction: no secret, token, password, cookie or seed value is printed or stored here. Probe actors were not created (the stack did not start), so there are no run prefixes or credentials to revoke. Log excerpts below show exit codes and error text only.

Status key: **CONFIRMED** (observed or read at the pin, matches the plan), **CONTRADICTS** (observed differs from the plan; stop item), **UNPROBED** (not run, reason given), **BLOCKED: <item> not in harness v0.3.1** (the MP:807 form, for items the harness cannot do at v0.3.1).

## 0. Summary

| Area | Status | Result |
|---|---|---|
| 3a Runtime (Node 22 and Node 24) | CONFIRMED for the runtime; stack UNPROBED | NODE22 `/opt/node22/bin/node` (v22.23.4). NODE24 `/root/.cache/qa-portfolio/toolchains/node/24.22.0/bin/node` (v24.22.0, npm 11.19.1), provisioned by the repo setup contract (section 2, step 4). `up.mjs documenso` exit 1 and `down.mjs documenso` exit 1, both because no Docker daemon exists (ENV, build-brief STOP 8). |
| 3b Rate-limit state with the bypass unset | Source CONFIRMED; live check UNPROBED | Unset means the harness forwards nothing (`documenso-env.ts:297-298`) and the product bypass branch is not taken (`rate-limit.ts:73`), so the limiter is enforced in source. The live max+1 request needs a running stack (UNPROBED: Docker). |
| 3c P-8 mock IdP through normal harness routes | BLOCKED: mock IdP not in harness v0.3.1 | No OIDC, OpenID, IdP or OAuth code in the harness `src/` at tag v0.3.1 (grep, section 3). OIDC-001 and OIDC-002 stay gated (D9). |
| 3d Actor creation (throwaway users, second organisation, team templates) | BLOCKED for a harness route; product routes CONFIRMED to exist, live use UNPROBED | Harness v0.3.1 seeds one example user and needs a manually created API token (`documenso.adapter.ts:578-580`, `:636-644`). Product routes exist at the pin (section 3, row D1-D4). Their behaviour is UNPROBED (no stack). |
| 3e Alias sources (P6 and Documenso) | CONFIRMED | Every cited line exists and says what the plan says (section 3, rows E1-E4). |
| 3f Webhook URL guard (PN-1) | CONFIRMED in source; live UNPROBED | Create-time and execute-time refusals exist at the pin (section 3, rows F1-F4). The owner canary is absent, so PN-1 stays gated. |
| 3g Verdict sources MI-1, MI-2, MI-12, MI-13 | CONFIRMED at 99a2fde | Each verdict cites a P2 test or record that exists at 99a2fde (section 3, row G1-G6). |
| Section 4 NEW-DOC-6 webhook signature | CONFIRMED in source; premise corrected | `X-Documenso-Secret` is a shared secret echoed as a header, not an HMAC. The vendored verifier checks equality (section 3, row F5). |
| Section 4 NEW-DOC-1..5 | UNPROBED | Need a running stack and throwaway actors (section 5). |
| Ledger status of P5-DOC-OIDC-001 and P5-DOC-OIDC-002 | **CONTRADICTS** | `docs/findings/ledger.json` lines 173 and 181 say `planned`. The plan says gated: MP:334, KEEP rows MP:140-141, and 19.2 rows MP:958-959 (all at 298ae29; OD-16 at MP:107). MP:296 (section 4.8) says every KEEP row is `planned`, so the master plan is internally inconsistent here. Stop item for those two rows (section 6). |
| Fact 1 wording ("default ON") | CONFIRMED mechanism; wording corrected | The bypass is forwarded and honoured only when the variable is exactly `"true"`. "Default ON" is not what the source does (section 4). |

## 1. Method and environment

| Item | Value |
|---|---|
| Repository | `/home/user/appsec-devsecops-pipeline`, branch `plan/2026-11-10-p5-doc` from `origin/main` (`f4fe6c1`). The branch is pushed to the designated session branch (section 9). |
| Repo runtime | Node 22.23.4 at `/opt/node22/bin/node`, first on `PATH` (`node --version`). `npm ci` exit 0. |
| Products root | `/home/user/products` (the environment already sets `PRODUCTS_ROOT`; it is outside the repository). |
| Harness | `qa-portfolio-harness` installed by `npm ci` at `node_modules/qa-portfolio-harness`. `package.json` version 0.3.1; lock resolves to `7d4a3ae36100a0150397eeac1c6fefefe5e64c15`; the installed `src/` is identical to the tag `v0.3.1` (annotated tag object `88827e43fa9a95679b00ab0098ca0bc6628a2853`, peeled commit `7d4a3ae`). |
| Docker | `docker` CLI present (Docker Engine 29.9.2 client). The daemon is absent: `/var/run/docker.sock` does not exist (`dial unix /var/run/docker.sock: connect: no such file or directory`). |
| Network | GitHub reachable (`git ls-remote` of the harness tag, the four fork refs, P2 and P6). `nodejs.org` reachable (HTTP 200 for `SHASUMS256.txt`). `registry.npmjs.org` reachable for `npm ci`. |

### 1.1 Run log (in order; exit codes are the process exit codes)

| Step | Command (abbreviated; no secret) | Exit | Result |
|---|---|---|---|
| 1 | `git fetch origin`; `git checkout -b plan/2026-11-10-p5-doc origin/main` | 0 | Base `f4fe6c1`. Working tree clean. |
| 2 | `NODE24=/opt/node24/bin/node PRODUCTS_ROOT=/home/user/products bash scripts/bootstrap.sh documenso` | 1 | Documenso cloned at `f4105e4` (depth 1, pinned). Install step refused: `ERROR /opt/node24/bin/node reports v24.22.1; approved is v24.22.0.` **Recorded as my error:** `/opt/node24` is not selected by the setup contract (`scripts/cloud-install.sh:14`, `:181-182`). See step 4. |
| 3 | `node node_modules/qa-portfolio-harness/scripts/up.mjs documenso` under `/opt/node24/bin/node` (wrapper with `trap ... down.mjs documenso EXIT`) | 1 | `Error: Cal product root does not exist: /home/user/products/cal.` Harness `loadConfig` validates all four product roots before any product runs (section 3, row H2). The brief's single-product clone is not enough. Down exit 1 (same cause). |
| 4 | `bash scripts/cloud-install.sh --toolchain-only` | 0 | Provisions `node/24.22.0` under `/root/.cache/qa-portfolio/toolchains` after SHA-256 verification against the published SHASUMS256 entry. Reports `NODE22=/opt/node22/bin/node (v22.23.4, npm 10.9.9)` and `NODE24=/root/.cache/qa-portfolio/toolchains/node/24.22.0/bin/node (v24.22.0, npm 11.19.1 >= 11.17.0)`. Stops before `npm ci` and bootstrap, as the flag says. |
| 5 | `NODE24=<provisioned> PRODUCTS_ROOT=/home/user/products BOOTSTRAP_SKIP_INSTALL=1 bash scripts/bootstrap.sh cal documenso medusa twenty` | 0 | Cal `c2b7ac4`, Documenso `f4105e4`, Medusa `f677db4`, Twenty `7cbdfec`. Install skipped for all four (deviation, recorded; the stack could not start without Docker in any case). Pins match `scripts/bootstrap.sh:15-18`. |
| 6 | `NODE24=<provisioned> PRODUCTS_ROOT=/home/user/products bash scripts/bootstrap.sh documenso` (install on) | 0 | `Node 24 check ok: ... (v24.22.0), npm 11.19.1`. `npm ci` ran in the Documenso checkout with Node 24.22.0 (the check at `scripts/bootstrap.sh:117-128`). |
| 7 | `node node_modules/qa-portfolio-harness/scripts/up.mjs documenso` under the provisioned Node 24 (wrapper with the down trap) | 1 | See section 2. |
| 8 | `down.mjs documenso` (trap) | 1 | Same Docker cause. |
| 9 | `npm ci` at the repo root (lockfile) | 0 | Installed the harness at v0.3.1. Audit notes only. |

## 2. Harness up and down

Wrapper: a shell script in the session scratchpad, outside the repository, not committed. It sets `NODE24` and `PRODUCTS_ROOT`, prints the Node versions and whether `DANGEROUS_BYPASS_RATE_LIMITS` is set (it is unset), then runs `up.mjs` and registers `down.mjs` in an `EXIT` trap, so down always runs. The wrapper's own exit status is 0 because its final `echo` succeeds, so the exit codes recorded here are the `up` and `down` ones.

| Item | Value |
|---|---|
| Up command | `"$NODE24" node_modules/qa-portfolio-harness/scripts/up.mjs documenso` with `NODE24=/root/.cache/qa-portfolio/toolchains/node/24.22.0/bin/node` and `PRODUCTS_ROOT=/home/user/products` |
| Up exit code | **1** |
| Up failure | `docker compose -p qa-harness-documenso -f .../node_modules/qa-portfolio-harness/docker/documenso.compose.yml up -d --wait exited with code 1`, with `failed to connect to the docker API at unix:///var/run/docker.sock ... no such file or directory`. |
| Readiness output | Not reached. The harness failed at the Docker step, before any readiness check. |
| Down command | `"$NODE24" node_modules/qa-portfolio-harness/scripts/down.mjs documenso` (from the trap) |
| Down exit code | **1** (`docker compose ... down --remove-orphans exited with code 1`, same socket error) |
| Stacks running afterwards | None. No product was started, no seed ran, no fork `.env` was touched. |
| Classification | ENV (blocked host: no Docker daemon). Build-brief STOP 8 applies: Docker unavailable. Probes that need a running stack are UNPROBED with this reason. |

The up step reached `docker compose` (section 3, row H3). That means Node 24, the Documenso and Cal clones, the harness config and the compose file were all accepted. Only the daemon is missing.

## 3. Source reads at the pins

Pins: harness `v0.3.1` (`7d4a3ae`), P2 `99a2fde`, P6 `0533e61`, Documenso `f4105e4` (checked out by bootstrap), Cal `c2b7ac4`, Medusa `f677db4`, Twenty `7cbdfec`. Paths below are at those pins unless marked "main" (the repository) or "harness" (`node_modules/qa-portfolio-harness`, identical to the tag).

### 3.1 Bypass and limiter (fact 1, probe 3b)

| Row | Path : line | Read | Status |
|---|---|---|---|
| B1 | harness `src/adapters/documenso-env.ts:297-298` | `...(process.env.DANGEROUS_BYPASS_RATE_LIMITS === "true" ? { DANGEROUS_BYPASS_RATE_LIMITS: "true" } : {})`. Forwarded only for the exact string `"true"`. | CONFIRMED |
| B2 | Documenso `packages/lib/server-only/rate-limit/rate-limit.ts:73-74` | `if (process.env.DANGEROUS_BYPASS_RATE_LIMITS === 'true') { return { isLimited: false, ... } }`. The bypass is honoured only for `'true'`. | CONFIRMED |
| B3 | Documenso `packages/lib/server-only/rate-limit/assert-organisation-rates-and-limits.ts:32` | Same exact-`'true'` check. | CONFIRMED |
| B4 | Documenso `turbo.json:156` | The variable is listed as a pass-through build input. It has no default. | CONFIRMED |
| B5 | Documenso e2e comments `packages/app-tests/e2e/api/v1/organisation-rate-limits.spec.ts:46`, `:70` | CI runs e2e with the bypass set to `true` and skips rate-limit tests when it is set. The skip is the only other reader. | CONFIRMED |

Consequence: when the variable is unset, neither the harness nor the product bypasses the limiter. The limiter is enforced in source. A live max+1 check needs a running stack (UNPROBED, section 2). The plan never sets the variable (MP:964 at 298ae29, build rule 9.11 test 12 at MP:732).

### 3.2 Harness routes (probes 3c, 3d, 3a)

| Row | Path : line | Read | Status |
|---|---|---|---|
| H1 | harness `scripts/up.mjs`, `scripts/down.mjs` | Present. `up.mjs` calls `getAdapter(id).up()`. | CONFIRMED |
| H2 | harness `dist/config.js:74`, `:89`; `dist/adapters/registry.js:7` | `resolveExistingDir` throws `<label> does not exist` (`:74`). `loadConfig` resolves the Cal root eagerly (`:89`) and every adapter call runs `loadConfig` (`registry.js:7`). A documenso-only clone therefore fails. | CONFIRMED (observed, section 2 log) |
| H3 | harness `docker/documenso.compose.yml:13`, `:29` | Images `postgres:15` and `inbucket/inbucket`. The compose file is what `docker compose up -d --wait` ran (section 2). | CONFIRMED |
| H4 | harness `src/adapters/documenso.adapter.ts:578-580` | `seedUsers()` lists one example user from the product seed. | CONFIRMED |
| H5 | harness `src/adapters/documenso.adapter.ts:636-644` | `authenticate()` needs `DOCUMENSO_API_TOKEN`. The error says: start the app, sign in as a seeded user, open Settings, create a token, paste it. Token minting is manual. | CONFIRMED |
| H6 | harness `src/` (all files), grep for `oidc`, `openid`, `idp`, `oauth`, `mock` | No matches. | CONFIRMED: **BLOCKED: mock IdP not in harness v0.3.1** (probe 3c) |
| H7 | harness `scripts/` | Only `cloud-install.sh`, `down.mjs`, `lib.mjs`, `smoke.mjs`, `up.mjs`. No actor, token or organisation route. | CONFIRMED |

### 3.3 Product routes for actors (probe 3d; UNPROBED live)

| Row | Path : line at Documenso `f4105e4` | What it is | Status |
|---|---|---|---|
| D1 | `packages/auth/server/routes/email-password.ts:192` | `POST /signup` (zod `ZSignUpSchema`); `signupRateLimit.check` at `:203`. The limit is not in the P6 contract, so the count of throwaway signups per run must be bounded and recorded. | Exists; live UNPROBED |
| D2 | `packages/trpc/server/organisation-router/router.ts:37` | `create: createOrganisationRoute` (organisation create, for AUTHZ-002). | Exists; live UNPROBED |
| D3 | `packages/trpc/server/api-token-router/create-api-token.ts` | Token create route (for NEW-DOC-4). The harness does not drive it (H5). | Exists; live UNPROBED |
| D4 | `packages/trpc/server/team-router/create-team-*.ts`; `packages/trpc/server/template-router/router.ts` | Team and template creation. | Exists; live UNPROBED |
| D5 | `packages/prisma/schema.prisma:394-398`, `:420`, `:466` | `enum DocumentVisibility { EVERYONE; MANAGER_AND_ABOVE; ADMIN }`; default `EVERYONE` on the two models (for RBAC-001). | CONFIRMED |
| D6 | `packages/auth/server/routes/two-factor.ts:23` `/setup`, `:40` `/enable`, `:78` `/disable` | Two-factor routes for MI-15. | Exists; live UNPROBED |

### 3.4 Alias sources (probe 3e)

| Row | Path : line | Read | Status |
|---|---|---|---|
| E1 | P6 `0533e61` `src/load/spike/limiter-contract.ts:19` | `upload`: `POST /api/files/upload-pdf`, max 20. | CONFIRMED |
| E2 | same, `:20` | `ai`: `POST /api/ai/p6`, max 3. | CONFIRMED |
| E3 | same, `:21-28` (`id: "authorize"` at `:22`) | `POST /api/auth/email-password/authorize`, max 10, family B. Used by the login helper, so the helper logs in once per actor (section 5). | CONFIRMED |
| E4 | same, `:29-35` (`forgot-password` at `:30`), `:36-42` (`resend-verify-email` at `:37`), `:43-49` (`verify-email` at `:44`), `:50-57` (`reset-password` at `:51`) | Max 3, 3, 5 and 5. | CONFIRMED |
| E5 | P6 `0533e61` `tests/documenso/races/doc-race-002-double-submit.spec.ts:40-48` | `:40` comment: one SIGNED and nine ALREADY_SIGNED per trial, all HTTP 200. `:41-48` assertions on status counts, signed, already-signed, errors, single seal and verdict. | CONFIRMED |
| E6 | Documenso `packages/app-tests/e2e/user/password.spec.ts:113`, `:171` | `:113` "password reset invalidates all sessions"; `:171` "password update invalidates other sessions but keeps current". Basis for DROP SESS-001 (fact 3). | CONFIRMED |

### 3.5 Webhook URL guard and secret header (probe 3f; NEW-DOC-6)

| Row | Path : line | Read | Status |
|---|---|---|---|
| F1 | Documenso `packages/trpc/server/webhook-router/schema.ts:6-11` | `ZWebhookUrlSchema` refuses a URL where `isPrivateUrl` is true. Message at `:10`: `Webhook URL cannot point to a private or loopback address` (create-time). | CONFIRMED |
| F2 | Documenso `packages/lib/server-only/webhooks/is-private-url.ts:21-33`, `:27-29` | `localhost`, `::1`, `0.0.0.0`, `127.`, `10.`, `192.168.`, `169.254.`, `fe80:`, `fc`/`fd`, `172.16-31` and IPv4-mapped IPv6 are refused. A non-IP hostname returns `false` (fail open): `:27-29`. | CONFIRMED |
| F3 | Documenso `packages/lib/server-only/webhooks/assert-webhook-url.ts:36-37`, `:82-83`, `:96-99` | `NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS` skips every check (`:36-37`). Execute-time refusal: `Webhook URL resolves to a private or loopback address` (`:97-99`). The comment at `:82-83` says the check fails open on DNS errors and timeouts. The harness does not set the bypass variable (grep, harness `src/`: no match). | CONFIRMED |
| F4 | Documenso `packages/lib/server-only/webhooks/execute-webhook-call.ts:31`, `:40` | `await assertNotPrivateUrl(url)` runs before the POST (`:31`). The request carries `X-Documenso-Secret: <secret>` (`:40`). | CONFIRMED |
| F5 | P2 `99a2fde` `src/webhooks/verify.ts:66-71`; `src/webhooks/sign.ts:38`, `:41-43` | `verifyDocumenso` (`:66-71`) compares the header with the configured secret in constant time. There is no HMAC and no timestamp. `DOCUMENSO_SECRET_HEADER` is `X-Documenso-Secret` (`sign.ts:38`). The vendored copy is `src/kit/webhooks/verify.ts` on main. | CONFIRMED. **Premise corrected:** NEW-DOC-6 verifies equality, not a signature (section 4). |

Consequence for PN-1 and NEW-DOC-6: the create-time and execute-time guards refuse a receiver on a private or loopback address. A receiver reachable from the product container is therefore private unless the owner supplies a non-private canary. The plan does not set the bypass variable (that would change the product guard, build-brief STOP 11).

### 3.6 Verdict sources for MI-1, MI-2, MI-12, MI-13 (probe 3g, at P2 `99a2fde`)

| Row | Source | Read | Status |
|---|---|---|---|
| G1 | P2 `README.md:100` | `P5-DOC-DEL-001`: deleting an envelope that completes at the same moment answers 500 and leaves it live. Listed as proven. | CONFIRMED (MI-1) |
| G2 | P2 `tests/integration/doc/expiry.spec.ts:16` | Comment cites `delete-document.ts:185-191` as the product finding for P5-DOC-DEL-001. Documenso `packages/lib/server-only/document/delete-document.ts:185-191` is `tx.envelope.delete({ where: { id, status: { not: COMPLETED } } })`. | CONFIRMED (MI-1 source; no deterministic trigger in the harness, so verdict only) |
| G3 | P2 `README.md:101`; `tests/serial/doc/conversion.spec.ts:18`, `:65`, `:88` | `:18` title `P5-DOC-CONV-001: conversion outage answered 400, not 503`. `:65` `P2-DOC-CONV-002`. `:88` oracle "expected to fail" (a dependency outage is a 5xx). | CONFIRMED (MI-2) |
| G4 | P2 `tests/billing/doc/stripe.spec.ts:45`, `:55`, `:69` | `P2-DOC-STR-001`: unsigned event refused with 400 (`:45`); bad or stale signature non-2xx with no row change (`:55`); correctly signed not-synced event accepted 200 with no row change (`:69`). | CONFIRMED (MI-12) |
| G5 | P2 `tests/integration/doc/lifecycle.spec.ts:41`, `:69` | `P2-DOC-SM-001`: completion sets `completedAt` (`:41`); refused transitions on a COMPLETED envelope change no rows (`:69`). | CONFIRMED (MI-12) |
| G6 | P2 `tests/contracts/doc/upload.spec.ts:56`, `:68` | `:56` positive control (valid PDF accepted). `:68` zero-byte PDF refused with 4xx: `KNOWN PRODUCT BUG PB-DOC-001`. | CONFIRMED (MI-13) |

### 3.7 Other pinned reads

| Row | Path : line | Read | Status |
|---|---|---|---|
| S1 | Documenso `apps/remix/server/security-headers.ts:26-28`, `:106-112`, `:172-177` | Signing routes `/sign/:token` and `/d/:token` are frameable on purpose: `frame-ancestors *` (`:110`). Other routes get `frame-ancestors 'self'` (`:112`). `Referrer-Policy: strict-origin-when-cross-origin` (`:173`) and `X-Content-Type-Options: nosniff` (`:177`) are set by the middleware. | CONFIRMED (HDR-001 oracle, section 4) |
| S2 | P2 `contracts/doc/openapi.json` at `99a2fde` | File present (PN-3 source). | CONFIRMED |
| S3 | P2 `.github/workflows/p2-doc.yml:59-65`, `:84-89` | Node 22 from `.nvmrc` with `NODE22=$(command -v node)` in `GITHUB_ENV` (`:65`); Node 24 with `node-version: 24` and `NODE24=$(command -v node)` (`:86-89`). Dual-runtime basis for the lane (fact 23). | CONFIRMED |
| S4 | main `scripts/bootstrap.sh:15-18`, `:20` | Pins `MEDUSA_REF`, `DOCUMENSO_REF`, `TWENTY_REF`, `CAL_REF`; `NODE24_APPROVED="24.22.0"` at `:20`. | CONFIRMED |
| S5 | main `scripts/cloud-install.sh:6-22`, `:14`, `:176-179`, `:181-182` | Runtime contract: Node 24 is `$root/node/24.22.0/bin/node`; `/opt/node24` is never selected (`:14`). The provisioned binary is checked for `24.22.0` (`:179`). `/opt/node24` is reported and left untouched (`:181-182`). | CONFIRMED |
| S6 | main `.claude/hooks/session-start.sh:3` | Post-setup only: never installs, downloads, clones or starts a product or Docker. | CONFIRMED |
| S7 | main `.cursor/environment.json:5-6` | `install`: `bash scripts/cloud-install.sh`; `start`: `sudo service docker start && docker info >/dev/null`. | CONFIRMED |
| S8 | main `.github/workflows/ci.yml:63-67`, `:101` | `p5-doc` caller: `needs: [changes]`, `if:` on `p5_doc` and the same-repo check, `uses: ./.github/workflows/p5-doc.yml`, `secrets: inherit` (`:67`). `gate` needs `p5-doc` (`:101`). | CONFIRMED |
| S9 | main `scripts/ci-changes.sh:21` | `re_doc` regex: `src/lanes/doc/`, `tests/unit/lanes/doc/`, `tests/(contracts|webhooks|integration|serial|ui)/doc/`, `.github/workflows/p5-doc.yml`. | CONFIRMED |
| S10 | main `.github/workflows/p5-doc.yml:1` | `# P5-STUB: remove this line when the first real job lands`. One `stub` job (`:12-14`). | CONFIRMED |
| S11 | main `docs/findings/ledger.json` | 74 cases (64 planned, 8 alias, 2 dropped), 8 private entries, 0 findings, 0 accepted risks. Matches MP:296-300 (298ae29). | CONFIRMED |
| S12 | main `docs/findings/ledger.schema.json:23`, `:28`, `:33` | `gated` is an allowed status and requires `blocker` (`:33`). | CONFIRMED |
| S13 | main `src/security/budgets.ts:20` (`TOTP_BURST`, value 20), `:32` (`DOC_ROUTE_LIMITS`, formula, CITED), `:91` (`FUZZ_MAX_EXAMPLES`), `:96` (`FUZZ_WALL_MIN`), `:112` (`LANE_JOB_TIMEOUT_MIN`) | Named budgets exist by name. `DOC_ROUTE_LIMITS` is a formula object, not a scalar. | CONFIRMED |
| S14 | main `docs/lane-ownership.md:19` | "Vendoring table" heading. The table is a foundation file (MP:346-347 at 298ae29). | CONFIRMED |
| S15 | main `.github/pull_request_template.md:7-15` | Checklist items; the footer item is at `:9`. | CONFIRMED |

### 3.8 Probe item results

| Probe | Status | Basis |
|---|---|---|
| P-8 (MP:836 at 298ae29) | BLOCKED: mock IdP not in harness v0.3.1 | H6. OIDC-001 and OIDC-002 stay gated (D9). |
| Probe 3a runtime | CONFIRMED (Node); stack UNPROBED | Section 1.1 and 2. |
| Probe 3b limiter, bypass unset | Source CONFIRMED; live UNPROBED | B1-B3; a live max+1 needs a running stack. |
| Probe 3d actors | BLOCKED for the harness route; product routes UNPROBED live | H4, H5, H7; D1-D4. |
| Probe 3e alias sources | CONFIRMED | E1-E6. |
| Probe 3f webhook guard | CONFIRMED in source; live UNPROBED | F1-F4. Owner canary absent, so PN-1 gated. |
| Probe 3g verdict sources | CONFIRMED | G1-G6. |

## 4. Corrections and findings recorded by this probe

| # | Item | Expected (plan) | Observed | Status |
|---|---|---|---|---|
| R1 | Ledger status of `P5-DOC-OIDC-001` and `P5-DOC-OIDC-002` | `gated` with a blocker (MP:334; MP:140-141 and MP:958-959 at 298ae29; OD-16 MP:107) | `planned` (`ledger.json:173`, `:181`), which matches MP:296 (section 4.8 says all 64 KEEP rows are `planned`) | **CONTRADICTS.** The master plan is internally inconsistent here. Stop item for the two rows. Owner decision (plan section 6, item L-2). |
| R2 | Fact 1 wording "default ON" (MP:34) | The bypass is on by default | Bypass honoured only for the exact string `"true"` (B1-B3). Unset means off, the limiter is enforced. | Recorded correction. The fact's mechanism is CONFIRMED; the word "default" is wrong. |
| R3 | Brief step 1.1 (`bootstrap.sh documenso` alone) | Enough to run `up.mjs documenso` | Harness validates all four product roots (H2) | Recorded finding. Clone all four. MP:388 already says bootstrap clones four forks. |
| R4 | Node 24 runtime for the probe | The setup-recorded NODE24 (`cloud-install.sh:179`) | First attempt used `/opt/node24` (v24.22.1). Not selected by the contract (S5). Refused by bootstrap (exit 1). | Recorded as my error. The contract NODE24 was used for every later step. Nothing else depends on the first attempt. |
| R5 | NEW-DOC-6 premise "verifiable by the vendored verifier" | An outgoing signature | `X-Documenso-Secret` is the secret echoed, compared in constant time (F4, F5) | Recorded correction. Oracle is equality, not a cryptographic signature. |
| R6 | HDR-001 expected headers | Not named in MP (MP:976) | Signing routes are frameable on purpose (S1) | Recorded. Wildcard `frame-ancestors` on `/sign/:token` and `/d/:token` is a design verdict, not a defect. |
| R7 | Live docker stack | Required for every live probe | No daemon (section 2) | ENV, STOP 8. All live items UNPROBED. |
| R8 | Single-product bootstrap clones | Brief step 1.1 says `bootstrap.sh documenso` | See R3 | Recorded. |

## 5. Items UNPROBED (with the reason)

| Item | Reason | Blocker text |
|---|---|---|
| 3a stack up and readiness | No Docker daemon (section 2). | ENV (Docker) |
| 3b live max+1 on one P6 route | No stack. | ENV (Docker) |
| 3c P-8 mock IdP | Not in harness. | BLOCKED: mock IdP not in harness v0.3.1 |
| 3d throwaway users, second organisation, team template (live) | No stack. Harness route absent (H4, H5, H7). | BLOCKED: throwaway actor and token creation not in harness v0.3.1 (product routes D1-D4 exist; live use UNPROBED) |
| Section 4 NEW-DOC-1, -2, -3, -5 live behaviour | No stack; actors needed. | ENV (Docker); actors (above) |
| NEW-DOC-4 team API token scope | Harness mints no token; manual step (H5). | BLOCKED: API token minting through a harness route not in harness v0.3.1 |
| PN-1 webhook URL guard live (delivery and allowed control) | No stack; owner canary absent. | Owner canary (MP:249, gated) |
| NEW-DOC-6 live delivery to a receiver | No stack; a receiver reachable from the container is private under F1-F3 without an owner canary. | Owner canary (gated) |
| PN-3 Schemathesis | Tool version and CLI option names unverified (`budgets.ts:91` basis says so); no Schemathesis in the repository. | UNPROBED: Schemathesis CLI at the pinned version not established |
| MI-15 TOTP burst live | No stack; needs a throwaway actor with 2FA enabled. | ENV (Docker); actors (above) |

## 6. Ledger effect and owner decisions raised by this probe

| Item | Decision needed from the owner |
|---|---|
| L-1 (R1) | Set OIDC-001 and OIDC-002 to `gated` with `blocker: "BLOCKED: mock IdP not in harness v0.3.1"` by foundation PR, or accept `planned` and say why. Until then both rows stop here. |
| L-2 | Whether to request a mock IdP route from the harness owner (not in the MP:819-824 request list). |
| L-3 | Whether a non-private owner canary exists for PN-1 and NEW-DOC-6 (MP:249). |
| L-4 | Where verdict documents live. The master plan names none; `docs/` closeout files are X-owned (MP:346). |
| L-5 | Whether to add a Schemathesis pin (a foundation change to `package.json`) for PN-3. |

## 7. Session notes

- No stack, seed, fork `.env`, product database or setting was changed.
- Documenso and the other forks were cloned at their pins into `/home/user/products` (outside the repository). Their dependencies were installed for Documenso only.
- The full run logs are kept outside the repository (session scratchpad, not committed). The exit codes and error lines are reproduced in section 2.
