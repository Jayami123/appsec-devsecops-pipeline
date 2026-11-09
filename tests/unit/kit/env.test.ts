import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnv } from "../../../src/kit/env.ts";

test("loadEnv throws ENV_MISSING for unset P5_RUN_ID", () => {
  assert.throws(() => loadEnv({}), /^Error: ENV_MISSING: P5_RUN_ID$/);
});

test("loadEnv throws ENV_INVALID for a malformed run id", () => {
  assert.throws(
    () => loadEnv({ P5_RUN_ID: "p2-qa-20261101t090000z-0a1b2c3d" }),
    /^Error: ENV_INVALID: P5_RUN_ID$/,
  );
});

const VALID_RUN_ID = "p5-qa-20261101t090000z-0a1b2c3d";

test("valid control: a well-formed p5-qa- id loads and the defaults resolve", () => {
  const env = loadEnv({ P5_RUN_ID: VALID_RUN_ID });
  assert.equal(env.P5_RUN_ID, VALID_RUN_ID);
  assert.equal(env.CAL_API_BASE_URL, "http://127.0.0.1:5555");
  assert.deepEqual(env.P2_RECEIVER_HOSTS, ["127.0.0.1"]);
  assert.equal(env.P2_RECEIVER_PORT, 4317);
  assert.equal(env.P2_DB_STATEMENT_TIMEOUT_MS, 5000);
});

test("an invalid value that contains a password string throws ENV_INVALID with the name only", () => {
  const distinctive = "Zq9-Distinct-Pass-Str1ng";
  for (const env of [
    { P5_RUN_ID: VALID_RUN_ID, CAL_DB_URL: `postgres://qa:${distinctive}@203.0.113.7:5432/cal` },
    { P5_RUN_ID: VALID_RUN_ID, P2_DB_STATEMENT_TIMEOUT_MS: `slow-${distinctive}` },
  ]) {
    let message = "";
    try {
      loadEnv(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.match(message, /^ENV_INVALID: (CAL_DB_URL|P2_DB_STATEMENT_TIMEOUT_MS)$/);
    assert.ok(!message.includes(distinctive), "the invalid value must never be echoed");
  }
});
