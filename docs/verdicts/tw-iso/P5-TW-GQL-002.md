# P5-TW-GQL-002: Query cost or complexity limit

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-002 |
| `title` | Query cost or complexity limit |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | PASS |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | Control (title 1, PASS): anonymous `{ __typename }` returned HTTP 200. |
| `negative` | POST /graphql, anonymous, `{ r: currentUser { f1: email ... } }` requesting cap + 1 = 2001 fields: HTTP 200 with error "Query too complex - Too many fields requested: 2001 - Maximum allowed fields: 2000" (fork use-validate-graphql-query-complexity.hook.ts:79). Requesting exactly the cap (2000): not refused by the cap (HTTP 200). |
| `state` | n/a |
| `budgets` | none in BUDGETS (tw-iso.md section 13 item 11); cap value read back: GRAPHQL_MAX_FIELDS = 2000 |
| `evidence` | tests/iso/tw/gql-cost.spec.ts; fork use-validate-graphql-query-complexity.hook.ts:75-79; config-variables.ts:1855. One-off diagnostic (not committed): the cap refused 2001 real fields before schema validation (a one-field query returned an unknown-root validation error), so the hook runs first. |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | none |
| `redaction` | no secret value, no personal name, no private-first detail |
