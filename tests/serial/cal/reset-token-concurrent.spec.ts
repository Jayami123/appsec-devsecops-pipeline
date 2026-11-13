// P5-CAL-TOK-001: one password-reset token is redeemed. The token is the resetPasswordRequest id in the
// mailed link (forgot-password route, passwordResetRequest.ts). Control: a single redemption succeeds.
// Negative: CAL_RESET_CONCURRENT_N parallel redemptions of one token must allow exactly one success.
// Expected defect (PRODUCT BUG, SUSPECTED): apps/web/app/api/auth/reset-password/route.ts reads the
// request with findFirstOrThrow (line 50) and expires it only after the password write (line 87), so
// concurrent requests all pass the lookup.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { catcherMessagesFor } from "../../../src/lanes/cal/mail.ts";
import { createThrowawayActor, labelFor, type CalActor } from "../../../src/lanes/cal/actor.ts";
import { throwawayPassword } from "../../../src/lanes/cal/login.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

const RESET_SUBJECT = "Reset password instructions";
const RESET_LINK = /forgot-password\/([a-z0-9]{20,40})/i;
const MAIL_DEADLINE_MS = 30_000;

function base(): string {
  return loadEnv().CAL_BASE_URL.replace(/\/$/, "");
}

/** Requests a reset for the actor and returns the request id from the mailed link (never printed). */
async function requestResetToken(actor: CalActor): Promise<string> {
  const res = await actor.web.post("/api/auth/forgot-password", {
    headers: { "content-type": "application/json" },
    data: { email: actor.email },
  });
  expect(res.status(), "forgot-password accepted").toBe(201);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const mails = await catcherMessagesFor(actor.email, RESET_SUBJECT);
        const match = mails.map((m) => RESET_LINK.exec(m.text)).find((x) => x !== null);
        id = match?.[1];
        return id !== undefined;
      },
      { message: "reset mail reaches the catcher", timeout: MAIL_DEADLINE_MS },
    )
    .toBe(true);
  return id as string;
}

/** CSRF token from /api/csrf (csrf/route.ts). Fetched once per batch: the cookie jar is shared. */
async function csrfToken(actor: CalActor): Promise<string> {
  const csrf = await actor.web.get(`${base()}/api/csrf`);
  const { csrfToken: token } = (await csrf.json()) as { csrfToken: string };
  return token;
}

/** One redemption through the product route, with a CSRF token fetched before the batch. */
async function redeem(actor: CalActor, requestId: string, token: string): Promise<number> {
  const res = await actor.web.post("/api/auth/reset-password", {
    headers: { "content-type": "application/json" },
    data: {
      csrfToken: token,
      password: throwawayPassword(),
      requestId,
    },
  });
  return res.status();
}

test.describe("P5-CAL-TOK-001 reset token", () => {
  test("TOK-001 single redemption succeeds", async ({ run }) => {
    const actor = await createThrowawayActor(base(), currentRunPrefix(), labelFor("tok"));
    run.onCleanup(() => actor.dispose());
    const id = await requestResetToken(actor);
    expect(
      await redeem(actor, id, await csrfToken(actor)),
      "single redemption of the reset token",
    ).toBe(201);
  });

  test("TOK-001 parallel redemptions allow exactly one success", async ({ run }) => {
    const actor = await createThrowawayActor(base(), currentRunPrefix(), labelFor("tok"));
    run.onCleanup(() => actor.dispose());
    const id = await requestResetToken(actor);
    const token = await csrfToken(actor);
    const statuses = await Promise.all(
      Array.from({ length: BUDGETS.CAL_RESET_CONCURRENT_N.value }, () => redeem(actor, id, token)),
    );
    const successes = statuses.filter((s) => s >= 200 && s < 300).length;
    test.info().annotations.push({ type: "tok-001-statuses", description: statuses.join(",") });
    expectedDefect(
      "P5-CAL-TOK-001: apps/web/app/api/auth/reset-password/route.ts:50-56 looks the request up with findFirstOrThrow and expires it only at line 87, after the password write; concurrent redemptions all passed the lookup",
    );
    expect(
      successes,
      `exactly one success of ${statuses.length} parallel redemptions; statuses ${statuses.join(",")}`,
    ).toBe(1);
  });
});
