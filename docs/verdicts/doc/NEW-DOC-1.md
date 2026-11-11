# NEW-DOC-1: recipient-token IDOR (P-new)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED) |
| Test file | tests/integration/doc/recipient-idor.spec.ts |
| Control | token A, used anonymously, GETs its own /sign/ page (200) and signs its own NAME field (2xx) |
| Negative 1 | token A's page must not disclose recipient B's address or field id |
| Negative 2 | token A signing B's field must be 4xx, and B's inserted flag stays false (before and after) |
| Budget | none |
| Cleanup | envelope deleted through the owner in run cleanup |
| Unverified | the tRPC wire format of envelope.field.sign (packages/trpc/utils/data-transformer.ts:4) and the inserted field (GET /api/v2/envelope/field/{id}) |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (round 2) | DOCKER BLOCKED at 06:40Z on 2026-11-11 (no dockerd running; the session hook owns dockerd, so it was not started by hand). No local live run. The CI run ID for PR #28 is the authoritative result. |
