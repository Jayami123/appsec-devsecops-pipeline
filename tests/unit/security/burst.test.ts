import assert from "node:assert/strict";
import { test } from "node:test";
import { burstCount, runBurst, BudgetNotNamedError } from "../../../src/security/burst.ts";

test("burstCount returns the named value", () => {
  assert.equal(burstCount("BRUTE_FORCE_ATTEMPTS"), 101);
});

test("burstCount refuses a raw number with BUDGET_NOT_NAMED", () => {
  assert.throws(
    () => burstCount(101),
    (error: unknown) => {
      assert.ok(error instanceof BudgetNotNamedError);
      assert.equal(error.message, "BUDGET_NOT_NAMED: 101");
      return true;
    },
  );
});

test("burstCount refuses an unknown name with BUDGET_NOT_NAMED", () => {
  assert.throws(
    () => burstCount("NOT_A_BUDGET"),
    /^BudgetNotNamedError: BUDGET_NOT_NAMED: NOT_A_BUDGET$/,
  );
});

test("runBurst calls attempt exactly BRUTE_FORCE_ATTEMPTS times", async () => {
  let calls = 0;
  const result = await runBurst({
    budget: "BRUTE_FORCE_ATTEMPTS",
    attempt: () => {
      calls += 1;
      return Promise.resolve(401);
    },
  });
  assert.equal(calls, 101);
  assert.equal(result.attempts, 101);
});

test("runBurst returns statuses in call order", async () => {
  const result = await runBurst({
    budget: "TOTP_BURST",
    attempt: (index) => Promise.resolve(400 + index),
  });
  assert.equal(result.statuses.length, 20);
  assert.deepEqual(result.statuses.slice(0, 3), [400, 401, 402]);
  assert.equal(result.statuses.at(-1), 419);
});
