// Pure argument builder for the Schemathesis run (FUZZ-001). The publishable key is never an argument:
// the caller passes it in a header at spawn time (med plan 2f; D-MED-B3 read-only operations).

export interface SchemathesisArgsInput {
  readonly schemaPath: string;
  readonly baseUrl: string;
  readonly maxExamples: number;
  /** Wall-clock budget for the whole run, in seconds (`--max-time`, schemathesis 4.33.1). */
  readonly maxTimeSeconds: number;
  /** Read-only: only GET operations are included (`--include-method GET`, schemathesis 4.33.1). */
  readonly readOnly: true;
  /** Fixed generator seed (`--seed`, schemathesis 4.33.1) so the same inputs are generated on every run (B30). */
  readonly seed: number;
  /** Structured run report (`--report-json-path`): run-level summary. */
  readonly reportJsonPath: string;
  /** Event stream (`--report-ndjson-path`): per-case status codes, read back by the baseline comparison. */
  readonly reportNdjsonPath: string;
}

/** Argument vector for `schemathesis run`. Spawned without a shell. */
export function schemathesisArgs(input: SchemathesisArgsInput): string[] {
  if (!Number.isInteger(input.maxExamples) || input.maxExamples < 1) {
    throw new Error("TEST BUG: maxExamples must be a positive integer");
  }
  if (!Number.isInteger(input.maxTimeSeconds) || input.maxTimeSeconds < 1) {
    throw new Error("TEST BUG: maxTimeSeconds must be a positive integer");
  }
  return [
    "run",
    input.schemaPath,
    "--url",
    input.baseUrl,
    "--include-method",
    "GET",
    "--max-examples",
    String(input.maxExamples),
    "--max-time",
    String(input.maxTimeSeconds),
    "--checks",
    "not_a_server_error",
    "--seed",
    String(input.seed),
    "--report-json-path",
    input.reportJsonPath,
    "--report-ndjson-path",
    input.reportNdjsonPath,
  ];
}
