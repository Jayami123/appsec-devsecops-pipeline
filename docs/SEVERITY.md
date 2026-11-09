# Severity rubric (OD-9)

Severity and priority are separate. Severity describes how bad a confirmed or suspected weakness is. Priority describes when the owner works on it. A high-severity item can be low priority, and the reverse.

## Severity inputs

| Input | Question |
|---|---|
| Impact | What does an attacker gain (data read, data changed, service denied, account taken over)? |
| Exploitability | What must an actor already have (anonymous, authenticated, a second account, admin)? |
| Confidence | How sure is the evidence (proven at the pinned ref, probed on a stack, or only read in source)? |

Each input is rated Low, Medium or High with a one-line justification in the finding.

## Levels

Critical, High, Medium, Low, Info, as used in the ledger `severity` enum.

## CVSS

A CVSS score is recorded only when every base-metric input is justified in the finding. No score is fabricated to fill a field. The ledger holds no CVSS field in F0-4.

## Ledger use

- `cases[].severity` is `null` until a case produces evidence.
- `findings[].severity` uses the enum above and requires `evidence`.
- Accepted risks need an owner, a reason and an `expires` date no more than 90 days after `acceptedOn` (`ACCEPTED_RISK_TTL_DAYS`).
