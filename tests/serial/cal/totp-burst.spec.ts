// P5-CAL-2FA-001: a throwaway user enables TOTP through the product routes (two-factor/totp/setup then
// /enable; apps/web/app/api/auth/two-factor/totp/{setup,enable}/route.ts). Control: a correct code logs
// in (next-auth-options.ts:214). Burst: TOTP_BURST wrong codes inside one step (runBurst, burst.ts).
// Outcome categories are recorded as an annotation. No lockout is a deployment finding, never a PASS
// of "protected" (plan 5.1). A wrong code that yields a session is a PRODUCT BUG (SUSPECTED).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest, type APIRequestContext } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  loginWithTotp,
  type CalActor,
} from "../../../src/lanes/cal/actor.ts";
import { totp } from "../../../src/lanes/cal/totp.ts";
import { runBurst } from "../../../src/security/burst.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

function base(): string {
  return loadEnv().CAL_BASE_URL.replace(/\/$/, "");
}

/** Enables TOTP for the actor and returns the base32 secret (kept in memory only). */
async function enableTotp(actor: CalActor): Promise<string> {
  const setup = await actor.web.post("/api/auth/two-factor/totp/setup", {
    headers: { "content-type": "application/json" },
    data: { password: actor.password },
  });
  expect(setup.status(), "TOTP setup").toBe(200);
  const { secret } = (await setup.json()) as { secret: string };
  const enable = await actor.web.post("/api/auth/two-factor/totp/enable", {
    headers: { "content-type": "application/json" },
    data: { code: totp(secret, Math.floor(Date.now() / 1000)) },
  });
  expect(enable.status(), "TOTP enable").toBe(200);
  return secret;
}

test.describe("P5-CAL-2FA-001 TOTP", () => {
  test("2FA-001 correct code before the burst succeeds", async ({ run }) => {
    const prefix = currentRunPrefix();
    const actor = await createThrowawayActor(base(), prefix, labelFor("totp"));
    run.onCleanup(() => actor.dispose());
    const secret = await enableTotp(actor);

    const fresh: APIRequestContext = await pwRequest.newContext({ baseURL: base() });
    try {
      const result = await loginWithTotp(
        fresh,
        actor.email,
        actor.password,
        totp(secret, Math.floor(Date.now() / 1000)),
      );
      expect(result.sessionUser, "correct TOTP code establishes a session").toBe(true);
    } finally {
      await fresh.dispose();
    }
  });

  test("2FA-001 burst of wrong codes records its outcome categories", async ({ run }, testInfo) => {
    const prefix = currentRunPrefix();
    const actor = await createThrowawayActor(base(), prefix, labelFor("totp"));
    run.onCleanup(() => actor.dispose());
    const secret = await enableTotp(actor);
    const valid = totp(secret, Math.floor(Date.now() / 1000));

    const sessions: boolean[] = [];
    const result = await runBurst({
      budget: "TOTP_BURST",
      attempt: async (index) => {
        // Wrong codes that differ from the current valid code (never a correct login).
        let code = String(index).padStart(6, "0");
        if (code === valid) code = String((index + 1) % 1_000_000).padStart(6, "0");
        const fresh = await pwRequest.newContext({ baseURL: base() });
        try {
          const outcome = await loginWithTotp(fresh, actor.email, actor.password, code);
          sessions.push(outcome.sessionUser);
          return outcome.status;
        } finally {
          await fresh.dispose();
        }
      },
    });

    const counts: Record<string, number> = {};
    for (const status of result.statuses)
      counts[String(status)] = (counts[String(status)] ?? 0) + 1;
    testInfo.annotations.push({
      type: "2fa-burst",
      description: `attempts=${result.attempts} statuses=${JSON.stringify(counts)} sessionsEstablished=${sessions.filter(Boolean).length}`,
    });
    expect(sessions.filter(Boolean).length, "no wrong TOTP code establishes a session").toBe(0);
  });
});
