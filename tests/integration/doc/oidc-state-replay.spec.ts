// P5-DOC-OIDC-001 (P1): an OAuth sign-in state is single-use (master plan row 140; verdict docs/verdicts/doc/OIDC-001.md).
// Control: a fresh sign-in state signs in once. Negatives: the same callback replayed after its state cookie is consumed,
// and a callback whose state does not match the stored cookie, are both refused with no session.
// Setup is asserted first: the provider's discovery document publishes the scopes Documenso requests and PKCE S256.
// Every product assertion below is a real oracle (no expected failure). Harness v0.5.1 publishes scopes_supported.
// Scope limit: the realm client is confidential and the redirect URI is exact, so the provider enforces both; the replay
// asserted here is the consumed state cookie, which Documenso enforces. No test asserts a provider-side rejection.
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expect, test } from "../../../src/lanes/doc/run-fixture.ts";
import {
  discovery,
  keycloakLogin,
  redirectUrlOf,
  seededUsers,
  sessionEmail,
  signOut,
  startSignIn,
  stateIn,
  VERIFIED_EMAIL,
  withState,
} from "./oidc-helper.ts";

test.describe("P5-DOC-OIDC-001", () => {
  test("OIDC-001 control: a fresh sign-in state signs in once", async ({ request, run }) => {
    const web = apiBaseUrl("documenso");
    const users = seededUsers();
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider answers and publishes the requested scopes and S256.
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    expect(doc.body.scopes_supported, "provider publishes the requested scopes").toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
    expect(doc.body.code_challenge_methods_supported, "provider publishes PKCE S256").toContain(
      "S256",
    );
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await keycloakLogin(
      await redirectUrlOf(started),
      users.verified.username,
      users.verified.password,
    );
    expect(stateIn(callback).length, "provider echoes a state").toBeGreaterThan(0);
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "first use of the state signs in").toBe(302);
    expect(await sessionEmail(request, web), "signed in as the verified user").toBe(VERIFIED_EMAIL);
  });

  test("OIDC-001 negative: the same callback replayed after its state cookie is consumed is refused", async ({
    request,
    run,
  }) => {
    const web = apiBaseUrl("documenso");
    const users = seededUsers();
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await keycloakLogin(
      await redirectUrlOf(started),
      users.verified.username,
      users.verified.password,
    );
    // Control: the first use signs in.
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "control: first use signs in").toBe(302);
    expect(await sessionEmail(request, web)).toBe(VERIFIED_EMAIL);
    // Negative: the first use consumed the state cookie, so the same callback must not sign in again.
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
    const users = seededUsers();
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await keycloakLogin(
      await redirectUrlOf(started),
      users.verified.username,
      users.verified.password,
    );
    // Negative: a state the product never issued, with the code otherwise intact.
    const forged = withState(callback, `forged-${run.prefix}`);
    const refused = await request.get(forged, { maxRedirects: 0 });
    expect(refused.status(), "callback with a mismatched state is refused").toBeGreaterThanOrEqual(
      400,
    );
    expect(await sessionEmail(request, web), "no session from the mismatched state").toBeNull();
    // Control, after the refusal: a fresh authorize and the untampered callback still signs in.
    const fresh = await startSignIn(request, web);
    expect(fresh.status(), "control: a fresh authorize starts").toBe(200);
    const freshCallback = await keycloakLogin(
      await redirectUrlOf(fresh),
      users.verified.username,
      users.verified.password,
    );
    const control = await request.get(freshCallback, { maxRedirects: 0 });
    expect(control.status(), "control: the untampered callback signs in").toBe(302);
    expect(await sessionEmail(request, web)).toBe(VERIFIED_EMAIL);
  });
});
