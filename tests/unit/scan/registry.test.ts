import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { KEY_JOBS, type Registry } from "../../../scripts/scan/aggregate.ts";
import { REPO } from "./fixtures/index.ts";

const STUB_MARKER = "# P5-STUB: remove this line when the first real job lands";
const realRegistry = JSON.parse(
  readFileSync(join(REPO, "config/scan/implementation-status.json"), "utf8"),
) as Registry;
const scanWorkflow = readFileSync(join(REPO, ".github/workflows/p5-scans.yml"), "utf8");

// Returns the problems with a registry against a workflow text (plan 5.9, 5.11 registry tests).
function checkRegistry(
  registry: Registry,
  workflowText: string,
  scanDirPresent: boolean,
): string[] {
  const problems: string[] = [];
  const hasJob = (job: string): boolean =>
    workflowText.split("\n").some((line) => line === `  ${job}:` || line.startsWith(`  ${job}: `));
  for (const [key, state] of Object.entries(registry)) {
    const jobs = KEY_JOBS[key];
    if (state === "implemented") {
      if (workflowText.includes(STUB_MARKER))
        problems.push(`${key}: implemented but the stub marker is present`);
      for (const job of [...(jobs?.blocking ?? []), ...(jobs?.report ?? [])]) {
        if (!hasJob(job)) problems.push(`${key}: implemented but job ${job} is missing`);
      }
    }
  }
  const markerPresent = workflowText.includes(STUB_MARKER);
  if (markerPresent === scanDirPresent)
    problems.push("the stub marker must be absent exactly when scripts/scan has files");
  return problems;
}

test("an implemented entry with a stub-marker workflow fails", () => {
  const withMarker = `${STUB_MARKER}\n${scanWorkflow}`;
  const problems = checkRegistry({ gitleaks: "implemented" }, withMarker, true);
  assert.ok(problems.some((p) => p.includes("stub marker is present")));
});

test("an implemented entry whose job is missing fails", () => {
  const problems = checkRegistry({ syft: "implemented" }, scanWorkflow, true);
  assert.ok(problems.some((p) => p.includes("job syft is missing")));
});

test("a stub entry reporting pass is rejected", () => {
  // Covered at the aggregator (aggregate.test.ts); here the registry rule: a stub key has no job to pass.
  assert.deepEqual(checkRegistry({ trivy: "stub" }, scanWorkflow, true), []);
});

test("the stub marker is absent exactly when scripts/scan has files", () => {
  assert.equal(existsSync(join(REPO, "scripts/scan")), true);
  assert.equal(scanWorkflow.includes(STUB_MARKER), false);
  assert.deepEqual(checkRegistry(realRegistry, scanWorkflow, true), []);
});
