# NEW-DOC-3: upload abuse (serial)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED) |
| Test file | tests/serial/doc/upload-abuse.spec.ts |
| Control | one valid minimal PDF accepted (200) |
| Negatives | text labelled as PDF; oversized (DOC_UPLOAD_OVERSIZE_BYTES, budgets.ts:146); polyglot. Each must be 4xx; a 5xx or an acceptance is a finding |
| Count | uploads = 1 + DOC_UPLOAD_CASES, below docRouteLimit upload (src/lanes/doc/limits.ts; formula budgets.ts:32) |
| Budget | DOC_UPLOAD_CASES 3; DOC_UPLOAD_OVERSIZE_BYTES 52428801; DOC_ROUTE_LIMITS upload 20 |
| Cleanup | none beyond the run prefix; the upload has no product delete route in the lane (retained under the run prefix; the CI stack is ephemeral) |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
