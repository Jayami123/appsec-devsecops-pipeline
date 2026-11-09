import { readFileSync } from "node:fs";

// Verdict contract for every L-PIPE scanner (MP:763, MP:767-771). Plan 5.12.
export type Verdict = "pass" | "fail" | "not-implemented" | "skipped"; // "skipped" only for REPORT_ONLY_KEYS (section 5.9)
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export interface ScanOutcome {
  readonly verdict: Verdict;
  readonly reason: string;
  readonly blocking: readonly string[]; // fingerprints only; never message or match text
}

export function normalizeSeverity(raw: string | undefined): Severity {
  switch ((raw ?? "").toUpperCase()) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
    case "MODERATE": // OSV says MODERATE; Trivy says MEDIUM (probe 2b)
      return "MEDIUM";
    case "LOW":
      return "LOW";
    default:
      return "UNKNOWN";
  }
}

export function failClosed(reason: string): ScanOutcome {
  return { verdict: "fail", reason, blocking: [] };
}

// An expired baseline or accepted-risk entry counts as NEW (MP:698).
export function isExpired(expiresIso: string, nowIso: string): boolean {
  return Date.parse(expiresIso) < Date.parse(nowIso);
}

// Baselines (plan 7.1). An entry is NEW again once it expires; an entry that matches no current result is stale.
export const BASELINE_ENTRY_KEYS: readonly string[] = [
  "fingerprint",
  "ruleId",
  "path",
  "justification",
  "owner",
  "reviewRef",
  "addedOn",
  "expires",
];
const DAY_MS = 86_400_000;

export interface BaselineEntry {
  readonly fingerprint: string;
  readonly ruleId: string;
  readonly path: string;
  readonly justification: string;
  readonly owner: string;
  readonly reviewRef: string;
  readonly addedOn: string;
  readonly expires: string;
}
export interface Baseline {
  readonly schema: 1;
  readonly tool: string;
  readonly entries: readonly BaselineEntry[];
}

// Throws on an unknown key, a missing field, a wrong tool, or an expiry more than 90 days after addedOn.
export function parseBaseline(text: string, tool: string): Baseline {
  const doc = JSON.parse(text) as Record<string, unknown>;
  for (const key of Object.keys(doc)) {
    if (!["schema", "tool", "entries"].includes(key))
      throw new Error(`baseline: unknown key '${key}'`);
  }
  if (doc["schema"] !== 1) throw new Error("baseline: schema must be 1");
  if (doc["tool"] !== tool) throw new Error(`baseline: tool must be '${tool}'`);
  if (!Array.isArray(doc["entries"])) throw new Error("baseline: entries must be an array");
  const entries: BaselineEntry[] = [];
  for (const raw of doc["entries"] as unknown[]) {
    const entry = raw as Record<string, unknown>;
    for (const key of Object.keys(entry)) {
      if (!BASELINE_ENTRY_KEYS.includes(key))
        throw new Error(`baseline: unknown entry key '${key}'`);
    }
    for (const key of BASELINE_ENTRY_KEYS) {
      if (typeof entry[key] !== "string" || entry[key] === "")
        throw new Error(`baseline: entry is missing ${key}`);
    }
    const addedOn = Date.parse(String(entry["addedOn"]));
    const expires = Date.parse(String(entry["expires"]));
    if (Number.isNaN(addedOn) || Number.isNaN(expires))
      throw new Error("baseline: addedOn or expires is not a date");
    if (expires - addedOn > 90 * DAY_MS)
      throw new Error("baseline: expires is more than 90 days after addedOn");
    entries.push(entry as unknown as BaselineEntry);
  }
  return { schema: 1, tool, entries };
}

export function loadBaseline(path: string, tool: string): Baseline {
  return parseBaseline(readFileSync(path, "utf8"), tool);
}

// Fingerprints that still suppress a finding: expired entries count as NEW and are left out.
export function activeFingerprints(baseline: Baseline, nowIso: string): Set<string> {
  return new Set(
    baseline.entries.filter((e) => !isExpired(e.expires, nowIso)).map((e) => e.fingerprint),
  );
}

// Entries that match no current result. A stale entry fails the tool until it is removed (NEW-PIPE-3).
export function staleFingerprints(baseline: Baseline, current: ReadonlySet<string>): string[] {
  return baseline.entries.map((e) => e.fingerprint).filter((fp) => !current.has(fp));
}
