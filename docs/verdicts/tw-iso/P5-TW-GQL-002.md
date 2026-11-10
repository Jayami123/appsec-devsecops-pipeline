# P5-TW-GQL-002: Query cost or complexity limit

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-002 |
| `title` | Query cost or complexity limit |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | PRODUCT BUG (SUSPECTED) |
| `run_prefix` | p5-qa-20261110t104456z-1e2d0aed |
| `run_utc` | 2026-11-10T10:46:16Z |
| `lane_commit` | ea9adaa8abdecf529631a2b51bad19aa0e5f67b3 |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855; provenance only, no route exposes it); NODE_ENV=production (behavioural, GQL-005: anonymous introspection refused); limiter names and values: UNPROBED (no x-ratelimit-* header on any response, D-TWISO-B33) |
| `control` | Control (PASS): one throwaway member, shallow query HTTP 200; at cap (2000 requested): data returned, no cap refusal. |
| `negative` | Cap + 1 (2001 requested) with the member: HTTP 200 with no errors (answered, not refused). The same document anonymously: refused, "Query too complex - Too many fields requested: 2001 - Maximum allowed fields: 2000" (use-validate-graphql-query-complexity.hook.ts:79). |
| `state` | n/a |
| `budgets` | none in BUDGETS (tw-iso.md section 13 item 11); cap read back: GRAPHQL_MAX_FIELDS = 2000 |
| `evidence` | live playwright report of run p5-qa-20261110t104456z-1e2d0aed (kept under /tmp, not uploaded); fork src/engine/api/graphql/direct-execution/hooks/use-direct-execution.hook.ts:25 (onRequest) and :100 (execute), which answer the workspace-resolver query before the parse hook; src/engine/core-modules/graphql/hooks/use-validate-graphql-query-complexity.hook.ts:42 (onParse) and :75-79 (cap); src/engine/api/graphql/direct-execution/direct-execution.service.ts:243 and :518-528 (root-resolver limit only; no field count) |
| `cleanup` | per actor: the member's credential accepted before removal and refused after (controlBeforeDelete, refusedAfterDelete true); the member row removed by the admin (deleteUserFromWorkspace); invitations deleted 0 (consumed by sign-up); keys revoked 0 (no key minted, D-TWISO-B25); leak probe clean; harness down exit 0 |
| `gate` | none. PRODUCT BUG (SUSPECTED): the row fails on purpose (fail closed). Evidence: runId above; artifact: playwright JSON report of that run; file and line in the evidence field. |
| `redaction` | no secret value, no personal name, no private-first detail |
