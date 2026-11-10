import { test } from "node:test";
import assert from "node:assert/strict";
import { URL_GUARD_CORPUS, type GuardClass } from "../../../../src/lanes/doc/url-guard-corpus.ts";

// WHATWG URL parsing maps the decimal and hex IPv4 forms to the dotted loopback host. Those two entries
// are deliberate bypass probes (D-DOC-B18), so they are the only allowed collisions after normalisation.
const ALIAS_IDS = ["loopback-decimal", "loopback-hex"] as const;
const DOTTED_LOOPBACK_ID = "loopback-dotted";

test("url guard corpus entries all parse with new URL()", () => {
  for (const entry of URL_GUARD_CORPUS) {
    assert.doesNotThrow(() => new URL(entry.url), entry.id);
  }
});

test("url guard corpus covers loopback, private, link-local and IPv6 forms", () => {
  const classes = new Set<GuardClass>(URL_GUARD_CORPUS.map((entry) => entry.class));
  for (const required of ["loopback", "private", "link-local", "ipv6"] as const) {
    assert.ok(classes.has(required), `missing class ${required}`);
  }
});

test("url guard corpus has no duplicates after normalisation", () => {
  const href = (id: string): string => {
    const entry = URL_GUARD_CORPUS.find((e) => e.id === id);
    assert.ok(entry, `missing corpus entry ${id}`);
    return new URL(entry.url).href;
  };
  const distinct = URL_GUARD_CORPUS.filter((e) => !ALIAS_IDS.includes(e.id as never)).map(
    (e) => new URL(e.url).href,
  );
  assert.equal(new Set(distinct).size, distinct.length, "duplicate entry after normalisation");
  for (const alias of ALIAS_IDS) {
    assert.equal(href(alias), href(DOTTED_LOOPBACK_ID), `${alias} is not the dotted loopback`);
  }
});
