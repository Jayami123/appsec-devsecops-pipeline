// The sanitiser CLI, run as the lane workflow runs it: from the workspace, against a raw Playwright JSON (D3).
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

const CLI = join(process.cwd(), "scripts/prepare-ci-artifacts.ts");
const SENTINEL = "SENTINEL-EVIDENCE";

function clean(): Record<string, unknown> {
  return {
    config: { argv: ["node", "playwright", "test"], rootDir: "/repo" },
    suites: [
      {
        title: "plain.spec.ts",
        file: "tests/plain.spec.ts",
        specs: [
          {
            title: "P5-CAL-AUTHZ-001 owner booking",
            file: "tests/plain.spec.ts",
            line: 1,
            column: 1,
            ok: true,
            tests: [
              {
                projectName: "cal-api",
                status: "expected",
                expectedStatus: "passed",
                annotations: [],
              },
            ],
          },
        ],
        suites: [],
      },
    ],
    stats: { expected: 1 },
  };
}

/** A temporary workspace with the ledger, one raw report, and the report folders a lane run leaves behind. */
function workspace(raw: unknown, { ledger = true }: { ledger?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "p5-prepare-"));
  if (ledger) {
    mkdirSync(join(dir, "docs/findings"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/findings/ledger.json"),
      join(dir, "docs/findings/ledger.json"),
    );
  }
  mkdirSync(join(dir, "playwright-report"));
  writeFileSync(join(dir, "playwright-report/index.html"), "<html>report</html>");
  mkdirSync(join(dir, "test-results/x"), { recursive: true });
  writeFileSync(join(dir, "test-results/x/error-context.md"), "context");
  writeFileSync(join(dir, "raw.json"), typeof raw === "string" ? raw : JSON.stringify(raw));
  return dir;
}

function run(dir: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: dir,
    env: { PATH: process.env["PATH"] ?? "" },
  });
}

describe("prepare-ci-artifacts CLI (D3)", () => {
  test("P1 a lane with no held item writes the sanitised report, keeps the HTML and test results, and exits 0", () => {
    const dir = workspace(clean());
    try {
      const res = run(dir, ["cal-api", "raw.json", "results/playwright-cal-api.json"]);
      assert.equal(res.status, 0, res.stderr);
      assert.equal(existsSync(join(dir, "results/playwright-cal-api.json")), true);
      assert.equal(existsSync(join(dir, "playwright-report/index.html")), true);
      assert.equal(existsSync(join(dir, "test-results/x/error-context.md")), true);
      assert.doesNotMatch(res.stdout, /::notice::/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("P2 an ID in the run argv is rewritten, the HTML is removed, and the JSON path is printed", () => {
    const raw = clean();
    (raw["config"] as Record<string, unknown>)["argv"] = [
      "node",
      "playwright",
      `P5-TW-GQL-002 ${SENTINEL}`,
    ];
    const dir = workspace(raw);
    try {
      const res = run(dir, ["tw-iso", "raw.json", "results/playwright-tw-iso.json"]);
      assert.equal(res.status, 0, res.stderr);
      assert.match(res.stdout, /rewritten field \$\.config\.argv\[2\]/);
      assert.equal(existsSync(join(dir, "playwright-report")), false);
      assert.equal(existsSync(join(dir, "test-results")), false);
      const written = readFileSync(join(dir, "results/playwright-tw-iso.json"), "utf8");
      assert.doesNotMatch(written, new RegExp(SENTINEL));
      assert.match(written, /P5-TW-GQL-002 \(held-private\)/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("P3 an ID used as a key stops the run with exit 1 and writes no JSON (fail closed)", () => {
    const raw = clean();
    (raw["config"] as Record<string, unknown>)["P5-DOC-PF-001"] = "x";
    const dir = workspace(raw);
    try {
      const res = run(dir, ["doc-api", "raw.json", "results/playwright-doc-api.json"]);
      assert.equal(res.status, 1);
      assert.match(res.stderr, /redaction incomplete for doc-api/);
      assert.equal(existsSync(join(dir, "results/playwright-doc-api.json")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("P4 a missing raw report exits 0 with a warning and writes nothing", () => {
    const dir = workspace(clean());
    try {
      const res = run(dir, ["cal-ui", "absent.json", "results/playwright-cal-ui.json"]);
      assert.equal(res.status, 0, res.stderr);
      assert.match(res.stdout, /::warning::No raw Playwright JSON/);
      assert.equal(existsSync(join(dir, "results/playwright-cal-ui.json")), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("P5 an unreadable ledger stops the run with exit 1 (redaction is never skipped)", () => {
    const dir = workspace(clean(), { ledger: false });
    try {
      const res = run(dir, ["cal-api", "raw.json", "results/playwright-cal-api.json"]);
      assert.equal(res.status, 1);
      assert.match(res.stderr, /cannot read the private-first IDs/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
