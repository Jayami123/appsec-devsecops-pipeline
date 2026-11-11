// PRODUCTS_ROOT default of scripts/cloud-install.sh and .claude/hooks/session-start.sh.
// Explicit PRODUCTS_ROOT wins; otherwise $HOME/products; unset HOME with no PRODUCTS_ROOT fails.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoPath = (relative: string): string =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));
const readRepo = (relative: string): string => readFileSync(repoPath(relative), "utf8");

const HOOK_WINDOWS = repoPath(".claude/hooks/session-start.sh");
const NODE24_PIN = "24.22.0";
const PATH_ENV = process.env.PATH ?? "/usr/bin:/bin";
const CLAUDE_HOME = "/home/user";
const CURSOR_HOME = "/home/ubuntu";
const SHA64 = "0".repeat(64);

const unixTemps: string[] = [];
after(() => {
  for (const dir of unixTemps) {
    spawnSync("bash", ["-c", 'rm -rf "$1"', "_", dir], { env: { PATH: PATH_ENV } });
  }
});

function bash(
  script: string,
  args: string[] = [],
  env: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("bash", ["-c", script, "_", ...args], {
    encoding: "utf8",
    env: { PATH: PATH_ENV, ...env },
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: `${result.stderr}${result.error ? `\n${result.error.message}` : ""}`,
  };
}

function unixTempDir(): string {
  const result = bash("umask 077; mktemp -d /tmp/p5-prd.XXXXXX");
  assert.equal(result.status, 0, result.stderr);
  const dir = result.stdout.trim();
  unixTemps.push(dir);
  return dir;
}

function unixPath(windowsPath: string): string {
  const result = bash('cygpath -u "$1" 2>/dev/null || printf "%s\\n" "$1"', [windowsPath]);
  assert.equal(result.status, 0, result.stderr);
  const converted = result.stdout.trim();
  assert.ok(converted.startsWith("/"), `unix path required, got ${converted}`);
  return converted;
}

function unixFakeRuntime(root: string, version: string, reported: string): string {
  const result = bash(
    `set -euo pipefail
     dir="$1/node/$2/bin"
     mkdir -p "$dir"
     printf '%s\\n' '#!/bin/sh' "echo $3" > "$dir/node"
     chmod 755 "$dir/node"
     printf 'version=%s\\narchive=node-v%s-linux-x64.tar.xz\\narchive_sha256=%s\\nsource=https://nodejs.org/dist/v%s/\\n' "$2" "$2" "$4" "$2" > "$1/node/$2/.qa-toolchain-manifest"
     printf '%s\\n' "$dir"`,
    [root, version, reported, SHA64],
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

const HOOK = unixPath(HOOK_WINDOWS);
const hookRoot = unixTempDir();
const node22Dir = unixFakeRuntime(unixTempDir(), "22.23.4", "22.23.4");
unixFakeRuntime(hookRoot, NODE24_PIN, NODE24_PIN);
const hookPath = `${node22Dir}${delimiter}${PATH_ENV}`;

function hookProductsRoot(env: Record<string, string>): {
  status: number | null;
  stderr: string;
  productsRoot: string;
} {
  const envFile = `${unixTempDir()}/claude-env.sh`;
  const created = bash('printf "" > "$1"', [envFile]);
  assert.equal(created.status, 0, created.stderr);
  const result = spawnSync("bash", [HOOK], {
    encoding: "utf8",
    env: {
      PATH: hookPath,
      CLAUDE_CODE_REMOTE: "true",
      QA_TOOLCHAIN_ROOT: hookRoot,
      CLAUDE_ENV_FILE: envFile,
      ...env,
    },
  });
  const stderr = `${result.stderr}${result.error ? `\n${result.error.message}` : ""}`;
  let productsRoot = "";
  if (result.status === 0) {
    const sourced = bash('. "$1"; printf "%s\\n" "$PRODUCTS_ROOT"', [envFile]);
    assert.equal(sourced.status, 0, sourced.stderr);
    productsRoot = sourced.stdout.trim();
  }
  return { status: result.status, stderr, productsRoot };
}

function extractFunction(source: string, name: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`${name}() {`));
  assert.ok(start >= 0, `missing ${name}`);
  const first = lines[start] ?? "";
  if (first.trimEnd().endsWith("}") && first !== `${name}() {`) return first;
  const end = lines.findIndex((line, i) => i > start && line === "}");
  assert.ok(end > start, `unclosed ${name}`);
  return lines.slice(start, end + 1).join("\n");
}

function runInstallSnippet(body: string, env: Record<string, string>) {
  const source = readRepo("scripts/cloud-install.sh");
  const script = [
    "set -euo pipefail",
    extractFunction(source, "die"),
    extractFunction(source, "set_products_root_default"),
    extractFunction(source, "set_products_root"),
    body,
  ].join("\n");
  return bash(script, [], env);
}

test("neither cloud script hard-codes /home/user; both default to $HOME/products", () => {
  for (const file of ["scripts/cloud-install.sh", ".claude/hooks/session-start.sh"]) {
    const text = readRepo(file);
    assert.doesNotMatch(text, /\/home\/user/);
    assert.match(text, /PRODUCTS_ROOT="\$HOME\/products"/);
  }
  assert.doesNotMatch(readRepo("docs/cloud-environments.md"), /\/home\/user/);
  assert.doesNotMatch(readRepo(".env.example"), /\/home\/user/);
});

test("hook default is $HOME/products for HOME=/home/user and for a different HOME", () => {
  const claude = hookProductsRoot({ HOME: CLAUDE_HOME });
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(claude.productsRoot, `${CLAUDE_HOME}/products`);

  const cursor = hookProductsRoot({ HOME: CURSOR_HOME });
  assert.equal(cursor.status, 0, cursor.stderr);
  assert.equal(cursor.productsRoot, `${CURSOR_HOME}/products`);
});

test("hook PRODUCTS_ROOT overrides HOME", () => {
  const result = hookProductsRoot({
    HOME: CLAUDE_HOME,
    PRODUCTS_ROOT: "/explicit/products",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.productsRoot, "/explicit/products");
});

test("hook fails clearly when HOME is unset and PRODUCTS_ROOT is unset", () => {
  const envFile = `${unixTempDir()}/claude-env.sh`;
  const created = bash('printf "" > "$1"', [envFile]);
  assert.equal(created.status, 0, created.stderr);
  const result = bash('unset HOME; exec bash "$1"', [HOOK], {
    PATH: hookPath,
    CLAUDE_CODE_REMOTE: "true",
    QA_TOOLCHAIN_ROOT: hookRoot,
    CLAUDE_ENV_FILE: envFile,
    HOME: "/should-not-use",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /session-start: ERROR HOME is unset and PRODUCTS_ROOT is not set/);
});

test("cloud-install default is $HOME/products for HOME=/home/user and for a different HOME", () => {
  const claude = runInstallSnippet('set_products_root_default; printf "%s\\n" "$PRODUCTS_ROOT"', {
    HOME: CLAUDE_HOME,
  });
  assert.equal(claude.status, 0, claude.stderr);
  assert.equal(claude.stdout.trim(), `${CLAUDE_HOME}/products`);

  const cursor = runInstallSnippet('set_products_root_default; printf "%s\\n" "$PRODUCTS_ROOT"', {
    HOME: CURSOR_HOME,
  });
  assert.equal(cursor.status, 0, cursor.stderr);
  assert.equal(cursor.stdout.trim(), `${CURSOR_HOME}/products`);
});

test("cloud-install PRODUCTS_ROOT overrides HOME and mkdir uses the override", () => {
  const home = unixTempDir();
  const override = `${unixTempDir()}/explicit`;
  const result = runInstallSnippet(
    'set_products_root; [ -d "$PRODUCTS_ROOT" ] || exit 2; [ ! -e "$HOME/products" ] || exit 3; printf "%s\\n" "$PRODUCTS_ROOT"',
    { HOME: home, PRODUCTS_ROOT: override },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), override);
});

test("cloud-install mkdir creates $HOME/products when PRODUCTS_ROOT is unset", () => {
  const home = unixTempDir();
  const result = runInstallSnippet(
    'set_products_root; [ -d "$PRODUCTS_ROOT" ] || exit 2; printf "%s\\n" "$PRODUCTS_ROOT"',
    { HOME: home },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `${home}/products`);
});

test("cloud-install fails clearly when HOME is unset and PRODUCTS_ROOT is unset", () => {
  const result = runInstallSnippet("unset HOME; set_products_root_default", {
    HOME: "/should-not-use",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[cloud-install\] ERROR HOME is unset and PRODUCTS_ROOT is not set/);
});
