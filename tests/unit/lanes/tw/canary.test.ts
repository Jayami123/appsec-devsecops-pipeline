import { test } from "node:test";
import assert from "node:assert/strict";
import { canaryUrl, newCanaryNonce } from "../../../../src/lanes/tw/canary.ts";

test("newCanaryNonce is 32 hex chars and unique per call", () => {
  const a = newCanaryNonce();
  const b = newCanaryNonce();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.match(b, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("canaryUrl uses host.docker.internal and the nonce path", () => {
  assert.equal(
    canaryUrl(8080, "p5-qa-20261110t090000z-1a2b3c4d", "abc123"),
    "http://host.docker.internal:8080/r/p5-qa-20261110t090000z-1a2b3c4d/abc123",
  );
});
