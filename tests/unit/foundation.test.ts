// Foundation configuration pins and runtime-selection regressions for the P5 skeleton. These check
// repository configuration only: no product, no harness code, no environment variable of the host.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const repoPath = (relative: string): string =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url));
const readRepo = (relative: string): string => readFileSync(repoPath(relative), "utf8");
const codeLines = (text: string): string[] =>
  text.split("\n").filter((line) => !/^\s*#/.test(line));

const HOOK = repoPath(".claude/hooks/session-start.sh");
const NODE24_PIN = "24.22.0";
const scratch = mkdtempSync(join(tmpdir(), "p5-f0-foundation-"));
after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

// Writes a fake runtime at <root>/node/<version>/bin/node that reports $reported for `-p`.
function fakeRuntime(root: string, version: string, reported: string, manifest = true): string {
  const dir = join(root, "node", version);
  mkdirSync(join(dir, "bin"), { recursive: true });
  const bin = join(dir, "bin", "node");
  writeFileSync(bin, `#!/bin/sh\necho ${reported}\n`);
  chmodSync(bin, 0o755);
  if (manifest) {
    writeFileSync(
      join(dir, ".qa-toolchain-manifest"),
      `version=${version}\narchive=node-v${version}-linux-x64.tar.xz\narchive_sha256=${"0".repeat(64)}\nsource=https://nodejs.org/dist/v${version}/\n`,
    );
  }
  return bin;
}

// Runs the SessionStart hook with an explicit, non-inherited environment.
function runHook(env: Record<string, string>): { status: number | null; stderr: string } {
  const result = spawnSync("bash", [HOOK], { env, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

test("package.json pins qa-portfolio-harness to v0.3.1", () => {
  const pkg = JSON.parse(readRepo("package.json")) as { dependencies?: Record<string, string> };
  assert.equal(
    pkg.dependencies?.["qa-portfolio-harness"],
    "github:Jayami123/qa-portfolio-harness#v0.3.1",
  );
});

test("scripts/bootstrap.sh pins the four product refs to the P2 values", () => {
  const expected: Record<string, string> = {
    MEDUSA_REF: "f677db438f27294fc50e4c7c6612e71ff38eeff5",
    DOCUMENSO_REF: "f4105e47eba56f5d8d7e70dd516a8fcc0c870d7c",
    TWENTY_REF: "7cbdfec6f346b43715bc2056932f4fad5886f733",
    CAL_REF: "c2b7ac44c66f24ffef1662b276f0653988a609a3",
  };
  const assignments = new Map<string, string[]>();
  for (const match of readRepo("scripts/bootstrap.sh").matchAll(/^([A-Z_]+_REF)="([^"]*)"$/gm)) {
    const name = match[1] ?? "";
    const value = match[2] ?? "";
    assignments.set(name, [...(assignments.get(name) ?? []), value]);
  }
  for (const [name, sha] of Object.entries(expected)) {
    assert.deepEqual(assignments.get(name), [sha], `${name} must be assigned exactly once`);
  }
});

test("no runtime script selects a Node runtime from /opt (legacy path never selected)", () => {
  const scripts = [
    "scripts/cloud-install.sh",
    "scripts/bootstrap.sh",
    ".claude/hooks/session-start.sh",
  ];
  for (const script of scripts) {
    const code = codeLines(readRepo(script));
    const assignments = code.filter((line) => /NODE(22|24)[:=-][^\n]*\/opt\//.test(line));
    assert.deepEqual(assignments, [], `${script} must not assign NODE22/NODE24 from /opt`);
  }
  for (const script of [".claude/hooks/session-start.sh", "scripts/bootstrap.sh"]) {
    const references = codeLines(readRepo(script)).filter((line) => line.includes("/opt/node"));
    assert.deepEqual(references, [], `${script} must not reference /opt/node* in code`);
  }
});

test("the Node 24 pin is the same in every selection-contract file", () => {
  assert.match(readRepo("scripts/cloud-install.sh"), new RegExp(`NODE24_VERSION="${NODE24_PIN}"`));
  assert.match(
    readRepo(".claude/hooks/session-start.sh"),
    new RegExp(`NODE24_VERSION="${NODE24_PIN}"`),
  );
  assert.match(readRepo("scripts/bootstrap.sh"), new RegExp(`NODE24_APPROVED="${NODE24_PIN}"`));
  assert.match(readRepo(".cursor/Dockerfile"), new RegExp(`ARG NODE24_VERSION=${NODE24_PIN}`));
});

test("the Cursor Dockerfile verifies every Node archive before extraction", () => {
  const dockerfile = codeLines(readRepo(".cursor/Dockerfile")).join("\n");
  const verifications = dockerfile.match(/sha256sum -c -/g) ?? [];
  assert.equal(verifications.length, 2, "Node 22 and Node 24 archives are each verified");
  assert.doesNotMatch(dockerfile, /curl[^\n]*\|\s*tar/, "no unverified curl-to-tar pipe");
});

test("hook skips honestly outside a Claude Code cloud session and writes nothing", () => {
  const envFile = join(scratch, "skip-env.sh");
  writeFileSync(envFile, "");
  const result = runHook({ PATH: "/usr/bin:/bin", HOME: scratch, CLAUDE_ENV_FILE: envFile });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /skipped/);
  assert.equal(readFileSync(envFile, "utf8"), "");
});

test("hook exports absolute NODE22/NODE24 and a Node 22-first PATH in cloud mode", () => {
  const root = join(scratch, "cloud-ok");
  const node22 = fakeRuntime(join(scratch, "cloud-ok-n22"), "22.23.4", "22.23.4");
  const node24 = fakeRuntime(root, NODE24_PIN, NODE24_PIN);
  const envFile = join(scratch, "cloud-ok-env.sh");
  writeFileSync(envFile, "");
  const result = runHook({
    PATH: `${dirname(node22)}:/usr/bin:/bin`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
    QA_TOOLCHAIN_ROOT: root,
    CLAUDE_ENV_FILE: envFile,
  });
  assert.equal(result.status, 0, result.stderr);
  const sourced = spawnSync(
    "bash",
    ["-c", '. "$1"; printf "%s\\n%s\\n%s\\n" "$NODE22" "$NODE24" "${PATH%%:*}"', "_", envFile],
    { env: { PATH: "/usr/bin:/bin" }, encoding: "utf8" },
  );
  assert.equal(sourced.status, 0, sourced.stderr);
  assert.deepEqual(sourced.stdout.trim().split("\n"), [node22, node24, dirname(node22)]);
});

test("hook refuses a Node 24 whose reported version differs, leaving CLAUDE_ENV_FILE unchanged", () => {
  const root = join(scratch, "cloud-bad-patch");
  fakeRuntime(root, NODE24_PIN, "24.22.1");
  const node22 = fakeRuntime(join(scratch, "cloud-bad-patch-n22"), "22.23.4", "22.23.4");
  const envFile = join(scratch, "cloud-bad-patch-env.sh");
  writeFileSync(envFile, "export PREEXISTING=1\n");
  const result = runHook({
    PATH: `${dirname(node22)}:/usr/bin:/bin`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
    QA_TOOLCHAIN_ROOT: root,
    CLAUDE_ENV_FILE: envFile,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /session-start: ERROR/);
  assert.equal(readFileSync(envFile, "utf8"), "export PREEXISTING=1\n");
});

test("hook refuses a Node 24 without its manifest, and a relative PRODUCTS_ROOT, without partial exports", () => {
  const node22 = fakeRuntime(join(scratch, "cloud-nomanifest-n22"), "22.23.4", "22.23.4");
  const base = {
    PATH: `${dirname(node22)}:/usr/bin:/bin`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
  };

  const noManifestRoot = join(scratch, "cloud-nomanifest");
  fakeRuntime(noManifestRoot, NODE24_PIN, NODE24_PIN, false);
  const envA = join(scratch, "nomanifest-env.sh");
  writeFileSync(envA, "");
  const a = runHook({ ...base, QA_TOOLCHAIN_ROOT: noManifestRoot, CLAUDE_ENV_FILE: envA });
  assert.equal(a.status, 1);
  assert.equal(readFileSync(envA, "utf8"), "");

  const okRoot = join(scratch, "cloud-relative");
  fakeRuntime(okRoot, NODE24_PIN, NODE24_PIN);
  const envB = join(scratch, "relative-env.sh");
  writeFileSync(envB, "");
  const b = runHook({
    ...base,
    QA_TOOLCHAIN_ROOT: okRoot,
    PRODUCTS_ROOT: "rel/products",
    CLAUDE_ENV_FILE: envB,
  });
  assert.equal(b.status, 1);
  assert.match(b.stderr, /PRODUCTS_ROOT must be an absolute path/);
  assert.equal(readFileSync(envB, "utf8"), "");
});

test("hook rejects a symlinked Node 24 installation directory and leaves CLAUDE_ENV_FILE unchanged", () => {
  const real = fakeRuntime(join(scratch, "symlink-real"), NODE24_PIN, NODE24_PIN);
  const realDir = dirname(dirname(real));
  const root = join(scratch, "symlink-root");
  mkdirSync(join(root, "node"), { recursive: true });
  symlinkSync(realDir, join(root, "node", NODE24_PIN));
  const node22 = fakeRuntime(join(scratch, "symlink-n22"), "22.23.4", "22.23.4");
  const envFile = join(scratch, "symlink-env.sh");
  writeFileSync(envFile, "export PREEXISTING=1\n");
  const result = runHook({
    PATH: `${dirname(node22)}:/usr/bin:/bin`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
    QA_TOOLCHAIN_ROOT: root,
    CLAUDE_ENV_FILE: envFile,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /session-start: ERROR/);
  assert.equal(readFileSync(envFile, "utf8"), "export PREEXISTING=1\n");
});

test("control: a normal (non-symlinked) Node 24 installation directory is accepted and exported", () => {
  const root = join(scratch, "normal-control-root");
  const node24 = fakeRuntime(root, NODE24_PIN, NODE24_PIN);
  const node22 = fakeRuntime(join(scratch, "normal-control-n22"), "22.23.4", "22.23.4");
  const envFile = join(scratch, "normal-control-env.sh");
  writeFileSync(envFile, "");
  const result = runHook({
    PATH: `${dirname(node22)}:/usr/bin:/bin`,
    HOME: scratch,
    CLAUDE_CODE_REMOTE: "true",
    QA_TOOLCHAIN_ROOT: root,
    CLAUDE_ENV_FILE: envFile,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    readFileSync(envFile, "utf8"),
    new RegExp(`NODE24=${node24.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  );
});
