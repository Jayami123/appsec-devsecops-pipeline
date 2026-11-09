// npm audit verdict (plan 6.4). A D5 cross-check on the root lockfile only. Fingerprints key on the advisory:
// every via list is collected (direct objects and the objects reached through via strings), so one advisory
// reached from ten packages is one fingerprint and two advisories on one package are two.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activeFingerprints,
  type Baseline,
  failClosed,
  loadBaseline,
  normalizeSeverity,
  type ScanOutcome,
  staleFingerprints,
} from "./threshold-core.ts";

interface AuditAdvisory {
  readonly source?: number | string;
  readonly range?: string;
  readonly severity?: string;
}
interface AuditEntry {
  readonly via?: readonly (string | AuditAdvisory)[];
  readonly fixAvailable?: unknown;
}
interface AuditDoc {
  readonly error?: unknown;
  readonly vulnerabilities?: Readonly<Record<string, AuditEntry>>;
}

// Collects every advisory object reachable from an entry: the objects in its own via list, plus the objects
// reached through via strings (each string names another entry). Cycle-safe: each entry is visited once.
function collectAdvisories(
  name: string,
  vulns: Readonly<Record<string, AuditEntry>>,
  seen: Set<string>,
): AuditAdvisory[] {
  const found: AuditAdvisory[] = [];
  for (const via of vulns[name]?.via ?? []) {
    if (typeof via !== "string") {
      found.push(via);
    } else if (!seen.has(via)) {
      seen.add(via);
      found.push(...collectAdvisories(via, vulns, seen));
    }
  }
  return found;
}

export interface NpmScan {
  readonly outcome: ScanOutcome;
  readonly current: ReadonlySet<string>;
}

export function scanNpmAudit(jsonPath: string, active: ReadonlySet<string>): NpmScan {
  const none: ReadonlySet<string> = new Set();
  let doc: AuditDoc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, "utf8")) as AuditDoc;
  } catch {
    return { outcome: failClosed("missing or unparseable npm audit report"), current: none };
  }
  if (doc.error !== undefined || doc.vulnerabilities === undefined) {
    return {
      outcome: failClosed("npm audit report has an error or no vulnerabilities object"),
      current: none,
    };
  }
  const vulns = doc.vulnerabilities;
  const current = new Set<string>();
  const blocking: string[] = [];
  for (const name of Object.keys(vulns)) {
    const advisories = collectAdvisories(name, vulns, new Set([name]));
    if (advisories.length === 0) {
      return { outcome: failClosed(`npm audit: '${name}' has no advisory object`), current };
    }
    const fixAvailable = Boolean(vulns[name]?.fixAvailable);
    for (const advisory of advisories) {
      const fp = `${String(advisory.source)}|${String(advisory.range)}`;
      current.add(fp);
      const severity = normalizeSeverity(advisory.severity);
      if (!active.has(fp) && (severity === "HIGH" || severity === "CRITICAL") && fixAvailable)
        blocking.push(fp);
    }
  }
  const outcome: ScanOutcome =
    blocking.length === 0
      ? { verdict: "pass", reason: "no NEW HIGH or CRITICAL advisory with a fix", blocking }
      : { verdict: "fail", reason: "NEW HIGH or CRITICAL advisory with a fix", blocking };
  return { outcome, current };
}

export function evaluateNpmAudit(jsonPath: string, active: ReadonlySet<string>): ScanOutcome {
  return scanNpmAudit(jsonPath, active).outcome;
}

// CLI: <audit.json> <baseline.json>. Prints verdict=pass|fail. A stale baseline entry fails.
function main(argv: readonly string[]): number {
  const [jsonPath, baselinePath] = argv;
  if (jsonPath === undefined || baselinePath === undefined) {
    console.error("usage: npm-threshold.ts <audit.json> <baseline.json>");
    return 1;
  }
  const nowIso = new Date().toISOString();
  const baseline: Baseline = loadBaseline(baselinePath, "npm-audit");
  const scan = scanNpmAudit(jsonPath, activeFingerprints(baseline, nowIso));
  const stale = scan.outcome.verdict === "fail" ? [] : staleFingerprints(baseline, scan.current);
  const verdict = scan.outcome.verdict === "pass" && stale.length === 0 ? "pass" : "fail";
  if (verdict === "fail")
    console.error(
      `npm-audit: ${scan.outcome.reason}${stale.length ? "; stale baseline entries" : ""}`,
    );
  console.log(`verdict=${verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
