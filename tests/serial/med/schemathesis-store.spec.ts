// P5-MED-FUZZ-001 (med plan 3c.11, D-MED-B3). Read-only Schemathesis run against the store OpenAPI, own fresh stack.
// Owner decision B30: a fixed seed, and a committed baseline fork ref held by the owner) instead of
// expectedDefect (the failures are generated, so they are not a single deterministic defect).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "../../../src/lanes/med/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { schemathesisArgs } from "../../../src/lanes/med/fuzz.ts";
import {
  compareToBaseline,
  failureKey,
  loadBaseline,
  parseFuzzFailures,
  type FuzzFailure,
} from "../../../src/lanes/med/fuzz-baseline.ts";
import { openRunStore } from "../../../src/lanes/med/setup.ts";
import { storeRequest } from "../../../src/lanes/med/store-client.ts";

const SCHEMA = resolve("src/lanes/med/contracts/store.openapi.full.yaml");
const BASELINE = resolve("src/lanes/med/fuzz-baseline.json");
/** Fixed generator seed (B30). The baseline must have been recorded with this seed. */
const FUZZ_SEED = 20261111;

function runSchemathesis(
  bin: string,
  args: string[],
  key: string,
  workDir: string,
): Promise<{ code: number | null; output: string }> {
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

function describe(failure: FuzzFailure): string {
  return `${failure.operation} ${failure.check} HTTP ${failure.status ?? "none"}`;
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
    const baseline = loadBaseline(JSON.parse(readFileSync(BASELINE, "utf8")) as unknown);
    const maxExamples = BUDGETS.FUZZ_MAX_EXAMPLES.value;
    const maxTimeSeconds = BUDGETS.FUZZ_WALL_MIN.value * 60;
    if (
      baseline.seed !== FUZZ_SEED ||
      baseline.maxExamples !== maxExamples ||
      baseline.maxTimeSeconds !== maxTimeSeconds
    ) {
      throw new Error(
        "TEST BUG: fuzz-baseline.json was recorded with a different seed or budget; re-record it",
      );
    }

    const store = await openRunStore(request, run);
    // Schemathesis writes its crash, cache and report files into the working directory: keep them out of the repository.
    const workDir = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), "p5-fuzz-"));
    const args = schemathesisArgs({
      schemaPath: SCHEMA,
      baseUrl: apiBaseUrl("medusa"),
      maxExamples,
      maxTimeSeconds,
      readOnly: true,
      seed: FUZZ_SEED,
      reportJsonPath: join(workDir, "report.json"),
      reportNdjsonPath: join(workDir, "events.ndjson"),
    });
    const result = await runSchemathesis(bin, args, store.key.value, workDir);
    // Exit 0 = no failures; exit 1 = failures recorded (judged against the baseline below). Anything else is ENV.
    expect(
      [0, 1],
      `schemathesis tool error (exit ${result.code ?? "signal"}); ENV, not a product result`,
    ).toContain(result.code);

    // Defence in depth: the run key value never reaches a log or annotation, even if a tool echoes it.
    const events = readFileSync(join(workDir, "events.ndjson"), "utf8")
      .split(store.key.value)
      .join("<redacted-key>");
    const observed = parseFuzzFailures(events);
    const { unexpected, stale } = compareToBaseline(observed, baseline.entries);
    const runId = process.env.P5_RUN_ID ?? "unset";

    console.log(
      `FUZZ-001 run ${runId} (seed ${FUZZ_SEED}): observed ${observed.length} failing check(s); baseline ${baseline.entries.length}; unexpected ${unexpected.length}; stale ${stale.length}`,
    );
    for (const failure of unexpected) console.log(`FUZZ-001 unexpected: ${describe(failure)}`);
    testInfo.annotations.push({
      type: "fuzz-summary",
      description: `run ${runId}: observed ${observed.length}; unexpected ${unexpected.length}; stale ${stale.length}`,
    });
    for (const failure of stale) {
      testInfo.annotations.push({ type: "baseline-stale", description: describe(failure) });
    }
    expect(
      unexpected.map(failureKey),
      `server error not in the committed baseline (src/lanes/med/fuzz-baseline.json): ${unexpected.map(describe).join("; ")}`,
    ).toEqual([]);
  });
});
