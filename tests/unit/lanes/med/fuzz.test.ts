import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import { schemathesisArgs } from "../../../../src/lanes/med/fuzz.ts";

const SAMPLE_KEY = "pk_sample_not_a_real_key_0123456789";

test("schemathesis args carry max-examples from FUZZ_MAX_EXAMPLES and the not_a_server_error check", () => {
  const maxExamples = BUDGETS.FUZZ_MAX_EXAMPLES.value;
  assert.equal(typeof maxExamples, "number");
  const args = schemathesisArgs({
    schemaPath: "src/lanes/med/contracts/store.openapi.full.yaml",
    baseUrl: "http://127.0.0.1:9000/store",
    maxExamples,
    maxTimeSeconds: BUDGETS.FUZZ_WALL_MIN.value * 60,
    readOnly: true,
    seed: 20261111,
    reportJsonPath: "/run/report.json",
    reportNdjsonPath: "/run/events.ndjson",
  });
  const at = args.indexOf("--max-examples");
  assert.equal(args[at + 1], String(maxExamples));
  const checks = args.indexOf("--checks");
  assert.equal(args[checks + 1], "not_a_server_error");
  const method = args.indexOf("--include-method");
  assert.equal(args[method + 1], "GET");
  // B30: a fixed seed, and both structured reports written for the baseline comparison.
  assert.equal(args[args.indexOf("--seed") + 1], "20261111");
  assert.equal(args[args.indexOf("--report-json-path") + 1], "/run/report.json");
  assert.equal(args[args.indexOf("--report-ndjson-path") + 1], "/run/events.ndjson");
});

test("schemathesis args never contain a credential value", () => {
  const args = schemathesisArgs({
    schemaPath: "src/lanes/med/contracts/store.openapi.full.yaml",
    baseUrl: "http://127.0.0.1:9000/store",
    maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
    maxTimeSeconds: 60,
    readOnly: true,
    seed: 1,
    reportJsonPath: "/run/report.json",
    reportNdjsonPath: "/run/events.ndjson",
  });
  for (const arg of args) {
    assert.equal(arg.includes(SAMPLE_KEY), false);
    assert.equal(/pk_|bearer|authorization/i.test(arg), false, "no credential-shaped argument");
  }
});
