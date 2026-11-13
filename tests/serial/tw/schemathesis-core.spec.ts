// P5-TW-FUZZ-001 (tw-serial). Gate lifted (D-TW-B9): GET /rest/open-api/core with a
// throwaway key returned 200 application/json on the stack (403 without a key). The control is that read.
// The negative runs Schemathesis (pinned lock, requirements/schemathesis.txt) on the core document, with
// FUZZ_MAX_EXAMPLES (examples) and FUZZ_WALL_MIN (wall clock) by name. The oracle: no 5xx.
// The bearer reaches Schemathesis through the environment (src/lanes/tw/schemathesis_hooks.py), never argv.
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { createApiKey, restStatus, revokeApiKey } from "../../../src/lanes/tw/keys.ts";
import {
  CORE_OPENAPI_PATH,
  schemathesisArgs,
  schemathesisBinary,
  schemathesisEnv,
} from "../../../src/lanes/tw/fuzz.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";

const execute = promisify(execFile);
const HOOKS_DIR = fileURLToPath(new URL("../../../src/lanes/tw", import.meta.url));

/** Runs Schemathesis. Returns the exit code and a count summary only (the output can echo headers). */
async function runSchemathesis(input: {
  readonly args: string[];
  readonly bearer: string;
  /** Working directory of the process (a temporary directory: Schemathesis writes a cache there). */
  readonly cwd: string;
}): Promise<{ readonly exitCode: number; readonly summary: string }> {
  const env = schemathesisEnv({ bearer: input.bearer, hooksDir: HOOKS_DIR, base: process.env });
  const counts = (text: string): string =>
    text
      .split("\n")
      .filter((line) => /passed|failed|error/i.test(line) && !/bearer|authorization/i.test(line))
      .slice(-3)
      .join(" | ");
  try {
    const result = await execute(schemathesisBinary(), input.args, {
      cwd: input.cwd,
      env,
      timeout: BUDGETS.FUZZ_WALL_MIN.value * 60_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { exitCode: 0, summary: counts(result.stdout) };
  } catch (error) {
    const failure = error as { code?: number | string; killed?: boolean; stdout?: string };
    if (failure.killed === true) return { exitCode: -1, summary: "wall-clock budget reached" };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : -1,
      summary: counts(failure.stdout ?? ""),
    };
  }
}

test("P5-TW-FUZZ-001 control: a valid core OpenAPI read returns 2xx", async ({ run: scope }) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const key = await createApiKey({ baseUrl: base, session: admin, name: `${scope.prefix}-fuzz` });
  let revoked = false;
  scope.onCleanup(async () => {
    if (!revoked) await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  });
  scope.trackLeak({
    label: `api key ${key.id}`,
    stillPresent: async () =>
      (await restStatus({ baseUrl: base, path: "/rest/companies?limit=1", bearer: key.secret })) ===
      200,
  });
  const control = await fetch(`${base}${CORE_OPENAPI_PATH}`, {
    headers: { authorization: `Bearer ${key.secret}` },
  });
  expect(
    control.status,
    "control: the core OpenAPI document is served (2xx)",
  ).toBeGreaterThanOrEqual(200);
  expect(control.status).toBeLessThan(300);
  await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  revoked = true;
});

test("P5-TW-FUZZ-001: generated examples on the core OpenAPI path never return 5xx", async ({
  run: scope,
}, testInfo) => {
  // The test budget is the named wall-clock cap for the fuzz job, doubled for setup and cleanup
  // (BUDGETS.FUZZ_WALL_MIN). The Playwright default (60 s) is shorter than the cap this row needs.
  testInfo.setTimeout(BUDGETS.FUZZ_WALL_MIN.value * 60_000 * 2);
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const key = await createApiKey({
    baseUrl: base,
    session: admin,
    name: `${scope.prefix}-fuzz-run`,
  });
  let revoked = false;
  scope.onCleanup(async () => {
    if (!revoked) await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  });
  scope.trackLeak({
    label: `api key ${key.id}`,
    stillPresent: async () =>
      (await restStatus({ baseUrl: base, path: "/rest/companies?limit=1", bearer: key.secret })) ===
      200,
  });

  const schemaDir = mkdtempSync(join(tmpdir(), "p5-tw-fuzz-"));
  const schemaFile = join(schemaDir, "core.json");
  const document = await fetch(`${base}${CORE_OPENAPI_PATH}`, {
    headers: { authorization: `Bearer ${key.secret}` },
  });
  writeFileSync(schemaFile, await document.text());

  const outcome = await runSchemathesis({
    args: schemathesisArgs({ schemaFile, baseUrl: base }),
    bearer: key.secret,
    cwd: schemaDir,
  });
  await revokeApiKey({ baseUrl: base, session: admin, keyId: key.id });
  revoked = true;
  expect(outcome.exitCode, `no generated example returned a 5xx (${outcome.summary})`).toBe(0);
});
