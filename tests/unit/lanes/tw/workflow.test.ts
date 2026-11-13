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

test("tw-api inverts @multiws and @ssrf (the SSRF rows are gated, D-TW-B37)", () => {
  const body = jobBodies(workflow).get("tw-api") ?? "";
  assert.match(body, /--project=tw --grep-invert "@multiws\|@ssrf"/);
});

test("tw-multiws runs the @multiws rows on the README recipe, pinned to ubuntu-24.04", () => {
  const body = jobBodies(workflow).get("tw-multiws") ?? "";
  assert.ok(body.length > 0, "tw-multiws job exists");
  assert.match(body, /^ {4}runs-on: ubuntu-24\.04$/m);
  assert.match(body, /^ {6}IS_MULTIWORKSPACE_ENABLED: "true"$/m);
  assert.match(body, /^ {6}IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS: "false"$/m);
  assert.match(body, /^ {6}TWENTY_BASE_URL: "http:\/\/lvh\.me:3002"$/m);
  assert.match(body, /npx playwright test --project=tw --grep "@multiws" --trace off/);
  assert.doesNotMatch(body, /^\s+TWENTY_SERVER_REPLICAS:/m);
  assert.doesNotMatch(body, /secrets\./);
});

test("tw-multiws copies the tw-api reporter, sanitise and artifact steps with its own label", () => {
  const api = jobBodies(workflow).get("tw-api") ?? "";
  const multi = jobBodies(workflow).get("tw-multiws") ?? "";
  assert.match(multi, /node scripts\/prepare-ci-artifacts\.ts tw-multiws /);
  assert.match(
    multi,
    /node scripts\/write-ci-job-summary\.ts tw-multiws results\/playwright-tw-multiws\.json/,
  );
  assert.match(multi, /name: p5-tw-multiws-report/);
  for (const step of [
    "Check out the repository",
    "Set up Node.js from .nvmrc",
    "Install",
    "Bootstrap twenty",
    "Stop twenty",
  ]) {
    assert.ok(api.includes(`- name: ${step}`), `tw-api has ${step}`);
    assert.ok(multi.includes(`- name: ${step}`), `tw-multiws has ${step}`);
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
