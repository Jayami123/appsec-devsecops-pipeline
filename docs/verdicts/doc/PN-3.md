# PN-3: Schemathesis over the vendored OAS (serial)

| Verdict type | PASS at reduced coverage (N examples), or PRODUCT BUG (SUSPECTED) |
| Test file | tests/serial/doc/schemathesis.spec.ts |
| Contract | src/lanes/doc/contracts/openapi.json (sha256 in PROVENANCE.md), served under /api/v2 |
| Control | GET /envelope with the owner session returns 2xx |
| Run | schemathesis 4.33.1 (hashed lock), --rate-limit 2/m (D-DOC-B5), --max-examples 200, 10-minute wall cap |
| Expected coverage | about 20 examples at 2 per minute inside 10 minutes, fewer than 200; the shortfall is recorded, never called full coverage |
| Auth | owner session cookie in a Cookie header assembled at spawn time (D-DOC-B6) |
| Budget | FUZZ_RATE_LIMIT 2; FUZZ_MAX_EXAMPLES 200; FUZZ_WALL_MIN 10 |
| Cleanup | owner session signed out in the worker fixture (sign-out.ts:15) |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
