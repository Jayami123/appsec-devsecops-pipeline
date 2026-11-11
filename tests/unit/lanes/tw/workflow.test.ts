// Shape tests for .github/workflows/p5-tw.yml (text parsing, like tests/unit/ci/workflow.test.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const workflow = readFileSync(join(root, ".github", "workflows", "p5-tw.yml"), "utf8");

// Splits the workflow into job bodies by scanning the two-space job headers.
function jobBodies(text: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const lines = text.split("\n");
  const starts: Array<{ id: string; index: number }> = [];
  lines.forEach((line, index) => {
    const match = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (match && index > lines.findIndex((l) => /^jobs:\s*$/.test(l))) {
      starts.push({ id: match[1] ?? "", index });
    }
  });
  starts.forEach((start, i) => {
    const end = starts[i + 1]?.index ?? lines.length;
    bodies.set(start.id, lines.slice(start.index, end).join("\n"));
  });
  return bodies;
}

test("p5-tw.yml jobs each have timeout 30 and contents: read", () => {
  const bodies = jobBodies(workflow);
  assert.ok(bodies.size > 0, "expected jobs");
  for (const [id, body] of bodies) {
    assert.match(body, /^ {4}timeout-minutes: 30\b/m, `${id} timeout`);
    assert.match(body, /^ {4}permissions:\n {6}contents: read$/m, `${id} permissions`);
  }
});

test("p5-tw.yml references no secrets expression", () => {
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /^\s*secrets\s*:/m);
});

test("tw-api inverts @multiws and @ssrf (tw-multiws and the SSRF jobs are not built in this build)", () => {
  const body = jobBodies(workflow).get("tw-api") ?? "";
  assert.match(body, /--project=tw --grep-invert "@multiws\|@ssrf"/);
  // tw-multiws (IS_MULTIWORKSPACE_ENABLED=true, --grep @multiws) appears only if it is built.
  if (jobBodies(workflow).has("tw-multiws")) {
    assert.match(jobBodies(workflow).get("tw-multiws") ?? "", /IS_MULTIWORKSPACE_ENABLED: "true"/);
  }
});

test("tw-serial runs --project=tw-serial --no-deps", () => {
  const body = jobBodies(workflow).get("tw-serial") ?? "";
  assert.match(body, /--project=tw-serial --no-deps/);
});

test("every p5-tw job runs harness down under if: always() and passes --trace off", () => {
  for (const [id, body] of jobBodies(workflow)) {
    assert.match(
      body,
      /if: always\(\)\n\s+run: node node_modules\/qa-portfolio-harness\/scripts\/down\.mjs twenty/,
      `${id} down`,
    );
    if (/npx playwright test/.test(body)) assert.match(body, /--trace off/, `${id} trace`);
  }
});
