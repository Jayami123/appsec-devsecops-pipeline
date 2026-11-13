import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNoPrivateExtras, isPrivateEntry } from "../../../src/security/findings.ts";

test("isPrivateEntry accepts exactly id and status", () => {
  assert.equal(isPrivateEntry({ id: "P5-XYZ-001", status: "held-private" }), true);
});

test("isPrivateEntry accepts the confirmed-product-bug status with id and status only", () => {
  assert.equal(isPrivateEntry({ id: "NEW-XYZ-1", status: "confirmed-product-bug" }), true);
  assert.equal(
    isPrivateEntry({ id: "NEW-XYZ-1", status: "confirmed-product-bug", title: "x" }),
    false,
  );
});

test("isPrivateEntry rejects a status outside the private set", () => {
  assert.equal(isPrivateEntry({ id: "P5-XYZ-001", status: "verified" }), false);
  assert.equal(isPrivateEntry({ id: "P5-XYZ-001", status: "" }), false);
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
