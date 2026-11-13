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

test("p5-doc.yml has doc-api, doc-serial and doc-oidc, each timeout 60 and contents: read", () => {
  for (const name of ["doc-api", "doc-serial", "doc-oidc"]) {
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
  for (const name of ["doc-api", "doc-serial", "doc-oidc"]) {
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

test("every doc job runs on ubuntu-24.04 and their bootstrap step skips browser downloads", () => {
  for (const name of ["doc-api", "doc-serial", "doc-oidc"]) {
    const body = jobBlock(name);
    assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/m, `${name} runner pin`);
    assert.doesNotMatch(body, /runs-on: ubuntu-latest/, `${name} must not float to ubuntu-latest`);
    // The bootstrap step carries the skip variable in its own env block (the product install only).
    const start = body.indexOf("      - name: Bootstrap documenso");
    assert.ok(start >= 0, `${name} bootstrap step`);
    const step = body.slice(
      start,
      body.indexOf("\n      - name:", start + 1) < 0
        ? undefined
        : body.indexOf("\n      - name:", start + 1),
    );
    assert.match(
      step,
      /^ {10}PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"$/m,
      `${name} skip variable on bootstrap`,
    );
    assert.match(step, /run: bash scripts\/bootstrap\.sh documenso/, `${name} bootstrap command`);
  }
});

test("every doc job prints masked Documenso web log evidence only on failure", () => {
  for (const name of ["doc-api", "doc-serial", "doc-oidc"]) {
    const body = jobBlock(name);
    const start = body.indexOf("      - name: Documenso web log");
    assert.ok(start >= 0, `${name} evidence step`);
    const step = body.slice(start, body.indexOf("      - name: Stop documenso", start));
    assert.match(step, /^ {8}if: failure\(\)$/m, `${name} evidence runs only on failure`);
    assert.match(step, /documenso-web\.log/, `${name} evidence reads the server log`);
    assert.match(step, /sed -E .*\*\*\*/, `${name} evidence masks credential values`);
  }
});

// The OIDC rows (D-DOC-B72): their own job, the mock provider on that job only, and the stock jobs keep the stock stack.
test("doc-oidc sets DOCUMENSO_OIDC to exactly 1 on the start step and nowhere else", () => {
  // Comment lines may name the flag; the assertion counts only lines that set it.
  const flagLines = lane
    .split("\n")
    .filter((line) => !line.trim().startsWith("#") && line.includes("DOCUMENSO_OIDC"));
  assert.equal(flagLines.length, 1, "one DOCUMENSO_OIDC setting in the workflow");
  const body = jobBlock("doc-oidc");
  const start = body.indexOf("      - name: Start documenso with the mock OIDC provider");
  assert.ok(start >= 0, "doc-oidc start step");
  const step = body.slice(start, body.indexOf("\n      - name:", start + 1));
  assert.match(step, /^ {10}DOCUMENSO_OIDC: "1"$/m, "flag on the start step");
  assert.match(step, /run: node node_modules\/qa-portfolio-harness\/scripts\/up\.mjs documenso/);
  assert.doesNotMatch(jobBlock("doc-api"), /DOCUMENSO_OIDC/, "stock job has no flag");
  assert.doesNotMatch(jobBlock("doc-serial"), /DOCUMENSO_OIDC/, "serial job has no flag");
});

test("the stock doc-api job excludes the OIDC titles, and doc-oidc runs only them", () => {
  assert.match(
    jobBlock("doc-api"),
    /npx playwright test --project=doc --grep-invert "OIDC-00" --trace off/,
  );
  assert.match(
    jobBlock("doc-oidc"),
    /npx playwright test --project=doc --grep "OIDC-00" --trace off/,
  );
  assert.match(jobBlock("doc-oidc"), /prepare-ci-artifacts\.ts doc-oidc /);
  assert.match(jobBlock("doc-oidc"), /write-ci-job-summary\.ts doc-oidc /);
  assert.match(jobBlock("doc-oidc"), /name: p5-doc-oidc-report/);
});

test("doc-oidc needs no other job and runs on its own stack", () => {
  assert.doesNotMatch(jobBlock("doc-oidc"), /^ {4}needs:/m);
});

// The harness state folder (web log, env) is never an upload path (owner instruction, round 10).
test("no p5-doc upload path names the harness state folder", () => {
  const uploads = [
    ...lane.matchAll(/uses: actions\/upload-artifact@[^\n]*\n(?:[^\n]*\n){1,12}?/g),
  ].map((m) => m[0]);
  assert.ok(uploads.length >= 3, "one upload per doc job");
  for (const block of uploads) {
    assert.doesNotMatch(block, /\.harness/, block);
    assert.doesNotMatch(block, /documenso-web\.log/, block);
  }
});
