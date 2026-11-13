import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { requireAlerts, ZapInputError } from "../../../scripts/scan/zap-threshold.ts";
import { REPO, scratch } from "./fixtures/index.ts";

// The positive control of the nightly lane: a local page with known header gaps, scanned on the runner. The
// fixture is the real output of the pinned image (127.0.0.1:8765), so the four IDs are observed, not invented.
const FIXTURE = join(REPO, "tests/unit/scan/fixtures/zap/local-positive-control.json");
const fixtureText = readFileSync(FIXTURE, "utf8");
const CONTROL_IDS = ["10038", "10020", "10036", "10021"];
const THRESHOLD = join(REPO, "scripts/scan/zap-threshold.ts");

test("the control passes when every required alert ID is reported for the target", () => {
  assert.deepEqual(requireAlerts(fixtureText, "127.0.0.1", "8765", CONTROL_IDS), []);
});

test("the control names each required alert ID the scanner did not report", () => {
  assert.deepEqual(requireAlerts(fixtureText, "127.0.0.1", "8765", [...CONTROL_IDS, "10202"]), [
    "10202",
  ]);
});

test("the control reports nothing for a different target host or port", () => {
  assert.deepEqual(requireAlerts(fixtureText, "127.0.0.1", "3000", CONTROL_IDS), CONTROL_IDS);
});

test("the control fails closed on unusable input", () => {
  assert.throws(() => requireAlerts("{", "127.0.0.1", "8765", CONTROL_IDS), ZapInputError);
});

test("the control CLI exits 0 on a pass and 1 when an ID is missing", () => {
  const dir = scratch("zap-control");
  const file = join(dir, "zap.json");
  writeFileSync(file, fixtureText);
  const pass = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      THRESHOLD,
      "control",
      file,
      "127.0.0.1",
      "8765",
      CONTROL_IDS.join(","),
    ],
    { encoding: "utf8" },
  );
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, /^control=pass$/m);
  const fail = spawnSync(
    process.execPath,
    ["--experimental-strip-types", THRESHOLD, "control", file, "127.0.0.1", "8765", "10202"],
    { encoding: "utf8" },
  );
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /^control=fail$/m);
  assert.match(fail.stderr, /not reported: 10202/);
});

test("the control CLI exits 1 when the report is missing", () => {
  const dir = scratch("zap-control-missing");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      THRESHOLD,
      "control",
      join(dir, "zap.json"),
      "127.0.0.1",
      "8765",
      CONTROL_IDS.join(","),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /control=pass/);
});
