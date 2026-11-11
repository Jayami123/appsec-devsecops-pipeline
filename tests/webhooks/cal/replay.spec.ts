// WH-002 (D-CAL-B38): a signed Daily delivery and its exact replay. The state change of a real
// recording is reached only through Daily's API (recordings come from Daily: calVideoService.getRecordings,
// cal-video.service.ts:28-45), so the observable oracle here is the authenticity gate decision:
// route.ts:70-75 (signature and timestamp header checks). No state is read or changed by the probe.
// The route keeps no nonce, so an identical replay is expected to be refused; the assertion states that.
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { DAILY_ROUTE, dailyDelivery } from "../../../src/lanes/cal/webhook.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { DAILY_SIGNATURE_HEADER, DAILY_TIMESTAMP_HEADER } from "../../../src/kit/webhooks/sign.ts";

const PROBE = { type: "p5.probe.unknown-event", payload: { note: "p5 WH-002 replay probe" } };

function webhookSecret(): string {
  const value = process.env.DAILY_WEBHOOK_SECRET;
  if (value === undefined || value === "") throw new Error("ENV_MISSING: DAILY_WEBHOOK_SECRET");
  return value;
}

test.describe("P5-CAL-WH-002 replay", () => {
  test("WH-002 first signed delivery passes the authenticity gate", async ({ request }) => {
    const url = `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${DAILY_ROUTE}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const first = await request.post(url, {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(first.status(), "first signed delivery passes the gate").toBe(200);
  });

  test("WH-002 replayed signed request is refused", async ({ request }) => {
    const url = `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${DAILY_ROUTE}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const headers = {
      "content-type": "application/json",
      [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
      [DAILY_TIMESTAMP_HEADER]: timestamp,
    };
    const first = await request.post(url, { headers, data: signed.body });
    expect(first.status(), "control: first delivery passes the gate").toBe(200);
    const replay = await request.post(url, { headers, data: signed.body });
    expectedDefect(
      "P5-CAL-WH-002: apps/web/app/api/recorded-daily-video/route.ts:70-75 checks the HMAC over the timestamp header and keeps no nonce; live cal run 5 accepted the identical replay with 200",
    );
    expect(replay.status(), "identical replay is refused").toBeGreaterThanOrEqual(400);
  });
});
