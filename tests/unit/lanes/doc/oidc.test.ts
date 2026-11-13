// Static checks for the OIDC rows (D-DOC-B72 to D-DOC-B84). Text and constant checks only; the rows run live in doc-oidc.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const read = (path: string): string => readFileSync(join(root, path), "utf8");

const SPECS = [
  "tests/integration/doc/oidc-state-replay.spec.ts",
  "tests/integration/doc/oidc-unverified-email.spec.ts",
];
const PRIVATE_SPEC = "tests/integration/doc/oidc-request-check.spec.ts";
const HELPER = read("tests/integration/doc/oidc-helper.ts");

test("the helper's provider constants match the harness v0.5.1 source", () => {
  const harness = read("node_modules/qa-portfolio-harness/src/adapters/documenso-oidc.ts");
  assert.ok(harness.includes("export const DOCUMENSO_OIDC_IDP_PORT = 8081;"), "harness port");
  assert.ok(harness.includes('export const DOCUMENSO_OIDC_REALM = "qa";'), "harness realm");
  assert.ok(
    harness.includes('export const DOCUMENSO_OIDC_CLIENT_ID = "qa-documenso";'),
    "harness client",
  );
  assert.ok(
    harness.includes('{ username: "verified", email: "verified@qa.test", emailVerified: true }'),
    "verified user",
  );
  assert.ok(
    harness.includes(
      '{ username: "unverified", email: "unverified@qa.test", emailVerified: false }',
    ),
    "unverified user",
  );
  assert.ok(HELPER.includes('export const IDP_ORIGIN = "http://127.0.0.1:8081";'), "helper origin");
  assert.ok(HELPER.includes('export const IDP_REALM = "qa";'), "helper realm");
  assert.ok(HELPER.includes('export const IDP_CLIENT_ID = "qa-documenso";'), "helper client");
  assert.ok(
    HELPER.includes('export const VERIFIED_EMAIL = "verified@qa.test";'),
    "helper verified email",
  );
  assert.ok(
    HELPER.includes('export const UNVERIFIED_EMAIL = "unverified@qa.test";'),
    "helper unverified email",
  );
});

test("the OIDC rows carry no expected failure (the provider publishes scopes_supported)", () => {
  for (const path of [...SPECS, PRIVATE_SPEC]) {
    const source = read(path);
    assert.doesNotMatch(source, /expectedDefect\(/, path);
    assert.doesNotMatch(source, /test\.fail|test\.skip|test\.only|\.fail\(/, path);
  }
});

test("the rows get users only from the harness reader and never read the run-state file", () => {
  for (const path of [...SPECS, PRIVATE_SPEC, "tests/integration/doc/oidc-helper.ts"]) {
    const source = read(path);
    assert.doesNotMatch(source, /documenso-oidc-run|\.harness/, `${path} names the run-state file`);
    assert.doesNotMatch(source, /clientSecret|client_secret/, `${path} handles the client secret`);
  }
  assert.match(HELPER, /import \{ documensoOidcTestUsers \} from "qa-portfolio-harness";/);
  assert.match(
    HELPER,
    /export function seededUsers\(\): ReturnType<typeof documensoOidcTestUsers> \{/,
  );
});

test("no OIDC file prints or logs anything (users and values never reach output)", () => {
  for (const path of [...SPECS, PRIVATE_SPEC, "tests/integration/doc/oidc-helper.ts"]) {
    assert.doesNotMatch(read(path), /console\.|process\.stdout|process\.stderr/, path);
  }
});

test("every OIDC title carries the OIDC-00 prefix the job greps for", () => {
  for (const path of SPECS) {
    const titles = [...read(path).matchAll(/^\s*test\("([^"]+)"/gm)].map((m) => m[1] ?? "");
    assert.ok(titles.length >= 2, `${path}: titles`);
    for (const title of titles) assert.match(title, /^OIDC-00\d /, `${path}: ${title}`);
  }
});

test("the held-private spec names only its ID in its titles and no mechanism in its messages", () => {
  const source = read(PRIVATE_SPEC);
  const titles = [...source.matchAll(/(?:describe|test)\("([^"]+)"/g)].map((m) => m[1] ?? "");
  assert.ok(titles.length >= 2, "titles");
  for (const title of titles) assert.match(title, /^P5-DOC-OIDC-003( check)?$/, title);
  assert.doesNotMatch(source, /aud|issuer|nonce|iss\b/i, "no claim names in the held-private spec");
});

test("the private ID is a held-private ledger entry with exactly id and status", () => {
  const ledger = JSON.parse(read("docs/findings/ledger.json")) as {
    private: Array<Record<string, unknown>>;
  };
  const entry = ledger.private.find((item) => item.id === "P5-DOC-OIDC-003");
  assert.ok(entry, "P5-DOC-OIDC-003 is in the private list");
  assert.deepEqual(Object.keys(entry).sort(), ["id", "status"]);
  assert.equal(entry.status, "held-private");
});
