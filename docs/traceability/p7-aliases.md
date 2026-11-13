# P7 traceability: alias list

One row per case with status `alias` in `docs/findings/ledger.json`. Each field is copied from that case's `alias` object without new wording. Held-private aliases are not listed here; they are in the private index in [public drafts](../public-drafts/index.md).

| Alias case | Canonical ID | Repo | Ref | File | Scope covered | Residual | Disposition |
|---|---|---|---|---|---|---|---|
| P5-CAL-WH-001 | P2-CAL-DLY-002 | api-webhook-db-test-suite | 99a2fde | tests/webhooks/cal/cal-dly.spec.ts:38-80 | Signature acceptance and the observed 400/200 contract for an authenticated Daily-shaped request | Successful business processing (the original 2xx property). A new business-positive control in P5-CAL-WH-002 supplies it. | ALIAS-PARTIAL |
| P5-CAL-WH-004 | P2-CAL-DLY-002 | api-webhook-db-test-suite | 99a2fde | tests/webhooks/cal/cal-dly.spec.ts:23-40 | Negative signature validation for a tampered body | Random or forged signature values not derived from the secret or body (not covered by that test); business processing | ALIAS-PARTIAL |
| P5-CAL-CRON-002 | FC-1 | api-webhook-db-test-suite | 99a2fde | tests/integration/cal/cal-framework.spec.ts:32-41 | The two routes FC-1 checks, as reported by the review | Every other cron route. P5-CAL-CRON-001 builds one row per route. | ALIAS-PARTIAL |
| P5-DOC-TOK-001 | P6-DOC-RACE-002 | k6-load-concurrency-suite | 0533e61 | tests/documenso/races/doc-race-002-double-submit.spec.ts:40-48 | Same-token ten-way race: one SIGNED, nine ALREADY_SIGNED, all 200, one seal (supported by fact 4) | None within the race property | ALIAS-supported |
| P5-DOC-RL-001 | P6-DOC-LOAD-009 | k6-load-concurrency-suite | 0533e61 | src/load/spike/limiter-contract.ts:21-28 | Max+1 behaviour for its route | The slow 15-minute window-reset edge is UNCOVERED and DEFERRED to a later row | ALIAS-PARTIAL |
| P5-DOC-RL-002 | P6-DOC-LOAD-009 | k6-load-concurrency-suite | 0533e61 | src/load/spike/limiter-contract.ts:29-35,50-57 | Max+1 behaviour for those routes | Window-reset edge (as above) | ALIAS-PARTIAL |
| P5-DOC-RL-003 | P6-DOC-LOAD-009 | k6-load-concurrency-suite | 0533e61 | src/load/spike/limiter-contract.ts:19 | Max+1 behaviour for the upload route | Window-reset edge (as above) | ALIAS-PARTIAL |
| P5-MED-WH-003 | P2-MED-WH-001 | api-webhook-db-test-suite | 99a2fde | tests/webhooks/med/signed-event.spec.ts | Medusa signed-event handling for its covered case | Missing or invalid signatures (P5-MED-WH-001/002) | ALIAS-supported |

Alias rows: 8.

