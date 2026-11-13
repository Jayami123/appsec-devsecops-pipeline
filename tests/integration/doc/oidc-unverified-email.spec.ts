// P5-DOC-OIDC-002 (P1): an unverified provider email is not auto-linked to an account (master plan row 141; verdict
// docs/verdicts/doc/OIDC-002.md). Control: a verified email signs in. Negative: an unverified email for an address that
// already has an account is refused with no session, and the existing account still signs in afterwards.
// Setup is asserted first: the provider answers its discovery document, and its ID token carries the email_verified value
// the login set (checked against the provider alone). The first product assertion (authorize starts a sign-in) fails today
// because the discovery document omits scopes_supported; Documenso refuses before the email_verified check runs. That is
// marked with expectedDefect (P5-DOC-OIDC-SCOPE-001).
// Scope limit: the mock provider does not check the client secret or the redirect URI, and it does not enforce single-use
// codes. This row checks Documenso's email_verified check and its link path; it asserts no provider-side rejection.
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expect, test } from "../../../src/lanes/doc/run-fixture.ts";
import {
  callbackUri,
  claimsFor,
  idpLogin,
  providerIdTokenClaims,
  redirectUrlOf,
  sessionEmail,
  signOut,
  startSignIn,
  wellKnownStatus,
} from "./oidc-helper.ts";

const DEFECT =
  "P5-DOC-OIDC-SCOPE-001: authorize answers 500 UNKNOWN_ERROR, 'Requested scopes not supported by provider', when the discovery document has no scopes_supported (packages/auth/server/lib/utils/open-id.ts:34-40)";

test.describe("P5-DOC-OIDC-002", () => {
  test("OIDC-002 control: a verified email signs in", async ({ request, run }) => {
    const web = apiBaseUrl("documenso");
    const claims = claimsFor(run.prefix, "oidc002-ctl", true);
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider is up, and its token carries email_verified true for this login.
    expect(await wellKnownStatus(), "provider discovery answers 200").toBe(200);
    const setup = await providerIdTokenClaims(claims, callbackUri(web));
    expect(setup.email_verified, "provider id_token carries email_verified true").toBe(true);
    const started = await startSignIn(request, web);
    expectedDefect(DEFECT);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await idpLogin(await redirectUrlOf(started), claims);
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "verified email signs in").toBe(302);
    expect(await sessionEmail(request, web), "signed in as the verified email").toBe(claims.email);
  });

  test("OIDC-002 negative: an unverified email for an existing account is refused and not linked", async ({
    request,
    run,
  }) => {
    const web = apiBaseUrl("documenso");
    const existing = claimsFor(run.prefix, "oidc002-neg", true);
    // Same address, a different provider subject, and email_verified false.
    const unverified = { ...existing, sub: `${existing.sub}-unv`, email_verified: false };
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider is up, and the unverified login really carries email_verified false.
    expect(await wellKnownStatus(), "provider discovery answers 200").toBe(200);
    const setup = await providerIdTokenClaims(unverified, callbackUri(web));
    expect(setup.email_verified, "provider id_token carries email_verified false").toBe(false);
    // The existing account: a verified sign-in for the address, then sign out.
    const started = await startSignIn(request, web);
    expectedDefect(DEFECT);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const seeded = await request.get(await idpLogin(await redirectUrlOf(started), existing), {
      maxRedirects: 0,
    });
    expect(seeded.status(), "control: the existing verified account signs in").toBe(302);
    await signOut(request, web);
    expect(await sessionEmail(request, web), "signed out before the unverified attempt").toBeNull();
    // Negative: the unverified login for the same address is refused, with no session and no link.
    const fresh = await startSignIn(request, web);
    expect(fresh.status(), "authorize starts an unverified attempt").toBe(200);
    const refused = await request.get(await idpLogin(await redirectUrlOf(fresh), unverified), {
      maxRedirects: 0,
    });
    expect(refused.status(), "unverified email is refused").toBeGreaterThanOrEqual(400);
    expect(await sessionEmail(request, web), "no session for the unverified login").toBeNull();
    // After state: the existing verified account still signs in, unchanged by the refused attempt.
    const again = await startSignIn(request, web);
    expect(again.status(), "after state: authorize starts").toBe(200);
    const back = await request.get(await idpLogin(await redirectUrlOf(again), existing), {
      maxRedirects: 0,
    });
    expect(back.status(), "after state: the existing account still signs in").toBe(302);
    expect(await sessionEmail(request, web)).toBe(existing.email);
  });
});
