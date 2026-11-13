# NEW-DOC-2: field tampering (P-new)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED) |
| Test file | tests/integration/doc/field-tamper.spec.ts |
| Control | token A sets its own field before completion (2xx; inserted becomes true) |
| Negative 1 | token A sets B's field: 4xx; B's inserted stays false |
| Negative 2 | after both recipients complete (recipient.completeDocumentWithToken; documentId from secondaryId document_<n>, fork ref held by the owner), a field write by token A is 4xx and A's inserted stays true |
| Budget | none |
| Cleanup | envelope deleted through the owner in run cleanup |
| Limit | the value itself is not read back; the row proves refusal and the inserted flag only |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
