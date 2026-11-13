// P5-CAL-WH-004 (build item): a forged Daily signature is refused at the authenticity gate.
// Oracle: 403 from fork ref held by the owner, which runs before any handler
// work, so no state is read or changed (the probe type is unknown and changes nothing either way).
// Each negative test runs its own control first: the same probe, correctly signed with the per-job
// DAILY_WEBHOOK_SECRET (decision D-CAL-B5), must pass the gate (200 at fork ref held by the owner).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { DAILY_ROUTE, dailyDelivery, forgedSignature } from "../../../src/lanes/cal/webhook.ts";
import { DAILY_SIGNATURE_HEADER, DAILY_TIMESTAMP_HEADER } from "../../../src/kit/webhooks/sign.ts";

// An unknown event type: the gate runs, then the route answers without touching any booking.
const PROBE = { type: "p5.probe.unknown-event", payload: { note: "p5 WH-004 authenticity probe" } };

function webhookSecret(): string {
  const value = process.env.DAILY_WEBHOOK_SECRET;
  // Fail closed: the name only, never the value.
  if (value === undefined || value === "") throw new Error("ENV_MISSING: DAILY_WEBHOOK_SECRET");
  return value;
}

function webhookUrl(): string {
  return `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${DAILY_ROUTE}`;
}

test.describe("P5-CAL-WH-004 forged Daily signatures", () => {
  test("P5-CAL-WH-004 random signature value is refused", async ({ request }) => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    // Control: the correctly signed probe passes the gate.
    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const control = await request.post(webhookUrl(), {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(control.status(), "control: correctly signed probe passes the gate").toBe(200);

    const forged = await request.post(webhookUrl(), {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: forgedSignature(),
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(forged.status(), "random signature is refused").toBe(403);
  });

  test("P5-CAL-WH-004 secret-independent signature value is refused", async ({ request }) => {
    const timestamp = String(Math.floor(Date.now() / 1000));

    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const control = await request.post(webhookUrl(), {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(control.status(), "control: correctly signed probe passes the gate").toBe(200);

    // 32 zero bytes, base64: a fixed value that is not derived from any secret.
    const constant = Buffer.alloc(32).toString("base64");
    const forged = await request.post(webhookUrl(), {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: constant,
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(forged.status(), "secret-independent signature is refused").toBe(403);
  });
});
