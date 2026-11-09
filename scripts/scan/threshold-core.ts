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
