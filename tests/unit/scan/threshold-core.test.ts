import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateGitleaks } from "../../../scripts/scan/gitleaks-threshold.ts";
import { failClosed, isExpired, normalizeSeverity } from "../../../scripts/scan/threshold-core.ts";
import { scratch } from "./fixtures/index.ts";

test("normalizeSeverity maps MODERATE to MEDIUM", () => {
  assert.equal(normalizeSeverity("MODERATE"), "MEDIUM");
});

test("an unknown severity is UNKNOWN and not pass", () => {
  assert.equal(normalizeSeverity("banana"), "UNKNOWN");
});

test("a missing output file is fail", () => {
  assert.equal(evaluateGitleaks(join(scratch("missing"), "absent.json"), 0).verdict, "fail");
  assert.equal(failClosed("missing output").verdict, "fail");
});

test("an unparseable output file is fail", () => {
  const file = join(scratch("junk"), "report.json");
  writeFileSync(file, "{not json");
  assert.equal(evaluateGitleaks(file, 0).verdict, "fail");
});

test("an expired baseline entry counts as NEW", () => {
  assert.equal(isExpired("2026-01-01T00:00:00Z", "2026-11-10T00:00:00Z"), true);
  assert.equal(isExpired("2027-01-01T00:00:00Z", "2026-11-10T00:00:00Z"), false);
});
