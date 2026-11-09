// OSV-Scanner verdict (plan 6.3). Root lockfile only; forks are report-only and never block.
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
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

export const ROOT_LOCKFILE = "package-lock.json";

// Owned-path rule (CONTRADICTS resolved, L3): source.path, made relative to the workspace root and written with
// forward slashes, must equal the root lockfile. osv-scanner 2.7.1 reports absolute paths; a relative path is used as is.
export function repoRelative(sourcePath: string, cwd: string): string {
  const rel = isAbsolute(sourcePath) ? relative(cwd, sourcePath) : sourcePath;
  return rel.replace(/\\/g, "/");
}

interface OsvVuln {
  readonly id?: string;
  readonly database_specific?: { readonly severity?: string };
  readonly affected?: readonly {
    readonly package?: { readonly name?: string };
    readonly ranges?: readonly { readonly events?: readonly Record<string, unknown>[] }[];
  }[];
}
interface OsvPackage {
  readonly package: { readonly name: string; readonly version: string };
  readonly vulnerabilities?: readonly OsvVuln[];
}
interface OsvDoc {
  readonly results?: readonly {
    readonly source: { readonly path: string };
    readonly packages?: readonly OsvPackage[];
  }[];
}

export interface OsvScan {
  readonly outcome: ScanOutcome;
  readonly current: ReadonlySet<string>;
}

// Fingerprint: id|package.name|package.version|source (plan 6.3), with the source made repo-relative.
export function scanOsv(
  jsonPath: string,
  exitCode: number,
  active: ReadonlySet<string>,
  cwd: string,
): OsvScan {
  const none: ReadonlySet<string> = new Set();
  if (exitCode !== 0 && exitCode !== 1)
    return { outcome: failClosed(`osv-scanner exit ${exitCode}`), current: none };
  let doc: OsvDoc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, "utf8")) as OsvDoc;
  } catch {
    return { outcome: failClosed("missing or unparseable osv-scanner report"), current: none };
  }
  const blocking: string[] = [];
  const current = new Set<string>();
  let findings = 0;
  for (const result of doc.results ?? []) {
    const rel = repoRelative(result.source.path, cwd);
    const owned = rel === ROOT_LOCKFILE;
    for (const pkg of result.packages ?? []) {
      for (const vuln of pkg.vulnerabilities ?? []) {
        findings += 1;
        const name = pkg.package.name;
        const fp = `${vuln.id ?? "unknown"}|${name}|${pkg.package.version}|${rel}`;
        current.add(fp);
        const severity = normalizeSeverity(vuln.database_specific?.severity);
        const fixed = (vuln.affected ?? [])
          .filter((a) => a.package === undefined || a.package.name === name)
          .some((a) => (a.ranges ?? []).some((r) => (r.events ?? []).some((e) => "fixed" in e)));
        const blocks = owned && (severity === "HIGH" || severity === "CRITICAL") && fixed;
        if (blocks && !active.has(fp)) blocking.push(fp);
      }
    }
  }
  if (exitCode === 1 && findings === 0) {
    return { outcome: failClosed("osv-scanner exit 1 with no findings in the report"), current };
  }
  const outcome: ScanOutcome =
    blocking.length === 0
      ? {
          verdict: "pass",
          reason: "no NEW HIGH or CRITICAL with a fix in the root lockfile",
          blocking,
        }
      : {
          verdict: "fail",
          reason: "NEW HIGH or CRITICAL with a fix in the root lockfile",
          blocking,
        };
  return { outcome, current };
}

export function evaluateOsv(
  jsonPath: string,
  exitCode: number,
  active: ReadonlySet<string>,
  cwd: string = process.cwd(),
): ScanOutcome {
  return scanOsv(jsonPath, exitCode, active, cwd).outcome;
}

// CLI: <report.json> <exit> <baseline.json> [cwd]. Prints verdict=pass|fail. A stale baseline entry fails.
function main(argv: readonly string[]): number {
  const [jsonPath, exitRaw, baselinePath, cwdArg] = argv;
  if (jsonPath === undefined || exitRaw === undefined || baselinePath === undefined) {
    console.error("usage: osv-threshold.ts <report.json> <exit> <baseline.json> [cwd]");
    return 1;
  }
  const nowIso = new Date().toISOString();
  const baseline: Baseline = loadBaseline(baselinePath, "osv");
  const cwd = cwdArg ?? process.cwd();
  const scan = scanOsv(jsonPath, Number(exitRaw), activeFingerprints(baseline, nowIso), cwd);
  const stale = scan.outcome.verdict === "fail" ? [] : staleFingerprints(baseline, scan.current);
  const verdict = scan.outcome.verdict === "pass" && stale.length === 0 ? "pass" : "fail";
  if (verdict === "fail")
    console.error(`osv: ${scan.outcome.reason}${stale.length ? "; stale baseline entries" : ""}`);
  console.log(`verdict=${verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
