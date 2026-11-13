# OIDC-001: OAuth state replay rejected (P1)

| Verdict type | none yet (built; no PASS or defect recorded until a live run) |
| Gate | Built against harness v0.5.1 (merge commit `15aedca`). The provider publishes `scopes_supported` (`P5-DOC-OIDC-SCOPE-001` no longer blocks the row). Live run: CI `doc-oidc` on the draft PR, recorded there. A local live run is not possible: `quay.io` is denied at the sandbox proxy (D-DOC-B86). |
| Test file | `tests/integration/doc/oidc-state-replay.spec.ts` (3 titles); helper `tests/integration/doc/oidc-helper.ts` |
| Job | `doc-oidc` in `.github/workflows/p5-doc.yml` (`DOCUMENSO_OIDC=1` on the start step only) |
| Users | `documensoOidcTestUsers()` only (harness reader); never printed, uploaded or logged |
| Setup (asserted first) | Discovery answers 200; `scopes_supported` includes `openid`, `email`, `profile`; `code_challenge_methods_supported` includes `S256` |
| Control | `OIDC-001 control`: a fresh sign-in state signs in once (callback 302; session for the verified address) |
| Negative 1 | `OIDC-001 negative`: the same callback replayed after its state cookie is consumed is refused (4xx or 5xx, not 302) and creates no session |
| Negative 2 | `OIDC-001 negative`: a callback whose state does not match the stored state is refused (4xx or 5xx) with no session; a fresh sign-in afterwards signs in (control) |
| Budget | none |
| Cleanup | Sign-out in run cleanup. No created resource outside the stack, so no leak probe. |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (`scripts/bootstrap.sh:16`) |
| Harness | `qa-portfolio-harness` v0.5.1 (`package.json`; lock resolves `15aedca`) |
| Scope limit | The Keycloak client is confidential and the redirect URI is exact; the provider enforces both. The replay asserted is the consumed state cookie, which Documenso enforces. No test asserts a provider-side rejection. |
| Finding | `P5-DOC-OIDC-SCOPE-001` stays recorded (`fork ref held by the owner`; CI run 43400737495, job 131802699284). |
| Live run ID | pending: the CI run on the draft PR head |

## CI status (round 13)

- Runs 43408976457 (head `a1003ad`) and 43409454536 (head `bbd50fe`): the three OIDC-001 titles failed before any request reached the provider, with `DOCUMENSO_OIDC_NOT_ENABLED` (TEST BUG in job configuration, D-DOC-B90). The fix is `0d90ff7`. No verdict is recorded from these runs (D-DOC-B91).

## Live result (round 14, D-DOC-B92)

- CI run 43412270906 (head `0d90ff7`), job `doc-oidc`: 3 of 3 titles PASS (control; consumed-state replay refused; mismatched state refused with a fresh control). Verdict: PASS for the run. The ledger status is unchanged in this PR.
- Scope limit unchanged: the replay asserted is the consumed state cookie, and no provider-side rejection is asserted.
