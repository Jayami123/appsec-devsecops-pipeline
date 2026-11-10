// PRODUCTS_ROOT rules of scripts/bootstrap.sh (lane foundation PR). Each test copies the script into a
// fresh temporary repository and runs it with an explicit environment, never the inherited one.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const SCRIPT = fileURLToPath(new URL("../../scripts/bootstrap.sh", import.meta.url));
const temps: string[] = [];

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

// A fresh temporary tree: <tmp>/repo/scripts/bootstrap.sh and an empty <tmp>/home.
function setup(): string {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "p5-bootstrap-")));
  temps.push(tmp);
  mkdirSync(join(tmp, "repo", "scripts"), { recursive: true });
  copyFileSync(SCRIPT, join(tmp, "repo", "scripts", "bootstrap.sh"));
  mkdirSync(join(tmp, "home"));
  return tmp;
}

function runPrint(tmp: string, env: Record<string, string> = {}) {
  return spawnSync(
    "bash",
    [join(tmp, "repo", "scripts", "bootstrap.sh"), "--print-products-root"],
    {
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: join(tmp, "home"), ...env },
    },
  );
}

test("bootstrap --print-products-root prints an absolute PRODUCTS_ROOT from the environment and clones nothing", () => {
  const tmp = setup();
  const root = join(tmp, "abs-root");
  const result = runPrint(tmp, { PRODUCTS_ROOT: root });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), root);
  assert.doesNotMatch(result.stderr, /NOTE/);
  assert.deepEqual(readdirSync(root), []);
});

test("bootstrap refuses a relative PRODUCTS_ROOT", () => {
  const result = runPrint(setup(), { PRODUCTS_ROOT: "rel/products" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must be an absolute path/);
});

test("bootstrap refuses a PRODUCTS_ROOT inside node_modules", () => {
  const tmp = setup();
  const result = runPrint(tmp, { PRODUCTS_ROOT: join(tmp, "node_modules", "products") });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must not be inside node_modules/);
});

test("bootstrap defaults to ../products next to the repository and prints the export line", () => {
  const tmp = setup();
  const result = runPrint(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), join(tmp, "products"));
  assert.match(result.stderr, /NOTE PRODUCTS_ROOT came from default.*export PRODUCTS_ROOT=\//);
});

test("bootstrap fails instead of falling back to HOME when the default cannot be created", () => {
  const tmp = setup();
  // A file where the default folder should be: mkdir fails even as root.
  writeFileSync(join(tmp, "products"), "");
  const result = runPrint(tmp);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /PRODUCTS_ROOT is unset/);
  assert.equal(existsSync(join(tmp, "home", "products")), false);
});

test("bootstrap reads PRODUCTS_ROOT from the repo .env and tells the user to export it", () => {
  const tmp = setup();
  const root = join(tmp, "from-env");
  writeFileSync(join(tmp, "repo", ".env"), `PRODUCTS_ROOT=${root}\n`);
  const result = runPrint(tmp);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), root);
  assert.match(result.stderr, /came from \.env/);
});
