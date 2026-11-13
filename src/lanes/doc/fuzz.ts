// Pure argument builder and ST101 baseline helpers for the Schemathesis run (PN-3).
// The token is NOT part of these arguments: the spec adds the session through the environment
// (D-DOC-B34), so the args returned here never hold a credential.
export interface SchemathesisInput {
  readonly schemaPath: string;
  readonly baseUrl: string;
  readonly maxExamples: number;
  /** The "<value>/<window>" string from rateLimitArg. */
  readonly rateLimit: string;
  /** Fixed Schemathesis seed (D-DOC-B61). */
  readonly seed: number;
  /** Exact operation paths to skip (the CLI's --exclude-path). Empty when no OAS path reaches a limited route. */
  readonly excludePaths?: readonly string[];
}

/** Committed seed for PN-3. Changing it is a new baseline, not a silent reroll. */
export const FUZZ_SEED = 1;

export interface FuzzFinding {
  readonly operation: string;
  readonly errorType: string;
}

export interface FuzzBaseline {
  readonly schema: 1;
  readonly seed: number;
  readonly entries: readonly FuzzFinding[];
}

export interface FuzzCompare {
  readonly novel: readonly FuzzFinding[];
  readonly stale: readonly FuzzFinding[];
}

/**
 * `--rate-limit <value>/<window>` with the window in Schemathesis duration units. Schemathesis 4.33.1 takes
 * `<limit>/<duration>` (e.g. `100/m`, `schemathesis run --help`). Only a one-minute window is accepted here,
 * because the OAS paths reach apiV2RateLimit at 1 minute (fork ref held by the owner).
 */
export function rateLimitArg(value: number, windowMinutes: number): string {
  if (!Number.isInteger(value) || value < 1)
    throw new Error("TEST BUG: rate limit value must be a positive integer");
  if (windowMinutes !== 1)
    throw new Error("TEST BUG: only a one-minute window is supported (fork ref held by the owner)");
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
    "--seed",
    String(input.seed),
    "--no-color",
  ];
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

export function fuzzFingerprint(finding: FuzzFinding): string {
  return `${finding.operation}|${finding.errorType}`;
}

/**
 * ST101 findings from Schemathesis text output. The operation is the tRPC path in the JSON body
 * (`data.path`). Duplicate fingerprints are dropped. Pure.
 */
export function parseFuzzFindings(plain: string): FuzzFinding[] {
  const out: FuzzFinding[] = [];
  const seen = new Set<string>();
  const st101 = /ST101\b[\s\S]{0,400}?"path"\s*:\s*"([A-Za-z][A-Za-z0-9.]+)"/g;
  for (const match of plain.matchAll(st101)) {
    const operation = match[1];
    if (operation === undefined) continue;
    const finding: FuzzFinding = { operation, errorType: "ST101" };
    const fp = fuzzFingerprint(finding);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(finding);
  }
  return out;
}

/** Parses the committed PN-3 baseline. Throws TEST BUG on a malformed document. Pure. */
export function parseFuzzBaseline(text: string): FuzzBaseline {
  const raw: unknown = JSON.parse(text);
  if (typeof raw !== "object" || raw === null)
    throw new Error("TEST BUG: fuzz baseline is not an object");
  const doc = raw as Record<string, unknown>;
  if (doc.schema !== 1) throw new Error("TEST BUG: fuzz baseline schema must be 1");
  if (typeof doc.seed !== "number" || !Number.isInteger(doc.seed))
    throw new Error("TEST BUG: fuzz baseline seed must be an integer");
  if (!Array.isArray(doc.entries))
    throw new Error("TEST BUG: fuzz baseline entries must be an array");
  const entries: FuzzFinding[] = [];
  for (const item of doc.entries) {
    if (typeof item !== "object" || item === null)
      throw new Error("TEST BUG: fuzz baseline entry is not an object");
    const row = item as Record<string, unknown>;
    if (typeof row.operation !== "string" || row.operation.length === 0)
      throw new Error("TEST BUG: fuzz baseline entry needs operation");
    if (typeof row.errorType !== "string" || row.errorType.length === 0)
      throw new Error("TEST BUG: fuzz baseline entry needs errorType");
    entries.push({ operation: row.operation, errorType: row.errorType });
  }
  return { schema: 1, seed: doc.seed, entries };
}

/** Novel = in the run and not in the baseline (fail). Stale = in the baseline and not in the run (annotate). */
export function compareFuzzBaseline(
  current: readonly FuzzFinding[],
  baseline: readonly FuzzFinding[],
): FuzzCompare {
  const baseSet = new Set(baseline.map(fuzzFingerprint));
  const currentSet = new Set(current.map(fuzzFingerprint));
  return {
    novel: current.filter((f) => !baseSet.has(fuzzFingerprint(f))),
    stale: baseline.filter((f) => !currentSet.has(fuzzFingerprint(f))),
  };
}
