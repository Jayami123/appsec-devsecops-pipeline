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

/** Each step of a job body: its name and its full text (steps start at 6-space `- name:`). */
function stepsOf(jobBody: string): Array<{ name: string; text: string }> {
  return jobBody
    .split(/^(?= {6}- name: )/m)
    .filter((chunk) => /^ {6}- name: /.test(chunk))
    .map((chunk) => ({ name: /^ {6}- name: (.+)$/m.exec(chunk)?.[1] ?? "", text: chunk }));
}

test("p5-cal.yml reads STRIPE_API_KEY and no other secret, only at step level on the gate, harness start and lane steps (D-CAL-B58)", () => {
  // Every secret reference in the file names the one approved secret.
  const names = [...text.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  assert.ok(names.length > 0, "expected the Stripe secret reference");
  assert.deepEqual([...new Set(names)], ["STRIPE_API_KEY"]);
  assert.doesNotMatch(text, /secrets:\s*inherit/);
  for (const [job, body] of byJob) {
    const steps = stepsOf(body);
    const withSecret = steps.filter((s) => s.text.includes("${{ secrets.STRIPE_API_KEY }}"));
    // This job's lane run step: the only step whose run line calls npx playwright test.
    const laneRun = steps.filter((s) => /npx playwright test/.test(s.text)).map((s) => s.name);
    assert.equal(laneRun.length, 1, `${job}: one lane run step`);
    assert.deepEqual(
      withSecret.map((s) => s.name).sort(),
      ["Require the Stripe test key (never printed)", "Start cal", ...laneRun].sort(),
      `${job}: secret on the gate, Start cal and this job's lane run only`,
    );
    for (const step of withSecret) {
      assert.match(
        step.text,
        /^ {8}env:\n {10}STRIPE_API_KEY: \$\{\{ secrets\.STRIPE_API_KEY \}\}$/m,
        `${job}/${step.name}: step-level env`,
      );
    }
  }
});

test("the sk_test_ gate runs before harness up in every p5-cal job and fails closed (D-CAL-B58)", () => {
  for (const [job, body] of byJob) {
    const steps = stepsOf(body);
    const gateIndex = steps.findIndex(
      (s) => s.name === "Require the Stripe test key (never printed)",
    );
    const startIndex = steps.findIndex((s) => s.name === "Start cal");
    assert.ok(gateIndex >= 0, `${job}: gate step present`);
    assert.ok(gateIndex < startIndex, `${job}: gate runs before Start cal`);
    const gate = steps[gateIndex]?.text ?? "";
    assert.match(gate, /sk_test_\*\)/, `${job}: gate matches the test-mode prefix`);
    assert.match(gate, /exit 1/, `${job}: gate fails closed`);
    assert.doesNotMatch(gate, /echo[^\n]*\$STRIPE_API_KEY/, `${job}: gate never echoes the value`);
  }
});

test("no p5-cal job or workflow sets a job-level or workflow-level env (D-CAL-B58)", () => {
  assert.doesNotMatch(text, /^env:/m, "workflow-level env");
  for (const [job, body] of byJob) {
    assert.doesNotMatch(body, /^ {4}env:/m, `${job}: job-level env`);
  }
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

test("p5-cal.yml never sets or reads P5_CHROMIUM_PATH (local-only override, D-CAL-B47)", () => {
  assert.doesNotMatch(text, /P5_CHROMIUM_PATH/);
});
