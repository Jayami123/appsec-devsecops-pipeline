// Held-private check (ID only; owner-approved scoped exception, D-DOC-B84). Title and messages name only the ID.
// Scope: request binding only. It checks the authorize request (client, redirect URI, PKCE method, state) and says nothing
// about the ID token that the callback receives.
// The sanitiser reduces this spec to ID and status in the JSON, the job summary, and removes the HTML report
// and test results for the job (scripts/prepare-ci-artifacts.ts). Evidence is reported to the owner only.
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expect, test } from "../../../src/lanes/doc/run-fixture.ts";
import {
  callbackUri,
  discovery,
  IDP_CLIENT_ID,
  redirectUrlOf,
  startSignIn,
} from "./oidc-helper.ts";

test.describe("P5-DOC-OIDC-003", () => {
  test("P5-DOC-OIDC-003 check", async ({ request }) => {
    const web = apiBaseUrl("documenso");
    // Setup, asserted first: the provider answers.
    const doc = await discovery();
    expect(doc.status, "provider discovery answers 200").toBe(200);
    const started = await startSignIn(request, web);
    expect(started.status(), "authorize starts a sign-in").toBe(200);
    const url = new URL(await redirectUrlOf(started));
    expect(url.searchParams.get("client_id")).toBe(IDP_CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(callbackUri(web));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect((url.searchParams.get("state") ?? "").length).toBeGreaterThan(0);
  });
});
