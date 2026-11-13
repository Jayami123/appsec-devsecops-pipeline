# NEW-TW-2 (a)

| Field | Value |
|---|---|
| ID | NEW-TW-2 case (a) (proposal; no P5 number, OD-12) |
| Verdict | depends on where the row lands: PRODUCT BUG (CONFIRMED) only when the row is listed in B's workspace; otherwise PASS with an observation |
| Job | p5-tw / tw-multiws |
| File | `tests/integration/tw/api-key-scope.spec.ts` |
| Control | A's key creates a webhook in A (201) |
| Negative | A's key used on B's origin; the row is checked in both workspaces; cleanup removes it from both |
| Observation | a 201 with the row in A's workspace is the key writing into its own workspace: not a cross-tenant defect (origin not bound to the key's workspace), recorded as an annotation |
| Marking | `expectedDefect` only when the row is listed in B (D-TW-B54) |
| Detail | held by the owner (private-first) for any row listed in B |
