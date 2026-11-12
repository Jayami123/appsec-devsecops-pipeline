# P5 foundation PR build log: reports, ledger and pins (FND)

Append-only build log for `feat/2026-11-12-p5-foundation-reports-ledger`. Each decision is recorded as
`D-FND-B<n>` with its context, the options considered, the choice, the reason and the evidence.

Base: `origin/main` at `11cb9ee5345db55c2fdd0883ddcfe6d76067d016` (merge of PR #28). Checked at STEP 0: the
tip had not moved, so no re-base was needed.

## Decisions

### D-FND-B1: base and tip

- context: STEP 0 requires the base to be `11cb9ee` or a newer tip recorded as `D-FND-B<n>`.
- options considered: branch from `11cb9ee`; branch from a newer tip.
- choice: branch from `11cb9ee`.
- reason: `git fetch origin main` returned `11cb9ee`; no newer tip exists.
- evidence: `git rev-parse origin/main` = `11cb9ee5345db55c2fdd0883ddcfe6d76067d016`.

### D-FND-B2: private-first artifacts are sanitised, and HTML and test results are removed when a private item ran

- context: the Playwright HTML report embeds every test's error text, and `test-results/` holds failure
  output. A private-first item (`P5-TW-GQL-002`, `P5-DOC-PF-001`) puts its refusal text in those files, and the
  HTML cannot be redacted per title without re-implementing the reporter. The past tw-iso run printed the
  private evidence in its job summary (`42973672650`, the expected-failure table).
- options considered: (a) upload raw JSON, HTML and test results; (b) sanitise JSON only and always upload HTML
  and test results; (c) sanitise the JSON, and remove `playwright-report/` and `test-results/` whenever a
  private-first ID appears in the run; (d) upload no HTML at all.
- choice: (c). The raw JSON is written under `$RUNNER_TEMP`, which is never uploaded. `scripts/prepare-ci-artifacts.ts`
  writes the sanitised `results/playwright-<label>.json`, and when a private ID appears in the raw report it
  deletes `playwright-report/` and `test-results/` before the upload step. A final check fails closed if a
  private ID's errors, annotations or attachments survive the sanitiser.
- reason: AGENTS.md (no raw authenticated trace; redact every artefact); D3 (no private mechanism in CI output);
  option (b) would upload the refusal text; option (d) drops HTML for every lane. Option (c) keeps the HTML and
  test results for every job that has no private item.
- evidence: `docs/verdicts/tw-iso/P5-TW-GQL-002.md:22` (evidence cell), run `42973672650` job log
  (`Expected failures` table printed the evidence), `playwright.config.ts:16-17` (trace off, kept).

### D-FND-B3: one new ledger status, `verified`; no `built` status

- context: STEP 4 asks for `verified` or `built`. A test that CI runs green is what the ledger currently needs
  to record. A `built` row without a CI run would be a second, weaker claim with no row to put in it.
- options considered: `verified` only; `verified` plus `built`.
- choice: `verified` only. `verified` requires `verification: { runId, testFile, job }`. Gated rows stay gated.
- reason: one status is the smallest schema change that carries the evidence the owner asked for (CI run ID and
  test file). No row in this PR has a build without a run.
- evidence: `docs/findings/ledger.schema.json` (case status enum and `verified` conditional), `src/security/findings.ts`.

### D-FND-B4: expected-defect rows are not verified; they get a findings entry

- context: four rows in the owner's verified list run as expected failures (`expectedDefect`), not as passes:
  `P5-CAL-WH-002` and `P5-CAL-WH-003` (cal-api, run `42996226683`, one title each red), `P5-MED-AUTHZ-001`
  (run `42980434504`) and `P5-TW-MASS-001` (run `42974221754`, the `createdBy` title).
- options considered: (a) mark them verified (the defect reproduces in CI); (b) keep them planned and add a
  findings entry; (c) add a new status.
- choice: (b). They stay `planned`, and `findings` gains four entries with `status: product-bug-suspected`,
  `severity` from the SEVERITY rubric (Low, Medium or High mapped to the ledger enum), and the CI run ID, the
  artifact (`job log, no artifact uploaded before this PR`), and the `expectedDefect` file and line.
- reason: "verified" would read as a passing oracle. The owner allowed a findings entry for public
  `expectedDefect` rows. Each verdict doc (`docs/verdicts/cal/WH-002.md`, `WH-003.md`) says PRODUCT BUG (SUSPECTED).
- evidence: `tests/webhooks/cal/replay.spec.ts:48`, `tests/webhooks/cal/stale-timestamp.spec.ts:49`,
  `tests/integration/med/cart-other-customer.spec.ts:68`, `tests/contracts/tw/mass-assignment.spec.ts:143`.

### D-FND-B5: SCAN-005 is not verified

- context: the owner listed SCAN-005 as verified. Its oracle is "summary exists and lists each job".
- options considered: verify on the `summary` job conclusion alone; keep planned.
- choice: keep planned.
- reason: the summary table is written to `$GITHUB_STEP_SUMMARY`, which is not in the job log, so the rows
  cannot be checked from CI output. The job conclusion alone does not show that every scanner is listed.
- evidence: `scripts/scan/aggregate.ts:108-122` (table written only when `GITHUB_STEP_SUMMARY` is set);
  run `42996226683`, job `130441841966` (success).

### D-FND-B6: TW-RLS-001 is not verified

- context: the owner noted that `P5-TW-RLS-001` covers only the MI-17 subset.
- choice: keep planned. Reason: the KEEP scope (search, export and the hidden record) is not covered, and the only
  passing title is the subset. Evidence: `tests/integration/tw/hidden-record-search.spec.ts`; the tally of
  `42974221754`: one passing title.

### D-FND-B7: CAL-CAP-001 and SCAN-004 stay planned

- context: `P5-CAL-CAP-001` is DEFERRED (not built). `P5-SCAN-004` is the L9 ZAP stub.
- choice: no status change. Adding a `gated` status would invent a blocker the plan does not name, and SCAN-004
  must not be marked verified (owner rule).
- evidence: `docs/plans/2026-11-10-p5-x.md` and the lane plans for CAP-001; `p5-scans.yml` has no ZAP job.

### D-FND-B8: GQL-002 leaves the cases and joins the private list; DOC-PF-001 joins the private list

- context: AGENTS.md and master plan 4.8 say no private ID appears in `cases`. `P5-TW-GQL-002` is a KEEP row
  and sits in `cases`. `P5-DOC-PF-001` is a suspected finding held private with no case row.
- choice: remove `P5-TW-GQL-002` from `cases`; add both IDs to `private` as `{id, status: "held-private"}`.
  Totals change to 73 cases and 10 private entries. Master plan 4.7 and 4.8 (8 private, 74 cases) are
  superseded by this decision and are not rewritten.
- reason: owner instruction, and the schema already forbids extra keys on private entries.
- evidence: `docs/findings/ledger.json` (before: `cases` includes `P5-TW-GQL-002`, `private` has 8 entries).

### D-FND-B9: upload-artifact pin is not re-verified at build time

- context: STEP 2 asks to confirm that `cf430e030ddbb5b0abf93d22962f4752f3646cd9` is still `v7.0.2`.
- options considered: read the tag through the GitHub connector; read it through the public API with curl.
- choice: keep the pin as the owner's facts state (v7.0.2, the same SHA P2 and P6 use), and record the limit.
- reason: the session's GitHub scope covers only `Jayami123/appsec-devsecops-pipeline`, so the connector and
  `gh` both refuse `actions/upload-artifact` (HTTP 403, "GitHub access ... not enabled for this session"). A
  curl to the public API returned the same refusal from the session's gateway. No other pin was tried.
- evidence: the `gh api repos/actions/upload-artifact/tags` output (403) recorded in the scratchpad session.
  Owner action: re-check the tag before merge.

### D-FND-B10: the owner's run labels differ from the run IDs in the repository

- context: the owner's list names `#27 / 42996226683 (tw-iso)`, `#29 / 42972818274 (tw)`, `#26 cal` and `#30 med`.
- choice: cite the run IDs that CI actually ran, on the default branch where the row passed.
- evidence (from `gh run list`): `42996226683` is the push to `main` for merge of PR #26 (cal), and it also
  ran `p5-tw-iso / tw-iso` (job `130440962991`). The tw-iso PR #27 merge is `42973672650` (`main`, `8f3281a5a`).
  `42972818274` is the tw PR head run (`feat/2026-11-10-p5-tw-build`). The tw merge (PR #29) is `42974221754`.
  The med merge (PR #30) is `42980434504`. The doc PR head run is `43001721212` (head `2bdae92`) and the doc
  merge (PR #28) is `43003908792` (`main`, `11cb9ee`).

### D-FND-B11: the cal evidence run could not be read whole

- context: `gh run view 42996226683 --log` exceeded the API log limit. The cal jobs were read per job.
- choice: read `130440962996` (cal-api), `130440962748` (cal-ui) and `130440962802` (cal-serial) per job.
- evidence: `gh run view --job <id> --log` exit 0 for each job.

### D-FND-B12: Playwright list needs a run ID in the run-prefix format

- context: `npx playwright test --list` exited 1 with `ENV_MISSING: P5_RUN_ID`, then `ENV_INVALID` for a value
  that did not match the run-prefix pattern (`src/kit/env.ts:10`).
- choice: list with `P5_RUN_ID=p5-qa-20261112t000000z-00000000` (a format value, not a secret). CI sets a real
  run ID in each job.
- evidence: baseline `143 tests in 62 files` (exit 0), saved before any edit.

### D-FND-B13: the cal plan's RL-002 blocker still cites v0.3.1

- context: `docs/plans/2026-11-10-p5-cal.md` (P2 row for P5-CAL-RL-002) says `not in harness v0.3.1`. The owner
  named only the med plan for the v0.3.1 fix.
- choice: not changed in this PR. The ledger blocker for RL-002 states the gate without the pin claim.
- follow-up: the owner should decide whether the cal plan's wording gets the same fix.

### D-FND-B14: GQL-002 residual in test code

- context: `tests/iso/tw/gql-cost.spec.ts` contains the refusal regex `CAP_MESSAGE` (an oracle literal), and the
  test names and assertions. The owner allowed evidence and comment redaction, not oracle changes.
- choice: the regex and every assertion are left unchanged. The `DEFECT_EVIDENCE` string, the header comments
  and the two annotation strings that name a source path are redacted.
- residual: the literal refusal text remains in the regex. It is flagged in the report; removing it needs an owner
  decision on the oracle.

### D-FND-B15: the report pipeline per product job

- context: STEP 2 asks for JSON, HTML and test results to be written and uploaded per job, with a per-title summary.
- choice: each lane run step keeps its original command text and adds `--reporter=list,json,html`, plus env
  `PLAYWRIGHT_JSON_OUTPUT_NAME` (raw JSON under `$RUNNER_TEMP`), `PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report` and
  `PLAYWRIGHT_HTML_OPEN: never`. Three steps follow, all under `if: always()`: `prepare-ci-artifacts.ts` (sanitise),
  `write-ci-job-summary.ts` (summary), and `actions/upload-artifact` (`p5-<label>-report`, 7 days, `if-no-files-found: warn`).
- reason: 7 days is the P2 retention. The raw JSON is never in the workspace, so it cannot be uploaded by mistake.
- evidence: `.github/workflows/p5-tw-iso.yml` (diff in the PR), `tests/unit/ci/lane-reports.test.ts`.

### D-FND-B16: the per-title data is a new field, not a change to project totals

- context: the existing test S1 deep-equals `ProjectTotals` (five counters). Adding per-title fields there would break S1.
- choice: `JobSummary.titles` holds one row per test node (project, test ID, title, status). `ProjectTotals` is unchanged.
- evidence: `tests/unit/kit/ci/job-summary.test.ts` S1 unchanged and passing; S21 to S27 added.

### D-FND-B17: the runner reason comment is on every pin

- context: the owner's reason comment exists on `p5-doc.yml` (lines 15 to 16) but not on the cal, med, tw or scans pins.
- choice: every `runs-on: ubuntu-24.04` line has the reason comment in the three lines above it. The check is in
  `tests/unit/ci/lane-reports.test.ts`. The comment is a line, not an inline comment, because the lane tests
  anchor on the end of the line.

### D-FND-B18: severity of the four findings

- context: `docs/SEVERITY.md` rates each input Low, Medium or High with a one-line reason. The ledger enum adds Critical and Info.
- choice: P5-MED-AUTHZ-001 High (a second customer can move another customer's cart). P5-CAL-WH-002 Medium (a
  captured signed request is accepted again: repeat processing). P5-TW-MASS-001 Medium (a client sets audit fields).
  P5-CAL-WH-003 Low (a stale signed delivery is accepted; the signature still binds the body). All four are
  `product-bug-suspected`, because each verdict says SUSPECTED.
- evidence: `docs/verdicts/cal/WH-002.md`, `docs/verdicts/cal/WH-003.md` (each says PRODUCT BUG (SUSPECTED)), the four
  `expectedDefect` call sites (D-FND-B4).

### D-FND-B19: test fixtures use a sentinel, not product text

- context: the new unit tests needed a fake evidence string. A draft used a real refusal phrase and a path, which D3 forbids in repository text.
- choice: the fixture is `SENTINEL-EVIDENCE refused by a fixture path`. Nothing in the new tests names a product path or message.
- evidence: `tests/unit/kit/ci/report-redaction.test.ts`, `tests/unit/kit/ci/job-summary.test.ts` (grep for the old text: none).

### D-FND-B20: GQL-002 mechanism text remains in lane files outside the owner's list (residual)

- context: a repository search for the GQL-002 mechanism terms finds text outside the files the owner named.
- files: `docs/plans/2026-11-10-p5-tw-iso.md`, `docs/probes/2026-11-10-p5-tw-iso-probes.md`, the public verdicts
  `docs/verdicts/tw-iso/P5-TW-GQL-001.md`, `-003.md`, `-004.md`, `-005.md`, `-006.md`, `P5-TW-SND-001.md` to `-004.md`,
  `tests/iso/tw/gql-depth.spec.ts`, `src/lanes/tw-iso/effective-config.ts`, `tests/unit/lanes/tw-iso/verdict.test.ts`.
- choice: not changed in this PR. These are lane-owned or public files, and the owner's scrub list named only the spec, its verdict and the ledger.
- owner action: decide whether the tw-iso plan and probe docs get the same scrub.

### D-FND-B21: the GQL-002 oracle literal remains (residual)

- context: `tests/iso/tw/gql-cost.spec.ts` keeps `CAP_MESSAGE`, the refusal-text regex that the oracle matches. Removing it changes the lane oracle.
- choice: left unchanged (owner rule: no lane assertion or oracle change). Flagged for the owner.

### D-FND-B22: commits are grouped

- context: the owner suggested six commits. Several workflow files mix pins and report steps, so a per-commit split needs partial staging, which the session cannot do interactively.
- choice: five commits, each named in the PR body: runner pins for the scan and CI workflows; private-first scrub; per-title summaries and report uploads (including the lane pins they carry); the verified status and ledger moves; the med pin wording and the cloud-install fix; then this build log.
- reason: each commit keeps its own files, and the lane tests all pass at the final head.

### D-FND-B23: the title list is unchanged

- context: STEP 6 requires the `--list` counts not to change.
- evidence: `P5_RUN_ID=p5-qa-20261112t000000z-00000000 npx playwright test --list`: 143 tests in 62 files before and after. Title text is identical after removing `file:line` (three `gql-cost.spec.ts` titles moved because the header comments shrank).

## Verification

| Check | Command | Result |
|---|---|---|
| format, lint, typecheck, unit | `npm run check` | exit 0; `# tests 694`, `# pass 694`, `# fail 0` |
| workflow lint | `bash scripts/lint-workflows.sh` | exit 0; `checksum verified for actionlint_1.7.12_linux_amd64.tar.gz`; `actionlint 1.7.12 OK` |
| titles | `npx playwright test --list` | 143 tests in 62 files, identical to the baseline |
| sanitiser, end to end | `prepare-ci-artifacts.ts` on a synthetic report | held spec rebuilt; sentinel absent; HTML and test results removed; summary shows ID and status |

### D-FND-B24: the upload-artifact pin is confirmed (closes D-FND-B9)

- context: D-FND-B9 kept the owner's pin without re-checking it, because the session could not read the tag.
- choice: the owner confirmed that `actions/upload-artifact` v7.0.2 resolves to `cf430e030ddbb5b0abf93d22962f4752f3646cd9`. The pin stays as it is.
- evidence: owner statement in this session. The pin is unchanged in every workflow file that uses it.

### D-FND-B25: root cause of "redaction incomplete" in CI run 43170977111

- context: every product lane's sanitise step failed with "a private-first ID survives outside its held title", including cal and med, which hold no item. The tests passed.
- what the logs establish: the failing check counts ID occurrences over the whole report, not only over specs. Held detection covers spec titles and test results only. Nothing rewrote any other field, so an ID in a field outside specs survived in every lane.
- what was tested: the list-mode JSON for the med and cal projects contains no private ID (scan of every string value), so the ID reaches the report only in the executed run. The sanitised file is not written when the check fails, so the field cannot be read from the CI output.
- choice: a second redaction pass rewrites every string value anywhere in the report that names a private ID, to "<ID> (held-private)", and records its JSON path. The root-level errors that name an ID are removed and recorded. A rewritten field also removes the HTML and test results for its job, because the HTML carries the original text.
- options considered: (a) remove the fail-closed check (rejected: hard limit); (b) drop the config and metadata objects wholesale (rejected: loses run information that holds no ID); (c) rewrite strings at any depth and keep the check (chosen).
- keys: a key that names an ID is not rewritten, so the leftover check still stops the run. The failure now prints the key paths (names only).
- reason: the fix is at the point where the text enters the upload, and the fail-closed check is unchanged.
- evidence: `src/kit/ci/report-redaction.ts` (passes 1 and 2, `privateKeyPaths`), `scripts/prepare-ci-artifacts.ts`, `tests/unit/kit/ci/report-fields.test.ts` (F1 to F9: argv, git metadata, suite and spec paths, root errors, two IDs in one string, a key that must still fail closed, a clean lane, a held marker not counted), `tests/unit/ci/prepare-artifacts.test.ts` (P1 to P5: a clean lane exits 0 and keeps the HTML; a rewritten argv removes the HTML and prints the path; a key stops the run with exit 1; a missing report exits 0; an unreadable ledger exits 1).
- not yet proven: the exact field in CI. The next run prints `rewritten field <path>` for each field, or the key paths on failure. Read those notices on the run; they name the location with no value.

### D-FND-B26: the tw-iso expected-defect call still runs (question 2)

- context: the owner reported "13 passed" against "12 passed, 1 expected failure" before this PR.
- what the logs show: the GQL-002 query-above-cap title prints as a failure marker (✘) in the base run (42973672650) and in the failing run (131023976531), so the expected failure still occurs. The list reporter's totals line counts expected failures inside "passed" in both runs ("13 passed"). This reporter does not print an "expected failure" count, so the owner's wording does not come from these logs.
- choice: nothing restored, because nothing was removed. The expectedDefect call is still in `tests/iso/tw/gql-cost.spec.ts` before the unchanged assertion, and B14 changed only the evidence string and comments.
- evidence: `tests/iso/tw/gql-cost.spec.ts:43` (expectedDefect), `:65` (unchanged assertion); the two job logs named above.

### D-FND-B27: lint and typing fixes in the new test files

- context: the first run of the check failed on two non-null assertions and on a spawnSync return type in the new test files.
- choice: explicit casts and `SpawnSyncReturns<string>`. No assertion changed.
- evidence: `npm run check` exit 0 (708 tests, 0 failing) after the fix.

### D-FND-B28: root cause confirmed from CI run 43272719962

- context: the sanitise step failed in every product lane with "a private-first ID survives outside its held title". The fix in B25 rewrote every string that names an ID, and the run's notices recorded where the IDs were.
- established: the rewritten fields were Playwright's git metadata `config.metadata.gitDiff` and each project's copy of it (`$.config.projects[N].metadata.gitDiff`, `$.config.filteredProjects[N]...`). Per lane: cal-api, cal-ui, cal-serial, med-api, med-serial, doc-api, doc-serial, tw-api, tw-serial and tw-iso recorded 15 to 17 rewritten fields. The lanes with no held item recorded 0 held specs.
- choice: no change to the redaction. The field is rewritten at the source, and the fail-closed check is unchanged.
- not yet known: why Playwright records a diff in CI. A clean checkout records none locally (list-mode metadata is empty).
- evidence: `gh run view 43272719962` job logs (rewritten-field notices); `src/kit/ci/report-redaction.ts`; `tests/unit/kit/ci/report-fields.test.ts`.

### D-FND-B29: no HTML report in any lane, and the owner's choice

- context: a rewritten field removes the job's HTML report, because the HTML carries the original text. Every lane rewrote `gitDiff`, so no lane uploaded HTML in run 43272719962.
- options: (a) keep HTML off; (b) stop Playwright recording the diff in CI, so HTML can be uploaded again; (c) strip `gitDiff` from the raw file before the HTML is generated (not possible: the HTML reporter runs during the test step).
- choice: (b), as the owner decided. See D-FND-B30.
- evidence: the owner's decision in this session.

### D-FND-B30: capture the commit, never the diff

- context: D-FND-B29 option (b).
- choice: `captureGitInfo: { commit: true, diff: false }` in `playwright.config.ts`. The commit metadata stays, the diff is never recorded, and no project overrides it. A unit test imports the real config and checks both points (`tests/unit/ci/playwright-config.test.ts`).
- sanitiser: `src/kit/ci/report-redaction.ts` and `scripts/prepare-ci-artifacts.ts` are unchanged, and so is the fail-closed check. A lane with no held item and no rewritten field keeps its HTML report. tw-iso, where a held item ran, stays JSON-only (B2).
- order: this change is committed with the B28 and B29 build-log entries.
- evidence: the `captureGitInfo` setting in Playwright 1.64 (`node_modules/playwright/types/test.d.ts`, `captureGitInfo`).
