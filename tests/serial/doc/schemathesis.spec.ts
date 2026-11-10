// P5-DOC-PN-3 Schemathesis over the vendored Documenso OAS (doc plan section 4.9; decisions D-DOC-B5, D-DOC-B6).
// The contract is src/lanes/doc/contracts/openapi.json (sha256 checked in its PROVENANCE.md). The run uses the
// hashed lock (requirements/schemathesis.txt) through SCHEMATHESIS_BIN. The owner's session is passed as a
// Cookie header assembled at spawn time: it never appears in the argument builder (fuzz.ts) or in an artefact.
// Any 5xx is PRODUCT BUG (SUSPECTED); the output is redacted before it is attached (redact.ts:17).
import { execFile } from "node:child_process";
import { test, expect, actorOf } from "../../../src/lanes/doc/actors.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { redactArtefact } from "../../../src/security/redact.ts";
import { rateLimitArg, schemathesisArgs } from "../../../src/lanes/doc/fuzz.ts";
import { V2_PATH } from "../../../src/lanes/doc/envelope-api.ts";

test.use({ actorLabels: ["owner", "member"] });

const SCHEMA = "src/lanes/doc/contracts/openapi.json";
const MS_PER_MINUTE = 60_000;
const ANSI = new RegExp(String.fromCharCode(27) + "\\[[0-9;]*[A-Za-z]", "g");

/** Runs the binary with an argument array (no shell). Resolves with the output, never rejects. */
function runSchemathesis(bin: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (_error, stdout, stderr) => {
        // A non-zero exit is normal when a check fails; the 5xx decision is made on the output.
        resolve(stdout + stderr);
      },
    );
  });
}

test.setTimeout(BUDGETS.FUZZ_WALL_MIN.value * MS_PER_MINUTE);

function schemathesisBin(): string {
  const bin = process.env.SCHEMATHESIS_BIN;
  if (!bin) throw new Error("ENV: SCHEMATHESIS_BIN is not set (requirements/schemathesis.txt)");
  return bin;
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
    // Spawn-time header (no shell). Not logged, not put in an annotation.
    args.push("-H", `Cookie: ${cookie}`);
    const output = await runSchemathesis(
      schemathesisBin(),
      args,
      BUDGETS.FUZZ_WALL_MIN.value * MS_PER_MINUTE,
    );
    const plain = output.replace(ANSI, "");
    const summary = plain
      .split("\n")
      .filter((line) => /examples|Examples|operations|Server error/i.test(line))
      .slice(0, 12);
    test.info().annotations.push({
      type: "schemathesis-summary",
      description: redactArtefact(summary.join(" | ")),
    });
    const serverErrors = plain.match(/Server error/gi)?.length ?? 0;
    expect(serverErrors, "PRODUCT BUG (SUSPECTED): a generated request returned 5xx").toBe(0);
  });
});
