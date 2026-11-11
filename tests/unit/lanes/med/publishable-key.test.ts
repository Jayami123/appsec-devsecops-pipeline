import { test } from "node:test";
import assert from "node:assert/strict";
import { runKeyTitle } from "../../../../src/lanes/med/publishable-key.ts";

test("run key title is the run prefix", () => {
  const prefix = "p5-qa-20261110t090000z-1a2b3c4d";
  assert.equal(runKeyTitle(prefix), prefix);
});
