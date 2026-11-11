// WH-003 (D-CAL-B38): a fresh timestamp passes the gate (control); a timestamp WEBHOOK_STALE_AGE_S + 1
// seconds old with a valid signature for that timestamp is refused. The route has no age check
// (route.ts:70-75; verify.ts:99-101 records that Cal checks no tolerance), so acceptance here is a
// PRODUCT BUG (SUSPECTED) finding, not a pass. The recorded state is not observable (see replay.spec.ts).
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { DAILY_ROUTE, dailyDelivery, staleTimestamp } from "../../../src/lanes/cal/webhook.ts";
import { expectedDefect } from "../../../src/kit/ci/known-defect.ts";
import { DAILY_SIGNATURE_HEADER, DAILY_TIMESTAMP_HEADER } from "../../../src/kit/webhooks/sign.ts";

const PROBE = { type: "p5.probe.unknown-event", payload: { note: "p5 WH-003 stale probe" } };

function webhookSecret(): string {
  const value = process.env.DAILY_WEBHOOK_SECRET;
  if (value === undefined || value === "") throw new Error("ENV_MISSING: DAILY_WEBHOOK_SECRET");
  return value;
}

test.describe("P5-CAL-WH-003 stale timestamp", () => {
  test("WH-003 fresh timestamp passes the authenticity gate", async ({ request }) => {
    const url = `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${DAILY_ROUTE}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const res = await request.post(url, {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    expect(res.status(), "fresh timestamp passes the gate").toBe(200);
  });

  test("WH-003 stale timestamp with a valid signature is refused", async ({ request }) => {
    const url = `${loadEnv().CAL_BASE_URL.replace(/\/$/, "")}${DAILY_ROUTE}`;
    const now = Math.floor(Date.now() / 1000);
    const timestamp = staleTimestamp(now);
    const signed = dailyDelivery(webhookSecret(), PROBE, timestamp);
    const res = await request.post(url, {
      headers: {
        "content-type": "application/json",
        [DAILY_SIGNATURE_HEADER]: signed.headers[DAILY_SIGNATURE_HEADER] ?? "",
        [DAILY_TIMESTAMP_HEADER]: timestamp,
      },
      data: signed.body,
    });
    // Gate refusal is the property: a stale delivery must not pass (403 at route.ts:73-75 or a 4xx).
    expectedDefect(
      "P5-CAL-WH-003: apps/web/app/api/recorded-daily-video/route.ts:70-75 has no timestamp age check (verify.ts:99-101 records no tolerance); live cal run 5 accepted the stale signed delivery with 200",
    );
    expect(res.status(), "stale delivery refused").toBeGreaterThanOrEqual(400);
  });
});
