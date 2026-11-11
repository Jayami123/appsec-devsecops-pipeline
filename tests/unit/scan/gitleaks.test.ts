import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { evaluateGitleaks } from "../../../scripts/scan/gitleaks-threshold.ts";
import {
  REPO,
  REPO_CONFIG,
  runGitleaksDir,
  scratch,
  syntheticApiLine,
  writeTree,
} from "./fixtures/index.ts";

const VECTORS = "tests/unit/webhooks/vectors.ts";
const OPENAPI = "src/lanes/cal/contracts/openapi-v2.json";
const config = readFileSync(REPO_CONFIG, "utf8");
const entries = config.split("[[allowlists]]").slice(1);
const vectorsEntry = entries[0] ?? "";
const openapiEntry = entries[1] ?? "";

function quotedRegex(entry: string): string {
  return /regexes = \['''(.*?)'''\]/.exec(entry)?.[1] ?? "";
}

function oauthClientExample(): string {
  const line = readFileSync(join(REPO, OPENAPI), "utf8").split("\n")[7079] ?? "";
  const secret = /"clientSecret": "([^"]+)"/.exec(line)?.[1] ?? "";
  assert.notEqual(secret, "", "openapi-v2.json:7080 has the example clientSecret");
  return secret;
}

test("gitleaks positive control: a runtime-built token exits 2", () => {
  const dir = scratch("positive");
  writeTree(dir, { "src/leak.ts": `export const v = "${syntheticApiLine()}";\n` });
  const run = runGitleaksDir(dir, REPO_CONFIG);
  assert.equal(run.exit, 2);
  assert.equal(run.findings.length, 1);
});

test("gitleaks negative control: a clean scratch tree exits 0", () => {
  const dir = scratch("negative");
  writeTree(dir, { "src/clean.ts": "export const add = (a: number, b: number) => a + b;\n" });
  assert.equal(runGitleaksDir(dir, REPO_CONFIG).exit, 0);
});

test("a gitleaks tool error (exit 1) is fail", () => {
  const file = join(scratch("error"), "report.json");
  writeFileSync(file, "[]");
  assert.equal(evaluateGitleaks(file, 1).verdict, "fail");
});

test("gitleaks.toml entries are exact-line and single-path", () => {
  assert.equal(entries.length, 2, "exactly two allowlist entries");
  for (const entry of entries) {
    assert.match(entry, /targetRules = \["generic-api-key"\]/);
    assert.match(entry, /condition = "AND"/);
    assert.equal((entry.match(/paths = /g) ?? []).length, 1, "one paths list");
    assert.equal((entry.match(/regexes = /g) ?? []).length, 1, "one regexes list");
  }
  assert.match(vectorsEntry, /regexTarget = "line"/);
  assert.match(vectorsEntry, /paths = \['''\^tests\/unit\/webhooks\/vectors\\\.ts\$'''\]/);
  assert.doesNotMatch(openapiEntry, /regexTarget = "/);
  assert.match(
    openapiEntry,
    /paths = \['''\^src\/lanes\/cal\/contracts\/openapi-v2\\\.json\$'''\]/,
  );
  const openapiRegex = quotedRegex(openapiEntry);
  assert.match(openapiRegex, /^\^.*\$$/, "D-CAL-B61 regex is anchored to the value");
});

test("each gitleaks.toml regex matches exactly one line of its file at HEAD", () => {
  const regex = quotedRegex(vectorsEntry);
  assert.notEqual(regex, "", "the vectors entry has a regex");
  const lines = readFileSync(join(REPO, VECTORS), "utf8").split("\n");
  assert.equal(lines.filter((line) => line.includes(regex)).length, 1);

  const valueRegex = quotedRegex(openapiEntry);
  assert.notEqual(valueRegex, "", "the openapi entry has a regex");
  assert.match(oauthClientExample(), new RegExp(valueRegex));
});

test("an exact-line entry does not cover the same line in another path", () => {
  const dir = scratch("other-path");
  writeTree(dir, { "tests/unit/other/vectors-copy.ts": readFileSync(join(REPO, VECTORS), "utf8") });
  const run = runGitleaksDir(dir, REPO_CONFIG);
  assert.equal(run.exit, 2);
  assert.ok(
    run.findings.some((f) => f.File === "tests/unit/other/vectors-copy.ts" && f.StartLine === 28),
  );
});

test("L2 STOP probe: a changed line 28 exits 2 and the unchanged copy exits 0", () => {
  const original = readFileSync(join(REPO, VECTORS), "utf8").split("\n");
  const unchanged = scratch("l2-unchanged");
  writeTree(unchanged, { [VECTORS]: original.join("\n") });
  assert.equal(runGitleaksDir(unchanged, REPO_CONFIG).exit, 0);

  const changed = scratch("l2-changed");
  const edited = original.map((line, index) =>
    index === 27 ? `export const DAILY_SECRET_B64 = "${syntheticApiLine()}";` : line,
  );
  writeTree(changed, { [VECTORS]: edited.join("\n") });
  const run = runGitleaksDir(changed, REPO_CONFIG);
  assert.equal(run.exit, 2);
  assert.ok(run.findings.some((f) => f.File === VECTORS && f.StartLine === 28));
});

test("D-CAL-B61: the openapi docs example is not reported", () => {
  const dir = scratch("cal-openapi-clean");
  writeTree(dir, { [OPENAPI]: readFileSync(join(REPO, OPENAPI), "utf8") });
  const run = runGitleaksDir(dir, REPO_CONFIG);
  assert.equal(run.exit, 0);
  assert.equal(run.findings.length, 0);
});

test("D-CAL-B61: a different fake key in the same file is still reported", () => {
  const dir = scratch("cal-openapi-other-key");
  const original = readFileSync(join(REPO, OPENAPI), "utf8");
  writeTree(dir, {
    [OPENAPI]: `export const v = "${syntheticApiLine()}";\n` + original,
  });
  const run = runGitleaksDir(dir, REPO_CONFIG);
  assert.equal(run.exit, 2);
  assert.ok(
    run.findings.some(
      (f) => f.File === OPENAPI && f.RuleID === "generic-api-key" && f.StartLine === 1,
    ),
  );
});

test("D-CAL-B61: the same example value in another path is still reported", () => {
  const dir = scratch("cal-openapi-other-path");
  writeTree(dir, {
    "other/oauth-client-example.json": `{ "clientSecret": "${oauthClientExample()}" }\n`,
  });
  const run = runGitleaksDir(dir, REPO_CONFIG);
  assert.equal(run.exit, 2);
  assert.ok(
    run.findings.some(
      (f) => f.File === "other/oauth-client-example.json" && f.RuleID === "generic-api-key",
    ),
  );
});
