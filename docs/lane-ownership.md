# Lane ownership, vendoring and gate rules

Generated from plan `docs/plans/2026-11-08-p5-master-plan.md` sections 6, 7.2 and 9.1 and 9.13. This file restates them; the plan controls scope. Change the plan first (through a foundation PR) before changing this file.

## Ownership map (plan section 6)

| Rule | Detail |
|---|---|
| File ownership | Lanes own `src/lanes/<code>/`, `tests/<kind>/<code>/` (kinds: `contracts`, `webhooks`, `integration`, `serial`, `ui`), `tests/unit/lanes/<code>/`, `.github/workflows/p5-<code>.yml`. L-TW-B owns `src/lanes/tw-iso/`, `tests/iso/tw/`, `tests/limiter-last/tw/`, `.github/workflows/p5-tw-iso.yml`. L-PIPE owns `scripts/scan/`, `config/scan/` (except `config/scan/implementation-status.json`, which is foundation-owned and flipped by each implementing PR), `.github/workflows/p5-scans.yml`, `.github/workflows/p5-zap-nightly.yml`, `.github/workflows/codeql-reusable.yml`. X owns `docs/` closeout files, `src/lanes/x/`, `tests/closeout/medusa/`, `tests/closeout/twenty/`, `.github/workflows/p5-x.yml`. |
| Foundation owns | `src/kit/`, `src/security/`, `scripts/` (except `scripts/scan/`), `package.json`, `package-lock.json`, `tsconfig.json`, `playwright.config.ts`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `.github/workflows/foundation.yml`, `docs/SECURITY-SCOPE.md`, `docs/SEVERITY.md`, `docs/lane-ownership.md`, `docs/findings/`, `.github/pull_request_template.md`, `AGENTS.md`, `CLAUDE.md`. Changes go through a foundation PR. |
| One product per job | A job starts at most one product stack. Stacks always end with `down`, in a `finally` step. |
| Independent controls | Every negative mutation uses its own fixtures. A positive control never changes the state a negative check reads from an earlier step. Before/after state is captured for each mutation. |
| Brute force | Throwaway users only, created per run with the run prefix. Never a seed user. |
| SSRF and egress | Run in a profile with an EMPTY outbound allowlist, plus the owner-controlled canary and allowed control (section 8). |
| Sandbox | `tw-iso` has no `secrets:` key and no repository secrets. |
| Limiter-changing rows | Only GQL-004, and only on its own fresh functional-profile stack that runs last. |
| Cleanup and leaks | Every test cleans in `finally`. A sweep runs after each test and a leak check runs before the job ends. Auth tokens and API keys created by the run are revoked before `down`. |

## Vendoring table (plan section 7.2, closure)

Each row names the P2 source at `99a2fde`. Only the changes in plan section 7.2.2 are allowed. Anything else is a stop.

| Vendored file (dest) | P2 source (99a2fde) | Direct imports after relocation | Needed by |
|---|---|---|---|
| `src/kit/webhooks/sign.ts` | `src/webhooks/sign.ts` | `node:crypto`, `stripe` | P5-CAL-WH-002/003, MI-10 |
| `src/kit/webhooks/verify.ts` | `src/webhooks/verify.ts` | `sign.ts`, `stripe` | P5-CAL-WH-002/003 |
| `src/kit/webhooks/receiver.ts` | `src/webhooks/receiver.ts` | `../run/prefix.ts`, `./redact.ts` | P5-CAL-WH-002 |
| `src/kit/webhooks/redact.ts` | `src/webhooks/redact.ts` | none | receiver, artefacts |
| `src/kit/webhooks/reach.ts` | `src/webhooks/reach.ts` | `../env.ts` (ProductId type), `./docker-net.ts` | receiver reach |
| `src/kit/webhooks/docker-net.ts` | `src/webhooks/docker-net.ts` | `node:child_process`, `node:net` | reach |
| `src/kit/db/pg.ts` | `src/db/pg.ts` | `pg`, `../env.ts` (`dbStatementTimeoutMs`, `roleDbUrl`, `ProductId`), `./select-guard.ts` | all read-only checks |
| `src/kit/db/select-guard.ts` | `src/db/select-guard.ts` | none | pg |
| `src/kit/db/roles.ts` | `src/db/roles.ts` | `./fixture-allowlist.ts` (type) | P5-TW-SEC-001 |
| `src/kit/db/fixture-allowlist.ts` | `src/db/fixture-allowlist.ts` | `../env.ts` (`ProductId` type) | roles |
| `src/kit/db/roles-admin.ts` | `src/db/roles-admin.ts` | `pg`, `../env.ts` (`dbUrl`, `loadEnv`, `ProductId`), `./fixture-allowlist.ts`, `./roles.ts` | role provisioning via `scripts/db-roles.ts` |
| `src/kit/run/prefix.ts` | `src/run/prefix.ts` | `node:crypto` | every run |
| `src/kit/shared/cleanup.ts` | `src/shared/cleanup.ts` | none | every lane's `finally` |
| `src/kit/ci/known-defect.ts` | `src/ci/known-defect.ts` | `@playwright/test` | `test.fail` helper |
| `src/kit/ci/known-defect-guard.ts` | `src/ci/known-defect-guard.ts` | `typescript`, `node:fs`, `node:path` | guard (exemption path updated) |
| `src/kit/ci/playwright-json-summary.ts` | `src/ci/playwright-json-summary.ts` | none | summaries |
| `src/kit/readiness/checks.ts` | `src/readiness/checks.ts` | `../db/pg.ts`, `../env.ts` (`ProductId`), `node:crypto`, `node:path` | readiness |
| `src/kit/readiness/canary.ts` | `src/readiness/canary.ts` | none | canary precondition |
| `src/kit/auth/secret.ts` | `src/auth/secret.ts` | `node:util` | artefact scrubbing |
| `src/kit/auth/reaper.ts` | `src/auth/reaper.ts` | none | leak sweep |
| `src/kit/invariants/engine.ts` | `src/invariants/engine.ts` | `../run/prefix.ts`, `../db/select-guard.ts`, `../db/pg.ts` (type) | sweeps |
| `src/kit/invariants/after-test.ts` | `src/invariants/after-test.ts` | `../db/pg.ts` (type), `./engine.ts` | sweep after each test |
| `src/kit/env.ts` | NEW, trimmed from P2 `src/env.ts` (section 7.2.1) | `node:net`, `zod` | all |
| `scripts/db-roles.ts` | `scripts/db-roles.ts` | `../src/kit/env.ts` (`PRODUCT_IDS`, `ProductId`; P2 import was `../src/env.ts`, line 3), `../src/kit/db/roles-admin.ts` (`provisionProduct`, `teardownRoles`, `withAdmin`; P2 import was `../src/db/roles-admin.ts`, line 4) | vendored, not wired (no npm script; owner-approved script change required) |
| `scripts/write-ci-job-summary.ts` | `scripts/write-ci-job-summary.ts` | `../src/kit/ci/playwright-json-summary.ts` (path adapted) | job summary |
| `tests/unit/webhooks/vectors.ts` | same | none | sign and verify tests |

Not vendored, with reason: P2 lane-specific code under `src/lanes/`, `src/clients/`, `src/contracts/`, `src/slo/`, `src/fixtures/`, `src/db/fixture.ts`, `src/auth/reaper-run.ts`, `src/auth/reaper-revoke.ts` (they revoke P2 keys; P5's revocation rows are separate), `src/auth/lifecycle.ts`, `src/auth/*` product clients.

Recorded adaptation (F0-5a, L-PIPE plan section 11.1 and 5.5.1): `src/kit/ci/playwright-json-summary.ts` `escapeCell` escapes a backslash before the pipe escape (CodeQL `js/incomplete-sanitization`, a true positive, probe 2c). The matching row in master-plan section 7.2.2 lands in foundation PR F0-5b (d).

## Gate rules (plan 9.1 and 9.13)

- The required status check is `gate` only (owner step, plan section 12).
- `gate` needs every job and runs `if: always()`. Changes and foundation must succeed; each lane whose flag is true must succeed; a skipped lane is allowed only when its flag is false.
- When `p5_scans` is true, `p5-scans` must succeed and each scanner reports `pass`, `fail` or `not-implemented`, or `skipped` for the report-only `syft` and `zap` once implemented (O-15). A stub reports `not-implemented` only. An implemented scanner reporting `not-implemented` fails the gate.
- When `p5_codeql` is true, `codeql_verdict` is `pass`, or `not-implemented` while CodeQL is a stub. `fail` blocks.
- The registry is `config/scan/implementation-status.json` (foundation-owned). Each implementing PR flips its own entry in the same PR.

## Lane records, closeout paths and shared tool locks (lane foundation PR)

These rows apply the lane-plan decisions cited in each row. A row here takes precedence over the broad "X owns `docs/` closeout files" rule in the ownership map. The matching master-plan section 6 text is updated in a separate owner PR.

| Path | Owner | Contents | Basis |
|---|---|---|---|
| `docs/verdicts/cal/` | L-CAL | one record per verdict, `<ID>.md` | cal plan 4.3 and 5 (`docs/plans/2026-11-10-p5-cal.md:178`, `:305`) |
| `docs/verdicts/doc/` | L-DOC | one record per verdict, `<id>.md` | doc plan F-3 and O-4 (`docs/plans/2026-11-10-p5-doc.md:155`, `:536`) |
| `docs/verdicts/tw/` | L-TW-A | `mi-7.md`, `mi-8.md` (owner-set names) | tw plan RC-7 (`docs/plans/2026-11-10-p5-tw.md:177`, `:649`) |
| `docs/verdicts/tw-iso/` | L-TW-B | `<ID>.md`, the exact master-plan ID | tw-iso plan X-1 (`docs/plans/2026-11-10-p5-tw-iso.md:180`, `:220`, `:757`) |
| `docs/verdicts/x/` | X | `<ID>.md` | x plan 4.1 and 8 (`docs/plans/2026-11-10-p5-x.md:90`, `:278`) |
| `docs/capabilities/` | L-MED (L-CAL reads it) | capability documents, first `guest-cart-and-uid.md` | cal plan 4.3 (`docs/plans/2026-11-10-p5-cal.md:176`), med plan 3b (`docs/plans/2026-11-10-p5-med.md:140`) |
| `README.md` | X | the README landing | x plan D-6 (`docs/plans/2026-11-10-p5-x.md:20`, `:108`) |
| `docs/threat-models/<product>.md` | X | one-pagers, IDs and status only (`TEMPLATE.md` unchanged) | x plan 4.1 (`docs/plans/2026-11-10-p5-x.md:81`) |
| `docs/design/` | X | design notes, first `webhook-authenticity.md` (MI-11) | x plan 4.1 (`:82`) |
| `docs/public-drafts/` | X | `index.md` | x plan 4.1 (`:83`) |
| `docs/traceability/` | X | `p7-aliases.md` | x plan 4.1 (`:84`) |
| `tests/unit/lanes/x/` | X | X unit tests | x plan D-7 (`:21`, `:108`) |
| `tests/unit/lanes/tw-iso/` | L-TW-B | tw-iso unit tests | tw-iso plan 7 (`docs/plans/2026-11-10-p5-tw-iso.md:212`) |
| `requirements/` | Foundation | shared hashed Python tool locks (`schemathesis.in`, `schemathesis.txt`); one tool per file | doc F-5, med D-MED-5, tw RC-13, cal 4.4 |

## Vendored contracts (lane-owned data files)

Each file is copied byte-identical by its lane build and checked by sha256. Source repository: `Jayami123/api-webhook-db-test-suite` at `99a2fdebbb60aac196fcb0fce16911e36a0d5c0a`. The lane keeps a `PROVENANCE.md` next to the file (source, ref, sha256, fetch date).

| Vendored file (dest) | Source path | Bytes | sha256 | Change | Needed by |
|---|---|---|---|---|---|
| `src/lanes/cal/contracts/openapi-v2.json` | `contracts/cal/openapi-v2.json` | 560358 | `3c2849d89d8f352d719ef073bf9e0c39ce981aa1a6c9e5066b3a744b68bfc41a` | none | PN-2 (L-CAL) |
| `src/lanes/doc/contracts/openapi.json` | `contracts/doc/openapi.json` | 1796397 | `37a55f222bb8de14ecfc66c1bfaad3e51f8b6edfb2b2ee8cb34aa9dcb3a6a87f` | none | PN-3 (L-DOC) |
| `src/lanes/med/contracts/store.openapi.full.yaml` | `contracts/med/upstream/store.openapi.full.yaml` | 1699076 | `cc4af9d7b00fead80c8ab75bd3b2ab97fec0397086bc0d0eccc2f7cb12b7032a` | none | FUZZ-001 (L-MED) |
