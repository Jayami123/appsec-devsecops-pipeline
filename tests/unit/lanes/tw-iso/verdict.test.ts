import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyReply, describe, errorMessages } from "../../../../src/lanes/tw-iso/verdict.ts";

const REFUSAL = /too many fields requested/i;
const ok = (body: unknown = { data: { x: 1 } }, status = 200) => ({ status, body, headers: {} });

test("classifyReply is PASS when an error matches the refusal, whatever the status", () => {
  const body = {
    errors: [
      {
        message:
          "Query too complex - Too many fields requested: 2001 - Maximum allowed fields: 2000",
      },
    ],
  };
  assert.equal(classifyReply({ status: 200, body, headers: {} }, REFUSAL).verdict, "PASS");
  assert.equal(classifyReply({ status: 400, body, headers: {} }, REFUSAL).verdict, "PASS");
});

test("classifyReply is a design verdict for an answered request with no errors", () => {
  assert.equal(classifyReply(ok(), REFUSAL).verdict, "design verdict");
});

test("classifyReply is a deployment finding for an error that is not the refusal (fail closed)", () => {
  const body = { errors: [{ message: 'Cannot query field "nope" on type "Query".' }] };
  assert.equal(
    classifyReply({ status: 200, body, headers: {} }, REFUSAL).verdict,
    "deployment finding",
  );
  assert.equal(
    classifyReply({ status: 500, body: {}, headers: {} }, REFUSAL).verdict,
    "deployment finding",
  );
});

test("classifyReply keeps only the first message, truncated, and never a header value", () => {
  const long = "x".repeat(400);
  const outcome = classifyReply(
    {
      status: 200,
      body: { errors: [{ message: long }] },
      headers: { authorization: "Bearer secret" },
    },
    REFUSAL,
  );
  assert.equal(outcome.message.length, 160);
  assert.ok(!JSON.stringify(outcome).includes("Bearer"));
});

test("errorMessages reads errors[].message and ignores other shapes", () => {
  assert.deepEqual(errorMessages({ errors: [{ message: "a" }, { code: "x" }, { message: 3 }] }), [
    "a",
  ]);
  assert.deepEqual(errorMessages({}), []);
  assert.deepEqual(errorMessages("text"), []);
});

test("describe names the verdict, the status and the message when there is one", () => {
  assert.equal(
    describe({ verdict: "design verdict", status: 200, message: "" }),
    "design verdict (status 200)",
  );
  assert.equal(describe({ verdict: "PASS", status: 200, message: "m" }), "PASS (status 200: m)");
});
