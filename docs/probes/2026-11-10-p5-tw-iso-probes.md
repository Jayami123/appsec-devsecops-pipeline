# P5 L-TW-B tw-iso probe record (2026-11-10)

Scope: probe-first record for the L-TW-B lane (`tw-iso` and `tw-limiter-last`). This PR builds no lane code, no test, no workflow and no config. It records source reads at pinned refs, the installed harness state, and the live-probe status. Master plan references are `MP:<line>` at `836802c`.

Base: `origin/main` = `836802c3bd8569e96c412d2e344b4fd265b2b3ac` (F0-3, F0-4 and the L-PIPE PRs #9 to #15 merged). Branch: `plan/2026-11-10-p5-tw-iso`. Companion plan: `docs/plans/2026-11-10-p5-tw-iso.md`.

Redaction: no secret, token, cookie or canary value appears in this record. Where a value would be needed, the record names the variable or the line and says so. No personal name appears in this record.

Status key: **CONFIRMED** (observed or read at the pin, matches the master plan), **CONTRADICTS** (observed differs from a cited contract or decision; the item is stopped and reported), **UNPROBED** (not run; the reason follows), **ENV** (an environment fact that is not a plan contradiction).

## 0. Summary

- Live probes: **none run**. Docker is not running in this session (section 2). Every live item is `UNPROBED` with `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. No dockerd or containerd was started by hand.
- Source reads at pins: **done** for the Twenty fork at `7cbdfec6`, the harness at `v0.3.1` (installed) and `v0.4.0` (tag), P6 at `0533e61` and P2 at `99a2fde`.
- Harness `v0.4.0` claims (owner correction 3): **CONFIRMED**. `LOGIC_FUNCTION_TYPE` is forwarded, the named Twenty canary pass-through exists, `TWENTY_REQUIRE_FRESH=1` exists, and the limiter reset is **deferred** (not in `v0.4.0`).
- Harness `v0.3.1` (the installed pin): `LOGIC_FUNCTION_TYPE` is absent and no canary name is forwarded. **CONFIRMED**.
- One item is **CONTRADICTS** (section 4, item G1): owner decision X-2 names a `--no-deps` option that the harness does not have. Stopped and reported.
- One item is **ENV** (section 4, item G3): the Node 24 binary at `/opt/node24` reports `v24.22.1`; the approved value is `v24.22.0`.
- Two plan-internal reference errors are recorded as recorded corrections in the plan (section 15 of the plan), not as probe contradictions: a dangling `section 15.4` and `section 15.5` reference in the master plan rows, and a `v0.3.2` naming inconsistency in master plan section 5.

## 1. Environment and tool state

| Item | Observed | Result |
|---|---|---|
| Repository runtime Node | `v22.23.4` (`.nvmrc` = `22`) | CONFIRMED |
| `npm ci` at the branch head | exit `0`; installs the pinned harness `v0.3.1` into `node_modules/qa-portfolio-harness` (`package.json` version `0.3.1`) | CONFIRMED |
| Node 24 at `/opt/node24/bin/node` | `v24.22.1`; npm `11.19.1` | ENV (approved `v24.22.0`, `scripts/bootstrap.sh:116-117` refuses any other value for Documenso). The `twenty` bootstrap path does not check NODE24 (exit `0` with NODE24 set). Owner decision in plan section 13. |
| Docker CLI | `29.9.2` at `/usr/bin/docker` | present |
| Docker daemon | `failed to connect to the docker API at unix:///var/run/docker.sock ... no such file or directory` | **BLOCKED**: no Docker in this session. Not started by hand (owner rule: never start dockerd or containerd by hand). |

## 2. Lifecycle record (harness)

| Step | Record |
|---|---|
| Wrapper | Not installed. The required form is `trap 'node node_modules/qa-portfolio-harness/scripts/down.mjs twenty' EXIT` around the probe script. No probe script was run, so the trap was not needed. |
| Up command | Not run. The harness entry point is `node node_modules/qa-portfolio-harness/scripts/up.mjs twenty` (`up.mjs:3-6` at `v0.3.1`: the product id is the only argument). |
| Up exit code | n/a (not run) |
| Readiness output | n/a (not run) |
| Down command and output | n/a (not run) |
| Reason | **BLOCKED: no Docker in this session (pending the Docker foundation PR).** No product stack was started, seeded or stopped by hand. |
| Actors, tokens, API keys created | None. |
| Secrets read or printed | None. |

## 3. Source reads at pins

| Source | Pin | Method | Result |
|---|---|---|---|
| Twenty fork `Jayami123/twenty-CRM` | `7cbdfec6f346b43715bc2056932f4fad5886f733` | `NODE24=/opt/node24/bin/node PRODUCTS_ROOT=<scratchpad>/products bash scripts/bootstrap.sh twenty`, exit `0`; depth-1 clone; `twenty` runs from images, so no install | `git rev-parse HEAD` = the pin. Products root is outside the repository. |
| Harness `qa-portfolio-harness` at `v0.3.1` | installed package `node_modules/qa-portfolio-harness` | `npm ci` | Package version `0.3.1`. Read only. |
| Harness at tag `v0.4.0` | tag object `6bb2c238e97589de06ec28a277412313ddc7594b`; peeled commit `31cafc0844d441a8567db89cd18612300c3d4b77` | `git ls-remote --tags`, then a depth-1 clone to the scratchpad | Values match the owner's record. Read only. Not installed; the P5 pin is still `#v0.3.1` (`package.json:21`). |
| P6 `Jayami123/k6-load-concurrency-suite` | `0533e61391b9a64159b32edbeddbbc8b39892997` | partial clone (blob filter) to the scratchpad | Read only. |
| P2 `Jayami123/api-webhook-db-test-suite` | `99a2fde` | partial clone (blob filter) to the scratchpad | Read only. |
| L-TW-A probe record (unmerged) | branch `origin/plan/2026-11-10-p5-tw`, file `docs/probes/2026-11-10-p5-tw-probes.md` | `git show` | Used only for the P-9 status and the limiter readback rule (sections 4 and 5). Not merged. |

## 4. Probe items and status

Harness at `v0.3.1` is the installed pin. Harness at `v0.4.0` is read from the tag. Twenty source is read at `7cbdfec6`. Paths are relative to the Twenty fork root `packages/twenty-server/` unless shown otherwise. Harness paths are relative to the harness root.

### 4a. Harness `LOGIC_FUNCTION_TYPE` (fact 5; SND-001 to SND-004)

| # | Item | Status | Evidence | Reason if not run |
|---|---|---|---|---|
| A1 | `LOGIC_FUNCTION_TYPE` absent at `v0.3.1` (grep of `src/` and `docker/`) | **CONFIRMED** | 0 matches in `src/` and `docker/`. Allowlist at `src/adapters/twenty-passthrough.ts:9-16` has six names and no `LOGIC_FUNCTION_TYPE`. | none |
| A2 | `SND-001` to `SND-004` at `v0.3.1` | **UNPROBED** | `BLOCKED: LOGIC_FUNCTION_TYPE not in harness v0.3.1` (the probe would need a stack). Gate in the plan: the P5 pin bump to `v0.4.0`. | Also `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. |
| A3 | `LOGIC_FUNCTION_TYPE` forwarded at `v0.4.0` | **CONFIRMED** (source and changelog) | `twenty-passthrough.ts:17` (`"LOGIC_FUNCTION_TYPE"`). Values `DISABLED`, `LAMBDA`, `LOCAL` and case-insensitive validation in `twenty-runtime-override.ts:66-81`. `CHANGELOG.md` `[0.4.0]`. | none for the source fact |
| A4 | Upstream default of `LOGIC_FUNCTION_TYPE` | **CONFIRMED** at `7cbdfec6` | `config-variables.ts:732-735`: `LOCAL` only when `NODE_ENV` is `development`, otherwise `DISABLED`. | none |
| A5 | Disabled driver behaviour | **CONFIRMED** at `7cbdfec6` | `logic-function-drivers/drivers/disabled.driver.ts:21-25` throws `LOGIC_FUNCTION_DISABLED` for every execution. **Confound**: a "blocked" SND result without a passing control could be the disabled error, not a sandbox control. The plan requires a positive control under `LOCAL` first. | none |

### 4b. Canary (SND-001; P-12)

| # | Item | Status | Evidence | Reason if not run |
|---|---|---|---|---|
| B1 | No canary name forwarded at `v0.3.1` | **CONFIRMED** | 0 matches for `canary` in `src/`. Exact-name allowlists: `twenty-passthrough.ts:9-16` and `twenty-rate-limits.ts:7-14`. | none |
| B2 | Named canary pass-through at `v0.4.0` | **CONFIRMED** (source) | `src/adapters/twenty-canary.ts:6-8` (env names `HARNESS_TWENTY_CANARY_NAME`, `HARNESS_TWENTY_CANARY_VALUE`, pattern `^[A-Z][A-Z0-9_]{2,63}$`), `:19-41` (`readTwentyCanary`), `:44-46` (value is an interpolation reference, never written). Wired in `twenty-runtime-override.ts:11`, `:97`, `:103`. | none |
| B3 | P-12: canary presence proof in the parent environment | **UNPROBED** | `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. Also no proof route is defined in `v0.3.1` or `v0.4.0`: the harness writes the canary into server and worker, and no harness-side readback exists. The plan defines the decision needed (plan section 6, D-P12). | Live stack needed. |
| B4 | Canary name must not collide with harness names | **CONFIRMED** | `twenty-runtime-override.ts:27-37` (reserved set includes `TWENTY_REQUIRE_FRESH`, the passthrough and rate-limit names and both canary names). | none |

### 4c. GraphQL rows on one default stack (GQL-001, GQL-002, GQL-003, GQL-005, GQL-006)

Source characterisation first, as the plan requires. The live values stay `UNPROBED`.

| # | Row | Source finding at `7cbdfec6` | Status | Live |
|---|---|---|---|---|
| C1 | GQL-001 depth | No nested-depth limit is configured. `graphql-config.service.ts:69-74` passes `maximumAllowedFields` and `maximumAllowedRootResolvers` and `checkDuplicateRootResolvers`, and **not** `maximumAllowedNestedFields`. The depth check runs only when that option is defined (`use-validate-graphql-query-complexity.hook.ts:66-70`). | **CONFIRMED** (source) | **UNPROBED**: `BLOCKED: no Docker in this session (pending the Docker foundation PR)` |
| C2 | GQL-002 cost | No cost analysis. Field and root-resolver caps only: `GRAPHQL_MAX_FIELDS = 2000` (`config-variables.ts:1855`), `GRAPHQL_MAX_ROOT_RESOLVERS = 20` (`:1863`), enforced at `use-validate-graphql-query-complexity.hook.ts:75-79` and `:87-91`. | **CONFIRMED** (source) | **UNPROBED** (same reason) |
| C3 | GQL-003 aliases | No alias-specific rule found in the GraphQL config (`graphql-config.service.ts`, grep for alias limits: none). Whether aliased fields count toward the field cap depends on the analyser at `use-validate-graphql-query-complexity.hook.ts:252-269`, not yet exercised. | **CONFIRMED** (no alias rule); count semantics **UNPROBED** | **UNPROBED** (same reason) |
| C4 | GQL-005 introspection | Anonymous introspection is refused only when `NODE_ENV` is `production`: `graphql-config.service.ts:66-67` and `use-disable-introspection-and-suggestions-for-unauthenticated-users.hook.ts:14-17`. The default `NODE_ENV` is `production` (`config-variables.ts:1543`). `docker/twenty.compose.yml` sets **no** `NODE_ENV` (grep: 0 matches). The effective value is therefore the image's, not read here. | **CONFIRMED** (gate); effective value **UNPROBED** | **UNPROBED**: readback required (section 5) |
| C5 | GQL-006 suggestions | Suggestions are removed for anonymous callers only under the same production gate (`removeSuggestionInErrorsRule`, same hook file, lines 15-16). | **CONFIRMED** (source) | **UNPROBED** (same reason) |
| C6 | GQL-004 batching | No batching option in `graphql-config.service.ts` (grep: none). The Yoga default was not read (the twenty fork has no installed `node_modules` in this session). | **CONFIRMED** (no option set); Yoga default **UNPROBED** | **UNPROBED** |

### 4d. GQL-004 (limiter rows; P-9)

| # | Item | Status | Evidence | Reason if not run |
|---|---|---|---|---|
| D1 | P-9 (counts per layer, batching unit, setup spend, rollover) | **UNPROBED** | On `main`: no L-TW-A probe record. On the unmerged branch `origin/plan/2026-11-10-p5-tw`, `docs/probes/2026-11-10-p5-tw-probes.md:91` records `P-9 ... UNPROBED (E1)`. GQL-004 stays gated by P-9. | Live stack needed. |
| D2 | Functional-profile values | **CONFIRMED** | P6 `src/twenty/limiter-profile.ts:10-17`: short `100`/`1000` ms, long `3600`/`60000` ms, application `500`/`60000` ms. These match `TW_LIMITER_LAYERS` (MP section 8). | none |
| D3 | The six limiter names are forwarded at `v0.3.1` | **CONFIRMED** | `twenty-rate-limits.ts:7-14`. | none |
| D4 | Fresh functional-profile stack reachable at `v0.3.1` with the six names and no reset | **CONFIRMED** (static reach); live reachability **UNPROBED** | Names forwarded (D3); no reset capability exists at `v0.3.1` (fact 21). Live: `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. | Live stack needed. |
| D5 | `TWENTY_REQUIRE_FRESH=1` at `v0.4.0` | **CONFIRMED** (source) | `src/adapters/twenty-env.ts:157-166` (`readTwentyRequireFresh`: exact value `1`) and `:169-186` (`assertTwentyFreshOrRefuse`: refuses **before compose** when `qa-harness-twenty_db-data` or `qa-harness-twenty_server-local-data` exists). It is a **refusal guard, not a reset**. Changelog `[0.4.0]` and `README.md:431`. | Live stack needed to prove the refusal. |
| D6 | Does D5 satisfy the section 9.6 fresh-stack contract? | **Decision required** (owner); see plan section 6, D-FRESH | A fresh stack on a host with no prior Twenty volumes satisfies "fresh" without any reset. Teardown with volume removal (`TWENTY_DOWN_VOLUMES=1`, `twenty.adapter.ts:189` at `v0.4.0`) is a whole-stack volume reset, which section 17 forbids as a P5 mechanism (`MP:927`). The plan therefore requires an ephemeral host and no volume removal. | Not a probe result; a plan decision. |

### 4e. Source reads at the pin (fact 7, fact 20, SND-003, SND-004, SND-001 expectation)

| # | Item | Status | Evidence | Reason if not run |
|---|---|---|---|---|
| E1 | Fact 7 timeouts | **CONFIRMED** | `logic-function.entity.ts:23` (default `300` s), `:64-65` (`Check` `1..900` s); `dtos/create-logic-function-from-source.input.ts:51-52` (`Min(1)`, `Max(900)`); `drivers/local.driver.ts:114` (`timeoutMs = 900_000`). | none |
| E2 | Driver termination (fact 7, P-7) | Kill path **CONFIRMED** in source; live termination **UNPROBED** | `logic-function-executor.service.ts:213` (`timeoutMs = timeoutSeconds * 1000`); `local/services/local-child-process-runner.service.ts:222-232` (timer sends `SIGKILL` and reports `Timed out after <n>ms`). | Live: `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. |
| E3 | Configured sandbox memory limit (SND-004, MP section 8 `MEM_ALLOC_FRACTION`) | **CONFIRMED absence in the files read**: no configured limit found | The local child is spawned with `process.execPath`, the runner path and an environment only (`local-child-process-runner.service.ts:167-171`, `:170`). No `resourceLimits`, `--max-old-space-size` or heap cap was found in the `logic-function-drivers/drivers/local*` files. The lambda driver has `MemorySize` constants (`drivers/lambda/constants/lambda-driver.constant.ts:12-15`) but the harness uses the local driver. | SND-004 stays gated (plan section 8). |
| E4 | Fact 20 limiter structure | **CONFIRMED** | Layers at `usage-limit-definitions.constant.ts:9-49` (`apiKey` short and long, `application`). Fork defaults `config-variables.ts:1713` (`1000`), `:1722` (`100`), `:1730` (`60_000`), `:1739` (`100`), `:1748` (`60_000`), `:1757` (`500`). | none |
| E5 | Fact 6 captcha | **CONFIRMED** | `src/engine/core-modules/captcha/captcha.service.ts:12-18`: no driver returns `{ success: true }`. | none |
| E6 | SND-001 negative-check expectation | **CONFIRMED** as a source expectation, live **UNPROBED** | The child environment is the server process environment minus `NODE_OPTIONS`, plus the caller's environment (`local-child-process-runner.service.ts:167-171`). If the canary is in the server environment, sandboxed code can read it. **Expected**: SND-001's negative check fails, which would be `PRODUCT BUG (SUSPECTED)` **only after** a live control and presence proof. Not a finding now. | Live: `BLOCKED: no Docker in this session (pending the Docker foundation PR)`. |
| E7 | Limiter readback cause (X-10) | Source path **CONFIRMED**; cause **UNCONFIRMED** | `twenty-config.service.ts:56-69`: `get()` returns a DB-stored value first when the DB driver is active and holds a value, otherwise the environment value. The DB driver is active unless `IS_CONFIG_VARIABLES_IN_DB_ENABLED` is `false` (`twenty-config.module.ts:15`). The rate-limit names are not env-only (`src/engine/core-modules/twenty-config/utils/is-env-only-config-var.util.ts` lists no `API_RATE_LIMITING_*` name). The owner's observed 60-second window is **not reproduced**; no live readback was possible. | Live readback required (section 5). |

### 4f. Harness `v0.3.1` and `v0.4.0` release items (owner record)

| # | Item | Status | Evidence |
|---|---|---|---|
| F1 | `v0.4.0` `LOGIC_FUNCTION_TYPE` forwarded | **CONFIRMED** | A3 |
| F2 | `v0.4.0` named Twenty canary pass-through | **CONFIRMED** | B2 |
| F3 | `v0.4.0` `TWENTY_REQUIRE_FRESH=1` refusal guard | **CONFIRMED** | D5 |
| F4 | Limiter reset (item 3b) **deferred**, not in `v0.4.0` | **CONFIRMED** | `README.md:432` (`A per-workspace limiter reset (P5 request item 3b) is deferred`) |
| F5 | `v0.3.1`: whole-stack volume reset only (fact 21) | **CONFIRMED** | `src/adapters/twenty-env.ts:137`, `:218`, `:251` at `v0.3.1` (volume reset command and the `TWENTY_DOWN_VOLUMES=1` message). No product-scoped limiter reset. |
| F6 | `v0.4.0` session-start hook starts `dockerd` (changelog) | Observation only | The harness package's own hook, not this repository's. P5's `.claude/hooks/session-start.sh` on `main` contains no docker call (grep: 0 matches). Not run and not acted on. |

### 4g. Owner decisions, interfaces and environment

| # | Item | Status | Evidence / reason |
|---|---|---|---|
| G1 | Owner decision X-2: `tw-limiter-last` runs "on its own fresh stack with `--no-deps`" | **CONTRADICTS** | **Expected**: a `--no-deps` option on the harness `up` command. **Observed**: `up.mjs:3-6` at `v0.3.1` takes only the product id (`parseProductId(process.argv.slice(2))`, then `adapter.up()`). A search for `no-deps` / `no_deps` in `src/`, `scripts/` and `docker/` found nothing at `v0.3.1` or `v0.4.0`. **STOP** on the flag. The plan keeps the job, the `needs: [tw-iso]` chain and the fresh-stack rule; the flag is recorded as unresolved for the owner (plan section 13). |
| G2 | Fact 8 (P2 B-P21: an API key cannot create or activate a workflow version) | **CONFIRMED** (doc evidence) | `docs/probes/2026-11-03-p2-lane-tw-probes.md:42` at `99a2fde`. |
| G3 | Node 24 pin | **ENV** | `/opt/node24/bin/node` reports `v24.22.1`; approved `v24.22.0` (`scripts/bootstrap.sh:116-117`). Affects the Documenso path (`bootstrap.sh` documenso section). The `twenty` path was not affected (exit `0`). Owner decision (plan section 13). |
| G4 | Merged CI contract for `p5-tw-iso` (no secrets) | **CONFIRMED** | `.github/workflows/ci.yml:81-84` (job `p5-tw-iso` with `needs`, `if`, `uses`, no `secrets`). `.github/workflows/p5-tw-iso.yml:1` (stub marker). Test 13 at `tests/unit/ci/workflow.test.ts:224-229`. |

## 5. Limiter readback record (X-10; required before any oracle relies on a limiter value)

Not performed: no stack (section 2). The readback rule (L-TW-A, `docs/probes/2026-11-10-p5-tw-probes.md:106-108`, unmerged) requires reading the **effective** window from the running stack: the Redis key period suffix, or the 429 response. A mismatch between the forwarded value and the effective window is an **ENVIRONMENT** finding, never a product result.

Known facts: the source path (E7) allows a DB-stored override to win over the environment. The owner observed an effective 60-second window while the environment carried `3600000` ms. The cause is **UNCONFIRMED**, and this record does not assume either value. The owner's observed `60000` ms matches the fork's default long window (`config-variables.ts:1730`), which is one candidate. The plan's readback step decides between causes on a live stack.

Result: `UNPROBED`, reason `BLOCKED: no Docker in this session (pending the Docker foundation PR)`.

## 6. Proposed NEW-TWISO probes (source-level expectations only; no live run)

| ID | Question | Source expectation at `7cbdfec6` | Status |
|---|---|---|---|
| NEW-TWISO-1 | Sandbox filesystem: can a logic function read a server file identified by a hash-checked canary created by the run? | The child is a full Node process with the server environment (E6). The file read is not restricted in the files read. | UNPROBED; needs a harness file-canary item that is **not** in `v0.4.0` (plan section 5). |
| NEW-TWISO-2 | Sandbox child process or module import outside an allowlist is refused | Not restricted in the local runner read (`local-child-process-runner.service.ts:170`). Expected design verdict. | UNPROBED (no allowlist exists to test); gated on `LOGIC_FUNCTION_TYPE` (pin bump). |
| NEW-TWISO-3 | Batched mutations keep per-operation authorisation | Batching not configured (C6). Authorisation is per resolver and not read here. | UNPROBED; needs the Yoga default read from an installed fork and a restricted throwaway role. |
| NEW-TWISO-4 | Persisted or depth-limited subscriptions, if exposed | Not read. | UNPROBED; exposure probe first. If no subscription route exists, the row is recorded N/A, never PASS. |
| NEW-TWISO-5 | No-secrets positive control for `tw-iso` and `tw-limiter-last` | Already tested in `tests/unit/ci/workflow.test.ts:224-229` (test 13) for `p5-tw-iso.yml` and the caller job. | CONFIRMED for the stub. A per-job assertion would be a foundation change. |

## 7. Blockers and UNPROBED list

| Item | Blocker string |
|---|---|
| All live items (A2, B3, C1 to C6 live, D1 live, D4 live, E2 live, E6 live, section 5) | `BLOCKED: no Docker in this session (pending the Docker foundation PR)` |
| SND-001 to SND-004 at the installed pin | `BLOCKED: LOGIC_FUNCTION_TYPE not in harness v0.3.1` (gate: P5 pin bump to `v0.4.0`) |
| SND-001 canary (presence proof) | `BLOCKED: canary presence proof not defined (P-12, plan D-P12)` and the no-Docker blocker |
| GQL-004 | `BLOCKED: P-9 not probed (gate P-9)` and the no-Docker blocker |
| G1 | `CONTRADICTS: --no-deps not in harness up interface (owner X-2)` |
| G3 | `ENV: Node 24 reports v24.22.1, approved v24.22.0 (owner decision)` |

## 8. Checks

Recorded in the PR body (`npm ci`, `npm run check:static`, `npm run unit`, `npm run list:lanes`, and the exact counts). The probe record itself changes no check result.
