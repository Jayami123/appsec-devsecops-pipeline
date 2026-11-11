// P5-MED-RL-001 (med plan 3c.6, D-MED-6). A wrong-password burst against a THROWAWAY admin only (invite route).
import { randomBytes } from "node:crypto";
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { openHarnessAdminSession } from "../../../src/lanes/med/admin-session.ts";
import { createThrowawayAdminUser } from "../../../src/lanes/med/throwaway-admin.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { runBurst } from "../../../src/security/burst.ts";
import type { APIRequestContext } from "@playwright/test";

const base = () => apiBaseUrl("medusa");

async function login(api: APIRequestContext, email: string, password: string): Promise<number> {
  const response = await api.fetch(`${base()}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    data: { email, password },
  });
  return response.status();
}

test.describe("P5-MED-RL-001", () => {
  test("P5-MED-RL-001 control: the correct password logs the throwaway admin in", async ({
    request,
    run,
  }) => {
    const admin = await openHarnessAdminSession();
    const user = await createThrowawayAdminUser(request, admin, run, "rl001c");
    expect(await login(request, user.email, user.password), "control: correct password").toBe(200);
  });

  test("P5-MED-RL-001 a wrong-password burst is counted by the named budget", async ({
    request,
    run,
  }, testInfo) => {
    const admin = await openHarnessAdminSession();
    const user = await createThrowawayAdminUser(request, admin, run, "rl001b");
    const result = await runBurst({
      budget: "BRUTE_FORCE_ATTEMPTS",
      attempt: (index) =>
        login(request, user.email, `wrong-${index}-${randomBytes(6).toString("hex")}`),
    });
    const limited = result.statuses.filter((status) => status === 429).length;
    const serverErrors = result.statuses.filter((status) => status >= 500).length;
    expect(result.attempts, "attempts counted by the named budget").toBe(101);
    expect(serverErrors, "no server error during the burst").toBe(0);
    testInfo.annotations.push({
      type: limited > 0 ? "pass" : "deployment-finding",
      description: `burst attempts=${result.attempts} rate-limited(429)=${limited}; ${
        limited > 0 ? "limit observed" : "no throttle observed (deployment finding, MP:639)"
      }`,
    });
  });

  test("P5-MED-RL-001 the account state is recorded after the burst", async ({
    request,
    run,
  }, testInfo) => {
    const admin = await openHarnessAdminSession();
    const user = await createThrowawayAdminUser(request, admin, run, "rl001s");
    await runBurst({
      budget: "BRUTE_FORCE_ATTEMPTS",
      attempt: (index) =>
        login(request, user.email, `wrong-${index}-${randomBytes(6).toString("hex")}`),
    });
    const after = await login(request, user.email, user.password);
    testInfo.annotations.push({
      type: "account-state",
      description: `correct password after the burst: HTTP ${after}`,
    });
    expect(
      [200, 429],
      "the account answers with success or a limit, never a server error",
    ).toContain(after);
  });
});
