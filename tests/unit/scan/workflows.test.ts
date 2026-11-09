import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { KEY_JOBS } from "../../../scripts/scan/aggregate.ts";
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

// The text of one top-level job of p5-scans.yml: from its "  <job>:" header to the next top-level job header
// (or to the end of the file). A job that lost its own needs or if line cannot borrow another job's text.
const JOB_HEADER = /^ {2}[a-z0-9-]+:\s*(#.*)?$/;
function jobBlock(text: string, job: string): string | undefined {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`  ${job}:`) && JOB_HEADER.test(line));
  if (start < 0) return undefined;
  let end = start + 1;
  while (end < lines.length && !JOB_HEADER.test(lines[end] ?? "")) end += 1;
  return lines.slice(start, end).join("\n");
}

// Report-only jobs: KEY_JOBS report entries that exist as jobs here, minus trivy-upload (ungated by design, plan 5.0).
function reportOnlyJobs(text: string): string[] {
  const reportJobs = Object.values(KEY_JOBS).flatMap((jobs) => jobs.report);
  return [...new Set(reportJobs)]
    .filter((job) => job !== "trivy-upload")
    .filter((job) => jobBlock(text, job) !== undefined);
}

// Jobs whose own block lacks the decide gate. Each block must carry both lines itself.
function ungatedReportJobs(text: string): string[] {
  return reportOnlyJobs(text).filter((job) => {
    const block = jobBlock(text, job) ?? "";
    return (
      !/^ {4}needs: \[decide\]$/m.test(block) ||
      !/^ {4}if: needs\.decide\.outputs\.report == '(true)'$/m.test(block)
    );
  });
}

test("report-only jobs are gated by the decide job, per job", () => {
  const text = read("p5-scans.yml");
  const jobs = reportOnlyJobs(text);
  assert.ok(jobs.length > 0, "report-only jobs are present");
  for (const job of ["gitleaks-forks", "osv-forks", "trivy-images", "trivy-forks"]) {
    assert.ok(jobs.includes(job), `${job} is covered`);
  }
  assert.deepEqual(ungatedReportJobs(text), []);
});

test("a report job without its own decide gate is caught", () => {
  const text = read("p5-scans.yml");
  const block = jobBlock(text, "osv-forks");
  assert.ok(block !== undefined, "osv-forks block exists");
  const withoutIf = block.replace(/\n {4}if: needs\.decide\.outputs\.report == 'true'/, "");
  assert.notEqual(withoutIf, block, "the if line was removed from the copy");
  const broken = text.replace(block, withoutIf);
  assert.deepEqual(ungatedReportJobs(broken), ["osv-forks"]);
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
