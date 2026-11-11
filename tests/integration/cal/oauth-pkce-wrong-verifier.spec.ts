// P5-CAL-OAUTH-002 (lifted by the P-5 probe, D-CAL-B13): PKCE. The right verifier redeems the code
// (control); a wrong code_verifier for a fresh code is refused and no token is issued.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { createThrowawayActor, labelFor } from "../../../src/lanes/cal/actor.ts";
import { exchange, issueCode, pkcePair, submitOwnedClient } from "../../../src/lanes/cal/oauth.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

test.describe("P5-CAL-OAUTH-002 PKCE", () => {
  test("OAUTH-002 right verifier succeeds", async ({ run }) => {
    const base = loadEnv().CAL_BASE_URL;
    const actor = await createThrowawayActor(base, currentRunPrefix(), labelFor("oauthp"));
    run.onCleanup(() => actor.dispose());
    const client = await submitOwnedClient(actor.web, base, "p5 oauth pkce");
    const pkce = pkcePair();
    const code = await issueCode(actor.web, client, pkce.challenge);
    const ok = await exchange(actor.web, client, code, pkce.verifier);
    expect(ok.status, "right verifier").toBe(200);
    expect(ok.accessToken, "access token issued").toBe(true);
  });

  test("OAUTH-002 wrong verifier is refused", async ({ run }) => {
    const base = loadEnv().CAL_BASE_URL;
    const actor = await createThrowawayActor(base, currentRunPrefix(), labelFor("oauthp"));
    run.onCleanup(() => actor.dispose());
    const client = await submitOwnedClient(actor.web, base, "p5 oauth pkce");
    const pkce = pkcePair();
    const code = await issueCode(actor.web, client, pkce.challenge);
    const wrong = pkcePair();
    const denied = await exchange(actor.web, client, code, wrong.verifier);
    expect(denied.accessToken, "wrong verifier issues no token").toBe(false);
    expect(denied.status, `wrong verifier status ${denied.status}`).toBeGreaterThanOrEqual(400);
  });
});
