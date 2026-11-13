# P5-TW-GQL-005: Introspection exposure

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-005 |
| `title` | Introspection exposure |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | PASS |
| `run_prefix` | p5-qa-20261110t104456z-1e2d0aed |
| `run_utc` | 2026-11-10T10:46:16Z |
| `lane_commit` | ea9adaa8abdecf529631a2b51bad19aa0e5f67b3 |
| `harness` | qa-portfolio-harness v0.4.0 fork ref held by the owner); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default fork ref held by the owner; provenance only, no route exposes it); NODE_ENV=production (behavioural, GQL-005: anonymous introspection refused); limiter names and values: UNPROBED (no x-ratelimit-* header on any response, D-TWISO-B33) |
| `control` | Control (PASS, authenticated): one throwaway member, introspection HTTP 200 with __schema data. Control (anonymous): { __typename } HTTP 200. |
| `negative` | Anonymous introspection: refused, "GraphQL introspection has been disabled"; no __schema data (asserted). NODE_ENV recorded as production (behavioural, GQL-005). |
| `state` | n/a |
| `budgets` | none |
| `evidence` | tests/iso/tw/gql-introspection.spec.ts; fork fork ref held by the owner; fork ref held by the owner |
| `cleanup` | per actor: the member's credential accepted before removal and refused after (controlBeforeDelete, refusedAfterDelete true); the member row removed by the admin (deleteUserFromWorkspace); invitations deleted 0 (consumed by sign-up); keys revoked 0 (no key minted, D-TWISO-B25); leak probe clean; harness down exit 0 |
| `gate` | none |
| `redaction` | no secret value, no personal name, no private-first detail |
