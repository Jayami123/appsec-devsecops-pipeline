// P5-MED-RL-001 (med plan 3c.6, D-MED-6). A wrong-password burst against a THROWAWAY admin only (invite route).
import { randomBytes } from "node:crypto";
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import {
  openHarnessAdminSession,
  type AdminSession,
} from "../../../src/lanes/med/admin-session.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { runBurst } from "../../../src/security/burst.ts";
import type { APIRequestContext } from "@playwright/test";
import type { RunScope } from "../../../src/lanes/med/run-fixture.ts";

interface ThrowawayAdmin {
  readonly email: string;
  readonly password: string;
  readonly userId: string;
}

const base = () => apiBaseUrl("medusa");

/** Invite a throwaway admin (POST /admin/invites), register its identity, accept the invite. Cleanup in the run scope. */
async function throwawayAdmin(
  api: APIRequestContext,
  admin: AdminSession,
  run: RunScope,
  label: string,
): Promise<ThrowawayAdmin> {
  const email = `${run.prefix}-${label}@example.test`;
  const password = randomBytes(18).toString("base64url");
  const invited = await api.fetch(`${base()}/admin/invites`, {
    method: "POST",
    headers: { authorization: admin.authorization, "content-type": "application/json" },
    data: { email },
  });
  if (invited.status() !== 200) throw new Error(`invite failed: HTTP ${invited.status()}`);
  const invite = ((await invited.json()) as { invite?: { id?: string; token?: string } }).invite;
  if (!invite?.token || !invite.id)
    throw new Error("invite: no token in the create response (ENV or design)");
  run.onCleanup(async () => {
    const r = await api.fetch(`${base()}/admin/invites/${invite.id}`, {
      method: "DELETE",
      headers: { authorization: admin.authorization },
    });
    if (r.status() !== 200) throw new Error(`delete invite failed: HTTP ${r.status()}`);
  });

  const registered = await api.fetch(`${base()}/auth/user/emailpass/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    data: { email, password },
  });
  if (registered.status() !== 200)
    throw new Error(`register identity failed: HTTP ${registered.status()}`);
  const registrationToken = ((await registered.json()) as { token?: string }).token;
  if (!registrationToken) throw new Error("register identity: no token");

  const accepted = await api.fetch(
    `${base()}/admin/invites/accept?token=${encodeURIComponent(invite.token)}`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${registrationToken}`, "content-type": "application/json" },
      data: { first_name: "P5", last_name: label },
    },
  );
  if (accepted.status() !== 200) throw new Error(`accept invite failed: HTTP ${accepted.status()}`);
  const userId = ((await accepted.json()) as { user?: { id?: string } }).user?.id;
  if (!userId) throw new Error("accept invite: no user id");
  run.onCleanup(async () => {
    const r = await api.fetch(`${base()}/admin/users/${userId}`, {
      method: "DELETE",
      headers: { authorization: admin.authorization },
    });
    if (r.status() !== 200) throw new Error(`delete throwaway admin failed: HTTP ${r.status()}`);
  });
  return { email, password, userId };
}

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
    const user = await throwawayAdmin(request, admin, run, "rl001c");
    expect(await login(request, user.email, user.password), "control: correct password").toBe(200);
  });

  test("P5-MED-RL-001 a wrong-password burst is counted by the named budget", async ({
    request,
    run,
  }, testInfo) => {
    const admin = await openHarnessAdminSession();
    const user = await throwawayAdmin(request, admin, run, "rl001b");
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
    const user = await throwawayAdmin(request, admin, run, "rl001s");
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
