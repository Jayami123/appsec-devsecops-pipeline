import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NotThrowawayError,
  assertThrowawayEmail,
  throwawayEmail,
  throwawayPassword,
} from "../../../../src/lanes/cal/login.ts";

const PREFIX = "p5-qa-20261110t000000z-0a1b2c3d";

test("assertThrowawayEmail refuses an email without the run prefix", () => {
  assert.throws(
    () => {
      assertThrowawayEmail("someone@example.test", PREFIX);
    },
    (error: unknown) => error instanceof NotThrowawayError,
  );
  assert.doesNotThrow(() => {
    assertThrowawayEmail(throwawayEmail(PREFIX, "owner"), PREFIX);
  });
});

test("throwawayEmail carries the run prefix and the .test TLD", () => {
  const email = throwawayEmail(PREFIX, "owner");
  assert.equal(email, `${PREFIX}-owner@example.test`);
});

test("throwawayEmail refuses a label outside [a-z0-9-]", () => {
  for (const label of ["Owner", "a_b", "a.b", "", "x".repeat(21)]) {
    assert.throws(() => throwawayEmail(PREFIX, label), NotThrowawayError, label);
  }
  assert.throws(() => throwawayEmail("not-a-run-prefix", "owner"), NotThrowawayError);
});

test("throwawayPassword is 32+ chars and differs per call", () => {
  const a = throwawayPassword();
  const b = throwawayPassword();
  assert.ok(a.length >= 32, `length ${a.length}`);
  assert.notEqual(a, b);
  assert.match(a, /[A-Z]/);
  assert.match(a, /[a-z]/);
  assert.match(a, /[0-9]/);
  assert.match(a, /[^A-Za-z0-9]/);
});
