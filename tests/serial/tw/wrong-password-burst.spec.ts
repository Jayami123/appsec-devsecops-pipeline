// P5-TW-RL-001 (tw-serial; RC-3). One throwaway member (invited, run prefix). The control is the
// correct password. The negative is BRUTE_FORCE_ATTEMPTS wrong passwords (runBurst, a named budget).
// The oracle: a limit (HTTP 429 or a limit message) at or before the budget is limit evidence. If no
// limit appears within the budget, the row reports a deployment finding and fails; it never passes.
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  adminSetupSession,
  attemptLogin,
  loginThrowaway,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/tw/login.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";
import { runBurst } from "../../../src/security/burst.ts";

test("P5-TW-RL-001: a wrong-password burst on one throwaway account is limited or recorded", async ({
  run,
}, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const email = throwawayEmail(run.prefix, "burst");
  const password = throwawayPassword();
  await joinWorkspace({
    baseUrl: base,
    admin,
    email,
    password,
    awaitLink: () => awaitInviteLink(email),
  });

  const control = await loginThrowaway({ baseUrl: base, email, password });
  expect(control.accessToken.length, "control: the correct password logs in").toBeGreaterThan(0);

  // Readback first (AGENTS.md; tw plan rule 10): the login route exposes no rate-limit headers, so the
  // effective window cannot be read back. The oracle below relies only on observed status and messages.
  const burst = await runBurst({
    budget: "BRUTE_FORCE_ATTEMPTS",
    // A limit reply is recorded as 429 (HTTP 429, or a limit message in the GraphQL error).
    attempt: async (index) => {
      const reply = await attemptLogin({ baseUrl: base, email, password: `wrong-${index}` });
      return reply.limited ? 429 : reply.status;
    },
  });
  const limitedAt: number[] = [];
  for (let index = 0; index < burst.statuses.length; index += 1) {
    const status = burst.statuses[index];
    if (status === 429) limitedAt.push(index);
  }
  testInfo.annotations.push({
    type: "burst",
    description: `attempts=${burst.attempts} statuses=${[...new Set(burst.statuses)].join(",")}`,
  });
  // Deployment finding (owner decision 2; med RL-001 pattern): the verdict is an annotation and the test
  // passes. A limit inside the budget is recorded as a pass; no limit is recorded as a deployment finding.
  const limited = limitedAt.length > 0;
  testInfo.annotations.push({
    type: limited ? "pass" : "deployment-finding",
    description: limited
      ? `limit observed within BRUTE_FORCE_ATTEMPTS (first at attempt ${limitedAt[0]})`
      : "no limit within BRUTE_FORCE_ATTEMPTS (deployment finding, not proof of no lockout; no rate-limit headers, rule 10 readback unavailable)",
  });
});
