// Shape tests for .github/workflows/p5-doc.yml (doc plan section 5, D-DOC-B9, D-DOC-B16). Text parsing, as in
// tests/unit/ci/workflow.test.ts: no YAML library is a declared dependency.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const lane = readFileSync(join(root, ".github", "workflows", "p5-doc.yml"), "utf8");

/** The text of one job, from its `  <name>:` line to the next job line or end of file. */
function jobBlock(name: string): string {
  const lines = lane.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^ {2}[a-z][a-z-]*:\s*$/.test(line));
  return (next < 0 ? rest : rest.slice(0, next)).join("\n");
}

test("p5-doc.yml has doc-api and doc-serial, each timeout 60 and contents: read", () => {
  for (const name of ["doc-api", "doc-serial"]) {
    const body = jobBlock(name);
    assert.ok(body.length > 0, `${name} job missing`);
    assert.match(body, /^ {4}timeout-minutes: 60\b/m, `${name} timeout`);
    assert.match(body, /^ {6}contents: read$/m, `${name} permissions`);
  }
});

test("doc-serial needs doc-api and runs --project=doc-serial --no-deps", () => {
  assert.match(jobBlock("doc-serial"), /^ {4}needs: \[doc-api\]$/m);
  assert.match(lane, /npx playwright test --project=doc-serial --no-deps --trace off/);
});

test("p5-doc.yml references no secrets expression", () => {
  assert.doesNotMatch(lane, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(lane, /^\s*secrets\s*:/m);
});

test("every p5-doc job pins NODE24 from setup-node 24.22.0 and runs harness down under if: always()", () => {
  for (const name of ["doc-api", "doc-serial"]) {
    const body = jobBlock(name);
    assert.match(body, /node-version: 24\.22\.0/, `${name} Node 24 pin`);
    assert.match(body, /NODE24=\$\(command -v node\)/, `${name} NODE24 capture`);
    // The step that stops the stack: its if: always() is the line directly above its run: line.
    const lines = body.split("\n");
    const downRun = lines.findIndex((line) => line.includes("scripts/down.mjs documenso"));
    assert.ok(downRun > 0, `${name} down step`);
    assert.equal(
      lines[downRun - 1]?.trim(),
      "if: always()",
      `${name} down is not under if: always()`,
    );
  }
});

test("every p5-doc playwright step passes --trace off", () => {
  const runs = [...lane.matchAll(/npx playwright test[^\n]*/g)].map((m) => m[0]);
  assert.ok(runs.length >= 2, "expected one playwright run per job");
  for (const run of runs) assert.match(run, /--trace off/, run);
});
