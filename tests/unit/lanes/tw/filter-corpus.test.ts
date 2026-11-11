import { test } from "node:test";
import assert from "node:assert/strict";
import { FILTER_CORPUS } from "../../../../src/lanes/tw/filter-corpus.ts";

test("FILTER_CORPUS is non-empty data with unique values", () => {
  assert.ok(FILTER_CORPUS.length > 0);
  assert.equal(new Set(FILTER_CORPUS).size, FILTER_CORPUS.length);
});

test("FILTER_CORPUS covers quote, comment, boolean, unicode and operator-injection classes", () => {
  const all = FILTER_CORPUS.join("\n");
  assert.ok(all.includes("'") && all.includes('"') && all.includes("`"), "quote");
  assert.ok(all.includes("--") && all.includes("/*"), "comment");
  assert.ok(
    FILTER_CORPUS.some((v) => /OR\s+'1'='1/.test(v)),
    "boolean",
  );
  assert.ok(all.includes("＇") && all.includes("‮"), "unicode");
  assert.ok(
    FILTER_CORPUS.some((v) => v.includes("$where")),
    "operator injection",
  );
});
