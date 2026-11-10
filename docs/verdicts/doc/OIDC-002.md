# OIDC-002: OIDC unverified email

| Verdict type | none built |
| Gate | GATED: BLOCKED: mock IdP not in harness v0.4.0 (plan P-8; owner request O-7) |
| Test file | reserved path tests/integration/doc/oidc-unverified-email.spec.ts; no file exists |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
