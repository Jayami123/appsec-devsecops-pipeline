import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { type AcceptedRisk } from "../../../src/security/accepted-risk.ts";
import { evaluateCodeql, scanCodeql } from "../../../scripts/scan/codeql-threshold.ts";
import { staleFingerprints, type Baseline } from "../../../scripts/scan/threshold-core.ts";
import { scratch } from "./fixtures/index.ts";

const TODAY = "2026-11-10";

// A synthetic SARIF with one rule and one result. The rule carries the security-severity; no level is set.
function sarif(
  options: {
    severity?: string;
    uri?: string;
    success?: boolean;
    line?: string;
    level?: string;
  } = {},
): string {
  const dir = scratch("codeql");
  const file = join(dir, "codeql.sarif");
  const result: Record<string, unknown> = {
    ruleId: "js/test-rule",
    ruleIndex: 0,
    locations: [{ physicalLocation: { artifactLocation: { uri: options.uri ?? "src/x.ts" } } }],
    partialFingerprints: { primaryLocationLineHash: options.line ?? "abc123" },
  };
  if (options.level !== undefined) result["level"] = options.level;
  const doc = {
    runs: [
      {
        invocations: [{ executionSuccessful: options.success ?? true }],
        tool: {
          driver: {
            rules: [
              {
                id: "js/test-rule",
                properties: { "security-severity": options.severity ?? "7.8" },
              },
            ],
          },
        },
        results: [result],
      },
    ],
  };
  writeFileSync(file, JSON.stringify(doc));
  return file;
}

const FP = "js/test-rule|src/x.ts|abc123";

test("security-severity 7.8 maps to High", () => {
  assert.equal(evaluateCodeql(sarif({ severity: "7.8" }), new Set()).verdict, "fail");
  assert.equal(evaluateCodeql(sarif({ severity: "6.9" }), new Set()).verdict, "pass");
});

test("a result without level uses the rule severity", () => {
  // No level on the result (probe 2b): the rule's security-severity decides.
  assert.equal(evaluateCodeql(sarif({ severity: "7.8" }), new Set()).verdict, "fail");
});

test("a NEW High in src blocks", () => {
  assert.equal(
    evaluateCodeql(sarif({ severity: "7.8", uri: "src/x.ts" }), new Set()).verdict,
    "fail",
  );
});

test("a baseline entry suppresses a NEW High in src", () => {
  assert.equal(evaluateCodeql(sarif({ severity: "7.8" }), new Set([FP])).verdict, "pass");
});

test("a stale baseline entry fails", () => {
  const sarifPath = sarif({ severity: "5.0" });
  const scan = scanCodeql(sarifPath, new Set(), [], TODAY);
  const baseline: Baseline = {
    schema: 1,
    tool: "codeql",
    entries: [
      {
        fingerprint: "js/gone|src/none.ts|zzz",
        ruleId: "js/gone",
        path: "src/none.ts",
        justification: "synthetic stale entry",
        owner: "the owner",
        reviewRef: "review-test",
        addedOn: "2026-11-10",
        expires: "2027-01-08",
      },
    ],
  };
  assert.deepEqual(staleFingerprints(baseline, scan.current), ["js/gone|src/none.ts|zzz"]);
});

test("a SARIF without a successful invocation fails closed", () => {
  assert.equal(evaluateCodeql(sarif({ success: false }), new Set()).verdict, "fail");
});

test("an unexpired accepted risk suppresses a NEW High (synthetic)", () => {
  const accepted: AcceptedRisk[] = [
    {
      id: "AR-TEST-1",
      acceptedOn: "2026-11-10",
      expires: "2027-01-08",
      match: { tool: "codeql", fingerprint: FP },
    },
  ];
  assert.equal(
    evaluateCodeql(sarif({ severity: "7.8" }), new Set(), accepted, TODAY).verdict,
    "pass",
  );
});

test("a High outside the owned prefixes does not block", () => {
  assert.equal(
    evaluateCodeql(sarif({ severity: "9.1", uri: "vendor/x.ts" }), new Set()).verdict,
    "pass",
  );
});
