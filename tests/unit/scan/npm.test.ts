import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateNpmAudit, scanNpmAudit } from "../../../scripts/scan/npm-threshold.ts";
import { fixturePath, scratch } from "./fixtures/index.ts";

const NONE: ReadonlySet<string> = new Set();

// A synthetic npm audit report: one advisory, reached from `count` packages through via strings.
function auditFile(options: {
  severity: string;
  fixAvailable: unknown;
  advisoryHolder?: string;
  count?: number;
}): string {
  const count = options.count ?? 1;
  const holder = options.advisoryHolder ?? "pkg-0";
  const vulnerabilities: Record<string, unknown> = {};
  for (let i = 0; i < count; i += 1) {
    const name = `pkg-${i}`;
    const via =
      name === holder
        ? [
            {
              source: 900001,
              name: "synthetic advisory",
              severity: options.severity,
              range: "<2.0.0",
            },
          ]
        : [`pkg-${holder.split("-")[1]}`];
    vulnerabilities[name] = {
      name,
      severity: options.severity,
      isDirect: false,
      via,
      effects: [],
      range: "<2.0.0",
      nodes: [],
      fixAvailable: options.fixAvailable,
    };
  }
  const file = join(scratch("npm"), "audit.json");
  writeFileSync(file, JSON.stringify({ auditReportVersion: 2, vulnerabilities, metadata: {} }));
  return file;
}

test("an npm moderate advisory does not block", () => {
  assert.equal(evaluateNpmAudit(fixturePath("npm-moderate.json"), NONE).verdict, "pass");
});

test("an npm HIGH with fixAvailable blocks (synthetic)", () => {
  assert.equal(
    evaluateNpmAudit(auditFile({ severity: "high", fixAvailable: true }), NONE).verdict,
    "fail",
  );
});

test("an npm semver-major fix is reported and still counts as fix available", () => {
  const file = auditFile({
    severity: "high",
    fixAvailable: { name: "x", version: "2.0.0", isSemVerMajor: true },
  });
  assert.equal(evaluateNpmAudit(file, NONE).verdict, "fail");
});

test("npm fingerprints key on the advisory, not the package", () => {
  const file = auditFile({ severity: "moderate", fixAvailable: true, count: 10 });
  const scan = scanNpmAudit(file, NONE);
  assert.equal(scan.current.size, 1, "ten packages reach one advisory");
});

test("a via string is followed to its advisory object", () => {
  // pkg-1 has only a via string to pkg-0; pkg-0 holds the advisory object. Both fingerprint to one advisory.
  const file = auditFile({
    severity: "high",
    fixAvailable: true,
    count: 2,
    advisoryHolder: "pkg-0",
  });
  const scan = scanNpmAudit(file, NONE);
  assert.equal(scan.outcome.verdict, "fail");
  assert.deepEqual([...scan.current], ["900001|<2.0.0"]);
});
