import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { REPO, scratch } from "./fixtures/index.ts";

const FORK_SOURCE = join(REPO, "scripts/scan/fork-source.sh");

test("fork-source.sh refuses a pin that is not a 40-hex SHA", () => {
  const dir = scratch("fork-bad");
  const manifest = join(dir, "forks.json");
  writeFileSync(
    manifest,
    JSON.stringify({ forks: { cal: { ref: "main", url: "file:///nonexistent" } } }),
  );
  const result = spawnSync("bash", [FORK_SOURCE, "cal", join(dir, "out")], {
    env: { ...process.env, SCAN_FORKS_MANIFEST: manifest },
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not a 40-hex/);
});

test("fork-source.sh reads the pins from forks.json", () => {
  // A local repository stands in for the fork, so the test needs no network.
  const origin = scratch("fork-origin");
  execFileSync("bash", [
    "-c",
    `cd "${origin}" && git init -q && git -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m init && git rev-parse HEAD`,
  ]);
  const sha = execFileSync("git", ["-C", origin, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dir = scratch("fork-ok");
  const manifest = join(dir, "forks.json");
  writeFileSync(
    manifest,
    JSON.stringify({ forks: { cal: { ref: sha, url: `file://${origin}` } } }),
  );
  const dest = join(dir, "out");
  const result = spawnSync("bash", [FORK_SOURCE, "cal", dest], {
    env: { ...process.env, SCAN_FORKS_MANIFEST: manifest },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    execFileSync("git", ["-C", dest, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    sha,
  );
});
