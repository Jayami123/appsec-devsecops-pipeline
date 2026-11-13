# NEW-TW-1

| Field | Value |
|---|---|
| ID | NEW-TW-1 (proposal; no P5 number, OD-12) |
| Verdict | PASS (REST read and update; GraphQL update) |
| Job | p5-tw / tw-multiws |
| Run | 43409729454 (commit 8c1042a) |
| File | `tests/integration/tw/tenancy-by-id.spec.ts` |
| Controls | B reads and updates its own company (REST 200, PATCH 200; GraphQL update on its own company) |
| Negatives | B's member on A's origin: REST read refused, REST update refused, GraphQL update returns no id of A's company; A's company name unchanged |
| Not built | GraphQL read by UUID (query shape not proven at the pin) |
| Status | PASS for this run |
