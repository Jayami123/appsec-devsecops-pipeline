# P5-TW-MT-002

| Field | Value |
|---|---|
| ID | P5-TW-MT-002 |
| Verdict | PRODUCT BUG (CONFIRMED), cross-tenant read; private-first |
| Job | p5-tw / tw-multiws |
| Run | 43409729454 (commit 8c1042a) |
| File | `tests/integration/tw/signed-file-url-cross-session.spec.ts` |
| Control | A reads its signed URL on A's origin: 200 with the file bytes (no bearer) |
| Negative | the same path and query on B's origin with B's session: 200 with the same bytes |
| Marking | `expectedDefect` (D-TW-B54), applied only when B's origin serves A's bytes |
| Detail | held by the owner (private-first); this record carries the ID and status only |
| Status | confirmed for this run; the owner decides the ledger move |
