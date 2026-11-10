import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aliasQuery,
  nestedQuery,
  overFieldsQuery,
  shallowQuery,
} from "../../../../src/lanes/tw-iso/fixtures/nested-query.ts";

test("shallowQuery is a single-level document", () => {
  assert.equal(shallowQuery(), "{ __typename }");
  assert.equal((shallowQuery().match(/\{/g) ?? []).length, 1);
});

test("nestedQuery(depth) nests exactly depth selection sets", () => {
  for (const depth of [1, 5, 64]) {
    const document = nestedQuery(depth);
    // The operation braces are one selection set; the rest are the depth levels.
    assert.equal((document.match(/\{/g) ?? []).length, depth + 1, `depth ${depth}`);
  }
  assert.throws(() => nestedQuery(0), RangeError);
});

test("aliasQuery(n) has n unique aliases of one root field", () => {
  const document = aliasQuery(3);
  const aliases = [...document.matchAll(/(a\d+): __typename/g)].map((m) => m[1]);
  assert.deepEqual(aliases, ["a1", "a2", "a3"]);
  assert.equal(new Set(aliases).size, 3);
});

test("overFieldsQuery(n) requests exactly n fields", () => {
  const document = overFieldsQuery(7);
  // One root field plus n - 1 aliased scalar fields.
  const requested = 1 + (document.match(/: email/g) ?? []).length;
  assert.equal(requested, 7);
  assert.throws(() => overFieldsQuery(1), RangeError);
});
