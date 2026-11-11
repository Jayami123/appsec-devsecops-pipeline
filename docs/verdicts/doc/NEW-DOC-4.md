# NEW-DOC-4: API token scope

| Verdict type | none built |
| Gate | GATED: the token mint route exists in the product (packages/trpc/server/api-token-router/create-api-token.ts) but its live use is not verified in this build; D-DOC-B6 lifts the gate only on live evidence |
| Test file | reserved path tests/integration/doc/api-token-scope.spec.ts; no file exists |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
