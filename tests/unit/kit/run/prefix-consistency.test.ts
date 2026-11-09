// F0-2 (plan 7.2.2, item 3): the run-prefix pattern, the reaper's run-start parser and the sweep
// engine's run-start parser must agree on the same names.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { runStartIso } from "../../../../src/kit/invariants/engine.ts";
import { runStartedAt } from "../../../../src/kit/auth/reaper.ts";
import { RUN_PREFIX_PATTERN } from "../../../../src/kit/run/prefix.ts";

const VALID_PREFIXES = ["p5-qa-20261101t090000z-0a1b2c3d", "p5-qa-20261021t093005z-1a2b3c4d"];
const INVALID_PREFIXES = [
  "",
  "p2-qa-20261101t090000z-0a1b2c3d", // the retired P2 namespace
  "xp5-qa-20261101t090000z-0a1b2c3d", // prefix is not anchored at the start
  "p5-qa-20261101t090000z-0A1B2C3D", // uppercase hex
  "p5-qa-20261101t09000z-0a1b2c3d", // short time
  "p5-qa-20261101t090000z-0a1b2c3", // short hex
  "p5-qa-20261101t090000Z-0a1b2c3d", // uppercase Z
  "p5-qa-oops",
  " p5-qa-20261101t090000z-0a1b2c3d", // leading space
];

const engineAccepts = (name: string): boolean => {
  try {
    runStartIso(name);
    return true;
  } catch {
    return false;
  }
};

describe("run-prefix consistency across the pattern, the reaper and the engine", () => {
  test("pattern, reaper and engine agree on every prefix-shaped name, valid and invalid", () => {
    for (const name of [...VALID_PREFIXES, ...INVALID_PREFIXES]) {
      const pattern = RUN_PREFIX_PATTERN.test(name);
      const engine = engineAccepts(name);
      const reaper = runStartedAt(name) !== undefined;
      assert.equal(engine, pattern, `engine vs pattern for ${JSON.stringify(name)}`);
      assert.equal(reaper, pattern, `reaper vs pattern for ${JSON.stringify(name)}`);
    }
  });

  test("the reaper accepts a run-scoped name, while the pattern and engine take only the bare prefix", () => {
    for (const prefix of VALID_PREFIXES) {
      const scoped = `${prefix}-tw-cart-1`;
      assert.notEqual(runStartedAt(`${prefix}-extra`), undefined, `${prefix}-extra`);
      assert.equal(RUN_PREFIX_PATTERN.test(`${prefix}-extra`), false);
      assert.equal(RUN_PREFIX_PATTERN.test(scoped), false, scoped);
      assert.equal(engineAccepts(scoped), false, scoped);
      assert.notEqual(runStartedAt(scoped), undefined, scoped);
      assert.equal(runStartedAt(scoped), runStartedAt(prefix), scoped);
    }
  });
});
