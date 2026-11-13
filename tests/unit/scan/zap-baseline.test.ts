import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseBaseline } from "../../../scripts/scan/threshold-core.ts";
import { REPO } from "./fixtures/index.ts";

// The ZAP baseline records alert types observed on the four local stacks in run 43438922396. Each entry is per
// product (fingerprint product|pluginid), carries a justification, and expires within 90 days (threshold-core).
const RUN = "p5-scans-run-43438922396";
const PRODUCTS = ["cal", "documenso", "medusa", "twenty"];

test("the ZAP baseline parses and every entry names a product, a run and a justification", () => {
  const baseline = parseBaseline(
    readFileSync(join(REPO, "config/scan/baseline/zap.json"), "utf8"),
    "zap",
  );
  assert.equal(baseline.entries.length, 27);
  for (const entry of baseline.entries) {
    const [product, id] = entry.fingerprint.split("|");
    assert.ok(PRODUCTS.includes(product ?? ""), entry.fingerprint);
    assert.match(id ?? "", /^\d+$/, entry.fingerprint);
    assert.equal(entry.ruleId, id, entry.fingerprint);
    assert.equal(entry.path, product, entry.fingerprint);
    assert.equal(entry.reviewRef, RUN, entry.fingerprint);
    assert.ok(entry.justification.length >= 60, `justification too short: ${entry.fingerprint}`);
    assert.equal(entry.expires, "2027-02-11");
  }
});

test("no baseline entry covers a High alert (none was observed, and a High would need its own review)", () => {
  const text = readFileSync(join(REPO, "config/scan/baseline/zap.json"), "utf8");
  assert.doesNotMatch(text, /"High"/);
});
