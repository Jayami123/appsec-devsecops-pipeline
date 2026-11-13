import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { REPO, scratch, writeTree } from "./fixtures/index.ts";

// PN-7 prints the file, the line and the rule label. The matched text is never printed. These are synthetic
// values assembled at runtime; no committed file holds a token.
const SCANNER = join(REPO, "scripts/scan/evidence-token-scan.mjs");
const SECRET = ["zz", "Q9fakeValueABCDEF123456"].join("");

function run(files: Record<string, string>): { status: number | null; stderr: string } {
  const dir = scratch("pn7-rules");
  writeTree(dir, files);
  const result = spawnSync(process.execPath, [SCANNER, dir], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

test("a matched line prints its file, line and rule label and exits 1", () => {
  const result = run({ "page.html": `<p>clean</p>\nBearer ${SECRET}\n` });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TOKEN PATTERN: page\.html line 2 rule Bearer header text/);
});

test("the output never contains the matched value", () => {
  const result = run({ "page.html": `Bearer ${SECRET}\n`, "q.json": `{"x": "api_${SECRET}"}\n` });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, new RegExp(SECRET));
});

test("the same line with no rule shape prints clean and exits 0", () => {
  const result = run({ "page.html": "<p>Bearers of news</p>\n" });
  assert.equal(result.status, 0);
});
