import assert from "node:assert/strict";
import { test } from "node:test";
import { BUDGETS, type Budget } from "../../../src/security/budgets.ts";

test("every budget is a number or a named object with a basis", () => {
  for (const [name, budget] of Object.entries(BUDGETS) as [string, Budget][]) {
    assert.ok(name.length > 0);
    assert.ok(budget.basis.length > 0, `${name} needs a basis`);
    assert.ok(
      typeof budget.value === "number" || typeof budget.formula === "string",
      `${name} must be a number or a named formula`,
    );
  }
});

test("BRUTE_FORCE_ATTEMPTS is 101", () => {
  assert.equal(BUDGETS.BRUTE_FORCE_ATTEMPTS.value, 101);
});

test("TOTP_BURST is 20", () => {
  assert.equal(BUDGETS.TOTP_BURST.value, 20);
});

test("CAL_V2_KEY_LIMIT is 121", () => {
  assert.equal(BUDGETS.CAL_V2_KEY_LIMIT.value, 121);
});

test("WEBHOOK_STALE_AGE_S is 3600", () => {
  assert.equal(BUDGETS.WEBHOOK_STALE_AGE_S.value, 3600);
});

test("CAL_RESET_CONCURRENT_N is 5", () => {
  assert.equal(BUDGETS.CAL_RESET_CONCURRENT_N.value, 5);
});

test("TW_SPRAY_ACCOUNTS is 20", () => {
  assert.equal(BUDGETS.TW_SPRAY_ACCOUNTS.value, 20);
});
