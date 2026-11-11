import { test } from "node:test";
import assert from "node:assert/strict";
import { CSV_CORPUS, isFormulaLike } from "../../../../src/lanes/cal/csv-corpus.ts";

test("csv-corpus module flags formula-like cells", () => {
  for (const entry of CSV_CORPUS.filter(
    (e) => e.kind === "formula" || e.kind === "numeric-formula",
  )) {
    assert.equal(isFormulaLike(entry.cell), true, entry.id);
  }
});

test("csv-corpus module leaves plain cells unflagged", () => {
  // space-formula documents the leading-space case: a leading space is not a formula lead.
  for (const entry of CSV_CORPUS.filter((e) => e.kind === "plain" || e.kind === "space-formula")) {
    assert.equal(isFormulaLike(entry.cell), false, entry.id);
  }
});

test("csv-corpus covers every kind with unique ids", () => {
  const ids = CSV_CORPUS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  const kinds = new Set(CSV_CORPUS.map((e) => e.kind));
  for (const kind of ["plain", "formula", "numeric-formula", "space-formula"]) {
    assert.ok(kinds.has(kind as (typeof CSV_CORPUS)[number]["kind"]), kind);
  }
});

test("isFormulaLike is true for = + - @ TAB and CR at position 0 only", () => {
  for (const lead of ["=", "+", "-", "@", "\t", "\r"]) {
    assert.equal(isFormulaLike(`${lead}1`), true, JSON.stringify(lead));
    assert.equal(isFormulaLike(`x${lead}1`), false, `not at 0: ${JSON.stringify(lead)}`);
  }
  assert.equal(isFormulaLike(" =1"), false);
  assert.equal(isFormulaLike(""), false);
});
