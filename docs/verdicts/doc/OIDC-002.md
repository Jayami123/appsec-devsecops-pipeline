# OIDC-002: `email_verified=false` not auto-linked (P1)

| Verdict type | none yet (built; no PASS or defect recorded until a live run) |
| Gate | Built against harness v0.5.1 (merge commit `15aedca`). Live run: CI `doc-oidc` on the draft PR, recorded there. A local live run is not possible: `quay.io` is denied at the sandbox proxy (D-DOC-B86). |
| Test file | `tests/integration/doc/oidc-unverified-email.spec.ts` (2 titles); helper `tests/integration/doc/oidc-helper.ts` |
| Job | `doc-oidc` in `.github/workflows/p5-doc.yml` |
| Users | `documensoOidcTestUsers()` only; the `verified` and `unverified` seeded users (`unverified@qa.test`, `email_verified` false) |
| Setup (asserted first) | Discovery answers 200 and publishes the requested scopes; a local account exists for `unverified@qa.test` (sign-up returns 201) |
| Control | `OIDC-002 control`: the verified provider address signs in (callback 302; session for `verified@qa.test`) |
| Negative | `OIDC-002 negative`: the unverified provider login for the same address as an existing local account is refused (4xx or 5xx) with no session; the local account's sign-in status before and after the refused attempt is identical |
| Budget | none |
| Cleanup | Sign-out in run cleanup. The local account lives in the job's stack, which the harness tears down. |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (`scripts/bootstrap.sh:16`) |
| Harness | `qa-portfolio-harness` v0.5.1 (`package.json`; lock resolves `15aedca`) |
| Scope limit | The account-state check is the before and after local sign-in status. Whether it can differ after a link depends on how Documenso treats an unverified local account, which the first live run shows. No test asserts a provider-side rejection. |
| Finding | `P5-DOC-OIDC-SCOPE-001` stays recorded (`packages/auth/server/lib/utils/open-id.ts:34-40`; CI run 43400737495). |
| Live run ID | pending: the CI run on the draft PR head |
