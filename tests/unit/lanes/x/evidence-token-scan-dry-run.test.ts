// NEW-X-3: a wiring dry run of the PN-7 evidence token scan on a temporary artefact directory. No product stack,
// no upload, no network. The scanner is L-PIPE's and is only invoked, never edited. The synthetic token is assembled
// at run time from fragments, so no committed file holds a token in final form.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const SCAN = join(REPO, "scripts/scan/evidence-token-scan.mjs");

// Two fragments. Joined at run time, they form one GitHub-token-shaped value that the scanner's rule matches.
const FRAGMENTS = ["ghp_Zq8Lm2Vx", "Rt5Bn0Kd7HwYc4Ps9"] as const;
const SYNTHETIC_TOKEN = FRAGMENTS.join("");

function ciTempDir(): string {
  return process.env["RUNNER_TEMP"] ?? tmpdir();
}

function makeArtefactDir(): string {
  return mkdtempSync(join(ciTempDir(), "p5-x-dryrun-"));
}

function writeTree(root: string, files: Readonly<Record<string, string>>): void {
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
}

function listFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// A listing of paths and content digests. The digest keeps the synthetic token out of any value this test holds.
function snapshot(root: string): string[] {
  return listFiles(root)
    .map((path) => {
      const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
      return `${relative(root, path)}\t${digest}`;
    })
    .sort();
}

function runScan(dir: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCAN, dir], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("NEW-X-3 clean artefact directory exits 0", () => {
  const dir = makeArtefactDir();
  try {
    writeTree(dir, { "report/summary.txt": "all checks passed\n" });
    const before = snapshot(dir);
    const result = runScan(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /token scan: clean/);
    assert.deepEqual(snapshot(dir), before, "the scan must only read the directory");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(existsSync(dir), false, "the temporary directory is removed");
});

test("NEW-X-3 synthetic token exits 1 and prints file and line only", () => {
  // Control first: the same actor and resource class, with no token, must pass.
  const control = makeArtefactDir();
  try {
    writeTree(control, { "report/summary.txt": "all checks passed\n" });
    assert.equal(runScan(control).status, 0, "control must exit 0 before the negative runs");
  } finally {
    rmSync(control, { recursive: true, force: true });
  }

  const dir = makeArtefactDir();
  try {
    writeTree(dir, {
      "report/summary.txt": "all checks passed\n",
      "report/leak.txt": `ok\n${SYNTHETIC_TOKEN}\n`,
    });
    const before = snapshot(dir);
    const result = runScan(dir);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /TOKEN PATTERN: report\/leak\.txt line 2 rule /);
    const hitLines = result.stderr.split("\n").filter((line) => line.startsWith("TOKEN PATTERN:"));
    assert.ok(hitLines.length > 0, "at least one hit line is printed");
    for (const line of hitLines) {
      // File, then the line number, then the rule label. Nothing else follows on the same line.
      assert.match(line, /^TOKEN PATTERN: [^\s]+ line \d+ rule .+$/, line.slice(0, 40));
    }
    assert.deepEqual(snapshot(dir), before, "the scan must only read the directory");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(existsSync(dir), false, "the temporary directory is removed");
});

test("NEW-X-3 scan output contains no matched text", () => {
  const dir = makeArtefactDir();
  try {
    writeTree(dir, { "report/leak.txt": `${SYNTHETIC_TOKEN}\n` });
    const result = runScan(dir);
    // The hit must be real, or the absence checks below prove nothing.
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /TOKEN PATTERN: report\/leak\.txt line 1 /);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(output.includes(SYNTHETIC_TOKEN), false, "the full token is not printed");
    for (const fragment of FRAGMENTS) {
      assert.equal(output.includes(fragment), false, "no fragment is printed");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
