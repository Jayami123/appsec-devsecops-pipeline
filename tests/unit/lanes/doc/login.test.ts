import { test } from "node:test";
import assert from "node:assert/strict";
import { throwawayActor, NotThrowawayError } from "../../../../src/lanes/doc/login.ts";

const PREFIX = "p5-qa-20261110t093000z-1a2b3c4d";

test("throwawayActor refuses a run prefix that is not p5-qa-shaped", () => {
  assert.throws(() => throwawayActor("seed-user", "owner", "00aa11bb"), NotThrowawayError);
  assert.throws(
    () => throwawayActor("P5-QA-20261110T093000Z-1A2B3C4D", "owner", "00aa11bb"),
    NotThrowawayError,
  );
});

test("throwawayActor email carries the run prefix and the .test TLD", () => {
  const actor = throwawayActor(PREFIX, "owner", "00aa11bb");
  assert.equal(actor.email, `${PREFIX}-owner-00aa11bb@p5.test`);
  assert.ok(actor.email.endsWith(".test"));
});

test("throwawayActor never returns a seed address", () => {
  const actor = throwawayActor(PREFIX, "owner", "00aa11bb");
  assert.ok(actor.email.startsWith(`${PREFIX}-`), "address is not run-prefixed");
  assert.notEqual(actor.password, "");
  assert.ok(!actor.email.includes("seed"), "seed-shaped address");
});
