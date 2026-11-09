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
  for (const job of ["gitleaks-forks", "osv-forks", "syft"]) {
    const start = text.indexOf(`  ${job}:`);
    const end = text.indexOf("\n  summary:", start);
    const block = text.slice(start, end);
    assert.match(block, /needs: \[decide\]/, job);
    assert.match(block, /if: needs\.decide\.outputs\.report == 'true'/, job);
  }
});

test("gitleaks exit codes are captured, not left to bash -e", () => {
  // GitHub runs run: steps with bash -e, so a bare gitleaks call that exits 2 would end the step before its
  // exit code is recorded. Every gitleaks invocation must capture its exit with "|| code=$?".
  const text = read("p5-scans.yml");
  const calls = text
    .split("\n")
    .filter((line) => /(tools\/gitleaks|\$tool)" (git|dir) /.test(line));
  assert.ok(calls.length >= 3, "expected gitleaks invocations");
  const lines = text.split("\n");
  for (const call of calls) {
    const index = lines.indexOf(call);
    const continued = lines.slice(index, index + 4).join(" ");
    assert.match(continued, /\|\| code=\$\?/, call.trim());
  }
});

test("the codeql init step has no tools input (codeql-action reads tools: default as a local path)", () => {
  const text = readFileSync(join(REPO, ".github/workflows/codeql-reusable.yml"), "utf8");
  const start = text.indexOf("github/codeql-action/init@");
  const end = text.indexOf("github/codeql-action/analyze@", start);
  assert.ok(start >= 0 && end > start, "init step found");
  assert.doesNotMatch(text.slice(start, end), /^\s*tools:/m);
});

test("codeql uses javascript.sarif for the upload and the threshold, with a precheck before the threshold", () => {
  const text = readFileSync(join(REPO, ".github/workflows/codeql-reusable.yml"), "utf8");
  assert.doesNotMatch(text, /javascript-typescript\.sarif/, "plan 5.5 name is not used");
  assert.match(text, /sarif_file: \$\{\{ runner\.temp \}\}\/codeql-results\/javascript\.sarif/);
  const thresholdAt = text.indexOf("codeql-threshold.ts");
  const precheckAt = text.indexOf("expected javascript.sarif as the only *.sarif");
  assert.ok(precheckAt >= 0 && thresholdAt > precheckAt, "precheck runs before the threshold call");
  assert.match(text, /codeql-threshold\.ts "\$sarif"/);
});

test("zizmor runs offline and its requirement is hash-pinned to the plan digest", () => {
  const text = readFileSync(join(REPO, ".github/workflows/p5-scans.yml"), "utf8");
  assert.match(text, /zizmor" --no-online-audits --format sarif \.github\/workflows/);
  const requirements = readFileSync(join(REPO, "config/scan/zizmor-requirements.txt"), "utf8");
  assert.match(
    requirements,
    /^zizmor==1\.32\.0 --hash=sha256:84a6acb975accc13408786a2bd274b572537ca19c933ebbc13e78f3988562071$/m,
  );
});

test("the PN-7 token scan runs before each SARIF upload", () => {
  for (const file of ["p5-scans.yml", "codeql-reusable.yml"]) {
    const text = readFileSync(join(REPO, ".github/workflows", file), "utf8");
    const scanAt = text.indexOf("evidence-token-scan.mjs");
    const uploadAt = text.indexOf("github/codeql-action/upload-sarif@");
    assert.ok(scanAt >= 0 && uploadAt > scanAt, `${file}: scan before upload`);
  }
});
