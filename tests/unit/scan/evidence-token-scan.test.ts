import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { REPO, scratch, syntheticApiLine, writeTree } from "./fixtures/index.ts";

const SCAN = join(REPO, "scripts/scan/evidence-token-scan.mjs");

function run(dir: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("node", [SCAN, dir], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("a clean tree exits 0 and prints clean", () => {
  const dir = scratch("pn7-clean");
  writeTree(dir, { "report/summary.txt": "all checks passed\n" });
  const result = run(dir);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /token scan: clean/);
});

test("a synthetic token exits 1 and prints file and line only", () => {
  const dir = scratch("pn7-hit");
  writeTree(dir, { "report/leak.txt": `ok\n${syntheticApiLine()}\n` });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOKEN PATTERN: report\/leak\.txt line 2/);
  assert.doesNotMatch(result.stderr, /TOKEN PATTERN: report\/leak\.txt line 2\S/);
});

test("the output contains no matched text", () => {
  const dir = scratch("pn7-text");
  const token = syntheticApiLine();
  writeTree(dir, { "report/leak.txt": `${token}\n` });
  const result = run(dir);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.includes(token.slice(4)), false);
  assert.equal(result.stderr.includes(token.slice(4)), false);
});

test("a missing directory exits non-zero", () => {
  const result = run(join(scratch("pn7-missing"), "absent"));
  assert.notEqual(result.status, 0);
  assert.equal(result.status, 1);
});
