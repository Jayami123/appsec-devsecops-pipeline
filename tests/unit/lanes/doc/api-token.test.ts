import { test } from "node:test";
import assert from "node:assert/strict";
import { mintedTokenFrom } from "../../../../src/lanes/doc/api-token.ts";

test("mintedTokenFrom reads the id and token from the superjson result", () => {
  assert.deepEqual(
    mintedTokenFrom({ result: { data: { json: { id: 4, token: "api_test_value" } } } }),
    {
      id: 4,
      token: "api_test_value",
    },
  );
});

test("mintedTokenFrom refuses a body without a token", () => {
  assert.throws(
    () => mintedTokenFrom({ result: { data: { json: { id: 4 } } } }),
    /no id and token/,
  );
});
