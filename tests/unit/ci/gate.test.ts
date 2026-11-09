// Gate evaluator tests for scripts/ci-gate.mjs (plan 9.1 and 9.13; correction a).
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

type Needs = Record<string, { result: string; outputs?: Record<string, string> }>;
interface Verdict {
  ok: boolean;
  reasons: string[];
  rows: string[];
}
interface GateModule {
  evaluateGate: (input: { needs: Needs; registry: Record<string, string> }) => Verdict;
}

const gatePath = fileURLToPath(new URL("../../../scripts/ci-gate.mjs", import.meta.url));
const { evaluateGate } = (await import(gatePath)) as GateModule;

const SCANNERS = ["codeql", "gitleaks", "osv-npm", "trivy", "zap", "syft", "zizmor"];
const LANE_FLAGS = ["p5_cal", "p5_doc", "p5_med", "p5_tw", "p5_tw_iso", "p5_x"];
const LANE_JOBS = ["p5-cal", "p5-doc", "p5-med", "p5-tw", "p5-tw-iso", "p5-x"];

// A passing run: every lane skipped with its flag false, scanners all not-implemented, registry all stub.
function baseNeeds(): Needs {
  const flags: Record<string, string> = { p5_codeql: "false", p5_scans: "true" };
  for (const flag of LANE_FLAGS) flags[flag] = "false";
  const scannerStatus = SCANNERS.map((name) => `${name}=not-implemented`).join(",");
  const needs: Needs = {
    changes: { result: "success", outputs: flags },
    foundation: { result: "success" },
    "p5-scans": {
      result: "success",
      outputs: { codeql_verdict: "not-implemented", scanner_status: scannerStatus },
    },
  };
  for (const job of LANE_JOBS) needs[job] = { result: "skipped" };
  return needs;
}

function baseRegistry(): Record<string, string> {
  return Object.fromEntries(SCANNERS.map((name) => [name, "stub"]));
}

function withScanner(needs: Needs, name: string, verdict: string): Needs {
  const scanner = needs["p5-scans"];
  const pairs = SCANNERS.map((item) => `${item}=${item === name ? verdict : "not-implemented"}`);
  return {
    ...needs,
    "p5-scans": {
      result: scanner?.result ?? "success",
      outputs: { ...scanner?.outputs, scanner_status: pairs.join(",") },
    },
  };
}

test("a lane skipped with its flag false passes the gate", () => {
  const verdict = evaluateGate({ needs: baseNeeds(), registry: baseRegistry() });
  assert.equal(verdict.ok, true, verdict.reasons.join("; "));
});

test("a lane skipped with its flag true fails the gate", () => {
  const needs = baseNeeds();
  needs.changes = { result: "success", outputs: { ...needs.changes?.outputs, p5_cal: "true" } };
  const verdict = evaluateGate({ needs, registry: baseRegistry() });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.includes("p5-cal must succeed")));
});

test("a stub scanner reporting not-implemented passes with a NOT IMPLEMENTED row", () => {
  const verdict = evaluateGate({ needs: baseNeeds(), registry: baseRegistry() });
  assert.equal(verdict.ok, true, verdict.reasons.join("; "));
  assert.ok(verdict.rows.includes("NOT IMPLEMENTED: gitleaks"));
});

test("an implemented scanner reporting not-implemented fails the gate", () => {
  const registry = { ...baseRegistry(), gitleaks: "implemented" };
  const verdict = evaluateGate({ needs: baseNeeds(), registry });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.startsWith("gitleaks:")));
});

test("a stub entry reporting pass is rejected", () => {
  const verdict = evaluateGate({
    needs: withScanner(baseNeeds(), "gitleaks", "pass"),
    registry: baseRegistry(),
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.includes("stub reports 'pass'")));
});

test("codeql not-implemented passes only while codeql is a stub", () => {
  const needs = baseNeeds();
  needs.changes = { result: "success", outputs: { ...needs.changes?.outputs, p5_codeql: "true" } };
  const stub = evaluateGate({ needs, registry: baseRegistry() });
  assert.equal(stub.ok, true, stub.reasons.join("; "));
  const implemented = evaluateGate({
    needs,
    registry: { ...baseRegistry(), codeql: "implemented" },
  });
  assert.equal(implemented.ok, false);
});

test("a codeql fail verdict blocks the gate", () => {
  const needs = baseNeeds();
  needs.changes = { result: "success", outputs: { ...needs.changes?.outputs, p5_codeql: "true" } };
  const scanner = needs["p5-scans"];
  needs["p5-scans"] = {
    result: scanner?.result ?? "success",
    outputs: { ...scanner?.outputs, codeql_verdict: "fail" },
  };
  const verdict = evaluateGate({ needs, registry: baseRegistry() });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.startsWith("codeql:")));
});
