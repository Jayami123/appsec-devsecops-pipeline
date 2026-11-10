# P5-TW-SND-001: Sandbox cannot read `process.env` secrets

Verdict record (tw-iso.md section 16, D-TWISO-B10). One value per field.

| Field | Value |
|---|---|
| `id` | P5-TW-SND-001 |
| `title` | Sandbox cannot read `process.env` secrets |
| `lane` | L-TW-B |
| `disposition` | KEEP |
| `verdict` | gated |
| `run_prefix` | p5-qa-20261110t093428z-9eff4c09 |
| `run_utc` | 2026-11-10T09:43:37Z |
| `lane_commit` | the lane build head at PR time (see the PR body and the build log) |
| `harness` | qa-portfolio-harness v0.4.0 (node_modules/qa-portfolio-harness/package.json:3); pin bump is a foundation PR |
| `fork_ref` | 7cbdfec6f346b43715bc2056932f4fad5886f733 (twenty-CRM) |
| `readback` | LOGIC_FUNCTION_TYPE=LOCAL (P-12 proof record, passed to up); GRAPHQL_MAX_FIELDS=2000 (fork default config-variables.ts:1855, provenance only: no route exposes it, harness sets none); NODE_ENV=unprobed (image default config-variables.ts:1543; behavioural evidence in GQL-005); the six limiter names and effective values: NOT READ (no throwaway actor on this stack, UNPROBED) |
| `control` | not run (D-TWISO-B5) |
| `negative` | not run |
| `state` | n/a |
| `budgets` | SND_FN_TIMEOUT_S = 5 (not used) |
| `evidence` | P-12 proof record (results/tw-iso/p12-proof.json, gitignored, not committed): upExit0 true, overrideHasServerRef true, overrideHasWorkerRef true, overrideHasNoValue true, hashMatch true. Live: anonymous executeOneLogicFunction on /metadata returned "Missing authentication token" (one-off diagnostic, not committed). |
| `cleanup` | throwaway keys revoked: 0 (no actor was created, D-TWISO-B14); API-level leak check: no resource created, no probe registered; harness down exit 0 |
| `gate` | GATED. The P-12 booleans are all true, so the presence proof is met. The LOCAL control (D-TWISO-B5) is not run: logic-function routes need an authenticated actor with the WORKFLOWS permission (logic-function.resolver.ts:191-229), and no throwaway actor can be created on this stack (D-TWISO-B14). The ledger blocker also names D8, which this build's evidence does not address (owner decision). |
| `redaction` | no secret value, no personal name, no private-first detail |
