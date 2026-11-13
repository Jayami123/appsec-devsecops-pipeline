# Technical guide: how the P5 pipeline works

Back to the [README](../README.md).

This page explains the parts of the pipeline and how they connect. It makes no status claim. The [findings ledger](findings/ledger.json) is the only source of status, and the plans and probe records are the source of scope.

## Lanes

Each product has one lane. A lane runs one product stack at a time and always stops it in a final step.

| Lane | Product | Workflow |
|---|---|---|
| cal | Cal.com (booking) | `.github/workflows/p5-cal.yml` |
| doc | Documenso (e-signatures) | `.github/workflows/p5-doc.yml` |
| med | Medusa (online store) | `.github/workflows/p5-med.yml` |
| tw | Twenty (CRM) | `.github/workflows/p5-tw.yml` |
| tw-iso | Twenty isolation checks | `.github/workflows/p5-tw-iso.yml` |
| x | Closeout (CSV export and cross-product checks) | `.github/workflows/p5-x.yml` |

Products run from pinned commits and pinned images. The harness that starts and stops them is pinned to a tagged release. Only the harness scripts bring a stack up or down.

## CI

- `ci.yml` runs on every pull request and push. It has a change classifier (`scripts/ci-changes.sh`) that reads the changed paths and decides which lanes run.
- A docs-only change runs no product lane. A change to shared code, to the CI workflow or to the scripts runs every lane.
- `workflow_dispatch` on `ci.yml` sets every lane to run, regardless of the changed paths. That is the way to get a full-lane result for a given head.
- `gate` is the single required status check. It needs every job and runs even when a job fails. It passes only when each lane whose flag is set has succeeded.

## Scanners

Each scanner has a registry entry in `config/scan/implementation-status.json`. An implemented scanner must emit a real verdict. A stub reports `not-implemented` and is not a pass.

| Scanner | Registry status | Role |
|---|---|---|
| CodeQL | implemented | Static analysis, blocking. |
| gitleaks | implemented | Secret scan, blocking. |
| OSV and npm audit | implemented | Dependency advisories, blocking. |
| Trivy | implemented | Filesystem and image scan, blocking. |
| Syft | implemented | Software bill of materials. |
| zizmor | implemented | Workflow lint, blocking. |
| ZAP | stub | Report-only. Dispatched by the owner. The schedule is off. It is not part of the pull-request gate. |

The PN-7 token scan (`scripts/scan/evidence-token-scan.mjs`) checks artefacts before they are uploaded. It prints a file and a line for each hit, and never the matched text.

## Ledger

`docs/findings/ledger.json` holds every case, finding, private entry and accepted risk. Each case has one status: planned, gated, verified, confirmed-product-bug, alias or dropped. A gated case names its blocker. A finding is recorded only with evidence, and a confirmed product defect is encoded as an expected failure so that a product change turns the build red. The ledger schema is `docs/findings/ledger.schema.json`.

## Where to read next

- Master plan: [`plans/2026-11-08-p5-master-plan.md`](plans/2026-11-08-p5-master-plan.md).
- Lane plans: [CAL](plans/2026-11-10-p5-cal.md), [DOC](plans/2026-11-10-p5-doc.md), [MED](plans/2026-11-10-p5-med.md), [TW](plans/2026-11-10-p5-tw.md), [TW-ISO](plans/2026-11-10-p5-tw-iso.md), [X](plans/2026-11-10-p5-x.md), [L-PIPE](plans/2026-11-10-p5-l-pipe.md).
- Probe records: [`probes/`](probes/).
- Threat models: [Cal.com](threat-models/cal.md), [Documenso](threat-models/documenso.md), [Medusa](threat-models/medusa.md), [Twenty](threat-models/twenty.md).
- Webhook authenticity note: [`design/webhook-authenticity.md`](design/webhook-authenticity.md).
- Public drafts index: [`public-drafts/index.md`](public-drafts/index.md). Alias list: [`traceability/p7-aliases.md`](traceability/p7-aliases.md).
- Scope and severity: [`SECURITY-SCOPE.md`](SECURITY-SCOPE.md), [`SEVERITY.md`](SEVERITY.md).
- Cloud setup: see [`cloud-environments.md`](cloud-environments.md).
