// CodeQL verdict (plan 6.5, skeleton 5.12). Severity comes from the rule's security-severity (the SARIF level is
// absent on CodeQL results, probe 2b). Only owned paths block. A NEW High or Critical blocks; an accepted risk
// or a baseline entry (unexpired) suppresses it. Fails closed on an unreadable SARIF or no successful run.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type AcceptedRisk, matchAcceptedRisk } from "../../src/security/accepted-risk.ts";
import {
  activeFingerprints,
  type Baseline,
  failClosed,
  loadBaseline,
  type ScanOutcome,
  staleFingerprints,
} from "./threshold-core.ts";

// D4 ownership (MP:696): only P5-owned paths block.
export const OWNED_PREFIXES: readonly string[] = ["src/", "scripts/", "tests/", ".github/"];

interface SarifRule {
  readonly id?: string;
  readonly properties?: { readonly "security-severity"?: string };
}
interface SarifResult {
  readonly ruleId: string;
  readonly ruleIndex?: number;
  readonly locations?: readonly {
    readonly physicalLocation?: { readonly artifactLocation?: { readonly uri?: string } };
  }[];
  readonly partialFingerprints?: { readonly primaryLocationLineHash?: string };
}
interface Sarif {
  readonly runs?: readonly {
    readonly invocations?: readonly { readonly executionSuccessful?: boolean }[];
    readonly tool: { readonly driver: { readonly rules?: readonly SarifRule[] } };
    readonly results?: readonly SarifResult[];
  }[];
}

export interface CodeqlScan {
  readonly outcome: ScanOutcome;
  readonly current: ReadonlySet<string>;
}

// Fingerprint: ruleId|uri|primaryLocationLineHash (plan 6.5).
export function scanCodeql(
  sarifPath: string,
  active: ReadonlySet<string>,
  accepted: readonly AcceptedRisk[],
  today: string,
): CodeqlScan {
  const none: ReadonlySet<string> = new Set();
  let doc: Sarif;
  try {
    doc = JSON.parse(readFileSync(sarifPath, "utf8")) as Sarif;
  } catch {
    return { outcome: failClosed("unreadable SARIF"), current: none };
  }
  const run = doc.runs?.[0];
  if (!run || run.invocations?.[0]?.executionSuccessful !== true) {
    return { outcome: failClosed("SARIF without a successful invocation"), current: none };
  }
  const rules = run.tool.driver.rules ?? [];
  const current = new Set<string>();
  const blocking: string[] = [];
  for (const result of run.results ?? []) {
    const rule = rules[result.ruleIndex ?? -1] ?? rules.find((r) => r.id === result.ruleId);
    const severity = Number(rule?.properties?.["security-severity"]);
    const uri = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "";
    const fp = `${result.ruleId}|${uri}|${result.partialFingerprints?.primaryLocationLineHash ?? ""}`;
    current.add(fp);
    const owned = OWNED_PREFIXES.some((prefix) => uri.startsWith(prefix));
    if (!(severity >= 7.0) || !owned) continue; // High is 7.0 or above (plan 6.5)
    if (active.has(fp)) continue;
    if (matchAcceptedRisk(accepted, { tool: "codeql", fingerprint: fp }, today) === "suppressed")
      continue;
    blocking.push(fp);
  }
  const outcome: ScanOutcome =
    blocking.length === 0
      ? { verdict: "pass", reason: "no NEW High or Critical in owned code", blocking }
      : { verdict: "fail", reason: "NEW High or Critical in owned code", blocking };
  return { outcome, current };
}

export function evaluateCodeql(
  sarifPath: string,
  baseline: ReadonlySet<string>,
  accepted: readonly AcceptedRisk[] = [],
  today: string = new Date().toISOString().slice(0, 10),
): ScanOutcome {
  return scanCodeql(sarifPath, baseline, accepted, today).outcome;
}

// CLI: <sarif> <baseline.json> <ledger.json>. Prints verdict=pass|fail. A stale baseline entry fails.
function main(argv: readonly string[]): number {
  const [sarifPath, baselinePath, ledgerPath] = argv;
  if (sarifPath === undefined || baselinePath === undefined || ledgerPath === undefined) {
    console.error("usage: codeql-threshold.ts <sarif> <baseline.json> <ledger.json>");
    return 1;
  }
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const baseline: Baseline = loadBaseline(baselinePath, "codeql");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
    accepted_risks?: AcceptedRisk[];
  };
  const accepted = ledger.accepted_risks ?? [];
  const scan = scanCodeql(sarifPath, activeFingerprints(baseline, nowIso), accepted, today);
  const stale = scan.outcome.verdict === "pass" ? staleFingerprints(baseline, scan.current) : [];
  const verdict = scan.outcome.verdict === "pass" && stale.length === 0 ? "pass" : "fail";
  if (verdict === "fail")
    console.error(
      `codeql: ${scan.outcome.reason}${stale.length ? "; stale baseline entries" : ""}`,
    );
  console.log(`verdict=${verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
