# MI-2: conversion outage answered 400

| Verdict type | verdict only (no test; P2 owns the test) |
| Source | P2 README.md:101; P2 tests/serial/doc/conversion.spec.ts:18, 65, 88 |
| Scope | a document-conversion outage is answered with 400 |
| Residual | owned by P2; not repeated in P5 |
| Verdict | verdict only |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: packages/lib/server-only/rate-limit/rate-limits.ts:5-9, 3 per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
