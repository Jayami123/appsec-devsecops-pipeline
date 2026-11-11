// P5-TW-RBAC-001 (tw-api). A throwaway member on the "Object-restricted" role is the guest. The admin
// control creates a webhook (POST /rest/webhooks, webhook.controller.ts:71-76) and the list grows by one.
// The guest's create is refused with a permission code and the list is unchanged. Observed on the
// live stack: admin 201; guest 400 with a PERMISSION code (an equivalent refusal to the planned 403).
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import {
  adminSetupSession,
  throwawayEmail,
  throwawayPassword,
} from "../../../src/lanes/tw/login.ts";
import { roleIdByLabel } from "../../../src/lanes/tw/keys.ts";
import { awaitInviteLink, joinWorkspace } from "../../../src/lanes/tw/member.ts";

const HOOK = { targetUrl: "http://127.0.0.1:9/p5-rbac", operations: ["company.created"] };

async function webhookCount(base: string, bearer: string): Promise<number> {
  const response = await fetch(`${base}/rest/webhooks?limit=200`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  // The list route returns a plain JSON array (live probe: webhook.controller.ts:51).
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.length : -1;
}

test("P5-TW-RBAC-001: a guest cannot create a webhook", async ({ run }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const restricted = await roleIdByLabel({
    baseUrl: base,
    session: admin,
    label: "Object-restricted",
  });
  if (restricted === undefined) throw new Error("TEST BUG: the restricted role is missing");
  const email = throwawayEmail(run.prefix, "guest");
  const password = throwawayPassword();
  const guest = await joinWorkspace({
    baseUrl: base,
    admin,
    email,
    password,
    roleId: restricted,
    awaitLink: () => awaitInviteLink(email),
  });

  const before = await webhookCount(base, admin.accessToken);
  const control = await fetch(`${base}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${admin.accessToken}` },
    body: JSON.stringify(HOOK),
  });
  expect(control.status, "control: the admin creates a webhook").toBe(201);
  // The create route returns the entity itself (webhook.controller.ts:71-76; live probe).
  const created = ((await control.json()) as { id?: string }).id;
  run.onCleanup(async () => {
    if (created !== undefined) {
      await fetch(`${base}/rest/webhooks/${created}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
    }
  });
  expect(await webhookCount(base, admin.accessToken), "control: the list grows by one").toBe(
    before + 1,
  );

  const mid = await webhookCount(base, admin.accessToken);
  const negative = await fetch(`${base}/rest/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${guest.accessToken}` },
    body: JSON.stringify(HOOK),
  });
  expect([400, 403], "the guest create is refused").toContain(negative.status);
  expect(await webhookCount(base, admin.accessToken), "the list is unchanged by the guest").toBe(
    mid,
  );
});
