import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const SERIAL = join(process.cwd(), "tests/serial/doc");

test("zz-schemathesis.spec.ts is the last spec in tests/serial/doc", () => {
  const specs = readdirSync(SERIAL)
    .filter((name) => name.endsWith(".spec.ts"))
    .sort();
  assert.equal(specs.at(-1), "zz-schemathesis.spec.ts");
});

test("the Schemathesis hook sets application/json when a generated request omitted a content-type", () => {
  const hook = readFileSync(join(process.cwd(), "src/lanes/doc/doc_schemathesis_hooks.py"), "utf8");
  assert.match(hook, /content-type/);
  assert.match(hook, /application\/json/);
  assert.match(hook, /P5_DOC_FUZZ_COOKIE/);
});
