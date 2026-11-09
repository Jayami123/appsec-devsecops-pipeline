import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO } from "./fixtures/index.ts";

// The scan workflows present at this PR (L2): p5-scans.yml. codeql-reusable.yml and p5-zap-nightly.yml land later.
const SCAN_WORKFLOWS = ["p5-scans.yml", "codeql-reusable.yml"].filter((file) =>
  existsSync(join(REPO, ".github/workflows", file)),
);
const read = (file: string): string => readFileSync(join(REPO, ".github/workflows", file), "utf8");

test("no scan workflow grants contents: write", () => {
  for (const file of SCAN_WORKFLOWS) assert.doesNotMatch(read(file), /contents:\s*write/, file);
});

test("no scan workflow contains continue-on-error", () => {
  for (const file of SCAN_WORKFLOWS) assert.doesNotMatch(read(file), /continue-on-error/, file);
});

test("p5-scans.yml and codeql-reusable.yml external uses are SHAs with version comments", () => {
  let checked = 0;
  for (const file of SCAN_WORKFLOWS) {
    for (const line of read(file).split("\n")) {
      if (!/uses:/.test(line) || /uses:\s*\.\//.test(line)) continue;
      checked += 1;
      assert.match(line, /uses: [^@\s]+@[0-9a-f]{40} # v\d+\.\d+\.\d+/, `${file}: ${line.trim()}`);
    }
  }
  assert.ok(checked > 0, "expected external uses");
});

test("scan job timeouts are at most 20", () => {
  let checked = 0;
  for (const file of SCAN_WORKFLOWS) {
    for (const match of read(file).matchAll(/timeout-minutes:\s*(\d+)/g)) {
      checked += 1;
      assert.ok(Number(match[1]) <= 20, `${file}: ${match[1] ?? ""}`);
    }
  }
  assert.ok(checked > 0, "expected timeout-minutes values");
});

test("report-only jobs are gated by the decide job", () => {
  const text = read("p5-scans.yml");
  for (const job of ["gitleaks-forks"]) {
    const start = text.indexOf(`  ${job}:`);
    const end = text.indexOf("\n  summary:", start);
    const block = text.slice(start, end);
    assert.match(block, /needs: \[decide\]/, job);
    assert.match(block, /if: needs\.decide\.outputs\.report == 'true'/, job);
  }
});
