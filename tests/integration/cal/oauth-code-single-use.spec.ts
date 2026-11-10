// P5-CAL-OAUTH-001 (lifted by the P-5 probe, D-CAL-B13): an authorization code redeems once.
// Route path and checks: src/lanes/cal/oauth.ts (normal user routes only). The control is the first
// redemption; the negative is a second redemption of the same code, which must be refused.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { createThrowawayActor, labelFor } from "../../../src/lanes/cal/actor.ts";
import { exchange, issueCode, pkcePair, submitOwnedClient } from "../../../src/lanes/cal/oauth.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

test.describe("P5-CAL-OAUTH-001 authorization code", () => {
  test("OAUTH-001 first redemption succeeds", async ({ run }) => {
    const base = loadEnv().CAL_BASE_URL;
    const actor = await createThrowawayActor(base, currentRunPrefix(), labelFor("oauth"));
    run.onCleanup(() => actor.dispose());
    const client = await submitOwnedClient(actor.web, base, "p5 oauth single use");
    const pkce = pkcePair();
    const code = await issueCode(actor.web, client, pkce.challenge);
    const first = await exchange(actor.web, client, code, pkce.verifier);
    expect(first.status, "first redemption").toBe(200);
    expect(first.accessToken, "access token issued").toBe(true);
  });

  test("OAUTH-001 second redemption is refused", async ({ run }) => {
    const base = loadEnv().CAL_BASE_URL;
    const actor = await createThrowawayActor(base, currentRunPrefix(), labelFor("oauth"));
    run.onCleanup(() => actor.dispose());
    const client = await submitOwnedClient(actor.web, base, "p5 oauth single use");
    const pkce = pkcePair();
    const code = await issueCode(actor.web, client, pkce.challenge);
    const first = await exchange(actor.web, client, code, pkce.verifier);
    expect(first.status, "control: first redemption").toBe(200);
    const second = await exchange(actor.web, client, code, pkce.verifier);
    expect(second.accessToken, "second redemption yields no token").toBe(false);
    expect(second.status, `second redemption status ${second.status}`).toBeGreaterThanOrEqual(400);
  });
});
