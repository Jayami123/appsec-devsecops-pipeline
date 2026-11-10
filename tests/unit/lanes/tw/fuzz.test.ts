import { test } from "node:test";
import assert from "node:assert/strict";
import { schemathesisArgs, schemathesisEnv } from "../../../../src/lanes/tw/fuzz.ts";
import { BUDGETS } from "../../../../src/security/budgets.ts";

test("schemathesis args carry max-examples from FUZZ_MAX_EXAMPLES", () => {
  const args = schemathesisArgs({ schemaFile: "/tmp/core.json", baseUrl: "http://127.0.0.1:3002" });
  const at = args.indexOf("--max-examples");
  assert.notEqual(at, -1);
  assert.equal(args[at + 1], String(BUDGETS.FUZZ_MAX_EXAMPLES.value));
});

test("schemathesis args never contain a credential value", () => {
  const bearer = "p5-test-bearer-value-not-a-secret";
  const args = schemathesisArgs({ schemaFile: "/tmp/core.json", baseUrl: "http://127.0.0.1:3002" });
  assert.ok(!args.some((arg) => arg.includes(bearer) || /bearer/i.test(arg)));
  const env = schemathesisEnv({ bearer, hooksDir: "/x", base: {} });
  assert.equal(env.P5_TW_FUZZ_BEARER, bearer, "the bearer travels in the environment");
});
