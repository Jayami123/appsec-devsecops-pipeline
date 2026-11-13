import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  decide,
  judge,
  parseReport,
  privateLeaks,
  summaryMarkdown,
  ZapInputError,
  type JudgeInput,
} from "../../../scripts/scan/zap-threshold.ts";
import { parseBaseline, type Baseline } from "../../../scripts/scan/threshold-core.ts";
import { REPO, scratch, writeTree } from "./fixtures/index.ts";

// The committed fixture is the real zap.json of the pinned image (ZAP 2.17.0, zap-baseline.py with the committed
// rules) against a local page at 127.0.0.1:8765 with known header gaps. Field names are not guessed.
const FIXTURE = join(REPO, "tests/unit/scan/fixtures/zap/local-positive-control.json");
const fixtureText = readFileSync(FIXTURE, "utf8");
const NOW = "2026-11-13T12:00:00.000Z";
const LOCAL_TYPES = ["10038", "10020", "10036", "10021"];
const THRESHOLD = join(REPO, "scripts/scan/zap-threshold.ts");

function baselineFor(product: string, ids: readonly string[], expires = "2027-01-01"): Baseline {
  return parseBaseline(
    JSON.stringify({
      schema: 1,
      tool: "zap",
      entries: ids.map((id) => ({
        fingerprint: `${product}|${id}`,
        ruleId: id,
        path: product,
        justification: "synthetic entry for a test",
        owner: "the owner",
        reviewRef: "review-test",
        addedOn: "2026-11-10",
        expires,
      })),
    }),
    "zap",
  );
}

function input(overrides: Partial<JudgeInput> = {}): JudgeInput {
  return {
    product: "cal",
    targetHost: "127.0.0.1",
    targetPort: "8765",
    scanExit: 0,
    baseline: baselineFor("cal", LOCAL_TYPES),
    nowIso: NOW,
    ...overrides,
  };
}

// A copy of the fixture with one document field changed. Used for the malformed and missing-field cases.
function mutate(change: (doc: Record<string, unknown>) => void): string {
  const doc = JSON.parse(fixtureText) as Record<string, unknown>;
  change(doc);
  return JSON.stringify(doc);
}
function firstSite(doc: Record<string, unknown>): Record<string, unknown> {
  return (doc["site"] as Record<string, unknown>[])[0] as Record<string, unknown>;
}
function firstAlert(doc: Record<string, unknown>): Record<string, unknown> {
  return (firstSite(doc)["alerts"] as Record<string, unknown>[])[0] as Record<string, unknown>;
}

test("the positive-control fixture parses and reports the four local header gaps", () => {
  const report = parseReport(fixtureText);
  assert.equal(report.version, "2.17.0");
  const site = report.sites[0];
  assert.ok(site, "one site");
  assert.equal(site.host, "127.0.0.1");
  assert.equal(site.port, "8765");
  assert.deepEqual(site.alerts.map((alert) => alert.pluginid).sort(), [...LOCAL_TYPES].sort());
});

test("a known baseline passes; every fixture alert type is marked known", () => {
  const verdict = judge(fixtureText, input());
  assert.equal(verdict.verdict, "pass", verdict.reasons.join("; "));
  assert.equal(verdict.newTypes.length, 0);
  assert.ok(verdict.types.every((type) => type.known));
  assert.equal(verdict.countsByRisk["Medium"], 2);
  assert.equal(verdict.countsByRisk["Low"], 2);
});

test("an empty baseline makes every alert type new and fails the nightly job (positive control)", () => {
  const verdict = judge(fixtureText, input({ baseline: baselineFor("cal", []) }));
  assert.equal(verdict.verdict, "fail");
  assert.deepEqual(verdict.newTypes.map((type) => type.pluginid).sort(), [...LOCAL_TYPES].sort());
  assert.match(verdict.reasons.join(" "), /10038/);
});

test("a baseline entry for another product does not cover this product", () => {
  const verdict = judge(fixtureText, input({ baseline: baselineFor("med", LOCAL_TYPES) }));
  assert.equal(verdict.verdict, "fail");
});

test("an expired baseline entry counts as NEW (plan 7.1, MP:698)", () => {
  const verdict = judge(
    fixtureText,
    input({ baseline: baselineFor("cal", LOCAL_TYPES, "2026-11-12") }),
  );
  assert.equal(verdict.verdict, "fail");
  assert.equal(verdict.expiredKnown.length, 4);
});

test("a known High alert passes and is counted under High; a new High alert fails", () => {
  const high = mutate((doc) => {
    firstAlert(doc)["riskcode"] = "3";
    firstAlert(doc)["riskdesc"] = "High (Medium)";
  });
  const known = judge(high, input());
  assert.equal(known.verdict, "pass");
  assert.equal(known.countsByRisk["High"], 1);
  const unknownHigh = judge(high, input({ baseline: baselineFor("cal", LOCAL_TYPES.slice(1)) }));
  assert.equal(unknownHigh.verdict, "fail");
  assert.equal(unknownHigh.newTypes[0]?.risk, "High");
});

test("a scan that did not exit 0 is an unusable input, never a pass", () => {
  assert.throws(() => judge(fixtureText, input({ scanExit: 3 })), ZapInputError);
  assert.throws(() => judge(fixtureText, input({ scanExit: 1 })), /exited 1/);
});

test("malformed JSON and missing fields fail closed", () => {
  assert.throws(() => judge("{not json", input()), /not valid JSON/);
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete doc["@version"]),
        input(),
      ),
    /@version/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete doc["site"]),
        input(),
      ),
    /site/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => (doc["site"] = [])),
        input(),
      ),
    /site/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete firstSite(doc)["@host"]),
        input(),
      ),
    /@host/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete firstSite(doc)["alerts"]),
        input(),
      ),
    /alerts/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete firstAlert(doc)["riskcode"]),
        input(),
      ),
    /riskcode/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => delete firstAlert(doc)["instances"]),
        input(),
      ),
    /instances/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => (firstAlert(doc)["pluginid"] = "abc")),
        input(),
      ),
    /numeric/,
  );
});

test("an unknown riskcode is rejected, including inherited object keys", () => {
  assert.throws(
    () =>
      judge(
        mutate((doc) => (firstAlert(doc)["riskcode"] = "9")),
        input(),
      ),
    /unknown/,
  );
  assert.throws(
    () =>
      judge(
        mutate((doc) => (firstAlert(doc)["riskcode"] = "toString")),
        input(),
      ),
    /unknown/,
  );
});

test("a report without a site for the scan target is rejected (the scan did not hit the target)", () => {
  assert.throws(
    () => judge(fixtureText, input({ targetPort: "3000", targetHost: "127.0.0.1" })),
    /no site for the scan target/,
  );
  assert.throws(
    () => judge(fixtureText, input({ targetHost: "localhost" })),
    /no site for the scan target/,
  );
});

test("authenticated mode fails when the logged-in proof URL is absent, and passes when present", () => {
  const withoutProof = judge(fixtureText, input({ authProof: "/account/settings" }));
  assert.equal(withoutProof.verdict, "fail");
  assert.match(withoutProof.reasons.join(" "), /proof URL is not in the ZAP site tree/);
  const withProof = judge(
    mutate((doc) => {
      const instances = firstAlert(doc)["instances"] as Record<string, unknown>[];
      const first = instances[0];
      if (first !== undefined) first["uri"] = "http://127.0.0.1:8765/account/settings";
    }),
    input({ authProof: "/account/settings" }),
  );
  assert.equal(withProof.verdict, "pass", withProof.reasons.join("; "));
});

test("decide passes only when every gate succeeded and the verdict is pass", () => {
  const good = {
    scan: "success",
    judgeOutcome: "success",
    judgeVerdict: "pass",
    evidence: "success",
    teardown: "success",
  };
  assert.equal(decide(good).verdict, "pass");
  for (const broken of [
    { ...good, scan: "failure" },
    { ...good, scan: "skipped" },
    { ...good, judgeOutcome: "failure", judgeVerdict: "" },
    { ...good, judgeVerdict: "fail" },
    { ...good, evidence: "failure" },
    { ...good, teardown: "failure" },
  ]) {
    assert.equal(decide(broken).verdict, "fail", JSON.stringify(broken));
  }
});

test("the CLI exits 1 for an unreadable zap.json and writes no verdict", () => {
  const dir = scratch("zap-missing");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      THRESHOLD,
      "judge",
      join(dir, "zap.json"),
      "cal",
      "127.0.0.1",
      "3000",
      "0",
      join(dir, "summary.md"),
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.doesNotMatch(result.stdout, /verdict=/);
  assert.equal(existsSync(join(dir, "summary.md")), false);
});

test("the CLI prints verdict=fail against the empty committed baseline and writes the summary", () => {
  const dir = scratch("zap-judge");
  const file = join(dir, "zap.json");
  writeFileSync(file, fixtureText);
  const summary = join(dir, "summary.md");
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      THRESHOLD,
      "judge",
      file,
      "cal",
      "127.0.0.1",
      "8765",
      "0",
      summary,
    ],
    { encoding: "utf8" },
  );
  // The committed baseline is empty in this PR (no invented alerts), so the fixture is judged NEW: fail, exit 0.
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^verdict=fail$/m);
  assert.match(readFileSync(summary, "utf8"), /### P5-SCAN-004 ZAP passive baseline: cal/);
});

test("check-private names the file, never the ID, and passes a clean tree", () => {
  // A synthetic ledger ID: no real private-first entry is named in the repository.
  const dir = scratch("zap-private");
  const side = scratch("zap-private-ledger");
  const ledgerPath = join(side, "ledger.json");
  const ledger = JSON.stringify({ private: [{ id: "ZZ-TEST-1", status: "held-private" }] });
  writeTree(dir, { "zap.json": fixtureText, "zap-summary.md": "clean summary\n" });
  assert.deepEqual(privateLeaks(dir, ledger), []);
  writeTree(dir, { "zap-summary.md": "carries ZZ-TEST-1 in text\n" });
  assert.deepEqual(privateLeaks(dir, ledger), ["zap-summary.md"]);
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", THRESHOLD, "check-private", dir, ledgerPath],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1, "a missing ledger fails closed");
  writeFileSync(ledgerPath, ledger);
  const leaked = spawnSync(
    process.execPath,
    ["--experimental-strip-types", THRESHOLD, "check-private", dir, ledgerPath],
    { encoding: "utf8" },
  );
  assert.equal(leaked.status, 1);
  assert.match(leaked.stderr, /PRIVATE-FIRST ID FOUND in zap-summary\.md/);
  assert.doesNotMatch(leaked.stderr + leaked.stdout, /ZZ-TEST-1/);
});

test("the summary lists every alert type with its baseline status", () => {
  const verdict = judge(fixtureText, input({ baseline: baselineFor("cal", []) }));
  const markdown = summaryMarkdown("cal", verdict, "127.0.0.1:8765");
  for (const id of LOCAL_TYPES) assert.match(markdown, new RegExp(`\\| ${id} \\|`));
  assert.match(markdown, /\| NEW \|/);
});

test("the committed rules file is well formed: three tab-separated fields and a justification per line", () => {
  const lines = readFileSync(join(REPO, "config/scan/zap-rules.tsv"), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  assert.ok(lines.length > 0, "rules are present");
  for (const line of lines) {
    const fields = line.split("\t");
    assert.equal(fields.length, 3, line);
    assert.match(fields[0] ?? "", /^\d+$/, line);
    assert.ok(["WARN", "IGNORE", "INFO", "FAIL"].includes(fields[1] ?? ""), line);
    assert.ok((fields[2] ?? "").trim().length > 20, `justification: ${line}`);
  }
});

test("no committed rule ignores or fails a High or Critical alert type (none is in the rules yet)", () => {
  const lines = readFileSync(join(REPO, "config/scan/zap-rules.tsv"), "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#"));
  const actions = lines.map((line) => line.split("\t")[1]);
  assert.ok(!actions.includes("IGNORE"), "no IGNORE rule is committed in this PR");
  assert.ok(!actions.includes("FAIL"), "no FAIL rule is committed in this PR");
});
