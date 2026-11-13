// P5-DOC-OIDC-002 (P1): an unverified provider email is not auto-linked to an account (master plan row 141; verdict
// docs/verdicts/doc/OIDC-002.md). Control: a verified email signs in. Negative: an unverified provider login for an address
// that already has a local account is refused with no session, and the local account's sign-in status is unchanged.
// Setup is asserted first: the provider answers its discovery document and the local account exists for the address.
// Every product assertion is a real oracle (no expected failure). Harness v0.5.1 publishes scopes_supported.
// Scope limit: the account-state check is the before/after local sign-in status. Whether that status can differ after a
// link depends on how Documenso treats an unverified local account; the first live run reads that. No test asserts a
// provider-side rejection.
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expect, test } from "../../../src/lanes/doc/run-fixture.ts";
import {
  createLocalAccount,
  discovery,
  keycloakLogin,
  localPassword,
  localSignInStatus,
  redirectUrlOf,
  seededUsers,
  sessionEmail,
  signOut,
  startSignIn,
  UNVERIFIED_EMAIL,
  VERIFIED_EMAIL,
} from "./oidc-helper.ts";

test.describe("P5-DOC-OIDC-002", () => {
  test("OIDC-002 control: a verified email signs in", async ({ request, run }) => {
    const web = apiBaseUrl("documenso");
    const users = seededUsers();
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider answers and publishes the requested scopes.
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    expect(doc.body.scopes_supported, "provider publishes the requested scopes").toEqual(
      expect.arrayContaining(["openid", "email", "profile"]),
    );
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const callback = await keycloakLogin(
      await redirectUrlOf(started),
      users.verified.username,
      users.verified.password,
    );
    const first = await request.get(callback, { maxRedirects: 0 });
    expect(first.status(), "verified email signs in").toBe(302);
    expect(await sessionEmail(request, web), "signed in as the verified email").toBe(
      VERIFIED_EMAIL,
    );
  });

  test("OIDC-002 negative: an unverified provider login for an existing local account is refused and not linked", async ({
    request,
    run,
  }) => {
    const web = apiBaseUrl("documenso");
    const users = seededUsers();
    const localPw = localPassword();
    run.onCleanup(async () => {
      await signOut(request, web);
    });
    // Setup, asserted first: the provider answers, and a local account exists for the unverified address.
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    expect(
      await createLocalAccount(request, web, UNVERIFIED_EMAIL, localPw),
      "local account created",
    ).toBe(201);
    // Before state: the local sign-in status for that account.
    const before = await localSignInStatus(request, web, UNVERIFIED_EMAIL, localPw);
    // Negative: the unverified provider login for the same address is refused, with no session.
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts an unverified attempt").toBe(200);
    const refused = await request.get(
      await keycloakLogin(
        await redirectUrlOf(started),
        users.unverified.username,
        users.unverified.password,
      ),
      { maxRedirects: 0 },
    );
    expect(refused.status(), "unverified provider email is refused").toBeGreaterThanOrEqual(400);
    expect(await sessionEmail(request, web), "no session for the unverified login").toBeNull();
    // After state: the local account's sign-in status is unchanged by the refused attempt.
    const after = await localSignInStatus(request, web, UNVERIFIED_EMAIL, localPw);
    expect(after, "after state: local sign-in status unchanged").toBe(before);
  });
});
