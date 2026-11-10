# P5-TW-GQL-001: Deeply nested query rejected

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-001 |
| `title` | Deeply nested query rejected |
| `lane` | L-TW-B |
| `disposition` | KEEP (MI-24 section below) |
| `verdict` | gated |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | Control (title 1, PASS): anonymous `{ __typename }` returned HTTP 200. Built and passing. |
| `negative` | Depth probe (title 2): GATED, not run. An anonymous nested `__type`/`ofType` chain is refused by the introspection gate ("GraphQL introspection has been disabled"), a different refusal that proves nothing about depth. No nested depth limit is configured (probe C1; the check runs only when maximumAllowedNestedFields is defined, use-validate-graphql-query-complexity.hook.ts:66-70). POST /graphql, anonymous, `{ __type(name: "Query") { ofType { ... } } }`: not run as a probe; the attempt was refused with the introspection-disabled message (live, HTTP 200 with errors). |
| `state` | n/a |
| `budgets` | GQL_DEPTH_PROBE = 64 (src/security/budgets.ts:76); not used in a live result |
| `evidence` | tests/iso/tw/gql-depth.spec.ts (titles 1 and 3); fork graphql-config.service.ts:69-74; use-validate-graphql-query-complexity.hook.ts:66-70; live reply text recorded in the run log (kept under /tmp, not uploaded) |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | Depth probe (title 2) GATED: needs an anonymous-valid nested object chain; none is known on this stack (introspection disabled for anonymous callers, and a named root field is not discoverable without it). Also No throwaway actor on this stack (D-TWISO-B14): sign-up for an invited email is refused in single-workspace mode (get-sign-up-without-workspace-decision.util.ts: refused when IS_MULTIWORKSPACE_ENABLED is false and a workspace exists). Seed users are not actors (rule 31). |
| `redaction` | no secret value, no personal name, no private-first detail |

## MI-24 (moved-in, inside this KEEP row)

MI-24 has no spec or ledger entry of its own (tw-iso.md:737). Its GraphQL checks are the rows of this record and the depth, cost, alias, introspection and suggestion titles of the lane.
