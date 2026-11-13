# MI-8 (P2-TW-WH-009): evidence link

| Field | Value |
|---|---|
| ID | MI-8 (`P2-TW-WH-009`, owner-set identity) |
| Verdict type | tenant-isolation evidence (evidence link; no test row in this lane) |
| Status | identity CONFIRMED at the P2 pin; the evidence file exists at that pin (plan record) |
| Source | `fork ref held by the owner` (identity); evidence file `tests/webhooks/tw/tenant.spec.ts` at P2 `99a2fde` |
| Scope | tenant isolation of webhook delivery, as evidenced by the P2 spec |
| Residual | the P2 spec is cited, not re-run in P5; the P5 tenancy rows that exercise the same property are NEW-TW-1 and NEW-TW-2 (a), both tw-multiws and not built in this PR |
| Harness | `qa-portfolio-harness` v0.4.0 |
| Product fork | Twenty at `7cbdfec6` (`bootstrap` ref); image `twentycrm/twenty:v2.44.0` |
| Test | none (evidence link only, `docs/plans/2026-11-10-p5-tw.md` section 6) |
