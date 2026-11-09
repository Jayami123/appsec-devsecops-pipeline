import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aggregate, KEY_JOBS, type Needs, type Registry } from "../../../scripts/scan/aggregate.ts";
import { REPO } from "./fixtures/index.ts";

const reportJobs = new Set(Object.values(KEY_JOBS).flatMap((jobs) => jobs.report));
const realRegistry = JSON.parse(
  readFileSync(join(REPO, "config/scan/implementation-status.json"), "utf8"),
) as Registry;

function pairOf(status: string, key: string): string | undefined {
  return status.split(",").find((pair) => pair.startsWith(`${key}=`));
}

test("a stub key is not-implemented", () => {
  const registry: Registry = { codeql: "stub", gitleaks: "stub" };
  const needs: Needs = { gitleaks: { result: "success", outputs: { verdict: "pass" } } };
  assert.equal(
    pairOf(aggregate(needs, registry, reportJobs).scannerStatus, "gitleaks"),
    "gitleaks=not-implemented",
  );
});

test("a stub entry reporting pass is rejected", () => {
  const registry: Registry = { codeql: "stub", gitleaks: "stub" };
  const needs: Needs = { codeql: { result: "success", outputs: { verdict: "pass" } } };
  assert.equal(aggregate(needs, registry, reportJobs).codeqlVerdict, "not-implemented");
});

test("a blocking job that did not succeed is fail", () => {
  const registry: Registry = { codeql: "stub", gitleaks: "implemented" };
  const needs: Needs = { gitleaks: { result: "failure" }, "gitleaks-forks": { result: "skipped" } };
  assert.equal(
    pairOf(aggregate(needs, registry, reportJobs).scannerStatus, "gitleaks"),
    "gitleaks=fail",
  );
});

test("a report job that failed is fail", () => {
  const registry: Registry = { codeql: "stub", gitleaks: "implemented" };
  const needs: Needs = {
    gitleaks: { result: "success", outputs: { verdict: "pass" } },
    "gitleaks-forks": { result: "failure" },
  };
  assert.equal(
    pairOf(aggregate(needs, registry, reportJobs).scannerStatus, "gitleaks"),
    "gitleaks=fail",
  );
});

test("a skipped report job is ignored", () => {
  const registry: Registry = { codeql: "stub", gitleaks: "implemented" };
  const needs: Needs = {
    gitleaks: { result: "success", outputs: { verdict: "pass" } },
    "gitleaks-forks": { result: "skipped" },
  };
  assert.equal(
    pairOf(aggregate(needs, registry, reportJobs).scannerStatus, "gitleaks"),
    "gitleaks=pass",
  );
});

test("codeql_verdict equals the codeql pair", () => {
  const { codeqlVerdict, scannerStatus } = aggregate({}, realRegistry, reportJobs);
  assert.equal(pairOf(scannerStatus, "codeql"), `codeql=${codeqlVerdict}`);
});

test("every registry key appears exactly once", () => {
  const { scannerStatus } = aggregate({}, realRegistry, reportJobs);
  const names = scannerStatus.split(",").map((pair) => pair.split("=")[0]);
  assert.deepEqual(names, Object.keys(realRegistry));
});
