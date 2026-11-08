import assert from "node:assert/strict";
import { test } from "node:test";
import { redactArtefact, redactTraceJson } from "../../../src/security/redact.ts";

test("redactArtefact redacts a Bearer token", () => {
  const out = redactArtefact("Authorization line Bearer abcDEF123.token-value_9");
  assert.ok(!out.includes("abcDEF123"));
  assert.match(out, /Bearer \[REDACTED\]/);
});

test("redactArtefact redacts an api_ key", () => {
  const out = redactArtefact("key=api_9f8e7d6c5b4a3210zz");
  assert.ok(!out.includes("9f8e7d6c5b4a3210zz"));
});

test("redactArtefact redacts a GitHub token", () => {
  const token = "ghp_" + "a".repeat(36);
  const out = redactArtefact(`using ${token} now`);
  assert.ok(!out.includes(token));
  assert.ok(out.includes("[REDACTED]"));
});

test("redactArtefact redacts a password= value", () => {
  const out = redactArtefact("connect?password=hunter2hunter2&user=x");
  assert.ok(!out.includes("hunter2hunter2"));
  assert.match(out, /password=\[REDACTED\]/);
});

test("redactArtefact leaves ordinary text unchanged", () => {
  const text = "GET /api/bookings returned 200 in 12 ms";
  assert.equal(redactArtefact(text), text);
});

test("redactTraceJson redacts authorization values", () => {
  const out = redactTraceJson({
    headers: { Authorization: "Bearer secret-value", accept: "json" },
  });
  assert.deepEqual(out, { headers: { Authorization: "[REDACTED]", accept: "json" } });
});

test("redactTraceJson does not mutate its input", () => {
  const input = { authorization: "Bearer keep-me", nested: [{ cookie: "session=1" }] };
  const snapshot = JSON.stringify(input);
  redactTraceJson(input);
  assert.equal(JSON.stringify(input), snapshot);
});
