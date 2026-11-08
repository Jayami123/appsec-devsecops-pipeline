import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCovered,
  MatrixCoverageError,
  toCsv,
  type MatrixRow,
} from "../../../src/security/matrix.ts";

const ROWS: MatrixRow[] = [
  { actor: "owner", resource: "booking", verb: "GET", expected: "allow", caseId: "M-1" },
  { actor: "owner", resource: "booking", verb: "PUT", expected: "allow", caseId: "M-2" },
  // Control for the stranger: a positive case that the same actor is allowed on this resource.
  { actor: "stranger", resource: "booking", verb: "GET", expected: "allow", caseId: "M-5" },
  { actor: "stranger", resource: "booking", verb: "GET", expected: "deny-403", caseId: "M-3" },
  { actor: "stranger", resource: "booking", verb: "PUT", expected: "deny-403", caseId: "M-4" },
];

test("assertCovered passes for a complete matrix", () => {
  // owner is the control (allow); stranger is covered for every verb.
  assert.doesNotThrow(() => {
    assertCovered(ROWS, ["owner", "stranger"], ["booking"], ["GET", "PUT"]);
  });
});

test("assertCovered names the first uncovered cell", () => {
  const partial = ROWS.filter((row) => !(row.actor === "stranger" && row.verb === "PUT"));
  assert.throws(
    () => {
      assertCovered(partial, ["owner", "stranger"], ["booking"], ["GET", "PUT"]);
    },
    (error: unknown) => {
      assert.ok(error instanceof MatrixCoverageError);
      assert.equal(error.message, "MATRIX_UNCOVERED: stranger PUT booking");
      return true;
    },
  );
});

test("assertCovered requires a control row per actor and resource", () => {
  const noControl = ROWS.filter((row) => row.actor === "stranger" && row.expected !== "allow");
  assert.throws(() => {
    assertCovered(noControl, ["stranger"], ["booking"], ["GET", "PUT"]);
  }, /MATRIX_UNCOVERED: stranger control booking/);
});

test("toCsv writes the header and quotes commas", () => {
  const csv = toCsv([
    { actor: "owner", resource: "a,b", verb: "GET", expected: "allow", caseId: "M-9" },
  ]);
  assert.equal(csv.split("\n")[0], "actor,resource,verb,expected,caseId");
  assert.equal(csv.split("\n")[1], 'owner,"a,b",GET,allow,M-9');
});
