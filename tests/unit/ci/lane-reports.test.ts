// Shape tests for the P5 report steps and the runner pin (text parsing, as in tests/unit/ci/workflow.test.ts).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const dir = join(root, ".github", "workflows");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".yml"))
  .sort();
const text = (name: string): string => readFileSync(join(dir, name), "utf8");

const LANE_FILES = ["p5-cal.yml", "p5-doc.yml", "p5-med.yml", "p5-tw.yml", "p5-tw-iso.yml"];
const UPLOAD_PIN = "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2";

/** Every lane run step: its label (from the raw-JSON env name) and the file it is in. */
function laneRuns(name: string): Array<{ label: string }> {
  const source = text(name);
  const runs = [...source.matchAll(/npx playwright test [^\n]*--reporter=list,json,html/g)];
  return runs.map((run) => {
    const before = source.slice(0, run.index);
    const label =
      /PLAYWRIGHT_JSON_OUTPUT_NAME: \$\{\{ runner\.temp \}\}\/playwright-([a-z0-9-]+)\.raw\.json/.exec(
        before.slice(before.lastIndexOf("      - name:")),
      )?.[1];
    assert.ok(label, `${name}: a lane run without the raw JSON env (${run[0]})`);
    return { label };
  });
}

describe("runner pin (ubuntu-24.04 on every job)", () => {
  test("no workflow file uses ubuntu-latest, and every runs-on is ubuntu-24.04", () => {
    for (const name of files) {
      assert.doesNotMatch(text(name), /runs-on: ubuntu-latest/, `${name} floats to ubuntu-latest`);
      for (const [, value] of text(name).matchAll(/^ {4}runs-on: (\S+)$/gm)) {
        assert.equal(value, "ubuntu-24.04", `${name} runs on ${value ?? "?"}`);
      }
    }
  });

  test("each pinned runner line has the reason comment in the three lines above it", () => {
    for (const name of files) {
      const lines = text(name).split("\n");
      lines.forEach((line, index) => {
        if (/^ {4}runs-on: ubuntu-24\.04$/.test(line)) {
          const above = lines.slice(Math.max(0, index - 3), index).join("\n");
          assert.match(above, /# Pinned: ubuntu-latest is ubuntu26\.04/, `${name}:${index + 1}`);
        }
      });
    }
  });
});

describe("product lanes write a Playwright JSON report, a per-title summary and artifacts", () => {
  for (const name of LANE_FILES) {
    test(`${name}: every lane run writes the reports, then sanitises, summarises and uploads in order`, () => {
      const runs = laneRuns(name);
      assert.ok(runs.length > 0, `${name}: no lane run with the report reporters`);
      const source = text(name);
      for (const { label } of runs) {
        const run = source.indexOf(`playwright-${label}.raw.json`);
        const sanitise = source.indexOf(`- name: Sanitise the ${label} report`);
        const summary = source.indexOf(`- name: Write the ${label} job summary`);
        const upload = source.indexOf(`- name: Upload the ${label} reports and test results`);
        assert.ok(run >= 0 && sanitise > run, `${label}: sanitise follows the lane run`);
        assert.ok(summary > sanitise, `${label}: summary follows sanitise`);
        assert.ok(upload > summary, `${label}: upload follows summary`);
        assert.match(
          source,
          new RegExp(
            `run: node scripts/prepare-ci-artifacts\\.ts ${label} "\\$RUNNER_TEMP/playwright-${label}\\.raw\\.json" results/playwright-${label}\\.json`,
          ),
          `${label}: sanitise command`,
        );
        assert.match(
          source,
          new RegExp(
            `run: node scripts/write-ci-job-summary\\.ts ${label} results/playwright-${label}\\.json`,
          ),
          `${label}: summary command`,
        );
      }
    });

    test(`${name}: each report and upload step runs under if: always()`, () => {
      const source = text(name);
      for (const { label } of laneRuns(name)) {
        for (const step of [
          `Sanitise the ${label} report`,
          `Write the ${label} job summary`,
          `Upload the ${label} reports`,
        ]) {
          const at = source.indexOf(`- name: ${step}`);
          assert.ok(at >= 0, `${label}: ${step} exists`);
          const block = source.slice(at, source.indexOf("\n      - name:", at + 1));
          assert.match(block, /^ {8}if: always\(\)$/m, `${label}: ${step} is not under always()`);
        }
      }
    });

    test(`${name}: the upload is pinned by SHA, keeps 7 days, warns on no files, and never uploads the raw JSON`, () => {
      const source = text(name);
      const labels = laneRuns(name).map((run) => run.label);
      assert.equal(source.split(UPLOAD_PIN).length - 1, labels.length, `${name}: upload pin count`);
      for (const label of labels) {
        const at = source.indexOf(`- name: Upload the ${label} reports`);
        const block = source.slice(at, source.indexOf("\n      - name:", at + 1));
        assert.match(block, new RegExp(`name: p5-${label}-report`));
        assert.match(block, /retention-days: 7/);
        assert.match(block, /if-no-files-found: warn/);
        assert.match(
          block,
          /path: \|\n {12}playwright-report\/\n {12}results\/playwright-[a-z0-9-]+\.json\n {12}test-results\/\n/,
        );
        assert.doesNotMatch(
          block,
          /raw\.json|RUNNER_TEMP/,
          `${label}: the raw report must not be uploaded`,
        );
      }
    });

    test(`${name}: the HTML report never auto-opens in CI`, () => {
      const source = text(name);
      for (const { label } of laneRuns(name)) {
        assert.match(source, /PLAYWRIGHT_HTML_OPEN: never/, `${label}: html open`);
      }
    });
  }

  test("every upload artifact name is unique across the P5 lanes", () => {
    const names = LANE_FILES.flatMap((name) =>
      laneRuns(name).map((run) => `p5-${run.label}-report`),
    );
    assert.equal(new Set(names).size, names.length, names.join(", "));
    assert.equal(names.length, 10, names.join(", "));
  });
});
