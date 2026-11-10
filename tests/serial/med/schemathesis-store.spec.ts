// P5-MED-FUZZ-001 (med plan 3c.11, D-MED-B3). Read-only Schemathesis run against the store OpenAPI, own fresh stack.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { schemathesisArgs } from "../../../src/lanes/med/fuzz.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

const SCHEMA = resolve("src/lanes/med/contracts/store.openapi.full.yaml");

function runSchemathesis(
  bin: string,
  args: string[],
  key: string,
): Promise<{ code: number | null; output: string }> {
  // Schemathesis writes its crash and cache files into the working directory: keep them out of the repository.
  const workDir = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), "p5-fuzz-"));
  return new Promise((resolveRun, reject) => {
    // The publishable key is a public storefront key (Medusa), minted for this run and revoked in cleanup.
    // It is passed as a header at spawn time; no shell is used.
    const child = spawn(bin, [...args, "-H", `x-publishable-api-key:${key}`], {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveRun({ code, output });
    });
  });
}

test.describe("P5-MED-FUZZ-001", () => {
  test.setTimeout(BUDGETS.FUZZ_WALL_MIN.value * 60_000 + 120_000);

  test("P5-MED-FUZZ-001 control: the valid store region read returns 2xx before fuzzing", async ({
    request,
    run,
  }) => {
    const store = await openRunStore(request, run);
    const response = await storeRequest(request, {
      method: "GET",
      path: "/store/regions",
      publishableKey: store.key.value,
    });
    expect(response.status(), "control: a valid store read is 2xx").toBeLessThan(300);
    expect(response.status()).toBeGreaterThanOrEqual(200);
  });

  test("P5-MED-FUZZ-001 schemathesis store reads produce no server error within the example budget", async ({
    request,
    run,
  }, testInfo) => {
    const bin = process.env.SCHEMATHESIS_BIN;
    if (!bin)
      throw new Error(
        "ENV: SCHEMATHESIS_BIN is not set (the hashed Schemathesis lock must be installed)",
      );
    const store = await openRunStore(request, run);
    const args = schemathesisArgs({
      schemaPath: SCHEMA,
      baseUrl: apiBaseUrl("medusa"),
      maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
      maxTimeSeconds: BUDGETS.FUZZ_WALL_MIN.value * 60,
      readOnly: true,
    });
    const result = await runSchemathesis(bin, args, store.key.value);
    // Defence in depth: the run key value never reaches a log or annotation, even if a tool echoes it.
    const output = result.output.split(store.key.value).join("<redacted-key>");
    const serverErrors = (output.match(/ST101 Server error/g) ?? []).length;
    const failingPaths = [
      ...new Set(
        [...output.matchAll(/https?:\/\/[^/\s]+(\/store\/[^\s'?]*)/g)].map((match) =>
          (match[1] ?? "").replace(/prod_[A-Za-z0-9]+|reg_[A-Za-z0-9]+|cart_[A-Za-z0-9]+/g, "<id>"),
        ),
      ),
    ].sort();
    console.log(
      `FUZZ-001 (schemathesis ${result.code ?? "signal"}): ST101 server-error findings=${serverErrors}; store paths in reproductions: ${failingPaths.join(", ") || "none"}`,
    );
    testInfo.annotations.push({
      type: "fuzz-summary",
      description: `exit=${result.code ?? "signal"}; ST101 server errors=${serverErrors}; paths=${failingPaths.length}`,
    });
    expect(
      result.code,
      "schemathesis exit 0 (no not_a_server_error failure within the budget). Tool errors are ENV.",
    ).toBe(0);
  });
});
