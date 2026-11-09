import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoPrivateExtras, isPrivateEntry } from "../../../src/security/findings.ts";

test("isPrivateEntry accepts exactly id and status", () => {
  assert.equal(isPrivateEntry({ id: "P5-XYZ-001", status: "held-private" }), true);
});

test("isPrivateEntry rejects any extra key", () => {
  assert.equal(isPrivateEntry({ id: "P5-XYZ-001", status: "held-private", title: "x" }), false);
});

test("assertNoPrivateExtras throws PRIVATE_FIELD_REJECTED for title", () => {
  const entry = { id: "P5-XYZ-001", status: "held-private", title: "x" };
  assert.throws(() => {
    assertNoPrivateExtras(entry);
  }, /^Error: PRIVATE_FIELD_REJECTED: title$/);
});

test("assertNoPrivateExtras throws for note", () => {
  const entry = { id: "P5-XYZ-001", status: "held-private", note: "x" };
  assert.throws(() => {
    assertNoPrivateExtras(entry);
  }, /^Error: PRIVATE_FIELD_REJECTED: note$/);
});
