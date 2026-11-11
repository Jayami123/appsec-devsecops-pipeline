import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareToBaseline,
  loadBaseline,
  parseFuzzFailures,
  type FuzzFailure,
} from "../../../../src/lanes/med/fuzz-baseline.ts";

const KNOWN: FuzzFailure = {
  operation: "GET /store/regions",
  check: "not_a_server_error",
  status: 500,
};
const NEW_OP: FuzzFailure = {
  operation: "GET /store/currencies",
  check: "not_a_server_error",
  status: 500,
};
const OTHER_STATUS: FuzzFailure = {
  operation: "GET /store/regions",
  check: "not_a_server_error",
  status: 502,
};

test("comparison: an observed failure that is in the baseline is expected (positive control)", () => {
  const result = compareToBaseline([KNOWN], [KNOWN]);
  assert.deepEqual(result.unexpected, []);
  assert.deepEqual(result.stale, []);
});

test("comparison: an observed failure not in the baseline is unexpected, by operation and by status (negative)", () => {
  assert.deepEqual(compareToBaseline([NEW_OP], [KNOWN]).unexpected, [NEW_OP]);
  assert.deepEqual(compareToBaseline([OTHER_STATUS], [KNOWN]).unexpected, [OTHER_STATUS]);
  assert.deepEqual(compareToBaseline([KNOWN, NEW_OP], [KNOWN]).unexpected, [NEW_OP]);
});

test("comparison: a baseline entry not seen in this run is stale and is not unexpected", () => {
  const result = compareToBaseline([], [KNOWN]);
  assert.deepEqual(result.stale, [KNOWN]);
  assert.deepEqual(result.unexpected, []);
});

test("comparison: a baseline entry seen in this run is not stale (positive control for stale)", () => {
  assert.deepEqual(compareToBaseline([KNOWN], [KNOWN]).stale, []);
});

function event(
  label: string,
  checks: Record<string, string>,
  codes: Record<string, number>,
): string {
  return JSON.stringify({
    ScenarioFinished: {
      recorder: {
        label,
        checks: Object.fromEntries(
          Object.entries(checks).map(([id, status]) => [
            id,
            [{ name: "not_a_server_error", status }],
          ]),
        ),
        interactions: Object.fromEntries(
          Object.entries(codes).map(([id, code]) => [id, { response: { status_code: code } }]),
        ),
      },
    },
  });
}

test("parser: returns only failing checks, with the operation label and the response status", () => {
  const ndjson = [
    event("GET /store/regions", { a: "success", b: "failure" }, { a: 200, b: 500 }),
    event("GET /store/currencies", { c: "success" }, { c: 200 }),
    event("GET /store/regions", { d: "failure" }, { d: 500 }),
  ].join("\n");
  assert.deepEqual(parseFuzzFailures(ndjson), [KNOWN]);
});

test("loader: refuses a file with an unknown schema or a non-integer seed", () => {
  const good = {
    schema: "p5-med-fuzz-baseline/1",
    recordedRun: "p5-qa-20261111t050000z-abcdef01",
    recordedDate: "2026-11-11",
    seed: 20261111,
    maxExamples: 200,
    maxTimeSeconds: 600,
    entries: [KNOWN],
  };
  assert.equal(loadBaseline(good).entries.length, 1);
  assert.throws(() => loadBaseline({ ...good, schema: "other/1" }), /unknown schema/);
  assert.throws(() => loadBaseline({ ...good, seed: 1.5 }), /seed not an integer/);
});
