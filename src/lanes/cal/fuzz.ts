// Pure Schemathesis argv for PN-2 (D-CAL-B40). No credential in argv or on disk: the run is
// unauthenticated (schemathesis 4.33.1 has no environment header input; a config file would store a
// secret). The CLI option names were checked at 4.33.1: --max-examples (-n), --checks, --report.
export interface SchemathesisInput {
  readonly schemaPath: string;
  readonly baseUrl: string;
  readonly maxExamples: number;
}

export function schemathesisArgs(input: SchemathesisInput): string[] {
  return [
    "run",
    input.schemaPath,
    "--url",
    input.baseUrl,
    "--max-examples",
    String(input.maxExamples),
    "--checks",
    "not_a_server_error",
    "--suppress-health-check",
    "too_slow",
  ];
}
