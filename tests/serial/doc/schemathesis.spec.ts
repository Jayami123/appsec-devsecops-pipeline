// P5-DOC-PN-3 Schemathesis over the vendored Documenso OAS (doc plan section 4.9; D-DOC-B5, D-DOC-B34).
// The contract is src/lanes/doc/contracts/openapi.json (sha256 in its PROVENANCE.md), served under /api/v2. The
// binary is the hashed venv (SCHEMATHESIS_BIN). The owner's session cookie reaches Schemathesis ONLY through the
// environment (P5_DOC_FUZZ_COOKIE) and the hook module doc_schemathesis_hooks.py: never argv, never an artefact.
// Any 5xx is PRODUCT BUG (SUSPECTED); the output is redacted before it is attached (redact.ts:17).
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { redactArtefact } from "../../../src/security/redact.ts";
import { rateLimitArg, schemathesisArgs, schemathesisEnv } from "../../../src/lanes/doc/fuzz.ts";
import { V2_PATH } from "../../../src/lanes/doc/envelope-api.ts";

const SCHEMA = resolve("src/lanes/doc/contracts/openapi.json");
const HOOKS_DIR = resolve("src/lanes/doc");
const MS_PER_MINUTE = 60_000;
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*[A-Za-z]", "g");

test.setTimeout(BUDGETS.FUZZ_WALL_MIN.value * MS_PER_MINUTE);

function schemathesisBin(): string {
  const bin = process.env.SCHEMATHESIS_BIN;
  if (!bin) throw new Error("ENV: SCHEMATHESIS_BIN is not set (requirements/schemathesis.txt)");
  return bin;
}

/** Runs the binary with an argument array (no shell). Resolves with the output, never rejects. */
function runSchemathesis(
  bin: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolveRun) => {
    execFile(
      bin,
      args,
      { env, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (_error, stdout, stderr) => {
        // A non-zero exit is normal when a check fails; the 5xx decision is made on the output.
        resolveRun(stdout + stderr);
      },
    );
  });
}

test.describe("P5-DOC-PN-3", () => {
  test("PN-3 valid OAS requests return 2xx (control)", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const res = await owner.request.get(`${apiBaseUrl("documenso")}${V2_PATH}/envelope`);
    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(300);
  });

  test("PN-3 generated requests return no 5xx", async ({ actors }) => {
    const owner = actorOf(actors, "owner");
    const base = apiBaseUrl("documenso");
    const state = await owner.request.storageState();
    const cookie = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const args = schemathesisArgs({
      schemaPath: SCHEMA,
      baseUrl: `${base}${V2_PATH}`,
      maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
      rateLimit: rateLimitArg(BUDGETS.FUZZ_RATE_LIMIT.value, 1),
      excludePaths: [],
    });
    const env = schemathesisEnv({ cookie, hooksDir: HOOKS_DIR, base: process.env });
    const output = await runSchemathesis(
      schemathesisBin(),
      args,
      env,
      BUDGETS.FUZZ_WALL_MIN.value * MS_PER_MINUTE,
    );
    const plain = output.replace(ANSI, "");
    const summary = plain
      .split("\n")
      .filter((line) => /examples|operations|Server error/i.test(line))
      .slice(0, 12);
    test.info().annotations.push({
      type: "schemathesis-summary",
      description: redactArtefact(summary.join(" | ")),
    });
    const serverErrors = plain.match(/Server error/gi)?.length ?? 0;
    expect(serverErrors, "PRODUCT BUG (SUSPECTED): a generated request returned 5xx").toBe(0);
  });
});
