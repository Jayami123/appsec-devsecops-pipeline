// Schema and derivation tests for docs/findings/ledger.json (plan 7.4 and 4.8). The schema is validated at
// runtime with ajv, not only by type.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertNoPrivateExtras, isPrivateEntry, privateIdIn } from "../../../src/security/findings.ts";
import { validateAcceptedRisks, type AcceptedRisk } from "../../../src/security/accepted-risk.ts";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), "utf8");

interface Ledger {
  schema: number;
  cases: {
    id: string;
    status: string;
    alias?: Record<string, string>;
    verification?: { runId: string; job: string; testFile: string };
  }[];
  private: Record<string, unknown>[];
  findings: { id: string; evidence: { file: string; line: number; runId: string } }[];
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

test("cases holds 73 entries: 8 planned, 31 verified, 24 gated, 8 alias, 2 dropped", () => {
  const count = (status: string): number => ledger.cases.filter((c) => c.status === status).length;
  assert.equal(ledger.cases.length, 73);
  assert.equal(count("planned"), 8);
  assert.equal(count("verified"), 31);
  assert.equal(count("gated"), 24);
  assert.equal(count("alias"), 8);
  assert.equal(count("dropped"), 2);
});

test("exactly the 24 gated cases are gated, each with its blocker", () => {
  const GATED_IDS = [
    "P5-CAL-CSV-001",
    "P5-CAL-CSV-002",
    "P5-CAL-RL-002",
    "P5-CAL-TEAM-001",
    "P5-CAL-TOK-001",
    "P5-CAL-XSS-002",
    "P5-DOC-OIDC-001",
    "P5-DOC-OIDC-002",
    "P5-DOC-RBAC-001",
    "P5-MED-RBAC-001",
    "P5-MED-WH-001",
    "P5-MED-WH-002",
    "P5-TW-GQL-004",
    "P5-TW-HDR-001",
    "P5-TW-MT-001",
    "P5-TW-MT-002",
    "P5-TW-RLS-002",
    "P5-TW-RLS-003",
    "P5-TW-SEC-001",
    "P5-TW-SND-001",
    "P5-TW-SND-002",
    "P5-TW-SND-003",
    "P5-TW-SND-004",
    "P5-TW-SSRF-001",
  ];
  const gated = ledger.cases.filter((c) => c.status === "gated");
  assert.deepEqual(gated.map((c) => c.id).sort(), GATED_IDS);
  for (const c of gated) {
    const blocker: unknown = (c as { blocker?: unknown }).blocker;
    assert.ok(typeof blocker === "string" && blocker.length > 0, `${c.id} needs a blocker`);
  }
});

test("every verified case names a CI run, a job and a test file that exists in the repository", () => {
  const verified = ledger.cases.filter((c) => c.status === "verified");
  assert.equal(verified.length, 31);
  for (const c of verified) {
    assert.ok(c.verification, `${c.id} needs a verification record`);
    assert.match(c.verification.runId, /^[0-9]+$/, `${c.id} run id`);
    assert.ok(c.verification.job.length > 0, `${c.id} job`);
    assert.ok(
      existsSync(fileURLToPath(new URL(`../../../${c.verification.testFile}`, import.meta.url))),
      `${c.id} test file ${c.verification.testFile} is missing`,
    );
  }
});

test("no gated or planned case is verified, and no verified case has a blocker", () => {
  for (const c of ledger.cases) {
    if (c.status !== "verified") assert.equal(c.verification, undefined, `${c.id} has verification but is ${c.status}`);
    if (c.status === "verified") assert.equal((c as { blocker?: unknown }).blocker, undefined, c.id);
  }
});

test("private holds 10 entries and no id appears twice", () => {
  const ids = ledger.private.map((entry) => String(entry.id));
  assert.equal(ledger.private.length, 10);
  assert.equal(new Set(ids).size, ids.length);
});

test("no private-first ID appears in cases or findings (master plan 4.8)", () => {
  const privateIds = ledger.private.map((entry) => String(entry.id));
  for (const c of ledger.cases) {
    assert.equal(privateIdIn(c.id, privateIds), undefined, `${c.id} is private`);
  }
  for (const f of ledger.findings) {
    assert.equal(privateIdIn(f.id, privateIds), undefined, `${f.id} is private`);
  }
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

test("findings holds the four public expectedDefect rows, each with a file that exists", () => {
  assert.deepEqual(
    ledger.findings.map((f) => f.id),
    ["P5-CAL-WH-002", "P5-CAL-WH-003", "P5-MED-AUTHZ-001", "P5-TW-MASS-001"],
  );
  for (const f of ledger.findings) {
    assert.ok(f.evidence.runId.length > 0, `${f.id} run id`);
    assert.ok(existsSync(fileURLToPath(new URL(`../../../${f.evidence.file}`, import.meta.url))), `${f.id} file`);
  }
});

test("accepted_risks passes the accepted-risk date validator", () => {
  assert.deepEqual(validateAcceptedRisks(ledger.accepted_risks as AcceptedRisk[]), []);
});
