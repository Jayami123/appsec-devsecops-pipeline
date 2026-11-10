import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import { rateLimitArg, schemathesisArgs } from "../../../../src/lanes/doc/fuzz.ts";

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
