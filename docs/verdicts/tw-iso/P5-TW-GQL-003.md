# P5-TW-GQL-003: Alias flooding bounded

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-003 |
| `title` | Alias flooding bounded |
| `lane` | L-TW-B |
| `disposition` | KEEP (MI-24 section below) |
| `verdict` | design verdict |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | Control (title 1, PASS): three aliases of `__typename` returned HTTP 200. |
| `negative` | POST /graphql, anonymous, 200 aliases of `__typename` (GQL_ALIAS_PROBE): HTTP 200, no errors, all aliases resolved. Design verdict: aliases of a meta field are not counted by the field cap (one-off diagnostic: 2001 `__typename` aliases returned HTTP 200 with no errors). Aliases of one real root field are refused as "Duplicate root resolver" (one-off diagnostic), a different property not tested here. |
| `state` | n/a |
| `budgets` | GQL_ALIAS_PROBE = 200 (src/security/budgets.ts:81) |
| `evidence` | tests/iso/tw/gql-alias.spec.ts; fork checkDuplicateRootResolvers path ("Duplicate root resolver" message); use-validate-graphql-query-complexity.hook.ts:75-91 |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | none |
| `redaction` | no secret value, no personal name, no private-first detail |

## MI-24 (moved-in, inside this KEEP row)

MI-24 has no spec or ledger entry of its own (tw-iso.md:737). Its GraphQL checks are the rows of this record and the depth, cost, alias, introspection and suggestion titles of the lane.
