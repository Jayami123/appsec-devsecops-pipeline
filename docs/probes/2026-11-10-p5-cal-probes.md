# P5 L-CAL probe record (2026-11-10)

Status: PROBE RECORD ONLY. No stack was started, seeded or stopped. No fork, harness, `node_modules` (other than `npm ci`), `.env` or product database was written. Every value below cites its source, and every item not run is UNPROBED with its reason.

Base: `origin/main` = `f4fe6c1` (PR #7 merged; PR #8 merged at `3a97346`). Branch `plan/2026-11-10-p5-cal`. Companion plan: `docs/plans/2026-11-10-p5-cal.md`.

Master plan citations use the numbering of the revision the brief names (`298ae29`, written `MP@298ae29:<n>`). The current file on `main` is shifted (see plan section 0.3); the current line is given in brackets where it was checked.

## 0. Summary

| Area | Result |
|---|---|
| Stack lifecycle (`up.mjs cal`, `down.mjs cal`) | NOT RUN. STOP 8 (section 15 item 8, current 893): Docker is unavailable (`docker info` failed in this session). |
| P-15 harness Cal `.env` route | UNPROBED live. Static: the API reads the root `.env`; the harness writes no Cal `.env`. The web-side env source is not settled (section 3a). |
| P-5 seed OAuth client, PKCE route, organisation, `NEXT_PUBLIC_IS_E2E` | UNPROBED live. Static: the harness sets no `SEED_OAUTH2_*` and no `NEXT_PUBLIC_IS_E2E`. |
| P-6 booking call path for the Unkey helper | UNPROBED (call path not traced). Helper no-op condition CONFIRMED on source. |
| P-13 Cal mail catcher | BLOCKED: no mail catcher for Cal in harness v0.3.1. |
| Webhook kit against the Daily route | UNPROBED live. Vendored signer present in `src/kit/webhooks/sign.ts`. |
| RL-002 effective API-key limit from stack config | BLOCKED: no harness route to read the effective value at v0.3.1. |
| Alias re-reads at P2 `99a2fde` | CONFIRMED (ranges below; two line-range corrections). |
| Cron route enumeration at Cal `c2b7ac44` | CONFIRMED: 7 routes, one row each (section 5). |
| Headers and redirect code path | CONFIRMED partially; live headers UNPROBED. |
| Checks (`npm ci`, `check:static`, `unit`, `list:lanes`) | See section 8. |

## 1. Sources and method

| Item | Value |
|---|---|
| Cal fork | `https://github.com/Jayami123/cal` at `c2b7ac44c66f24ffef1662b276f0653988a609a3` (the `bootstrap.sh` `CAL_REF`, `scripts/bootstrap.sh:18`). Read via a shallow anonymous fetch of that SHA into a directory outside the repository. |
| P2 `api-webhook-db-test-suite` | `99a2fde` (present in fetched history; `git cat-file -t` = commit). Read with `git show 99a2fde:<path>`. |
| Harness | `qa-portfolio-harness` package `0.3.1`, read from `node_modules/qa-portfolio-harness` after `npm ci`. The `package.json` reports version `0.3.1`. The lockfile's tag SHA was not separately verified. |
| Our merged kit | `src/kit/webhooks/sign.ts` and `src/security/*` present on `main` (F0-2). |

### 1.1 Rule deviations recorded (not hidden)

1. The brief says to clone forks only with `NODE24=<abs> PRODUCTS_ROOT=<path> bash scripts/bootstrap.sh cal`. I did not run bootstrap. I fetched the Cal and P2 sources as read-only shallow fetches (the read path the access tool offered for public repositories). No stack, no `npm ci` inside a fork, and no fork write. Any later live run must use bootstrap.
2. The brief asks to attach the harness with `add_repo`. That call was denied by the permission classifier. I did not work around the denial. The harness source is read from the installed package (item 1 above), which `npm ci` installs from the pinned dependency. The denial is reported to the owner.

## 2. Stack-state gate

| Step | Command | Exit | Output |
|---|---|---|---|
| Docker check | `docker info` | non-zero | "unavailable" (session has `/usr/bin/docker` but no usable daemon) |
| Bootstrap (cal) | not run | n/a | Not run: the plan's rule requires the Docker gate first; forks are not needed for static reads. |
| `up.mjs cal` | not run | n/a | STOP 8 (Docker unavailable). |
| Readiness output | none | n/a | none |
| `down.mjs cal` | not run | n/a | No stack to tear down. The `trap ... EXIT` wrapper is not used because nothing started. |

No probe actor, token or API key was created. Nothing needed revoking.

## 3. Probe items

### 3a. P-15 (gates every Cal row)

| Check | Source | Result |
|---|---|---|
| API required keys at the adapter | `fork ref held by the owner` | CONFIRMED. `CAL_API_REQUIRED_ENV` = `DATABASE_URL`, `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`. |
| API reads the product root `.env` | `fork ref held by the owner` | CONFIRMED. `rootEnvFile = path.join(productRoot, ".env")`; the API env builder gets `processEnv: process.env`. |
| API env accepts variables from the environment of `up` | `src/adapters/cal-api-env.ts:27-30`, `:84-89` | CONFIRMED. A missing key may come from "the environment of up, or in the Cal product .env". Message names only, no value. `DATABASE_URL` is set from `CAL_DB_URL` (`:90`). |
| API no-fallback key list | `fork ref held by the owner` | CONFIRMED. Includes `NEXTAUTH_SECRET` (`:16`) and `CALENDSO_ENCRYPTION_KEY` (`:17`). |
| Harness writes a Cal `.env` | `fork ref held by the owner` is the only write in that file | CONFIRMED NO WRITER. The write at `:268` is a harness build marker. A grep hit on `.env` in `fork ref held by the owner` was checked and is not a `.env` write. |
| Web-side env | `fork ref held by the owner` (spawn with `env: calNodeHeapEnv(process.env)`) | Harness passes only the process env to the web server. Whether Next.js in the Cal fork reads the fork's root `.env` for the web app is NOT settled statically. |
| Live readiness | not run | UNPROBED (Docker unavailable). |

Result: P-15 is UNPROBED. The API side needs no fork `.env` (CONFIRMED on source). The web side decides the gate. Per the brief: if the web app still needs the fork `.env`, every Cal row is gated "harness must provision Cal .env" (MP@298ae29:807 [current 826 region of section 10.4]). No `.env` was written.

### 3b. P-5 (Cal OAuth, PKCE, organisation, E2E flag)

| Check | Source | Result |
|---|---|---|
| Harness seed names `SEED_OAUTH2_*` | grep of `node_modules/qa-portfolio-harness/src` | CONFIRMED NONE. No `SEED_OAUTH2` name in harness source. |
| Seed call env | `fork ref held by the owner` (`runCapture(resolveYarn(), ["db-seed"], { cwd, timeoutMs, redactLine })`) | CONFIRMED. The options pass no `env` key. Fact 19 (inherit process env) is consistent with this. |
| Seed creates an OAuth client | Cal `scripts/seed.ts:1015-1026` (fact 9, not re-read in this run) | UNPROBED live. |
| Normal-route PKCE client | Cal `fork ref held by the owner` (`createClient`, admin) and `:32` (`generateAuthCode`) | UNPROBED. The route that enables PKCE was not enumerated. Fact 9 (seed `enablePkce: false`) stands as recorded. |
| Normal-route organisation for CSV-001 | not traced | UNPROBED. |
| `NEXT_PUBLIC_IS_E2E` unset | harness: no reference in `src/` (grep) | CONFIRMED NOT SET BY HARNESS. Cal readers: `fork ref held by the owner`, `:240`, `:281`; `fork ref held by the owner`. Live value UNPROBED. |

### 3c. P-6 (booking call path for the Unkey helper)

| Check | Source | Result |
|---|---|---|
| Helper no-op when `UNKEY_ROOT_KEY` is unset | Cal `fork ref held by the owner` (guard) and `:41` (returns `success: true`) | CONFIRMED. Fact 11 holds. |
| `UNKEY_ROOT_KEY` in the root env example | Cal `.env.example:370` (name present, empty value) | CONFIRMED. |
| Harness sets `UNKEY_ROOT_KEY` | grep of `src/adapters/cal*.ts` | CONFIRMED NONE. Live stack value UNPROBED. |
| Callers of the helper | `fork ref held by the owner`, `fork ref held by the owner`, two-factor routes | CONFIRMED callers are auth routes. |
| Callers in the booking path | searched `fork ref held by the owner`, `fork ref held by the owner`, `fork ref held by the owner`, `fork ref held by the owner` for `rateLimiter` / `checkRateLimitAndThrowError` | No caller found in those paths. The booking call path is NOT traced; reach is UNPROBED. D7 wording ("a no-op without the key; the booking call path is not traced") is therefore correct as written. |

### 3d. P-13 (mail catcher)

| Check | Source | Result |
|---|---|---|
| Mail catcher in Cal's compose files | `fork ref held by the owner`, `cal.pg-stats.compose.yml`, `cal.redis.compose.yml` | CONFIRMED NONE. The only image in the Cal redis file is `redis:7` (`fork ref held by the owner`). |
| Mail catchers in the harness | `documenso.compose.yml`, `twenty.compose.yml`, `twenty.replicas.compose.yml` | `mailpit` or `inbucket` appear there, not in any Cal file. |

Result: BLOCKED: `mail catcher for Cal` not in harness v0.3.1. P5-CAL-XSS-002 stays gated (MP@298ae29:860 P-13 "Gated until shown").

### 3e. Webhook kit against the Cal Daily route

| Check | Source | Result |
|---|---|---|
| Vendored signer | `src/kit/webhooks/sign.ts` (merged, F0-2) | CONFIRMED present. |
| Daily route exists | Cal `fork ref held by the owner` | CONFIRMED present. Handler not read in this run. |
| Delivery accepted by the route | live | UNPROBED (no live stack). |
| Business state changed by the first delivery | Cal route handler not read | UNPROBED. WH-002 needs it (MP@298ae29:123). |

### 3f. RL-002 effective API-key limit

| Check | Source | Result |
|---|---|---|
| Effective `RATE_LIMIT_DEFAULT_LIMIT_API_KEY` in the stack | harness: no pass-through (grep of `src/adapters/cal*.ts`) and Cal `.env.example`: name not present | BLOCKED: no harness route reads the effective value at v0.3.1 (the brief's rule 5: UNPROBED with blocker). |
| Default 120 per 60 s | fact 11 (`fork ref held by the owner`) | Recorded fact; not re-read in this run. |

### 3g. Alias re-reads at P2 `99a2fde`

`tests/webhooks/cal/cal-dly.spec.ts` test blocks (each `test(` to its `});`):

| Test | Lines | Note |
|---|---|---|
| P2-CAL-DLY-002 tampered body, old signature, 403 | 23-40 | Fact 17 range `:23-40` CONFIRMED. |
| P2-CAL-DLY-002 canonical signature accepted, payload 400 | 42-61 | Fact 17 gives `:42-60`. Correction: closing `});` is at 61. |
| P2-CAL-DLY-002 unknown type with valid signature, 200 | 63-80 | Fact 17 gives `:63-79`. Correction: closing `});` is at 80. |
| P2-CAL-DLY-002 non-canonical raw-signed body refused | 82-101 | Not in fact 17. |
| P2-CAL-DLY-003 test request answered 200, writes nothing | 103-(end not read) | MI-10 reuse. "Writes nothing" oracle UNPROBED (body not read). |

The ALIAS row cites `:38-80` (MP@298ae29:192). Line 38 is inside test 1; the span is wider than any single test. Recorded correction C3 (plan section 6).

`tests/integration/cal/cal-framework.spec.ts`:
- FC-1 test starts at `:32`. It checks two helper families: `runTaskerOnce` with `CRON_SECRET` (expects 401 for a wrong key, 200 for the right one) and `fireScheduledTriggersOnce` with `CRON_API_KEY` (same expectations).
- The helper-to-route mapping is in `src/lanes/cal/cron.ts` (imported at `:6`), not read in this run. So FC-1's two route names are UNPROBED by name. MP:194 "not re-read" is now partly re-read.

### 3h. Cron routes at Cal `c2b7ac44` (one row per route; MP@298ae29:930 cron rows)

Enumeration: `fork ref held by the owner` (7 files).

| Route file | Check line | Key name compared | Also accepts |
|---|---|---|---|
| `fork ref held by the owner` | `:19` | `CRON_API_KEY` (strict `!==`) | none |
| `fork ref held by the owner` | `:19` | `CRON_API_KEY` | `Bearer ${CRON_SECRET}` |
| `fork ref held by the owner` | `:27` | `CRON_API_KEY` | `Bearer ${CRON_SECRET}` |
| `fork ref held by the owner` | `:27` | `CRON_API_KEY` (strict) | none |
| `fork ref held by the owner` | `:30` | `CRON_API_KEY` | `Bearer ${CRON_SECRET}` |
| `fork ref held by the owner` | `:23` | `CRON_API_KEY` (strict) | none |
| `fork ref held by the owner` | `:11` | `CRON_API_KEY` (strict) | none |

Scope limit: this enumerates only `fork ref held by the owner`. Cron handlers elsewhere (for example `fork ref held by the owner`) were not searched. Every row is CONFIRMED on source. The empty-env edge (key unset in the environment) is UNPROBED.

### 3i. Headers and redirect

| Check | Source | Result |
|---|---|---|
| Baseline headers | `fork ref held by the owner`, `:436` (`X-Frame-Options`), `:445` (`X-Content-Type-Options`) | CONFIRMED on source. No CSP match in `next.config` or `middleware`. Live response headers UNPROBED. |
| successRedirectUrl parse | `fork ref held by the owner` (parameter), `:203` (`new URL(successRedirectUrl)`), `:212-221` (external redirect handling) | CONFIRMED the URL is parsed at `:203`. No scheme or host allowlist found in that file. Whether validation happens earlier (schema layer) is UNPROBED. |

### 3j. PN-2 OAS source (measured for provenance)

| Check | Source | Result |
|---|---|---|
| P2 OAS at `99a2fde` | `git show fork ref held by the owner` | CONFIRMED present; 560358 bytes; sha256 `3c2849d89d8f352d719ef073bf9e0c39ce981aa1a6c9e5066b3a744b68bfc41a`; measured 2026-11-09; the commit has no tag (UNVERIFIED tag: none found, not searched further). |
| Schemathesis pin | not present in `package.json` on this branch | UNVERIFIED: the owner-set 4.33.1 pin is not in the repo; the foundation PR adds it with a fully hashed lock. |

### 3k. Harness v0.4.0 (VERIFIED on the harness repo)

| Check | Source | Result |
|---|---|---|
| PR #49 merged | `Jayami123/qa-portfolio-harness` `d342a8b` (merge of `feat/2026-11-10-cal-root-env`) | VERIFIED (fetched from `main`). |
| Tag `v0.4.0` | `git ls-remote --tags`: tag object `6bb2c238e97589de06ec28a277412313ddc7594b`, peeled `31cafc0844d441a8567db89cd18612300c3d4b77` | VERIFIED. The PR #49 merge is an ancestor of the peeled commit. |
| Cal root `.env` writer | `src/adapters/cal-env.ts` (`ensureCalRootEnv` imported at `fork ref held by the owner`; called at `:642-644`) at `31cafc0` | VERIFIED static. Live behaviour UNPROBED (Docker unavailable). |
| H-1 mail catcher, H-2 effective limit, H-3 `SEED_OAUTH2_*` in v0.4.0 | grep of `docker/cal*`, `src/adapters/cal*`, whole tree at `31cafc0` | No match for `mailpit`/`inbucket`, `RATE_LIMIT_DEFAULT`/`UNKEY`, or `SEED_OAUTH2`. Still open (VERIFIED static). |

## 4. Fact status (plan section 2 facts touched by this probe)

| Fact | Status in this run |
|---|---|
| 9 | Not re-read (`_router.tsx`, `seed.ts`); recorded status stands. |
| 10 | Not re-read (`UserListTable.tsx`); recorded status stands. |
| 11 | Helper guard CONFIRMED (`fork ref held by the owner`); throttler not re-read. |
| 17 | CONFIRMED with two closing-line corrections (section 3g). |
| 19 | Seed options at `fork ref held by the owner` CONFIRMED with no env key. |
| 22 | Not re-read in this run (the P2 `prepare_cal_env` is removed in `scripts/bootstrap.sh`; confirmed by the file's header). |

## 5. Contradictions

None found. No row of the plan's fact list is CONTRADICTED by source at its pin. The two line-range differences in section 3g are corrections to the citations, not to behaviour.

## 6. Corrections found by this probe

| # | Correction | Evidence |
|---|---|---|
| C1 | The lane header omits P-15, which gates every Cal row. | MP@298ae29:920 (current 939). |
| C2 | PN-2 (Cal Schemathesis) is missing from the 19.1 table. | MP@298ae29:250 (current 250). |
| C3 | WH-001 alias range: DLY test blocks are `42-61` and `63-80`; fact 17 says `42-60` and `63-79`. | Section 3g. |
| C4 | The TOK-001 budget row (MP@298ae29:129) names `RESET_CONCURRENT_N`; the budget table and test list use `CAL_RESET_CONCURRENT_N`. | MP@298ae29:129 vs MP@298ae29:645 (current 660). |
| C5 | `docs/capabilities/` has no owner in the file ownership table. | MP@298ae29:346-347 (current 346-347). The directory does not exist on `main`. |
| C6 | `src/lanes/cal/csv-corpus.ts` is required by X and is not in the L-CAL table. The brief's MP:706 citation is wrong: the X dependency is at MP@298ae29:340 and MP@298ae29:706 is not about CSV; the csv-corpus wiring is in sections 9.7 and 19.7 (current 721 and 1073). | Checked on current file. |
| C7 | "Login helpers" is named at MP@298ae29:337 (ZAP switch) but not defined anywhere. The brief's MP:1039 is a Sandbox egress row. | Checked on current file. |
| C8 | Burst and limiter rows (2FA-001, TOK-001 under `tests/integration/cal`; RL-002 under `tests/contracts/cal`) should move to `tests/serial/cal/`. | Current rows 952-954 (`docs/plans/2026-11-08-p5-master-plan.md`). |
| C9 | The brief's MP line cites are at revision `298ae29`. Current `main` (`f4fe6c1`) has the recorded corrections, so section 15 moved from 863 to 882 and section 19.1's header moved from 920 to 939. Citations in these files use `MP@298ae29` with the current line in brackets. | Checked: current 882, 898, 914, 929, 939. |
| C10 | The `BLOCKED: <item> not in harness <version>` format is defined in section 11 (current 826), not at MP:807. | Current file. |
| C11 | The "harness must provision Cal .env" gate is in section 10.4 (current 807), not at MP:788. MP:788 is the Claude Code setup-script text. | Current file. |
| C12 | "Do not build around it" is STOP condition 9 (current 894), not MP:875 (a risk-table row). | Current file. |
| C13 | The brief's budget cites (MP:633-658, MP:640-641, MP:645-646, MP:652-653) fall in sections 7.4, 7.5 and 8 of the older numbering. The budget table is at current 652-673. | Current file. |
| C14 | The brief's probe-list cites (MP:833-843) are the probe table at current 846-862 (P-5 at 852, P-6 at 853, P-13 at 860, P-15 at 862). | Current file. |
| C15 | Harness pin rule cited as MP:629-631 is the upgrade rule at current 644-646 (section 7.5). | Current file. |

## 7. UNPROBED and BLOCKED items (for the PR body)

| Item | Status | Reason |
|---|---|---|
| P-15 live readiness; web-side `.env` need | UNPROBED | STOP 8: Docker unavailable. Every Cal row remains gated "harness must provision Cal .env" until a live run settles the web side. |
| P-5 OAuth seed client creation | UNPROBED | Docker unavailable. |
| P-5 PKCE client through a normal route | UNPROBED | Route not enumerated; live creation not run. |
| P-5 organisation for CSV-001 | UNPROBED | Route not traced; live not run. |
| P-5 `NEXT_PUBLIC_IS_E2E` live value | UNPROBED | Harness sets none (CONFIRMED static); live env not read. |
| P-6 booking call path for the Unkey helper | UNPROBED | Call path not found by search; not traced. |
| P-13 Cal mail catcher | BLOCKED: `mail catcher for Cal` not in harness v0.3.1 | Section 3d. |
| Webhook delivery accepted by Cal Daily route | UNPROBED | Docker unavailable; handler not read. |
| WH-002 business state on first delivery | UNPROBED | Handler not read. |
| RL-002 effective API-key limit | BLOCKED: `effective RATE_LIMIT_DEFAULT_LIMIT_API_KEY read` not in harness v0.3.1 | Section 3f. |
| Live response headers and successRedirectUrl validation | UNPROBED | Docker unavailable; schema layer not traced. |
| P2 DLY-003 "writes nothing" oracle | UNPROBED | Test body after `:103` not read. |
| FC-1 route names | UNPROBED by name | `src/lanes/cal/cron.ts` not read. |
| Cron handlers outside `fork ref held by the owner` | UNPROBED | Not searched. |
| `bootstrap.sh cal`, `up.mjs`, `down.mjs` | NOT RUN | STOP 8 (Docker unavailable); bootstrap not needed for static reads. |

## 8. Checks at the branch head

Recorded at the commit that adds these two files (see the PR body). The tree before this PR's files was checked first:

| Check | Result |
|---|---|
| `npm ci` | exit 0 (installs the pinned harness `0.3.1`). |
| `npm run check:static` | exit 0 (`tsc -p tsconfig.json` clean). |
| `npm run unit` | `# tests 346`, `# pass 346`, `# fail 0`. |
| `npm run list:lanes` | exit 0; prints `Total: 0 tests in 0 files`. |

The unit total is the measured count on `main` plus this branch's docs-only change (no test file changed).
