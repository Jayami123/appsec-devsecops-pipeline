import { test } from "node:test";
import assert from "node:assert/strict";
import { storeHeaders } from "../../../../src/lanes/med/store-client.ts";

test("storeHeaders sets x-publishable-api-key and bearer only when given", () => {
  assert.deepEqual(storeHeaders({ publishableKey: "pk-test" }), {
    "x-publishable-api-key": "pk-test",
  });
  assert.deepEqual(
    storeHeaders({ publishableKey: "pk-test", token: "t1", origin: "http://o.test" }),
    {
      "x-publishable-api-key": "pk-test",
      authorization: "Bearer t1",
      origin: "http://o.test",
    },
  );
});

test("storeHeaders never includes an undefined header value", () => {
  // Deliberate negative input: explicit undefined values, which the helper must drop.
  const headers = storeHeaders({
    publishableKey: "pk-test",
    token: undefined,
    origin: undefined,
  } as unknown as Parameters<typeof storeHeaders>[0]);
  for (const value of Object.values(headers)) {
    assert.notEqual(value, undefined);
  }
  assert.equal("authorization" in headers, false);
  assert.equal("origin" in headers, false);
});
