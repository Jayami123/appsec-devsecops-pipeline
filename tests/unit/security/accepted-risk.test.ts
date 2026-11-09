// Accepted-risk date and match rules (L-PIPE plan 7.4, NEW-PIPE-4 and 5.11).
import assert from "node:assert/strict";
import { test } from "node:test";
import { BUDGETS } from "../../../src/security/budgets.ts";
import {
  matchAcceptedRisk,
  validateAcceptedRisks,
  type AcceptedRisk,
} from "../../../src/security/accepted-risk.ts";

const TTL = BUDGETS.ACCEPTED_RISK_TTL_DAYS.value;
const DAY_MS = 86_400_000;

function plusDays(date: string, days: number): string {
  const ms = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

function entry(acceptedOn: string, expires: string, fingerprint = "fp-1"): AcceptedRisk {
  return { id: "P5-001", acceptedOn, expires, match: { tool: "trivy", fingerprint } };
}

const ACCEPTED_ON = "2026-01-01";

test("expires 91 days after acceptedOn is rejected", () => {
  const over = entry(ACCEPTED_ON, plusDays(ACCEPTED_ON, TTL + 1));
  assert.deepEqual(validateAcceptedRisks([over]), [
    "ACCEPTED_RISK_INVALID: P5-001 expires is more than ACCEPTED_RISK_TTL_DAYS after acceptedOn",
  ]);
  const atTtl = entry(ACCEPTED_ON, plusDays(ACCEPTED_ON, TTL));
  assert.deepEqual(validateAcceptedRisks([atTtl]), []);
});

test("expires before acceptedOn is rejected", () => {
  const backwards = entry(ACCEPTED_ON, plusDays(ACCEPTED_ON, -1));
  assert.deepEqual(validateAcceptedRisks([backwards]), [
    "ACCEPTED_RISK_INVALID: P5-001 expires is not after acceptedOn",
  ]);
});

test("an expired accepted risk blocks", () => {
  const expired = entry(ACCEPTED_ON, "2026-03-01");
  assert.equal(
    matchAcceptedRisk([expired], { tool: "trivy", fingerprint: "fp-1" }, "2026-03-02"),
    "expired",
  );
});

test("an unexpired accepted risk suppresses a matching fingerprint", () => {
  const live = entry(ACCEPTED_ON, "2026-03-01");
  assert.equal(
    matchAcceptedRisk([live], { tool: "trivy", fingerprint: "fp-1" }, "2026-03-01"),
    "suppressed",
  );
  assert.equal(
    matchAcceptedRisk([live], { tool: "trivy", fingerprint: "fp-other" }, "2026-03-01"),
    "none",
  );
});
