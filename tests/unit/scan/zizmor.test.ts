import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateZizmor } from "../../../scripts/scan/zizmor-threshold.ts";
import { scratch } from "./fixtures/index.ts";

// A synthetic zizmor SARIF with one result per level given.
function sarif(levels: readonly string[]): string {
  const file = join(scratch("zizmor"), "zizmor.sarif");
  const results = levels.map((level, index) => ({
    ruleId: `zizmor/synthetic-${index}`,
    level,
    locations: [
      { physicalLocation: { artifactLocation: { uri: ".github/workflows/synthetic.yml" } } },
    ],
  }));
  writeFileSync(file, JSON.stringify({ version: "2.1.0", runs: [{ results }] }));
  return file;
}

test("a result at level error fails", () => {
  assert.equal(evaluateZizmor(sarif(["error"]), 0).verdict, "fail");
});

test("warnings alone pass", () => {
  assert.equal(evaluateZizmor(sarif(["warning", "warning", "note"]), 0).verdict, "pass");
});

test("exit 0 with an error-level result still fails", () => {
  assert.equal(evaluateZizmor(sarif(["warning", "error"]), 0).verdict, "fail");
});

test("exit 1 and exit 3 are fail", () => {
  assert.equal(evaluateZizmor(sarif([]), 1).verdict, "fail");
  assert.equal(evaluateZizmor(sarif([]), 3).verdict, "fail");
});
