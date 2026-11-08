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
