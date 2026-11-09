import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateOsv, repoRelative } from "../../../scripts/scan/osv-threshold.ts";
import { fixturePath, REPO, scratch } from "./fixtures/index.ts";

const NONE: ReadonlySet<string> = new Set();
const HIGH_FP = "GHSA-test-high-0001|minimatch|10.2.6|package-lock.json";

// A synthetic OSV report for one HIGH advisory with a fix, reported at a given source path.
function highReport(sourcePath: string): string {
  const dir = scratch("osv-owned");
  const file = join(dir, "osv.json");
  const doc = {
    results: [
      {
        source: { path: sourcePath, type: "lockfile" },
        packages: [
          {
            package: { name: "minimatch", version: "10.2.6", ecosystem: "npm" },
            vulnerabilities: [
              {
                id: "GHSA-test-high-0001",
                database_specific: { severity: "HIGH" },
                affected: [
                  {
                    package: { name: "minimatch" },
                    ranges: [
                      { type: "SEMVER", events: [{ introduced: "7.0.0" }, { fixed: "11.0.1" }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  writeFileSync(file, JSON.stringify(doc));
  return file;
}

test("an OSV MODERATE entry does not block", () => {
  assert.equal(evaluateOsv(fixturePath("osv-moderate.json"), 1, NONE, REPO).verdict, "pass");
});

test("OSV exit 127 is fail", () => {
  assert.equal(evaluateOsv(fixturePath("osv-moderate.json"), 127, NONE, REPO).verdict, "fail");
});

test("OSV exit 128 is fail", () => {
  assert.equal(evaluateOsv(fixturePath("osv-moderate.json"), 128, NONE, REPO).verdict, "fail");
});

test("fix-available follows the affected ranges fixed event", () => {
  assert.equal(evaluateOsv(fixturePath("osv-high-nofix.json"), 1, NONE, REPO).verdict, "pass");
  assert.equal(evaluateOsv(fixturePath("osv-high-fixed.json"), 1, NONE, REPO).verdict, "fail");
});

test("a NEW HIGH with a fix in the root lockfile blocks (synthetic)", () => {
  assert.equal(evaluateOsv(fixturePath("osv-high-fixed.json"), 1, NONE, REPO).verdict, "fail");
  assert.equal(
    evaluateOsv(fixturePath("osv-high-fixed.json"), 1, new Set([HIGH_FP]), REPO).verdict,
    "pass",
  );
});

test("owned path: the absolute local path is the root lockfile", () => {
  const file = highReport(join(REPO, "package-lock.json"));
  assert.equal(evaluateOsv(file, 1, NONE, REPO).verdict, "fail");
  assert.equal(repoRelative(join(REPO, "package-lock.json"), REPO), "package-lock.json");
});

test("owned path: the absolute CI path is the root lockfile", () => {
  const file = highReport("/home/runner/work/x/x/package-lock.json");
  assert.equal(evaluateOsv(file, 1, NONE, "/home/runner/work/x/x").verdict, "fail");
});

test("owned path: a nested apps/a/package-lock.json is not owned", () => {
  const file = highReport("apps/a/package-lock.json");
  assert.equal(evaluateOsv(file, 1, NONE, REPO).verdict, "pass");
  const absolute = highReport(join(REPO, "apps/a/package-lock.json"));
  assert.equal(evaluateOsv(absolute, 1, NONE, REPO).verdict, "pass");
});

test("owned path: a path outside the repo is not owned", () => {
  const file = highReport("../other/package-lock.json");
  assert.equal(evaluateOsv(file, 1, NONE, REPO).verdict, "pass");
});
