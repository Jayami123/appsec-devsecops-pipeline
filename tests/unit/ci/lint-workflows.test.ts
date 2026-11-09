// Static and fail-closed tests for scripts/lint-workflows.sh (plan 9.4). The pinned actionlint checksum is
// read from the script text; these tests never download anything.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const scriptPath = fileURLToPath(new URL("../../../scripts/lint-workflows.sh", import.meta.url));
const scriptText = readFileSync(scriptPath, "utf8");
const scratch = mkdtempSync(join(tmpdir(), "p5-f0-lint-"));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

test("the actionlint checksum constant is 64 lowercase hex characters", () => {
  assert.match(scriptText, /^ACTIONLINT_SHA256="[0-9a-f]{64}"$/m);
});

test("the script fails closed on an empty checksum", () => {
  // A copy with the checksum forced to empty exits before any download; the real script is not run.
  const emptied = scriptText.replace(/^ACTIONLINT_SHA256=.*$/m, 'ACTIONLINT_SHA256=""');
  const copy = join(scratch, "lint-workflows-empty.sh");
  writeFileSync(copy, emptied);
  const result = spawnSync("bash", [copy], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /empty or malformed/);
});

test("the script reads the version constant", () => {
  assert.match(scriptText, /^ACTIONLINT_VERSION="\d+\.\d+\.\d+"$/m);
  assert.match(scriptText, /releases\/download\/v\$\{ACTIONLINT_VERSION\}\//);
});
