import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..", "..");
const workflowPath = join(root, ".github", "workflows", "p5-med.yml");
const workflow = readFileSync(workflowPath, "utf8");
const SECRET_NAMES = [
  "MEDUSA_ADMIN_EMAIL",
  "MEDUSA_ADMIN_PASSWORD",
  "STRIPE_API_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

interface Job {
  readonly name: string;
  readonly lines: readonly string[];
}

/** Top-level jobs, by the two-space key under `jobs:`. Line-based: no YAML dependency is added. */
function jobsOf(text: string): Job[] {
  const lines = text.split("\n");
  const start = lines.indexOf("jobs:");
  const jobs: Job[] = [];
  let current: Job | undefined;
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}([a-z][a-z0-9-]*):\s*$/.exec(line);
    if (match) {
      current = { name: match[1] ?? "", lines: [] };
      jobs.push(current);
    } else if (current) {
      (current.lines as string[]).push(line);
    }
  }
  return jobs;
}

/** Steps as blocks: each starts at a line `      - name:` or `      - uses:` / `      - run:`. */
function stepsOf(lines: readonly string[]): { name: string; body: string }[] {
  const steps: { name: string; body: string }[] = [];
  let current: { name: string; lines: string[] } | undefined;
  for (const line of lines) {
    const named = /^ {6}- name:\s*(.*)$/.exec(line);
    if (named) {
      current = { name: named[1] ?? "", lines: [line] };
      steps.push({ name: current.name, body: "" });
      continue;
    }
    if (/^ {6}- (uses|run):/.test(line)) {
      current = { name: "", lines: [line] };
      steps.push({ name: "", body: "" });
      continue;
    }
    if (current) current.lines.push(line);
    if (current) steps[steps.length - 1] = { name: current.name, body: current.lines.join("\n") };
  }
  return steps;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

test("p5-med.yml keeps the four optional workflow_call secrets", () => {
  for (const name of SECRET_NAMES) {
    assert.match(workflow, new RegExp(`${name}:\\s*\\n\\s*required: false`), name);
  }
});

test("every p5-med job has timeout 30 and contents: read", () => {
  const jobs = jobsOf(workflow);
  assert.ok(jobs.length >= 2, "expected at least two lane jobs");
  for (const job of jobs) {
    const body = job.lines.join("\n");
    assert.match(body, /^ {4}timeout-minutes: 30\b/m, job.name);
    assert.match(body, /^ {6}contents: read$/m, job.name);
  }
});

test("MEDUSA_ADMIN_* appear only as step env on the start, seed and playwright steps and STRIPE_* in no step", () => {
  const allowedStepNames = /^(Start medusa|Seed medusa|Run the med|Run the med-serial)/;
  for (const job of jobsOf(workflow)) {
    for (const step of stepsOf(job.lines)) {
      const usesAdmin = step.body.includes("MEDUSA_ADMIN_");
      if (usesAdmin) {
        assert.match(
          step.name,
          allowedStepNames,
          `${job.name}: unexpected admin secret in step "${step.name}"`,
        );
        assert.match(step.body, /^ {8}env:\s*$/m, `${job.name}: admin secret must be step env`);
      }
      assert.equal(
        step.body.includes("STRIPE_"),
        false,
        `${job.name}: Stripe secret in step "${step.name}"`,
      );
    }
  }
});

test("med-serial runs --project=med-serial --no-deps", () => {
  const serial = jobsOf(workflow).find((job) => job.name === "med-serial");
  assert.ok(serial, "med-serial job is required");
  assert.ok(
    serial.lines.some((line) =>
      line.includes("npx playwright test --project=med-serial --no-deps"),
    ),
    "med-serial run command",
  );
});

test("every p5-med job runs harness down under if: always() and passes --trace off", () => {
  for (const job of jobsOf(workflow)) {
    const stop = stepsOf(job.lines).find((step) =>
      step.body.includes("qa-portfolio-harness/scripts/down.mjs medusa"),
    );
    assert.ok(stop, `${job.name}: harness down step`);
    assert.match(stop.body, /if: always\(\)/, `${job.name}: down must run under always()`);
    const runs = job.lines.filter((line) => /npx playwright test/.test(line));
    for (const line of runs) {
      assert.match(line, /--trace off/, `${job.name}: ${line.trim()}`);
    }
  }
});

test("no src/lanes/med or tests/*/med file references MEDUSA_ADMIN_", () => {
  const files = [
    ...walk(join(root, "src", "lanes", "med")),
    ...["contracts", "webhooks", "integration", "serial", "ui"].flatMap((kind) => {
      const dir = join(root, "tests", kind, "med");
      try {
        return walk(dir);
      } catch {
        return [];
      }
    }),
  ];
  for (const file of files) {
    assert.equal(
      readFileSync(file, "utf8").includes("MEDUSA_ADMIN_"),
      false,
      `${relative(root, file)} must not reference MEDUSA_ADMIN_`,
    );
  }
});

// Round-two fix (D-MED-B41): the harness calls a bare `pnpm`; the hosted runner has none (CI run 42969782653).
// Each med job must put pnpm 10.11.1 on PATH before Bootstrap and Start medusa.
test("every p5-med job puts pnpm 10.11.1 on PATH before Bootstrap and Start medusa", () => {
  const pnpmRun = "npm install -g pnpm@10.11.1 && pnpm --version";
  for (const job of jobsOf(workflow)) {
    const steps = stepsOf(job.lines);
    const indexOf = (predicate: (step: { name: string; body: string }) => boolean) =>
      steps.findIndex(predicate);
    const pnpm = indexOf(
      (step) => step.name.startsWith("Put pnpm on PATH") && step.body.includes(pnpmRun),
    );
    const bootstrap = indexOf((step) => step.name === "Bootstrap medusa");
    const start = indexOf((step) => step.name === "Start medusa");
    assert.ok(pnpm >= 0, `${job.name}: pnpm step with the exact pinned install is required`);
    assert.ok(pnpm < bootstrap, `${job.name}: pnpm step must run before Bootstrap medusa`);
    assert.ok(bootstrap < start, `${job.name}: Bootstrap medusa must run before Start medusa`);
  }
});

test("every action in p5-med.yml is pinned to a full commit SHA and no pnpm action is used", () => {
  const uses = [...workflow.matchAll(/^\s*(?:- )?uses:\s*(\S+)/gm)].map((match) => match[1] ?? "");
  assert.ok(uses.length >= 2, "expected pinned actions");
  for (const ref of uses) {
    assert.match(ref, /@[0-9a-f]{40}$/, `${ref} must be pinned to a full commit SHA`);
    assert.doesNotMatch(
      ref,
      /pnpm/i,
      `${ref}: pnpm is installed by the pinned npm step, not an action`,
    );
  }
});
