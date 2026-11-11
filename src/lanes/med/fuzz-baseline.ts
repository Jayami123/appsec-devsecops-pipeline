// FUZZ-001 baseline comparison (owner decision B30). Pure: no I/O, no Playwright import.
// A failure is identified by operation (the Schemathesis recorder label, e.g. "GET /store/regions"), check
// name (e.g. "not_a_server_error") and the response status code. The negative title fails on any failure not
// in the committed baseline, and annotates baseline entries that were not seen in this run.

export interface FuzzFailure {
  readonly operation: string;
  readonly check: string;
  readonly status: number | null;
}

export interface Baseline {
  readonly schema: "p5-med-fuzz-baseline/1";
  readonly recordedRun: string;
  readonly recordedDate: string;
  readonly seed: number;
  readonly maxExamples: number;
  readonly maxTimeSeconds: number;
  readonly entries: readonly FuzzFailure[];
}

export function failureKey(failure: FuzzFailure): string {
  return `${failure.operation}\u0000${failure.check}\u0000${failure.status === null ? "none" : String(failure.status)}`;
}

/**
 * Failing checks from a Schemathesis NDJSON event stream (`--report-ndjson-path`). A `ScenarioFinished` event
 * carries `recorder.label`, per-case `recorder.checks` (name and status) and per-case `recorder.interactions`
 * (the response status code). Only failing or erroring checks are returned, de-duplicated and sorted.
 */
export function parseFuzzFailures(ndjson: string): FuzzFailure[] {
  const found = new Map<string, FuzzFailure>();
  for (const line of ndjson.split("\n")) {
    if (line.trim() === "") continue;
    const event = JSON.parse(line) as Record<string, unknown>;
    const finished = event.ScenarioFinished as
      | {
          recorder?: {
            label?: unknown;
            checks?: Record<string, { name?: unknown; status?: unknown }[]>;
            interactions?: Record<string, { response?: { status_code?: unknown } }>;
          };
        }
      | undefined;
    const recorder = finished?.recorder;
    if (recorder === undefined || typeof recorder.label !== "string") continue;
    for (const [caseId, checks] of Object.entries(recorder.checks ?? {})) {
      for (const check of checks) {
        if (check.status !== "failure" && check.status !== "error") continue;
        const code = recorder.interactions?.[caseId]?.response?.status_code;
        const failure: FuzzFailure = {
          operation: recorder.label,
          check: typeof check.name === "string" ? check.name : "unknown",
          status: typeof code === "number" ? code : null,
        };
        found.set(failureKey(failure), failure);
      }
    }
  }
  return [...found.values()].sort((a, b) => failureKey(a).localeCompare(failureKey(b)));
}

/** Observed failures not in the baseline (fail), and baseline entries not observed in this run (annotate only). */
export function compareToBaseline(
  observed: readonly FuzzFailure[],
  baseline: readonly FuzzFailure[],
): { unexpected: FuzzFailure[]; stale: FuzzFailure[] } {
  const baselineKeys = new Set(baseline.map(failureKey));
  const observedKeys = new Set(observed.map(failureKey));
  return {
    unexpected: observed.filter((failure) => !baselineKeys.has(failureKey(failure))),
    stale: baseline.filter((failure) => !observedKeys.has(failureKey(failure))),
  };
}

/** Strict loader for the committed baseline file. Throws on any shape it does not recognise. */
export function loadBaseline(raw: unknown): Baseline {
  if (typeof raw !== "object" || raw === null) throw new Error("fuzz baseline: not an object");
  const doc = raw as Record<string, unknown>;
  if (doc.schema !== "p5-med-fuzz-baseline/1") throw new Error("fuzz baseline: unknown schema");
  for (const key of ["recordedRun", "recordedDate"] as const) {
    if (typeof doc[key] !== "string" || doc[key] === "")
      throw new Error(`fuzz baseline: ${key} missing`);
  }
  for (const key of ["seed", "maxExamples", "maxTimeSeconds"] as const) {
    if (typeof doc[key] !== "number" || !Number.isInteger(doc[key]))
      throw new Error(`fuzz baseline: ${key} not an integer`);
  }
  if (!Array.isArray(doc.entries)) throw new Error("fuzz baseline: entries missing");
  const entries = doc.entries.map((entry: unknown, index: number): FuzzFailure => {
    const e = entry as Record<string, unknown>;
    if (typeof e.operation !== "string" || typeof e.check !== "string") {
      throw new Error(`fuzz baseline: entry ${index} needs operation and check`);
    }
    if (e.status !== null && (typeof e.status !== "number" || !Number.isInteger(e.status))) {
      throw new Error(`fuzz baseline: entry ${index} status must be an integer or null`);
    }
    return { operation: e.operation, check: e.check, status: e.status };
  });
  return {
    schema: "p5-med-fuzz-baseline/1",
    recordedRun: doc.recordedRun as string,
    recordedDate: doc.recordedDate as string,
    seed: doc.seed as number,
    maxExamples: doc.maxExamples as number,
    maxTimeSeconds: doc.maxTimeSeconds as number,
    entries,
  };
}
