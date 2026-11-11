import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_ORIGIN,
  DISALLOWED_ORIGIN,
  PII_FIELDS,
} from "../../../../src/lanes/med/fixtures.ts";

test("allowed and disallowed origins differ and the disallowed one is a reserved .test host", () => {
  assert.notEqual(ALLOWED_ORIGIN, DISALLOWED_ORIGIN);
  const host = new URL(DISALLOWED_ORIGIN).hostname;
  assert.ok(host.endsWith(".test"), "disallowed origin must use the reserved .test TLD");
});

test("the PII field list matches owner decision D-MED-8", () => {
  assert.deepEqual(
    [...PII_FIELDS],
    [
      "email",
      "phone",
      "first_name",
      "last_name",
      "billing_address.*",
      "shipping_address.*",
      "customer.*",
    ],
  );
});
