import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const text = readFileSync(".github/workflows/p5-cal.yml", "utf8");
/** Job name -> its lines (2-space job keys under `jobs:`). */
function jobs(source: string): Map<string, string> {
  const body = source.split(/^jobs:\s*$/m)[1] ?? "";
  const out = new Map<string, string>();
  for (const chunk of body.split(/^(?= {2}[a-z0-9-]+:\s*$)/m)) {
    const name = /^ {2}([a-z0-9-]+):/.exec(chunk)?.[1];
    if (name) out.set(name, chunk);
  }
  return out;
}

const byJob = jobs(text);

test("p5-cal.yml has cal-api, cal-ui and cal-serial jobs, each timeout 30 and contents: read", () => {
  assert.deepEqual([...byJob.keys()].sort(), ["cal-api", "cal-serial", "cal-ui"]);
  for (const [name, body] of byJob) {
    assert.match(body, /^ {4}timeout-minutes: 30\b/m, `${name} timeout`);
    assert.match(body, /^ {6}contents: read$/m, `${name} permissions`);
  }
});

test("p5-cal.yml references no secrets expression", () => {
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
  assert.doesNotMatch(text, /^\s*secrets\s*:/m);
});

test("cal-serial runs --project=cal-serial --no-deps", () => {
  const body = byJob.get("cal-serial") ?? "";
  assert.match(body, /npx playwright test --project=cal-serial --no-deps/);
});

test("every p5-cal job runs harness down under if: always()", () => {
  for (const [name, body] of byJob) {
    assert.match(
      body,
      /if: always\(\)\n\s+run: node node_modules\/qa-portfolio-harness\/scripts\/down\.mjs cal/,
      name,
    );
  }
});

test("every p5-cal playwright step passes --trace off", () => {
  const runs = text.match(/npx playwright test[^\n]*/g) ?? [];
  assert.ok(runs.length >= 2, "expected one playwright run per job");
  for (const run of runs) {
    assert.match(run, /--trace off/, run);
  }
});
