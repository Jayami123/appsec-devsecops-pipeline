// gitleaks verdict (plan 6.1). Exit 0 with an empty report is pass; exit 2 with at least one finding is fail;
// any other exit, a missing or unparseable report, or a mismatch between exit and findings is fail.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { failClosed, type ScanOutcome } from "./threshold-core.ts";

interface GitleaksFinding {
  readonly RuleID?: unknown;
  readonly File?: unknown;
  readonly StartLine?: unknown;
}

function readFindings(jsonPath: string): GitleaksFinding[] | string {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(jsonPath, "utf8")) as unknown;
  } catch {
    return "missing or unparseable gitleaks report";
  }
  if (doc === null) return [];
  if (!Array.isArray(doc)) return "gitleaks report is not an array";
  return doc as GitleaksFinding[];
}

export function evaluateGitleaks(jsonPath: string, exitCode: number): ScanOutcome {
  if (exitCode !== 0 && exitCode !== 2) return failClosed(`gitleaks exit ${exitCode}`);
  const findings = readFindings(jsonPath);
  if (typeof findings === "string") return failClosed(findings);
  if (exitCode === 0) {
    return findings.length === 0
      ? { verdict: "pass", reason: "no findings", blocking: [] }
      : failClosed("gitleaks exit 0 with findings in the report");
  }
  if (findings.length === 0) return failClosed("gitleaks exit 2 with no findings in the report");
  const blocking = findings.map(
    (f) => `${String(f.RuleID)}|${String(f.File)}|${String(f.StartLine)}`,
  );
  return { verdict: "fail", reason: "gitleaks findings", blocking };
}

// CLI: <tree.json> <tree-exit> [<range.json> <range-exit>]. Prints verdict=pass|fail on stdout. Exits 0 on a
// computed verdict (fail included); exits 1 only if its own arguments are unusable.
function main(argv: readonly string[]): number {
  const [treePath, treeExit, rangePath, rangeExit] = argv;
  if (treePath === undefined || treeExit === undefined) {
    console.error(
      "usage: gitleaks-threshold.ts <tree.json> <tree-exit> [<range.json> <range-exit>]",
    );
    return 1;
  }
  const outcomes = [evaluateGitleaks(treePath, Number(treeExit))];
  if (rangePath !== undefined && rangeExit !== undefined) {
    outcomes.push(evaluateGitleaks(rangePath, Number(rangeExit)));
  }
  for (const outcome of outcomes) {
    if (outcome.verdict !== "pass") console.error(`gitleaks: ${outcome.reason}`);
  }
  const verdict = outcomes.every((o) => o.verdict === "pass") ? "pass" : "fail";
  console.log(`verdict=${verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
