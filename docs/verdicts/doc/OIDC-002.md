# OIDC-002: `email_verified=false` not auto-linked (P1)

| Verdict type | PRODUCT BUG (SUSPECTED) for the sign-in start (the expected defect); the unverified-email oracle is not yet reached (no PASS) |
| Gate | GATED, now BLOCKED by a suspected product defect: `P5-DOC-OIDC-SCOPE-001`. The provider discovery document omits `scopes_supported`, so Documenso refuses every OIDC authorize and callback before the email check runs (`packages/auth/server/lib/utils/open-id.ts:34-40`). |
| Test file | `tests/integration/doc/oidc-unverified-email.spec.ts` (2 titles). Helper: `tests/integration/doc/oidc-helper.ts`. |
| Job | `doc-oidc` in `.github/workflows/p5-doc.yml` (`DOCUMENSO_OIDC=1` on the start step only) |
| Setup (asserted first) | The provider answers its discovery document with 200. The provider alone issues an ID token whose `email_verified` follows the login claims: true for the control, false for the unverified login (`providerIdTokenClaims`). Both setup checks pass in the local simulation. |
| Expected defect | `expectedDefect` before the first product assertion (authorize starts a sign-in, expected 200). Observed: 500 `UNKNOWN_ERROR`. |
| Control | `OIDC-002 control: a verified email signs in`: first callback 302, session for the verified email. Not reached while the defect stands. |
| Negative | `OIDC-002 negative: an unverified email for an existing account is refused and not linked`: a verified sign-in creates the existing account and signs out; then an unverified login for the same address (different subject, `email_verified` false) returns 4xx or 5xx with no session. After state: the existing verified account still signs in (302). Not reached while the defect stands. |
| Budget | none |
| Cleanup | Sign-out in run cleanup. No created resource outside the stack, so no leak probe. |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (`scripts/bootstrap.sh:16`) |
| Harness | `qa-portfolio-harness` v0.5.0 (`package.json`; lock resolves commit `9cddd68`) |
| Probe (local, 2026-11-13, not a CI run) | Same authorize and callback 500 as OIDC-001. Provider probe: the login with `email_verified` false produced an ID token with `email_verified` false; a login with true produced true (the provider side of the setup checks). |
| Classification | PRODUCT BUG (SUSPECTED), interoperability. Same cause as OIDC-001. Judged not security-sensitive. |
| Scope limit | The mock provider does not check the client secret or the redirect URI, and it does not enforce single-use codes. This row checks Documenso's `email_verified` check and its link path. No test asserts a provider-side rejection. |
| Live status (this PR) | Local simulation of the `doc-oidc` steps: 5 titles across OIDC-001 and OIDC-002, all expected failures at the same assertion; no harness or helper error. CI run: recorded on the draft PR. |
| Live run ID | Local only (no CI run ID yet). CI run ID: filled on the draft PR. |
| Ledger proposal | Stays `gated`. Blocker text to name `P5-DOC-OIDC-SCOPE-001` and the CI run, in the foundation ledger PR. Not verified: no PASS exists. |
