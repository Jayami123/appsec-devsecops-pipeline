import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateTrivy } from "../../../scripts/scan/trivy-threshold.ts";
import { fixturePath, REPO } from "./fixtures/index.ts";

const NONE: ReadonlySet<string> = new Set();

test("a HIGH with FixedVersion in the root lockfile blocks (synthetic)", () => {
  assert.equal(evaluateTrivy(fixturePath("trivy-high-fixed.json"), "root", NONE).verdict, "fail");
});

test("a HIGH without FixedVersion does not block", () => {
  assert.equal(evaluateTrivy(fixturePath("trivy-high-nofix.json"), "root", NONE).verdict, "pass");
});

test("a MEDIUM does not block", () => {
  assert.equal(evaluateTrivy(fixturePath("trivy-medium.json"), "root", NONE).verdict, "pass");
});

test("an image target is report-only but a tool error fails", () => {
  // A HIGH with a fix in an image target is reported but never blocks.
  assert.equal(evaluateTrivy(fixturePath("trivy-image-high.json"), "report", NONE).verdict, "pass");
  // A missing report (a tool error) fails closed.
  assert.equal(evaluateTrivy(fixturePath("trivy-missing.json"), "report", NONE).verdict, "fail");
});

test("the root job passes --include-dev-deps", () => {
  const text = readFileSync(join(REPO, ".github/workflows/p5-scans.yml"), "utf8");
  const start = text.indexOf("  trivy:");
  const end = text.indexOf("\n  trivy-upload:", start);
  const block = text.slice(start, end);
  assert.match(block, /trivy" fs --include-dev-deps /);
});
