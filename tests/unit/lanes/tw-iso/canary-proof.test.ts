import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canaryName,
  overrideCheck,
  proofRecord,
} from "../../../../src/lanes/tw-iso/canary-proof.ts";

// Fixed fake values only (never a real canary).
const FAKE_VALUE = "0".repeat(64);
const RUN_ID = "p5-qa-20261110t093000z-1a2b3c4d";

test("canaryName upper-cases the run id into a harness-valid P5_CANARY_ name", () => {
  const name = canaryName(RUN_ID);
  assert.equal(name, "P5_CANARY_P5_QA_20261110T093000Z_1A2B3C4D");
  assert.match(name, /^[A-Z][A-Z0-9_]{2,63}$/);
  assert.throws(() => canaryName("not-a-run-id"), /TEST BUG/);
});

test("overrideCheck is true only when both services carry the reference line and the value is absent", () => {
  const ref = `P5_CANARY_X: \${HARNESS_TWENTY_CANARY_VALUE}`;
  const both = [
    "services:",
    "  server:",
    "    environment:",
    `      ${ref}`,
    "  worker:",
    "    environment:",
    `      ${ref}`,
    "",
  ].join("\n");
  assert.deepEqual(overrideCheck(both, "P5_CANARY_X", FAKE_VALUE), {
    serverRef: true,
    workerRef: true,
    noValue: true,
  });
  const serverOnly = [
    "services:",
    "  server:",
    "    environment:",
    `      ${ref}`,
    "  worker:",
    "    environment:",
    "",
  ].join("\n");
  assert.equal(overrideCheck(serverOnly, "P5_CANARY_X", FAKE_VALUE).workerRef, false);
  const leaked = `${both}      LEAK: ${FAKE_VALUE}\n`;
  assert.equal(overrideCheck(leaked, "P5_CANARY_X", FAKE_VALUE).noValue, false);
});

test("the proof record holds booleans and fixed strings only", () => {
  const record = proofRecord({
    upExit0: true,
    check: { serverRef: true, workerRef: true, noValue: true },
    hashMatch: true,
  });
  for (const [key, value] of Object.entries(record)) {
    assert.ok(
      typeof value === "boolean" ||
        ["P-12", "parent-side, harness named-canary route, no exec", "LOCAL"].includes(
          String(value),
        ),
      `${key} must be a boolean or a fixed string`,
    );
  }
  assert.equal(JSON.stringify(record).includes(FAKE_VALUE), false);
});
