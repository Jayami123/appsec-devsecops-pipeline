// Private-first redaction of the uploaded Playwright JSON (D3). Pure functions; no file access.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { privateLeftovers, redactPrivateReport } from "../../../../src/kit/ci/report-redaction.ts";
import { privateIdIn, privateIdsOf } from "../../../../src/security/findings.ts";

const PRIVATE = ["P5-TW-GQL-002", "MI-3"];
const SECRET = "SENTINEL-EVIDENCE refused by a fixture path";

/** One spec with one test, in one project, optionally carrying an issue annotation and an error. */
function spec(title: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title,
    file: "tests/iso/tw/gql-cost.spec.ts",
    line: 31,
    column: 1,
    ok: false,
    id: "abc123",
    tests: [
      {
        projectName: "tw-iso",
        status: "expected",
        expectedStatus: "failed",
        timeout: 60000,
        annotations: [{ type: "issue", description: `P5-TW-GQL-002: ${SECRET}` }],
        results: [{ status: "failed", error: { message: SECRET } }],
      },
    ],
    ...extra,
  };
}

function reportWith(
  specs: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
): unknown {
  return { suites: [{ title: "gql-cost.spec.ts", specs, suites: [] }], ...extra };
}

describe("report redaction (D3): held-private specs are rebuilt, never filtered", () => {
  test("R1 a spec that names a private ID keeps only its ID, location, outcome and project status", () => {
    const { report, held, heldIds } = redactPrivateReport(
      reportWith([spec("P5-TW-GQL-002 query")]),
      PRIVATE,
    );
    assert.equal(held, 1);
    assert.deepEqual(heldIds, ["P5-TW-GQL-002"]);
    const suite = (report["suites"] as Record<string, unknown>[])[0] as Record<string, unknown>;
    const [held0] = suite["specs"] as Record<string, unknown>[];
    assert.deepEqual(held0, {
      title: "P5-TW-GQL-002 (held-private)",
      file: "tests/iso/tw/gql-cost.spec.ts",
      line: 31,
      column: 1,
      ok: false,
      tests: [{ projectName: "tw-iso", status: "expected", expectedStatus: "failed" }],
    });
    assert.doesNotMatch(JSON.stringify(report), /SENTINEL-EVIDENCE/);
  });

  test("R2 a spec with no private ID is returned exactly as it was", () => {
    const plain = spec("P5-CAL-AUTHZ-001 owner booking");
    plain["tests"] = [
      { projectName: "cal-api", status: "expected", expectedStatus: "passed", annotations: [] },
    ];
    const raw = reportWith([plain]);
    const { report, held } = redactPrivateReport(raw, PRIVATE);
    assert.equal(held, 0);
    assert.deepEqual(report, raw);
  });

  test("R3 a public title whose test JSON names a private ID is held too", () => {
    const sneaky = spec("P5-CAL-AUTHZ-001 owner booking");
    const { held, heldIds } = redactPrivateReport(reportWith([sneaky]), PRIVATE);
    assert.equal(held, 1);
    assert.deepEqual(heldIds, ["P5-TW-GQL-002"]);
  });

  test("R4 top-level errors are dropped when a spec was held, and kept when nothing was", () => {
    const withErrors = reportWith([spec("P5-TW-GQL-002 query")], { errors: [{ message: SECRET }] });
    assert.equal("errors" in (redactPrivateReport(withErrors, PRIVATE).report as object), false);
    const plainSpec = {
      title: "P5-CAL-AUTHZ-001 owner booking",
      file: "tests/integration/cal/x.spec.ts",
      tests: [
        { projectName: "cal-api", status: "expected", expectedStatus: "passed", annotations: [] },
      ],
    };
    const clean = reportWith([plainSpec], { errors: [{ message: "config note" }] });
    assert.deepEqual(redactPrivateReport(clean, PRIVATE).report, clean);
  });

  test("R5 a suite title that names a private ID becomes ID (held-private)", () => {
    const raw = {
      suites: [{ title: "P5-TW-GQL-002 suite", specs: [], suites: [] }],
    };
    const { report } = redactPrivateReport(raw, PRIVATE);
    assert.equal(
      ((report["suites"] as Record<string, unknown>[])[0] as Record<string, unknown>)["title"],
      "P5-TW-GQL-002 (held-private)",
    );
  });

  test("R6 the input is not mutated", () => {
    const raw = reportWith([spec("P5-TW-GQL-002 query")]);
    const before = JSON.stringify(raw);
    redactPrivateReport(raw, PRIVATE);
    assert.equal(JSON.stringify(raw), before);
  });

  test("R7 a non-object root is rejected (fail closed)", () => {
    assert.throws(() => redactPrivateReport([], PRIVATE), /root must be an object/);
  });
});

describe("report redaction (D3): the last check catches a surviving private ID", () => {
  test("R8 a clean redaction has no leftovers", () => {
    const { report } = redactPrivateReport(reportWith([spec("P5-TW-GQL-002 query")]), PRIVATE);
    assert.deepEqual(privateLeftovers(report, PRIVATE), []);
  });

  test("R9 a bare private ID outside a held title is reported as a leftover", () => {
    const report = { suites: [{ title: "P5-TW-GQL-002", specs: [], suites: [] }] };
    assert.deepEqual(privateLeftovers(report, PRIVATE), ["P5-TW-GQL-002"]);
  });
});

describe("private-ID matching and the ledger reader (D3)", () => {
  test("R10 an ID matches as a whole token only (MI-3 does not match MI-30)", () => {
    assert.equal(privateIdIn("MI-30 title", ["MI-3"]), undefined);
    assert.equal(privateIdIn("MI-3 title", ["MI-3"]), "MI-3");
    assert.equal(privateIdIn("x P5-TW-GQL-002.", ["P5-TW-GQL-002"]), "P5-TW-GQL-002");
    assert.equal(privateIdIn("XP5-TW-GQL-002", ["P5-TW-GQL-002"]), undefined);
  });

  test("R11 the ledger's private list is read, and an entry with an extra key stops the reader", () => {
    assert.deepEqual(privateIdsOf({ private: [{ id: "MI-3", status: "held-private" }] }), ["MI-3"]);
    assert.throws(
      () => privateIdsOf({ private: [{ id: "MI-3", status: "held-private", note: "x" }] }),
      /is not \{id, status\} with an allowed private status/,
    );
    assert.throws(() => privateIdsOf({}), /missing or not an array/);
  });
});
