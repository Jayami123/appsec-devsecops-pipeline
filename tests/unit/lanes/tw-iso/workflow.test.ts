import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..", "..");
const workflow = readFileSync(join(root, ".github", "workflows", "p5-tw-iso.yml"), "utf8");

test("p5-tw-iso.yml has one tw-iso job with timeout 30, contents: read and no secrets key", () => {
  const jobNames = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(jobNames, ["tw-iso"]);
  assert.match(workflow, /^ {4}timeout-minutes: 30\b/m);
  assert.match(workflow, /^ {4}permissions:\s*\n {6}contents: read\s*$/m);
  assert.doesNotMatch(workflow, /^\s*secrets\s*:/m);
  assert.doesNotMatch(workflow, /secrets:\s*inherit/);
});

test("the tw-iso job runs the canary proof before playwright and harness down under if: always()", () => {
  const proof = workflow.indexOf("node src/lanes/tw-iso/canary-proof.ts");
  const playwright = workflow.indexOf("npx playwright test --project=tw-iso");
  const down = workflow.indexOf("node node_modules/qa-portfolio-harness/scripts/down.mjs twenty");
  assert.ok(proof > 0 && playwright > proof, "canary proof must precede playwright");
  assert.ok(down > playwright, "harness down must follow playwright");
  const downStep = workflow.slice(workflow.lastIndexOf("- name:", down), down);
  assert.match(downStep, /if: always\(\)/);
});

test("the tw-iso playwright step passes --trace off", () => {
  assert.match(workflow, /npx playwright test --project=tw-iso --trace off/);
});

test("p5-tw-iso.yml sets no NODE24 and no DANGEROUS_BYPASS_RATE_LIMITS", () => {
  assert.doesNotMatch(workflow, /NODE24/);
  assert.doesNotMatch(workflow, /DANGEROUS_BYPASS_RATE_LIMITS/);
  assert.doesNotMatch(workflow, /P5-STUB/);
});
