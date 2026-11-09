import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO, scratch } from "./fixtures/index.ts";

const SBOM = join(REPO, "scripts/scan/sbom.sh");

// A fake syft: writes a CycloneDX file with two components to the path given after cyclonedx-json=.
function fakeSyft(dir: string): string {
  const bin = join(dir, "syft");
  writeFileSync(
    bin,
    `#!/usr/bin/env bash
out="\${3#cyclonedx-json=}"
printf '%s' '{"bomFormat":"CycloneDX","specVersion":"1.7","components":[{"name":"a"},{"name":"b"}]}' > "$out"
`,
  );
  chmodSync(bin, 0o755);
  return bin;
}

test("sbom.sh reads every digest in images.json", () => {
  const dir = scratch("sbom-all");
  const outdir = join(dir, "out");
  const images = JSON.parse(readFileSync(join(REPO, "config/scan/images.json"), "utf8")) as {
    images: unknown[];
  };
  const result = spawnSync("bash", [SBOM, outdir], {
    env: { ...process.env, SYFT_BIN: fakeSyft(dir) },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    readdirSync(outdir).filter((f) => f.endsWith(".cdx.json")).length,
    images.images.length,
  );
  assert.match(result.stdout, /verdict=pass/);
});

test("sbom.sh refuses an image reference without a digest", () => {
  const dir = scratch("sbom-tag");
  const manifest = join(dir, "images.json");
  writeFileSync(
    manifest,
    JSON.stringify({
      schema: 1,
      images: [{ name: "tagonly", repo: "docker.io/library/redis", tag: "7", digest: "7" }],
    }),
  );
  const result = spawnSync("bash", [SBOM, join(dir, "out")], {
    env: { ...process.env, SCAN_IMAGES_MANIFEST: manifest, SYFT_BIN: fakeSyft(dir) },
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /no sha256 digest/);
  assert.equal(existsSync(join(dir, "out", "tagonly.cdx.json")), false);
});
