// Shared helpers for the L-PIPE scan tests (plan 5.11). Secret-like values are built at runtime in scratch
// directories; no committed file holds a token in final form. Downloads go through scripts/scan/fetch-tool.sh,
// which checksum-verifies the pinned archive before it runs anything.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

export function scratch(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `p5-${prefix}-`));
}

export function writeTree(root: string, files: Readonly<Record<string, string>>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
}

// A rule-matching line built from parts at runtime (the generic-api-key shape used by the L2 probes).
export function syntheticApiLine(): string {
  return "key=" + ["api", "_", "9f8e7d6c5b4a3210zz"].join("");
}

let cachedGitleaks: string | undefined;

// Installs the pinned gitleaks into a scratch directory (checksum verified) and returns its path.
export function gitleaksBinary(): string {
  if (cachedGitleaks !== undefined) return cachedGitleaks;
  const out = execFileSync("bash", [join(REPO, "scripts/scan/fetch-tool.sh"), "gitleaks"], {
    env: { ...process.env, SCAN_TOOLS_DIR: join(scratch("tools"), "tools") },
    encoding: "utf8",
  });
  cachedGitleaks = out.trim().split("\n").at(-1) ?? "";
  return cachedGitleaks;
}

export interface GitleaksRun {
  readonly exit: number;
  readonly findings: readonly {
    readonly RuleID: string;
    readonly File: string;
    readonly StartLine: number;
  }[];
}

// Runs `gitleaks dir . --config <config> --exit-code 2` in cwd, the same command the workflow runs.
export function runGitleaksDir(cwd: string, config: string): GitleaksRun {
  const report = join(scratch("report"), "report.json");
  const result = spawnSync(
    gitleaksBinary(),
    [
      "dir",
      ".",
      "--config",
      config,
      "--no-banner",
      "--redact",
      "-f",
      "json",
      "-r",
      report,
      "--exit-code",
      "2",
    ],
    { cwd, encoding: "utf8" },
  );
  const findings = existsSync(report)
    ? ((JSON.parse(readFileSync(report, "utf8")) as GitleaksRun["findings"] | null) ?? [])
    : [];
  return { exit: result.status ?? -1, findings };
}

export const REPO_CONFIG = join(REPO, "config/scan/gitleaks.toml");
