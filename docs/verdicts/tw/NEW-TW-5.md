# NEW-TW-5

| Field | Value |
|---|---|
| ID | NEW-TW-5 (proposal; no P5 number, OD-12) |
| Verdict | PRODUCT BUG (CONFIRMED), cross-workspace invite acceptance; private-first |
| Job | p5-tw / tw-multiws (cross-workspace title); p5-tw / tw-api (same-workspace reuse title) |
| Run | 43409729454 (commit 8c1042a), cross-workspace title |
| File | `tests/integration/tw/invite-reuse.spec.ts` |
| Control | the invitee accepts A's invite on A's origin; the invitee is a member of A |
| Negative | B's member presents A's invite hash on B's origin; B's member is then listed as a member of A |
| Marking | `expectedDefect` (D-TW-B54), applied only when B's member is listed in A |
| Detail | held by the owner (private-first); this record carries the ID and status only |
| Status | confirmed for this run; the owner decides the ledger move |
