import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { redactText, REDACTED } from "../../../scripts/scan/zap-redact.ts";
import { REPO, scratch, writeTree } from "./fixtures/index.ts";

const SCANNER = join(REPO, "scripts/scan/evidence-token-scan.mjs");
const REDACTOR = join(REPO, "scripts/scan/zap-redact.ts");
// Synthetic credential-shaped values, assembled at runtime.
const SECRET = ["hunter2", "LongValueHere"].join("-");
const JWT = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiIxIn0", "c2lnbmF0dXJlMTIzNDU2"].join(".");

test("a sensitive query value is redacted and the key name and URL are kept", () => {
  const url = `https://x.test/login?password=${SECRET}&next=/home`;
  const { text, count } = redactText(url);
  assert.equal(text, `https://x.test/login?password=${REDACTED}&next=/home`);
  assert.equal(count, 1);
  assert.doesNotMatch(text, new RegExp(SECRET));
});

test("non-sensitive parameters are left untouched", () => {
  const url = "https://x.test/list?page=2&q=shoes&sort=asc&postcode=AB1";
  const { text, count } = redactText(url);
  assert.equal(text, url);
  assert.equal(count, 0);
});

test("a key is matched as a whole name, case-insensitively, and csrf_token counts as token", () => {
  const { text } = redactText(`a?PASSWORD=${SECRET}&csrf_token=${JWT}&postcode=ZZ1`);
  assert.equal(text, `a?PASSWORD=${REDACTED}&csrf_token=${REDACTED}&postcode=ZZ1`);
});

test("a sensitive JSON key's string value is redacted and the key kept", () => {
  const json = `{"uri":"https://x.test/a?next=/b","token": "${JWT}","page": "2"}`;
  const { text, count } = redactText(json);
  assert.equal(text, `{"uri":"https://x.test/a?next=/b","token": "${REDACTED}","page": "2"}`);
  assert.equal(count, 1);
});

test("the redactor does not print a value and reports only a count", () => {
  const dir = scratch("zap-redact-cli");
  writeTree(dir, {
    "zap.json": `{"uri":"https://x.test/?password=${SECRET}"}\n`,
    "zap.html": "<p>ok</p>\n",
  });
  const result = spawnSync(process.execPath, ["--experimental-strip-types", REDACTOR, dir], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /redacted 1 value\(s\) in zap\.json/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(SECRET));
  assert.doesNotMatch(readFileSync(join(dir, "zap.json"), "utf8"), new RegExp(SECRET));
});

test("the gate still fails on an unredacted credential-shaped token anywhere else in the artefacts", () => {
  const dir = scratch("zap-redact-gate");
  // A sensitive query value is redacted; a Bearer token elsewhere is NOT a query value and must still fail the gate.
  writeTree(dir, {
    "zap.json": `{"uri":"https://x.test/?password=${SECRET}","evidence":"Authorization: Bearer ${JWT}"}\n`,
    "zap.html": "<p>page</p>\n",
  });
  assert.equal(
    spawnSync(process.execPath, ["--experimental-strip-types", REDACTOR, dir], { encoding: "utf8" })
      .status,
    0,
  );
  const gate = spawnSync(process.execPath, [SCANNER, dir], { encoding: "utf8" });
  assert.equal(gate.status, 1, "an unredacted Bearer token must fail the gate");
  assert.match(gate.stderr, /TOKEN PATTERN: zap\.json line 1 rule Bearer header text/);
  assert.doesNotMatch(gate.stderr, new RegExp(JWT.slice(0, 16)));
});

test("the exact placeholder that the redactor writes passes the gate (B46): the placeholder is one shared constant", () => {
  const dir = scratch("zap-redact-sentinel");
  writeTree(dir, { "zap.json": `{"uri":"https://x.test/?password=${SECRET}"}\n` });
  spawnSync(process.execPath, ["--experimental-strip-types", REDACTOR, dir], { encoding: "utf8" });
  assert.match(readFileSync(join(dir, "zap.json"), "utf8"), /password=\[REDACTED\]/);
  const gate = spawnSync(process.execPath, [SCANNER, dir], { encoding: "utf8" });
  assert.equal(gate.status, 0, gate.stderr);
});
