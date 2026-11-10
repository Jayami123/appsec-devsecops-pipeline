# P5-TW-GQL-004: Batched operations and limiter layers

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-004 |
| `title` | Batched operations and limiter layers |
| `lane` | L-TW-B |
| `disposition` | KEEP (MI-24 inside GQL rows) |
| `verdict` | gated |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | not run |
| `negative` | not run |
| `state` | n/a |
| `budgets` | GQL_BATCH_PROBE = 100 (not used) |
| `evidence` | tw-iso.md section 8.8; ledger blocker "P-9 not probed" |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | GATED (D-TWISO-B7): P-9 not probed; waits for L-TW-A's P-9 evidence (D-FRESH). No tw-limiter-last job. |
| `redaction` | no secret value, no personal name, no private-first detail |

## MI-24 (moved-in, inside this KEEP row)

MI-24 has no spec or ledger entry of its own (tw-iso.md:737). Its GraphQL checks are the rows of this record and the depth, cost, alias, introspection and suggestion titles of the lane.
