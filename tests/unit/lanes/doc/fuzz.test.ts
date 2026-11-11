import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import { rateLimitArg, schemathesisArgs, schemathesisEnv } from "../../../../src/lanes/doc/fuzz.ts";

const RATE = rateLimitArg(BUDGETS.FUZZ_RATE_LIMIT.value, 1);
const MAX = String(BUDGETS.FUZZ_MAX_EXAMPLES.value);

test("schemathesis args carry --rate-limit <FUZZ_RATE_LIMIT>/<window> and --max-examples from FUZZ_MAX_EXAMPLES", () => {
  const args = schemathesisArgs({
    schemaPath: "src/lanes/doc/contracts/openapi.json",
    baseUrl: "http://127.0.0.1:3001/api/v2",
    maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
    rateLimit: RATE,
  });
  assert.equal(args[args.indexOf("--rate-limit") + 1], `${BUDGETS.FUZZ_RATE_LIMIT.value}/m`);
  assert.equal(args[args.indexOf("--max-examples") + 1], MAX);
});

test("schemathesis args never contain a credential value", () => {
  const args = schemathesisArgs({
    schemaPath: "src/lanes/doc/contracts/openapi.json",
    baseUrl: "http://127.0.0.1:3001/api/v2",
    maxExamples: 1,
    rateLimit: RATE,
    excludePaths: ["/embedding/verify-presign-token"],
  });
  for (const arg of args) {
    assert.doesNotMatch(arg, /api_|Bearer|Authorization/i, "credential-shaped argument");
  }
});

test("the session cookie reaches Schemathesis through the environment, never through argv", () => {
  const cookie = "sessionId=p5-test-value";
  const args = schemathesisArgs({
    schemaPath: "src/lanes/doc/contracts/openapi.json",
    baseUrl: "http://127.0.0.1:3001/api/v2",
    maxExamples: 1,
    rateLimit: RATE,
  });
  const env = schemathesisEnv({ cookie, hooksDir: "/abs/hooks", base: {} });
  assert.equal(env.P5_DOC_FUZZ_COOKIE, cookie);
  assert.equal(env.SCHEMATHESIS_HOOKS, "doc_schemathesis_hooks");
  assert.equal(env.PYTHONDONTWRITEBYTECODE, "1");
  assert.ok(!args.some((arg) => arg.includes(cookie)), "cookie in argv");
});
