import { test } from "node:test";
import assert from "node:assert/strict";
import { assertThrowawayEmail, throwawayEmail } from "../../../../src/lanes/tw/login.ts";

const RUN_ID = "p5-qa-20261110t090000z-1a2b3c4d";
const env = { P5_RUN_ID: RUN_ID } as NodeJS.ProcessEnv;

test("assertThrowawayEmail refuses a non-prefixed email with NOT_THROWAWAY", () => {
  assert.throws(() => {
    assertThrowawayEmail("someone@example.test", env);
  }, /NOT_THROWAWAY/);
});

test("assertThrowawayEmail accepts a run-prefixed email", () => {
  assert.doesNotThrow(() => {
    assertThrowawayEmail(throwawayEmail(RUN_ID, "a"), env);
  });
});

test("throwawayEmail carries the run prefix and the .test TLD", () => {
  const email = throwawayEmail(RUN_ID, "member");
  assert.ok(email.startsWith(RUN_ID));
  assert.ok(email.endsWith(".test") || email.endsWith("@example.test"));
});
