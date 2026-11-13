import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseBaseline } from "../../../scripts/scan/threshold-core.ts";
import { REPO } from "./fixtures/index.ts";

const BASELINE_FILES: readonly [string, string][] = [
  ["config/scan/baseline/osv.json", "osv"],
  ["config/scan/baseline/npm-audit.json", "npm-audit"],
  ["config/scan/baseline/zap.json", "zap"],
];
const KEYS = [
  "fingerprint",
  "ruleId",
  "path",
  "justification",
  "owner",
  "reviewRef",
  "addedOn",
  "expires",
];

function entry(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    fingerprint: "GHSA-test|pkg|1.0.0|package-lock.json",
    ruleId: "GHSA-test",
    path: "package-lock.json",
    justification: "synthetic entry for a test",
    owner: "the owner",
    reviewRef: "review-test",
    addedOn: "2026-11-10",
    expires: "2027-01-08",
    ...overrides,
  };
}

test("every baseline entry has fingerprint, ruleId, path, justification, owner, reviewRef, addedOn and expires", () => {
  for (const [file, tool] of BASELINE_FILES) {
    const baseline = parseBaseline(readFileSync(join(REPO, file), "utf8"), tool);
    for (const e of baseline.entries) {
      for (const key of KEYS) assert.ok(key in e, `${file}: ${key}`);
    }
  }
  const synthetic = parseBaseline(
    JSON.stringify({ schema: 1, tool: "osv", entries: [entry()] }),
    "osv",
  );
  for (const key of KEYS) assert.ok(key in (synthetic.entries[0] ?? {}), key);
});

test("baseline expires is at most 90 days after addedOn", () => {
  const within = {
    schema: 1,
    tool: "osv",
    entries: [entry({ addedOn: "2026-11-10", expires: "2027-02-08" })],
  };
  assert.equal(
    parseBaseline(JSON.stringify(within), "osv").entries.length,
    1,
    "90 days is allowed",
  );
  const over = {
    schema: 1,
    tool: "osv",
    entries: [entry({ addedOn: "2026-11-10", expires: "2027-02-09" })],
  };
  assert.throws(() => parseBaseline(JSON.stringify(over), "osv"), /more than 90 days/);
});

test("a baseline file with an unknown key is rejected", () => {
  const withTopKey = { schema: 1, tool: "osv", entries: [], extra: true };
  assert.throws(() => parseBaseline(JSON.stringify(withTopKey), "osv"), /unknown key 'extra'/);
  const withEntryKey = { schema: 1, tool: "osv", entries: [entry({ surprise: "x" })] };
  assert.throws(
    () => parseBaseline(JSON.stringify(withEntryKey), "osv"),
    /unknown entry key 'surprise'/,
  );
});
