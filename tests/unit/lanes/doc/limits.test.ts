import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocRouteLimits } from "../../../../src/lanes/doc/limits.ts";

test("parseDocRouteLimits reads each named limit from the formula", () => {
  const parsed = parseDocRouteLimits("{ upload: 20, ai: 3 }");
  assert.equal(parsed.upload, 20);
  assert.equal(parsed.ai, 3);
  assert.throws(() => parseDocRouteLimits("{ upload: twenty }"), /unparseable/);
});
