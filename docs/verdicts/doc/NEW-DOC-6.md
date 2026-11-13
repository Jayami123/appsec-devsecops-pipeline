# NEW-DOC-6: outgoing webhook secret header

| Verdict type | none built |
| Gate | GATED: the owner canary (O-3). A receiver the product can reach is private under the guard (plan section 4.5, F1-F3) |
| Test file | reserved path tests/integration/doc/webhook-signature.spec.ts; no file exists |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: fork ref held by the owner per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
