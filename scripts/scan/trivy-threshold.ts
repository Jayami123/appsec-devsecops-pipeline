// Trivy verdict (plan 6.2). Root mode blocks; report mode (image and fork JSON) never blocks, only tool errors fail.
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

export const ROOT_TARGET = "package-lock.json";

interface TrivyVuln {
  readonly VulnerabilityID?: string;
  readonly PkgName?: string;
  readonly InstalledVersion?: string;
  readonly FixedVersion?: string;
  readonly Severity?: string;
}
interface TrivyDoc {
  readonly Results?: readonly {
    readonly Target?: string;
    readonly Vulnerabilities?: readonly TrivyVuln[];
  }[];
}

export interface TrivyScan {
  readonly outcome: ScanOutcome;
  readonly current: ReadonlySet<string>;
}

// Fingerprint: VulnerabilityID|PkgName|InstalledVersion|Target (plan 6.2).
export function scanTrivy(
  jsonPath: string,
  mode: "root" | "report",
  active: ReadonlySet<string>,
): TrivyScan {
  const none: ReadonlySet<string> = new Set();
  let doc: TrivyDoc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, "utf8")) as TrivyDoc;
  } catch {
    return { outcome: failClosed("missing or unparseable trivy report"), current: none };
  }
  const current = new Set<string>();
  const blocking: string[] = [];
  for (const result of doc.Results ?? []) {
    const target = result.Target ?? "";
    for (const vuln of result.Vulnerabilities ?? []) {
      const fp = `${vuln.VulnerabilityID ?? "unknown"}|${vuln.PkgName ?? ""}|${vuln.InstalledVersion ?? ""}|${target}`;
      current.add(fp);
      if (mode !== "root") continue; // report-only: findings never block
      const severity = normalizeSeverity(vuln.Severity);
      const owned = target === ROOT_TARGET;
      const fixed = (vuln.FixedVersion ?? "") !== "";
      const blocks = owned && (severity === "HIGH" || severity === "CRITICAL") && fixed;
      if (blocks && !active.has(fp)) blocking.push(fp);
    }
  }
  if (mode !== "root") {
    return {
      outcome: { verdict: "pass", reason: "report-only: findings do not block", blocking: [] },
      current,
    };
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

export function evaluateTrivy(
  jsonPath: string,
  mode: "root" | "report",
  active: ReadonlySet<string>,
): ScanOutcome {
  return scanTrivy(jsonPath, mode, active).outcome;
}

// CLI: <report.json> <root|report> <baseline.json>. Prints verdict=pass|fail. A stale baseline entry fails root mode.
function main(argv: readonly string[]): number {
  const [jsonPath, mode, baselinePath] = argv;
  if (
    jsonPath === undefined ||
    baselinePath === undefined ||
    (mode !== "root" && mode !== "report")
  ) {
    console.error("usage: trivy-threshold.ts <report.json> <root|report> <baseline.json>");
    return 1;
  }
  const nowIso = new Date().toISOString();
  const baseline: Baseline = loadBaseline(baselinePath, "trivy");
  const scan = scanTrivy(jsonPath, mode, activeFingerprints(baseline, nowIso));
  const stale =
    mode === "root" && scan.outcome.verdict === "pass"
      ? staleFingerprints(baseline, scan.current)
      : [];
  const verdict = scan.outcome.verdict === "pass" && stale.length === 0 ? "pass" : "fail";
  if (verdict === "fail")
    console.error(`trivy: ${scan.outcome.reason}${stale.length ? "; stale baseline entries" : ""}`);
  console.log(`verdict=${verdict}`);
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
