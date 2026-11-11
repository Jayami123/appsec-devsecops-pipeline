import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { parseDefectDescription } from "../../../../src/kit/ci/known-defect.ts";
import { findDefectCallArguments, listTsFiles } from "../../../../src/kit/ci/known-defect-guard.ts";

test("K6-P5 every expectedDefect call has a resolvable ID and evidence", () => {
  const files = listTsFiles(process.cwd(), ["tests", "src"]);
  const calls = files.flatMap((file) =>
    findDefectCallArguments(file, readFileSync(join(process.cwd(), file), "utf8")),
  );
  assert.ok(calls.length > 0, "the first expectedDefect usage is in this PR");
  for (const call of calls) {
    assert.ok(
      call.value !== undefined && call.value.length > 0,
      `${call.path}:${String(call.line)}: expectedDefect argument is not a resolvable string literal`,
    );
    const parsed = parseDefectDescription(call.value);
    assert.ok(parsed.id.length > 0, `${call.path}:${String(call.line)}: empty defect id`);
    assert.ok(parsed.evidence.length > 0, `${parsed.id} has no evidence`);
  }
});

test("K6-P5 a string-literal argument resolves and a non-literal does not", () => {
  const valid = findDefectCallArguments(
    "valid.ts",
    'const ID = "P5-DOC-X: file.ts:1";\nexpectedDefect(ID);\nexpectedDefect("P5-DOC-Y: file.ts:2");\n',
  );
  assert.equal(valid.length, 2);
  assert.equal(valid[0]?.value, "P5-DOC-X: file.ts:1");
  assert.equal(valid[1]?.value, "P5-DOC-Y: file.ts:2");
  parseDefectDescription("P5-DOC-X: file.ts:1");
  const invalid = findDefectCallArguments(
    "invalid.ts",
    'const id = ["P5-DOC-Z", "file.ts:3"].join(": ");\nexpectedDefect(id);\n',
  );
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0]?.value, undefined);
});
