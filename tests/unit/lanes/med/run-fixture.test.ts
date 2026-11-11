import { test } from "node:test";
import assert from "node:assert/strict";
import { findLeaks } from "../../../../src/lanes/med/run-fixture.ts";

test("findLeaks returns the labels of probes still present", async () => {
  const leaked = await findLeaks([
    { label: "a", stillPresent: () => Promise.resolve(true) },
    { label: "b", stillPresent: () => Promise.resolve(false) },
    { label: "c", stillPresent: () => Promise.resolve(true) },
  ]);
  assert.deepEqual(leaked, ["a", "c"]);
});

test("findLeaks returns an empty list when every probe is gone", async () => {
  assert.deepEqual(
    await findLeaks([{ label: "a", stillPresent: () => Promise.resolve(false) }]),
    [],
  );
});
