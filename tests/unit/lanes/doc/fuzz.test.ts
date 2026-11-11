import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUDGETS } from "../../../../src/security/budgets.ts";
import {
  FUZZ_SEED,
  compareFuzzBaseline,
  fuzzFingerprint,
  parseFuzzBaseline,
  parseFuzzFindings,
  rateLimitArg,
  schemathesisArgs,
  schemathesisEnv,
} from "../../../../src/lanes/doc/fuzz.ts";

const RATE = rateLimitArg(BUDGETS.FUZZ_RATE_LIMIT.value, 1);
const MAX = String(BUDGETS.FUZZ_MAX_EXAMPLES.value);
const BASELINE_PATH = fileURLToPath(
  new URL("../../../../src/lanes/doc/fuzz-baseline.json", import.meta.url),
);

function args() {
  return schemathesisArgs({
    schemaPath: "src/lanes/doc/contracts/openapi.json",
    baseUrl: "http://127.0.0.1:3001/api/v2",
    maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
    rateLimit: RATE,
    seed: FUZZ_SEED,
  });
}

test("schemathesis args carry --rate-limit <FUZZ_RATE_LIMIT>/<window>, --max-examples from FUZZ_MAX_EXAMPLES, and --seed from FUZZ_SEED", () => {
  const built = args();
  assert.equal(built[built.indexOf("--rate-limit") + 1], `${BUDGETS.FUZZ_RATE_LIMIT.value}/m`);
  assert.equal(built[built.indexOf("--max-examples") + 1], MAX);
  assert.equal(built[built.indexOf("--seed") + 1], String(FUZZ_SEED));
});

test("schemathesis args never contain a credential value", () => {
  const built = schemathesisArgs({
    schemaPath: "src/lanes/doc/contracts/openapi.json",
    baseUrl: "http://127.0.0.1:3001/api/v2",
    maxExamples: 1,
    rateLimit: RATE,
    seed: FUZZ_SEED,
    excludePaths: ["/embedding/verify-presign-token"],
  });
  for (const arg of built) {
    assert.doesNotMatch(arg, /api_|Bearer|Authorization/i, "credential-shaped argument");
  }
});

test("the session cookie reaches Schemathesis through the environment, never through argv", () => {
  const cookie = "sessionId=p5-test-value";
  const built = args();
  const env = schemathesisEnv({ cookie, hooksDir: "/abs/hooks", base: {} });
  assert.equal(env.P5_DOC_FUZZ_COOKIE, cookie);
  assert.equal(env.SCHEMATHESIS_HOOKS, "doc_schemathesis_hooks");
  assert.equal(env.PYTHONDONTWRITEBYTECODE, "1");
  assert.ok(!built.some((arg) => arg.includes(cookie)), "cookie in argv");
});

test("parseFuzzFindings reads ST101 operation paths and drops duplicates", () => {
  const plain = [
    "Operations: 89 selected / 89 total",
    '- ST101 Server error | [500] Internal Server Error: |     `{"message":"Internal server error","code":"INTERNAL_SERVER_ERROR","data":{"code":"INTERNAL_SERVER_ERROR","httpStatus":500,"path":"embeddingPresign.createEmbeddingPresignToken"}}`',
    '- ST101 Server error | [500] Internal Server Error: |     `{"message":"Internal server error","code":"INTERNAL_SERVER_ERROR","data":{"code":"INTERNAL_SERVER_ERROR","httpStatus":500,"path":"embeddingPresign.createEmbeddingPresignToken"}}`',
    "❌ ST101 Server error: 1",
  ].join("\n");
  assert.deepEqual(parseFuzzFindings(plain), [
    { operation: "embeddingPresign.createEmbeddingPresignToken", errorType: "ST101" },
  ]);
});

test("parseFuzzFindings reads the CI run 42979416596 summary shape", () => {
  const ci =
    'Operations:       89 selected / 89 total |      Examples |      ⏭   Examples (in 0.11s) | - ST101 Server error | [500] Internal Server Error: |     `{"message":"Internal server error","code":"INTERNAL_SERVER_ERROR","data":{"code":"INTERNAL_SERVER_ERROR","httpStatus":500,"path":"embeddingPresign.createEmbeddingPresignToken"}}` | ❌ ST101 Server error: 1';
  assert.deepEqual(parseFuzzFindings(ci), [
    { operation: "embeddingPresign.createEmbeddingPresignToken", errorType: "ST101" },
  ]);
});

test("parseFuzzFindings returns nothing when ST101 has no operation path", () => {
  assert.deepEqual(parseFuzzFindings("ST101 Server error: 1"), []);
});

test("compareFuzzBaseline reports novel and stale fingerprints", () => {
  const baseline = [
    { operation: "embeddingPresign.createEmbeddingPresignToken", errorType: "ST101" },
  ];
  const same = compareFuzzBaseline(baseline, baseline);
  assert.deepEqual(same.novel, []);
  assert.deepEqual(same.stale, []);
  const novel = compareFuzzBaseline(
    [...baseline, { operation: "envelope.create", errorType: "ST101" }],
    baseline,
  );
  assert.deepEqual(novel.novel, [{ operation: "envelope.create", errorType: "ST101" }]);
  const stale = compareFuzzBaseline([], baseline);
  assert.deepEqual(stale.stale, baseline);
  const first = baseline[0];
  assert.ok(first);
  assert.equal(fuzzFingerprint(first), "embeddingPresign.createEmbeddingPresignToken|ST101");
});

test("the committed PN-3 baseline parses and matches FUZZ_SEED", () => {
  const baseline = parseFuzzBaseline(readFileSync(BASELINE_PATH, "utf8"));
  assert.equal(baseline.schema, 1);
  assert.equal(baseline.seed, FUZZ_SEED);
  assert.deepEqual(baseline.entries, [
    { operation: "embeddingPresign.createEmbeddingPresignToken", errorType: "ST101" },
  ]);
});

test("parseFuzzBaseline rejects a document without entries", () => {
  assert.throws(() => parseFuzzBaseline('{"schema":1,"seed":1}'), /entries/);
});
