# P5-TW-SND-001: Sandbox cannot read process.env secrets

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-SND-001 |
| `title` | Sandbox cannot read process.env secrets |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | gated |
| `run_prefix` | p5-qa-20261110t104456z-1e2d0aed |
| `run_utc` | 2026-11-10T10:46:16Z |
| `lane_commit` | ea9adaa8abdecf529631a2b51bad19aa0e5f67b3 |
| `harness` | qa-portfolio-harness v0.4.0 fork ref held by the owner); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default fork ref held by the owner; provenance only, no route exposes it); NODE_ENV=production (behavioural, GQL-005: anonymous introspection refused); limiter names and values: UNPROBED (no x-ratelimit-* header on any response, D-TWISO-B33) |
| `control` | not run (D-TWISO-B5, B32) |
| `negative` | not run |
| `state` | n/a |
| `budgets` | SND_FN_TIMEOUT_S = 5 (not used) |
| `evidence` | P-12 proof record of run p5-qa-20261110t104456z-1e2d0aed fork ref held by the owner, gitignored): upExit0, overrideHasServerRef, overrideHasWorkerRef, overrideHasNoValue, hashMatch all true. Live (probe): member refused createOneLogicFunction without a role ("Entity performing the request does not have permission"); with an admin-created WORKFLOWS role, create 200; executeOneLogicFunction refused: "self-signed certificate in certificate chain" in the executor's Yarn fetch (session TLS trust, ENV). |
| `cleanup` | per actor: the member's credential accepted before removal and refused after (controlBeforeDelete, refusedAfterDelete true); the member row removed by the admin (deleteUserFromWorkspace); invitations deleted 0 (consumed by sign-up); keys revoked 0 (no key minted, D-TWISO-B25); leak probe clean; harness down exit 0 |
| `gate` | GATED (B5, B32): the LOCAL control did not pass live. Its blocker is the session TLS trust of the executor (ENV), not the product; CI on a runner without that proxy is the next evidence. The ledger blocker also names D8, which this build does not address. |
| `redaction` | no secret value, no personal name, no private-first detail |
