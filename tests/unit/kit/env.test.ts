import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnv, stripeWebhookSecret } from "../../../src/kit/env.ts";

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
  const cases = [
    {
      env: {
        P5_RUN_ID: VALID_RUN_ID,
        CAL_DB_URL: `postgres://qa:${distinctive}@203.0.113.7:5432/cal`,
      },
      name: "CAL_DB_URL",
    },
    {
      env: { P5_RUN_ID: VALID_RUN_ID, P2_DB_STATEMENT_TIMEOUT_MS: `slow-${distinctive}` },
      name: "P2_DB_STATEMENT_TIMEOUT_MS",
    },
  ];
  for (const { env, name } of cases) {
    let message = "";
    try {
      loadEnv(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    assert.equal(message, `ENV_INVALID: ${name}`);
    assert.ok(!message.includes(distinctive), "the invalid value must never be echoed");
  }
});

test("STRIPE_WEBHOOK_SECRET is optional and blank means unset", () => {
  assert.equal(loadEnv({ P5_RUN_ID: VALID_RUN_ID }).STRIPE_WEBHOOK_SECRET, undefined);
  assert.equal(
    loadEnv({ P5_RUN_ID: VALID_RUN_ID, STRIPE_WEBHOOK_SECRET: "  " }).STRIPE_WEBHOOK_SECRET,
    undefined,
  );
});

test("stripeWebhookSecret throws ENV_MISSING by name and returns a set value", () => {
  assert.throws(
    () => stripeWebhookSecret({ P5_RUN_ID: VALID_RUN_ID }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "ENV_MISSING: STRIPE_WEBHOOK_SECRET");
      return true;
    },
  );
  const synthetic = "whsec_test_synthetic";
  assert.equal(
    stripeWebhookSecret({ P5_RUN_ID: VALID_RUN_ID, STRIPE_WEBHOOK_SECRET: synthetic }),
    synthetic,
  );
});

// D-TW-B47 (owner-approved): lvh.me and its subdomains are loopback base hosts; any other host stays rejected.
test("TWENTY_BASE_URL accepts lvh.me (owner exception, D-TW-B47)", () => {
  const env = loadEnv({ P5_RUN_ID: VALID_RUN_ID, TWENTY_BASE_URL: "http://lvh.me:3002" });
  assert.equal(env.TWENTY_BASE_URL, "http://lvh.me:3002");
});

test("TWENTY_BASE_URL accepts a subdomain of lvh.me (owner exception, D-TW-B47)", () => {
  const env = loadEnv({ P5_RUN_ID: VALID_RUN_ID, TWENTY_BASE_URL: "http://apple.lvh.me:3002" });
  assert.equal(env.TWENTY_BASE_URL, "http://apple.lvh.me:3002");
});

test("TWENTY_BASE_URL rejects a non-loopback host that starts with lvh.me, naming the variable only", () => {
  assert.throws(
    () => loadEnv({ P5_RUN_ID: VALID_RUN_ID, TWENTY_BASE_URL: "http://lvh.me.evil.com:3002" }),
    /^Error: ENV_INVALID: TWENTY_BASE_URL$/,
  );
});
