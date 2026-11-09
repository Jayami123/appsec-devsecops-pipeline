// Summary aggregator (plan 5.9 rules 1-6). Reads toJSON(needs) and the registry; prints codeql_verdict and
// scanner_status for $GITHUB_OUTPUT, and a table for $GITHUB_STEP_SUMMARY when set.
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Verdict } from "./threshold-core.ts";

export interface NeedEntry {
  readonly result: string;
  readonly outputs?: Readonly<Record<string, string>>;
}
export type Needs = Readonly<Record<string, NeedEntry | undefined>>;
export type Registry = Readonly<Record<string, "stub" | "implemented">>;

export interface KeyJobs {
  readonly blocking: readonly string[];
  readonly report: readonly string[];
}

// Jobs that feed each registry key (plan 5.9 table). A key whose jobs are not in p5-scans.yml must stay stub.
export const KEY_JOBS: Readonly<Record<string, KeyJobs>> = {
  codeql: { blocking: ["codeql"], report: [] },
  gitleaks: { blocking: ["gitleaks"], report: ["gitleaks-forks"] },
  "osv-npm": { blocking: ["osv-npm"], report: ["osv-forks"] },
  trivy: { blocking: ["trivy"], report: ["trivy-upload", "trivy-images", "trivy-forks"] },
  syft: { blocking: [], report: ["syft"] },
  zizmor: { blocking: ["zizmor"], report: [] },
  zap: { blocking: [], report: [] },
};

function judge(needs: Needs, jobs: KeyJobs, reportJobs: ReadonlySet<string>): Verdict {
  const contributions: Verdict[] = [];
  for (const job of jobs.blocking) {
    const entry = needs[job];
    const verdict = entry?.outputs?.verdict;
    // Rule 2: only a successful job with a pass or fail verdict counts; any other result is fail.
    if (entry?.result === "success" && (verdict === "pass" || verdict === "fail")) {
      contributions.push(verdict);
    } else {
      contributions.push("fail");
    }
  }
  for (const job of jobs.report) {
    const entry = needs[job];
    if (entry === undefined) {
      contributions.push("fail"); // a missing job is never a pass
      continue;
    }
    // Rule 3: a skip is ignored only when it is policy (a report-only job); otherwise it is fail.
    if (entry.result === "skipped" && reportJobs.has(job)) continue;
    if (entry.result === "success") {
      const verdict = entry.outputs?.verdict;
      if (verdict === "pass" || verdict === "fail") contributions.push(verdict);
    } else {
      contributions.push("fail"); // rule 3: failure or cancelled
    }
  }
  if (contributions.includes("fail")) return "fail";
  return contributions.length > 0 ? "pass" : "fail"; // nothing judged: fail closed
}

// Syft is report-only policy (plan 5.9 rule 4, O-15): skipped when decide.report is false; when report is true
// and syft did not succeed, fail.
function syftVerdict(needs: Needs, jobs: KeyJobs, reportJobs: ReadonlySet<string>): Verdict {
  const report = needs["decide"]?.outputs?.["report"];
  if (report === "false") return "skipped";
  if (report === "true" && needs["syft"]?.result !== "success") return "fail";
  return judge(needs, jobs, reportJobs);
}

export function aggregate(
  needs: Needs,
  registry: Registry,
  reportJobs: ReadonlySet<string>,
): { codeqlVerdict: Verdict; scannerStatus: string } {
  const pairs: string[] = [];
  let codeqlVerdict: Verdict | undefined;
  for (const [key, state] of Object.entries(registry)) {
    const jobs = KEY_JOBS[key];
    if (jobs === undefined) throw new Error(`registry key '${key}' has no job mapping`);
    const verdict: Verdict =
      state === "stub"
        ? "not-implemented"
        : key === "syft"
          ? syftVerdict(needs, jobs, reportJobs)
          : judge(needs, jobs, reportJobs);
    if (key === "codeql") codeqlVerdict = verdict;
    pairs.push(`${key}=${verdict}`);
  }
  if (codeqlVerdict === undefined) throw new Error("registry has no codeql key");
  return { codeqlVerdict, scannerStatus: pairs.join(",") };
}

function main(): number {
  const needsRaw = process.env["NEEDS_JSON"];
  if (needsRaw === undefined) {
    console.error("aggregate: NEEDS_JSON is not set");
    return 1;
  }
  const needs = JSON.parse(needsRaw) as Needs;
  const registryPath = fileURLToPath(
    new URL("../../config/scan/implementation-status.json", import.meta.url),
  );
  const registry = JSON.parse(readFileSync(registryPath, "utf8")) as Registry;
  const reportJobs = new Set(Object.values(KEY_JOBS).flatMap((jobs) => jobs.report));
  const { codeqlVerdict, scannerStatus } = aggregate(needs, registry, reportJobs);
  console.log(`codeql_verdict=${codeqlVerdict}`);
  console.log(`scanner_status=${scannerStatus}`);
  const summary = process.env["GITHUB_STEP_SUMMARY"];
  if (summary !== undefined) {
    const rows = scannerStatus.split(",").map((pair) => {
      const [name, verdict] = pair.split("=");
      const shown =
        verdict === "not-implemented"
          ? "NOT IMPLEMENTED"
          : verdict === "skipped"
            ? "SKIPPED (report-only, not run on this event)"
            : (verdict ?? "").toUpperCase();
      return `| ${name ?? ""} | ${shown} |`;
    });
    appendFileSync(
      summary,
      ["### P5 scanners", "| scanner | verdict |", "| --- | --- |", ...rows, ""].join("\n"),
    );
  }
  return 0;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main();
}
