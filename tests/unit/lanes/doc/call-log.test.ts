import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRequestError } from "../../../../src/lanes/doc/call-log.ts";

const CALL_LOG_ERROR = [
  "apiRequestContext.post: connect ECONNREFUSED 127.0.0.1:3001",
  "Call log:",
  "  - → POST http://127.0.0.1:3001/api/auth/two-factor/setup",
  "    - cookie: sessionId=p5-session-value-123",
  "    - authorization: Bearer api_abcdefghijklmnop",
].join("\n");

test("sanitizeRequestError removes the call log and masks the session cookie", () => {
  const out = sanitizeRequestError(CALL_LOG_ERROR);
  assert.ok(!out.includes("Call log"), "call log kept");
  assert.ok(!out.includes("p5-session-value-123"), "session value kept");
  assert.ok(!out.includes("api_abcdefghijklmnop"), "token kept");
  assert.ok(out.includes("ECONNREFUSED"), "the failure itself is kept");
});

test("sanitizeRequestError leaves an ordinary message unchanged", () => {
  assert.equal(
    sanitizeRequestError("envelope create returned 500"),
    "envelope create returned 500",
  );
});
