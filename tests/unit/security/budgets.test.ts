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

test("FUZZ_RATE_LIMIT is 2 and below the strictest cited Documenso route limit", () => {
  assert.equal(BUDGETS.FUZZ_RATE_LIMIT.value, 2);
  assert.ok(BUDGETS.FUZZ_RATE_LIMIT.value < 3, "must sit below the cited route limit 3");
  assert.match(BUDGETS.FUZZ_RATE_LIMIT.formula, /--rate-limit/);
});

test("DOC_UPLOAD_CASES is 3 and the control plus the cases stay below the cited upload limit", () => {
  assert.equal(BUDGETS.DOC_UPLOAD_CASES.value, 3);
  assert.match(BUDGETS.DOC_ROUTE_LIMITS.formula, /upload: 20/);
  assert.ok(1 + BUDGETS.DOC_UPLOAD_CASES.value < 20, "control plus cases must stay below 20");
});

test("DOC_UPLOAD_OVERSIZE_BYTES is the fork default 50 MiB plus one byte", () => {
  assert.equal(BUDGETS.DOC_UPLOAD_OVERSIZE_BYTES.value, 52428801);
  assert.equal(BUDGETS.DOC_UPLOAD_OVERSIZE_BYTES.value, 50 * 1024 * 1024 + 1);
});

test("TW_DEMOTE_RACE_TRIALS is 5 and INVESTIGATIVE", () => {
  assert.equal(BUDGETS.TW_DEMOTE_RACE_TRIALS.value, 5);
  assert.equal(BUDGETS.TW_DEMOTE_RACE_TRIALS.class, "INVESTIGATIVE");
});

test("MED_RACE_PARALLEL_N and MED_REPLAY_DELIVERIES are 2", () => {
  assert.equal(BUDGETS.MED_RACE_PARALLEL_N.value, 2);
  assert.equal(BUDGETS.MED_REPLAY_DELIVERIES.value, 2);
});

test("WEBHOOK_SETTLE_MS, CSV_EXPORT_POLL_MS and CSV_UI_DOWNLOAD_MS stay unset until measured and carry a formula", () => {
  for (const budget of [
    BUDGETS.WEBHOOK_SETTLE_MS,
    BUDGETS.CSV_EXPORT_POLL_MS,
    BUDGETS.CSV_UI_DOWNLOAD_MS,
  ] as const) {
    assert.equal(budget.value, null);
    assert.ok(budget.formula !== undefined && budget.formula.length > 0, "needs a formula");
    assert.match(budget.basis, /UNPROBED/);
  }
});
