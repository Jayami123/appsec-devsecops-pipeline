// P5-DOC-PN-3 Schemathesis over the vendored Documenso OAS (doc plan section 4.9; D-DOC-B5, D-DOC-B34, D-DOC-B61).
// The contract is src/lanes/doc/contracts/openapi.json (sha256 in its PROVENANCE.md), served under /api/v2. The
// binary is the hashed venv (SCHEMATHESIS_BIN). The owner's session cookie reaches Schemathesis ONLY through the
// environment (P5_DOC_FUZZ_COOKIE) and the hook module doc_schemathesis_hooks.py: never argv, never an artefact.
// Known ST101 pairs live in src/lanes/doc/fuzz-baseline.json. A NEW operation or error type fails; stale baseline
// entries are annotated. No expectedDefect for fuzz (D-DOC-B61). The file runs LAST in doc-serial (zz- prefix;
// Playwright orders files by name), so a server that stops during this run cannot fail the rows that run before it
// (D-DOC-B54, D-DOC-B63).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { redactArtefact } from "../../../src/security/redact.ts";
import { sanitizeRequestError } from "../../../src/lanes/doc/call-log.ts";
import {
  FUZZ_SEED,
  compareFuzzBaseline,
  fuzzFingerprint,
  parseFuzzBaseline,
  parseFuzzFindings,
  rateLimitArg,
  schemathesisArgs,
  schemathesisEnv,
} from "../../../src/lanes/doc/fuzz.ts";
import { V2_PATH } from "../../../src/lanes/doc/envelope-api.ts";

const SCHEMA = resolve("src/lanes/doc/contracts/openapi.json");
const BASELINE = resolve("src/lanes/doc/fuzz-baseline.json");
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
      seed: FUZZ_SEED,
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
    const baseline = parseFuzzBaseline(readFileSync(BASELINE, "utf8"));
    expect(baseline.seed, "committed baseline seed matches FUZZ_SEED").toBe(FUZZ_SEED);
    const current = parseFuzzFindings(plain);
    if (/\bST101\b/.test(plain) && current.length === 0) {
      throw new Error("TEST BUG: ST101 present in Schemathesis output but no operation was parsed");
    }
    const { novel, stale } = compareFuzzBaseline(current, baseline.entries);
    for (const entry of stale) {
      test.info().annotations.push({
        type: "fuzz-baseline-stale",
        description: fuzzFingerprint(entry),
      });
    }
    expect(
      novel,
      `NEW fuzz path or error type: ${sanitizeRequestError(novel.map(fuzzFingerprint).join(", ")) || "(none)"}. ${sanitizeRequestError(summary.join(" | "))}`,
    ).toEqual([]);
  });
});
