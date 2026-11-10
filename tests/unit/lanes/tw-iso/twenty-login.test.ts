import { test } from "node:test";
import assert from "node:assert/strict";
import { createThrowawayActor, throwawayEmail } from "../../../../src/lanes/tw-iso/twenty-login.ts";

test("createThrowawayActor refuses a run prefix that does not match RUN_PREFIX_PATTERN", async () => {
  await assert.rejects(
    createThrowawayActor({
      runPrefix: "not-a-run-prefix",
      mintApiKey: true,
      baseUrl: "http://127.0.0.1:1",
    }),
    /TEST BUG: refusing a run prefix/,
  );
});

test("throwawayEmail carries the run prefix and the .test TLD", () => {
  const email = throwawayEmail("p5-qa-20261110t093000z-1a2b3c4d", 2);
  assert.equal(email, "p5-qa-20261110t093000z-1a2b3c4d-iso-2@example.test");
  assert.equal(
    throwawayEmail("p5-qa-20261110t093000z-1a2b3c4d", 2, "ab12cd34"),
    "p5-qa-20261110t093000z-1a2b3c4d-iso-2-ab12cd34@example.test",
  );
  assert.throws(() => throwawayEmail("bad", 0), /TEST BUG/);
});
