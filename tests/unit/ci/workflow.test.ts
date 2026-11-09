// Workflow shape tests for the F0-3 CI files (plan 9.11). They read the files as text and parse the
// indentation the files use. No YAML library is a declared dependency of this repository.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (relativePath: string): string => readFileSync(join(root, relativePath), "utf8");
const workflow = (name: string): string => read(`.github/workflows/${name}`);
const workflowFiles = readdirSync(join(root, ".github", "workflows")).sort();
const ci = workflow("ci.yml");

const LANE_JOBS = ["p5-cal", "p5-doc", "p5-med", "p5-tw", "p5-tw-iso", "p5-x", "p5-scans"];
const ALL_CI_JOBS = [
  "changes",
  "foundation",
  "p5-cal",
  "p5-doc",
  "p5-med",
  "p5-tw",
  "p5-tw-iso",
  "p5-scans",
  "p5-x",
  "gate",
];
const SAME_REPO = "github.event.pull_request.head.repo.full_name == github.repository";
const STUB_MARKER = "# P5-STUB: remove this line when the first real job lands";

// Returns each job's lines keyed by job id, from the `jobs:` block (two-space job keys).
function jobs(text: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  let current: string[] | undefined;
  let inJobs = false;
  for (const line of text.split("\n")) {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line)) break;
    const job = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (job) {
      current = [];
      result.set(job[1] ?? "", current);
      continue;
    }
    current?.push(line);
  }
  return result;
}

// Returns the two-space keys under the top-level `on:` block.
function triggers(text: string): string[] {
  const keys: string[] = [];
  let inOn = false;
  for (const line of text.split("\n")) {
    if (/^on:\s*$/.test(line)) {
      inOn = true;
      continue;
    }
    if (inOn && /^\S/.test(line)) break;
    const key = inOn ? /^ {2}([a-z_]+):/.exec(line) : null;
    if (key) keys.push(key[1] ?? "");
  }
  return keys;
}

// The value of a four-space job field such as `needs:` or `if:`, or undefined when absent.
function jobField(lines: string[], field: string): string | undefined {
  const line = lines.find((item) => item.startsWith(`    ${field}:`));
  return line?.slice(`    ${field}:`.length).trim();
}

function allFilesUnder(relativeDir: string): string[] {
  const dir = join(root, relativeDir);
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...allFilesUnder(join(relativeDir, name)));
    } else {
      files.push(join(relativeDir, name));
    }
  }
  return files;
}

test("ci.yml triggers are exactly pull_request, push to main and workflow_dispatch", () => {
  assert.deepEqual(triggers(ci), ["pull_request", "push", "workflow_dispatch"]);
  assert.match(ci, /^ {2}push:\n {4}branches: \[main\]$/m);
});

test("ci.yml top-level permissions are contents: read", () => {
  assert.match(ci, /^permissions:\n {2}contents: read$/m);
});

test("security-events: write appears only on the allowed scan jobs and always on the p5-scans caller job in ci.yml", () => {
  const grants: string[] = [];
  for (const file of workflowFiles) {
    for (const [job, lines] of jobs(workflow(file))) {
      if (lines.some((line) => /security-events:\s*write/.test(line)))
        grants.push(`${file}:${job}`);
    }
  }
  const ALLOWED_GRANTS = [
    "ci.yml:p5-scans",
    "p5-scans.yml:codeql",
    "codeql-reusable.yml:analyze",
    "p5-scans.yml:trivy-upload",
  ];
  for (const grant of grants)
    assert.ok(ALLOWED_GRANTS.includes(grant), `unexpected security-events grant: ${grant}`);
  assert.ok(grants.includes("ci.yml:p5-scans"), "ci.yml:p5-scans must hold security-events: write");
});

test("gate needs every job and runs always()", () => {
  const gateLines = jobs(ci).get("gate") ?? [];
  const needs = jobField(gateLines, "needs") ?? "";
  const listed = needs
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim());
  assert.deepEqual([...listed].sort(), [...ALL_CI_JOBS].filter((job) => job !== "gate").sort());
  assert.deepEqual([...jobs(ci).keys()].sort(), [...ALL_CI_JOBS].sort());
  assert.equal(jobField(gateLines, "if"), "always()");
});

test("every lane job's if: requires the same-repo check", () => {
  for (const lane of LANE_JOBS) {
    const condition = jobField(jobs(ci).get(lane) ?? [], "if") ?? "";
    assert.ok(condition.includes(SAME_REPO), `${lane} if: lacks the same-repo check`);
  }
});

test("no workflow uses pull_request_target, workflow_run or continue-on-error", () => {
  for (const file of workflowFiles) {
    const text = workflow(file);
    for (const forbidden of ["pull_request_target", "workflow_run", "continue-on-error"]) {
      assert.ok(!text.includes(forbidden), `${file} contains ${forbidden}`);
    }
  }
});

const EXTERNAL_USES =
  /uses: [a-z0-9-]+\/[a-z0-9._-]+(\/[a-z0-9._/-]+)?@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;

test("every external uses: is a full 40-hex SHA with a version comment", () => {
  let externals = 0;
  for (const file of workflowFiles) {
    for (const line of workflow(file).split("\n")) {
      if (!/uses:/.test(line) || /uses:\s*\.\//.test(line)) continue;
      externals += 1;
      assert.match(line, EXTERNAL_USES, file);
    }
  }
  assert.ok(externals > 0, "expected at least one external action");
  const sha = "33d7b85da1a04171e211befe2c739303b9a4c066";
  assert.match(`      - uses: github/codeql-action/init@${sha} # v4.39.3`, EXTERNAL_USES);
  assert.doesNotMatch("      - uses: github/codeql-action/init@v4", EXTERNAL_USES);
  assert.doesNotMatch(`      - uses: github/codeql-action/init@${sha}`, EXTERNAL_USES);
});

test("every local uses: starts with ./.github/workflows/ and the file exists", () => {
  for (const file of workflowFiles) {
    for (const line of workflow(file).split("\n")) {
      const match = /uses:\s*(\.\/\S+)/.exec(line);
      if (!match) continue;
      const target = match[1] ?? "";
      assert.ok(target.startsWith("./.github/workflows/"), `${file}: ${target}`);
      assert.ok(existsSync(join(root, target.slice(2))), `${file}: ${target} does not exist`);
    }
  }
});

test("no docker:// uses in F0 workflows", () => {
  for (const file of workflowFiles) {
    assert.ok(!workflow(file).includes("docker://"), `${file} uses docker://`);
  }
});

test("each lane workflow is workflow_call and workflow_dispatch with no pull_request or push trigger", () => {
  const lanes = workflowFiles.filter(
    (file) => file.startsWith("p5-") && file !== "p5-zap-nightly.yml",
  );
  assert.ok(lanes.length > 0, "expected lane workflows");
  for (const file of lanes) {
    assert.deepEqual(triggers(workflow(file)), ["workflow_call", "workflow_dispatch"], file);
  }
});

test("stub marker is present exactly when the lane test directory is absent", () => {
  const kinds = (code: string): string[] =>
    ["contracts", "webhooks", "integration", "serial", "ui"].map((kind) => `tests/${kind}/${code}`);
  // Lane-to-test-directory map (plan 9.5 and correction e). A lane is present when any directory exists.
  const laneDirectories: Record<string, string[]> = {
    "p5-cal.yml": kinds("cal"),
    "p5-doc.yml": kinds("doc"),
    "p5-med.yml": kinds("med"),
    "p5-tw.yml": kinds("tw"),
    "p5-tw-iso.yml": ["tests/iso", "tests/limiter-last"],
    "p5-x.yml": ["tests/closeout"],
    "p5-scans.yml": ["scripts/scan"],
  };
  for (const [file, directories] of Object.entries(laneDirectories)) {
    const present = directories.some((dir) => existsSync(join(root, dir)));
    const hasMarker = workflow(file).split("\n").includes(STUB_MARKER);
    assert.equal(
      hasMarker,
      !present,
      `${file}: marker ${hasMarker}, lane directory present ${present}`,
    );
  }
});

test("no workflow sets DANGEROUS_BYPASS_RATE_LIMITS anywhere in .github or src/lanes", () => {
  for (const file of [...allFilesUnder(".github"), ...allFilesUnder("src/lanes")]) {
    assert.ok(!read(file).includes("DANGEROUS_BYPASS_RATE_LIMITS"), `${file} sets the bypass`);
  }
});

test("p5-tw-iso.yml has no secrets key and no secrets: inherit", () => {
  const lane = workflow("p5-tw-iso.yml");
  assert.doesNotMatch(lane, /^\s*secrets\s*:/m);
  assert.doesNotMatch(lane, /secrets:\s*inherit/);
  // The caller job in ci.yml must also pass no secrets (plan 9.1).
  assert.ok(!(jobs(ci).get("p5-tw-iso") ?? []).some((line) => /^ {4}secrets\s*:/.test(line)));
});

test("schedule appears only in p5-zap-nightly.yml", () => {
  const withSchedule = workflowFiles.filter((file) => /^\s*schedule\s*:/m.test(workflow(file)));
  assert.ok(
    withSchedule.every((file) => file === "p5-zap-nightly.yml"),
    withSchedule.join(", "),
  );
});

test("every timeout-minutes is at most 120", () => {
  let checked = 0;
  for (const file of workflowFiles) {
    for (const match of workflow(file).matchAll(/timeout-minutes:\s*(\d+)/g)) {
      checked += 1;
      assert.ok(Number(match[1]) <= 120, `${file}: ${match[1] ?? ""}`);
    }
  }
  assert.ok(checked > 0, "expected timeout-minutes values");
});

test("p5-x.yml has no secrets key", () => {
  assert.doesNotMatch(workflow("p5-x.yml"), /^\s*secrets\s*:/m);
});

test("p5-zap-nightly.yml triggers are exactly schedule and workflow_dispatch", () => {
  const NIGHTLY_TRIGGERS = ["schedule", "workflow_dispatch"];
  const good = "on:\n  schedule:\n    - cron: '0 1 * * *'\n  workflow_dispatch:\njobs:\n";
  const bad =
    "on:\n  schedule:\n    - cron: '0 1 * * *'\n  workflow_dispatch:\n  pull_request:\njobs:\n";
  assert.deepEqual([...triggers(good)].sort(), NIGHTLY_TRIGGERS);
  assert.notDeepEqual([...triggers(bad)].sort(), NIGHTLY_TRIGGERS);
  if (workflowFiles.includes("p5-zap-nightly.yml")) {
    assert.deepEqual([...triggers(workflow("p5-zap-nightly.yml"))].sort(), NIGHTLY_TRIGGERS);
  }
});
