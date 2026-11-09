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

test("fetch-tool installs a raw binary after the same checksum check, and refuses a mismatch", () => {
  const dir = scratch("binary");
  const payload = join(dir, "osv-scanner_fake");
  writeFileSync(payload, "#!/bin/sh\necho fake-tool\n");
  const sha = execFileSync("sha256sum", [payload], { encoding: "utf8" }).split(" ")[0] ?? "";
  const copy = JSON.parse(JSON.stringify(manifest)) as {
    tools: Record<string, Tool & { format?: string }>;
  };
  const base = {
    version: "0.0.0",
    url: `file://${payload}`,
    member: "fake-tool",
    format: "binary",
    source: "https://example.invalid/x",
  };
  const good = join(dir, "good.json");
  writeFileSync(
    good,
    JSON.stringify({ ...copy, tools: { "fake-tool": { ...base, sha256: sha } } }),
  );
  const out = join(dir, "out");
  const ok = spawnSync("bash", [FETCH, "fake-tool"], {
    env: { ...process.env, SCAN_TOOLS_MANIFEST: good, SCAN_TOOLS_DIR: out },
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(execFileSync(join(out, "fake-tool"), [], { encoding: "utf8" }).trim(), "fake-tool");

  const bad = join(dir, "bad.json");
  writeFileSync(
    bad,
    JSON.stringify({ ...copy, tools: { "fake-tool": { ...base, sha256: "0".repeat(64) } } }),
  );
  const refused = spawnSync("bash", [FETCH, "fake-tool"], {
    env: { ...process.env, SCAN_TOOLS_MANIFEST: bad, SCAN_TOOLS_DIR: join(dir, "out2") },
    encoding: "utf8",
  });
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /checksum mismatch/);
});

test("every commit id in a tools.json source is 40 hex", () => {
  // A source records its commit as "commit <id>" or "tag object <id>". Each id must be a full SHA-1 (40 hex).
  let checked = 0;
  for (const [name, tool] of Object.entries(manifest.tools)) {
    for (const match of (tool.source ?? "").matchAll(/(?:commit|object) ([0-9a-zA-Z]+)/g)) {
      checked += 1;
      assert.match(match[1] ?? "", /^[0-9a-f]{40}$/, `${name}: ${match[1] ?? ""}`);
    }
  }
  assert.ok(checked > 0, "expected commit ids in tool sources");
});
