# MI-1: deletion of an envelope completed at the same moment

| Verdict type | verdict only (no test) |
| Source | P2 README.md:100; P2 tests/integration/doc/expiry.spec.ts:16; Documenso fork ref held by the owner |
| Scope | the race between deletion and completion of one envelope |
| Residual | the harness has no deterministic trigger for the race (doc plan MP:218) |
| Verdict | verdict only; not built |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: fork ref held by the owner per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
