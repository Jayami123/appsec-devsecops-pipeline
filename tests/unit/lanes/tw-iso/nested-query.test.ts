import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aliasQuery,
  memberIdQuery,
  nestedAliasQuery,
  nestedQuery,
  overFieldsQuery,
  rootAliasQuery,
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
  // workspaceMembers, edges and node are three fields; the rest are aliases of node.userEmail.
  for (const n of [4, 7, 2000]) {
    const document = overFieldsQuery(n);
    const requested = 3 + (document.match(/: userEmail/g) ?? []).length;
    assert.equal(requested, n, `count ${n}`);
  }
  assert.throws(() => overFieldsQuery(3), RangeError);
});

test("nestedAliasQuery(n) has n aliases under one root and no alias of the root", () => {
  const document = nestedAliasQuery(3);
  assert.equal((document.match(/workspaceMembers\(/g) ?? []).length, 1);
  assert.deepEqual(
    [...document.matchAll(/(a\d+): userEmail/g)].map((m) => m[1]),
    ["a1", "a2", "a3"],
  );
});

test("rootAliasQuery(n) aliases one real root field n times", () => {
  const document = rootAliasQuery(4);
  assert.equal((document.match(/: workspaceMembers\(first: 1\)/g) ?? []).length, 4);
});

test("memberIdQuery selects a real field of the collection", () => {
  assert.equal(memberIdQuery(), "{ workspaceMembers(first: 1) { edges { node { id } } } }");
});
