import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import { schemathesisArgs } from "../../../../src/lanes/cal/fuzz.ts";

test("schemathesis args carry max-examples from FUZZ_MAX_EXAMPLES", () => {
  const args = schemathesisArgs({
    schemaPath: "src/lanes/cal/contracts/openapi-v2.json",
    baseUrl: "http://127.0.0.1:5555",
    maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
  });
  const at = args.indexOf("--max-examples");
  assert.ok(at >= 0);
  assert.equal(args[at + 1], String(BUDGETS.FUZZ_MAX_EXAMPLES.value));
});

test("schemathesis args never contain a credential value", () => {
  const args = schemathesisArgs({
    schemaPath: "src/lanes/cal/contracts/openapi-v2.json",
    baseUrl: "http://127.0.0.1:5555",
    maxExamples: 1,
  });
  for (const arg of args) {
    assert.doesNotMatch(arg, /authorization|bearer|cal_|secret|apikey/i, arg);
  }
});
