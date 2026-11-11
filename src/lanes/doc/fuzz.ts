// Pure argument builder for the Schemathesis run (PN-3). The token is NOT part of these arguments: the spec
// adds the Authorization header at spawn time (D-DOC-B6), so the args returned here never hold a credential.
export interface SchemathesisInput {
  readonly schemaPath: string;
  readonly baseUrl: string;
  readonly maxExamples: number;
  /** The "<value>/<window>" string from rateLimitArg. */
  readonly rateLimit: string;
  /** Exact operation paths to skip (the CLI's --exclude-path). Empty when no OAS path reaches a limited route. */
  readonly excludePaths?: readonly string[];
}

/**
 * `--rate-limit <value>/<window>` with the window in Schemathesis duration units. Schemathesis 4.33.1 takes
 * `<limit>/<duration>` (e.g. `100/m`, `schemathesis run --help`). Only a one-minute window is accepted here,
 * because the OAS paths reach apiV2RateLimit at 1 minute (rate-limits.ts:103-107).
 */
export function rateLimitArg(value: number, windowMinutes: number): string {
  if (!Number.isInteger(value) || value < 1)
    throw new Error("TEST BUG: rate limit value must be a positive integer");
  if (windowMinutes !== 1)
    throw new Error("TEST BUG: only a one-minute window is supported (rate-limits.ts:103-107)");
  return `${value}/m`;
}

export function schemathesisArgs(input: SchemathesisInput): string[] {
  const args = [
    "run",
    input.schemaPath,
    "--url",
    input.baseUrl,
    "--max-examples",
    String(input.maxExamples),
    "--rate-limit",
    input.rateLimit,
  ];
  args.push("--no-color");
  for (const path of input.excludePaths ?? []) {
    args.push("--exclude-path", path);
  }
  return args;
}

/**
 * The environment for the Schemathesis process (D-DOC-B34). The session cookie travels here and is read by
 * doc_schemathesis_hooks.py (SCHEMATHESIS_HOOKS); it never appears in the argument list.
 */
export function schemathesisEnv(input: {
  readonly cookie: string;
  readonly hooksDir: string;
  readonly base: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  return {
    ...input.base,
    P5_DOC_FUZZ_COOKIE: input.cookie,
    SCHEMATHESIS_HOOKS: "doc_schemathesis_hooks",
    PYTHONPATH: input.hooksDir,
    PYTHONDONTWRITEBYTECODE: "1",
  };
}
