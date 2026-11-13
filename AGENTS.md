# Agent and human rules: P5 AppSec and DevSecOps pipeline

These rules apply to every agent and person who changes this repository. They restate the merged
master plan's section 16 and the applicable builder STOP conditions of section 15. The plan at
`docs/plans/2026-11-08-p5-master-plan.md` controls scope. This repository is currently the F0-1
skeleton: it contains configuration, the Playwright project map, bootstrap scripts and two
configuration unit tests. It contains no product test, no product source and no scanner.

## Scope and status

- Local pinned targets only. Product forks and images are pinned by commit SHA or image tag; never
  test a live, third-party or production target. No active DAST on pull requests.
- Private-first items are recorded by ID and status only. Add no mechanism, title, payload, literal,
  test name or product context for them, and no keyword-matching CI check for their IDs.
- A checklist row is never counted as built, proved or closed by a configuration change. Gated rows
  keep their named gate; a gated row is never counted as built.
- P1 UI-only conventions do not turn this P5 skeleton into UI coverage. UI work is `cal-ui` and the X `twenty-closeout` CSV export leg (owner decision D-2) only,
  and only where a later PR adds it with probe evidence.
- Do not add product source (`src/`), copied test kits, fixtures, scanners, a findings ledger or CI
  gates in a PR that the plan does not assign to it.

## Lifecycle, forks and the harness

- Product lifecycle (bring up, seed, tear down) is performed only through the harness. Never run a
  product's lifecycle by hand, never reset a whole stack volume as a P5 mechanism, and never use an
  unscoped reset or flush.
- Never edit a product fork, its `node_modules`, the harness package, or a fork's `.env` by hand.
  Fork `.env` provisioning is harness-owned. P5 does not write, copy or generate seed secrets.
- Never edit `node_modules` by hand. Dependency installs use the lockfile (`npm ci`) and the
  pinned product references only.
- The harness is pinned to `qa-portfolio-harness` `v0.5.1`. Any upgrade is one foundation PR that
  changes `package.json`, `package-lock.json` and the unit assertion together (plan section 7.5).

## Failure classification and test rules

- Root-cause every failure before changing anything. Label each surprise as exactly one of:
  - `PRODUCT BUG (SUSPECTED)`: the product behaves against the cited contract; attach status, body
    and file:line evidence.
  - `TEST BUG`: the test or its oracle is wrong.
  - `ENV`: a missing runtime, blocked host, unavailable service or unusable tool. Attach the exact
    sanitized failure.
- Never weaken an assertion, widen a tolerance, add a retry or skip, add a sleep, or raise a timeout
  or budget to get green. Async waits use `expect.poll` with a named deadline.
- `test.fail` is allowed only for a proven public product defect: setup is asserted first, then the
  precise product assertion, with a bug ID and scrubbed evidence attached. Framework, transport and
  cleanup failures are never expected product failures. Never use `test.fail`, `.skip` or `.only`
  to hide a failure.
- Every negative check has an independent valid control. Every mutation has before and after state
  checks. Cleanup runs in `finally`, followed by a sweep and a leak check. Revoke any created auth
  token or API key before the harness tears a stack down.
- Data isolation is by run prefix. Abuse rows use throwaway users only.
- A test that cannot prove its property at its budget reports a deployment finding or gated status,
  never PASS.

## Secrets, artefacts and privacy

- Never print, log, commit, or upload a secret, credential, token, cookie or seed value. Redact
  every artefact. Never upload a raw authenticated trace; `trace` stays `"off"` in CI.
- Every artefact passes the secret scan before upload.
- Repository text carries no personal name. Account slugs in URLs are permitted.
- Do not add a credential file, `.env` or generated secret to the repository. `.env.example` lists
  names only, with empty values.

## Git, review and publication

- Commit messages use lowercase Conventional Commits. Stage with explicit paths (`git add <path>`),
  never `git add .`, `git add -A` or `git commit -a`.
- No `Co-Authored-By`, `Claude-Session`, generated-attribution trailer or PR footer in commits,
  PR titles or PR bodies. Attribution settings are documented in `docs/cloud-environments.md`.
- No force-push, no history rewrite (amend, rebase, reset of shared history), no tags.
- Only the repository owner merges, by merge commit. Builders do not merge.
- Do not run CodeRabbit.
- Do not use any GitHub account the owner has excluded. The owner's instructions name it; this
  file does not.
- Publication (push, pull request creation or edit, comments, releases) happens only when the owner
  asks. Disclosure, release, settings and rulesets are owner actions, never performed by a builder.

## STOP conditions (builder)

Stop, report the expected and observed values with file:line, and do not improvise when:

1. A done criterion still fails after one root-caused fix attempt.
2. A change would edit a product fork, `node_modules` or the harness, or needs an untagged harness.
3. A needed secret is missing, or a secret would be printed or committed.
4. A build-time fact contradicts the plan (route, header, env name, flag, version).
5. A change would weaken an assertion, add a sleep or retry, skip a check, cut scope or raise a timeout.
6. Anything would add detail about a private-first item.
7. A security step is refused by the agent's own safety checks.
8. A host is blocked, Docker is unavailable, a required inventory or source read is denied, or a
   stack will not start after one root-caused retry.
9. A gated row's blocker is reached: record the gate and do not build around it.
10. A relocation or adaptation not listed in plan section 7.2.2 or the PR body.
11. A manual fork `.env` edit, a database insert into a product, an end-to-end bypass flag, or an
    unscoped reset is needed.

## Will not do in P5

- No product fork, `node_modules` or harness edit; no fork `.env` edit by hand; no database insert
  into a product; no end-to-end bypass.
- No tags, no force-push, no history rewrite, no merge by a builder, no PR body edit without owner
  authorization.
- No CodeRabbit run. No personal name in repository text. No trailers or footers.
- No payloads, literals or test names for private-first items.
- No timeout raise, assertion weakening, retry or skip to get green.
- No seed-credential copy from any fork. No `git add -A`.
- No P5 numbers assigned to PN or MI rows by builders.
- No shared package extraction. No unscoped reset.
