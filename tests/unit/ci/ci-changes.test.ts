// Classifier tests for scripts/ci-changes.sh (plan 9.5). Each "only" test also asserts p5_scans=true on
// pull_request and push, and p5_codeql=true, because every lane path also matches the CodeQL path rule.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../../../scripts/ci-changes.sh", import.meta.url));
const ZERO = "0000000000000000000000000000000000000000";
const BEFORE = "1111111111111111111111111111111111111111";
const LANES = ["p5_cal", "p5_doc", "p5_med", "p5_tw", "p5_tw_iso", "p5_x"] as const;
type Lane = (typeof LANES)[number];
type Flags = Record<Lane | "p5_codeql" | "p5_scans", boolean>;

function classify(paths: string[], event: string, before?: string): Flags {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    EVENT_NAME: event,
  };
  if (before !== undefined) env.BEFORE_SHA = before;
  const result = spawnSync("bash", [script], {
    input: paths.map((path) => `${path}\n`).join(""),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const values = new Map<string, boolean>();
  for (const line of result.stdout.trim().split("\n")) {
    const [key = "", value = ""] = line.split("=");
    values.set(key, value === "true");
  }
  const get = (key: string): boolean => {
    const value = values.get(key);
    if (value === undefined) throw new Error(`classifier printed no ${key}`);
    return value;
  };
  return {
    p5_cal: get("p5_cal"),
    p5_doc: get("p5_doc"),
    p5_med: get("p5_med"),
    p5_tw: get("p5_tw"),
    p5_tw_iso: get("p5_tw_iso"),
    p5_x: get("p5_x"),
    p5_codeql: get("p5_codeql"),
    p5_scans: get("p5_scans"),
  };
}

// Asserts the exact lane set, the CodeQL flag and that p5_scans is true.
function expectFlags(flags: Flags, lanes: readonly Lane[], codeql: boolean): void {
  for (const lane of LANES) {
    assert.equal(flags[lane], lanes.includes(lane), lane);
  }
  assert.equal(flags.p5_codeql, codeql, "p5_codeql");
  assert.equal(flags.p5_scans, true, "p5_scans");
}

const EVERY_LANE: readonly Lane[] = LANES;

test("a cal lane path flags cal only", () => {
  expectFlags(classify(["src/lanes/cal/event.ts"], "pull_request"), ["p5_cal"], true);
});

test("a doc lane path flags doc only", () => {
  expectFlags(classify(["tests/webhooks/doc/signed.spec.ts"], "pull_request"), ["p5_doc"], true);
});

test("a tw-iso path flags tw_iso only and not tw", () => {
  expectFlags(classify(["tests/iso/tw/isolation.spec.ts"], "pull_request"), ["p5_tw_iso"], true);
});

test("a cal csv-corpus change flags cal and x", () => {
  expectFlags(classify(["src/lanes/cal/csv-corpus.ts"], "pull_request"), ["p5_cal", "p5_x"], true);
});

test("a tests/closeout/medusa path flags x only", () => {
  expectFlags(classify(["tests/closeout/medusa/export.spec.ts"], "pull_request"), ["p5_x"], true);
});

test("a tests/closeout/twenty path flags x only", () => {
  expectFlags(classify(["tests/closeout/twenty/export.spec.ts"], "pull_request"), ["p5_x"], true);
});

test("a docs-only pull_request flags no lane and no codeql and keeps scans", () => {
  expectFlags(classify(["docs/plans/notes.md", "README.md"], "pull_request"), [], false);
});

test("a shared src/kit path flags every lane and codeql", () => {
  expectFlags(classify(["src/kit/env.ts"], "pull_request"), EVERY_LANE, true);
});

test("an unknown path flags every lane and codeql", () => {
  expectFlags(classify(["unlisted/file.bin"], "pull_request"), EVERY_LANE, true);
});

test("an empty pull_request list flags every lane and codeql", () => {
  expectFlags(classify([], "pull_request"), EVERY_LANE, true);
});

test("workflow_dispatch flags every lane and codeql", () => {
  expectFlags(classify(["docs/notes.md"], "workflow_dispatch"), EVERY_LANE, true);
});

test("a push touching only a cal lane path flags cal and codeql only", () => {
  expectFlags(classify(["tests/webhooks/cal/cal.spec.ts"], "push", BEFORE), ["p5_cal"], true);
});

test("a push touching src/security flags every lane and codeql", () => {
  expectFlags(classify(["src/security/redact.ts"], "push", BEFORE), EVERY_LANE, true);
});

test("a push with an empty diff flags no lane and no codeql and keeps scans", () => {
  expectFlags(classify([], "push", BEFORE), [], false);
});

test("a push with an all-zero before flags every lane and codeql", () => {
  expectFlags(classify(["docs/notes.md"], "push", ZERO), EVERY_LANE, true);
});

test("a docs-only push flags no lane, no codeql and keeps scans", () => {
  expectFlags(classify(["docs/notes.md"], "push", BEFORE), [], false);
});

test("a tests/unit/scan path flags codeql only", () => {
  expectFlags(classify(["tests/unit/scan/x.test.ts"], "pull_request"), [], true);
});

test("a tests/unit/lanes/x path flags x only", () => {
  expectFlags(classify(["tests/unit/lanes/x/dry-run.test.ts"], "pull_request"), ["p5_x"], true);
});

test("a tests/unit/lanes/tw-iso path flags tw_iso only and not tw", () => {
  expectFlags(
    classify(["tests/unit/lanes/tw-iso/helper.test.ts"], "pull_request"),
    ["p5_tw_iso"],
    true,
  );
});

test("a requirements path flags every lane and codeql", () => {
  expectFlags(classify(["requirements/schemathesis.txt"], "pull_request"), EVERY_LANE, true);
});
