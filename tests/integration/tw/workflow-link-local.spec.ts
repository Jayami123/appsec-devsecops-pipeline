// P5-TW-SSRF-001 (two profiles, D-TW-B8). Profile B (control, job tw-ssrf-allow, OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS
// set at up): a workflow HTTP step reaches the owner canary (the kit receiver on the runner host, reached as
// host.docker.internal). Profile A (negative, job tw-ssrf-default, variable unset): the same step is refused by the
// product with an attributable error and the canary receives nothing. Canary: src/lanes/tw/canary.ts.
// Product refusal (live, default stack): "Request to internal IP address 172.17.0.1 is not allowed."
// Route chain: src/lanes/tw/workflow.ts (front-end documents in object-core/workflows/graphql).
import { randomBytes } from "node:crypto";
import { test, expect } from "../../../src/lanes/tw/run-fixture.ts";
import { apiBaseUrl } from "../../../src/kit/env.ts";
import { adminSetupSession } from "../../../src/lanes/tw/login.ts";
import { startCanaryReceiver } from "../../../src/lanes/tw/canary.ts";
import { activateAndRun, createHttpWorkflow, readRun } from "../../../src/lanes/tw/workflow.ts";

test("P5-TW-SSRF-001 control: a workflow HTTP step reaches the owner canary when the allowlist names it @ssrf-allow", async ({
  run,
}) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const canary = await startCanaryReceiver();
  run.onCleanup(async () => {
    await canary.stop();
  });
  const testId = randomBytes(16).toString("hex"); // per-run nonce; never written to an artefact or a log
  const key = { runId: run.prefix, testId };
  const url = canary.receiver.urlFor(key, "host.docker.internal");
  const wf = await createHttpWorkflow({
    baseUrl: base,
    session: admin,
    name: `${run.prefix}-ssrf-control`,
    url,
  });
  const runId = await activateAndRun({ baseUrl: base, session: admin, versionId: wf.versionId });
  await expect
    .poll(() =>
      readRun({ baseUrl: base, session: admin, workflowRunId: runId }).then((r) => r.status),
    )
    .not.toMatch(/ENQUEUED|RUNNING/);
  expect(
    canary.receiver.deliveries(key).length,
    "control: one hit reached the canary through the allowlisted path",
  ).toBeGreaterThanOrEqual(1);
});

test("P5-TW-SSRF-001: a workflow HTTP step to the owner canary is blocked when the allowlist is empty @ssrf-default", async ({
  run,
}) => {
  const base = apiBaseUrl("twenty");
  const admin = await adminSetupSession(base); // setup only (D-TW-B5)
  const canary = await startCanaryReceiver();
  run.onCleanup(async () => {
    await canary.stop();
  });
  const testId = randomBytes(16).toString("hex");
  const key = { runId: run.prefix, testId };
  const url = canary.receiver.urlFor(key, "host.docker.internal");
  const wf = await createHttpWorkflow({
    baseUrl: base,
    session: admin,
    name: `${run.prefix}-ssrf-negative`,
    url,
  });
  const runId = await activateAndRun({ baseUrl: base, session: admin, versionId: wf.versionId });
  let state = await readRun({ baseUrl: base, session: admin, workflowRunId: runId });
  await expect
    .poll(
      async () =>
        (state = await readRun({ baseUrl: base, session: admin, workflowRunId: runId })).status,
    )
    .not.toMatch(/ENQUEUED|RUNNING/);
  expect(state.stepError ?? "", "the refusal is attributable to the product").toMatch(
    /Request to internal IP address .+ is not allowed/,
  );
  expect(canary.receiver.deliveries(key).length, "no request reached the canary").toBe(0);
});
