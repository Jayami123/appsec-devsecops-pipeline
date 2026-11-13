# PN-1: webhook URL guard, create time only

| Verdict type | PASS or PRODUCT BUG (SUSPECTED); the delivery leg is GATED |
| Test file | tests/webhooks/doc/url-guard-corpus.spec.ts |
| Control | the public literal https://example.com/p5-hook is accepted at create time (200), then deleted |
| Negative | each URL_GUARD_CORPUS entry is refused with the schema message (fork ref held by the owner) |
| Oracle | an accepted entry is PRODUCT BUG (SUSPECTED), reported with URL and status only |
| Gate | the delivery leg needs the owner canary (O-3; plan section 4.6); not built |
| Unverified | the tRPC wire format (fork ref held by the owner) is assumed; the first live run is the check |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` fork ref held by the owner) |
| Harness | `qa-portfolio-harness` v0.4.0 fork ref held by the owner) |
| Live status (this PR) | BLOCKED (ENV): the sign-up limiter for this IP was exhausted by live probing (apps: fork ref held by the owner per 3 h). It resets at 12:00:00Z. CI on a fresh runner is authoritative. |
| Live run ID | not produced locally; the CI run ID is recorded on the PR |
