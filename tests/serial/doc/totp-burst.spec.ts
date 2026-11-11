// P5-DOC-MI-15 TOTP burst (doc plan section 4.7). Two-factor: setup :23, enable :40, disable :78 (two-factor.ts).
// The second factor is checked at sign-in (authorize, email-password.ts:66, ZSignInSchema totpCode), and the
// CSRF token must match the cookie (email-password.ts:90-93). Codes come from src/lanes/doc/totp.ts. The burst
// size is BUDGETS.TOTP_BURST (budgets.ts:20), read by name through runBurst. No 429 inside the burst is a
// DEPLOYMENT FINDING (the test fails visibly), never a PASS of "protected" (doc plan section 4.7).
import { test, expect, actorOf, type ActorHandle } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { runBurst } from "../../../src/security/burst.ts";
import { totp, base32Decode, TOTP_DIGITS } from "../../../src/lanes/doc/totp.ts";

const TWO_FACTOR = "/api/auth/two-factor";
const AUTHORIZE = "/api/auth/email-password/authorize";

/** Shared across the three tests of this file, which run in order on one worker. */
let secret = "";
let recoveryCodes: string[] = [];
let burstStatuses: number[] = [];

async function csrfFor(member: ActorHandle): Promise<string> {
  const res = await member.request.get(`${apiBaseUrl("documenso")}/api/auth/csrf`);
  return ((await res.json()) as { csrfToken?: string }).csrfToken ?? "";
}

function currentCode(): string {
  return totp(base32Decode(secret), Date.now() / 1000);
}

test.describe("P5-DOC-MI-15", () => {
  test("MI-15 correct TOTP code succeeds before the burst (control)", async ({ actors }) => {
    const member = actorOf(actors, "member");
    const base = apiBaseUrl("documenso");
    const setup = await member.request.post(`${base}${TWO_FACTOR}/setup`);
    expect(setup.status()).toBe(200);
    secret = ((await setup.json()) as { secret?: string }).secret ?? "";
    expect(secret.length).toBeGreaterThan(0);
    const enable = await member.request.post(`${base}${TWO_FACTOR}/enable`, {
      data: { code: currentCode() },
    });
    expect(enable.status(), "control: correct code accepted at enable").toBe(200);
    recoveryCodes = ((await enable.json()) as { recoveryCodes?: string[] }).recoveryCodes ?? [];
    expect(
      recoveryCodes.length,
      "control: enable returns recovery codes for cleanup",
    ).toBeGreaterThan(0);
    expect(currentCode()).toHaveLength(TOTP_DIGITS);
  });

  test("MI-15 twenty wrong codes are each refused and recorded", async ({ actors }) => {
    const member = actorOf(actors, "member");
    const base = apiBaseUrl("documenso");
    burstStatuses = [];
    const result = await runBurst({
      budget: "TOTP_BURST",
      attempt: async () => {
        // Password correct, second factor wrong. The wrong code is never the current valid one.
        const wrong = currentCode() === "000000" ? "111111" : "000000";
        const res = await member.request.post(`${base}${AUTHORIZE}`, {
          data: {
            email: member.actor.email,
            password: member.actor.password,
            totpCode: wrong,
            csrfToken: await csrfFor(member),
          },
        });
        burstStatuses.push(res.status());
        return res.status();
      },
    });
    test
      .info()
      .annotations.push({ type: "burst-status-counts", description: countsOf(result.statuses) });
    expect(result.attempts).toBe(burstStatuses.length);
    // Red-row: after setup (the burst ran), before the product assertion that is expected to fail.
    expectedDefect(
      "P5-DOC-MI-15: packages/auth/server/index.ts:70 defaults AppError without statusCode to 500; InvalidTwoFactorCode at packages/auth/server/routes/email-password.ts:156",
    );
    for (const status of burstStatuses) {
      expect(status, "each wrong code is refused").toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    }
  });

  test("MI-15 correct code after the burst shows account state", async ({ actors }) => {
    const member = actorOf(actors, "member");
    const base = apiBaseUrl("documenso");
    const backupCode = recoveryCodes[0];
    expect(backupCode, "cleanup token from enable").toBeTruthy();
    try {
      const after = await member.request.post(`${base}${AUTHORIZE}`, {
        data: {
          email: member.actor.email,
          password: member.actor.password,
          totpCode: currentCode(),
          csrfToken: await csrfFor(member),
        },
      });
      test
        .info()
        .annotations.push({ type: "post-burst-status", description: String(after.status()) });
      // 201: the correct code signs in (no lockout). 429: the limiter answered after the burst.
      expect([201, 429]).toContain(after.status());
      expect(
        burstStatuses.includes(429),
        "DEPLOYMENT FINDING: no 429 inside the TOTP burst; the row cannot claim the account is protected",
      ).toBe(true);
    } finally {
      // Cleanup: disable two-factor with a recovery code (two-factor.ts:78, :109 returns 201).
      const disabled = await member.request.post(`${base}${TWO_FACTOR}/disable`, {
        data: { backupCode },
      });
      expect(disabled.status(), "cleanup: two-factor disabled").toBe(201);
    }
  });
});

function countsOf(statuses: readonly number[]): string {
  const counts: Record<string, number> = {};
  for (const status of statuses) counts[String(status)] = (counts[String(status)] ?? 0) + 1;
  return JSON.stringify(counts);
}
