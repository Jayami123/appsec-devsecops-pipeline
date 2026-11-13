# MI-7 (P2-TW-BUG-003): verdict record

| Field | Value |
|---|---|
| ID | MI-7 (`P2-TW-BUG-003`, owner-set identity) |
| Verdict type | security verdict (verdict-only row; no test in this lane) |
| Status | identity CONFIRMED at the P2 pin; the behaviour is not re-tested here |
| Source | `fork ref held by the owner`; `fork ref held by the owner` (cited by path and line in `docs/plans/2026-11-10-p5-tw.md` section 3, row MI-7) |
| Scope | the P2 finding named by the identity; no P5 test row covers it |
| Residual | the P2 evidence is cited, not re-run in P5; no P5 test or job exists for MI-7 |
| Harness | `qa-portfolio-harness` v0.4.0 |
| Product fork | Twenty at `7cbdfec6` (`bootstrap` ref); image `twentycrm/twenty:v2.44.0` |
| Test | none (verdict-only, `docs/plans/2026-11-10-p5-tw.md` section 6) |
