# OIDC-001: OAuth state replay rejected (P1)

| Verdict type | PRODUCT BUG (SUSPECTED) for the sign-in start (the expected defect); the replay and mismatch oracles are not yet reached (no PASS) |
| Gate | GATED, now BLOCKED by a suspected product defect: `P5-DOC-OIDC-SCOPE-001`. The provider discovery document omits `scopes_supported`, so Documenso refuses every OIDC authorize and callback before the state check runs (`packages/auth/server/lib/utils/open-id.ts:34-40`). |
| Test file | `tests/integration/doc/oidc-state-replay.spec.ts` (3 titles). Helper: `tests/integration/doc/oidc-helper.ts`. |
| Job | `doc-oidc` in `.github/workflows/p5-doc.yml` (`DOCUMENSO_OIDC=1` on the start step only; the stock jobs exclude `OIDC-00` titles) |
| Setup (asserted first) | The provider answers its discovery document with 200 (`wellKnownStatus`). |
| Expected defect | `expectedDefect` before the first product assertion (authorize starts a sign-in, expected 200). Observed: 500 `UNKNOWN_ERROR`. |
| Control | `OIDC-001 control: a fresh sign-in state signs in once`: first callback 302, session for the verified email. Not reached while the defect stands. |
| Negative 1 | `OIDC-001 negative: the same callback replayed after its state cookie is consumed is refused`: after sign-out, the replay returns 4xx or 5xx (not 302) and creates no session. Not reached while the defect stands. |
| Negative 2 | `OIDC-001 negative: a callback whose state does not match the stored state is refused`: a mismatched state returns 4xx or 5xx with no session; a fresh sign-in after it signs in (control). Not reached while the defect stands. |
| Budget | none |
| Cleanup | Sign-out in run cleanup. No created resource outside the stack, so no leak probe. |
| Fork | Documenso `f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c` (`scripts/bootstrap.sh:16`) |
| Harness | `qa-portfolio-harness` v0.5.0 (`package.json`; lock resolves commit `9cddd68`) |
| Probe (local, 2026-11-13, not a CI run) | Authorize `POST /api/auth/oauth/authorize/oidc` returns 500 `UNKNOWN_ERROR`. Callback `GET /api/auth/callback/oidc` with no cookies returns 500 `UNKNOWN_ERROR` (the callback runs the same discovery check first, `handle-oauth-callback-url.ts`, `validateOauth`). Web log: `Requested scopes not supported by provider: openid, email, profile`. The provider's discovery document has no `scopes_supported`. |
| Provider behaviour (probe) | Login form at the authorize URL: `POST` to the same URL with `username` and a `claims` JSON, then 302 to the callback with the state echoed and a code. Token exchange 200. `email_verified` in the ID token follows the claims. |
| Classification | PRODUCT BUG (SUSPECTED), interoperability. OpenID Connect Discovery 1.0 section 3 makes `scopes_supported` RECOMMENDED; Documenso treats its absence as "no scopes supported". Judged not security-sensitive. |
| Scope limit | The mock provider does not check the client secret or the redirect URI, and it does not enforce single-use codes (a second token exchange of one code returned 200). The replay asserted here is the consumed state cookie, not a second token exchange. No test asserts a provider-side rejection. |
| Live status (this PR) | Local simulation of the `doc-oidc` steps: 5 titles, all expected failures at the same assertion; no harness or helper error. CI run: recorded on the draft PR. |
| Live run ID | Local only (no CI run ID yet). CI run ID: filled on the draft PR. |
| Ledger proposal | Stays `gated`. Blocker text to name `P5-DOC-OIDC-SCOPE-001` and the CI run, in the foundation ledger PR. No `findings[]` entry is proposed here (the ledger test pins four public rows). Not verified: no PASS exists. |

## Status update (round 10)

- CI run 43400737495 (head c2aedd5): `doc-oidc` success with the expected failure at `P5-DOC-OIDC-SCOPE-001`. The row is still gated: the harness pin bump to v0.5.1 is blocked because the tag does not resolve from this session (D-DOC-B79).
- Recorded finding: `P5-DOC-OIDC-SCOPE-001`, code `packages/auth/server/lib/utils/open-id.ts:34-40`, run 43400737495.
