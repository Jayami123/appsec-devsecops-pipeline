// P5-DOC-OIDC-001 (P1): an OAuth sign-in state is single-use (master plan row 140; verdict docs/verdicts/doc/OIDC-001.md).
// Control: a fresh sign-in state signs in once. Negatives: the same callback replayed after its state cookie is consumed,
// and a callback whose state does not match the stored cookie, are both refused with no session.
// Setup is asserted first (the provider answers its discovery document, and it echoes the state). The first product
// assertion (authorize starts a sign-in) fails today: the discovery document omits scopes_supported, so Documenso
// refuses every OIDC request before the state check runs. That is marked with expectedDefect (P5-DOC-OIDC-SCOPE-001).
// Scope limit: the mock provider does not check the client secret or the redirect URI, and it does not enforce single-use
// codes. The replay asserted here is the consumed state cookie, not a second token exchange.
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expect, test } from "../../../src/lanes/doc/run-fixture.ts";
import {
  claimsFor,
  idpLogin,
  redirectUrlOf,
  sessionEmail,
  signOut,
  startSignIn,
  stateIn,
  wellKnownStatus,
  withState,
} from "./oidc-helper.ts";

const DEFECT =
  "P5-DOC-OIDC-SCOPE-001: authorize answers 500 UNKNOWN_ERROR, 'Requested scopes not supported by provider', when the discovery document has no scopes_supported (packages/auth/server/lib/utils/open-id.ts:34-40)";

test.describe("P5-DOC-OIDC-001", () => {
  test("OIDC-001 control: a fresh sign-in state signs in once", async ({ request, run }) => {
    const web = apiBaseUrl("documenso");
    const claims = claimsFor(run.prefix, "oidc001-ctl", true);
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider is up with its discovery document (DOCUMENSO_OIDC=1 at up).
    expect(await wellKnownStatus(), "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expectedDefect(DEFECT);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await idpLogin(await redirectUrlOf(started), claims);
    expect(stateIn(callback).length, "provider echoes a state").toBeGreaterThan(0);
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "first use of the state signs in").toBe(302);
    expect(await sessionEmail(request, web), "signed in as the verified user").toBe(claims.email);
  });

  test("OIDC-001 negative: the same callback replayed after its state cookie is consumed is refused", async ({
    request,
    run,
  }) => {
    const web = apiBaseUrl("documenso");
    const claims = claimsFor(run.prefix, "oidc001-rep", true);
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    expect(await wellKnownStatus(), "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expectedDefect(DEFECT);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await idpLogin(await redirectUrlOf(started), claims);
    // Control: the first use signs in.
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "control: first use signs in").toBe(302);
    expect(await sessionEmail(request, web)).toBe(claims.email);
    // Negative, after state: the first use consumed the state cookie, so the same callback must not sign in again.
    await signOut(request, web);
    expect(await sessionEmail(request, web), "signed out before the replay").toBeNull();
    const replay = await request.get(callback, { maxRedirects: 0 });
    expect(replay.status(), "replayed callback is refused").toBeGreaterThanOrEqual(400);
    expect(await sessionEmail(request, web), "no session from the replay").toBeNull();
  });

  test("OIDC-001 negative: a callback whose state does not match the stored state is refused", async ({
    request,
    run,
  }) => {
    const web = apiBaseUrl("documenso");
    const claims = claimsFor(run.prefix, "oidc001-mis", true);
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    expect(await wellKnownStatus(), "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expectedDefect(DEFECT);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await idpLogin(await redirectUrlOf(started), claims);
    // Negative: a state the product never issued, with the code and the stored cookie otherwise intact.
    const forged = withState(callback, `forged-${claims.sub}`);
    const refused = await request.get(forged, { maxRedirects: 0 });
    expect(refused.status(), "callback with a mismatched state is refused").toBeGreaterThanOrEqual(
      400,
    );
    expect(await sessionEmail(request, web), "no session from the mismatched state").toBeNull();
    // Control, after the refusal: a fresh authorize and the untampered callback still signs in.
    const fresh = await startSignIn(request, web);
    expect(fresh.status(), "control: a fresh authorize starts").toBe(200);
    const freshCallback = await idpLogin(await redirectUrlOf(fresh), claims);
    const control = await request.get(freshCallback, { maxRedirects: 0 });
    expect(control.status(), "control: the untampered callback signs in").toBe(302);
    expect(await sessionEmail(request, web)).toBe(claims.email);
  });
});
