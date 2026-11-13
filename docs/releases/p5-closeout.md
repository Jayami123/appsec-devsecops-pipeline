# P5 closeout: release evidence

## What this tag covers

The `p5-closeout` tag marks the P5 closeout merge on `main`. It covers:

- Part 1: NEW-X-3, the PN-7 evidence token scan dry run (three unit tests), and the narrowed CSV-002 blocker in the findings ledger. Merged as PR #41.
- Part 2: the closeout documents. Threat-model one-pagers for Cal.com, Documenso, Medusa and Twenty. The MI-11 webhook authenticity note. The public drafts index. The P7 alias list. The technical guide. The README. This CHANGELOG and this file. Proposed in PR #42, pending the owner's merge.

It does not cover:

- CSV-002 (both legs), NEW-X-1 and NEW-X-2. All stay gated. The Medusa leg is gated on decision D-1 (no throwaway admin route). The Twenty leg is gated on probe P-4 (sign-up route), an unset budget (`CSV_UI_DOWNLOAD_MS`), and decision D-8 (live evidence for numeric and space-formula cells).
- The evidence-release workflow. It is not built. Decision D-4 is the owner's approval of the adaptation list in this file's section "Evidence-release adaptations".
- Any ZAP result. ZAP stays report-only, owner-dispatched, with the schedule off. The scanner registry keeps `zap` as `stub`.

## Commits and SHAs

| Item | SHA |
|---|---|
| Base before Part 1 | `97b96675c0e3a241b6891ff094300c70479b5a6c` |
| Part 1 head (PR #41) | `ff9039bd8191cc19e727b3f9aed1b6119b20fded` |
| Part 1 merge on main | `8e907be1eb1154c2a61f10bec5903fc2b14c2ec2` |
| Part 2 evidence head (PR #42, full-lane run below) | `9065ffaddf714e295be929367e93cebeab269c7b` |
| Part 2 merge on main | `<MERGE_SHA>` (filled by the owner after merge) |

## Run IDs

| Check | Head | Run ID | Result |
|---|---|---|---|
| CI, Part 1 (`pull_request`), includes gate and CodeQL | `ff9039b` | 43494005870 | success |
| CI, full lane (`workflow_dispatch`, every lane flagged) | `9065ffa` | 43495975286 | success |
| CI, Part 2 pull request (docs-only path) | `9065ffa` | 43495980951 | success |

Full-lane run 43495975286 has 32 jobs. 31 succeeded and one job was skipped by design: `p5-scans / zap-nightly`. The `gate` job succeeded. `p5-scans / codeql / analyze` succeeded. Each product lane succeeded: `p5-cal` (api, ui, serial), `p5-doc` (api, oidc, serial), `p5-med` (api, serial), `p5-tw` (api, multiws, serial), `p5-tw-iso`, and `p5-x` (stub).

## p5-scans with zap_nightly

Not run. No scan file changed in Part 2, so the `zap_nightly=true` dispatch was not needed. The last green `p5-scans` dispatch on an ancestor of this head is run 43478431660 (PR #39 head). Its ZAP job's execution cannot be confirmed from the run summary, so no ZAP result is claimed here.

## Ledger state (at `9065ffa`)

- Cases: 72. Verified 36, gated 17, planned 8, alias 8, dropped 2, confirmed-product-bug 1.
- Public findings: 5 (1 confirmed, 4 suspected).
- Held-private entries: 13, recorded as ID and status only in the public drafts index.
- Accepted risks: none.

## Claims this release does not make

- It does not claim every lane is green on `main`. The full-lane claim is the dispatch run above, on the evidence head.
- It does not claim that gated rows pass.

## Evidence-release adaptations (owner decision D-4)

Not built. The owner approves this list before a release workflow exists:

1. P5 workflow database IDs replace the P6 `EVIDENCE_WORKFLOW_IDS` values. The P5 values are not yet probed.
2. Scanner path `scripts/scan/evidence-token-scan.mjs` replaces the P6 path.
3. Release notes at `docs/releases/<tag>.md` with an H1. This folder is created by Part 2. The tag pattern is `^p5-[a-z0-9-]+$`, not `v1.0.0`.
4. Attach SBOM files as L-PIPE defines them (PN-5).
5. Gitleaks download with the P6 version and SHA-256 pins, approved by the owner before reuse.
6. Release workflow `.github/workflows/p5-evidence-release.yml`, dispatch only, from `main`, with `contents: read` at the top level and `contents: write` on one job only.

Publication stays owner-initiated (OD-14).

## Tag command (for the owner, not run by a builder)

After the owner merges Part 2 to `main` by merge commit, replace `<MERGE_SHA>` below with the 40-character merge commit on `main`:

```bash
git fetch origin main
git checkout main
git pull --ff-only
git log -1 --oneline   # confirm the SHA is the Part 2 merge
git tag -a p5-closeout -m "P5 closeout" <MERGE_SHA>
git push origin p5-closeout
```

Do not use `v1.0.0`, which would miss the evidence-release pattern. Do not reuse `v0.5.1`, which points at the harness-pin merge.
