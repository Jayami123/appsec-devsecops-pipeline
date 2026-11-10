import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareForwardedEffective,
  parseRateLimitHeaders,
} from "../../../../src/lanes/tw-iso/effective-config.ts";

test("parseRateLimitHeaders reads limit, remaining and reset by name", () => {
  const parsed = parseRateLimitHeaders({
    "x-ratelimit-limit": "100",
    "x-ratelimit-remaining": "99",
    "x-ratelimit-reset": "60",
    "content-type": "application/json",
  });
  assert.deepEqual(parsed, { limit: 100, remaining: 99, reset: 60 });
  assert.deepEqual(parseRateLimitHeaders({}), { limit: null, remaining: null, reset: null });
});

test("a forwarded value that differs from the effective value is reported as ENV", () => {
  assert.equal(compareForwardedEffective("100", "100"), "match");
  assert.equal(compareForwardedEffective("100", "200"), "ENV mismatch");
});
