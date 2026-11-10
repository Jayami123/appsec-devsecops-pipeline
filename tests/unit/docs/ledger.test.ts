// Schema and derivation tests for docs/findings/ledger.json (plan 7.4 and 4.8). The schema is validated at
// runtime with ajv, not only by type.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertNoPrivateExtras, isPrivateEntry } from "../../../src/security/findings.ts";
import { validateAcceptedRisks, type AcceptedRisk } from "../../../src/security/accepted-risk.ts";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), "utf8");

interface Ledger {
  schema: number;
  cases: { id: string; status: string; alias?: Record<string, string> }[];
  private: Record<string, unknown>[];
  findings: unknown[];
  accepted_risks: unknown[];
}

const schema: object = JSON.parse(read("docs/findings/ledger.schema.json")) as object;
const ledger = JSON.parse(read("docs/findings/ledger.json")) as Ledger;
// ajv ships extensionless type imports that NodeNext cannot resolve from ESM, so it is loaded through
// require and typed by the minimal surface this test uses.
interface Validator {
  (data: unknown): boolean;
  errors?: unknown[] | null;
}
type AjvConstructor = new (options: { allErrors: boolean; strict: boolean; strictRequired: boolean }) => {
  compile(schema: object): Validator;
};
const require = createRequire(import.meta.url);
const Ajv = (require("ajv") as { default: AjvConstructor }).default;
// strictRequired is off because the conditional `alias` requirement names a property defined through $ref.
const validate = new Ajv({ allErrors: true, strict: true, strictRequired: false }).compile(schema);

test("the ledger validates against the schema", () => {
  const ok = validate(ledger);
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("every private entry has exactly id and status", () => {
  for (const entry of ledger.private) {
    assert.deepEqual(Object.keys(entry).sort(), ["id", "status"]);
    assert.equal(entry.status, "held-private");
    // The shared runtime checks from src/security/findings.ts must also accept every entry.
    assert.equal(isPrivateEntry(entry), true);
    assert.doesNotThrow(() => {
      assertNoPrivateExtras(entry);
    });
  }
});

test("a private entry with an extra key is rejected with PRIVATE_FIELD_REJECTED", () => {
  assert.throws(
    () => {
      assertNoPrivateExtras({ id: "MI-3", status: "held-private", title: "x" });
    },
    /PRIVATE_FIELD_REJECTED: title/,
  );
  const withExtra = { ...ledger, private: [{ id: "MI-3", status: "held-private", note: "x" }] };
  assert.equal(validate(withExtra), false);
});

test("cases holds 74 entries: 56 planned, 8 gated, 8 alias, 2 dropped", () => {
  const count = (status: string): number => ledger.cases.filter((c) => c.status === status).length;
  assert.equal(ledger.cases.length, 74);
  assert.equal(count("planned"), 56);
  assert.equal(count("gated"), 8);
  assert.equal(count("alias"), 8);
  assert.equal(count("dropped"), 2);
});

test("exactly the eight foundation-gated cases are gated, each with its blocker", () => {
  const GATED_IDS = [
    "P5-CAL-CSV-002",
    "P5-TW-FUZZ-001",
    "P5-TW-GQL-004",
    "P5-TW-SEC-001",
    "P5-TW-SND-001",
    "P5-TW-SND-002",
    "P5-TW-SND-003",
    "P5-TW-SND-004",
  ];
  const gated = ledger.cases.filter((c) => c.status === "gated");
  assert.deepEqual(gated.map((c) => c.id).sort(), GATED_IDS);
  for (const c of gated) {
    const blocker: unknown = (c as { blocker?: unknown }).blocker;
    assert.ok(typeof blocker === "string" && blocker.length > 0, `${c.id} needs a blocker`);
  }
});

test("private holds 8 entries and no id appears twice", () => {
  const ids = ledger.private.map((entry) => String(entry.id));
  assert.equal(ledger.private.length, 8);
  assert.equal(new Set(ids).size, ids.length);
});

test("every alias case has canonicalId, repo, ref, file, scopeCovered, residual and disposition", () => {
  for (const item of ledger.cases.filter((c) => c.status === "alias")) {
    for (const key of ["canonicalId", "repo", "ref", "file", "scopeCovered", "residual", "disposition"]) {
      assert.ok(item.alias?.[key], `${item.id} lacks ${key}`);
    }
  }
});

test("accepted_risks is empty (no risk is fabricated)", () => {
  assert.deepEqual(ledger.accepted_risks, []);
});

test("findings is empty until a run produces evidence", () => {
  assert.deepEqual(ledger.findings, []);
});

test("accepted_risks passes the accepted-risk date validator", () => {
  assert.deepEqual(validateAcceptedRisks(ledger.accepted_risks as AcceptedRisk[]), []);
});
