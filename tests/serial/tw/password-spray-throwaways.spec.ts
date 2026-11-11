// P5-TW-RL-002 (tw-serial; RC-3). BUDGETS.TW_SPRAY_ACCOUNTS.value throwaway members (invited, run prefix).
// The control is each account's correct login (joinWorkspace). The negative is one invalid attempt per
// account, never more. The oracle is the per-account result, recorded for every account. A throttle is
// recorded when observed; its absence is reported in the annotation, not as a pass for the limit.
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
import { BUDGETS } from "../../../src/security/budgets.ts";

test("P5-TW-RL-002: one attempt per throwaway account across the spray set is recorded per account", async ({
  run,
}, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const accounts = BUDGETS.TW_SPRAY_ACCOUNTS.value; // by name, never a literal
  const results: Array<{ index: number; control: boolean; status: number; limited: boolean }> = [];
  for (let index = 0; index < accounts; index += 1) {
    const email = throwawayEmail(run.prefix, `spray-${index}`);
    const password = throwawayPassword();
    await joinWorkspace({
      baseUrl: base,
      admin,
      email,
      password,
      awaitLink: () => awaitInviteLink(email),
    });
    const control =
      (await loginThrowaway({ baseUrl: base, email, password })).accessToken.length > 0;
    const attempt = await attemptLogin({ baseUrl: base, email, password: `spray-wrong-${index}` });
    results.push({ index, control, status: attempt.status, limited: attempt.limited });
  }
  const throttled = results.filter((row) => row.limited).length;
  testInfo.annotations.push({
    type: "spray",
    description: `accounts=${accounts} controls_ok=${results.filter((row) => row.control).length} statuses=${[...new Set(results.map((row) => row.status))].join(",")} throttled=${throttled}`,
  });
  expect(results.length, "the per-account result is recorded for every account").toBe(accounts);
  expect(
    results.every((row) => row.control),
    "every account's control login succeeded",
  ).toBe(true);
});
