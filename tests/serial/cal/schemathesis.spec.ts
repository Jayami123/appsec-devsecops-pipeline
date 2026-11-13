// P5-CAL-PN-2: the vendored API v2 OpenAPI contract fork ref held by the owner, 82 paths)
// is driven by Schemathesis 4.33.1 on its own fresh stack (D-CAL-B3). The run is unauthenticated
// (D-CAL-B40): no credential in argv or on disk. Valid requests are checked from this side with the
// throwaway key, which never leaves memory. Any 5xx is PRODUCT BUG (SUSPECTED) with the reproducing request.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "../../../src/lanes/cal/run-fixture.ts";
import { loadEnv } from "../../../src/kit/env.ts";
import { request as pwRequest } from "@playwright/test";
import {
  createThrowawayActor,
  labelFor,
  v2,
  V2_BOOKINGS_VERSION,
  V2_EVENT_TYPES_VERSION,
} from "../../../src/lanes/cal/actor.ts";
import { schemathesisArgs } from "../../../src/lanes/cal/fuzz.ts";
import { BUDGETS } from "../../../src/security/budgets.ts";
import { currentRunPrefix } from "../../../src/kit/run/prefix.ts";

// Absolute schema path: the fuzz process runs in its own scratch directory (its caches never enter the repo).
const SCHEMA = resolve("src/lanes/cal/contracts/openapi-v2.json");

test.describe("P5-CAL-PN-2 schemathesis", () => {
  test("P5-CAL-PN-2 valid requests answer 2xx", async ({ run }) => {
    const prefix = currentRunPrefix();
    const api = await pwRequest.newContext({
      baseURL: loadEnv().CAL_API_BASE_URL.replace(/\/$/, ""),
    });
    run.onCleanup(() => api.dispose());
    const actor = await createThrowawayActor(loadEnv().CAL_BASE_URL, prefix, labelFor("pn2"));
    run.onCleanup(() => actor.dispose());
    const bookings = await v2(api, actor.apiKey, "GET", "/v2/bookings", V2_BOOKINGS_VERSION);
    expect(bookings.status, "GET /v2/bookings").toBe(200);
    const eventTypes = await v2(
      api,
      actor.apiKey,
      "GET",
      "/v2/event-types",
      V2_EVENT_TYPES_VERSION,
    );
    expect(eventTypes.status, "GET /v2/event-types").toBe(200);
  });

  test("P5-CAL-PN-2 valid extras never answer 5xx", async () => {
    test.setTimeout(BUDGETS.FUZZ_WALL_MIN.value * 60_000);
    const bin = process.env.SCHEMATHESIS_BIN;
    if (bin === undefined || bin === "") throw new Error("ENV_MISSING: SCHEMATHESIS_BIN");
    const args = schemathesisArgs({
      schemaPath: SCHEMA,
      baseUrl: loadEnv().CAL_API_BASE_URL.replace(/\/$/, ""),
      maxExamples: BUDGETS.FUZZ_MAX_EXAMPLES.value,
    });
    const exit = await new Promise<{ code: number | null; tail: string }>((resolve, reject) => {
      const cwd = mkdtempSync(join(tmpdir(), "p5-schemathesis-"));
      // The fuzz process gets no Stripe key: STRIPE_API_KEY stays with the harness steps only (D-CAL-B58).
      const childEnv = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key !== "STRIPE_API_KEY"),
      );
      const child = spawn(bin, args, {
        cwd,
        env: childEnv,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      child.stdout.on("data", (chunk: Buffer) => {
        out = (out + chunk.toString("utf8")).slice(-4000);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        out = (out + chunk.toString("utf8")).slice(-4000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolve({ code, tail: out });
      });
    });
    expect(exit.code, `schemathesis exit; last output: ${exit.tail.slice(-600)}`).toBe(0);
  });
});
