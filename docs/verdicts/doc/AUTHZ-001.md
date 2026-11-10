# AUTHZ-001: other user cannot read or delete the owner envelope (P0)

| Verdict type | PASS or PRODUCT BUG (SUSPECTED), per the run |
| Test file | tests/integration/doc/envelope-other-user.spec.ts |
| Control | owner GET 200 and owner DELETE 200 then 404 (test 1); other user GET of its own envelope 200 (test 2) |
| Negative | other GET of the owner envelope must be 401, 403 or 404; other DELETE must be 4xx |
| Before and after | owner GET of the negative envelope is 200 before and after the other user's DELETE |
| Budget | none |
| Cleanup | each envelope deleted through the owner in run cleanup; leak probes registered |
| Matrix | assertCovered over owner and other, envelope, GET and DELETE |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
