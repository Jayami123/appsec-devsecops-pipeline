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

// Replaces the scanner_status string on the p5-scans job.
function withStatus(needs: Needs, status: string): Needs {
  const scanner = needs["p5-scans"];
  return {
    ...needs,
    "p5-scans": {
      result: scanner?.result ?? "success",
      outputs: { ...scanner?.outputs, scanner_status: status },
    },
  };
}

test("a stub scanner reporting not-implemented passes with a NOT IMPLEMENTED row", () => {
  const verdict = evaluateGate({ needs: baseNeeds(), registry: baseRegistry() });
  assert.equal(verdict.ok, true, verdict.reasons.join("; "));
  assert.ok(verdict.rows.includes("NOT IMPLEMENTED: gitleaks"));

  // Fail closed on an incomplete, duplicated or unknown scanner_status.
  const complete = SCANNERS.map((name) => `${name}=not-implemented`);
  const missing = evaluateGate({
    needs: withStatus(baseNeeds(), complete.filter((p) => !p.startsWith("gitleaks=")).join(",")),
    registry: baseRegistry(),
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.reasons.some((r) => r.startsWith("gitleaks: missing")));
  const duplicated = evaluateGate({
    needs: withStatus(baseNeeds(), [...complete, "gitleaks=not-implemented"].join(",")),
    registry: baseRegistry(),
  });
  assert.equal(duplicated.ok, false);
  assert.ok(
    duplicated.reasons.some((r) => r.startsWith("gitleaks: scanner_status lists it 2 times")),
  );
  const unknown = evaluateGate({
    needs: withStatus(baseNeeds(), [...complete, "bogus=not-implemented"].join(",")),
    registry: baseRegistry(),
  });
  assert.equal(unknown.ok, false);
  assert.ok(unknown.reasons.some((r) => r.startsWith("bogus:")));
});

test("an implemented scanner reporting not-implemented fails the gate", () => {
  const registry = { ...baseRegistry(), gitleaks: "implemented" };
  const verdict = evaluateGate({ needs: baseNeeds(), registry });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.startsWith("gitleaks:")));

  // An implemented scanner absent from the list also fails.
  const complete = SCANNERS.map((name) => `${name}=not-implemented`);
  const absent = evaluateGate({
    needs: withStatus(baseNeeds(), complete.filter((p) => !p.startsWith("gitleaks=")).join(",")),
    registry,
  });
  assert.equal(absent.ok, false);
  assert.ok(absent.reasons.some((r) => r.startsWith("gitleaks: missing")));
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

  // The codeql pair in scanner_status must equal codeql_verdict.
  const disagree = withStatus(
    needs,
    SCANNERS.map((name) => `${name}=${name === "codeql" ? "pass" : "not-implemented"}`).join(","),
  );
  const mismatch = evaluateGate({ needs: disagree, registry: baseRegistry() });
  assert.equal(mismatch.ok, false);
  assert.ok(mismatch.reasons.some((r) => r.startsWith("codeql: scanner_status says 'pass'")));
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

test("skipped is accepted only for report-only keys", () => {
  const status = SCANNERS.map(
    (name) => `${name}=${name === "syft" || name === "zap" ? "skipped" : "not-implemented"}`,
  ).join(",");
  const registry = { ...baseRegistry(), syft: "implemented", zap: "implemented" };
  const verdict = evaluateGate({ needs: withStatus(baseNeeds(), status), registry });
  assert.equal(verdict.ok, true, verdict.reasons.join("; "));
  assert.ok(verdict.rows.includes("SKIPPED: syft (report-only, not run on this event)"));
  assert.ok(verdict.rows.includes("SKIPPED: zap (report-only, not run on this event)"));
});

test("skipped for gitleaks fails", () => {
  const registry = { ...baseRegistry(), gitleaks: "implemented" };
  const verdict = evaluateGate({
    needs: withScanner(baseNeeds(), "gitleaks", "skipped"),
    registry,
  });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.includes("gitleaks: skipped is allowed only for report-only scanners"));
});

test("a missing syft key fails", () => {
  const status = SCANNERS.filter((name) => name !== "syft")
    .map((name) => `${name}=not-implemented`)
    .join(",");
  const registry = { ...baseRegistry(), syft: "implemented" };
  const verdict = evaluateGate({ needs: withStatus(baseNeeds(), status), registry });
  assert.equal(verdict.ok, false);
  assert.ok(verdict.reasons.some((reason) => reason.startsWith("syft: missing")));
});

test("skipped on a stub key fails", () => {
  const verdict = evaluateGate({
    needs: withScanner(baseNeeds(), "syft", "skipped"),
    registry: baseRegistry(),
  });
  assert.equal(verdict.ok, false);
  assert.ok(
    verdict.reasons.includes("syft: stub reports 'skipped'; a stub reports not-implemented only"),
  );
});

test("run 43462841673 (head f8946c1): codeql=fail blocks by name, zap=not-implemented does not (the wiring is correct)", () => {
  // Every lane passed. The one blocker in that run was the CodeQL verdict, from a finding in the code, not the gate.
  const needs = baseNeeds();
  needs.changes = { result: "success", outputs: { ...needs.changes?.outputs, p5_codeql: "true" } };
  const scanStatus = SCANNERS.map((name) => {
    if (name === "codeql") return "codeql=fail";
    if (name === "zap") return "zap=not-implemented";
    return `${name}=pass`;
  }).join(",");
  needs["p5-scans"] = {
    result: "success",
    outputs: { codeql_verdict: "fail", scanner_status: scanStatus },
  };
  // Registry as in that run: every scanner implemented except zap (a stub until its first real run is accepted).
  const registry: Record<string, string> = { ...baseRegistry() };
  for (const name of ["codeql", "gitleaks", "osv-npm", "trivy", "syft", "zizmor"])
    registry[name] = "implemented";
  registry["zap"] = "stub";
  const verdict = evaluateGate({ needs, registry });
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.reasons, ["codeql: implemented scanner reports fail"]);
  assert.ok(verdict.rows.includes("NOT IMPLEMENTED: zap"), "zap is a stub and is not a blocker");
});
