// zizmor verdict (plan 6.6). Blocks when any SARIF result has level "error". Warnings and notes are reported.
// Exit 0 with findings is normal (RECORDED-2); exit 1 or 3 is fail (3 = no inputs). Fails closed on a bad report.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { failClosed, type ScanOutcome } from "./threshold-core.ts";

interface ZizmorResult {
  readonly ruleId?: string;
  readonly level?: string;
  readonly locations?: readonly {
    readonly physicalLocation?: { readonly artifactLocation?: { readonly uri?: string } };
  }[];
}
interface ZizmorSarif {
  readonly runs?: readonly { readonly results?: readonly ZizmorResult[] }[];
}

export function evaluateZizmor(sarifPath: string, exitCode: number): ScanOutcome {
  if (exitCode !== 0) return failClosed(`zizmor exit ${exitCode}`);
  let doc: ZizmorSarif;
  try {
    doc = JSON.parse(readFileSync(sarifPath, "utf8")) as ZizmorSarif;
  } catch {
    return failClosed("missing or unparseable zizmor SARIF");
  }
  const run = doc.runs?.[0];
  if (run === undefined) return failClosed("zizmor SARIF has no run");
  const blocking: string[] = [];
  for (const result of run.results ?? []) {
    if (result.level !== "error") continue;
    const uri = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "";
    blocking.push(`${result.ruleId ?? "unknown"}|${uri}`);
  }
  return blocking.length === 0
    ? { verdict: "pass", reason: "no error-level zizmor result", blocking }
    : { verdict: "fail", reason: "error-level zizmor result", blocking };
}

// CLI: <sarif> <exit>. Prints verdict=pass|fail.
function main(argv: readonly string[]): number {
  const [sarifPath, exitRaw] = argv;
  if (sarifPath === undefined || exitRaw === undefined) {
    console.error("usage: zizmor-threshold.ts <sarif> <exit>");
    return 1;
  }
  const outcome = evaluateZizmor(sarifPath, Number(exitRaw));
  if (outcome.verdict !== "pass") console.error(`zizmor: ${outcome.reason}`);
  console.log(`verdict=${outcome.verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
