import { test } from "node:test";
import assert from "node:assert/strict";
import { assertThrowawayEmail, throwawayCustomerEmail } from "../../../../src/lanes/med/auth.ts";

const PREFIX = "p5-qa-20261110t090000z-1a2b3c4d";

test("throwawayCustomerEmail carries the run prefix and the .test TLD", () => {
  const email = throwawayCustomerEmail(PREFIX, "authz1a");
  assert.equal(email, `${PREFIX}-authz1a@example.test`);
  assert.ok(email.endsWith(".test") || email.endsWith("@example.test"));
});

test("assertThrowawayEmail refuses an email outside the run prefix with NOT_THROWAWAY", () => {
  // Positive control: the helper's own output is accepted.
  assert.doesNotThrow(() => {
    assertThrowawayEmail(throwawayCustomerEmail(PREFIX, "x"), PREFIX);
  });
  // Negative: a different run prefix and a real-looking address are both refused.
  assert.throws(() => {
    assertThrowawayEmail("p5-qa-20990101t000000z-ffffffff-x@example.test", PREFIX);
  }, /NOT_THROWAWAY/);
  assert.throws(() => {
    assertThrowawayEmail(`${PREFIX}-x@gmail.com`, PREFIX);
  }, /NOT_THROWAWAY/);
});
