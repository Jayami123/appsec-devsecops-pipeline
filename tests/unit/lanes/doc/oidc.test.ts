// Static checks for the two OIDC rows (D-DOC-B72). Text and constant checks only; the rows run live in the doc-oidc job.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseDefectDescription } from "../../../../src/kit/ci/known-defect.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const SPECS = [
  "tests/integration/doc/oidc-state-replay.spec.ts",
  "tests/integration/doc/oidc-unverified-email.spec.ts",
];
const HELPER = read("tests/integration/doc/oidc-helper.ts");

test("the helper's provider constants match the harness source the mock overlay is built from", () => {
  const harness = read("node_modules/qa-portfolio-harness/src/adapters/documenso-oidc.ts");
  assert.ok(harness.includes("export const DOCUMENSO_OIDC_IDP_PORT = 8081;"), "harness port");
  assert.ok(
    harness.includes('export const DOCUMENSO_OIDC_ISSUER_ID = "default";'),
    "harness issuer",
  );
  assert.ok(
    harness.includes('export const DOCUMENSO_OIDC_CLIENT_ID = "qa-documenso";'),
    "harness client",
  );
  assert.ok(
    HELPER.includes('export const IDP_ISSUER = "http://127.0.0.1:8081/default";'),
    "helper issuer",
  );
  assert.ok(HELPER.includes('export const IDP_CLIENT_ID = "qa-documenso";'), "helper client");
});

test("each OIDC row declares its known defect with a parseable ID and evidence, once per test", () => {
  for (const path of SPECS) {
    const source = read(path);
    const calls = [...source.matchAll(/expectedDefect\(\s*DEFECT\s*\)/g)];
    assert.ok(calls.length >= 1, `${path}: expectedDefect is used`);
    const def = /const DEFECT =\s*\n?\s*"([^"]+)"/.exec(source);
    assert.ok(def, `${path}: DEFECT literal`);
    const parsed = parseDefectDescription(def[1] ?? "");
    assert.equal(parsed.id, "P5-DOC-OIDC-SCOPE-001", `${path}: defect ID`);
    assert.match(parsed.evidence, /open-id\.ts:34-40/, `${path}: evidence cites the source line`);
  }
});

test("in each test, expectedDefect comes after the setup assertions and before the first product assertion", () => {
  for (const path of SPECS) {
    const source = read(path);
    for (const block of source.split(/\n {2}test\(/).slice(1)) {
      const defect = block.indexOf("expectedDefect(DEFECT)");
      const product = block.indexOf("started.status()");
      assert.ok(defect > 0, `${path}: test block has expectedDefect`);
      assert.ok(product > defect, `${path}: product assertion follows expectedDefect`);
      // Setup assertions (the provider answers) run before the defect is declared.
      assert.ok(
        block.indexOf("wellKnownStatus()") < defect,
        `${path}: setup before expectedDefect`,
      );
    }
  }
});

test("every OIDC title carries the OIDC-00 prefix the job greps for", () => {
  for (const path of SPECS) {
    const titles = [...read(path).matchAll(/^\s*test\("([^"]+)"/gm)].map((m) => m[1] ?? "");
    assert.ok(titles.length >= 2, `${path}: titles`);
    for (const title of titles) assert.match(title, /^OIDC-00\d /, `${path}: ${title}`);
  }
});

test("no OIDC spec uses test.fail, skip or only (expectedDefect is the only known-defect path)", () => {
  for (const path of SPECS) {
    const source = read(path);
    assert.doesNotMatch(source, /test\.fail|test\.skip|test\.only|\.fail\(/, path);
  }
});
