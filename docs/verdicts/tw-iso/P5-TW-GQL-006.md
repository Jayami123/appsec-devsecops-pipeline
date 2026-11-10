# P5-TW-GQL-006: Field suggestions leak schema

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-GQL-006 |
| `title` | Field suggestions leak schema |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | PASS |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | Control (anonymous, built): `{ __typename }` returned HTTP 200. |
| `negative` | POST /graphql, anonymous, `{ currentUsr }` (typo): validation error(s) returned; response text contains no "Did you mean" suggestion (asserted, and the validation-error precondition asserted). |
| `state` | n/a |
| `budgets` | none |
| `evidence` | tests/iso/tw/gql-suggestions.spec.ts; fork removeSuggestionInErrorsRule (hook file lines 15-16, probe C5) |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | Authenticated control (plan title 1) and authenticated suggestion behaviour (plan title 3) GATED. No throwaway actor on this stack (D-TWISO-B14): sign-up for an invited email is refused in single-workspace mode (get-sign-up-without-workspace-decision.util.ts: refused when IS_MULTIWORKSPACE_ENABLED is false and a workspace exists). Seed users are not actors (rule 31). |
| `redaction` | no secret value, no personal name, no private-first detail |
