// Gate evaluator for .github/workflows/ci.yml job `gate` (plan 9.1 and 9.13). Plan correction a.
// evaluateGate is a pure function that the tests call. The CLI reads NEEDS_JSON (toJSON(needs)) and the
// scanner registry, prints the summary and exits 1 when any blocking reason is present.
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LANES = [
  ["p5-cal", "p5_cal"],
  ["p5-doc", "p5_doc"],
  ["p5-med", "p5_med"],
  ["p5-tw", "p5_tw"],
  ["p5-tw-iso", "p5_tw_iso"],
  ["p5-x", "p5_x"],
];
const VERDICTS = new Set(["pass", "fail", "not-implemented", "skipped"]);
// Report-only scanners (L-PIPE O-15): may report skipped when their job did not run; never absent.
const REPORT_ONLY_KEYS = new Set(["syft", "zap"]);

// Parses "name=verdict,name=verdict". Returns null for anything malformed.
function parseScannerStatus(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const pairs = [];
  for (const item of text.split(",")) {
    const parts = item.split("=");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    pairs.push([parts[0], parts[1]]);
  }
  return pairs;
}

// Judges one scanner verdict against the registry (stub or implemented). Returns reasons and rows.
function judge(name, verdict, registry, reasons, rows) {
  const state = registry[name];
  if (state !== "stub" && state !== "implemented") {
    reasons.push(`${name}: not in the scanner registry`);
    return;
  }
  if (!VERDICTS.has(verdict)) {
    reasons.push(`${name}: unknown verdict '${verdict}'`);
    return;
  }
  if (verdict === "skipped") {
    if (!REPORT_ONLY_KEYS.has(name)) {
      reasons.push(`${name}: skipped is allowed only for report-only scanners`);
    } else if (state === "stub") {
      reasons.push(`${name}: stub reports 'skipped'; a stub reports not-implemented only`);
    } else {
      rows.push(`SKIPPED: ${name} (report-only, not run on this event)`);
    }
    return;
  }
  if (state === "stub") {
    if (verdict === "not-implemented") {
      rows.push(`NOT IMPLEMENTED: ${name}`);
    } else {
      reasons.push(`${name}: stub reports '${verdict}'; a stub never emits a verdict`);
    }
    return;
  }
  if (verdict === "fail") reasons.push(`${name}: implemented scanner reports fail`);
  if (verdict === "not-implemented") {
    reasons.push(`${name}: implemented scanner reports not-implemented`);
  }
}

export function evaluateGate({ needs, registry }) {
  const reasons = [];
  const rows = [];
  const result = (job) => needs[job]?.result ?? "missing";
  const output = (job, key) => needs[job]?.outputs?.[key] ?? "";
  const flag = (key) => output("changes", key) === "true";

  if (result("changes") !== "success") reasons.push(`changes: ${result("changes")}`);
  if (result("foundation") !== "success") reasons.push(`foundation: ${result("foundation")}`);

  for (const [job, key] of LANES) {
    const state = result(job);
    if (flag(key)) {
      if (state !== "success") reasons.push(`${job} must succeed when ${key}=true (got ${state})`);
    } else if (state === "failure" || state === "cancelled") {
      reasons.push(`${job} ${state} while ${key}=false`);
    }
  }

  if (flag("p5_scans")) {
    if (result("p5-scans") !== "success") {
      reasons.push(`p5-scans must succeed when p5_scans=true (got ${result("p5-scans")})`);
    }
    const pairs = parseScannerStatus(output("p5-scans", "scanner_status"));
    if (pairs === null) {
      reasons.push("p5-scans: scanner_status is missing or malformed");
    } else {
      // Fail closed: every registry key appears exactly once, and nothing else appears.
      const counts = new Map();
      for (const [name] of pairs) counts.set(name, (counts.get(name) ?? 0) + 1);
      for (const [name, count] of counts) {
        if (!Object.hasOwn(registry, name)) {
          reasons.push(`${name}: scanner_status names a scanner not in the registry`);
        } else if (count > 1) {
          reasons.push(`${name}: scanner_status lists it ${count} times`);
        }
      }
      for (const name of Object.keys(registry)) {
        if (!counts.has(name)) reasons.push(`${name}: missing from scanner_status`);
      }
      for (const [name, verdict] of pairs) {
        if (!Object.hasOwn(registry, name)) continue;
        if (name === "codeql") {
          // CodeQL is judged by codeql_verdict below; its pair here must agree with it.
          const codeqlVerdict = output("p5-scans", "codeql_verdict");
          if (verdict !== codeqlVerdict) {
            reasons.push(
              `codeql: scanner_status says '${verdict}' but codeql_verdict is '${codeqlVerdict}'`,
            );
          }
        } else {
          judge(name, verdict, registry, reasons, rows);
        }
      }
    }
  }

  if (flag("p5_codeql")) {
    const verdict = output("p5-scans", "codeql_verdict");
    if (result("p5-scans") !== "success") {
      reasons.push("codeql: p5-scans did not succeed, so no CodeQL verdict exists");
    } else {
      judge("codeql", verdict, registry, reasons, rows);
    }
  }

  return { ok: reasons.length === 0, reasons, rows };
}

function main() {
  const registryPath = resolve(
    fileURLToPath(new URL("../config/scan/implementation-status.json", import.meta.url)),
  );
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const needs = JSON.parse(process.env.NEEDS_JSON ?? "{}");
  const verdict = evaluateGate({ needs, registry });

  const lines = [
    ...verdict.rows,
    ...verdict.reasons.map((reason) => `BLOCKED: ${reason}`),
    verdict.ok ? "gate: PASS" : "gate: FAIL",
  ];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
  }
  process.exitCode = verdict.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
