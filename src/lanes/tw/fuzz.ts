// Schemathesis arguments for P5-TW-FUZZ-001. The tool is the hashed lock in requirements/schemathesis.txt
// (version 4.33.1, installed into a venv). The credential is never an argument: the hook module reads it
// from the environment (src/lanes/tw/schemathesis_hooks.py).
import { BUDGETS } from "../../security/budgets.ts";

/** The core OpenAPI document (ROUTE probed live: 200 with a key, 403 without). */
export const CORE_OPENAPI_PATH = "/rest/open-api/core";

/**
 * Stated scope (owner decision 3). The core document has 587 operations in 45 tags (13 each). This run covers five
 * tags, 65 operations, so it completes inside FUZZ_WALL_MIN. Out of scope: the other 40 tags (522 operations),
 * which the owner may extend in a later run once a budget for them is measured.
 */
export const FUZZ_INCLUDE_TAGS: readonly string[] = [
  "companies",
  "people",
  "opportunities",
  "tasks",
  "notes",
];
/** The phases run: examples and fuzzing. The coverage and stateful phases are out of scope for this row. */
export const FUZZ_PHASES = "examples,fuzzing";
/** A fixed seed makes a run repeatable. It is not a budget (basis: reproducibility of one scoped run). */
export const FUZZ_SEED = 20261111;

/** Oracle: no generated example may produce a server error. No --rate-limit: Twenty has no rate budget. */
export const FUZZ_CHECKS = "not_a_server_error";

export function schemathesisArgs(input: {
  readonly schemaFile: string;
  readonly baseUrl: string;
}): string[] {
  return [
    "run",
    input.schemaFile,
    "--url",
    input.baseUrl,
    "--checks",
    FUZZ_CHECKS,
    "--max-examples",
    String(BUDGETS.FUZZ_MAX_EXAMPLES.value),
    "--seed",
    String(FUZZ_SEED),
    "--phases",
    FUZZ_PHASES,
    ...FUZZ_INCLUDE_TAGS.flatMap((tag) => ["--include-tag", tag]),
  ];
}

/** The environment for the process: the bearer and the hook module, never an argument. */
export function schemathesisEnv(input: {
  readonly bearer: string;
  readonly hooksDir: string;
  readonly base: NodeJS.ProcessEnv;
}): NodeJS.ProcessEnv {
  return {
    ...input.base,
    P5_TW_FUZZ_BEARER: input.bearer,
    SCHEMATHESIS_HOOKS: "schemathesis_hooks",
    PYTHONPATH: input.hooksDir,
    PYTHONDONTWRITEBYTECODE: "1", // no __pycache__ in the repository
  };
}

/** The Schemathesis binary of the hashed venv. A missing value is a TEST BUG, never a guess. */
export function schemathesisBinary(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.P5_SCHEMATHESIS_BIN?.trim();
  if (value === undefined || value === "") {
    throw new Error(
      "TEST BUG: P5_SCHEMATHESIS_BIN is not set (the venv from requirements/schemathesis.txt)",
    );
  }
  return value;
}
