import { test } from "node:test";
import assert from "node:assert/strict";
import { productDefectState } from "../../../../src/lanes/tw-iso/defect-state.ts";

test("productDefectState is fixed when the authenticated cap+1 is refused, whatever the control says", () => {
  assert.equal(productDefectState({ authenticatedRefused: true, anonymousRefused: true }), "fixed");
  assert.equal(
    productDefectState({ authenticatedRefused: true, anonymousRefused: false }),
    "fixed",
  );
});

test("productDefectState is confirmed when only the anonymous control is refused", () => {
  assert.equal(
    productDefectState({ authenticatedRefused: false, anonymousRefused: true }),
    "confirmed",
  );
});

test("productDefectState is unconfirmed when neither request is refused (nothing is declared)", () => {
  assert.equal(
    productDefectState({ authenticatedRefused: false, anonymousRefused: false }),
    "unconfirmed",
  );
});
