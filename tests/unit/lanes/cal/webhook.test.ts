import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import { verifyDaily } from "../../../../src/kit/webhooks/verify.ts";
import {
  DAILY_SIGNATURE_HEADER,
  DAILY_TIMESTAMP_HEADER,
} from "../../../../src/kit/webhooks/sign.ts";
import {
  dailyDelivery,
  forgedSignature,
  staleTimestamp,
} from "../../../../src/lanes/cal/webhook.ts";

// Test-only secret (not a credential): 32 bytes base64, labelled throwaway.
const SECRET = Buffer.alloc(32, 7).toString("base64");
const NOW = 1_800_000_000;

test("staleTimestamp is WEBHOOK_STALE_AGE_S + 1 seconds before now", () => {
  assert.equal(staleTimestamp(NOW), String(NOW - (BUDGETS.WEBHOOK_STALE_AGE_S.value + 1)));
});

test("dailyDelivery signs with signDaily and verifies with verifyDaily", () => {
  const payload = { triggerEvent: "RECORDING_READY", payload: { roomName: "p5-test" } };
  const delivery = dailyDelivery(SECRET, payload, String(NOW));
  const result = verifyDaily({
    secretBase64: SECRET,
    rawBody: delivery.body,
    headers: {
      [DAILY_SIGNATURE_HEADER]: delivery.headers[DAILY_SIGNATURE_HEADER] ?? "",
      [DAILY_TIMESTAMP_HEADER]: delivery.headers[DAILY_TIMESTAMP_HEADER] ?? "",
    },
    nowSeconds: NOW,
    toleranceSeconds: null,
  });
  assert.equal(result.ok, true);
});

test("forged signatures never verify (random and secret-independent)", () => {
  const body = Buffer.from(JSON.stringify({ triggerEvent: "RECORDING_READY" }));
  const a = forgedSignature();
  const b = forgedSignature();
  assert.notEqual(a, b);
  for (const signature of [a, b]) {
    const result = verifyDaily({
      secretBase64: SECRET,
      rawBody: body,
      headers: { [DAILY_SIGNATURE_HEADER]: signature, [DAILY_TIMESTAMP_HEADER]: String(NOW) },
      nowSeconds: NOW,
      toleranceSeconds: null,
    });
    assert.equal(result.ok, false);
  }
});
