import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { REPO, scratch, writeTree } from "./fixtures/index.ts";

// PN-7 prints the file, the line and the rule label. The matched text is never printed. These are synthetic
// values assembled at runtime; no committed file holds a token.
const SCANNER = join(REPO, "scripts/scan/evidence-token-scan.mjs");
const SECRET = ["zz", "Q9fakeValueABCDEF123456"].join("");

function run(files: Record<string, string>): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const dir = scratch("pn7-rules");
  writeTree(dir, files);
  const result = spawnSync(process.execPath, [SCANNER, dir], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
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

test("a name=value hit in a query string is labelled position=query with an opaque value, never the value", () => {
  const query = ["AbC123xYz9QwErTyUiOp", "0987654321abcdef"].join("");
  const result = run({ "a.json": `"uri": "https://x.test/a?token=${query}"\n` });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /key=token position=query value=32-63 charset=opaque/);
  assert.doesNotMatch(result.stderr, new RegExp(query));
});

test("a name=value assignment whose value is script code is NOT a hit (narrowed false match)", () => {
  const result = run({ "app.js": 'var a=b.token=e.token;\nvar p=document.getElementById("x");\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(`${result.stdout}${result.stderr}`, /token scan: clean/);
});

test("a JWT-shaped credential in a name=value assignment is still a hit (narrowing keeps the true case)", () => {
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJlMTIzNDU2"].join(".");
  const result = run({ "page.html": `<a href="/x?token=${jwt}">x</a>\n` });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /rule name=value assignment \(password, secret or token\) key=token/);
  assert.doesNotMatch(result.stderr, new RegExp(jwt.slice(0, 20)));
});
