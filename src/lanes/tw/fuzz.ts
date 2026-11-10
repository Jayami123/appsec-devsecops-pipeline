// Schemathesis arguments for P5-TW-FUZZ-001. The tool is the hashed lock in requirements/schemathesis.txt
// (version 4.33.1, installed into a venv). The credential is never an argument: the hook module reads it
// from the environment (src/lanes/tw/schemathesis_hooks.py).
import { BUDGETS } from "../../security/budgets.ts";

/** The core OpenAPI document (ROUTE probed live: 200 with a key, 403 without). */
export const CORE_OPENAPI_PATH = "/rest/open-api/core";

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
