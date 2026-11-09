import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SPECIFIER = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(SPECIFIER)].map((match) => match[1] ?? "");
}

const KIT_FILES = filesUnder(join(ROOT, "src/kit"));
const SCRIPT_FILES = filesUnder(join(ROOT, "scripts"));

test("every relative import in src/kit resolves to a file", () => {
  const missing: string[] = [];
  for (const file of KIT_FILES) {
    for (const spec of specifiers(file)) {
      if (!spec.startsWith(".")) continue;
      if (!existsSync(resolve(dirname(file), spec))) missing.push(`${file} -> ${spec}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("every relative import in scripts/ resolves to a file", () => {
  const missing: string[] = [];
  for (const file of SCRIPT_FILES) {
    for (const spec of specifiers(file)) {
      if (!spec.startsWith(".")) continue;
      if (!existsSync(resolve(dirname(file), spec))) missing.push(`${file} -> ${spec}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("the scanned file lists are not empty", () => {
  assert.ok(KIT_FILES.length > 0, "src/kit scan found no files");
  assert.ok(SCRIPT_FILES.length > 0, "scripts/ scan found no files");
});

test("no file in src/kit or scripts imports from src/ci, src/db, src/webhooks, src/run, src/readiness, src/auth, src/invariants, src/shared, or src/env.ts", () => {
  const forbiddenDir = /\/src\/(ci|db|webhooks|run|readiness|auth|invariants|shared)\//;
  const forbiddenEnv = /\/src\/env\.ts$/;
  const offenders: string[] = [];
  for (const file of [...KIT_FILES, ...SCRIPT_FILES]) {
    for (const spec of specifiers(file)) {
      if (!spec.startsWith(".")) continue;
      const target = resolve(dirname(file), spec);
      if (forbiddenDir.test(target) || forbiddenEnv.test(target))
        offenders.push(`${file} -> ${spec}`);
    }
  }
  assert.deepEqual(offenders, []);
});
