import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { REPO, scratch } from "./fixtures/index.ts";

interface Tool {
  readonly version?: string;
  readonly url?: string;
  readonly sha256?: string;
  readonly member?: string;
  readonly source?: string;
}
const manifest = JSON.parse(readFileSync(join(REPO, "config/scan/tools.json"), "utf8")) as {
  tools: Record<string, Tool>;
};
const FETCH = join(REPO, "scripts/scan/fetch-tool.sh");

test("every tool in tools.json has a version, a 64-hex SHA-256 and a source URL", () => {
  for (const [name, tool] of Object.entries(manifest.tools)) {
    assert.ok(tool.version, `${name}: version`);
    assert.match(tool.sha256 ?? "", /^[0-9a-f]{64}$/, `${name}: sha256`);
    assert.match(tool.source ?? "", /https:\/\//, `${name}: source`);
  }
});

test("fetch-tool refuses an empty checksum", () => {
  const dir = scratch("manifest");
  const copy = JSON.parse(JSON.stringify(manifest)) as { tools: Record<string, Tool> };
  copy.tools["gitleaks"] = { ...copy.tools["gitleaks"], sha256: "" };
  const file = join(dir, "tools.json");
  writeFileSync(file, JSON.stringify(copy));
  const result = spawnSync("bash", [FETCH, "gitleaks"], {
    env: { ...process.env, SCAN_TOOLS_MANIFEST: file, SCAN_TOOLS_DIR: join(dir, "out") },
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /malformed/);
});

test("fetch-tool refuses a mismatched checksum", () => {
  const dir = scratch("mismatch");
  // A local archive stands in for the release: file:// is fetched by curl without the network.
  const payload = join(dir, "payload");
  execFileSync("bash", [
    "-c",
    `mkdir -p "${payload}" && printf 'not-a-real-tool' > "${payload}/gitleaks" && tar -czf "${dir}/tool.tar.gz" -C "${payload}" gitleaks`,
  ]);
  const copy = JSON.parse(JSON.stringify(manifest)) as { tools: Record<string, Tool> };
  copy.tools["gitleaks"] = {
    ...copy.tools["gitleaks"],
    url: `file://${dir}/tool.tar.gz`,
    sha256: "0".repeat(64),
  };
  const file = join(dir, "tools.json");
  writeFileSync(file, JSON.stringify(copy));
  const result = spawnSync("bash", [FETCH, "gitleaks"], {
    env: { ...process.env, SCAN_TOOLS_MANIFEST: file, SCAN_TOOLS_DIR: join(dir, "out") },
    encoding: "utf8",
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /checksum mismatch/);
});

test("forks.json pins equal the scripts/bootstrap.sh REF constants", () => {
  const forks = JSON.parse(readFileSync(join(REPO, "config/scan/forks.json"), "utf8")) as {
    forks: Record<string, { ref: string; url: string }>;
  };
  const bootstrap = readFileSync(join(REPO, "scripts/bootstrap.sh"), "utf8");
  const constants: Record<string, string> = {
    cal: "CAL_REF",
    documenso: "DOCUMENSO_REF",
    medusa: "MEDUSA_REF",
    twenty: "TWENTY_REF",
  };
  for (const [product, constant] of Object.entries(constants)) {
    const match = new RegExp(`${constant}="([0-9a-f]+)"`).exec(bootstrap);
    assert.equal(match?.[1], forks.forks[product]?.ref, `${product} pin`);
  }
});
