// Vendored from Jayami123/api-webhook-db-test-suite ref 99a2fde tests/unit/readiness/checks.test.ts (relocated to tests/unit/kit/readiness/checks.test.ts, F0-2). Change here only with a reason in the PR.
// F0-2 exclusion (plan 7.2.2): the 'SLO budgets' block (2 tests) is not carried; it imports src/slo.ts, which is not in the vendored closure.
import assert from "node:assert/strict";
import path from "node:path";
import { describe, test } from "node:test";
import { productsRoot, randomSecret } from "../../../../src/kit/readiness/checks.ts";

describe("readiness helpers", () => {
  test("randomSecret is 32 hex characters and different each time", () => {
    const a = randomSecret();
    assert.match(a, /^[0-9a-f]{32}$/);
    assert.notEqual(a, randomSecret());
  });

  test("productsRoot uses PRODUCTS_ROOT, ignores blank, and defaults next to the repo", () => {
    assert.equal(productsRoot({ PRODUCTS_ROOT: "/srv/products" }), path.resolve("/srv/products"));
    assert.equal(
      productsRoot({ PRODUCTS_ROOT: "  " }),
      path.resolve(process.cwd(), "..", "products"),
    );
    assert.equal(productsRoot({}), path.resolve(process.cwd(), "..", "products"));
  });
});
