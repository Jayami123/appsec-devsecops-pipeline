import { test } from "node:test";
import assert from "node:assert/strict";
import type { GqlResponse } from "../../../../src/lanes/tw-iso/gql-client.ts";
import { classifyReply, describe, errorMessages } from "../../../../src/lanes/tw-iso/verdict.ts";

const REFUSAL = /too many fields requested/i;

// Only status and body matter to the classifier; the cast keeps the helper independent of the header field.
const reply = (status: number, body: unknown): GqlResponse => ({ status, body }) as GqlResponse;
const answered = (): GqlResponse => reply(200, { data: { x: 1 } });

test("classifyReply is PASS when an error matches the refusal, whatever the status", () => {
  const body = {
    errors: [
      {
        message:
          "Query too complex - Too many fields requested: 2001 - Maximum allowed fields: 2000",
      },
    ],
  };
  assert.equal(classifyReply(reply(200, body), REFUSAL).verdict, "PASS");
  assert.equal(classifyReply(reply(400, body), REFUSAL).verdict, "PASS");
});

test("classifyReply is a design verdict for an answered request with no errors", () => {
  assert.equal(classifyReply(answered(), REFUSAL).verdict, "design verdict");
});

test("classifyReply is a deployment finding for an error that is not the refusal (fail closed)", () => {
  const body = { errors: [{ message: 'Cannot query field "nope" on type "Query".' }] };
  assert.equal(classifyReply(reply(200, body), REFUSAL).verdict, "deployment finding");
  assert.equal(classifyReply(reply(500, {}), REFUSAL).verdict, "deployment finding");
});

test("classifyReply keeps only the first message, truncated to 160 characters", () => {
  const outcome = classifyReply(reply(200, { errors: [{ message: "x".repeat(400) }] }), REFUSAL);
  assert.equal(outcome.message.length, 160);
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
