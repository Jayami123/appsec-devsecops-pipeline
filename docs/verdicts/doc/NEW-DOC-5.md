# NEW-DOC-5: sealed document download by a non-recipient (P-new)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED) |
| Test file | tests/integration/doc/sealed-download.spec.ts |
| Setup | both recipients sign and complete (the completion route above) |
| Control | the owner downloads the signed item (GET /api/v2/envelope/item/{id}/download?version=signed) and gets 200 with %PDF- |
| Negative | the non-recipient (other) downloads the same item: 401, 403 or 404; a 2xx with %PDF- is PRODUCT BUG (SUSPECTED) |
| Budget | none |
| Cleanup | envelope deleted through the owner in run cleanup |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
