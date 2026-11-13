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
// The action writes rule references as { id, index, toolComponent: { index } } (rules grouped by pack).
interface SarifRuleRef {
  readonly id?: string;
  readonly index?: number;
  readonly toolComponent?: { readonly index?: number };
}
interface SarifResult {
  readonly ruleId?: string;
  readonly ruleIndex?: number;
  readonly rule?: SarifRuleRef;
  readonly locations?: readonly {
    readonly physicalLocation?: {
      readonly artifactLocation?: { readonly uri?: string };
      readonly region?: { readonly startLine?: number };
    };
  }[];
  readonly partialFingerprints?: { readonly primaryLocationLineHash?: string };
}
interface SarifRun {
  readonly invocations?: readonly { readonly executionSuccessful?: boolean }[];
  readonly tool: {
    readonly driver: { readonly rules?: readonly SarifRule[] };
    readonly extensions?: readonly { readonly rules?: readonly SarifRule[] }[];
  };
  readonly results?: readonly SarifResult[];
}
interface Sarif {
  readonly runs?: readonly SarifRun[];
}

export interface CodeqlScan {
  readonly outcome: ScanOutcome;
  readonly current: ReadonlySet<string>;
  // Diagnostic only: "rule uri line N" for each blocking alert. Never part of the verdict or the baseline.
  readonly alerts?: readonly string[];
}

// Resolves a result's rule. (a) rule.toolComponent.index picks an extension, then rule.index picks its rule;
// (b) rule.index or ruleIndex picks a driver rule. (a) and (b) are accepted only when the rule's id equals the
// result's ruleId. Otherwise (c) looks the id up across the driver and every extension. Undefined = unresolvable.
export function resolveRule(
  run: SarifRun,
  ruleId: string,
  result: SarifResult,
): SarifRule | undefined {
  const driverRules = run.tool.driver.rules ?? [];
  const extensions = run.tool.extensions ?? [];
  const ref = result.rule;
  const componentIndex = ref?.toolComponent?.index;
  if (typeof componentIndex === "number" && typeof ref?.index === "number") {
    const candidate = extensions[componentIndex]?.rules?.[ref.index];
    if (candidate !== undefined && candidate.id === ruleId) return candidate;
  }
  const direct = typeof ref?.index === "number" ? ref.index : result.ruleIndex;
  if (typeof direct === "number") {
    const candidate = driverRules[direct];
    if (candidate !== undefined && candidate.id === ruleId) return candidate;
  }
  return [...driverRules, ...extensions.flatMap((extension) => extension.rules ?? [])].find(
    (rule) => rule.id === ruleId,
  );
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
  const current = new Set<string>();
  const blocking: string[] = [];
  const alerts: string[] = [];
  for (const result of run.results ?? []) {
    const ruleId = result.ruleId ?? result.rule?.id ?? "";
    const uri = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "";
    const fp = `${ruleId}|${uri}|${result.partialFingerprints?.primaryLocationLineHash ?? ""}`;
    current.add(fp);
    const rule = resolveRule(run, ruleId, result);
    if (rule === undefined) {
      return { outcome: failClosed(`result rule not resolvable: ${ruleId}`), current };
    }
    const severity = Number(rule.properties?.["security-severity"]);
    const owned = OWNED_PREFIXES.some((prefix) => uri.startsWith(prefix));
    if (!(severity >= 7.0) || !owned) continue; // High is 7.0 or above (plan 6.5)
    if (active.has(fp)) continue;
    if (matchAcceptedRisk(accepted, { tool: "codeql", fingerprint: fp }, today) === "suppressed")
      continue;
    blocking.push(fp);
    const line = result.locations?.[0]?.physicalLocation?.region?.startLine;
    alerts.push(`${ruleId} ${uri} line ${line ?? "?"}`);
  }
  const outcome: ScanOutcome =
    blocking.length === 0
      ? { verdict: "pass", reason: "no NEW High or Critical in owned code", blocking }
      : { verdict: "fail", reason: "NEW High or Critical in owned code", blocking };
  return { outcome, current, alerts };
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
  for (const alert of scan.alerts ?? []) console.error(`codeql blocking alert: ${alert}`);
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
