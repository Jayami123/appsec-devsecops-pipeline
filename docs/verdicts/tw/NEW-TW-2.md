# NEW-TW-2 (a)

| Field | Value |
|---|---|
| ID | NEW-TW-2 case (a) (proposal; no P5 number, OD-12) |
| Verdict | PASS, unless the row is listed in the other workspace (then PRODUCT BUG (CONFIRMED), private-first) |
| Job | p5-tw / tw-multiws |
| File | `tests/integration/tw/api-key-scope.spec.ts` |
| Control | the key creates a webhook in its own workspace (201) |
| Observation | a 201 with the row in the key's own workspace is recorded as an observation, not a defect |
| Marking | `expectedDefect` only when the row is listed in the other workspace (D-TW-B54) |
| Detail | held by the owner (private-first) for any row listed in the other workspace |
