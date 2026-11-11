// NEW-TW-3 (tw-ssrf-allow job, D-TW-B7). An outgoing webhook delivery carries X-Twenty-Webhook-Timestamp,
// -Signature and -Nonce (src/kit/webhooks/sign.ts:50-52; signTwenty :58: HMAC-SHA256 over `${timestamp}:${body}`).
// Control: the delivery verifies with the secret returned at webhook create (verifyTwenty, src/kit/webhooks/verify.ts:78).
// Negative: the same captured delivery, presented after the stale window, is refused by the receiver's policy
// (toleranceMs = BUDGETS.WEBHOOK_STALE_AGE_S). The product documents no tolerance, so the replay verdict is a design
// verdict about the receiver policy, not a product rule. The secret is held in memory and never printed.
import { randomBytes } from "node:crypto";
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { startCanaryReceiver } from "../../../src/lanes/tw/canary.ts";
import { verifyTwenty } from "../../../src/kit/webhooks/verify.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";

test("NEW-TW-3: an outgoing delivery carries a verifiable signature and a replay is detectable @ssrf-allow", async ({
  run,
}, testInfo) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const H = { authorization: `Bearer ${admin.accessToken}`, "content-type": "application/json" };
  const receiver = await startCanaryReceiver();
  run.onCleanup(async () => {
    await receiver.stop();
  });
  const key = { runId: run.prefix, testId: `tw3-${randomBytes(8).toString("hex")}` };
  const hook = (await (
    await fetch(`${base}/rest/webhooks`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        targetUrl: receiver.receiver.urlFor(key, "host.docker.internal"),
        operations: ["company.created"],
      }),
    })
  ).json()) as { id: string; secret: string };
  run.onCleanup(async () => {
    await fetch(`${base}/rest/webhooks/${hook.id}`, { method: "DELETE", headers: H });
  });
  run.trackLeak({
    label: `webhook ${hook.id}`,
    // A deleted webhook reads back as HTTP 200 with no entity (live), so presence means an entity with this id.
    stillPresent: async () => {
      const response = await fetch(`${base}/rest/webhooks/${hook.id}`, { headers: H });
      const body = (await response.json().catch(() => null)) as { id?: string } | null;
      return response.status === 200 && body?.id === hook.id;
    },
  });

  await fetch(`${base}/rest/companies`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ name: `${run.prefix}-tw3` }),
  });
  await expect.poll(() => receiver.receiver.deliveries(key).length).toBeGreaterThan(0);
  const [delivery] = receiver.receiver.deliveries(key);
  if (delivery === undefined) throw new Error("TEST BUG: no delivery after the poll");

  const control = verifyTwenty({
    secret: hook.secret,
    rawBody: delivery.rawBody,
    headers: delivery.headers,
    nowMs: Date.now(),
    toleranceMs: null,
  });
  expect(control.ok, "control: the delivery verifies with the product scheme").toBe(true);

  const capturedAt = Number(delivery.headers["x-twenty-webhook-timestamp"]);
  const staleMs = BUDGETS.WEBHOOK_STALE_AGE_S.value * 1000;
  const replay = verifyTwenty({
    secret: hook.secret,
    rawBody: delivery.rawBody,
    headers: delivery.headers,
    nowMs: capturedAt + staleMs + 1000,
    toleranceMs: staleMs,
  });
  testInfo.annotations.push({
    type: "design-verdict",
    description: `scheme verified; replay past the stale window refused by receiver policy: ${replay.ok ? "NOT refused" : "refused"}; product documents no tolerance (kit verify.ts:78)`,
  });
  expect(replay.ok, "a replay past the stale window is detected").toBe(false);
});
