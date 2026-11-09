// npm audit verdict (plan 6.4). A D5 cross-check on the root lockfile only. Fingerprints key on the advisory:
// every via chain (strings that point at another entry) is followed to the advisory object, so one advisory
// reached from ten packages is one fingerprint.
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

// Follows a via chain to its advisory object. An unresolvable chain returns undefined (fail closed).
function resolveAdvisory(
  name: string,
  vulns: Readonly<Record<string, AuditEntry>>,
  seen: Set<string>,
): AuditAdvisory | undefined {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const entry = vulns[name];
  for (const via of entry?.via ?? []) {
    if (typeof via === "string") {
      const found = resolveAdvisory(via, vulns, seen);
      if (found !== undefined) return found;
    } else {
      return via;
    }
  }
  return undefined;
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
    const advisory = resolveAdvisory(name, vulns, new Set());
    if (advisory === undefined) {
      return { outcome: failClosed(`npm audit: '${name}' has no advisory object`), current };
    }
    const fp = `${String(advisory.source)}|${String(advisory.range)}`;
    current.add(fp);
    const severity = normalizeSeverity(advisory.severity);
    const fixAvailable = Boolean(vulns[name]?.fixAvailable);
    if (!active.has(fp) && (severity === "HIGH" || severity === "CRITICAL") && fixAvailable)
      blocking.push(fp);
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
