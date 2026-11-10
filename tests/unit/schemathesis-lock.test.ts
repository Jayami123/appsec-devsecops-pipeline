import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), "utf8");

interface Pin {
  name: string;
  version: string;
  hashes: string[];
}

// Joins backslash continuations, drops comment lines, and requires name==version plus sha256 hashes.
function parseLock(text: string): Pin[] {
  const logical: string[] = [];
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    current += (current === "" ? "" : " ") + line.replace(/\\$/, "").trim();
    if (!line.endsWith("\\")) {
      logical.push(current);
      current = "";
    }
  }
  if (current !== "") logical.push(current);
  return logical.map((entry) => {
    const [head = "", ...hashParts] = entry.split(/\s+--hash=/);
    const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;]+)(\s*;.*)?$/.exec(head.trim());
    if (match === null) throw new Error(`LOCK_UNPINNED: ${head}`);
    const name = (match[1] ?? "").toLowerCase();
    const hashes = hashParts.map((part) => part.trim());
    if (hashes.length === 0 || !hashes.every((h) => /^sha256:[0-9a-f]{64}$/.test(h))) {
      throw new Error(`LOCK_UNHASHED: ${name}`);
    }
    return { name, version: match[2] ?? "", hashes };
  });
}

const COMPILE_COMMAND =
  "uv pip compile requirements/schemathesis.in --universal --python-version 3.11 --generate-hashes --output-file requirements/schemathesis.txt";
const WHEEL_SHA256 = "sha256:409ecaa3ade87e9c7a4f417c9efb88bc60e7535252881f54f27e476c34b5c18c";
const SDIST_SHA256 = "sha256:610f2027ef2e60bf287971d5b299e6d25ab9725e2933f4425c41858593b06d79";

test("requirements/schemathesis.in pins exactly schemathesis==4.33.1", () => {
  const requirements = read("requirements/schemathesis.in")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
  assert.deepEqual(requirements, ["schemathesis==4.33.1"]);
});

test("the lock pins schemathesis==4.33.1 with the PyPI wheel and sdist hashes", () => {
  const pins = parseLock(read("requirements/schemathesis.txt"));
  const schemathesis = pins.find((pin) => pin.name === "schemathesis");
  assert.ok(schemathesis, "schemathesis is missing from the lock");
  assert.equal(schemathesis.version, "4.33.1");
  assert.ok(schemathesis.hashes.includes(WHEEL_SHA256), "wheel sha256 missing");
  assert.ok(schemathesis.hashes.includes(SDIST_SHA256), "sdist sha256 missing");
});

test("every requirement in the lock is pinned with == and has a sha256 hash", () => {
  const pins = parseLock(read("requirements/schemathesis.txt"));
  assert.ok(pins.length > 1, "the lock must pin more than one package");
  const names = pins.map((pin) => pin.name);
  assert.equal(new Set(names).size, names.length, "duplicate package names in the lock");
});

test("the lock header records the uv compile command", () => {
  assert.ok(read("requirements/schemathesis.txt").includes(COMPILE_COMMAND));
});

test("negative control: the lock parser rejects an unhashed or unpinned line", () => {
  assert.throws(() => parseLock("foo==1.0\n"), /LOCK_UNHASHED: foo/);
  assert.throws(
    () => parseLock("foo>=1.0 --hash=sha256:" + "a".repeat(64) + "\n"),
    /LOCK_UNPINNED/,
  );
});
