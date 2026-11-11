# PN-3: Schemathesis over the vendored OAS (serial)

| Verdict type | PASS at reduced coverage when findings match the committed baseline; fail on a NEW path or error type |
| Test file | tests/serial/doc/zz-schemathesis.spec.ts |
| Contract | src/lanes/doc/contracts/openapi.json (sha256 in PROVENANCE.md), served under /api/v2 |
| Control | GET /envelope with the owner session returns 2xx |
| Run | schemathesis 4.33.1 (hashed lock), --rate-limit 2/m (D-DOC-B5); --no-color (D-DOC-B35), --seed 1 (D-DOC-B61), --max-examples 200, 10-minute wall cap |
| Baseline | src/lanes/doc/fuzz-baseline.json (operation + error type). Fail only on a NEW pair. Stale entries are annotated. No expectedDefect (D-DOC-B61) |
| Expected coverage | about 20 examples at 2 per minute inside 10 minutes, fewer than 200; the shortfall is recorded, never called full coverage |
| Auth | owner session cookie through the environment (P5_DOC_FUZZ_COOKIE) and the hook module src/lanes/doc/doc_schemathesis_hooks.py (SCHEMATHESIS_HOOKS); never argv (D-DOC-B34) |
| Isolation | last file in tests/serial/doc (zz-); hook supplies application/json when a generated request omitted a content-type (D-DOC-B63) |
| Budget | FUZZ_RATE_LIMIT 2; FUZZ_MAX_EXAMPLES 200; FUZZ_WALL_MIN 10; FUZZ_SEED 1 |
| Cleanup | owner session signed out in the worker fixture (sign-out.ts:15) |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (scripts/bootstrap.sh:16) |
| Harness | `qa-portfolio-harness` v0.4.0 (node_modules/qa-portfolio-harness/package.json:3) |
| Live status (this PR) | CI run 42979416596: control pass; one ST101 on embeddingPresign.createEmbeddingPresignToken |
| Live run ID | 42979416596 |
